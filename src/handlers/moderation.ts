import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { getGroupSettings, getSpamSettings, listSpamWords, listWhitelistDomains } from "../database";
import { getBody } from "../lib/message";

const LINK_RE = /https?:\/\/|www\.|[\w-]+\.(com|net|org|xyz|tk|ml|ga|cf|gq|info|biz|club|online|site|top|icu|buzz|work|live)\b/i;

async function isGroupAdmin(sock: WASocket, chat: string, sender: string): Promise<boolean> {
  try {
    const meta = await sock.groupMetadata(chat);
    return meta.participants.some((p) => p.id === sender && (p.admin === "admin" || p.admin === "superadmin"));
  } catch {
    return false;
  }
}

function extractDomains(text: string): string[] {
  const urls = text.match(/(https?:\/\/[^/\s]+|www\.[^/\s]+|[\w-]+\.[a-z]{2,})/gi) ?? [];
  return urls.map((u) => {
    const clean = u.replace(/^(https?:\/\/|www\.)/, "").split("/")[0].split(":")[0].toLowerCase();
    return clean;
  });
}

export async function handleAntilink(sock: WASocket, msg: WAMessage): Promise<void> {
  const chat = msg.key.remoteJid ?? "";
  if (!getGroupSettings(chat).antilink) return;
  if (msg.key.fromMe) return;
  const sender = msg.key.participant ?? msg.key.remoteJid ?? "";
  const body = getBody(msg);
  if (!body || !LINK_RE.test(body)) return;
  if (await isGroupAdmin(sock, chat, sender)) return;

  const domains = extractDomains(body);
  const whitelist = listWhitelistDomains(chat);
  const allAllowed = ["whatsapp.com", "chat.whatsapp.com", "wa.me", "t.me", ...whitelist];
  if (domains.length > 0 && domains.every((d) => allAllowed.some((a) => d === a || d.endsWith("." + a)))) {
    return;
  }

  await sock.sendMessage(chat, { delete: msg.key });
  await sock.sendMessage(chat, {
    text: `🚫 @${sender.split("@")[0]} — les liens sont interdits dans ce groupe.`,
    mentions: [sender],
  });
}

const spamTracker = new Map<string, { count: number; first: number; warned: boolean }>();

export async function handleAntispam(sock: WASocket, msg: WAMessage): Promise<void> {
  const chat = msg.key.remoteJid ?? "";
  if (!getGroupSettings(chat).antispam) return;
  if (msg.key.fromMe) return;
  const sender = msg.key.participant ?? msg.key.remoteJid ?? "";
  if (await isGroupAdmin(sock, chat, sender)) return;

  const settings = getSpamSettings(chat);
  const body = getBody(msg);

  const bannedWords = listSpamWords(chat);
  if (bannedWords.length > 0 && body) {
    const lower = body.toLowerCase();
    if (bannedWords.some((w) => lower.includes(w))) {
      await sock.sendMessage(chat, { delete: msg.key });
      await sock.sendMessage(chat, {
        text: `🚫 @${sender.split("@")[0]} — mot interdit détecté.`,
        mentions: [sender],
      });
      return;
    }
  }

  if (settings.forwardBlock && msg.message?.extendedTextMessage?.contextInfo?.isForwarded) {
    await sock.sendMessage(chat, { delete: msg.key });
    await sock.sendMessage(chat, {
      text: `🚫 @${sender.split("@")[0]} — les messages transférés sont interdits.`,
      mentions: [sender],
    });
    return;
  }

  const key = `${chat}:${sender}`;
  const now = Date.now();
  const entry = spamTracker.get(key) ?? { count: 0, first: now, warned: false };
  entry.count += 1;
  if (entry.count === 1) entry.first = now;

  const windowMs = settings.window * 1000;

  if (entry.count >= settings.threshold && now - entry.first < windowMs) {
    spamTracker.delete(key);
    await sock.sendMessage(chat, { delete: msg.key });

    if (settings.action === "kick") {
      await sock.sendMessage(chat, {
        text: `👢 @${sender.split("@")[0]} — expulsé pour spam.`,
        mentions: [sender],
      });
      await sock.groupParticipantsUpdate(chat, [sender], "remove");
    } else if (settings.action === "mute") {
      await sock.sendMessage(chat, {
        text: `🔇 @${sender.split("@")[0]} — muet pour spam (24h).`,
        mentions: [sender],
      });
      await sock.groupParticipantsUpdate(chat, [sender], "demote");
    } else {
      if (!entry.warned) {
        entry.warned = true;
        await sock.sendMessage(chat, {
          text: `⚠️ @${sender.split("@")[0]} — arrête le spam ou tu seras expulsé.`,
          mentions: [sender],
        });
      }
    }
  } else if (now - entry.first > windowMs) {
    entry.count = 1;
    entry.first = now;
    entry.warned = false;
  }
  spamTracker.set(key, entry);
}
