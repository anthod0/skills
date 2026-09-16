import assert from 'node:assert/strict';
import test from 'node:test';
import { appendTurn } from '../src/conversation.mjs';

const turn = (number) => ({ question: `Question ${number}`, answer: `Answer ${number}`, citations: [] });

test('starts history with a complete question and answer', () => {
  assert.deepEqual(appendTurn([], turn(1), 3), [turn(1)]);
});

test('retains all turns when the budget is not exhausted', () => {
  assert.deepEqual(appendTurn([turn(1)], turn(2), 3), [turn(1), turn(2)]);
});

test('evicts the oldest complete turn without changing the previous history', () => {
  const history = [turn(1), turn(2)];
  assert.deepEqual(appendTurn(history, turn(3), 2), [turn(2), turn(3)]);
  assert.deepEqual(history, [turn(1), turn(2)]);
});

test('supports a single retained turn', () => {
  assert.deepEqual(appendTurn([turn(1)], turn(2), 1), [turn(2)]);
});
