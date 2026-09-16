export function assess(job, execution) {
  const invalid = (reason) => ({ ok: false, outcome: 'invalid-run', reason });
  if (execution.problem) return invalid(execution.problem);
  if (![0, 1].includes(execution.code)) return invalid(`Unexpected exit: ${execution.code}`);
  let events;
  try {
    events = execution.stdout.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line));
  } catch {
    return invalid('Malformed reporter output');
  }
  if (events.some((event) => !event || typeof event !== 'object' || typeof event.type !== 'string')) {
    return invalid('Malformed reporter event');
  }
  const summaries = events.filter((event) => event.type === 'test:summary');
  if (summaries.length !== 1 || !(summaries[0].counts?.tests > 0)) return invalid('No completed test suite');
  const counts = summaries[0].counts;
  if (counts.skipped || counts.todo || counts.cancelled) return invalid('Skipped, TODO, or cancelled tests');
  const records = events.filter((event) => ['test:pass', 'test:fail'].includes(event.type));
  const tests = records.filter((event) => event.subtype !== 'suite');
  if (!tests.length || records.some((event) => event.skip || event.todo)) return invalid('Missing or skipped tests');
  const failures = tests.filter((event) => event.type === 'test:fail');
  if (failures.length !== counts.failed || tests.length !== counts.tests) return invalid('Inconsistent test report');
  const assertions = [];
  for (const event of records.filter((record) => record.type === 'test:fail')) {
    // Node propagates nested failures to test/suite parents. These are not
    // independent crashes, but cannot supply assertion evidence themselves.
    if (event.error?.failureType === 'subtestsFailed') continue;
    let error = event.error;
    if (error?.failureType !== 'testCodeFailure') return invalid('Failure was not an assertion (crash, import, cancellation, or timeout)');
    while (error && error.code !== 'ERR_ASSERTION') error = error.cause;
    if (!error) return invalid('Failure was not an assertion (crash, import, cancellation, or timeout)');
    assertions.push(event.name);
  }
  if (failures.length && !assertions.length) return invalid('No assertion evidence for propagated failures');
  const outcome = failures.length ? 'assertion-failure' : 'pass';
  if ((execution.code === 0) !== (outcome === 'pass')) return invalid('Exit status disagrees with test report');
  const failedTests = failures.map((event) => event.name);
  if (outcome !== job.expected) return { ok: false, outcome, failedTests, reason: `Expected ${job.expected}` };
  if (outcome === 'assertion-failure' && job.detects !== undefined && !job.detects.some((name) => assertions.includes(name))) {
    return { ok: false, outcome, failedTests, reason: 'No designated assertion detected this variant' };
  }
  return { ok: true, outcome, failedTests };
}
