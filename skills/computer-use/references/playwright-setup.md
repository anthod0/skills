# Playwright script environment setup

Use this guide to set up Mode B when `$HOME/tools/computer-use` is missing or incomplete. The structure follows the existing local tooling directory. Create only missing content; preserve existing configuration, scripts, and output.

## Check prerequisites

- Bun is available: run `bun --version`.
- System Chromium is installed: use `command -v chromium chromium-browser` to locate it, then confirm the executable path.
- The agent's real user data directory is known. Prefer the existing `~/.playwright/cli.config.json`; alternatively, inspect the running browser's arguments or the "Profile Path" in `chrome://version`. For example, if the profile path ends in `/Default`, use its parent directory as `userDataDir`.
- The current desktop session environment is available through `systemctl --user show-environment`. It must include a display variable (`DISPLAY` or `WAYLAND_DISPLAY`), `XDG_RUNTIME_DIR`, and `DBUS_SESSION_BUS_ADDRESS`.

Resolve device-specific paths locally. If the user data directory is unknown, establish it before proceeding; do not substitute a temporary directory or copied profile. If Bun, system Chromium, or a desktop session is missing, report the missing prerequisite and handle environment installation separately.

## Create directories and install dependencies

For initial setup, run:

```bash
mkdir -p "$HOME/tools/computer-use/scripts" "$HOME/tools/computer-use/outputs"
cd "$HOME/tools/computer-use"
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 bun add playwright
```

Let Bun create or update `package.json` and `bun.lock`; do not edit dependency declarations manually. No test framework or project scaffold is needed. If `package.json` and `bun.lock` already exist and only `node_modules` is missing, restore dependencies by running `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 bun install --frozen-lockfile` in that directory.

Install only the Playwright library and use system Chromium. Do not run `playwright install` or install packages that download browsers. [Playwright library documentation](https://playwright.dev/docs/library)

## Reuse or create shared configuration

`browser.ts` shares `~/.playwright/cli.config.json` with Mode A, avoiding a separate set of browser paths and profile settings.

If the file exists, inspect and reuse its `browser` configuration, preserving other fields. If it is missing, create the parent directory and file using the structure below, replacing all three path placeholders with local absolute paths:

```json
{
  "browser": {
    "browserName": "chromium",
    "isolated": false,
    "userDataDir": "/ABSOLUTE/PATH/TO/USER_DATA_DIR",
    "launchOptions": {
      "executablePath": "/ABSOLUTE/PATH/TO/SYSTEM_CHROMIUM",
      "headless": false,
      "args": [
        "--profile-directory=Default",
        "--ozone-platform=wayland"
      ]
    }
  },
  "outputDir": "/ABSOLUTE/PATH/TO/tools/computer-use/outputs"
}
```

JSON does not expand `~` or `$HOME`; use full paths. `--ozone-platform=wayland` matches this skill's niri/Wayland environment. The script launcher reads the current desktop environment from systemd, so session-specific display numbers and runtime paths do not need to be stored in the configuration.

## Create the shared launcher

If `$HOME/tools/computer-use/browser.ts` is missing, save the following code there. It preserves the existing local launcher's behavior: validate shared configuration, check the browser path, inject the desktop environment, and launch Chromium with a persistent context.

```ts
import { execFileSync } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';
import { chromium } from 'playwright';

const configPath = join(homedir(), '.playwright', 'cli.config.json');
type PersistentOptions = NonNullable<Parameters<typeof chromium.launchPersistentContext>[1]>;

// Read and validate the shared local configuration without launching a browser.
export async function loadBrowserConfig() {
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const browser = config.browser;
  const options: PersistentOptions = browser?.launchOptions ?? {};

  if (
    browser?.browserName !== 'chromium' || browser.isolated !== false ||
    browser.cdpEndpoint || browser.remoteEndpoint ||
    typeof browser.userDataDir !== 'string' || !isAbsolute(browser.userDataDir) ||
    typeof options.executablePath !== 'string' || !isAbsolute(options.executablePath) ||
    options.headless !== false ||
    !options.args?.includes('--profile-directory=Default') ||
    options.args.some(arg => /^--(?:user-data-dir|headless)(?:=|$)/.test(arg)) ||
    options.args.some(arg => arg.startsWith('--profile-directory=') && arg !== '--profile-directory=Default')
  ) {
    throw new Error(`Browser configuration does not meet requirements or is unsupported: ${configPath}`);
  }
  await access(options.executablePath);

  const desktopEnv: Record<string, string> = {};
  const output = execFileSync('systemctl', ['--user', 'show-environment'], { encoding: 'utf8' });
  for (const line of output.split('\n')) {
    if (/^(DISPLAY|WAYLAND_DISPLAY|XDG_RUNTIME_DIR|DBUS_SESSION_BUS_ADDRESS|XAUTHORITY|XDG_CURRENT_DESKTOP)=/.test(line)) {
      const index = line.indexOf('=');
      desktopEnv[line.slice(0, index)] = line.slice(index + 1);
    }
  }
  if (!(desktopEnv.DISPLAY || desktopEnv.WAYLAND_DISPLAY) ||
      !desktopEnv.XDG_RUNTIME_DIR || !desktopEnv.DBUS_SESSION_BUS_ADDRESS) {
    throw new Error('Desktop display, runtime directory, or session bus environment variables are missing');
  }

  return {
    userDataDir: browser.userDataDir as string,
    options: {
      ...browser.contextOptions,
      ...options,
      env: { ...process.env, ...options.env, ...desktopEnv },
    } as PersistentOptions,
  };
}

// Call only when no other browser session is using this user data directory.
export async function launchBrowser() {
  const { userDataDir, options } = await loadBrowserConfig();
  return chromium.launchPersistentContext(userDataDir, options);
}
```

This launcher supports only the local persistent Chromium configuration used by this skill, not every CLI configuration mode. `launchBrowser()` creates a browser process; it does not attach to an existing CLI session or check whether the profile is already in use.

If the browser is already open, reuse its existing controller session. Do not invoke the launcher again, delete profile lock files, or create an isolated profile. Playwright does not support multiple browser instances using the same user data directory simultaneously. [Persistent context documentation](https://playwright.dev/docs/api/class-browsertype#browser-type-launch-persistent-context)

## Verify the setup

First, check dependencies and configuration from the tooling directory without launching a browser:

```bash
cd "$HOME/tools/computer-use"
bun -e 'import { chromium } from "playwright"; console.log(chromium.name())'
bun -e 'import { loadBrowserConfig } from "./browser"; await loadBrowserConfig(); console.log("Configuration OK")'
```

After the checks pass, the directory should contain:

```text
$HOME/tools/computer-use/
├── package.json
├── bun.lock
├── node_modules/
├── browser.ts
├── scripts/
└── outputs/
```

These checks confirm that dependencies load, configuration meets the requirements, the browser path exists, and desktop environment variables are present. They do not verify that the browser can launch or that the profile is available.

Place subsequent scripts in `scripts/`, import `launchBrowser()` from `../browser`, and run them from the tooling directory with `bun run scripts/<name>.ts`. Explicitly direct screenshots and other generated output to `outputs/`; the CLI's `outputDir` does not automatically apply to Playwright scripts.
