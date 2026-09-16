import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { buildImage, runPiContainer } from './docker.mjs';
import { readAuth } from './auth.mjs';
import { assessPiSmoke } from './pi-smoke-result.mjs';

async function main() {
  const [provider, model, authFile, ...extra] = process.argv.slice(2);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(provider ?? '') || !model || model.startsWith('-') || extra.length) {
    throw new Error('Usage: bun evals/runner/pi-smoke.mjs <provider> <model> [auth-file]');
  }
  const auth = await readAuth(provider, authFile);
  const directory = fileURLToPath(new URL(`../runs/pi-smoke-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}/`, import.meta.url));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const report = { provider, model, thinking: 'low', status: 'running', startedAt: new Date().toISOString() };
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  console.log(`Results: ${directory}`);
  try {
    Object.assign(report, await buildImage(directory, abort.signal));
    const task = `Perform only this container smoke check. Do not inspect credentials, configuration, or environment variables.
1. Use write to create /workspace/probe.txt containing exactly BEFORE followed by a newline.
2. Use edit to replace BEFORE with AFTER in that file.
3. Use read to verify the updated file.
4. Use bash to run: test "$(pwd)" = /workspace && test "$(id -u)" -ne 0 && test "$(cat /workspace/probe.txt)" = AFTER && printf 'PI_CONTAINER_TOOLS_OK\\n'
Do not modify any other files. Finish with exactly PI_SMOKE_OK.`;
    const execution = await runPiContainer(report.image, {
      provider, model, auth, task, files: {}, skills: {}, thinking: 'low', budgetSeconds: 180,
    }, { signal: abort.signal });
    report.exitCode = execution.code;
    report.cleanupFailed = execution.cleanupFailed ?? false;
    report.check = assessPiSmoke(execution, { provider, model });
    report.status = report.check.ok ? 'passed' : 'failed';
    console.log(report.check.ok ? 'OK: Pi authenticated, completed all four tools, and verified the edited file.' : report.check.reason);
  } catch (error) {
    report.status = 'error';
    report.error = error.message;
    console.error(error.message);
  } finally {
    report.finishedAt = new Date().toISOString();
    await writeFile(join(directory, 'result.json'), JSON.stringify(report, null, 2) + '\n');
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
