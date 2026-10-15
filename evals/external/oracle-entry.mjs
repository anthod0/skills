import { cp, writeFile, access } from "node:fs/promises";
import { spawnSync } from "node:child_process";

async function main() {
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 16 * 1024 * 1024) throw new Error("Payload too large");
  }
  const { patch, script } = JSON.parse(input);
  if (typeof script !== "string" || (patch !== undefined && typeof patch !== "string"))
    throw new Error("Invalid oracle input");
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
  if (patch?.trim()) {
    const apply = spawnSync("git", ["apply", "--verbose", "-"], {
      input: patch,
      encoding: "utf8",
      timeout: 30_000,
    });
    if (apply.status !== 0) {
      console.log(
        JSON.stringify({
          applied: false,
          code: apply.status,
          log: ">>>>> Patch Apply Failed\n" + apply.stderr,
        }),
      );
      return;
    }
  }
  await writeFile("/testbed/evaluation.sh", script, { flag: "wx" });
  const result = spawnSync("bash", ["-c", "exec bash /testbed/evaluation.sh 2>&1"], {
    encoding: "utf8",
    timeout: 590_000,
    maxBuffer: 3 * 1024 * 1024,
    killSignal: "SIGKILL",
  });
  console.log(
    JSON.stringify({
      applied: true,
      code: result.status,
      problem: result.error?.code,
      log: (patch !== undefined ? ">>>>> Applied Patch\n" : "") + result.stdout + result.stderr,
    }),
  );
}

main().catch((error) => {
  console.error(`Benchmark oracle bootstrap failed: ${error.message}`);
  process.exitCode = 2;
});
