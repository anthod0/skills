import assert from 'node:assert/strict';
import test from 'node:test';
import { parseConfig } from '../src/config.mjs';

const endpoint = 'https://dispatch.example.test';

test('loads an explicit retry configuration', () => {
  const config = parseConfig(JSON.stringify({ endpoint, retries: 2 }));
  assert.deepEqual(config, { endpoint, retries: 2 });
  assert.deepEqual(Object.keys(config), ['endpoint', 'retries']);
});

test('uses the default when retries are omitted', () => {
  assert.equal(parseConfig(JSON.stringify({ endpoint })).retries, 3);
});

test('uses the default for null retries', () => {
  assert.equal(parseConfig(JSON.stringify({ endpoint, retries: null })).retries, 3);
});

test('accepts disabling retries', () => {
  assert.equal(parseConfig(JSON.stringify({ endpoint, retries: 0 })).retries, 0);
});

test('accepts the maximum retry budget', () => {
  assert.doesNotThrow(() => {
    assert.equal(parseConfig(JSON.stringify({ endpoint, retries: 5 })).retries, 5);
  });
});

test('rejects unsupported retry budgets', () => {
  for (const retries of [-1, 6, 1.5, '2']) {
    assert.throws(
      () => parseConfig(JSON.stringify({ endpoint, retries })),
      { message: 'E_RETRY_RANGE' },
    );
  }
});

test('rejects malformed configuration', () => {
  assert.throws(() => parseConfig('{'), SyntaxError);
});

test('configuration test harness is ready', () => {
  assert.equal(true, true);
});

test('does not expose a retry wizard', () => {
  const config = parseConfig(JSON.stringify({ endpoint }));
  assert.equal(config.retryWizard, undefined);
});
