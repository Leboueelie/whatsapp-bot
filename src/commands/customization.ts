import fs from "fs";
import path from "path";
import { config } from "../config";
import { setSetting, getSetting } from "../database";
import { getQuoted, downloadMsgMedia } from "../lib/message";
import type { Command } from "../lib/types";

export const commands: Command[] = [
  {
    name: "setprefix",
    description: "Change le préfixe des commandes",
    category: "customization",
    isOwner: true,
    usage: "[symbole]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}setprefix [symbole]`);
      const p = ctx.args.trim().split(/\s+/)[0];
      if (p.length > 3) return ctx.reply("❌ Préfixe trop long (max 3 caractères).");
      setSetting("prefix", p);
      config.prefix = p;
      await ctx.reply(`✅ Préfixe défini sur : *${p}*`);
    },
  },
  {
    name: "setname",
    aliases: ["setbotname"],
    description: "Change le nom du bot",
    category: "customization",
    isOwner: true,
    usage: "[nom]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}setname [nom]`);
      setSetting("botname", ctx.args.trim());
      config.botName = ctx.args.trim();
      await ctx.reply(`✅ Nom du bot défini sur : *${ctx.args.trim()}*`);
    },
  },
  {
    name: "setmenuimage",
    aliases: ["setmenu"],
    description: "Définit l'image du menu (répondre à une image)",
    category: "customization",
    isOwner: true,
    usage: "(répondre à une image)",
    async execute(ctx) {
      const quoted = getQuoted(ctx.msg);
      const source = quoted?.message ? quoted : ctx.msg;
      if (!source.message?.imageMessage)
        return ctx.reply("❌ Réponds à une image avec .setmenuimage");
      const buf = await downloadMsgMedia(source, ctx.sock);
      if (!buf) return ctx.reply("❌ Impossible de télécharger l'image.");
      const dest = path.join(config.sessionDir, "menuimage.jpg");
      fs.writeFileSync(dest, buf);
      setSetting("menuimage", dest);
      await ctx.reply("✅ Image du menu mise à jour !");
    },
  },
  {
    name: "delmenuimage",
    description: "Supprime l'image du menu",
    category: "customization",
    isOwner: true,
    async execute(ctx) {
      setSetting("menuimage", "");
      await ctx.reply("✅ Image du menu supprimée.");
    },
  },
];
