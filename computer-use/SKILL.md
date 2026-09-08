---
name: computer-use
description: User requirements for browser automation with system Chromium on desktops.
---

## Environment

- Devices use niri and agent-dedicated system Chromium; do not download Playwright browsers.
- Use the real persistent user data directory and `Default` profile, preserving logins; do not substitute an isolated context or copied profile.
- Resolve device-specific paths locally rather than recording them in this skill.
- Obtain the current desktop session environment from `systemctl --user show-environment` and apply the relevant variables when launching Chromium.

## Usage

### Mode A: playwright-cli

Use this mode for browser automation through the globally installed CLI.

- Run `playwright-cli` directly from the current working directory.
- It automatically loads `~/.playwright/cli.config.json`, which contains local browser, profile, output paths, and launch settings.

### Mode B: Playwright scripts

Use this mode when automation requires a custom script.

- Work in `$HOME/tools/computer-use`, which contains the installed local `playwright` dependency.
- Use the shared launcher: `browser.ts` exports `launchBrowser()`.
- Use Bun to manage dependencies and execute scripts.
- Keep tooling and generated output outside application projects.

## Precautions

- Required launch settings for both CLI and scripts, including any configuration overrides:
  - `executablePath`: locally resolved system Chromium.
  - `headless: false`.
  - `args: ['--profile-directory=Default']`.
  - `ignoreDefaultArgs: ['--password-store=basic', '--use-mock-keychain']`.
- `ignoreDefaultArgs` must include both `--password-store=basic` and `--use-mock-keychain` so Chromium uses the desktop's normal keyring backend. Omitting these exclusions may cause permanent loss of browser login state.
- Reuse the existing agent session across turns. Do not launch competing processes against its profile, remove profile locks, or kill an existing browser without approval.
- Profile writes inherent in browsing are expected; unrelated account changes or destructive actions are not implicitly authorized.
