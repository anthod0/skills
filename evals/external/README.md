# External-task behavior evaluations

Compare how agents work with and without a target skill on fixed external tasks. An independent, tool-free model reviews code changes and the operation trace against case-specific behavioral criteria. The runner does not execute official benchmark grading or reference-answer validation, and does not certify task correctness.

## Tasks

| Case ID | Source | Agent task |
| --- | --- | --- |
| `implement/axios__axios-5085` | SWE-bench Multilingual, `test` | Implement the original issue |
| `write-good-test/astropy__astropy-12907` | SWE-bench Lite through SWT-Bench | Write regression tests without modifying production code |
| `write-good-test/sympy__sympy-20590` | SWE-bench Lite through SWT-Bench | Write regression tests without modifying production code |

These are B (original-task) subset comparisons, not leaderboard submissions or evidence of general skill effectiveness. Dataset snapshots preserve original issue text and provenance. Reference patches and scoring fields in those snapshots are not supplied to agents or judges and are not executed.

The filesystem-safety case remains separate: run `test-filesystem-safety/ssh-hosts-list-filter` with [the fixture runner](../README.md) and report its results separately.

## Inspect, prepare, compare

Requires Bun (or Node.js 22+). Preparation and comparisons also require Docker, an x86-64/amd64 execution environment, network access and substantial disk space for upstream repository/dependency images. Runtime containers use one CPU and a 4 GiB memory limit.

```bash
# Offline materials validation: no Docker, credentials or model calls.
./scripts/eval-external.sh implement/axios__axios-5085 --check
./scripts/eval-external.sh write-good-test/astropy__astropy-12907 --check
./scripts/eval-external.sh write-good-test/sympy__sympy-20590 --check

# Build repository/dependency environments only; no model calls or test execution.
./scripts/eval-external.sh implement/axios__axios-5085 --prepare
./scripts/eval-external.sh write-good-test/astropy__astropy-12907 --prepare
./scripts/eval-external.sh write-good-test/sympy__sympy-20590 --prepare

# Paid comparison: explicitly select tested and independent judge models.
./scripts/eval-external.sh implement/axios__axios-5085 \
  <provider> <model> <judge-provider> <judge-model>
```

An optional final argument supplies an auth file. Credential selection follows the [fixture runner](../README.md#execution-and-credential-boundaries). No dependency installation takes place on the host.

Both conditions use the same task, model, high reasoning, ten-minute budget and built image. Dependency skills are identical in both conditions; only the target skill is removed in `without-skill`. Implementation tasks supply `write-good-test`, `write-good-docs`, `test-filesystem-safety` and `code-review` as dependencies. Test-generation tasks supply `test-filesystem-safety`. This measures the target's incremental effect given those dependencies, not the whole package versus no skills.

The target is explicitly activated using Pi's `/skill:<name>` command in `with-skill`. The trace must show expanded instructions in the user context. This matters for `implement`, whose source disables automatic invocation.

Agents can run their own validation inside the container; commands and results become behavioral evidence. Test-generation edits outside test directories are scope violations, including production-file renames into test directories. Scope violations still receive behavior review.

Only Pi's built-in read/write/edit/bash tools are available. Parallel review sub-agents are not provided; a self-review does not establish compliance with an independent sub-agent review requirement. Missing mechanism/evidence can produce `needs-review`.

## Results and evidence

Git-ignored `evals/runs/external-<timestamp>-<id>/` archives contain:

- `inputs.json`: task, original dataset instance, rubric, skills and runner source snapshot; `result.json` records its hash.
- Build contexts/logs and `environment.json`: resolved image IDs/digests and runtime limits. SWT tasks also archive the upstream environment build plan.
- Each condition's `agent.json`, Pi's native `session.jsonl` (with credential redaction), and `submission.patch`. Export compares against the initial commit, so agent commits do not erase the patch. Rename sources and destinations both enter scope/evidence.
- Each condition's `review-request.json`, `judge.json` and native `judge-session.jsonl`, when review reaches those steps.

`result.json` records execution validity, editing scope and per-criterion behavior verdicts. Status/exit codes are `reviewed`/0, `violated`/1, `error`/2 and `needs-review`/3; see the [shared evidence rules](../README.md#results-and-evidence). Preparation returns `prepared`/0 after image builds succeed; it does not establish that tests can run or that a reference answer succeeds.

Behavioral evidence contains complete before/after text for changed files and native session messages, including prompt/tool declarations and tool calls/results, not a full repository snapshot. Evidence references use `session:<line>` for the original session line. Branched, compacted or context-edited sessions are rejected. Missing context must remain insufficient evidence. Review requests preserve the complete evidence without a separate request-size cap or truncation; model context-limit failures are review errors. Model judgments can be wrong, and one pair does not establish skill effectiveness. This runner does not support the fixture runner's re-review command.

## Isolation and reproducibility

- Runtime containers are disposable, non-root, read-only outside bounded tmpfs areas, resource/time limited, with all capabilities dropped and no host mounts or Docker socket. Cleanup failure invalidates execution and stops further work.
- Agents receive the base repository and dependencies, not reference fixes or rubrics. Git history is shallow at the initial commit, with no newer branch or remote. Archives contain reference materials: do not give them to agents.
- Image builds use host networking. Agents use bridge networking and receive only the selected provider credential through stdin. This is not hostile-code containment against deliberate credential exfiltration. Inspect archives before sharing.
- Workspaces retain the original `/testbed` path for editable installs and test collection. Upstream dependency-setup edits are preserved in the initial workspace. Conda is copied without its package cache into a private tmpfs environment for non-root execution.
- Dataset snapshots and environment-builder commits are pinned. Axios pins its upstream image by registry digest. SWT uses pinned upstream specifications to build repository/dependency environments; external package resolution may change on later builds. SWE/SWT Python packages remain build-time dependencies for those environment specifications, not grading services.

## Runner verification

```bash
node --test evals/runner/*.test.mjs evals/external/*.test.mjs
```

These tests require Python 3 for the environment-helper test and use synthetic temporary files, stubbed upstream specifications and mocked Docker calls. They do not execute fixture/submitted code or call models. `--prepare` separately verifies real environment builds.

## Source attribution

Original issue text, patches and code remain subject to upstream terms. Preserve attribution when redistributing materials.

- [SWE-bench Multilingual dataset](https://huggingface.co/datasets/SWE-bench/SWE-bench_Multilingual/tree/846e647b9f33c0b51b739d005d13d85493c9af09)
- [SWE-bench Lite dataset](https://huggingface.co/datasets/princeton-nlp/SWE-bench_Lite/tree/6ec7bb89b9342f664a54a6e0a6ea6501d3437cc2)
- [SWE-bench environment specifications](https://github.com/SWE-bench/SWE-bench/tree/02e7a74ffd0b707aab73d203fe87bdc7c76afc8e)
- [SWT-Bench environment specifications](https://github.com/logic-star-ai/swt-bench/tree/330a649a764fab2fadaea632776eeae87272f74b)
