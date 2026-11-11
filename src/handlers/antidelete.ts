import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { getGroupSettings } from "../database";
import { getBody, downloadMsgMedia } from "../lib/message";

const store = new Map<string, WAMessage>();
const MAX_STORE = 5000;

function prune(): void {
  if (store.size <= MAX_STORE) return;
  const keys = store.keys();
  for (let i = 0; i < 500; i++) {
    const k = keys.next().value as string | undefined;
    if (!k) break;
    store.delete(k);
  }
}

function storeKey(msg: WAMessage): string {
  return `${msg.key.remoteJid}:${msg.key.id}`;
}

export function storeMessage(msg: WAMessage): void {
  if (!msg.key.id || !msg.message) return;
  if (msg.message.protocolMessage) return;
  store.set(storeKey(msg), msg);
  prune();
}

export function isRevokeMessage(msg: WAMessage): boolean {
  return msg.message?.protocolMessage?.type === 0;
}

export async function handleRevoke(sock: WASocket, msg: WAMessage): Promise<void> {
  if (!isRevokeMessage(msg)) return;
  const deletedKey = msg.message?.protocolMessage?.key;
  if (!deletedKey?.id) return;
  const chat = msg.key.remoteJid ?? "";
  const isGroup = chat.endsWith("@g.us");
  const original = store.get(`${chat}:${deletedKey.id}`);
  if (!original?.message) return;

  const shouldReplay = isGroup ? getGroupSettings(chat).antidelete : true;

  if (shouldReplay) {
    const sender = deletedKey.participant ?? deletedKey.remoteJid ?? msg.key.participant ?? "";
    const body = getBody(original);
    await sock.sendMessage(chat, {
      text: `♻️ *Anti-suppression* — @${sender.split("@")[0]} :\n\n${body || "(média)"}`,
      mentions: [sender],
    });

    const m = original.message;
    const isMedia = !!(m.imageMessage || m.videoMessage || m.audioMessage);
    if (isMedia) {
      const buf = await downloadMsgMedia(original, sock);
      if (buf) {
        if (m.imageMessage) await sock.sendMessage(chat, { image: buf });
        else if (m.videoMessage) await sock.sendMessage(chat, { video: buf });
        else if (m.audioMessage) await sock.sendMessage(chat, { audio: buf });
      }
    }
  }
  store.delete(`${chat}:${deletedKey.id}`);
}
