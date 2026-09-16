# Issue tracker: GitLab

Specs (also known as PRDs) for this repo live as GitLab issues. Use the [`glab`](https://gitlab.com/gitlab-org/cli) CLI and infer the repo from the current clone.

## Publish a spec

Create an issue with `glab issue create --title "..." --description "..."`. Use a heredoc for a multi-line description.

## Fetch a spec

Run `glab issue view <number> --comments` to read the full spec and its discussion. Use `-F json` when machine-readable output is needed.

## Continue a spec discussion

Run `glab issue note <number> --message "..."`.
