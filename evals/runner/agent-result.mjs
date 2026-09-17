import { checkFiles } from "./files.mjs";
import { redact } from "./auth.mjs";

export function serializeAgentOutput(output, auth, currentAuth) {
  if (!currentAuth) {
    // Unknown refreshed credentials may be present anywhere in arguments,
    // messages, IDs, results, stderr, or files. Retain only enum/boolean metadata.
    output = {
      runtime: output.runtime,
      files: null,
      traceContent: "withheld",
      artifactError: "Authentication state unavailable; export content withheld",
      execution: { code: output.execution.code, problem: "Authentication state unavailable" },
      events: output.events
        .filter((event) => ["tool_execution_start", "tool_execution_end"].includes(event.type))
        .map((event, index) => ({
          type: event.type,
          sequence: index + 1,
          toolName: ["read", "write", "edit", "bash"].includes(event.toolName)
            ? event.toolName
            : "unknown",
          ...(event.type === "tool_execution_end" ? { isError: event.isError === true } : {}),
        })),
    };
  }
  return redact(JSON.stringify(output), auth, ...(currentAuth ? [currentAuth] : []));
}

export function parseAgentOutput(execution) {
  if (execution.problem) throw new Error(execution.problem);
  if (execution.code !== 0)
    throw new Error(`Agent container exited with code ${execution.code}; raw output withheld`);
  let output;
  try {
    output = JSON.parse(execution.stdout);
  } catch {
    throw new Error("Malformed agent export");
  }
  if (
    !output?.runtime ||
    !output.execution ||
    !Array.isArray(output.events) ||
    output.events.some((event) => !event || typeof event.type !== "string")
  )
    throw new Error("Invalid agent export");
  if (!output.artifactError) checkFiles(output.files);
  return output;
}

export function assessAgent(output, { provider, model }) {
  const { runtime, execution, events } = output;
  const messages = events
    .filter((event) => event.type === "message_end" && event.message?.role === "assistant")
    .map((event) => event.message);
  const starts = events.filter((event) => event.type === "tool_execution_start");
  const ends = events.filter((event) => event.type === "tool_execution_end");
  const sum = (get) =>
    messages.length &&
    messages.every((message) => Number.isFinite(get(message)) && get(message) >= 0)
      ? messages.reduce((total, message) => total + get(message), 0)
      : null;
  const metrics = {
    assistantMessages: messages.length,
    toolCalls: starts.length,
    toolErrors: ends.filter((event) => event.isError).length,
    usage: Object.fromEntries(
      ["input", "output", "cacheRead", "cacheWrite", "totalTokens"].map((key) => [
        key,
        sum((message) => message.usage?.[key]),
      ]),
    ),
    reportedCostUsd: sum((message) => message.usage?.cost?.total),
  };
  const fail = (reason) => ({ ...metrics, ok: false, reason });
  if (
    runtime.uid !== 1000 ||
    runtime.cwd !== "/workspace" ||
    runtime.authMode !== 0o600 ||
    runtime.provider !== provider ||
    !/^\d+\.\d+\.\d+$/.test(runtime.piVersion) ||
    !/^v\d+\.\d+\.\d+$/.test(runtime.nodeVersion)
  )
    return fail("Container runtime or credential setup was not verified");
  if (output.artifactError) return fail(output.artifactError);
  if (execution.problem || execution.code !== 0)
    return fail("Pi failed, timed out, or exceeded its output limit");
  if (
    !messages.length ||
    messages.some(
      (message) =>
        message.provider !== provider ||
        message.model !== model ||
        !["stop", "toolUse"].includes(message.stopReason),
    )
  )
    return fail("Model mismatch or incomplete model response");
  const last = messages.at(-1);
  if (
    events.filter((event) => event.type === "agent_end").length !== 1 ||
    last.stopReason !== "stop" ||
    !Array.isArray(last.content)
  )
    return fail("Agent did not finish");
  const finalResponse = last.content
    .filter((part) => part?.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
  if (!finalResponse) return fail("No final response");
  if (
    starts.some(
      (event) =>
        typeof event.toolCallId !== "string" ||
        !event.toolCallId ||
        !event.args ||
        typeof event.args !== "object" ||
        Array.isArray(event.args) ||
        !["read", "write", "edit", "bash"].includes(event.toolName),
    ) ||
    ends.some(
      (event) =>
        typeof event.isError !== "boolean" || !event.result || typeof event.result !== "object",
    ) ||
    starts.length !== ends.length ||
    new Set(starts.map((event) => event.toolCallId)).size !== starts.length ||
    starts.some((start) => {
      const matches = ends.filter(
        (end) => end.toolCallId === start.toolCallId && end.toolName === start.toolName,
      );
      return matches.length !== 1 || events.indexOf(matches[0]) < events.indexOf(start);
    })
  ) {
    return fail("Incomplete tool trace");
  }
  return { ...metrics, ok: true, finalResponse };
}
