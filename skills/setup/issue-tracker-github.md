# Issue tracker: GitHub

Specs (also known as PRDs) for this repo live as GitHub issues. Use the `gh` CLI and infer the repo from the current clone.

## Spec status

Record `Status: <value>` near the top of the issue body:

- `draft` — new spec or requirements under discussion.
- `confirmed` — explicitly confirmed by the user, ready for implementation.
- `completed` — implemented, validated, and acceptance criteria met.

## Publish a spec

Create an issue with `gh issue create --title "..." --body "..."`. Use a heredoc for a multi-line body.

## Fetch a spec

Run `gh issue view <number> --comments` to read the full spec and its discussion.

## Continue a spec discussion

Run `gh issue comment <number> --body "..."`.
