#!/usr/bin/env node
import { homedir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { listHosts, type HostOptions } from "./config.js";
import { editConfig, readConfig } from "./store.js";

const program = new Command()
  .name("ssh-hosts")
  .description("Manage host aliases in your SSH config")
  .version("0.1.0")
  .option("-f, --config <path>", "SSH config file", join(homedir(), ".ssh", "config"));

const configPath = (): string => program.opts<{ config: string }>().config;

function hostOptions(command: Command) {
  return command
    .option("-u, --user <name>", "login user")
    .option("-p, --port <number>", "SSH port")
    .option("-i, --identity <path>", "identity file path (the file is not opened)");
}

program
  .command("list")
  .description("List single-alias entries in this file, without resolving SSH defaults")
  .action(async () => {
    const hosts = listHosts(await readConfig(configPath()));
    if (!hosts.length) {
      console.log("No host aliases found.");
      return;
    }
    const width = Math.max(5, ...hosts.map((host) => host.alias.length));
    for (const host of hosts) {
      const address = host.host ?? host.alias;
      const target = host.user ? `${host.user}@${address}` : address;
      console.log(`${host.alias.padEnd(width)}  ${target}  ${host.port ?? "—"}`);
    }
  });

hostOptions(
  program
    .command("add <alias>")
    .description("Add a host alias")
    .requiredOption("-h, --host <hostname>", "hostname or IP address"),
).action(async (alias: string, options: HostOptions) => {
  await editConfig(configPath(), { kind: "add", alias, options });
  console.log(`Added ${alias}.`);
});

hostOptions(
  program
    .command("set <alias>")
    .description("Change connection options for a host")
    .option("-h, --host <hostname>", "hostname or IP address"),
).action(async (alias: string, options: HostOptions) => {
  await editConfig(configPath(), { kind: "set", alias, options });
  console.log(`Updated ${alias}.`);
});

program
  .command("rename <alias> <new-alias>")
  .description("Rename a host alias")
  .action(async (alias: string, to: string) => {
    await editConfig(configPath(), { kind: "rename", alias, to });
    console.log(`Renamed ${alias} to ${to}.`);
  });

program
  .command("remove <alias>")
  .description("Remove a host block")
  .action(async (alias: string) => {
    await editConfig(configPath(), { kind: "remove", alias });
    console.log(`Removed ${alias}.`);
  });

try {
  await program.parseAsync();
} catch (error) {
  console.error(`ssh-hosts: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
