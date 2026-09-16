import assert from 'node:assert/strict';
import test from 'node:test';
import { createAssistant } from '../src/assistant.mjs';
import { renderWidget } from '../src/widget.mjs';

test('starts with an empty conversation', () => {
  const assistant = createAssistant({ client: async () => ({ answer: 'Hello' }) });
  assert.deepEqual(assistant.getState(), { status: 'idle', error: null, turns: [] });
});

test('submits a question and displays the answer', async () => {
  let request;
  const assistant = createAssistant({ client: async (input) => {
    request = input;
    return { answer: 'Your order ships tomorrow.' };
  } });

  assert.equal(await assistant.send('Where is my order?'), true);
  assert.deepEqual(assistant.getState(), {
    status: 'idle', error: null,
    turns: [{ question: 'Where is my order?', answer: 'Your order ships tomorrow.', citations: [] }],
  });
  assert.match(renderWidget(assistant.getState()), /Your order ships tomorrow\./);
  assert.equal(request.messages[0].content, 'You are a helpful support assistant. Answer clearly and briefly.');
});

test('does not submit empty questions', async () => {
  let calls = 0;
  const assistant = createAssistant({ client: async () => {
    calls += 1;
    return { answer: 'Hello' };
  } });
  for (const question of ['', ' \n\t ', null, 42]) {
    assert.equal(await assistant.send(question), false);
  }
  assert.equal(calls, 0);
  assert.deepEqual(assistant.getState(), { status: 'idle', error: null, turns: [] });
});

test('blocks duplicate submissions while a request is pending', async () => {
  const { promise, resolve } = Promise.withResolvers();
  let calls = 0;
  const assistant = createAssistant({ client: () => {
    calls += 1;
    return promise;
  } });
  const first = assistant.send('First question');
  const second = assistant.send('Second question');
  try {
    assert.equal(assistant.getState().status, 'sending');
    assert.equal(calls, 1);
  } finally {
    resolve({ answer: 'First answer' });
    await Promise.all([first, second]);
  }
  assert.equal(await second, false);
  assert.equal(await first, true);
  assert.deepEqual(assistant.getState().turns.map((turn) => turn.question), ['First question']);
});

test('can retry after a transport failure', async () => {
  let attempts = 0;
  const assistant = createAssistant({ client: async () => {
    attempts += 1;
    if (attempts === 1) throw new Error('Gateway unavailable');
    return { answer: 'Recovered' };
  } });
  assert.equal(await assistant.send('Help'), false);
  assert.equal(assistant.getState().status, 'error');
  assert.deepEqual(assistant.getState().turns, []);
  assert.match(renderWidget(assistant.getState(), 'Help'), /role="alert"/);
  assert.equal(assistant.getState().error, 'Could not send your question. Please try again.');

  const retry = assistant.send('Help');
  assert.equal(assistant.getState().status, 'sending');
  assert.equal(assistant.getState().error, null);
  assert.equal(await retry, true);
  assert.equal(assistant.getState().error, null);
  assert.equal(assistant.getState().status, 'idle');
  assert.equal(assistant.getState().turns[0].answer, 'Recovered');
  assert.doesNotMatch(renderWidget(assistant.getState()), /role="alert"/);
});

test('does not add invalid responses to an existing conversation', async () => {
  let calls = 0;
  const assistant = createAssistant({ client: async () => {
    calls += 1;
    return calls === 1 ? { answer: 'Existing answer' } : { answer: '  ' };
  } });
  await assistant.send('First question');
  const turns = assistant.getState().turns;
  assert.equal(await assistant.send('Second question'), false);
  assert.equal(assistant.getState().status, 'error');
  assert.deepEqual(assistant.getState().turns, turns);
});

test('sends only retained history in chronological order', async () => {
  const requests = [];
  const assistant = createAssistant({ maxTurns: 2, client: async (request) => {
    requests.push(request);
    return { answer: `Answer ${requests.length}` };
  } });
  for (const question of ['One', 'Two', 'Three', 'Four']) await assistant.send(question);
  assert.deepEqual(requests[3].messages.slice(1), [
    { role: 'user', content: 'Two' }, { role: 'assistant', content: 'Answer 2' },
    { role: 'user', content: 'Three' }, { role: 'assistant', content: 'Answer 3' },
    { role: 'user', content: 'Four' },
  ]);
  assert.deepEqual(assistant.getState().turns.map((turn) => turn.question), ['Three', 'Four']);
});

test('returned state cannot change later submissions or citations', async () => {
  const requests = [];
  const assistant = createAssistant({ client: async (request) => {
    requests.push(request);
    return { answer: 'See the guide', citations: [{ title: 'Guide', url: 'https://help.example.test/guide' }] };
  } });
  await assistant.send('Original question');
  const snapshot = assistant.getState();
  snapshot.turns[0].question = 'Changed';
  snapshot.turns[0].citations[0].url = 'https://other.example.test/';
  snapshot.turns.push({ question: 'Injected', answer: 'Injected', citations: [] });
  snapshot.status = 'sending';
  assert.equal(assistant.getState().turns[0].citations[0].url, 'https://help.example.test/guide');
  assert.equal(await assistant.send('Follow-up'), true);
  assert.equal(requests[1].messages[1].content, 'Original question');
  assert.equal(requests[1].messages.length, 4);
});

test('rejects invalid conversation limits', () => {
  for (const maxTurns of [0, -1, 1.5, '2']) {
    assert.throws(() => createAssistant({ client: async () => ({}), maxTurns }), RangeError);
  }
});
