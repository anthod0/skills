import { readFile, writeFile, stat } from 'node:fs/promises';
import { spawnSync, spawn } from 'node:child_process';
import { once } from 'node:events';

async function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) {
    input += chunk;
    if (Buffer.byteLength(input) > 128 * 1024) throw new Error('Payload too large');
  }
  const { provider, model, auth } = JSON.parse(input);
  if (typeof provider !== 'string' || typeof model !== 'string'
      || !auth || Object.keys(auth).length !== 1 || !Object.hasOwn(auth, provider)) {
    throw new Error('Invalid input');
  }
  await writeFile('/run/pi-agent/auth.json', JSON.stringify(auth), { mode: 0o600, flag: 'wx' });
  await writeFile('/run/pi-agent/settings.json', JSON.stringify({
    compaction: { enabled: false }, retry: { enabled: false, provider: { maxRetries: 0, timeoutMs: 60_000 } },
  }), { mode: 0o600, flag: 'wx' });
  const version = spawnSync('pi', ['--version'], { encoding: 'utf8' });
  if (version.status !== 0) throw new Error('Pi version check failed');
  console.log(JSON.stringify({
    type: 'pi_smoke_runtime', piVersion: version.stdout.trim(), nodeVersion: process.version,
    uid: process.getuid(), cwd: process.cwd(), provider,
    authMode: (await stat('/run/pi-agent/auth.json')).mode & 0o777,
  }));

  const prompt = `Perform only this container smoke check. Do not inspect credentials, configuration, or environment variables.
1. Use the write tool to create /workspace/probe.txt containing exactly BEFORE followed by a newline.
2. Use the edit tool to replace BEFORE with AFTER in that file.
3. Use the read tool to verify the updated file.
4. Use the bash tool to run: test "$(pwd)" = /workspace && test "$(id -u)" -ne 0 && test "$(cat /workspace/probe.txt)" = AFTER && printf 'PI_CONTAINER_TOOLS_OK\\n'
Do not modify any other files. Finish with exactly PI_SMOKE_OK.`;
  const child = spawn('pi', [
    '--mode', 'json', '--print', '--no-session', '--offline', '--no-approve',
    '--no-extensions', '--no-skills', '--no-prompt-templates', '--no-themes', '--no-context-files',
    '--tools', 'read,write,edit,bash', '--provider', provider, '--model', model, '--thinking', 'low',
    '--', prompt,
  ], { stdio: ['ignore', 'inherit', 'inherit'] });
  const [code] = await once(child, 'exit');
  let workspaceOk = false;
  try { workspaceOk = (await readFile('/workspace/probe.txt', 'utf8')) === 'AFTER\n'; } catch {}
  console.log(JSON.stringify({ type: 'pi_smoke_workspace', ok: workspaceOk }));
  process.exitCode = code ?? 2;
}

main().catch(() => {
  // Never dump payloads or credential-related exception messages.
  console.error('Pi container bootstrap failed');
  process.exitCode = 2;
});
