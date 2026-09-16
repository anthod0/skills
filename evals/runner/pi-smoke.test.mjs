import assert from 'node:assert/strict';
import test from 'node:test';
import { runPiContainer } from './docker.mjs';
import { selectAuth, assessPiSmoke } from './pi-smoke-result.mjs';

const selection = { provider: 'example', model: 'example-model' };
const credential = { type: 'oauth', access: 'synthetic-access', refresh: 'synthetic-refresh', expires: 123 };

test('copies only the selected stored credential without exposing invalid input in errors', () => {
  assert.deepEqual(selectAuth(JSON.stringify({ example: credential, other: { secret: 'unrelated' } }), 'example'), { example: credential });
  assert.throws(() => selectAuth('{}', 'example'), /No stored authentication/);
  assert.throws(() => selectAuth('{ synthetic-secret', 'example'), { message: 'Cannot parse authentication file' });
  for (const key of ['!read-key', '$API_KEY', '']) {
    assert.throws(() => selectAuth(JSON.stringify({ example: { type: 'api_key', key } }), 'example'), /stored OAuth or a literal/);
  }
  assert.deepEqual(selectAuth('{"example":{"type":"api_key","key":"synthetic-key"}}', 'example'), {
    example: { type: 'api_key', key: 'synthetic-key' },
  });
});

function events() {
  return [
    { type: 'pi_smoke_runtime', uid: 1000, cwd: '/workspace', authMode: 0o600, provider: 'example', piVersion: '0.85.1', nodeVersion: 'v22.19.0' },
    ...['read', 'write', 'edit', 'bash'].map((toolName) => ({ type: 'tool_execution_end', toolName, isError: false })),
    { type: 'message_end', message: { role: 'assistant', ...selection, stopReason: 'stop', content: [{ type: 'text', text: 'PI_SMOKE_OK' }, { type: 'thinking', thinking: 'synthetic-secret' }] } },
    { type: 'agent_end' },
    { type: 'pi_smoke_workspace', ok: true },
  ];
}
const execution = (records) => ({ code: 0, stdout: records.map((record) => JSON.stringify(record)).join('\n'), stderr: 'synthetic-secret' });

test('requires a real completion, all tools, expected model, and verified container state', () => {
  const result = assessPiSmoke(execution(events()), selection);
  assert.equal(result.ok, true);
  assert.equal(JSON.stringify(result).includes('synthetic-secret'), false);
  for (const mutate of [
    (records) => { records[0].uid = 0; },
    (records) => { records[0].authMode = 0o644; },
    (records) => { records[0].cwd = '/host'; },
    (records) => { records[1].isError = true; },
    (records) => { records.splice(1, 1); },
    (records) => { records[5].message.model = 'other-model'; },
    (records) => { records[5].message.stopReason = 'error'; },
    (records) => { records[5].message.content = []; },
    (records) => { records[5].message.content = {}; },
    (records) => { records.splice(6, 1); },
    (records) => { records.at(-1).ok = false; },
  ]) {
    const records = events();
    mutate(records);
    assert.equal(assessPiSmoke(execution(records), selection).ok, false);
  }
  for (const overrides of [{ code: 1 }, { problem: 'Timed out' }, { stdout: 'invalid' }, { stdout: 'null' }]) {
    assert.equal(assessPiSmoke({ ...execution(events()), ...overrides }, selection).ok, false);
  }
});

test('Pi container receives credentials only on stdin, has private config storage, and is removed', async () => {
  const calls = [];
  const payload = { ...selection, auth: { example: credential } };
  await runPiContainer('sha256:test', payload, {
    invoke: async (args, options) => {
      calls.push({ args, options });
      return { code: 0, stdout: '', stderr: '' };
    },
  });
  const { args, options } = calls[0];
  assert.deepEqual(JSON.parse(options.input), payload);
  assert.equal(args.some((arg) => arg.includes(credential.access)), false);
  assert.ok(args.includes('--network=bridge'));
  assert.ok(args.includes('--read-only'));
  assert.ok(args.includes('--user=1000:1000'));
  assert.ok(args.includes('--tmpfs=/run/pi-agent:rw,nosuid,nodev,noexec,uid=1000,gid=1000,mode=0700,size=16m'));
  assert.equal(args.some((arg) => /^(--mount|--volume|--env|--privileged|-v|-e)(=|$)/.test(arg)), false);
  assert.deepEqual(calls[1].args, ['rm', '--force', args[args.indexOf('--name') + 1]]);
});
