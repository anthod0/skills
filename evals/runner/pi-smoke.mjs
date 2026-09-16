import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { docker, runPiContainer } from './docker.mjs';
import { selectAuth, assessPiSmoke } from './pi-smoke-result.mjs';

async function main() {
  const [provider, model, authFile, ...extra] = process.argv.slice(2);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(provider ?? '') || !model || model.startsWith('-') || extra.length) {
    throw new Error('Usage: bun evals/runner/pi-smoke.mjs <provider> <model> [auth-file]');
  }
  const authPath = authFile ?? join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi/agent'), 'auth.json');
  let authText;
  try { authText = await readFile(authPath, 'utf8'); }
  catch { throw new Error('Cannot read authentication file'); }
  const auth = selectAuth(authText, provider);
  const runnerRoot = fileURLToPath(new URL('.', import.meta.url));
  const directory = fileURLToPath(new URL(`../runs/pi-smoke-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}/`, import.meta.url));
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const report = { provider, model, thinking: 'low', status: 'running', startedAt: new Date().toISOString() };
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  console.log(`Results: ${directory}`);
  try {
    const preflight = await docker(['info', '--format', '{{.ServerVersion}}'], { signal: abort.signal });
    if (preflight.problem || preflight.code !== 0) throw new Error('Docker unavailable');
    report.dockerVersion = preflight.stdout.trim();
    const build = await docker([
      'build', '--network=host', '--file', join(runnerRoot, 'Dockerfile.pi'),
      '--iidfile', join(directory, 'image-id'), runnerRoot,
    ], { timeoutMs: 300_000, signal: abort.signal });
    await writeFile(join(directory, 'build.log'), build.stdout + build.stderr);
    if (build.problem || build.code !== 0) throw new Error('Pi image build failed; see build.log');
    report.image = (await readFile(join(directory, 'image-id'), 'utf8')).trim();
    if (!/^sha256:[a-f0-9]{64}$/.test(report.image)) throw new Error('Invalid built image ID');
    const execution = await runPiContainer(report.image, { provider, model, auth }, { signal: abort.signal });
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
