import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { checkPath, checkCommand } from "./plan.mjs";

let input = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) {
  input += chunk;
  if (Buffer.byteLength(input) > 16 * 1024 * 1024) throw new Error("Fixture payload too large");
}
const { files, command } = JSON.parse(input);
checkCommand(command, files);
for (const [path, content] of Object.entries(files)) {
  checkPath(path);
  const destination = join("/workspace", path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, content, { flag: "wx" });
}
console.log(JSON.stringify({ type: "runtime", version: process.version }));
const child = spawn(
  process.execPath,
  ["--test", "--test-reporter=/harness/reporter.mjs", ...command.slice(2)],
  {
    cwd: "/workspace",
    stdio: ["ignore", "inherit", "inherit"],
  },
);
child.on("error", (error) => {
  console.error(error);
  process.exitCode = 2;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 2;
});
