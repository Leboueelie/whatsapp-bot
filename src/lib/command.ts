import fs from "fs";
import path from "path";
import type { Command } from "./types";

const commands = new Map<string, Command>();
const cooldowns = new Map<string, number>();

export function registerCommand(cmd: Command): void {
  commands.set(cmd.name.toLowerCase(), cmd);
  for (const alias of cmd.aliases ?? []) {
    commands.set(alias.toLowerCase(), cmd);
  }
}

export function getCommand(name: string): Command | undefined {
  return commands.get(name.toLowerCase());
}

export function listCommands(): Command[] {
  return [...new Set(commands.values())];
}

export function loadCommands(): void {
  const dir = path.join(__dirname, "..", "commands");
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".ts") || f.endsWith(".js"));
  for (const file of files) {
    try {
      const mod = require(path.join(dir, file)) as {
        default?: Command | Command[];
        command?: Command | Command[];
        commands?: Command[];
      };
      const cmds = mod.commands ?? mod.default ?? mod.command;
      for (const cmd of Array.isArray(cmds) ? cmds : [cmds]) {
        if (cmd?.name) registerCommand(cmd);
      }
    } catch (e) {
      console.error(`Failed to load command ${file}:`, (e as Error).message);
    }
  }
}

export function isOnCooldown(user: string, cmd: Command): number {
  if (!cmd.cooldown) return 0;
  const key = `${cmd.name}:${user}`;
  const now = Date.now();
  const last = cooldowns.get(key) ?? 0;
  const remain = last + cmd.cooldown * 1000 - now;
  if (remain > 0) return remain;
  cooldowns.set(key, now);
  return 0;
}
