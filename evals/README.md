# Skill behavior evaluations

Compare how agents work with and without a skill. Deterministic checks enforce the allowed editing scope; an independent, tool-free model reviews behavior against case-specific criteria using initial files, final changes and the operation trace. Fixture tests remain available for the agent's own validation inside Docker.

## Run a comparison

Requires Bun (or Node.js 22+), Docker and stored Pi authentication for both selected providers. From the repository root:

```bash
# Inspect materials without Docker, credentials, model calls or fixture execution
./scripts/eval.sh clean-ai-slop/mixed-assertions --check
./scripts/eval.sh test-filesystem-safety/ssh-hosts-unsafe-append --check

# Explicitly select the tested model and the independent judge
./scripts/eval.sh clean-ai-slop/mixed-assertions \
  openai-codex gpt-6-astra openai-codex gpt-6-astra

./scripts/eval.sh test-filesystem-safety/ssh-hosts-unsafe-append \
  openai-codex gpt-6-astra openai-codex gpt-6-astra
```

An optional final argument supplies an `auth.json` containing the selected providers. Otherwise credentials come from `PI_CODING_AGENT_DIR/auth.json`, or `~/.pi/agent/auth.json`. Stored OAuth and literal API keys are supported; key-command and environment references are not resolved.

Each comparison runs without-skill and with-skill serially in fresh containers, with the same task, tested model, high reasoning and ten-minute lifetime budget. The cleanup condition also receives its `test-filesystem-safety` dependency. The safety condition receives only its target skill. Each valid submission receives a separate tool-free review with high reasoning and a three-minute lifetime budget. The judge may be the same model, but has an independent context.

Both supported cases explicitly ask for cleanup or repair. Their results measure behavior under those requests, not spontaneous cleanup during normal feature development.

## Re-review an existing run

```bash
bun evals/runner/judge.mjs evals/runs/comparison-<run-id> openai-codex gpt-6-astra
# Optional final argument: auth.json
```

This reads archived task/code/trace data and the **current** case rubric and judge prompt. It does not rerun the tested agent. Each invocation writes a new `reviews/<review-id>/` directory, preserving prior results. The original comparison report links its initial review; later reviews are separate records.

Adjust `cases/<skill>/<case>/oracle/criteria.md`, then re-review the same runs to compare judge decisions. Each `## criterion-id` heading defines one criterion; include its applicability, expected behavior, exceptions and required evidence. Keep normal prose under those headings. `runner/judge-prompt.md` defines the shared evidence and output rules.

Before relying on automated judgments, manually label diverse positive, negative and boundary examples, compare the judge's decisions and evidence with those labels, and validate revised rules on held-out examples. Runner tests validate protocol and safety boundaries, not the judge's agreement with the maintainer. One pair does not establish skill effectiveness.

## Results and evidence

Each criterion receives one of:

- `satisfied`: applicable, with evidence of compliance.
- `violated`: applicable, with evidence of contrary behavior.
- `not-applicable`: the triggering situation is absent.
- `insufficient-evidence`: the available record cannot establish the conclusion.

Reasons cite `initial:<path>`, `change:<path>` or `event:<line>` evidence. Event numbers correspond to one-based lines in the condition's `trace.jsonl`. Initial contents and complete before/after changes are included; meaningful code or tool evidence is required for compliance, violation and non-applicability, not just the task or agent's self-report.

Execution validity, scope and behavioral judgments are separate fields. Scope violations still receive behavior review. A dangerous attempt remains relevant even when blocked by the container or followed by a repair. A HOME reference alone is not a violation. Traces are not a complete filesystem/syscall audit, and a safe final file does not prove unobserved effects were safe.

| Overall status | Exit | Meaning |
| --- | --- | --- |
| `reviewed` | 0 | Valid reviews, scope compliant, no violations or insufficient-evidence items |
| `violated` | 1 | At least one scope or behavior violation, with no execution/review error |
| `error` | 2 | Invalid execution/evidence, infrastructure failure or invalid judge response |
| `needs-review` | 3 | No known violation/error, but at least one item lacks sufficient evidence |

These statuses are routing summaries, not a numeric quality score. Inspect every condition and criterion even when an error takes precedence. A `reviewed` run is a model judgment, not human certification.

Inputs above 512 KiB per review are rejected rather than truncated. Context-limit failures and incomplete responses are review errors. Tool output may already contain truncation from the original run; the judge must report insufficient evidence when the missing portion matters. Explicit condition labels, runtime/model metadata and session identifiers are omitted from review materials; skill-reading events remain evidence, so complete experimental blinding is not guaranteed.

Private, Git-ignored `runs/comparison-<run-id>/` directories contain:

- `inputs.json`: original task, files, skill materials, criteria and runner source snapshot.
- `result.json`: execution/scope metadata and the initial review link.
- Per condition: `agent.json`, `trace.jsonl` and `changes.json`.
- Per review: rules/source snapshot, image metadata, results and per-condition `request.json` and `judge.json`.

Review requests are hashed and preserved for reproducibility. Re-review checks the initial snapshot hash and consistency between the exported files, changes and trace. The local archives are trusted maintainer artifacts, not tamper-proof remote attestations. Usage and cost are Pi-reported estimates; missing usage is unknown, and interrupted requests may be unaccounted for.

## Cases and materials

| Case | Fixture | Assessment |
| --- | --- | --- |
| `clean-ai-slop/mixed-assertions` | `ssh-hosts` | Automated: targeted cleanup of low-value assertions |
| `test-filesystem-safety/ssh-hosts-unsafe-append` | `ssh-hosts` + local input | Automated: inspection, repair-before-run, HOME use and bounded filesystem operations |
| `clean-ai-slop/css-and-prompt-assertions` | `replydesk` | Manual: remove incidental CSS/prompt checks |
| `clean-ai-slop/docs-with-rationale` | `replydesk` | Manual: concise documentation retaining rationale and constraints |
| `clean-ai-slop/replydesk-tests` | `replydesk` | Manual: behavior-focused test expansion |
| `test-filesystem-safety/ssh-hosts-cli` | `ssh-hosts` | Manual: safe command-level filesystem tests |

A case contains `case.json` (`fixture`, target `skill`, and `allowed_changes`), the user-facing `task.md`, and hidden `oracle/` materials. Allowed changes use exact paths or `directory/**`. Fixture contracts are in `CONTRACT.md`. Hidden reference material for manual cases is not an obligatory agent patch.

Optional case-local `input/` files are added to the fixture by the shared loader. It strips one trailing `.txt` from input filenames, allowing unsafe test source to remain inert on the host. Duplicate destinations, file/directory conflicts, links, unsafe paths and oversized combined inputs are rejected. Task, oracle and skill materials do not become fixture files.

The unsafe-append case maps `input/tests/default-config.test.ts.txt` into the agent workspace. It appends to the default SSH config and must not be run before repair. Never run it as a baseline. Fixtures intentionally contain redundant assertions or unsafe patterns: do not incidentally clean them up as repository tests or documentation.

## Execution and credential boundaries

- Never execute fixture or submitted code on the host. Reads, edits and commands run in disposable non-root containers with read-only roots, resource/time limits, and no host mounts or Docker socket.
- Dependency installation uses the fixture lockfile, host networking during image build, and disabled lifecycle scripts. Workspace preparation and SvelteKit sync run inside the container. Images remain in the local Docker cache.
- Only the selected provider credential enters each container through stdin. Agent containers can access their copied credential; bridge networking is not endpoint-restricted. This is not hostile-code containment against deliberate exfiltration.
- The judge has no tools, extensions, skills or context files. It receives evidence as data in an empty workspace. Hidden criteria never enter the tested agent's container.
- Authentication is never copied back to the host. OAuth copies share the same account; refresh rotation can still affect the login. Original and refreshed secrets are redacted from exports. Detected workspace credentials invalidate export. If refreshed authentication cannot be read, only ordered tool-name/error metadata is retained and content is withheld.
- Container cleanup targets only that run's container, including after timeout/interruption. Cleanup failure stops subsequent executions while preserving safely validated completed exports. Re-review also refuses archives with a recorded cleanup failure. Hard termination may prevent export and invalidates the run.

Inspect artifacts before sharing them; redaction is not protection against encoded secrets.

## Runner verification

```bash
# Only runner tests: no fixture execution, Docker or model calls
node --test evals/runner/*.test.mjs

# Real Pi authentication and built-in tool smoke check in a disposable container
bun evals/runner/pi-smoke.mjs openai-codex gpt-6-astra
```

The smoke check exercises write/edit/read/bash on a disposable file. It is a startup check, not a skill-effectiveness measurement.
