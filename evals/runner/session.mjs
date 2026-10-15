import { readRegular } from "./files.mjs";

export const sessionPath = "/run/pi-agent/session.jsonl";

export async function readSession() {
  return readRegular(sessionPath, 4 * 1024 * 1024);
}

// Evaluation runs are fresh, linear sessions with automatic compaction disabled.
// Refuse context rewrites rather than silently judging a different context.
export function sessionEntries(output) {
  if (typeof output.sessionJsonl !== "string") throw new Error("Missing native session JSONL");
  let entries;
  try {
    entries = output.sessionJsonl
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line));
  } catch {
    throw new Error("Malformed or truncated native session JSONL");
  }
  if (entries[0]?.type !== "session" || entries[0].version !== 3)
    throw new Error("Invalid native session header");
  let parent = null;
  const ids = new Set();
  for (const entry of entries.slice(1)) {
    if (
      !entry ||
      typeof entry.type !== "string" ||
      typeof entry.id !== "string" ||
      !entry.id ||
      ids.has(entry.id) ||
      entry.parentId !== parent
    )
      throw new Error("Native session must be a complete linear history");
    if (["compaction", "context_edit", "branch_summary"].includes(entry.type))
      throw new Error("Rewritten session context is not supported");
    if (entry.type === "message" && (!entry.message || typeof entry.message.role !== "string"))
      throw new Error("Invalid native session message");
    ids.add(entry.id);
    parent = entry.id;
  }
  return entries;
}

export function sessionMessages(output) {
  return sessionEntries(output)
    .filter((entry) => entry.type === "message")
    .map((entry) => entry.message);
}
