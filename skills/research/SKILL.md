---
name: research
description: Research external topics using primary sources and document the findings with citations. Use when answering a question or completing a task requires investigating information outside the current code repository.
---

## Research workflow

1. Investigate the question using **primary sources** — official docs, source code, specs, and first-party APIs — rather than secondary write-ups. Trace every claim to its original source.
2. Write the findings to a single Markdown file, citing each claim's source.
3. Follow the repo's conventions for saving notes. If none exist, use `notes/<project>/<yyyy-mm-dd>-<title>.md`. Tell the user where the file was saved.

## Exploring code repositories

- When answering the user's question requires exploring a code repository, clone it locally and read the relevant source code and documentation to answer the question.
- Store reference repositories at `$HOME/ref/<owner>/<repo>` for reuse across projects. The `<owner>` component distinguishes repositories with the same name owned by different organizations or users. Reuse an existing copy; otherwise, clone it to that location with `git clone <url> <path>`.
- Keep research notes in the current project.
