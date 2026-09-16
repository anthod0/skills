export function selectAuth(text, provider) {
  let auth;
  try { auth = JSON.parse(text); } catch { throw new Error('Cannot parse authentication file'); }
  if (!auth || !Object.hasOwn(auth, provider)) throw new Error('No stored authentication for selected provider');
  const credential = auth[provider];
  const oauth = credential?.type === 'oauth' && typeof credential.access === 'string'
    && typeof credential.refresh === 'string' && Number.isFinite(credential.expires);
  const apiKey = credential?.type === 'api_key' && typeof credential.key === 'string'
    && credential.key.length > 0 && !credential.key.startsWith('!') && !credential.key.includes('$');
  if (!oauth && !apiKey) throw new Error('Smoke check requires stored OAuth or a literal API key');
  return { [provider]: credential };
}

export function assessPiSmoke(execution, { provider, model }) {
  const fail = (reason) => ({ ok: false, reason });
  if (execution.problem) return fail(execution.problem);
  if (execution.code !== 0) return fail(`Pi container exited with code ${execution.code}; raw output withheld`);
  let events;
  try { events = execution.stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line)); }
  catch { return fail('Malformed Pi event stream'); }
  if (events.some((event) => !event || typeof event !== 'object')) return fail('Malformed Pi event');
  const runtimes = events.filter((event) => event.type === 'pi_smoke_runtime');
  const runtime = runtimes[0];
  if (runtimes.length !== 1 || runtime.uid !== 1000 || runtime.cwd !== '/workspace'
      || runtime.provider !== provider || runtime.authMode !== 0o600
      || !/^\d+\.\d+\.\d+$/.test(runtime.piVersion) || !/^v\d+\.\d+\.\d+$/.test(runtime.nodeVersion)) {
    return fail('Container runtime or credential setup was not verified');
  }
  const messages = events.filter((event) => event.type === 'message_end' && event.message?.role === 'assistant').map((event) => event.message);
  if (!messages.length || messages.some((message) => message.provider !== provider || message.model !== model
      || !['stop', 'toolUse'].includes(message.stopReason))) return fail('Model mismatch or incomplete model response');
  if (!events.some((event) => event.type === 'agent_end')) return fail('Agent did not finish');
  const last = messages.at(-1);
  if (last.stopReason !== 'stop' || !Array.isArray(last.content)
      || last.content.filter((part) => part?.type === 'text').map((part) => part.text).join('').trim() !== 'PI_SMOKE_OK') {
    return fail('Missing final smoke acknowledgement');
  }
  const tools = events.filter((event) => event.type === 'tool_execution_end');
  if (tools.some((event) => event.isError !== false)
      || !['read', 'write', 'edit', 'bash'].every((name) => tools.some((event) => event.toolName === name))) {
    return fail('All four built-in tools must complete successfully');
  }
  const workspace = events.filter((event) => event.type === 'pi_smoke_workspace');
  if (workspace.length !== 1 || workspace[0].ok !== true) return fail('Workspace file did not contain the expected edit');
  // Persist only allowlisted metadata, never raw model/tool output or credentials.
  return {
    ok: true, piVersion: runtime.piVersion, nodeVersion: runtime.nodeVersion,
    uid: runtime.uid, cwd: runtime.cwd, authMode: runtime.authMode,
    tools: ['read', 'write', 'edit', 'bash'], assistantMessages: messages.length,
  };
}
