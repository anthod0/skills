export function appendTurn(turns, turn, maxTurns) {
  return [...turns, turn].slice(-maxTurns);
}
