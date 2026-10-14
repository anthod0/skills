# Rules

- Modify skill source files in this repository, not the user's installed or globally configured skills.

# Writing Skills

- Optimize for predictable process, not identical output. State goals, necessary steps, and checkable completion criteria; require item-by-item coverage where omissions are likely. If the agent rushes, improve the completion criteria first.
- Format descriptions as `<One-sentence purpose>. Use when <trigger conditions>.` Keep Use when to one short sentence covering core scenarios, without exhaustive lists or keyword stuffing; leave execution details in the body.
- Use automatic discovery when the agent must find a skill independently, and explicit invocation when the user should control activation. Split skills only for independent triggers or genuine context isolation; verify invocation mechanics against the target agent's documentation.
- Keep shared instructions and core steps in `SKILL.md`; move branch-specific details and lengthy reference material into linked files, stating when to read them.
- Keep a concept's definition, rules, and caveats together. Give each rule one authoritative source and link to it elsewhere.
- State concrete target behavior instead of vague demands or prohibitions; pair necessary safety prohibitions with safe alternatives.
- Verify tool capabilities, commands, paths, configuration, and examples against the implementation or official documentation; do not present unsupported capabilities as executable instructions.
- Prune sentence by sentence: remove stale content, revision history, duplicate meanings, and instructions that do not change agent behavior; retain details needed for correct execution.
