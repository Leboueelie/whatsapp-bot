import fs from "fs";
import type { Command } from "../lib/types";
import {
  downloadVideo,
  downloadAudio,
  searchSong,
  searchVideo,
  cleanupFile,
  isYtdlpAvailable,
} from "../lib/downloader";

async function ensureYtdlp(ctx: Parameters<Command["execute"]>[0]): Promise<boolean> {
  if (await isYtdlpAvailable()) return true;
  await ctx.reply(
    "❌ `yt-dlp` n'est pas installé.\nInstalle-le avec :\n`pip install yt-dlp` ou `apt install yt-dlp`"
  );
  return false;
}

function readFile(path: string): Buffer {
  return fs.readFileSync(path);
}

export const commands: Command[] = [
  {
    name: "yt",
    aliases: ["video", "ytv", "play"],
    description: "Télécharge une vidéo YouTube (lien ou recherche)",
    category: "downloader",
    usage: "[lien ou titre]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}yt [lien]`);
      if (!(await ensureYtdlp(ctx))) return;
      await ctx.react("⏳");
      await ctx.reply("📥 Téléchargement en cours...");
      try {
        const url = /^https?:\/\//i.test(ctx.args) ? ctx.args : `ytsearch1:${ctx.args}`;
        const res = await (url.startsWith("ytsearch1:")
          ? searchVideo(ctx.args)
          : downloadVideo(url));
        const buf = readFile(res.path);
        await ctx.sock.sendMessage(
          ctx.chat,
          { video: buf, mimetype: "video/mp4", caption: `🎬 *${res.title}*` },
          { quoted: ctx.msg }
        );
        cleanupFile(res.path);
      } catch (e) {
        await ctx.reply(`⚠️ ${(e as Error).message}`);
      }
    },
  },
  {
    name: "song",
    aliases: ["audio", "music", "yta"],
    description: "Recherche et envoie une musique (audio)",
    category: "downloader",
    usage: "[titre]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}song [titre]`);
      if (!(await ensureYtdlp(ctx))) return;
      await ctx.react("⏳");
      await ctx.reply("🎵 Recherche de la musique...");
      try {
        const res = await searchSong(ctx.args);
        const buf = readFile(res.path);
        await ctx.sock.sendMessage(
          ctx.chat,
          { audio: buf, mimetype: "audio/mpeg", fileName: `${res.title}.mp3` },
          { quoted: ctx.msg }
        );
        cleanupFile(res.path);
      } catch (e) {
        await ctx.reply(`⚠️ ${(e as Error).message}`);
      }
    },
  },
  {
    name: "insta",
    aliases: ["instagram", "ig", "reel"],
    description: "Télécharge un post/reel/story Instagram",
    category: "downloader",
    usage: "[lien]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}insta [lien]`);
      if (!(await ensureYtdlp(ctx))) return;
      await ctx.react("⏳");
      await ctx.reply("📥 Téléchargement Instagram...");
      try {
        const res = await downloadVideo(ctx.args);
        const buf = readFile(res.path);
        await ctx.sock.sendMessage(
          ctx.chat,
          { video: buf, mimetype: "video/mp4", caption: `📸 *${res.title}*` },
          { quoted: ctx.msg }
        );
        cleanupFile(res.path);
      } catch (e) {
        await ctx.reply(`⚠️ ${(e as Error).message}`);
      }
    },
  },
  {
    name: "tiktok",
    aliases: ["tt", "ttdl"],
    description: "Télécharge une vidéo TikTok (sans watermark)",
    category: "downloader",
    usage: "[lien]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}tiktok [lien]`);
      if (!(await ensureYtdlp(ctx))) return;
      await ctx.react("⏳");
      await ctx.reply("📥 Téléchargement TikTok...");
      try {
        const res = await downloadVideo(ctx.args);
        const buf = readFile(res.path);
        await ctx.sock.sendMessage(
          ctx.chat,
          { video: buf, mimetype: "video/mp4", caption: `🎵 *${res.title}*` },
          { quoted: ctx.msg }
        );
        cleanupFile(res.path);
      } catch (e) {
        await ctx.reply(`⚠️ ${(e as Error).message}`);
      }
    },
  },
  {
    name: "spotify",
    aliases: ["sp", "spotifydl"],
    description: "Télécharge une piste/playlist Spotify (audio)",
    category: "downloader",
    usage: "[lien]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}spotify [lien]`);
      if (!(await ensureYtdlp(ctx))) return;
      await ctx.react("⏳");
      await ctx.reply("🎧 Téléchargement Spotify...");
      try {
        const res = await downloadAudio(ctx.args);
        const buf = readFile(res.path);
        await ctx.sock.sendMessage(
          ctx.chat,
          { audio: buf, mimetype: "audio/mpeg", fileName: `${res.title}.mp3` },
          { quoted: ctx.msg }
        );
        cleanupFile(res.path);
      } catch (e) {
        await ctx.reply(`⚠️ ${(e as Error).message}`);
      }
    },
  },
  {
    name: "fb",
    aliases: ["facebook", "fbdl"],
    description: "Télécharge une vidéo Facebook",
    category: "downloader",
    usage: "[lien]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}fb [lien]`);
      if (!(await ensureYtdlp(ctx))) return;
      await ctx.react("⏳");
      await ctx.reply("📥 Téléchargement Facebook...");
      try {
        const res = await downloadVideo(ctx.args);
        const buf = readFile(res.path);
        await ctx.sock.sendMessage(
          ctx.chat,
          { video: buf, mimetype: "video/mp4", caption: `📘 *${res.title}*` },
          { quoted: ctx.msg }
        );
        cleanupFile(res.path);
      } catch (e) {
        await ctx.reply(`⚠️ ${(e as Error).message}`);
      }
    },
  },
  {
    name: "twitter",
    aliases: ["x", "twdl", "xdl"],
    description: "Télécharge une vidéo Twitter/X",
    category: "downloader",
    usage: "[lien]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}twitter [lien]`);
      if (!(await ensureYtdlp(ctx))) return;
      await ctx.react("⏳");
      await ctx.reply("📥 Téléchargement Twitter/X...");
      try {
        const res = await downloadVideo(ctx.args);
        const buf = readFile(res.path);
        await ctx.sock.sendMessage(
          ctx.chat,
          { video: buf, mimetype: "video/mp4", caption: `🐦 *${res.title}*` },
          { quoted: ctx.msg }
        );
        cleanupFile(res.path);
      } catch (e) {
        await ctx.reply(`⚠️ ${(e as Error).message}`);
      }
    },
  },
  {
    name: "pinterest",
    aliases: ["pin", "pindl"],
    description: "Télécharge une image/vidéo Pinterest",
    category: "downloader",
    usage: "[lien]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}pinterest [lien]`);
      if (!(await ensureYtdlp(ctx))) return;
      await ctx.react("⏳");
      await ctx.reply("📥 Téléchargement Pinterest...");
      try {
        const res = await downloadVideo(ctx.args);
        const buf = readFile(res.path);
        await ctx.sock.sendMessage(
          ctx.chat,
          { video: buf, mimetype: "video/mp4", caption: `📌 *${res.title}*` },
          { quoted: ctx.msg }
        );
        cleanupFile(res.path);
      } catch (e) {
        await ctx.reply(`⚠️ ${(e as Error).message}`);
      }
    },
  },
];
