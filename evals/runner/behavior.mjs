import { changesBetween } from "./submission.mjs";
import { reviewDirectory, validateReviewFiles } from "./review-files.mjs";

export const supportedCases = [
  "write-good-test/mixed-assertions",
  "write-good-test/css-and-prompt-assertions",
  "write-good-test/reply-language",
  "test-filesystem-safety/ssh-hosts-list-filter",
];
export const conditions = ["without-skill", "with-skill"];
export const verdicts = ["satisfied", "violated", "not-applicable", "insufficient-evidence"];

export function criterionIds(criteria) {
  const ids = [...criteria.matchAll(/^## ([a-z][a-z0-9-]+)\s*$/gm)].map((match) => match[1]);
  if (!ids.length || new Set(ids).size !== ids.length)
    throw new Error("Missing or duplicate criterion IDs");
  return ids;
}

export function reviewRequest(prompt, criteria, inputs, output) {
  criterionIds(criteria);
  if (typeof inputs.task !== "string" || !inputs.task.trim()) throw new Error("Missing task");
  const reviewFiles = {
    "task.md": inputs.task,
    "session.jsonl": output.sessionJsonl,
    "initial.json": JSON.stringify(inputs.files, null, 2) + "\n",
    "changes.json": JSON.stringify(changesBetween(inputs.files, output.files), null, 2) + "\n",
  };
  validateReviewFiles(reviewFiles);
  return {
    systemPrompt: prompt,
    task: `Review the agent's behavior using these files:\n${Object.keys(reviewFiles)
      .map((name) => `${reviewDirectory}/${name}`)
      .join(
        "\n",
      )}\nRead the materials with your tools, inspect the native session JSONL yourself, and return the required JSON verdicts.\n\n# Trusted case criteria\n\n${criteria}`,
    reviewFiles,
  };
}

export function parseReview(text, criteria, reviewFiles) {
  let review;
  try {
    review = JSON.parse(text);
  } catch {
    throw new Error("Judge did not return JSON");
  }
  validateReviewFiles(reviewFiles);
  const ids = criterionIds(criteria);
  if (!review || !Array.isArray(review.criteria) || review.criteria.length !== ids.length)
    throw new Error("Judge must return every criterion exactly once");
  const remaining = new Set(ids);
  const validReference = (reference) => {
    if (typeof reference !== "string") return false;
    const match = reference.match(/^\/workspace\/materials\/([\w.-]+):(\d+)(?:-(\d+))?$/);
    if (!match || !Object.hasOwn(reviewFiles, match[1])) return false;
    const start = Number(match[2]);
    const end = Number(match[3] ?? match[2]);
    const lines = reviewFiles[match[1]].replace(/\n$/, "").split("\n").length;
    return (
      Number.isSafeInteger(start) &&
      Number.isSafeInteger(end) &&
      start >= 1 &&
      end >= start &&
      end <= lines
    );
  };
  for (const item of review.criteria) {
    if (
      !item ||
      !remaining.delete(item.criterion) ||
      !verdicts.includes(item.verdict) ||
      typeof item.reason !== "string" ||
      !item.reason.trim() ||
      !Array.isArray(item.evidence) ||
      (item.verdict !== "insufficient-evidence" && !item.evidence.length) ||
      item.evidence.some((reference) => !validReference(reference))
    )
      throw new Error("Invalid criterion, verdict, reason, or evidence reference");
    if (
      item.verdict !== "insufficient-evidence" &&
      !item.evidence.some((reference) => !reference.startsWith(`${reviewDirectory}/task.md:`))
    )
      throw new Error("Behavior verdict requires session or code evidence, not the task alone");
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
