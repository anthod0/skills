# Skill evaluation cases

`fixtures/` holds the initial repositories given to agents, and `cases/` holds tasks and hidden acceptance criteria. `runner/calibrate.mjs` calibrates test-cleanup cases; `runner/evaluate.mjs` runs matched Pi comparisons with and without skills. Both use Docker. Passing calibration establishes attainable acceptance targets, not skill effectiveness.

| Case | Fixture | Evaluation goal |
| --- | --- | --- |
| `clean-ai-slop/mixed-assertions` | `ssh-hosts` | Remove ordering, redundant and error-copy assertions while preserving SSH editing and boundary coverage |
| `clean-ai-slop/docs-with-rationale` | `replydesk` | Remove implementation diaries and code restatements while preserving human-review rationale and operational constraints |
| `clean-ai-slop/css-and-prompt-assertions` | `replydesk` | Remove CSS/prompt copy checks while preserving action, message-separation and SSR coverage |
| `test-filesystem-safety/ssh-hosts-cli` | `ssh-hosts` | Add command-level filesystem tests without repurposing the user directory |
| `test-filesystem-safety/ssh-hosts-unsafe-append` | `ssh-hosts` + case-local input | Recognize and repair an existing test that appends to the default SSH config before running it |
| `clean-ai-slop/replydesk-tests` | `replydesk` | Add model-adapter and page-interaction coverage without copying incidental prompt/CSS assertions |

The automated calibration and paired runner support `mixed-assertions` and `css-and-prompt-assertions`. Both fixtures have container-validated baselines and use their existing Bun lockfiles. Documentation cleanup and the two test-writing cases require manual acceptance; they are not supported by the paired CLI. In particular, filesystem-safety acceptance requires operation review and cleanup fault injection, not just passing tests.

The `ssh-hosts-cli` and `replydesk-tests` tasks ask agents to write tests. Hidden criteria distinguish newly added behavioral coverage, newly introduced low-value assertions, inherited seed cleanup, lost coverage, and operation safety. The SSH fixture deliberately leaves file-backed command tests unwritten; its previous store tests are kept only in the case's hidden reference directory. The CLI task includes the default user-directory boundary, explicit config selection and failed-operation cleanup.

`ssh-hosts-unsafe-append` is a separate manual repair case. The shared case loader maps its `input/tests/default-config.test.ts.txt` to `tests/default-config.test.ts` in the initial file set. The source remains excluded from automatic test discovery on the host; write the prepared file set only inside the dedicated agent container. Do not run the seeded test as a baseline. Input preparation is supported, but this case's execution and safety assessment are not wired into the calibration or paired CLI.

## Case conventions

Each case contains:

- `case.json`: `fixture` is a directory name under `fixtures/`; `skill` identifies the target skill supplied in the with-skill condition; `allowed_changes` contains exact paths or `directory/**` patterns relative to the run's repository; `test_command` identifies the supported test entry point. For `bun run test`, the runtime validates the fixture's package script, then invokes its underlying Node or Vitest runner with a machine-readable reporter at the repository root; arbitrary package scripts are rejected.
- `task.md`: the same user task for both comparison conditions, without the oracle.
- Optional `input/`: additional files for this case, laid out relative to the fixture root. No extra JSON or manifest field is needed. Remove one trailing `.txt` from each input filename; other filenames and directory names remain unchanged. For example, `input/tests/example.test.ts.txt` becomes `tests/example.test.ts`; use `notes.txt.txt` to deliver `notes.txt`.
- `oracle/`: acceptance criteria, optional hidden variants, and reference cleanup patches. These are not copied into the agent environment.

`readCase(evalRoot, caseId)` in [case.mjs](runner/case.mjs) loads the fixture and that case's input into one file set without executing or writing their contents. Inputs are add-only: duplicate destinations and file/directory conflicts fail, including collisions within input after suffix removal. Links, unsafe paths and oversized combined inputs are rejected. Missing `input/` is allowed; malformed input is not silently ignored. Fixture `.txt` files, task/skill materials and agent exports are not renamed. Calibration and paired evaluation use this merged file set for preflight, snapshots, agent input and acceptance; inputs from other cases are never included.

Multiple independent tasks may use the same fixture. Fixtures are evaluation inputs, not ordinary tests or documentation to clean up in this repository. Their low-value assertions and redundant text are deliberately retained as evaluation stimuli; do not clean them up incidentally. `ssh-hosts` uses Node's test runner through tsx; `replydesk` uses SvelteKit and Vitest. Both expose `bun run test`. Product contracts live in each fixture's `CONTRACT.md`.

## Execution boundaries

Do not run fixture code or agent-modified code directly on the host, including baselines, hidden variants, and acceptance scripts. Docker must contain not only test execution but also all agent reads, edits, and command execution. An alternative is an external model driving tools strictly confined to the container.

Shared runner boundaries:

1. Create a disposable, non-privileged container running as a non-root user for each run, and copy the fixture into a writable working directory inside it. Do not expose writable host bind mounts, the real HOME, host credential directories, or the Docker socket.
2. Limit resources and runtime. Pi containers may receive a copy of the selected provider's stored credential in container-local temporary storage and use network access for model calls. Pi and its tools can read that credential; do not mount personal authentication directories or copy unrelated provider credentials. Calibration and acceptance containers remain credential-free and offline.
3. Supply only the task and skill materials for that condition, preventing global skills/instructions from leaking into the control group. Use synthetic data for all simulated user directories and sentinels.
4. Record tool operations and export changes from outside the container. Evaluate with hidden oracles; any step that executes submitted code must run in a separate disposable container, never through imports or execution on the host.
5. Record dangerous attempts, actual file effects, and task completion separately. Dangerous operations blocked by the container do not count as safe agent behavior.

`clean-ai-slop` references `test-filesystem-safety`. The with-cleanup-skill condition should also supply that dependency and record its version, so a missing dependency does not block the task. The current cleanup cases do not themselves require filesystem read/write tests. The baseline condition does not receive these target skills, but retains the same outer isolation constraints.

## Calibration

Requires Bun (or Node.js 22+) and an available Docker daemon. Run commands from the repository root:

```bash
# Check only materials, paths, and replacement anchors; no fixture execution or Docker required
bun evals/runner/calibrate.mjs clean-ai-slop/css-and-prompt-assertions --check

# Full calibration in Docker; the two cases require 26 and 18 separate container executions, respectively
bun evals/runner/calibrate.mjs clean-ai-slop/css-and-prompt-assertions
bun evals/runner/calibrate.mjs clean-ai-slop/mixed-assertions

# Run only the runner's pure-logic tests, without loading fixture code or invoking Docker
node --test evals/runner/calibration.test.mjs
```

Calibration does not call an agent or model, or modify the original fixture. It applies the exact text edits from `oracle/reference.json` to an in-memory copy as the reference cleanup result. This patch is for maintainer review, not the only acceptable agent answer. Each variant is applied independently to the original or reference version; changes do not accumulate.

| Version | Original implementation | regression | refactor |
| --- | --- | --- | --- |
| Original tests | Pass | Relevant assertions fail | Copy checks fail |
| After reference cleanup | Pass | Relevant assertions still fail | Pass |

`detects` in `variants.json` specifies a test name that must fail during calibration. Only actual assertion failures are accepted: Node's `ERR_ASSERTION`, or Vitest assertion errors normalized by the reporter. Timeouts, abnormal exits, import errors, reported hook failures, empty test suites, skip/todo and cancellations do not count as successful detection. At least one designated test must supply assertion evidence; an unrelated assertion alone is insufficient. Name matching applies only to these two maintained calibration versions; it does not restrict future agents from reorganizing or renaming tests.

Calibration uses Node.js 22 and pinned Bun in fixture-specific images built with host networking. Only package.json and bun.lock enter the dependency-install layer; `bun install --frozen-lockfile --ignore-scripts` installs dependencies without running fixture lifecycle scripts. Each disposable container copies those dependencies into its workspace; SvelteKit sync and test execution happen there, offline and without credentials.

Test containers run as a non-root user, with no network, no host mounts, and a read-only root filesystem. The workspace is a 512 MiB executable tmpfs so esbuild and Rollup's native dependencies can run; `/tmp` remains non-executable. Acceptance has a 90-second container lifetime, a 60-second test-process timeout and a 1 GiB memory limit. Execution is bounded by resources and log size, and exceeding limits cannot count as successful detection; see [docker.mjs](runner/docker.mjs). An independent timeout inside the container does not depend on the host Docker client remaining alive. On completion, timeout, or interruption, cleanup targets only containers created for that run. If cleanup fails, subsequent tasks stop and the container name is recorded. Built images remain in the local Docker cache.

Artifacts are stored in `runs/<run-id>/`: `result.json` records individual verdicts and overall status, and `inputs.json` preserves exact inputs and runner source code. Artifacts also include input hashes, image ID, Docker/Node versions, build logs, and per-execution JSONL/stderr logs. Any unmet expectation or infrastructure error causes a nonzero exit; an unavailable Docker daemon also produces an error result. `--check` does not generate run results and cannot replace container calibration.

Documentation cleanup and the two test-writing cases are not supported by this calibration command. Documentation requires factual review; new-test quality requires behavioral review, and filesystem safety additionally requires operation traces and fault injection. Reference patches and variant semantics still require review; the script cannot prove that prompt rewrites produce equivalent outputs from real models.

## Pi container smoke check

Verify native Pi startup, authentication, and its four built-in tools before running evaluation tasks:

```bash
bun evals/runner/pi-smoke.mjs openai-codex gpt-6-astra
# Optional third argument: an explicit auth.json path
node --test evals/runner/*.test.mjs
```

Requires a stored login for the selected provider. The default credential source is `auth.json` under `PI_CODING_AGENT_DIR`, or `~/.pi/agent` when unset. Only that provider's entry is copied, at runtime through stdin, into writable container-local tmpfs. Host authentication is never written back. OAuth refreshes affect the container's copy; a copied login is not an independent account. Literal API keys are also supported; shell-command and environment-variable key references are not resolved by this check.

The shared [Dockerfile](runner/Dockerfile) pins Pi's version; agent and acceptance runs use separate containers. It uses native Pi tools and prompt construction without host skills, extensions, settings, or context files. The check calls the selected real model at low reasoning, asks it to write/edit/read a disposable file and run a shell check, and verifies the resulting file. It has a three-minute container lifetime limit and uses Docker bridge networking, **not an endpoint-restricted network**. This is a startup check, not a skill comparison or a test of hostile-code containment.

`runs/pi-smoke-<run-id>/result.json` contains allowlisted runtime and success metadata; `build.log` records the credential-free image build. Raw model/tool output and authentication payloads are not saved, to avoid archiving credentials if the agent prints them. A failure exits nonzero; timeouts, interruptions, and normal completion all trigger cleanup of the run's own container.

## Paired agent evaluation

Supported cases are `clean-ai-slop/mixed-assertions` and `clean-ai-slop/css-and-prompt-assertions`:

```bash
# Validate inputs without Docker, credentials, model calls, or fixture execution
bun evals/runner/evaluate.mjs clean-ai-slop/mixed-assertions --check

# Optional final argument: an explicit auth.json path, as for the smoke check
bun evals/runner/evaluate.mjs clean-ai-slop/mixed-assertions openai-codex gpt-6-astra
```

Each invocation builds one image and runs without-skill, then with-skill, serially. Both receive the same task and fresh Git-initialized fixture, selected model, high reasoning, and a ten-minute container lifetime budget (including startup/export). Only the with-skill condition receives the target skill and its filesystem-safety dependency. Skills are explicitly available through Pi's native discovery interface; inspect the trace to determine whether the agent actually read them. No hidden oracle or reference cleanup enters either agent container.

The host archives the exported workspace as text data, never executes it, and checks file additions, deletions, and modifications against `allowed_changes`. Git metadata and generated root directories (`node_modules`, `.svelte-kit`, `build`, `dist`) are excluded. Identically named directories below source/test paths are not excluded. The agent starts with installed dependencies and generated SvelteKit types; these are recreated in every acceptance container. Unsupported exports (links, binary files, unsafe paths, excessive size, or detected credential material) invalidate the run. Scope violations fail without running hidden variants against modified product code. Valid submissions run against the baseline and each independent variant in fresh, offline, credential-free containers.

### Interpreting results

- Baseline success, regression assertion candidates, compatible refactors, and scope compliance are separate fields. Reorganized or renamed tests are allowed.
- Regression candidates must fail with actual assertions, not ordinary exceptions, import errors, empty/skipped suites, or timeouts. Propagated failures of nested-test parents are allowed only alongside actual assertion evidence; they do not provide that evidence themselves. An ordinary exception may still detect a regression semantically; it receives no automatic credit under this strict rule. Review the recorded failure rather than inferring lost behavioral coverage from the verdict alone.
- Vitest reports ordinary `beforeEach`/`afterEach` failures through hook state. Cleanup callbacks that Vitest reports as ordinary test errors still require manual assertion-relevance review.
- Cleanup quality, coverage beyond the variants, assertion relevance, and safety attempts/effects require review. No aggregate score substitutes for these dimensions. Tool traces and workspace snapshots are not a complete filesystem/syscall audit; containment is not evidence that an agent attempted only safe actions.
- `needs-review` means all automated checks passed, **not** that the skill passed every criterion. Failed checks or incomplete/infrastructure runs exit nonzero. Do not infer skill effectiveness from one pair.

### Artifacts and credentials

Private, Git-ignored `runs/comparison-<run-id>/` directories contain input/source snapshots and hashes, image/version metadata, and per-condition results. Each condition includes `agent.json` (workspace, runtime, messages and execution result), `trace.jsonl` (authoritative messages and tool starts/ends), `changes.json` (before/after file contents), and independent verification logs. Streaming deltas are omitted because completed messages contain their content. Hard container termination may prevent export; such runs are invalid, not successful cleanups.

Usage and Pi-reported dollar cost come from completed assistant messages; missing usage is unknown, and interrupted requests may be unaccounted for. Reported cost is a model-price estimate, not necessarily the charge to a subscription account.

Authentication payloads are excluded from input snapshots. Original and final refreshed credential strings are redacted from agent exports; detected credentials in workspace files cause export rejection rather than silently changing the submitted code. If the final authentication file is unreadable or invalid, the run retains only ordered tool-name/start/end/error metadata and withholds arguments, messages, results, stderr, and workspace content because refreshed secrets cannot safely be identified. This is not a defense against deliberate encoding or network exfiltration. Inspect artifacts before sharing them. Copies are never written back to host authentication; refresh rotation can still affect the shared login.
