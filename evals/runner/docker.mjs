import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';

export function docker(args, { input = '', timeoutMs = 30_000, signal } = {}) {
  if (signal?.aborted) return Promise.resolve({ code: null, stdout: '', stderr: '', problem: 'Interrupted' });
  return new Promise((resolve) => {
    const child = spawn('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let size = 0;
    let problem;
    const stop = (reason) => {
      problem ??= reason;
      child.kill('SIGKILL');
    };
    const abort = () => stop('Interrupted');
    const timer = setTimeout(() => stop(`Timed out after ${timeoutMs}ms`), timeoutMs);
    signal?.addEventListener('abort', abort, { once: true });
    const collect = (stream) => (chunk) => {
      size += Buffer.byteLength(chunk);
      if (size > 4 * 1024 * 1024) return stop('Output exceeded 4 MiB');
      if (stream === 'stdout') stdout += chunk;
      else stderr += chunk;
    };
    child.stdout.setEncoding('utf8').on('data', collect('stdout'));
    child.stderr.setEncoding('utf8').on('data', collect('stderr'));
    child.on('error', (error) => { problem = error.message; });
    child.stdin.on('error', (error) => { if (error.code !== 'EPIPE') stop(error.message); });
    child.on('close', (code) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      resolve({ code, stdout, stderr, problem });
    });
    child.stdin.end(input);
  });
}

export async function runInContainer(image, { files, command }, { signal, invoke = docker } = {}) {
  const name = `skill-calibration-${randomUUID()}`;
  let execution;
  try {
    execution = await invoke([
      'run', '--name', name, '--rm', '--interactive', '--init', '--pull=never',
      '--network=none', '--read-only', '--user=1000:1000', '--cap-drop=ALL',
      '--security-opt=no-new-privileges', '--pids-limit=64', '--memory=256m', '--cpus=1',
      '--tmpfs=/workspace:rw,nosuid,nodev,noexec,uid=1000,gid=1000,mode=0700,size=16m',
      '--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=64m', image,
    ], { input: JSON.stringify({ files, command }), signal });
  } finally {
    const cleanup = await invoke(['rm', '--force', name], { timeoutMs: 10_000 });
    if (cleanup.problem || (cleanup.code !== 0 && !cleanup.stderr.includes('No such container'))) {
      execution ??= { code: null, stdout: '', stderr: '' };
      execution.cleanupFailed = true;
      execution.problem = [execution.problem, `Container cleanup failed (${name}): ${cleanup.problem ?? cleanup.stderr}`].filter(Boolean).join('; ');
    }
  }
  return execution;
}
