import {
  setGroupSetting,
  getGroupSettings,
  getSpamSettings,
  setSpamSetting,
  addSpamWord,
  removeSpamWord,
  listSpamWords,
  addWhitelistDomain,
  removeWhitelistDomain,
  listWhitelistDomains,
} from "../database";
import type { Command } from "../lib/types";

export const commands: Command[] = [
  {
    name: "antilink",
    description: "Active/désactive la détection de liens",
    category: "moderation",
    groupOnly: true,
    usage: "on/off/whitelist add|remove|list <domaine>",
    async execute(ctx) {
      const [sub, ...rest] = ctx.args.split(/\s+/);
      const subLower = (sub ?? "").toLowerCase();
      const groupJid = ctx.chat;

      if (subLower === "on" || subLower === "off") {
        setGroupSetting(groupJid, "antilink", subLower === "on");
        return ctx.reply(`🛡️ Antilink : *${subLower.toUpperCase()}*`);
      }

      if (subLower === "whitelist") {
        const action = (rest[0] ?? "").toLowerCase();
        const domain = (rest[1] ?? "").toLowerCase();

        if (action === "add" && domain) {
          addWhitelistDomain(groupJid, domain);
          return ctx.reply(`✅ *${domain}* ajouté à la whitelist.`);
        }
        if (action === "remove" && domain) {
          const removed = removeWhitelistDomain(groupJid, domain);
          return ctx.reply(removed ? `✅ *${domain}* supprimé.` : `❌ *${domain}* pas trouvé.`);
        }
        if (action === "list") {
          const list = listWhitelistDomains(groupJid);
          return ctx.reply(
            list.length > 0
              ? `📋 *Whitelist antilink* :\n${list.map((d) => `• ${d}`).join("\n")}`
              : `📋 Aucun domaine whitelisté.`
          );
        }
        return ctx.reply(`❌ Usage : ${ctx.prefix}antilink whitelist add|remove|list <domaine>`);
      }

      return ctx.reply(`❌ Usage : ${ctx.prefix}antilink on/off\nOu : ${ctx.prefix}antilink whitelist add|remove|list <domaine>`);
    },
  },
  {
    name: "antispam",
    description: "Configure l'anti-spam",
    category: "moderation",
    groupOnly: true,
    usage: "on/off/threshold <n>/window <s>/action <kick|warn|mute>/addword <mot>/delword <mot>/listwords/forward on|off",
    async execute(ctx) {
      const [sub, ...rest] = ctx.args.split(/\s+/);
      const subLower = (sub ?? "").toLowerCase();
      const groupJid = ctx.chat;

      if (subLower === "on" || subLower === "off") {
        setGroupSetting(groupJid, "antispam", subLower === "on");
        return ctx.reply(`🛡️ Antispam : *${subLower.toUpperCase()}*`);
      }

      const settings = getSpamSettings(groupJid);

      if (subLower === "threshold") {
        const val = parseInt(rest[0], 10);
        if (isNaN(val) || val < 2) return ctx.reply(`❌ Nombre invalide (min 2).`);
        setSpamSetting(groupJid, "threshold", val);
        return ctx.reply(`✅ Seuil antispam : *${val}* messages`);
      }

      if (subLower === "window") {
        const val = parseInt(rest[0], 10);
        if (isNaN(val) || val < 3) return ctx.reply(`❌ Nombre invalide (min 3 secondes).`);
        setSpamSetting(groupJid, "window", val);
        return ctx.reply(`✅ Fenêtre antispam : *${val}* secondes`);
      }

      if (subLower === "action") {
        const action = (rest[0] ?? "").toLowerCase();
        if (!["kick", "warn", "mute"].includes(action)) {
          return ctx.reply(`❌ Actions disponibles : kick / warn / mute`);
        }
        setSpamSetting(groupJid, "action", action);
        return ctx.reply(`✅ Action antispam : *${action.toUpperCase()}*`);
      }

      if (subLower === "addword") {
        const word = (rest[0] ?? "").toLowerCase();
        if (!word) return ctx.reply(`❌ Usage : ${ctx.prefix}antispam addword <mot>`);
        addSpamWord(groupJid, word);
        return ctx.reply(`✅ Mot banni ajouté : *${word}*`);
      }

      if (subLower === "delword") {
        const word = (rest[0] ?? "").toLowerCase();
        if (!word) return ctx.reply(`❌ Usage : ${ctx.prefix}antispam delword <mot>`);
        const removed = removeSpamWord(groupJid, word);
        return ctx.reply(removed ? `✅ Mot *${word}* supprimé.` : `❌ Mot *${word}* pas trouvé.`);
      }

      if (subLower === "listwords") {
        const words = listSpamWords(groupJid);
        return ctx.reply(
          words.length > 0
            ? `🚫 *Mots bannis* :\n${words.map((w) => `• ${w}`).join("\n")}`
            : `📋 Aucun mot banni.`
        );
      }

      if (subLower === "forward") {
        const val = (rest[0] ?? "").toLowerCase();
        if (val !== "on" && val !== "off") return ctx.reply(`❌ Usage : ${ctx.prefix}antispam forward on|off`);
        setSpamSetting(groupJid, "forwardBlock", val === "on");
        return ctx.reply(`✅ Anti-forwarded : *${val.toUpperCase()}*`);
      }

      return ctx.reply(
        `🛡️ *Antispam* :\n` +
          `• ${ctx.prefix}antispam on/off\n` +
          `• ${ctx.prefix}antispam threshold <nombre>\n` +
          `• ${ctx.prefix}antispam window <secondes>\n` +
          `• ${ctx.prefix}antispam action warn/kick/mute\n` +
          `• ${ctx.prefix}antispam addword <mot>\n` +
          `• ${ctx.prefix}antispam delword <mot>\n` +
          `• ${ctx.prefix}antispam listwords\n` +
          `• ${ctx.prefix}antispam forward on/off\n\n` +
          `⚙️ Actuel : seuil=${settings.threshold}, fenêtre=${settings.window}s, action=${settings.action}, forward=${settings.forwardBlock ? "ON" : "OFF"}`
      );
    },
  },
  {
    name: "antidelete",
    description: "Active/désactive l'anti-suppression de messages",
    category: "moderation",
    groupOnly: true,
    usage: "on/off",
    async execute(ctx) {
      const arg = ctx.args.toLowerCase();
      if (arg !== "on" && arg !== "off")
        return ctx.reply(`❌ Usage : ${ctx.prefix}antidelete on|off`);
      setGroupSetting(ctx.chat, "antidelete", arg === "on");
      await ctx.reply(`🛡️ Antidelete : *${arg.toUpperCase()}*`);
    },
  },
  {
    name: "welcome",
    description: "Active/désactive le message de bienvenue",
    category: "moderation",
    groupOnly: true,
    usage: "on/off",
    async execute(ctx) {
      const arg = ctx.args.toLowerCase();
      if (arg !== "on" && arg !== "off")
        return ctx.reply(`❌ Usage : ${ctx.prefix}welcome on|off`);
      setGroupSetting(ctx.chat, "welcome", arg === "on");
      await ctx.reply(`👋 Welcome : *${arg.toUpperCase()}*`);
    },
  },
  {
    name: "groupsettings",
    aliases: ["gs"],
    description: "Affiche les réglages de ce groupe",
    category: "moderation",
    groupOnly: true,
    async execute(ctx) {
      const s = getGroupSettings(ctx.chat);
      const spam = getSpamSettings(ctx.chat);
      const on = (v: boolean) => (v ? "✅ ON" : "❌ OFF");
      const spamWords = listSpamWords(ctx.chat);
      const whitelist = listWhitelistDomains(ctx.chat);
      await ctx.reply(
        `⚙️ *Réglages du groupe* :\n\n` +
          `🛡️ Antilink : ${on(s.antilink)}${whitelist.length > 0 ? ` (whitelist: ${whitelist.length})` : ""}\n` +
          `🛡️ Antispam : ${on(s.antispam)}` +
          (s.antispam
            ? `\n   → seuil=${spam.threshold}, fenêtre=${spam.window}s, action=${spam.action}`
            : "") +
          `${spamWords.length > 0 ? `\n   → ${spamWords.length} mot(s) banni(s)` : ""}\n` +
          `🛡️ Antidelete : ${on(s.antidelete)}\n` +
          `👋 Welcome : ${on(s.welcome)}`
      );
    },
  },
];
