import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export function selectAuth(text, provider) {
  let auth;
  try { auth = JSON.parse(text); } catch { throw new Error('Cannot parse authentication file'); }
  if (!auth || !Object.hasOwn(auth, provider)) throw new Error('No stored authentication for selected provider');
  const credential = auth[provider];
  const oauth = credential?.type === 'oauth' && typeof credential.access === 'string'
    && typeof credential.refresh === 'string' && Number.isFinite(credential.expires);
  const apiKey = credential?.type === 'api_key' && typeof credential.key === 'string'
    && credential.key.length > 0 && !credential.key.startsWith('!') && !credential.key.includes('$');
  if (!oauth && !apiKey) throw new Error('Requires stored OAuth or a literal API key');
  return { [provider]: credential };
}

export async function readAuth(provider, authFile) {
  const path = authFile ?? join(process.env.PI_CODING_AGENT_DIR ?? join(homedir(), '.pi/agent'), 'auth.json');
  let text;
  try { text = await readFile(path, 'utf8'); } catch { throw new Error('Cannot read authentication file'); }
  return selectAuth(text, provider);
}

export function redact(text, ...authStates) {
  const secrets = authStates.flatMap((auth) => Object.values(auth).flatMap((credential) =>
    Object.entries(credential).filter(([key, value]) => key !== 'type' && typeof value === 'string' && value.length > 0).map(([, value]) => value)));
  for (const secret of [...new Set(secrets)].sort((a, b) => b.length - a.length)) {
    const candidates = [secret, JSON.stringify(secret).slice(1, -1)];
    try { candidates.push(encodeURIComponent(secret)); } catch { /* Lone surrogates have no URI encoding. */ }
    const forms = [...new Set(candidates)].sort((a, b) => b.length - a.length);
    for (const form of forms) {
      text = text.replaceAll(form, '[REDACTED]');
    }
  }
  return text;
}
