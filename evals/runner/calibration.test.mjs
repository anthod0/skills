import assert from 'node:assert/strict';
import test from 'node:test';
import { applyEdits, createPlan } from './plan.mjs';
import { assess } from './result.mjs';
import reporter from './reporter.mjs';
import { runInContainer } from './docker.mjs';

const files = { 'src/example.mjs': 'const answer = 1;', 'tests/example.test.mjs': 'behavior\ncopy\n' };
const reference = [{ file: 'tests/example.test.mjs', before: 'copy\n', after: '' }];
const variants = [
  { id: 'wrong-answer', kind: 'regression', file: 'src/example.mjs', before: '1', after: '2', detects: ['behavior'] },
  { id: 'renamed-local', kind: 'refactor', file: 'src/example.mjs', before: 'answer', after: 'value', detects: ['copy'] },
];

test('builds independent original and reference matrices without mutating input', () => {
  const jobs = createPlan(files, variants, reference, ['node', '--test']);
  assert.deepEqual(jobs.map((job) => [job.id, job.expected]), [
    ['original--baseline', 'pass'], ['original--wrong-answer', 'assertion-failure'],
    ['original--renamed-local', 'assertion-failure'], ['reference--baseline', 'pass'],
    ['reference--wrong-answer', 'assertion-failure'], ['reference--renamed-local', 'pass'],
  ]);
  assert.equal(jobs[1].files['src/example.mjs'], 'const answer = 2;');
  assert.equal(jobs[2].files['src/example.mjs'], 'const value = 1;');
  assert.equal(jobs[4].files['tests/example.test.mjs'], 'behavior\n');
  assert.equal(files['tests/example.test.mjs'], 'behavior\ncopy\n');
  assert.equal(files['src/example.mjs'], 'const answer = 1;');
});

test('edits match original offsets and reject missing, ambiguous, or overlapping anchors', () => {
  const source = { 'tests/a.mjs': 'first middle last' };
  assert.equal(applyEdits(source, [
    { file: 'tests/a.mjs', before: 'last', after: 'end' },
    { file: 'tests/a.mjs', before: 'first', after: '' },
  ])['tests/a.mjs'], ' middle end');
  for (const before of ['', 'absent', 'i']) {
    assert.throws(() => applyEdits(source, [{ file: 'tests/a.mjs', before, after: '' }]));
  }
  assert.throws(() => applyEdits(source, [
    { file: 'tests/a.mjs', before: 'first middle', after: '' },
    { file: 'tests/a.mjs', before: 'middle last', after: '' },
  ]), /Overlapping/);
});

test('refuses path escapes, production cleanup, test mutants, and arbitrary Node flags', () => {
  for (const file of ['/tmp/a', '../a', 'tests/../../a', 'tests\\a', 'tests//a']) {
    assert.throws(() => applyEdits(files, [{ file, before: 'copy', after: '' }]), /Unsafe/);
  }
  assert.throws(() => createPlan(files, variants, [{ file: 'src/example.mjs', before: '1', after: '2' }], ['node', '--test']), /only edit tests/);
  assert.throws(() => createPlan(files, [{ ...variants[0], file: 'tests/example.test.mjs' }], reference, ['node', '--test']), /Invalid variant/);
  assert.throws(() => createPlan(files, variants, reference, ['node', '--test', '--import=malicious']), /Unsafe|Test arguments/);
  assert.throws(() => createPlan(files, [...variants, variants[0]], reference, ['node', '--test']), /Invalid variant/);
});

test('container runs use isolation and remove only their own container after timeout', async () => {
  const calls = [];
  const abort = new AbortController();
  const result = await runInContainer('sha256:test', { files, command: ['node', '--test'] }, {
    signal: abort.signal,
    invoke: async (args, options) => {
      calls.push({ args, options });
      return args[0] === 'run'
        ? { code: null, stdout: '', stderr: '', problem: 'Timed out' }
        : { code: 0, stdout: '', stderr: '' };
    },
  });
  const run = calls[0];
  for (const flag of ['--network=none', '--read-only', '--user=1000:1000', '--cap-drop=ALL', '--security-opt=no-new-privileges']) {
    assert.ok(run.args.includes(flag));
  }
  assert.equal(run.args.some((arg) => /^(--volume|--mount|--privileged|-v)$/.test(arg)), false);
  assert.deepEqual(JSON.parse(run.options.input), { files, command: ['node', '--test'] });
  const name = run.args[run.args.indexOf('--name') + 1];
  assert.deepEqual(calls[1].args, ['rm', '--force', name]);
  assert.equal(calls[1].options.signal, undefined);
  assert.equal(result.problem, 'Timed out');
});

test('container cleanup failure invalidates an otherwise successful execution', async () => {
  const result = await runInContainer('sha256:test', { files, command: ['node', '--test'] }, {
    invoke: async (args) => args[0] === 'run'
      ? { code: 0, stdout: 'finished', stderr: '' }
      : { code: 1, stdout: '', stderr: 'daemon unavailable' },
  });
  assert.match(result.problem, /cleanup failed/);
  assert.equal(result.cleanupFailed, true);
  assert.equal(result.stdout, 'finished');
});

test('a thrown launch error still triggers container cleanup', async () => {
  let removed = false;
  await assert.rejects(runInContainer('sha256:test', { files, command: ['node', '--test'] }, {
    invoke: async (args) => {
      if (args[0] === 'run') throw new Error('launch failed');
      removed = true;
      return { code: 0, stdout: '', stderr: '' };
    },
  }), /launch failed/);
  assert.equal(removed, true);
});

const assertionError = { code: 'ERR_TEST_FAILURE', failureType: 'testCodeFailure', cause: { code: 'ERR_ASSERTION' } };
function execution({ failure, name = 'behavior', counts = {}, code = failure ? 1 : 0 } = {}) {
  return {
    code, stderr: '', stdout: [
      { type: failure ? 'test:fail' : 'test:pass', name, subtype: 'test', error: failure },
      { type: 'test:summary', counts: { tests: 1, passed: failure ? 0 : 1, failed: failure ? 1 : 0, skipped: 0, todo: 0, cancelled: 0, ...counts } },
    ].map((event) => JSON.stringify(event)).join('\n'),
  };
}
const failureJob = { expected: 'assertion-failure', detects: ['behavior'] };

test('accepts passes and designated assertion failures, but not undetected mutations', () => {
  assert.equal(assess({ expected: 'pass', detects: [] }, execution()).ok, true);
  assert.equal(assess(failureJob, execution({ failure: assertionError })).ok, true);
  assert.equal(assess(failureJob, execution()).ok, false);
  assert.equal(assess({ expected: 'pass', detects: [] }, execution({ failure: assertionError })).ok, false);
  assert.equal(assess(failureJob, execution({ failure: assertionError, name: 'unrelated' })).ok, false);
});

test('does not credit import errors, thrown exceptions, cancellation, or timeouts', () => {
  for (const failure of [
    { code: 'ERR_TEST_FAILURE', failureType: 'testCodeFailure', cause: { code: 'ERR_MODULE_NOT_FOUND' } },
    { code: 'ERR_TEST_FAILURE', failureType: 'testCodeFailure', cause: { message: 'TypeError' } },
    { code: 'ERR_TEST_FAILURE', failureType: 'cancelledByParent' },
  ]) {
    assert.equal(assess(failureJob, execution({ failure })).outcome, 'invalid-run');
  }
  assert.equal(assess(failureJob, { ...execution(), problem: 'Timed out' }).outcome, 'invalid-run');
  assert.equal(assess(failureJob, execution({ failure: assertionError, code: 137 })).outcome, 'invalid-run');
});

test('rejects empty, incomplete, malformed, skipped, and inconsistent reports', () => {
  for (const stdout of ['', 'not json', 'null', '42', '{}', JSON.stringify({ type: 'test:pass', name: 'behavior' })]) {
    assert.equal(assess(failureJob, { code: 1, stdout }).outcome, 'invalid-run');
  }
  for (const counts of [{ tests: 0 }, { skipped: 1 }, { todo: 1 }, { cancelled: 1 }, { failed: 0 }, { tests: 2 }]) {
    assert.equal(assess(failureJob, execution({ failure: assertionError, counts })).outcome, 'invalid-run');
  }
  assert.equal(assess(failureJob, execution({ failure: assertionError, code: 0 })).outcome, 'invalid-run');
});

test('reporter preserves assertion causes and excludes per-file summaries', async () => {
  const cause = new assert.AssertionError({ message: 'wrong answer' });
  const error = Object.assign(new Error('test failed', { cause }), { code: 'ERR_TEST_FAILURE', failureType: 'testCodeFailure' });
  async function* events() {
    yield { type: 'test:fail', data: { name: 'behavior', details: { type: 'test', error } } };
    yield { type: 'test:summary', data: { file: '/workspace/tests/a.mjs', counts: { tests: 1 } } };
    yield { type: 'test:summary', data: { counts: { tests: 1, failed: 1 } } };
  }
  const output = [];
  for await (const line of reporter(events())) output.push(JSON.parse(line));
  assert.equal(output.length, 2);
  assert.equal(output[0].error.cause.code, 'ERR_ASSERTION');
  assert.equal(output[0].error.failureType, 'testCodeFailure');
  assert.equal(output[1].type, 'test:summary');
});
