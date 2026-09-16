export function buildMessages(question, turns = []) {
  return [
    {
      role: 'system',
      content: 'You are a helpful support assistant. Answer clearly and briefly.',
    },
    ...turns.flatMap((turn) => [
      { role: 'user', content: turn.question },
      { role: 'assistant', content: turn.answer },
    ]),
    { role: 'user', content: question },
  ];
}
