import { appendTurn } from './conversation.mjs';
import { buildMessages } from './prompt.mjs';
import { parseResponse } from './response.mjs';

export function createAssistant({ client, maxTurns = 3 }) {
  if (!Number.isInteger(maxTurns) || maxTurns < 1) {
    throw new RangeError('Conversation size must be a positive integer');
  }

  let state = { status: 'idle', error: null, turns: [] };

  return {
    getState() {
      return structuredClone(state);
    },

    async send(question) {
      if (state.status === 'sending') return false;
      if (typeof question !== 'string' || !question.trim()) return false;

      state = { ...state, status: 'sending', error: null };
      try {
        const messages = buildMessages(question, state.turns);
        const response = parseResponse(await client({ messages }));
        const turn = { question, ...response };
        state = {
          status: 'idle',
          error: null,
          turns: appendTurn(state.turns, turn, maxTurns),
        };
        return true;
      } catch {
        state = { ...state, status: 'error', error: 'Could not send your question. Please try again.' };
        return false;
      }
    },
  };
}
