import { checkPath, checkFiles } from "./files.mjs";

export function changesBetween(original, submitted) {
  checkFiles(original);
  checkFiles(submitted);
  return [...new Set([...Object.keys(original), ...Object.keys(submitted)])]
    .sort()
    .flatMap((path) => {
      const before = Object.hasOwn(original, path) ? original[path] : null;
      const after = Object.hasOwn(submitted, path) ? submitted[path] : null;
      return before === after ? [] : [{ path, before, after }];
    });
}

export function checkScope(changes, allowed) {
  if (!Array.isArray(allowed) || !allowed.length) throw new Error("Missing allowed_changes");
  for (const pattern of allowed)
    checkPath(pattern.endsWith("/**") ? pattern.slice(0, -3) : pattern);
  const violations = changes
    .filter(
      ({ path }) =>
        !allowed.some((pattern) =>
          pattern.endsWith("/**") ? path.startsWith(pattern.slice(0, -2)) : path === pattern,
        ),
    )
    .map(({ path }) => path);
  return { ok: violations.length === 0, violations };
}
