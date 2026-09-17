import { writeFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { readRegular, readTree, writeTree } from "./files.mjs";
import { selectAuth, redact } from "./auth.mjs";
import { serializeAgentOutput } from "./agent-result.mjs";
import { prepareWorkspace, generatedPaths } from "./workspace.mjs";

export function piArguments({ provider, model, thinking, skills, systemPrompt }) {
  const skillArgs = Object.keys(skills)
    .filter((path) => path.endsWith("/SKILL.md"))
    .flatMap((path) => ["--skill", `/run/pi-agent/skills/${path}`]);
  if (
    systemPrompt !== undefined &&
    (typeof systemPrompt !== "string" || !systemPrompt || Object.keys(skills).length)
  )
    throw new Error("Review requires a system prompt and no skills");
  return [
    "--mode",
    "json",
    "--print",
    "--no-session",
    "--offline",
    "--no-approve",
    "--no-extensions",
    "--no-skills",
    "--no-prompt-templates",
    "--no-themes",
    "--no-context-files",
    ...(systemPrompt === undefined
      ? ["--tools", "read,write,edit,bash", ...skillArgs]
      : ["--no-tools", "--system-prompt", systemPrompt]),
    "--provider",
    provider,
    "--model",
    model,
    "--thinking",
    thinking,
  ];
}

async function main() {
  let input = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 16 * 1024 * 1024) throw new Error("Payload too large");
  }
  const { provider, model, thinking, budgetSeconds, auth, task, files, skills, systemPrompt } =
    JSON.parse(input);
  const args = piArguments({ provider, model, thinking, skills, systemPrompt });
  if (systemPrompt !== undefined && Object.keys(files).length)
    throw new Error("Review workspace must be empty");
  if (
    typeof provider !== "string" ||
    typeof model !== "string" ||
    typeof task !== "string" ||
    !["low", "high"].includes(thinking) ||
    ![180, 600].includes(budgetSeconds) ||
    !auth ||
    Object.keys(auth).length !== 1 ||
    !Object.hasOwn(auth, provider)
  )
    throw new Error("Invalid input");
  await writeFile("/run/pi-agent/auth.json", JSON.stringify(auth), { mode: 0o600, flag: "wx" });
  await writeFile(
    "/run/pi-agent/settings.json",
    JSON.stringify({
      compaction: { enabled: false },
      retry: { enabled: false, provider: { maxRetries: 0, timeoutMs: 300_000 } },
    }),
    { mode: 0o600, flag: "wx" },
  );
  await writeTree("/workspace", files);
  await writeTree("/run/pi-agent/skills", skills);
  for (const args of [
    ["init", "-q"],
    ["add", "--all"],
    [
      "-c",
      "user.name=Evaluation",
      "-c",
      "user.email=eval@invalid",
      "commit",
      "--no-gpg-sign",
      "--allow-empty",
      "-qm",
      "Fixture",
    ],
  ]) {
    if (spawnSync("git", args, { timeout: 5000 }).status !== 0)
      throw new Error("Cannot initialize fixture repository");
  }
  await prepareWorkspace(files);
  const version = spawnSync("pi", ["--version"], { encoding: "utf8", timeout: 10_000 });
  if (version.status !== 0) throw new Error("Pi version check failed");
  const runtime = {
    piVersion: version.stdout.trim(),
    nodeVersion: process.version,
    uid: process.getuid(),
    cwd: process.cwd(),
    provider,
    authMode: (await stat("/run/pi-agent/auth.json")).mode & 0o777,
    mode: systemPrompt === undefined ? "agent" : "review",
  };
  const child = spawnSync("pi", args, {
    input: task,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
    timeout: (budgetSeconds - 10) * 1000,
    killSignal: "SIGKILL",
  });
  // Capture authoritative messages and every tool start/end; streaming deltas and
  // agent_end.messages duplicate this content and can balloon the export.
  const events = [];
  let eventError;
  for (const line of (child.stdout ?? "").split("\n").filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      if (!event || typeof event.type !== "string") throw new Error("Invalid event");
      if (/compaction/.test(event.type)) eventError = "Compacted evidence is not supported";
      if (event.type === "agent_end") events.push({ type: "agent_end" });
      else if (
        [
          "session",
          "agent_start",
          "message_end",
          "tool_execution_start",
          "tool_execution_end",
        ].includes(event.type)
      )
        events.push(event);
    } catch {
      eventError = "Malformed or truncated Pi event stream";
    }
  }
  const execution = {
    code: child.status,
    signal: child.signal,
    problem: child.error?.code ?? eventError,
    stderr: child.stderr ?? "",
  };
  let currentAuth;
  try {
    currentAuth = selectAuth(await readRegular("/run/pi-agent/auth.json"), provider);
  } catch {}
  if (!currentAuth) {
    console.log(serializeAgentOutput({ runtime, events, execution }, auth));
    return;
  }
  let exported;
  let artifactError;
  try {
    exported = await readTree("/workspace", { ignoreGit: true, excludeRoots: generatedPaths });
    const serialized = JSON.stringify(exported);
    if (redact(serialized, auth, currentAuth) !== serialized)
      throw new Error("Credential in workspace");
  } catch {
    exported = null;
    artifactError =
      "Workspace export rejected (link, binary, size/path limit, or credential material)";
  }
  console.log(
    serializeAgentOutput(
      { runtime, events, files: exported, artifactError, execution },
      auth,
      currentAuth,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    // Do not dump credential-related exceptions or unaudited child output.
    console.error("Pi container bootstrap/export failed");
    process.exitCode = 2;
  });
}
