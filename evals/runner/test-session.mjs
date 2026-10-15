// Synthetic native session records for runner tests; never runs task code.
export function sessionJsonl(messages) {
  return (
    JSON.stringify({ type: "session", version: 3, id: "synthetic", cwd: "/workspace" }) +
    "\n" +
    messages
      .map((message, index) =>
        JSON.stringify({
          type: "message",
          id: `entry-${index}`,
          parentId: index ? `entry-${index - 1}` : null,
          timestamp: "2026-01-01T00:00:00.000Z",
          message,
        }),
      )
      .join("\n") +
    "\n"
  );
}

export function editSession(output, mutate) {
  const entries = output.sessionJsonl
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line));
  mutate(entries);
  output.sessionJsonl = entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n";
}
