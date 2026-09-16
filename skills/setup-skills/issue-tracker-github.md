# Issue tracker: GitHub

Specs (also known as PRDs) for this repo live as GitHub issues. Use the `gh` CLI and infer the repo from the current clone.

## Publish a spec

Create an issue with `gh issue create --title "..." --body "..."`. Use a heredoc for a multi-line body.

## Fetch a spec

Run `gh issue view <number> --comments` to read the full spec and its discussion.

## Continue a spec discussion

Run `gh issue comment <number> --body "..."`.
