import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { checkPath, createPlan } from './plan.mjs';
import { assess } from './result.mjs';
import { buildImage, runInContainer } from './docker.mjs';
import { readRegular, readTree } from './files.mjs';

const evalRoot = fileURLToPath(new URL('../', import.meta.url));
const runnerRoot = join(evalRoot, 'runner');

async function main() {
  const [caseId, flag, ...extra] = process.argv.slice(2);
  if (!caseId || (flag && flag !== '--check') || extra.length) {
    throw new Error('Usage: bun evals/runner/calibrate.mjs <skill/case> [--check]');
  }
  checkPath(caseId);
  if (caseId.split('/').length !== 2) throw new Error('Expected skill/case');
  const caseRoot = join(evalRoot, 'cases', caseId);
  const manifest = JSON.parse(await readRegular(join(caseRoot, 'case.json')));
  checkPath(manifest.fixture);
  if (manifest.fixture.includes('/')) throw new Error('Fixture must name one directory');
  const files = await readTree(join(evalRoot, 'fixtures', manifest.fixture));
  const variants = JSON.parse(await readRegular(join(caseRoot, 'oracle/variants.json')));
  const reference = JSON.parse(await readRegular(join(caseRoot, 'oracle/reference.json')));
  const jobs = createPlan(files, variants, reference, manifest.test_command);
  if (flag === '--check') {
    console.log(`${caseId}: ${Object.keys(files).length} files, ${variants.length} variants, ${jobs.length} isolated runs planned. No fixture executed.`);
    return;
  }

  const directory = join(evalRoot, 'runs', `${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const harness = await readTree(runnerRoot);
  const inputs = JSON.stringify({ manifest, files, variants, reference, harness });
  const sourceHash = createHash('sha256').update(inputs).digest('hex');
  await writeFile(join(directory, 'inputs.json'), inputs + '\n');
  const report = { case: caseId, sourceHash, command: manifest.test_command, startedAt: new Date().toISOString(), status: 'running', planned: jobs.length, jobs: [] };
  const save = () => writeFile(join(directory, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  console.log(`Results: ${directory}`);
  try {
    Object.assign(report, await buildImage(directory, abort.signal));
    const { image } = report;
    for (const job of jobs) {
      if (abort.signal.aborted) throw new Error('Interrupted');
      const started = Date.now();
      const execution = await runInContainer(image, { files: job.files, command: manifest.test_command }, { signal: abort.signal });
      await writeFile(join(directory, `${job.id}.jsonl`), execution.stdout);
      await writeFile(join(directory, `${job.id}.stderr.log`), execution.stderr);
      const verdict = assess(job, execution);
      report.jobs.push({
        id: job.id, expected: job.expected, detects: job.detects, elapsedMs: Date.now() - started,
        exitCode: execution.code, cleanupFailed: execution.cleanupFailed ?? false, ...verdict,
      });
      await save();
      console.log(`${verdict.ok ? 'OK' : 'FAIL'} ${job.id}: ${verdict.reason ?? verdict.outcome}`);
      if (execution.cleanupFailed) throw new Error(execution.problem);
    }
    report.status = report.jobs.every((job) => job.ok) ? 'passed' : 'failed';
  } catch (error) {
    report.status = 'error';
    report.error = error.message;
    console.error(error.message);
  } finally {
    report.finishedAt = new Date().toISOString();
    await save();
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
  if (report.status !== 'passed') process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
