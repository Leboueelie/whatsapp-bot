import { config } from "../config";
import { listCommands } from "../lib/command";
import { getSetting } from "../database";
import { formatUptime } from "../lib/utils";
import type { Command } from "../lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  system: "⚙️ Système",
  downloader: "📥 Téléchargement",
  group: "👥 Groupe",
  sticker: "🎨 Stickers",
  moderation: "🛡️ Modération",
  customization: "✨ Personnalisation",
  utility: "🧰 Utilitaires",
  ai: "🤖 IA",
};

const CATEGORY_ORDER = [
  "downloader",
  "group",
  "moderation",
  "sticker",
  "utility",
  "customization",
  "system",
  "ai",
];

export function buildMenu(): string {
  const all = listCommands();
  const byCat = new Map<string, Command[]>();
  for (const c of all) {
    const arr = byCat.get(c.category) ?? [];
    arr.push(c);
    byCat.set(c.category, arr);
  }

  const lines: string[] = [];
  lines.push(`*${config.botName}*`);
  lines.push(`🤖 Bot WhatsApp personnel & modulaire`);
  lines.push(`━━━━━━━━━━━━━━━`);
  lines.push(`🏷️ Préfixe : ${config.prefix}`);
  lines.push(`⏱️ Uptime : ${formatUptime(process.uptime() * 1000)}`);
  lines.push(`━━━━━━━━━━━━━━━`);

  for (const cat of CATEGORY_ORDER) {
    const cmds = byCat.get(cat);
    if (!cmds?.length) continue;
    lines.push("");
    lines.push(`*${CATEGORY_LABELS[cat] ?? cat}*`);
    for (const c of cmds) {
      lines.push(`${config.prefix}${c.name}${c.usage ? ` ${c.usage}` : ""}`);
    }
  }
  lines.push("");
  lines.push("━━━━━━━━━━━━━━━");
  lines.push("Envoyez la commande sans argument pour plus de détails.");
  return lines.join("\n");
}

export const command: Command = {
  name: "menu",
  aliases: ["help", "cmds"],
  description: "Affiche la liste des commandes",
  category: "system",
  async execute(ctx) {
    const imagePath = getSetting("menuimage", "");
    if (imagePath) {
      try {
        const { default: fs } = await import("fs");
        if (fs.existsSync(imagePath)) {
          await ctx.sock.sendMessage(ctx.chat, { image: { url: imagePath }, caption: buildMenu() });
          return;
        }
      } catch {
        /* fallback */
      }
    }
    await ctx.reply(buildMenu());
  },
};
