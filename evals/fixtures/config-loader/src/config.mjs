import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function parseConfig(text) {
  const input = JSON.parse(text);
  const retries = input.retries ?? 3;
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) {
    throw new Error('E_RETRY_RANGE');
  }
  return { endpoint: input.endpoint, retries };
}

export async function loadConfig() {
  const file = join(homedir(), '.config', 'dispatch', 'config.json');
  return parseConfig(await readFile(file, 'utf8'));
}
