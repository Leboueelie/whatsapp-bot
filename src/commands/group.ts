import type { Command } from "../lib/types";

function getTargetJid(ctx: Parameters<Command["execute"]>[0]): string | null {
  const mentions = ctx.msg.message?.extendedTextMessage?.contextInfo?.mentionedJid;
  if (mentions?.length) return mentions[0];
  const quoted = ctx.msg.message?.extendedTextMessage?.contextInfo?.participant;
  if (quoted) return quoted;
  const num = (ctx.args.match(/\d+/) ?? [])[0];
  if (num) return `${num}@s.whatsapp.net`;
  return null;
}

async function isAdmin(ctx: Parameters<Command["execute"]>[0]): Promise<boolean> {
  if (ctx.isOwner || ctx.isSudo) return true;
  const meta = await ctx.sock.groupMetadata(ctx.chat);
  return meta.participants.some(
    (p) => p.id === ctx.sender && (p.admin === "admin" || p.admin === "superadmin")
  );
}

export const commands: Command[] = [
  {
    name: "add",
    description: "Ajoute un membre au groupe",
    category: "group",
    groupOnly: true,
    usage: "[numéro]",
    async execute(ctx) {
      if (!(await isAdmin(ctx))) return ctx.reply("❌ Admin de groupe requis.");
      const target = getTargetJid(ctx);
      if (!target) return ctx.reply(`❌ Usage : ${ctx.prefix}add [numéro]`);
      await ctx.sock.groupParticipantsUpdate(ctx.chat, [target], "add");
      await ctx.reply(`✅ @${target.split("@")[0]} ajouté.`);
    },
  },
  {
    name: "kick",
    aliases: ["remove", "rm"],
    description: "Expulse un membre du groupe",
    category: "group",
    groupOnly: true,
    usage: "[numéro]",
    async execute(ctx) {
      if (!(await isAdmin(ctx))) return ctx.reply("❌ Admin de groupe requis.");
      const target = getTargetJid(ctx);
      if (!target) return ctx.reply(`❌ Usage : ${ctx.prefix}kick [numéro]`);
      await ctx.sock.groupParticipantsUpdate(ctx.chat, [target], "remove");
      await ctx.reply(`👢 @${target.split("@")[0]} expulsé.`);
    },
  },
  {
    name: "promote",
    aliases: ["admin"],
    description: "Promeut un membre en admin",
    category: "group",
    groupOnly: true,
    usage: "[numéro]",
    async execute(ctx) {
      if (!(await isAdmin(ctx))) return ctx.reply("❌ Admin de groupe requis.");
      const target = getTargetJid(ctx);
      if (!target) return ctx.reply(`❌ Usage : ${ctx.prefix}promote [numéro]`);
      await ctx.sock.groupParticipantsUpdate(ctx.chat, [target], "promote");
      await ctx.reply(`👑 @${target.split("@")[0]} promu admin.`);
    },
  },
  {
    name: "demote",
    description: "Rétrograde un admin en membre",
    category: "group",
    groupOnly: true,
    usage: "[numéro]",
    async execute(ctx) {
      if (!(await isAdmin(ctx))) return ctx.reply("❌ Admin de groupe requis.");
      const target = getTargetJid(ctx);
      if (!target) return ctx.reply(`❌ Usage : ${ctx.prefix}demote [numéro]`);
      await ctx.sock.groupParticipantsUpdate(ctx.chat, [target], "demote");
      await ctx.reply(`⬇️ @${target.split("@")[0]} rétrogradé.`);
    },
  },
  {
    name: "tagall",
    aliases: ["everyone", "mentionall"],
    description: "Mentionne tous les membres du groupe",
    category: "group",
    groupOnly: true,
    usage: "[message]",
    async execute(ctx) {
      const meta = await ctx.sock.groupMetadata(ctx.chat);
      const mentions = meta.participants.map((p) => p.id);
      const text = ctx.args || "Attention à tous ! 📢";
      await ctx.sock.sendMessage(
        ctx.chat,
        { text: `${text}\n\n${mentions.map((m) => `@${m.split("@")[0]}`).join(" ")}`, mentions },
        { quoted: ctx.msg }
      );
    },
  },
  {
    name: "hidetag",
    aliases: ["ht"],
    description: "Mentionne tous les membres (sans les afficher)",
    category: "group",
    groupOnly: true,
    usage: "[message]",
    async execute(ctx) {
      if (!(await isAdmin(ctx))) return ctx.reply("❌ Admin de groupe requis.");
      const meta = await ctx.sock.groupMetadata(ctx.chat);
      const mentions = meta.participants.map((p) => p.id);
      const text = ctx.args || "📢";
      await ctx.sock.sendMessage(ctx.chat, { text, mentions }, { quoted: ctx.msg });
    },
  },
  {
    name: "link",
    aliases: ["grouplink", "invite"],
    description: "Récupère le lien d'invitation du groupe",
    category: "group",
    groupOnly: true,
    async execute(ctx) {
      if (!(await isAdmin(ctx))) return ctx.reply("❌ Admin de groupe requis.");
      const code = await ctx.sock.groupInviteCode(ctx.chat);
      await ctx.reply(`🔗 Lien du groupe :\nhttps://chat.whatsapp.com/${code}`);
    },
  },
  {
    name: "leave",
    aliases: ["quit"],
    description: "Fait quitter le groupe au bot",
    category: "group",
    groupOnly: true,
    isOwner: true,
    async execute(ctx) {
      await ctx.reply("👋 Au revoir !");
      await ctx.sock.groupLeave(ctx.chat);
    },
  },
  {
    name: "groupinfo",
    aliases: ["gcinfo"],
    description: "Infos sur le groupe",
    category: "group",
    groupOnly: true,
    async execute(ctx) {
      const meta = await ctx.sock.groupMetadata(ctx.chat);
      const admins = meta.participants
        .filter((p) => p.admin)
        .map((p) => `@${p.id.split("@")[0]}`)
        .join(", ");
      await ctx.reply(
        `👥 *${meta.subject}*\n` +
          `👤 Créé par : @${meta.owner?.split("@")[0] ?? "?"}\n` +
          `🔢 Membres : ${meta.participants.length}\n` +
          `👑 Admins : ${admins || "—"}\n` +
          `📝 Description : ${meta.desc || "—"}`
      );
    },
  },
];
