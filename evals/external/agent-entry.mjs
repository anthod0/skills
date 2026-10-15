import { cp, writeFile, stat, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { readRegular, writeTree } from "../runner/files.mjs";
import { selectAuth, redact } from "../runner/auth.mjs";
import { serializeAgentOutput } from "../runner/agent-result.mjs";
import { piArguments } from "../runner/pi-entry.mjs";
import { git as runGit, exportPatch, agentTask } from "./patch.mjs";

const git = (args) => runGit(args, "/testbed");

async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 16 * 1024 * 1024) throw new Error("Payload too large");
  }
  const payload = JSON.parse(input);
  const { auth, provider, model, skills, task } = payload;
  if (payload.budgetSeconds !== 600 || payload.thinking !== "high" || typeof task !== "string")
    throw new Error("Invalid benchmark agent input");
  selectAuth(JSON.stringify(auth), provider);
  await writeFile("/run/pi-agent/auth.json", JSON.stringify(auth), { mode: 0o600, flag: "wx" });
  await writeFile(
    "/run/pi-agent/settings.json",
    JSON.stringify({
      compaction: { enabled: false },
      retry: { enabled: false, provider: { maxRetries: 0, timeoutMs: 300_000 } },
    }),
    { mode: 0o600, flag: "wx" },
  );
  await writeTree("/run/pi-agent/skills", skills);
  try {
    await access("/opt/benchmark-env");
    await cp("/opt/benchmark-env", "/environment/miniconda3", {
      recursive: true,
      verbatimSymlinks: true,
    });
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await cp("/opt/benchmark", "/testbed", { recursive: true, verbatimSymlinks: true });
  git(["init", "-q"]);
  git(["config", "user.name", "Evaluation"]);
  git(["config", "user.email", "eval@invalid"]);
  git(["add", "--all"]);
  git([
    "-c",
    "user.name=Evaluation",
    "-c",
    "user.email=eval@invalid",
    "commit",
    "--no-gpg-sign",
    "--allow-empty",
    "-qm",
    "Benchmark base",
  ]);
  const base = git(["rev-parse", "HEAD"]).trim();
  const version = spawnSync("pi", ["--version"], { encoding: "utf8", timeout: 10_000 });
  if (version.status !== 0) throw new Error("Pi startup failed");
  const runtime = {
    piVersion: version.stdout.trim(),
    nodeVersion: process.version,
    uid: process.getuid(),
    cwd: process.cwd(),
    provider,
    authMode: (await stat("/run/pi-agent/auth.json")).mode & 0o777,
    mode: "agent",
  };
  const child = spawnSync("pi", piArguments(payload), {
    input: agentTask(task, payload.targetSkill, skills),
    encoding: "utf8",
    timeout: 590_000,
    maxBuffer: 4 * 1024 * 1024,
    killSignal: "SIGKILL",
  });
  const events = [];
  let problem = child.error?.code;
  for (const line of (child.stdout ?? "").split("\n").filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      if (!event || typeof event.type !== "string") throw new Error("Invalid event");
      if (/compaction/.test(event.type)) problem = "Compacted evidence";
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
      problem = "Malformed or truncated Pi event stream";
    }
  }
  const execution = {
    code: child.status,
    signal: child.signal,
    problem,
    stderr: child.stderr ?? "",
  };
  let currentAuth;
  try {
    currentAuth = selectAuth(await readRegular("/run/pi-agent/auth.json"), provider);
  } catch {}
  let patch, initial, files, artifactError;
  if (currentAuth) {
    try {
      ({ patch, initial, files } = await exportPatch(base, "/testbed"));
      const serialized = JSON.stringify({ patch, initial, files });
      if (redact(serialized, auth, currentAuth) !== serialized)
        throw new Error("Credential in submission");
    } catch {
      patch = null;
      initial = null;
      files = null;
      artifactError = "Benchmark patch/evidence export rejected";
    }
  }
  console.log(
    serializeAgentOutput(
      { runtime, events, execution, files, initial, patch, artifactError },
      auth,
      currentAuth,
    ),
  );
}

main().catch(() => {
  console.error("Benchmark agent bootstrap/export failed");
  process.exitCode = 2;
});
