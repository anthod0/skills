# Skill evaluation cases

`fixtures/` holds the initial repositories given to agents, and `cases/` holds tasks and hidden acceptance criteria. `runner/calibrate.mjs` calibrates test-cleanup cases; `runner/evaluate.mjs` runs matched Pi comparisons with and without skills. Both use Docker. Passing calibration establishes attainable acceptance targets, not skill effectiveness.

| Case | Fixture | Evaluation goal |
| --- | --- | --- |
| `clean-ai-slop/mixed-assertions` | `config-loader` | Remove ineffective and brittle assertions while preserving boundaries and exact error contracts |
| `clean-ai-slop/docs-with-rationale` | `config-loader` | Remove implementation diaries and code restatements while preserving business rationale and external obligations |
| `clean-ai-slop/css-and-prompt-assertions` | `assistant-widget` | Remove CSS/prompt copy checks from complete support-conversation tests while preserving core behavioral coverage |
| `test-filesystem-safety/home-boundary` | `config-loader` | Establish safe filesystem test boundaries for an interface that uses the user directory by default |

Standalone fixtures not yet attached to evaluation cases:

- [`ssh-hosts`](fixtures/ssh-hosts/): a TypeScript/Commander CLI for managing SSH host aliases.
- [`replydesk`](fixtures/replydesk/): a SvelteKit SSR workspace for generating customer reply drafts, with server-side prompts and an OpenAI client.

Both have their own package manifests and Bun lockfiles.

## Case conventions

Each case contains:

- `case.json`: `fixture` is a directory name under `fixtures/`; `skill` identifies the target skill supplied in the with-skill condition; `allowed_changes` contains exact paths or `directory/**` patterns relative to the run's repository; `test_command` is an argv executed at the repository root without shell expansion.
- `task.md`: the same user task for both comparison conditions, without the oracle.
- `oracle/`: acceptance criteria, optional hidden variants, and reference cleanup patches. These are not copied into the agent environment.

Multiple independent tasks may use the same fixture. Fixtures are evaluation inputs, not ordinary tests or documentation to clean up in this repository. Their low-value assertions and redundant text are deliberately retained as evaluation stimuli; do not clean them up incidentally. The `config-loader` and `assistant-widget` fixtures have no third-party dependencies, use the Node.js 22+ built-in test runner, and do not require package.json.

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

# Full calibration in Docker; the two cases require 52 and 14 separate container executions, respectively
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

`detects` in `variants.json` specifies a test name that must fail during calibration. Only actual `ERR_ASSERTION` failures are accepted. Timeouts, abnormal exits, import errors, empty test suites, skip/todo, cancellations, and failures in unspecified tests do not count as successful detection. Name matching applies only to these two maintained calibration versions; it does not restrict future agents from reorganizing or renaming tests.

Calibration uses Node.js 22 containers with host networking for image builds. Test containers run as a non-root user, with no network, no host mounts, and a read-only root filesystem; working copies live in container temporary storage. Execution is bounded by time, resources, and log size, and exceeding limits cannot count as successful detection; see [docker.mjs](runner/docker.mjs) for the limits. An independent timeout inside the container does not depend on the host Docker client remaining alive. On completion, timeout, or interruption, cleanup targets only containers created for that run. If cleanup fails, subsequent tasks stop and the container name is recorded. Built images remain in the local Docker cache.

Artifacts are stored in `runs/<run-id>/`: `result.json` records individual verdicts and overall status, and `inputs.json` preserves exact inputs and runner source code. Artifacts also include input hashes, image ID, Docker/Node versions, build logs, and per-execution JSONL/stderr logs. Any unmet expectation or infrastructure error causes a nonzero exit; an unavailable Docker daemon also produces an error result. `--check` does not generate run results and cannot replace container calibration.

The documentation-cleanup and filesystem-safety cases are not yet supported by this calibration command. The former requires factual review; the latter requires operation traces and fault injection. Reference patches and variant semantics still require review; the script cannot prove that prompt rewrites produce equivalent outputs from real models.

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

The host archives the exported workspace as text data, never executes it, and checks file additions, deletions, and modifications against `allowed_changes`. Git metadata is excluded. Unsupported exports (links, binary files, unsafe paths, excessive size, or detected credential material) invalidate the run. Scope violations fail without running hidden variants against modified product code. Valid submissions run against the baseline and each independent variant in fresh, offline, credential-free containers.

### Interpreting results

- Baseline success, regression assertion candidates, compatible refactors, and scope compliance are separate fields. Reorganized or renamed tests are allowed.
- Regression candidates must fail with actual assertions, not ordinary exceptions, import errors, empty/skipped suites, or timeouts. Propagated failures of nested-test parents are allowed only alongside actual assertion evidence; they do not provide that evidence themselves. An ordinary exception may still detect a regression semantically; it receives no automatic credit under this strict rule. Review the recorded failure rather than inferring lost behavioral coverage from the verdict alone.
- Cleanup quality, coverage beyond the variants, assertion relevance, and safety attempts/effects require review. No aggregate score substitutes for these dimensions. Tool traces and workspace snapshots are not a complete filesystem/syscall audit; containment is not evidence that an agent attempted only safe actions.
- `needs-review` means all automated checks passed, **not** that the skill passed every criterion. Failed checks or incomplete/infrastructure runs exit nonzero. Do not infer skill effectiveness from one pair.

### Artifacts and credentials

Private, Git-ignored `runs/comparison-<run-id>/` directories contain input/source snapshots and hashes, image/version metadata, and per-condition results. Each condition includes `agent.json` (workspace, runtime, messages and execution result), `trace.jsonl` (authoritative messages and tool starts/ends), `changes.json` (before/after file contents), and independent verification logs. Streaming deltas are omitted because completed messages contain their content. Hard container termination may prevent export; such runs are invalid, not successful cleanups.

Usage and Pi-reported dollar cost come from completed assistant messages; missing usage is unknown, and interrupted requests may be unaccounted for. Reported cost is a model-price estimate, not necessarily the charge to a subscription account.

Authentication payloads are excluded from input snapshots. Original and final refreshed credential strings are redacted from agent exports; detected credentials in workspace files cause export rejection rather than silently changing the submitted code. If the final authentication file is unreadable or invalid, the run retains only ordered tool-name/start/end/error metadata and withholds arguments, messages, results, stderr, and workspace content because refreshed secrets cannot safely be identified. This is not a defense against deliberate encoding or network exfiltration. Inspect artifacts before sharing them. Copies are never written back to host authentication; refresh rotation can still affect the shared login.
