import assert from 'node:assert/strict';
import test from 'node:test';
import { parseResponse } from '../src/response.mjs';

test('reads an answer with its source links', () => {
  assert.deepEqual(parseResponse({
    answer: 'See the return policy',
    citations: [{ title: 'Returns', url: 'https://HELP.example.test/returns' }],
  }), {
    answer: 'See the return policy',
    citations: [{ title: 'Returns', url: 'https://help.example.test/returns' }],
  });
});

test('accepts answers without citations', () => {
  for (const citations of [undefined, null, []]) {
    assert.deepEqual(parseResponse({ answer: 'Hello', citations }), { answer: 'Hello', citations: [] });
  }
});

test('rejects absent and empty answers', () => {
  for (const response of [null, {}, { answer: '' }, { answer: ' \n ' }, { answer: 42 }]) {
    assert.throws(() => parseResponse(response), TypeError);
  }
});

test('discards unusable or executable links without losing valid sources', () => {
  const result = parseResponse({
    answer: 'Sources',
    citations: [
      { title: 'Script', url: 'javascript:alert(1)' },
      { title: 'Inline', url: 'data:text/html,hello' },
      { title: 'Relative', url: '/guide' },
      { title: 'HTTPS', url: 'https://help.example.test/guide' },
      { title: 'HTTP', url: 'http://legacy.example.test/guide' },
    ],
  });
  assert.deepEqual(result.citations, [
    { title: 'HTTPS', url: 'https://help.example.test/guide' },
    { title: 'HTTP', url: 'http://legacy.example.test/guide' },
  ]);
});

test('rejects malformed citation records', () => {
  for (const citations of [{}, [null], [{ title: 'Missing URL' }], [{ title: 7, url: 'https://help.example.test/' }]]) {
    assert.throws(() => parseResponse({ answer: 'Hello', citations }), TypeError);
  }
});

test('preserves answer formatting', () => {
  const answer = '  First step\n\nSecond step: café  ';
  assert.equal(parseResponse({ answer }).answer, answer);
});
