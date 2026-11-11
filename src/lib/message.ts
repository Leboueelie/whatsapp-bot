import {
  getContentType,
  downloadMediaMessage,
  type WAMessage,
  type WASocket,
  type proto,
} from "@whiskeysockets/baileys";

export function getBody(msg: WAMessage): string {
  const m = msg.message;
  if (!m) return "";
  const type = getContentType(m);
  if (!type) return "";
  const content = m[type as keyof proto.IMessage] as
    | { text?: string; caption?: string }
    | undefined;
  if (typeof content === "string") return content;
  return content?.text ?? content?.caption ?? "";
}

export function getQuoted(msg: WAMessage): WAMessage | null {
  const m = msg.message;
  if (!m) return null;
  const ctx = m.extendedTextMessage?.contextInfo;
  if (!ctx?.quotedMessage) return null;
  return {
    key: { remoteJid: ctx.participant ?? msg.key.remoteJid, ...(ctx.stanzaId ? { id: ctx.stanzaId } : {}) },
    message: ctx.quotedMessage,
  } as WAMessage;
}

export function isViewOnce(msg: WAMessage): boolean {
  const m = msg.message as proto.IMessage | null | undefined;
  if (!m) return false;
  if (m.imageMessage?.viewOnce || m.videoMessage?.viewOnce) return true;
  return !!(m.viewOnceMessage || m.viewOnceMessageV2 || m.viewOnceMessageV2Extension);
}

export function getViewOnceMedia(m: proto.IMessage | null | undefined): proto.IMessage | null {
  if (!m) return null;
  if (m.imageMessage || m.videoMessage) return m;
  const inner = (m.viewOnceMessage?.message ??
    m.viewOnceMessageV2?.message ??
    m.viewOnceMessageV2Extension?.message) as proto.IMessage | null | undefined;
  if (inner && (inner.imageMessage || inner.videoMessage)) return inner;
  return null;
}

export async function downloadMsgMedia(
  msg: WAMessage,
  sock: WASocket
): Promise<Buffer | null> {
  try {
    const m = msg.message;
    if (!m) return null;

    const downloadPromise = downloadMediaMessage(
      msg,
      "buffer",
      {},
      { logger: undefined as never, reuploadRequest: sock.updateMediaMessage }
    );

    const timeoutPromise = new Promise<null>((_, reject) =>
      setTimeout(() => reject(new Error("Download timeout (30s)")), 30_000)
    );

    return (await Promise.race([downloadPromise, timeoutPromise])) as Buffer;
  } catch (e) {
    const err = e as { message?: string };
    console.log(`[viewonce] download échoué: ${err.message ?? e}`);
    return null;
  }
}

export function isMediaMessage(msg: WAMessage): boolean {
  const m = msg.message;
  if (!m) return false;
  return !!(m.imageMessage || m.videoMessage || m.stickerMessage || m.audioMessage);
}

export function isBotSelfMessage(msg: WAMessage): boolean {
  const id = msg.key.id ?? "";
  return id.startsWith("3EB0") || id.startsWith("BAE5");
}
