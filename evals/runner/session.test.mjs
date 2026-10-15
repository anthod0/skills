import assert from "node:assert/strict";
import test from "node:test";
import { sessionEntries, sessionMessages } from "./session.mjs";
import { sessionJsonl, editSession } from "./test-session.mjs";
import { serializeAgentOutput, parseAgentOutput, assessAgent } from "./agent-result.mjs";
import { reviewRequest } from "./behavior.mjs";

const messages = [
  {
    role: "system",
    content: "",
    sections: { preamble: "Original rules", skills: "Available skills" },
    toolsAdded: [{ name: "read" }],
  },
  { role: "user", content: "Inspect the repository" },
  { role: "system", content: "", sections: { skills: null }, toolsRemoved: [{ name: "read" }] },
];

test("native session preserves prompt/tool updates verbatim in the judge material file", () => {
  const output = { sessionJsonl: sessionJsonl(messages), files: {} };
  assert.deepEqual(sessionMessages(output), messages);
  const request = reviewRequest(
    "Review",
    "## context\nCheck context.",
    { task: "Inspect the repository", files: {} },
    output,
  );
  assert.equal(request.reviewFiles["session.jsonl"], output.sessionJsonl);
});

test("missing, truncated, branching and rewritten context cannot become valid evidence", () => {
  for (const value of [
    undefined,
    "",
    "null\n",
    '{"type":"session"',
    '{"type":"session","version":2}\n',
  ]) {
    assert.throws(() => sessionEntries({ sessionJsonl: value }));
  }
  for (const mutate of [
    (entries) => {
      entries[2].parentId = null;
    },
    (entries) => {
      entries[2].id = entries[1].id;
    },
    (entries) => {
      delete entries[2].message;
    },
    ...["compaction", "context_edit", "branch_summary"].map((type) => (entries) => {
      entries[2].type = type;
    }),
  ]) {
    const output = { sessionJsonl: sessionJsonl(messages) };
    editSession(output, mutate);
    assert.throws(() => sessionEntries(output));
  }
});

test("oversized native export returns a bounded explicit failure instead of a truncated session", () => {
  const auth = { example: { type: "api_key", key: "synthetic-key" } };
  const output = {
    runtime: { provider: "example" },
    execution: { code: 0 },
    files: {},
    sessionJsonl: sessionJsonl([{ role: "user", content: '\\"'.repeat(2 * 1024 * 1024) }]),
  };
  const serialized = serializeAgentOutput(output, auth, auth);
  assert.ok(Buffer.byteLength(serialized) < 4 * 1024 * 1024);
  const archived = parseAgentOutput({ code: 0, stdout: serialized });
  assert.equal(archived.sessionJsonl, null);
  assert.match(archived.artifactError, /transport limit/);
  assert.equal(assessAgent(archived, { provider: "example", model: "test" }).ok, false);
});

test("native session serialization keeps record structure while redacting original and refreshed credentials", () => {
  const auth = { example: { type: "api_key", key: 'original\\secret"' } };
  const refreshed = { example: { type: "api_key", key: "refreshed-secret" } };
  const output = {
    sessionJsonl: sessionJsonl([
      { role: "user", content: `${auth.example.key} ${refreshed.example.key}` },
    ]),
    execution: { code: 0 },
  };
  const exported = JSON.parse(serializeAgentOutput(output, auth, refreshed));
  assert.deepEqual(sessionMessages(exported), [{ role: "user", content: "[REDACTED] [REDACTED]" }]);
});
