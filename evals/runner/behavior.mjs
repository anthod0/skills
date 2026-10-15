import { changesBetween } from "./submission.mjs";
import { sessionEntries } from "./session.mjs";

export const supportedCases = [
  "write-good-test/mixed-assertions",
  "write-good-test/css-and-prompt-assertions",
  "write-good-test/reply-language",
  "test-filesystem-safety/ssh-hosts-list-filter",
];
export const conditions = ["without-skill", "with-skill"];
export const verdicts = ["satisfied", "violated", "not-applicable", "insufficient-evidence"];

// IDs are part of the rubric's review contract, not a prose-matching grader.
export function criterionIds(criteria) {
  const ids = [...criteria.matchAll(/^## ([a-z][a-z0-9-]+)\s*$/gm)].map((match) => match[1]);
  if (!ids.length || new Set(ids).size !== ids.length)
    throw new Error("Missing or duplicate criterion IDs");
  return ids;
}

export function reviewMaterial(inputs, output) {
  if (typeof inputs.task !== "string" || !inputs.task.trim()) throw new Error("Missing task");
  const changes = changesBetween(inputs.files, output.files);
  const evidence = [
    { id: "task", text: inputs.task },
    ...Object.entries(inputs.files).map(([path, text]) => ({ id: `initial:${path}`, text })),
    ...changes.map(({ path, before, after }) => ({ id: `change:${path}`, before, after })),
  ];
  sessionEntries(output).forEach((entry, index) => {
    if (entry.type !== "message") return;
    const { role, content, sections, toolsAdded, toolsRemoved, toolCallId, toolName, isError } =
      entry.message;
    const record = {
      type: "message",
      message: Object.fromEntries(
        Object.entries({
          role,
          content,
          sections,
          toolsAdded,
          toolsRemoved,
          toolCallId,
          toolName,
          isError,
        }).filter(([, value]) => value !== undefined),
      ),
    };
    evidence.push({ id: `session:${index + 1}`, record });
  });
  return { evidence };
}

export function reviewRequest(prompt, criteria, material) {
  criterionIds(criteria);
  const systemPrompt = `${prompt}\n\n# Trusted case criteria\n\n${criteria}`;
  const task = JSON.stringify(material);
  return { systemPrompt, task };
}

export function parseReview(text, criteria, material) {
  let review;
  try {
    review = JSON.parse(text);
  } catch {
    throw new Error("Judge did not return JSON");
  }
  const ids = criterionIds(criteria);
  const evidence = new Map(material.evidence.map((item) => [item.id, item]));
  if (!review || !Array.isArray(review.criteria) || review.criteria.length !== ids.length)
    throw new Error("Judge must return every criterion exactly once");
  const remaining = new Set(ids);
  for (const item of review.criteria) {
    if (
      !item ||
      !remaining.delete(item.criterion) ||
      !verdicts.includes(item.verdict) ||
      typeof item.reason !== "string" ||
      !item.reason.trim() ||
      !Array.isArray(item.evidence) ||
      (item.verdict !== "insufficient-evidence" && !item.evidence.length) ||
      item.evidence.some((id) => !evidence.has(id))
    )
      throw new Error("Invalid criterion, verdict, reason, or evidence reference");
    if (
      item.verdict !== "insufficient-evidence" &&
      !item.evidence.some((id) => {
        const source = evidence.get(id);
        return (
          id.startsWith("initial:") ||
          id.startsWith("change:") ||
          source.record?.message?.role === "toolResult" ||
          (source.record?.message?.role === "assistant" &&
            Array.isArray(source.record.message.content) &&
            source.record.message.content.some((part) => part.type === "toolCall"))
        );
      })
    )
      throw new Error("Behavior verdict requires code or tool evidence, not self-report alone");
  }
  return {
    criteria: review.criteria.map(({ criterion, verdict, evidence, reason }) => ({
      criterion,
      verdict,
      evidence,
      reason,
    })),
  };
}

export function reviewStatus(results) {
  if (!results.length || results.some((result) => result.status === "error" || !result.agent?.ok))
    return "error";
  if (
    results.some(
      (result) =>
        !result.scope?.ok || result.behavior.criteria.some((item) => item.verdict === "violated"),
    )
  )
    return "violated";
  if (
    results.some((result) =>
      result.behavior.criteria.some((item) => item.verdict === "insufficient-evidence"),
    )
  )
    return "needs-review";
  return "reviewed";
}

export function reviewExitCode(status) {
  return { reviewed: 0, violated: 1, error: 2, "needs-review": 3 }[status] ?? 2;
}
