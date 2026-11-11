import { addSudo, removeSudo, listSudo } from "../database";
import type { Command } from "../lib/types";

export const commands: Command[] = [
  {
    name: "addsudo",
    description: "Ajoute un administrateur du bot",
    category: "system",
    isOwner: true,
    usage: "[numéro]",
    async execute(ctx) {
      const target = (ctx.args.match(/\d+/) ?? [])[0];
      if (!target) {
        const quoted = ctx.msg.message?.extendedTextMessage?.contextInfo?.participant;
        const num = (quoted ?? "").split("@")[0];
        if (!num) return ctx.reply("❌ Usage : .addsudo [numéro]");
        addSudo(`${num}@s.whatsapp.net`);
        return ctx.reply(`✅ ${num} ajouté comme admin du bot.`);
      }
      addSudo(`${target}@s.whatsapp.net`);
      await ctx.reply(`✅ ${target} ajouté comme admin du bot.`);
    },
  },
  {
    name: "delsudo",
    aliases: ["rmsudo"],
    description: "Retire un administrateur du bot",
    category: "system",
    isOwner: true,
    usage: "[numéro]",
    async execute(ctx) {
      const target = (ctx.args.match(/\d+/) ?? [])[0];
      if (!target) return ctx.reply("❌ Usage : .delsudo [numéro]");
      removeSudo(`${target}@s.whatsapp.net`);
      await ctx.reply(`✅ ${target} retiré des admins du bot.`);
    },
  },
  {
    name: "listsudo",
    description: "Liste les administrateurs du bot",
    category: "system",
    isOwner: true,
    async execute(ctx) {
      const list = listSudo();
      if (!list.length) return ctx.reply("Aucun admin supplémentaire.");
      await ctx.reply(`👑 *Admins du bot* :\n${list.map((j) => `• ${j.split("@")[0]}`).join("\n")}`);
    },
  },
];
