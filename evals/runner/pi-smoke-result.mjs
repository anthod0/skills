import { parseAgentOutput, assessAgent } from "./agent-result.mjs";

export function assessPiSmoke(execution, selection) {
  let output;
  try {
    output = parseAgentOutput(execution);
  } catch (error) {
    return { ok: false, reason: error.message };
  }
  const check = assessAgent(output, selection);
  if (!check.ok) return check;
  if (check.finalResponse !== "PI_SMOKE_OK")
    return { ok: false, reason: "Missing final smoke acknowledgement" };
  const tools = output.events.filter((event) => event.type === "tool_execution_end");
  if (
    tools.some((event) => event.isError !== false) ||
    !["read", "write", "edit", "bash"].every((name) =>
      tools.some((event) => event.toolName === name),
    )
  ) {
    return { ok: false, reason: "All four built-in tools must complete successfully" };
  }
  if (output.files["probe.txt"] !== "AFTER\n")
    return { ok: false, reason: "Workspace file did not contain the expected edit" };
  const { piVersion, nodeVersion, uid, cwd, authMode } = output.runtime;
  return {
    ok: true,
    piVersion,
    nodeVersion,
    uid,
    cwd,
    authMode,
    tools: ["read", "write", "edit", "bash"],
    assistantMessages: check.assistantMessages,
  };
}
