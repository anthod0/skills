import { applyEdits, checkCommand, checkPath } from './plan.mjs';
import { checkFiles } from './files.mjs';

export function changesBetween(original, submitted) {
  checkFiles(original);
  checkFiles(submitted);
  return [...new Set([...Object.keys(original), ...Object.keys(submitted)])].sort().flatMap((path) => {
    const before = Object.hasOwn(original, path) ? original[path] : null;
    const after = Object.hasOwn(submitted, path) ? submitted[path] : null;
    return before === after ? [] : [{ path, before, after }];
  });
}

export function checkScope(changes, allowed) {
  if (!Array.isArray(allowed) || !allowed.length) throw new Error('Missing allowed_changes');
  for (const pattern of allowed) checkPath(pattern.endsWith('/**') ? pattern.slice(0, -3) : pattern);
  const violations = changes.filter(({ path }) => !allowed.some((pattern) =>
    pattern.endsWith('/**') ? path.startsWith(pattern.slice(0, -2)) : path === pattern)).map(({ path }) => path);
  return { ok: violations.length === 0, violations };
}

export function createSubmissionPlan(files, variants, command) {
  checkFiles(files);
  checkCommand(command, files);
  return [
    { id: 'baseline', expected: 'pass', files: { ...files } },
    ...variants.map((variant) => ({
      id: variant.id, kind: variant.kind,
      expected: variant.kind === 'regression' ? 'assertion-failure' : 'pass',
      // Agent tests may be renamed or consolidated. Assertion relevance is
      // reviewed separately, unlike designated-name calibration.
      files: applyEdits(files, [variant]),
    })),
  ];
}
