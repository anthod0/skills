import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { readTree, writeTree } from "./files.mjs";

export function docker(args, { input = "", timeoutMs = 30_000, signal } = {}) {
  if (signal?.aborted)
    return Promise.resolve({ code: null, stdout: "", stderr: "", problem: "Interrupted" });
  return new Promise((resolve) => {
    const child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let size = 0;
    let problem;
    const stop = (reason) => {
      problem ??= reason;
      child.kill("SIGKILL");
    };
    const abort = () => stop("Interrupted");
    const timer = setTimeout(() => stop(`Timed out after ${timeoutMs}ms`), timeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    const collect = (stream) => (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > 4 * 1024 * 1024) return stop("Output exceeded 4 MiB");
      if (stream === "stdout") stdout += chunk;
      else stderr += chunk;
    };
    child.stdout.setEncoding("utf8").on("data", collect("stdout"));
    child.stderr.setEncoding("utf8").on("data", collect("stderr"));
    child.on("error", (error) => {
      problem = error.message;
    });
    child.stdin.on("error", (error) => {
      if (error.code !== "EPIPE") stop(error.message);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      resolve({ code, stdout, stderr, problem });
    });
    child.stdin.end(input);
  });
}

async function runContainer(
  image,
  flags,
  { prefix, input, timeoutMs, command = [], signal, invoke = docker },
) {
  const name = `${prefix}-${randomUUID()}`;
  let execution;
  try {
    execution = await invoke(
      [
        "run",
        "--name",
        name,
        "--rm",
        "--interactive",
        "--init",
        "--pull=never",
        "--read-only",
        "--user=1000:1000",
        "--cap-drop=ALL",
        "--security-opt=no-new-privileges",
        "--cpus=1",
        "--tmpfs=/workspace:rw,nosuid,nodev,exec,uid=1000,gid=1000,mode=0700,size=512m",
        "--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=64m",
        ...flags,
        image,
        ...command,
      ],
      { input, timeoutMs, signal },
    );
  } finally {
    const cleanup = await invoke(["rm", "--force", name], { timeoutMs: 10_000 });
    if (cleanup.problem || (cleanup.code !== 0 && !cleanup.stderr.includes("No such container"))) {
      execution ??= { code: null, stdout: "", stderr: "" };
      execution.cleanupFailed = true;
      execution.problem = [
        execution.problem,
        `Container cleanup failed (${name}): ${cleanup.problem ?? cleanup.stderr}`,
      ]
        .filter(Boolean)
        .join("; ");
    }
  }
  return execution;
}

export function runInContainer(image, { files, command }, options = {}) {
  return runContainer(image, ["--network=none", "--pids-limit=128", "--memory=1g"], {
    ...options,
    prefix: "skill-calibration",
    input: JSON.stringify({ files, command }),
    timeoutMs: 100_000,
  });
}

export function runPiContainer(image, payload, options = {}) {
  if (![180, 600].includes(payload.budgetSeconds)) throw new Error("Unsupported Pi time budget");
  return runContainer(
    image,
    [
      "--network=bridge",
      "--pids-limit=128",
      "--memory=1g",
      "--tmpfs=/run/pi-agent:rw,nosuid,nodev,noexec,uid=1000,gid=1000,mode=0700,size=16m",
    ],
    {
      ...options,
      prefix: "skill-pi",
      input: JSON.stringify(payload),
      timeoutMs: (payload.budgetSeconds + 10) * 1000,
      command: [`${payload.budgetSeconds}s`, "node", "/harness/pi-entry.mjs"],
    },
  );
}

export async function buildImage(directory, signal, files) {
  const preflight = await docker(["info", "--format", "{{.ServerVersion}}"], { signal });
  if (preflight.problem || preflight.code !== 0) throw new Error("Docker unavailable");
  const context = join(directory, "build-context");
  const sources = await readTree(fileURLToPath(new URL(".", import.meta.url)));
  if (files) {
    for (const name of ["package.json", "bun.lock"]) sources[`dependencies/${name}`] = files[name];
  }
  await writeTree(context, sources);
  const build = await docker(
    [
      "build",
      "--network=host",
      "--target",
      files ? "fixture" : "base",
      "--iidfile",
      join(directory, "image-id"),
      context,
    ],
    { timeoutMs: 300_000, signal },
  );
  await writeFile(join(directory, "build.log"), build.stdout + build.stderr);
  if (build.problem || build.code !== 0) throw new Error("Image build failed; see build.log");
  const image = (await readFile(join(directory, "image-id"), "utf8")).trim();
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error("Invalid built image ID");
  return { image, dockerVersion: preflight.stdout.trim() };
}
