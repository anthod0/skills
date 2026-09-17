import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { checkCommand } from "./plan.mjs";
import { writeTree } from "./files.mjs";
import { prepareWorkspace, testInvocation } from "./workspace.mjs";

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) {
  input += chunk;
  if (Buffer.byteLength(input) > 16 * 1024 * 1024) throw new Error("Fixture payload too large");
}
const { files, command } = JSON.parse(input);
checkCommand(command, files);
await writeTree("/workspace", files);
await prepareWorkspace(files);
const [program, ...args] = await testInvocation(files, command);
console.log(JSON.stringify({ type: "runtime", version: process.version }));
const vitest = args.includes("node_modules/vitest/vitest.mjs");
const child = spawnSync(program, args, {
  cwd: "/workspace",
  encoding: "utf8",
  maxBuffer: 4 * 1024 * 1024,
  timeout: 60_000,
  killSignal: "SIGKILL",
});
process.stderr.write(child.stderr ?? "");
if (vitest) {
  process.stderr.write(child.stdout ?? "");
  process.stdout.write(await readFile("/tmp/vitest-events.jsonl", "utf8"));
} else process.stdout.write(child.stdout ?? "");
if (child.error) throw child.error;
process.exitCode = child.status ?? 2;
