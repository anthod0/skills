export function checkPath(path) {
  if (
    typeof path !== "string" ||
    !/^[\w.+/-]+$/.test(path) ||
    path.split("/").some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe relative path: ${path}`);
  }
}

export function applyEdits(files, edits) {
  if (!Array.isArray(edits) || edits.length === 0) throw new Error("Expected nonempty edits");
  const grouped = new Map();
  for (const edit of edits) {
    checkPath(edit.file);
    if (
      !Object.hasOwn(files, edit.file) ||
      typeof edit.before !== "string" ||
      !edit.before ||
      typeof edit.after !== "string"
    )
      throw new Error("Invalid edit");
    const source = files[edit.file];
    const start = source.indexOf(edit.before);
    if (start < 0 || source.indexOf(edit.before, start + 1) !== -1) {
      throw new Error(`Edit must match exactly once: ${edit.file}`);
    }
    const ranges = grouped.get(edit.file) ?? [];
    ranges.push({ start, end: start + edit.before.length, after: edit.after });
    grouped.set(edit.file, ranges);
  }
  const result = { ...files };
  for (const [file, ranges] of grouped) {
    ranges.sort((a, b) => a.start - b.start);
    for (let i = 1; i < ranges.length; i++) {
      if (ranges[i].start < ranges[i - 1].end) throw new Error(`Overlapping edits: ${file}`);
    }
    for (const range of ranges.reverse()) {
      result[file] =
        result[file].slice(0, range.start) + range.after + result[file].slice(range.end);
    }
  }
  return result;
}

export function checkCommand(command, files) {
  if (JSON.stringify(command) === JSON.stringify(["bun", "run", "test"])) {
    const manifest = JSON.parse(files["package.json"] ?? "null");
    const scripts = {
      "ssh-hosts": "node --import tsx --test tests/*.test.ts",
      replydesk: "svelte-kit sync && vitest run",
    };
    if (
      !manifest ||
      !Object.hasOwn(scripts, manifest.name) ||
      manifest.scripts?.test !== scripts[manifest.name] ||
      !files["bun.lock"]
    ) {
      throw new Error("Unsupported fixture test script or missing lockfile");
    }
    return;
  }
  if (!Array.isArray(command) || command[0] !== "node" || command[1] !== "--test") {
    throw new Error("Unsupported test command");
  }
  for (const argument of command.slice(2)) {
    checkPath(argument);
    if (!argument.startsWith("tests/") || !Object.hasOwn(files, argument)) {
      throw new Error("Test arguments must name fixture test files");
    }
  }
}

export function createPlan(files, variants, reference, command) {
  for (const [path, content] of Object.entries(files)) {
    checkPath(path);
    if (typeof content !== "string") throw new Error(`Not a text file: ${path}`);
  }
  checkCommand(command, files);
  if (!Array.isArray(reference) || reference.some((edit) => !edit.file?.startsWith("tests/"))) {
    throw new Error("Reference cleanup must only edit tests/");
  }
  const cleaned = applyEdits(files, reference);
  if (!Array.isArray(variants) || variants.length === 0) throw new Error("No hidden variants");
  const ids = new Set();
  for (const variant of variants) {
    if (
      typeof variant.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(variant.id) ||
      ids.has(variant.id) ||
      !["regression", "refactor"].includes(variant.kind) ||
      !variant.file?.startsWith("src/") ||
      !Array.isArray(variant.detects) ||
      !variant.detects.length ||
      variant.detects.some((name) => typeof name !== "string" || !name)
    ) {
      throw new Error(`Invalid variant: ${variant.id}`);
    }
    ids.add(variant.id);
  }
  const jobs = [];
  for (const [version, sources] of [
    ["original", files],
    ["reference", cleaned],
  ]) {
    jobs.push({
      id: `${version}--baseline`,
      version,
      expected: "pass",
      detects: [],
      files: { ...sources },
    });
    for (const variant of variants) {
      const expected =
        version === "reference" && variant.kind === "refactor" ? "pass" : "assertion-failure";
      jobs.push({
        id: `${version}--${variant.id}`,
        version,
        variant: variant.id,
        kind: variant.kind,
        expected,
        detects: expected === "pass" ? [] : variant.detects,
        files: applyEdits(sources, [variant]),
      });
    }
  }
  return jobs;
}
