---
name: computer-use
description: Automate browsers with system Chromium and operate native apps, windows, and desktop UI on niri/Wayland.
---

## Environment

- Devices use niri and agent-dedicated system Chromium; do not download Playwright browsers.
- Obtain the current desktop session environment from `systemctl --user show-environment` and pass the relevant variables to browser and desktop commands.
- Keep tooling and generated output outside application projects; use `$HOME/tools/computer-use` for local tooling.

## Usage

### Mode A: playwright-cli

- Run `playwright-cli` directly from the current working directory.
- It automatically loads `~/.playwright/cli.config.json`, which contains local browser, profile, output paths, and launch settings.

### Mode B: Playwright scripts

- Work in `$HOME/tools/computer-use`, which contains the installed local `playwright` dependency.
- Use the shared launcher: `browser.ts` exports `launchBrowser()`.
- Use Bun to manage dependencies and execute scripts.
- If `$HOME/tools/computer-use`, its dependencies, or the shared launcher are missing, follow [Script environment setup](references/playwright-setup.md) first.

### Mode C: Native desktop

Use `niri msg` to query windows, change focus, and take screenshots; `ydotool` for mouse and keyboard input; and `wl-copy` to help enter Unicode text.

- `niri msg` requires the correct `NIRI_SOCKET` in its environment. Reuse an inherited value; obtain it from the current desktop session if missing or stale.
- `ydotool` requires the correct `YDOTOOL_SOCKET` in its environment. Reuse an inherited value; obtain it from the current desktop session if missing or stale.
- niri screenshot paths must be absolute. Confirm the file is ready before reading it, and use a fresh path for each capture to avoid reading an old image.
- niri screenshots overwrite the clipboard.

## Browser requirements

- Use the real persistent user data directory and `Default` profile, preserving logins; do not substitute an isolated context or copied profile.
- Required launch settings for both CLI and scripts, including any configuration overrides:
  - `executablePath`: the locally resolved system Chromium path.
  - `headless: false`.
  - `args: ['--profile-directory=Default']`.
- If the browser is already open, reuse it.

## Scope

- Profile writes inherent in browsing are expected; unrelated account changes or destructive actions are not implicitly authorized.
