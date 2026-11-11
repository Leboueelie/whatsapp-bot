import type { Command } from "../lib/types";
import { getQuoted, downloadMsgMedia } from "../lib/message";
import { imageToSticker, videoToSticker, textToSticker, stickerToImage } from "../lib/sticker";

export const commands: Command[] = [
  {
    name: "sticker",
    aliases: ["s", "stick"],
    description: "Transforme une image/vidéo en sticker (ou en réponse à un média)",
    category: "sticker",
    usage: "(répondre à une image/vidéo)",
    async execute(ctx) {
      const quoted = getQuoted(ctx.msg);
      const source = quoted?.message ? quoted : ctx.msg;
      const m = source.message;
      if (!m?.imageMessage && !m?.videoMessage) {
        return ctx.reply("❌ Envoie une image ou vidéo, ou réponds-y avec .sticker");
      }
      await ctx.react("⏳");
      const buf = await downloadMsgMedia(source, ctx.sock);
      if (!buf) return ctx.reply("❌ Impossible de télécharger ce média.");
      try {
        const webp = m.imageMessage
          ? await imageToSticker(buf)
          : await videoToSticker(buf);
        await ctx.sock.sendMessage(ctx.chat, { sticker: webp }, { quoted: ctx.msg });
      } catch (e) {
        await ctx.reply(`⚠️ ${(e as Error).message}`);
      }
    },
  },
  {
    name: "qsticker",
    aliases: ["qs", "textsticker"],
    description: "Crée un sticker à partir d'un texte",
    category: "sticker",
    usage: "[texte]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}qsticker [texte]`);
      const webp = await textToSticker(ctx.args, ctx.pushName);
      await ctx.sock.sendMessage(ctx.chat, { sticker: webp }, { quoted: ctx.msg });
    },
  },
  {
    name: "toimg",
    aliases: ["sticker2img"],
    description: "Convertit un sticker en image",
    category: "sticker",
    usage: "(répondre à un sticker)",
    async execute(ctx) {
      const quoted = getQuoted(ctx.msg);
      const source = quoted?.message ? quoted : ctx.msg;
      if (!source.message?.stickerMessage) return ctx.reply("❌ Réponds à un sticker avec .toimg");
      const buf = await downloadMsgMedia(source, ctx.sock);
      if (!buf) return ctx.reply("❌ Impossible de télécharger ce sticker.");
      const img = await stickerToImage(buf);
      await ctx.sock.sendMessage(ctx.chat, { image: img }, { quoted: ctx.msg });
    },
  },
];
