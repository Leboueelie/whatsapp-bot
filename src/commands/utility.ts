import axios from "axios";
import { config } from "../config";
import type { Command } from "../lib/types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)";

async function translate(text: string, to: string): Promise<string> {
  const url = "https://translate.googleapis.com/translate_a/single";
  const { data } = await axios.get(url, {
    params: { client: "gtx", sl: "auto", tl: to, dt: "t", q: text },
    headers: { "User-Agent": UA },
  });
  return (data[0] as Array<[string]>).map((seg) => seg[0]).join("");
}

async function tts(text: string, lang: string): Promise<Buffer> {
  const url = "https://translate.google.com/translate_tts";
  const { data } = await axios.get(url, {
    params: { ie: "UTF-8", client: "tw-ob", tl: lang, q: text, total: 1, idx: 0 },
    headers: { "User-Agent": UA },
    responseType: "arraybuffer",
  });
  return Buffer.from(data);
}

export const commands: Command[] = [
  {
    name: "tr",
    aliases: ["translate"],
    description: "Traduit un texte (répondre à un message ou .tr [langue] [texte])",
    category: "utility",
    usage: "[langue] [texte]",
    async execute(ctx) {
      let to = "fr";
      let text = ctx.args;
      const quotedText = ctx.msg.message?.extendedTextMessage?.contextInfo?.quotedMessage?.conversation;
      if (!text && quotedText) {
        text = quotedText;
      }
      if (!text) return ctx.reply(`❌ Usage : ${ctx.prefix}tr [langue] [texte]`);
      const langMatch = text.match(/^([a-z]{2,3})\s+(.+)$/i);
      if (langMatch) {
        to = langMatch[1].toLowerCase();
        text = langMatch[2];
      }
      try {
        const out = await translate(text, to);
        await ctx.reply(`🌐 *Traduction (${to})* :\n\n${out}`);
      } catch {
        await ctx.reply("⚠️ Erreur de traduction.");
      }
    },
  },
  {
    name: "tts",
    aliases: ["voice", "say"],
    description: "Convertit un texte en message vocal",
    category: "utility",
    usage: "[langue] [texte]",
    async execute(ctx) {
      let lang = "fr";
      let text = ctx.args;
      const m = text.match(/^([a-z]{2,3})\s+(.+)$/i);
      if (m) {
        lang = m[1].toLowerCase();
        text = m[2];
      }
      if (!text) return ctx.reply(`❌ Usage : ${ctx.prefix}tts [langue] [texte]`);
      try {
        const buf = await tts(text, lang);
        await ctx.sock.sendMessage(ctx.chat, { audio: buf, mimetype: "audio/mpeg", ptt: true }, { quoted: ctx.msg });
      } catch {
        await ctx.reply("⚠️ Erreur de synthèse vocale.");
      }
    },
  },
  {
    name: "google",
    aliases: ["search"],
    description: "Recherche sur le web (DuckDuckGo)",
    category: "utility",
    usage: "[requête]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}google [requête]`);
      try {
        const { data } = await axios.get("https://api.duckduckgo.com/", {
          params: { q: ctx.args, format: "json", no_html: 1, skip_disambig: 1 },
          headers: { "User-Agent": UA },
        });
        const abstract = (data.AbstractText as string) || "";
        const topics = (data.RelatedTopics as Array<{ Text?: string; FirstURL?: string }>)
          .filter((t) => t?.Text)
          .slice(0, 5);
        let out = abstract ? `🔎 *${ctx.args}*\n\n${abstract}\n\n` : `🔎 *${ctx.args}*\n\n`;
        if (topics.length) {
          out += topics.map((t, i) => `${i + 1}. ${t.Text}\n${t.FirstURL}`).join("\n\n");
        } else if (!abstract) {
          out = `Aucun résultat pour "${ctx.args}".`;
        }
        await ctx.reply(out.slice(0, 4000));
      } catch {
        await ctx.reply("⚠️ Erreur de recherche.");
      }
    },
  },
  {
    name: "wiki",
    aliases: ["wikipedia"],
    description: "Recherche sur Wikipédia",
    category: "utility",
    usage: "[titre]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}wiki [titre]`);
      try {
        const { data } = await axios.get(
          `https://fr.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(ctx.args)}`,
          { headers: { "User-Agent": UA } }
        );
        if (!data.extract) return ctx.reply("❌ Page introuvable.");
        await ctx.reply(
          `📚 *${data.title}*\n\n${data.extract}\n\n🔗 ${data.content_urls?.desktop?.page ?? ""}`
        );
      } catch {
        await ctx.reply("⚠️ Erreur Wikipédia.");
      }
    },
  },
  {
    name: "chat",
    aliases: ["ai", "gpt"],
    description: "Discute avec une IA (Gemini/OpenAI)",
    category: "ai",
    usage: "[question]",
    async execute(ctx) {
      if (!ctx.args) return ctx.reply(`❌ Usage : ${ctx.prefix}chat [question]`);
      if (!config.geminiApiKey && !config.openaiApiKey) {
        return ctx.reply(
          "🤖 L'IA n'est pas encore configurée.\nAjoute `GEMINI_API_KEY` ou `OPENAI_API_KEY` dans le fichier `.env`."
        );
      }
      try {
        let answer = "";
        if (config.geminiApiKey) {
          const { data } = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.geminiApiKey}`,
            { contents: [{ parts: [{ text: ctx.args }] }] }
          );
          answer = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Pas de réponse.";
        } else {
          const { data } = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            { model: "gpt-3.5-turbo", messages: [{ role: "user", content: ctx.args }] },
            { headers: { Authorization: `Bearer ${config.openaiApiKey}` } }
          );
          answer = data.choices?.[0]?.message?.content ?? "Pas de réponse.";
        }
        await ctx.reply(`🤖 ${answer}`);
      } catch (e) {
        await ctx.reply(`⚠️ Erreur IA : ${(e as Error).message}`);
      }
    },
  },
];
