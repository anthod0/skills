---
name: write-good-docs
description: Read this skill when writing documentation that explains the current system, including README files, AGENTS.md, and usage guides. Not applicable to specs, PRDs, requirements documents, design proposals, ADRs, or CONTEXT.md.
---

# Write Good Docs

Good documentation helps readers understand, use, or evaluate a system. Apply the following standards without announcing this skill or adding a report about the writing process.

**Code is the sole authority for implemented behavior.** Documentation explains behavior; it does not establish implementation facts. When documentation conflicts with code, follow the current code and correct the documentation. Do not infer code behavior from documentation or change the implementation to make documentation true.

## Answer the reader's actual questions

Write for a clear audience and purpose: users need to know how to use the system, maintainers need to understand constraints and decisions, and design participants need to understand goals and trade-offs.

Each section should answer a useful question, such as when to use a feature, what a successful operation produces, or why a particular approach was chosen. Do not add sections merely to fill a template.

## Describe the current state

Project documentation explains what the system is now, what it can do, and which constraints currently apply. Explain decisions as reasons for the current approach, not as a diary of attempts.

For example, write "Exports contain only records the current user is authorized to view," rather than "We first implemented exports of all records, then added permission filtering."

Clearly label proposed goals and unimplemented capabilities as plans, not completed facts. Changelogs and migration guides can describe changes because the changes themselves are useful to their readers.

## Explain outcomes and constraints

System descriptions should focus on observable results, not internal call flows, private functions, or file-by-file walkthroughs.

For example, write "If submission fails, entered values are preserved so the user can retry," rather than listing the functions called during submission.

Constraints should help readers use the system correctly, such as supported scope, permission requirements, or recovery after failure. State the current constraint directly instead of substituting "An old feature was removed." Explain old and new behavior only when readers need to migrate.

## Provide information beyond the code

Documentation is useful for user goals, domain meaning, external obligations, and the reasons and trade-offs behind decisions. It should not become another copy of implementation details.

For example, explaining "Amounts use the smallest currency unit to avoid floating-point rounding errors" is more useful than restating each amount-processing function.

For complete configuration, interfaces, or implementation details, link to the relevant code instead of maintaining a second implementation description. Usage guides may include commands, parameters, and examples needed to complete a task.

## Verify facts against code

Before describing implemented behavior, inspect the relevant code to establish what it actually does. Existing documentation can help locate questions, but is not evidence of implementation facts. Commands, paths, links, and examples must work; do not present behavior you cannot confirm from code as implemented fact.

Distinguish facts, design intent, and unresolved questions. Do not turn uncertain information into promises; missing records do not prove that a goal or constraint does not exist.

## Be concise, natural, and non-repetitive

Use familiar words and explain things directly. Make abstract concepts concrete with examples; do not obscure meaning with jargon or long sentences.

Each paragraph should add information, and each example should clarify a distinct point. Use headings for navigation and answer directly in the body. Avoid repeating the same summary in the introduction, body, and conclusion.

Length should follow the reader's needs. Include necessary steps, prerequisites, and risks in full; leave irrelevant background, empty praise, and the writing process out of project documentation.
