import "dotenv/config";
import fs from "fs";
import path from "path";

export interface Config {
  prefix: string;
  botName: string;
  ownerNumbers: string[];
  ownerOnly: boolean;
  tempDir: string;
  geminiApiKey: string;
  openaiApiKey: string;
  telegramBotToken: string;
  telegramChatId: string;
  sessionDir: string;
  dbPath: string;
}

function splitNumbers(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

const botName = process.env.BOT_NAME ?? "NexusBot";

export const config: Config = {
  prefix: process.env.PREFIX ?? ".",
  botName,
  ownerNumbers: splitNumbers(process.env.OWNER_NUMBER),
  ownerOnly: process.env.OWNER_ONLY === "true",
  tempDir: path.resolve(process.env.TEMP_DIR ?? "./tmp"),
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN ?? "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID ?? "",
  sessionDir: path.resolve("./session"),
  dbPath: path.resolve("./data/nexus.db"),
};

fs.mkdirSync(config.tempDir, { recursive: true });
fs.mkdirSync(config.sessionDir, { recursive: true });
fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export function isOwner(jid: string): boolean {
  const num = jid.split("@")[0].split(":")[0].replace(/\D/g, "");
  if (config.ownerNumbers.length === 0) return true;
  return config.ownerNumbers.some((n) => n.replace(/\D/g, "") === num);
}
