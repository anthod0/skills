# External skill evaluations

Run a fixed external-task subset with and without one target skill. This runner uses pinned upstream specification and grading functions inside containers, not the fixture runner's model judge as a substitute for benchmark correctness. Behavior receives a separate tool-free review.

## Selected tasks

| Case ID | Original source | Submission / official assessment |
| --- | --- | --- |
| `implement/axios__axios-5085` | SWE-bench Multilingual, `test` | Implementation patch; original F2P and P2P lists |
| `write-good-test/astropy__astropy-12907` | SWE-bench Lite through SWT-Bench | Test patch; original SWT unit-test success and coverage delta |
| `write-good-test/sympy__sympy-20590` | SWE-bench Lite through SWT-Bench | Test patch; same SWT protocol |

These are B (original-task) subset evaluations, not official leaderboard submissions or evidence of general skill effectiveness. The two SWT tasks request regression tests instead of a production repair, as required by SWT's test-generation protocol. Changes outside test directories are excluded from SWT scoring, including production-file renames into test directories.

The existing `test-filesystem-safety/ssh-hosts-list-filter` case, its input and its rubric are unchanged. Run it with [`scripts/eval.sh`](../README.md); report its F-scene results separately. No existing fixtures have been retired.

## Inspect, prepare, compare

Requires Bun (or invoke the `.mjs` entry point with Node.js 22+). Preparation and comparisons also require Docker, an x86-64/amd64 execution environment, network access and substantial disk space. SWT's upstream recommendation is at least 120 GB free disk, 16 GB RAM and 8 CPUs; this runner executes stages serially with one CPU and a 4 GiB memory limit per runtime container. Failure under these limits is an environment error, not a negative skill result.

From the repository root:

```bash
# Entirely offline: validate bundled materials and skill sources, without Docker.
./scripts/eval-external.sh implement/axios__axios-5085 --check
./scripts/eval-external.sh write-good-test/astropy__astropy-12907 --check
./scripts/eval-external.sh write-good-test/sympy__sympy-20590 --check

# Download/build environments and validate reference oracles. No credentials/models.
./scripts/eval-external.sh implement/axios__axios-5085 --prepare
./scripts/eval-external.sh write-good-test/astropy__astropy-12907 --prepare
./scripts/eval-external.sh write-good-test/sympy__sympy-20590 --prepare

# Paid comparison: explicitly select tested and independent judge models.
./scripts/eval-external.sh implement/axios__axios-5085 \
  <provider> <model> <judge-provider> <judge-model>
```

An optional final argument supplies an auth file. Credential selection follows the [existing runner](../README.md#execution-and-credential-boundaries). No dependency installation takes place on the host.

A comparison prepares and validates its environment before calling either model. Preparation archives are evidence, not a cache interface: each comparison validates again, while Docker reuses its build layers. Axios must resolve with its reference patch and fail with the unmodified baseline. SWT validates the reference test patch through all six original stages: predicted tests before/after the code fix, gold tests before/after, and baseline tests before/after. Grading delegates to upstream functions, including missing-test handling and coverage calculations; it does not invent a simpler exit-code score.

Both agent conditions use the same task, model, high reasoning, ten-minute budget and built image. Dependency skills are fixed in both conditions; only the target skill is removed in `without-skill`. The implementation comparison supplies `write-good-test`, `write-good-docs`, `test-filesystem-safety` and `code-review` as dependencies. Test comparisons supply `test-filesystem-safety`. Consequently this measures the target's incremental effect **given those dependencies**, not the whole package versus no skills.

The target is explicitly activated using Pi's `/skill:<name>` command in `with-skill`. A run is invalid unless the trace shows its expanded instructions in the user context. This matters for `implement`, whose source disables automatic invocation. Dependency skills remain discoverable in both conditions.

Only Pi's built-in read/write/edit/bash tools are available. Parallel review sub-agents are not provided by this runtime; the `implement` review criterion must not pretend a self-review satisfies that mechanism. Missing mechanism/evidence can produce `needs-review`. This runner does not establish the effectiveness of an implementation workflow with sub-agent tools.

## Results

Git-ignored `evals/runs/external-<timestamp>-<id>/` archives contain:

- `inputs.json`: selected task, original instance (including hidden references), rubric, skill materials and source snapshot; `result.json` records its hash.
- Build contexts/logs, `environment-plan.json`, `environment.json` and `harness-environment.json`: upstream/generated scripts, resolved image IDs/digests, limits, Python version and installed dependency versions.
- `validation-gold/` and, for Axios, `validation-base/`: reference logs and original grades.
- Each condition's `agent.json`, `trace.jsonl`, `submission.patch` and `prediction.json`. Export compares against the initial commit, so an agent commit does not erase the patch. Rename sources and destinations both enter scope/evidence.
- Each condition's `oracle/official.json` and stage logs, plus `review-request.json` and `judge.json`. Behavioral evidence contains complete before/after text for changed files and the trace, not a full repository snapshot. Missing unobserved context must remain insufficient evidence.

`result.json` has two separate outcomes:

- `conditions[].official`: original benchmark grades, including `resolved` and SWT coverage fields. Invalid-scope submissions instead have `excluded: true`.
- `conditions[].behavior`: criterion verdicts with code/tool evidence. The original [judge evidence rules](../README.md#results-and-evidence) apply.

Comparison status/exit codes route **behavior and execution**, not benchmark resolution: `reviewed`/0, `violated`/1, `error`/2, `needs-review`/3. A `reviewed` run may still have `official.resolved: false`; inspect every condition. Preparation returns `prepared`/0 only after reference validation, otherwise `error`/2. This runner does not support the fixture runner's re-review command.

## Isolation and reproducibility limits

- Runtime containers are disposable, non-root, read-only outside bounded tmpfs areas, resource/time limited, with all capabilities dropped and no host mounts or Docker socket. Cleanup removes only that execution's unique container. Cleanup failure or interruption invalidates execution and stops further work.
- Agent environments contain the base repository and dependencies, not official test patches, reference fixes or rubrics. Git history is shallow at the initial commit, with no newer branch or remote. Reference materials enter only separate oracle/control containers. Build contexts and archives contain hidden answers; do not give them to agents.
- Official Docker setup runs during image builds with host networking. Runtime agent and oracle networking uses bridge networking: Axios includes an upstream HTTP regression and SWT may need install-time package access. Oracle containers receive no model credential. Agent containers receive only the selected credential through stdin; this is not containment against deliberate encoded secret exfiltration. Inspect archives before sharing.
- Benchmark workspaces retain the original physical `/testbed` path so editable installs, pytest collection and coverage agree. Upstream environment-setup edits (such as Astropy's setuptools build pin) are preserved in the initial workspace, not counted as agent changes. SWT scripts relocate the root-owned scratch file and coverage helper; informational `git show` uses `--no-patch` to avoid dumping the whole repository at a shallow root commit. Original test commands, six stages and grading functions are retained. Conda is copied without its package cache into a private tmpfs environment so upstream reinstall steps do not require a writable container root. These restrictions may expose environment incompatibilities absent in upstream's default rootful harness.
- Dataset snapshots and harness commits are fixed. The Axios manifest pins the upstream environment by registry digest (the original dataset's `latest` field is preserved only as source material); the exact local image is reused or downloaded if absent. Both conditions use the same overlay image. SWT environments and the control image are built from pinned harness code, but external package resolution can change on later builds. Installed harness dependency versions and resolved image IDs are archived, not a promise of byte-identical future rebuilds.
- A successful reference oracle demonstrates that task's local environment, not a model result. No paid comparison happens during `--check` or `--prepare`. Unit tests validate plumbing and safety, not the semantic accuracy of the model judge.

## Verify runner changes

```bash
node --test evals/runner/*.test.mjs evals/external/*.test.mjs
```

These tests use synthetic temporary files and mocked Docker calls; they do not execute fixture/submitted code, install environments or call models. Use `--prepare` separately for real oracle validation.

## Source attribution

Bundled `cases/*/*/instance.json` files preserve selected original records; each manifest stores its dataset, split, fixed revision and snapshot hash. Reference patches are assessment-only materials.

- [SWE-bench Multilingual dataset](https://huggingface.co/datasets/SWE-bench/SWE-bench_Multilingual/tree/846e647b9f33c0b51b739d005d13d85493c9af09)
- [SWE-bench Lite dataset](https://huggingface.co/datasets/princeton-nlp/SWE-bench_Lite/tree/6ec7bb89b9342f664a54a6e0a6ea6501d3437cc2)
- [SWE-bench harness](https://github.com/SWE-bench/SWE-bench/tree/02e7a74ffd0b707aab73d203fe87bdc7c76afc8e)
- [SWT-Bench harness and protocol](https://github.com/logic-star-ai/swt-bench/tree/330a649a764fab2fadaea632776eeae87272f74b)

Original issue text, patches and code remain subject to their upstream terms. Preserve upstream attribution when redistributing these materials.
