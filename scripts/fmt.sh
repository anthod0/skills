#!/usr/bin/env bash
set -euo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.."
# Svelte formatting needs its compiler alongside Oxfmt; keep both in the tool cache.
exec npm exec --yes --ignore-scripts \
  --package=oxfmt@0.67.0 --package=svelte@5.57.0 -- \
  oxfmt .oxfmtrc.json 'evals/runner/*.mjs' \
  'evals/fixtures/{ssh-hosts,replydesk}/**/*.{ts,js,json,svelte,css,html,md}' "$@"
