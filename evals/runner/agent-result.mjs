import { checkFiles } from "./files.mjs";
import { redact } from "./auth.mjs";
import { sessionEntries, sessionMessages } from "./session.mjs";

export function serializeAgentOutput(output, auth, currentAuth) {
  if (!currentAuth) {
    // Without the refreshed credential state, no session/file/stderr content is safe to export.
    output = {
      runtime: output.runtime,
      files: null,
      sessionJsonl: null,
      artifactError: "Authentication state unavailable; export content withheld",
      execution: { code: output.execution.code, problem: "Authentication state unavailable" },
    };
  } else {
    output = { ...output, sessionJsonl: redact(output.sessionJsonl ?? "", auth, currentAuth) };
  }
  const serialized = redact(JSON.stringify(output), auth, ...(currentAuth ? [currentAuth] : []));
  // Docker transport has a 4 MiB bound. Reserve space for its trailing newline
  // and diagnostics; never stream a partial native session or workspace export.
  if (Buffer.byteLength(serialized) > 4 * 1024 * 1024 - 1024) {
    return JSON.stringify({
      runtime: output.runtime,
      files: null,
      sessionJsonl: null,
      execution: { code: output.execution.code },
      artifactError:
        "Native session/workspace export exceeds the 4 MiB transport limit; content withheld",
    });
  }
  return serialized;
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
    !(typeof output.sessionJsonl === "string" || output.artifactError)
  )
    throw new Error("Invalid agent export");
  if (!output.artifactError) {
    sessionEntries(output);
    checkFiles(output.files);
  }
  return output;
}

export function assessAgent(output, { provider, model, cwd = "/workspace" }) {
  const { runtime, execution } = output;
  let allMessages;
  try {
    allMessages = sessionMessages(output);
  } catch (error) {
    return { ok: false, reason: output.artifactError ?? error.message };
  }
  const messages = allMessages.filter((message) => message.role === "assistant");
  const calls = messages.flatMap((message) =>
    Array.isArray(message.content)
      ? message.content.filter((part) => part.type === "toolCall")
      : [],
  );
  const results = allMessages.filter((message) => message.role === "toolResult");
  const sum = (get) =>
    messages.length &&
    messages.every((message) => Number.isFinite(get(message)) && get(message) >= 0)
      ? messages.reduce((total, message) => total + get(message), 0)
      : null;
  const metrics = {
    assistantMessages: messages.length,
    toolCalls: calls.length,
    toolErrors: results.filter((message) => message.isError).length,
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
    runtime.cwd !== cwd ||
    runtime.authMode !== 0o600 ||
    runtime.provider !== provider ||
    !/^\d+\.\d+\.\d+$/.test(runtime.piVersion) ||
    !/^v\d+\.\d+\.\d+$/.test(runtime.nodeVersion)
  )
    return fail("Container runtime or credential setup was not verified");
  if (output.artifactError) return fail(output.artifactError);
  if (execution.problem || execution.code !== 0) return fail("Pi failed or timed out");
  if (
    !messages.length ||
    messages.some(
      (message) =>
        message.provider !== provider ||
        message.model !== model ||
        !["stop", "toolUse"].includes(message.stopReason) ||
        !Array.isArray(message.content),
    )
  )
    return fail("Model mismatch or incomplete model response");
  const last = messages.at(-1);
  if (last.stopReason !== "stop" || allMessages.at(-1) !== last)
    return fail("Agent did not finish");
  const finalResponse = last.content
    .filter((part) => part?.type === "text")
    .map((part) => part.text)
    .join("")
    .trim();
  if (!finalResponse) return fail("No final response");
  if (
    calls.some(
      (call) =>
        typeof call.id !== "string" ||
        !call.id ||
        !call.arguments ||
        typeof call.arguments !== "object" ||
        Array.isArray(call.arguments) ||
        !["read", "write", "edit", "bash"].includes(call.name),
    ) ||
    results.some(
      (result) => typeof result.isError !== "boolean" || !Array.isArray(result.content),
    ) ||
    calls.length !== results.length ||
    new Set(calls.map((call) => call.id)).size !== calls.length ||
    calls.some((call) => {
      const matches = results.filter(
        (result) => result.toolCallId === call.id && result.toolName === call.name,
      );
      const owner = messages.find((message) => message.content.includes(call));
      return matches.length !== 1 || allMessages.indexOf(matches[0]) < allMessages.indexOf(owner);
    })
  )
    return fail("Incomplete tool history");
  return { ...metrics, ok: true, finalResponse };
}
