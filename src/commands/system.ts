import os from "os";
import { config } from "../config";
import { clearSession } from "../lib/session";
import { formatBytes, formatUptime } from "../lib/utils";
import type { Command } from "../lib/types";

const startedAt = Date.now();

export const commands: Command[] = [
  {
    name: "ping",
    description: "Vérifie la latence du bot",
    category: "system",
    async execute(ctx) {
      const start = Date.now();
      const sent = await ctx.reply("📡 Pong !");
      const latency = Date.now() - start;
      const uptime = formatUptime(Date.now() - startedAt);
      await ctx.sock.sendMessage(ctx.chat, {
        text: `🏓 *Pong !*\n⏱️ Latence : ${latency}ms\n⏳ Uptime : ${uptime}`,
        edit: (sent as { key?: unknown })?.key as never,
      });
    },
  },
  {
    name: "uptime",
    description: "Temps de fonctionnement",
    category: "system",
    async execute(ctx) {
      const total = os.totalmem();
      const free = os.freemem();
      await ctx.reply(
        `⏳ *Uptime* : ${formatUptime(Date.now() - startedAt)}\n` +
          `💾 *RAM* : ${formatBytes(total - free)} / ${formatBytes(total)}`
      );
    },
  },
  {
    name: "restart",
    description: "Redémarre le bot",
    category: "system",
    isOwner: true,
    async execute(ctx) {
      await ctx.reply("♻️ Redémarrage en cours...");
      setTimeout(() => process.exit(0), 800);
    },
  },
  {
    name: "logout",
    aliases: ["disconnect"],
    description: "Déconnecte la session (supprime les identifiants)",
    category: "system",
    isOwner: true,
    async execute(ctx) {
      await ctx.reply("👋 Déconnexion et suppression de la session...");
      clearSession();
      setTimeout(() => process.exit(0), 800);
    },
  },
  {
    name: "info",
    description: "Infos sur le bot",
    category: "system",
    async execute(ctx) {
      const owner = config.ownerNumbers.join(", ") || "Tous";
      await ctx.reply(
        `🤖 *${config.botName}*\n` +
          `🏷️ Préfixe : ${config.prefix}\n` +
          `👤 Propriétaire : ${owner}\n` +
          `⚙️ Node : ${process.version}\n` +
          `🖥️ Plateforme : ${process.platform}`
      );
    },
  },
];
