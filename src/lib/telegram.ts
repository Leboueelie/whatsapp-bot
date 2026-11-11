import axios from "axios";

export interface TelegramMedia {
  kind: "photo" | "video";
  buffer: Buffer;
  filename: string;
  caption?: string;
}

export async function sendTelegramMedia(
  token: string,
  chatId: string,
  media: TelegramMedia
): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/${media.kind === "photo" ? "sendPhoto" : "sendVideo"}`;

  const form = new FormData();
  form.append("chat_id", chatId);
  const mime = media.kind === "photo" ? "image/jpeg" : "video/mp4";
  form.append(media.kind, new Blob([media.buffer], { type: mime }), media.filename);
  if (media.caption) form.append("caption", media.caption);

  await axios.post(url, form, { timeout: 30_000 });
}

export async function sendTelegramText(
  token: string,
  chatId: string,
  text: string
): Promise<void> {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await axios.post(url, { chat_id: chatId, text }, { timeout: 10_000 });
}

export function isTelegramConfigured(token: string, chatId: string): boolean {
  return !!token && !!chatId;
}
