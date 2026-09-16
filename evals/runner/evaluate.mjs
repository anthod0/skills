import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { readRegular, readTree } from './files.mjs';
import { readAuth, redact } from './auth.mjs';
import { createPlan } from './plan.mjs';
import { buildImage, runPiContainer, runInContainer } from './docker.mjs';
import { parseAgentOutput, assessAgent } from './agent-result.mjs';
import { changesBetween, checkScope, createSubmissionPlan } from './submission.mjs';
import { assess } from './result.mjs';

const evalRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = (text) => createHash('sha256').update(text).digest('hex');
const supported = ['clean-ai-slop/mixed-assertions', 'clean-ai-slop/css-and-prompt-assertions'];

async function main() {
  const [caseId, provider, model, authFile, ...extra] = process.argv.slice(2);
  const checkOnly = provider === '--check' && model === undefined;
  if (!supported.includes(caseId) || extra.length || (!checkOnly && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(provider ?? '') || !model || model.startsWith('-')))) {
    throw new Error('Usage: bun evals/runner/evaluate.mjs <clean-ai-slop/mixed-assertions|clean-ai-slop/css-and-prompt-assertions> <provider> <model> [auth-file], or <case> --check');
  }
  const caseRoot = join(evalRoot, 'cases', caseId);
  const manifest = JSON.parse(await readRegular(join(caseRoot, 'case.json')));
  if (!['config-loader', 'assistant-widget'].includes(manifest.fixture) || manifest.skill !== 'clean-ai-slop') throw new Error('Unsupported case manifest');
  const files = await readTree(join(evalRoot, 'fixtures', manifest.fixture));
  const task = await readRegular(join(caseRoot, 'task.md'));
  const oracle = await readTree(join(caseRoot, 'oracle'));
  const variants = JSON.parse(oracle['variants.json']);
  createPlan(files, variants, JSON.parse(oracle['reference.json']), manifest.test_command);
  checkScope([], manifest.allowed_changes);
  const skills = Object.create(null);
  for (const skill of ['clean-ai-slop', 'test-filesystem-safety']) {
    for (const [path, text] of Object.entries(await readTree(join(evalRoot, '..', 'skills', skill)))) skills[`${skill}/${path}`] = text;
  }
  if (checkOnly) {
    console.log(`${caseId}: 2 agent conditions, ${2 * (variants.length + 1)} independent acceptance runs; no code executed or model called.`);
    return;
  }
  const auth = await readAuth(provider, authFile);
  const directory = join(evalRoot, 'runs', `comparison-${new Date().toISOString().replaceAll(':', '-')}-${randomUUID()}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const inputs = JSON.stringify({ manifest, task, files, oracle, skills, harness: await readTree(join(evalRoot, 'runner')) });
  await writeFile(join(directory, 'inputs.json'), inputs + '\n');
  const report = {
    case: caseId, provider, model, thinking: 'high', budgetSeconds: 600, sourceHash: hash(inputs),
    startedAt: new Date().toISOString(), status: 'running', conditions: [],
  };
  const save = () => writeFile(join(directory, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  const abort = new AbortController();
  const interrupt = () => abort.abort();
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', interrupt);
  console.log(`Results: ${directory}`);
  try {
    Object.assign(report, await buildImage(directory, abort.signal));
    for (const condition of ['without-skill', 'with-skill']) {
      if (abort.signal.aborted) throw new Error('Interrupted');
      const conditionRoot = join(directory, condition);
      await mkdir(conditionRoot);
      const supplied = condition === 'with-skill' ? skills : {};
      const result = {
        condition, status: 'running', skillHashes: Object.fromEntries(Object.entries(supplied).map(([path, text]) => [path, hash(text)])),
        jobs: [], manualReview: { cleanupQuality: 'pending', behavioralCoverage: 'pending', assertionRelevance: 'pending', safetyAttempts: 'pending', safetyEffects: 'pending' },
      };
      report.conditions.push(result);
      await save();
      console.log(`Running ${condition} (${report.budgetSeconds}s budget)...`);
      const started = Date.now();
      const execution = await runPiContainer(report.image, {
        provider, model, auth, task, files, skills: supplied, thinking: report.thinking, budgetSeconds: report.budgetSeconds,
      }, { signal: abort.signal });
      result.agentElapsedMs = Date.now() - started;
      result.cleanupFailed = execution.cleanupFailed ?? false;
      if (execution.cleanupFailed) throw new Error(execution.problem);
      let output;
      try { output = parseAgentOutput({ ...execution, stdout: redact(execution.stdout, auth) }); }
      catch (error) {
        result.status = 'invalid-run';
        result.error = error.message;
        await save();
        continue;
      }
      await writeFile(join(conditionRoot, 'agent.json'), JSON.stringify(output, null, 2) + '\n');
      await writeFile(join(conditionRoot, 'trace.jsonl'), output.events.map((event) => JSON.stringify(event)).join('\n') + '\n');
      result.agent = assessAgent(output, { provider, model });
      result.runtime = output.runtime;
      if (!result.agent.ok) {
        result.status = 'invalid-run';
        await save();
        continue;
      }
      const changes = changesBetween(files, output.files);
      await writeFile(join(conditionRoot, 'changes.json'), JSON.stringify(changes, null, 2) + '\n');
      result.scope = checkScope(changes, manifest.allowed_changes);
      // Refuse to mutate changed product code, rather than misattributing an
      // anchor mismatch to test quality. Scope failure is already decisive.
      if (!result.scope.ok) {
        result.status = 'failed';
        await save();
        continue;
      }
      const jobs = createSubmissionPlan(output.files, variants, manifest.test_command);
      for (const job of jobs) {
        if (abort.signal.aborted) throw new Error('Interrupted');
        const run = await runInContainer(report.image, { files: job.files, command: manifest.test_command }, { signal: abort.signal });
        await writeFile(join(conditionRoot, `${job.id}.jsonl`), run.stdout);
        await writeFile(join(conditionRoot, `${job.id}.stderr.log`), run.stderr);
        const verdict = assess(job, run);
        result.jobs.push({ id: job.id, kind: job.kind ?? 'baseline', expected: job.expected, ...verdict });
        await save();
        console.log(`${condition} ${job.id}: ${verdict.ok ? 'OK' : 'FAIL'} ${verdict.reason ?? verdict.outcome}`);
        if (run.cleanupFailed) throw new Error(run.problem);
      }
      result.baseline = result.jobs[0].ok;
      result.regressions = { assertionsObserved: result.jobs.filter((job) => job.kind === 'regression' && job.ok).length, total: variants.filter((variant) => variant.kind === 'regression').length, relevance: 'pending-review' };
      result.refactors = { accepted: result.jobs.filter((job) => job.kind === 'refactor' && job.ok).length, total: variants.filter((variant) => variant.kind === 'refactor').length };
      result.status = result.jobs.every((job) => job.ok) ? 'needs-review' : 'failed';
      await save();
    }
    report.status = report.conditions.some((result) => result.status === 'invalid-run') ? 'error'
      : report.conditions.every((result) => result.status === 'needs-review') ? 'needs-review' : 'failed';
  } catch (error) {
    report.status = 'error';
    report.error = redact(error.message, auth);
    console.error(report.error);
  } finally {
    report.finishedAt = new Date().toISOString();
    await save();
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
  }
  console.log(`Comparison: ${report.status}. Manual criteria are not automatically scored.`);
  if (report.status !== 'needs-review') process.exitCode = 1;
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
