import { createHash } from "node:crypto";
import { join } from "node:path";
import { readRegular, readTree, checkFiles } from "../runner/files.mjs";

export const caseIds = [
  "implement/axios__axios-5085",
  "write-good-test/astropy__astropy-12907",
  "write-good-test/sympy__sympy-20590",
];
export const pins = {
  swe: "02e7a74ffd0b707aab73d203fe87bdc7c76afc8e",
  swt: "330a649a764fab2fadaea632776eeae87272f74b",
};
export const hash = (text) => createHash("sha256").update(text).digest("hex");

export async function loadCase(root, id) {
  if (!caseIds.includes(id)) throw new Error("Unsupported external case");
  const directory = join(root, "cases", id);
  const manifest = JSON.parse(await readRegular(join(directory, "case.json")));
  const text = await readRegular(join(directory, "instance.json"));
  const instance = JSON.parse(text);
  if (
    hash(text) !== manifest.instance_sha256 ||
    manifest.skill !== id.split("/")[0] ||
    instance.instance_id !== manifest.instance_id ||
    instance.instance_id !== id.split("/")[1] ||
    !/^[a-f0-9]{40}$/.test(instance.base_commit) ||
    !/^[a-f0-9]{40}$/.test(manifest.revision) ||
    !["swe", "swt"].includes(manifest.benchmark) ||
    manifest.classification !== "B"
  )
    throw new Error("Invalid external case snapshot");
  for (const field of ["problem_statement"]) {
    if (typeof instance[field] !== "string" || !instance[field].trim())
      throw new Error(`Missing ${field}`);
  }
  if (manifest.benchmark === "swe") {
    if (!/^swebench\/[\w.-]+@sha256:[a-f0-9]{64}$/.test(manifest.environment_image ?? ""))
      throw new Error("Missing immutable SWE environment image");
  }
  const criteria = await readRegular(join(directory, "criteria.md"));
  const skills = Object.create(null);
  for (const name of [manifest.skill, ...manifest.dependencies]) {
    for (const [path, value] of Object.entries(
      await readTree(join(root, "..", "..", "skills", name)),
    ))
      skills[`${name}/${path}`] = value;
  }
  const task =
    (manifest.benchmark === "swe"
      ? "Implement the following issue in this repository.\n"
      : "Write regression unit tests reproducing the following issue. Do not fix or modify production code. Tests must fail before the reference fix and pass after it.\n") +
    `Use applicable supplied skills. If the ${manifest.skill} skill is supplied, apply it to this task.\n\n` +
    instance.problem_statement;
  return { manifest, instance, criteria, skills, task };
}

export function conditionSkills(materials, condition) {
  if (!["with-skill", "without-skill"].includes(condition)) throw new Error("Invalid condition");
  return Object.fromEntries(
    Object.entries(materials.skills).filter(
      ([path]) => condition === "with-skill" || !path.startsWith(`${materials.manifest.skill}/`),
    ),
  );
}

export function validateSubmission(output, benchmark) {
  if (
    typeof output.patch !== "string" ||
    !output.patch.trim() ||
    /^GIT binary patch$/m.test(output.patch)
  )
    throw new Error("Expected nonempty text patch");
  checkFiles(output.initial);
  checkFiles(output.files);
  const paths = [...new Set([...Object.keys(output.initial), ...Object.keys(output.files)])];
  if (!paths.length) throw new Error("Missing changed-file evidence");
  // Test-generation tasks explicitly prohibit modifying production code.
  if (benchmark === "swt" && paths.some((path) => !/(^|\/)tests?\//.test(path)))
    throw new Error("Test-generation submission changes files outside test directories");
  return paths;
}
