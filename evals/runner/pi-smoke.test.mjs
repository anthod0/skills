import assert from "node:assert/strict";
import test from "node:test";
import { runPiContainer } from "./docker.mjs";
import { piArguments } from "./pi-entry.mjs";
import { selectAuth, redact } from "./auth.mjs";
import { assessPiSmoke } from "./pi-smoke-result.mjs";
import { assessAgent, parseAgentOutput, serializeAgentOutput } from "./agent-result.mjs";

const selection = { provider: "example", model: "example-model" };
const credential = {
  type: "oauth",
  access: "synthetic-access",
  refresh: "synthetic-refresh",
  expires: 123,
};

test("copies only selected stored authentication, rejects key references, and redacts old and refreshed secrets", () => {
  assert.deepEqual(
    selectAuth(JSON.stringify({ example: credential, other: { secret: "unrelated" } }), "example"),
    { example: credential },
  );
  assert.throws(() => selectAuth("{}", "example"), /No stored authentication/);
  assert.throws(
    () => selectAuth("{ synthetic-secret", "example"),
    (error) => error instanceof Error && !error.message.includes("synthetic-secret"),
  );
  for (const key of ["!read-key", "$API_KEY", ""]) {
    assert.throws(
      () => selectAuth(JSON.stringify({ example: { type: "api_key", key } }), "example"),
      /stored OAuth or a literal/,
    );
  }
  assert.deepEqual(selectAuth('{"example":{"type":"api_key","key":"synthetic-key"}}', "example"), {
    example: { type: "api_key", key: "synthetic-key" },
  });
  const output = redact(
    "synthetic-access synthetic-refresh rotated-token harmless",
    { example: credential },
    { example: { ...credential, access: "rotated-token" } },
  );
  assert.equal(output, "[REDACTED] [REDACTED] [REDACTED] harmless");
  for (const key of ['synthetic\\key"', "synthetic\ud800"]) {
    const redactedJson = redact(JSON.stringify({ text: key }), {
      example: { type: "api_key", key },
    });
    assert.equal(JSON.parse(redactedJson).text, "[REDACTED]");
  }
});

function packet() {
  return {
    runtime: {
      uid: 1000,
      cwd: "/workspace",
      authMode: 0o600,
      provider: "example",
      piVersion: "0.85.1",
      nodeVersion: "v22.19.0",
    },
    execution: { code: 0 },
    files: { "probe.txt": "AFTER\n" },
    events: [
      ...["read", "write", "edit", "bash"].flatMap((toolName) => [
        { type: "tool_execution_start", toolName, toolCallId: toolName, args: {} },
        {
          type: "tool_execution_end",
          toolName,
          toolCallId: toolName,
          isError: false,
          result: { content: [] },
        },
      ]),
      {
        type: "message_end",
        message: {
          role: "assistant",
          ...selection,
          stopReason: "stop",
          content: [{ type: "text", text: "PI_SMOKE_OK" }],
          usage: {
            input: 10,
            output: 2,
            cacheRead: 3,
            cacheWrite: 0,
            totalTokens: 15,
            cost: { total: 0.01 },
          },
        },
      },
      { type: "agent_end" },
    ],
  };
}
const execution = (output) => ({ code: 0, stdout: JSON.stringify(output), stderr: "not archived" });

test("requires completion from expected model, complete tool traces, and verified container state", () => {
  assert.equal(assessPiSmoke(execution(packet()), selection).ok, true);
  assert.equal(assessAgent(packet(), selection).reportedCostUsd, 0.01);
  assert.equal(assessAgent(packet(), selection).usage.totalTokens, 15);
  for (const mutate of [
    (output) => {
      output.runtime.uid = 0;
    },
    (output) => {
      output.runtime.authMode = 0o644;
    },
    (output) => {
      output.runtime.cwd = "/host";
    },
    (output) => {
      output.events[1].isError = true;
    },
    (output) => {
      output.events.splice(1, 1);
    },
    (output) => {
      output.events[1].toolCallId = "unmatched";
    },
    (output) => {
      output.events[1].isError = "false";
    },
    (output) => {
      [output.events[0], output.events[1]] = [output.events[1], output.events[0]];
    },
    (output) => {
      delete output.events[0].args;
    },
    (output) => {
      delete output.events[1].result;
    },
    (output) => {
      output.events[8].message.model = "other-model";
    },
    (output) => {
      output.events[8].message.stopReason = "error";
    },
    (output) => {
      output.events[8].message.content = {};
    },
    (output) => {
      output.events.pop();
    },
    (output) => {
      output.files["probe.txt"] = "BEFORE\n";
    },
    (output) => {
      output.execution.problem = "ETIMEDOUT";
    },
    (output) => {
      output.artifactError = "Rejected link";
      output.files = null;
    },
  ]) {
    const output = packet();
    mutate(output);
    assert.equal(assessPiSmoke(execution(output), selection).ok, false);
  }
  for (const overrides of [
    { code: 1 },
    { problem: "Timed out" },
    { stdout: "invalid" },
    { stdout: "null" },
  ]) {
    assert.equal(assessPiSmoke({ ...execution(packet()), ...overrides }, selection).ok, false);
  }
  const failed = packet();
  failed.execution.problem = "ETIMEDOUT";
  assert.equal(assessAgent(failed, selection).reportedCostUsd, 0.01);
  const output = packet();
  output.files = { "../outside": "text" };
  assert.throws(() => parseAgentOutput(execution(output)), /Unsafe/);
});

test("unavailable post-run authentication preserves operation evidence without unknown credential content", () => {
  const output = packet();
  const unknownSecret = "unknown-refreshed-credential";
  output.execution.stderr = unknownSecret;
  output.files["leaked.txt"] = unknownSecret;
  output.events[0].toolCallId = unknownSecret;
  output.events[0].args = { command: `rm /run/pi-agent/auth.json; echo ${unknownSecret}` };
  output.events[1].result = { text: unknownSecret };
  output.events[2].toolName = unknownSecret;
  output.events[8].message.content = [{ type: "text", text: unknownSecret }];
  const serialized = serializeAgentOutput(output, { example: credential }, undefined);
  assert.equal(serialized.includes(unknownSecret), false);
  const archived = parseAgentOutput({ code: 0, stdout: serialized });
  assert.equal(archived.files, null);
  assert.equal(archived.traceContent, "withheld");
  assert.equal(archived.events.length, 8);
  assert.equal(archived.events[2].toolName, "unknown");
  assert.equal(archived.events.filter((event) => event.type === "tool_execution_start").length, 4);
  assert.equal(assessAgent(archived, selection).ok, false);
});

test("review invocations disable all tools and discovered resources; skills cannot enter a review", () => {
  const request = {
    ...selection,
    thinking: "high",
    skills: {},
    systemPrompt: "Trusted review rules",
  };
  const args = piArguments(request);
  for (const flag of [
    "--no-tools",
    "--no-skills",
    "--no-extensions",
    "--no-context-files",
    "--no-approve",
    "--no-session",
  ])
    assert.ok(args.includes(flag));
  assert.equal(args[args.indexOf("--system-prompt") + 1], request.systemPrompt);
  assert.equal(args.includes("--tools"), false);
  assert.throws(() => piArguments({ ...request, skills: { "example/SKILL.md": "hidden" } }));
  const agent = piArguments({
    ...selection,
    thinking: "high",
    skills: { "example/SKILL.md": "skill" },
  });
  assert.equal(agent[agent.indexOf("--tools") + 1], "read,write,edit,bash");
  assert.equal(agent[agent.indexOf("--skill") + 1], "/run/pi-agent/skills/example/SKILL.md");
});

test("Pi profiles send credentials only on stdin, bound the container lifetime, and remove their own container", async () => {
  for (const budgetSeconds of [180, 600]) {
    const calls = [];
    const payload = { ...selection, auth: { example: credential }, budgetSeconds };
    await runPiContainer("sha256:test", payload, {
      invoke: async (args, options) => {
        calls.push({ args, options });
        return { code: 0, stdout: "", stderr: "" };
      },
    });
    const { args, options } = calls[0];
    assert.deepEqual(JSON.parse(options.input), payload);
    assert.equal(
      args.some((arg) => arg.includes(credential.access)),
      false,
    );
    for (const flag of [
      "--network=bridge",
      "--read-only",
      "--user=1000:1000",
      "--cap-drop=ALL",
      "--security-opt=no-new-privileges",
    ])
      assert.ok(args.includes(flag));
    assert.ok(
      args.includes(
        "--tmpfs=/run/pi-agent:rw,nosuid,nodev,noexec,uid=1000,gid=1000,mode=0700,size=16m",
      ),
    );
    assert.deepEqual(args.slice(-4), [
      "sha256:test",
      `${budgetSeconds}s`,
      "node",
      "/harness/pi-entry.mjs",
    ]);
    assert.equal(options.timeoutMs, (budgetSeconds + 10) * 1000);
    assert.equal(
      args.some((arg) => /^(--mount|--volume|--env|--privileged|-v|-e)(=|$)/.test(arg)),
      false,
    );
    assert.deepEqual(calls[1].args, ["rm", "--force", args[args.indexOf("--name") + 1]]);
  }
});
