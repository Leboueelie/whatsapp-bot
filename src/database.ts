import Database from "better-sqlite3";
import { config } from "./config";

const db = new Database(config.dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );

  CREATE TABLE IF NOT EXISTS groups (
    jid TEXT PRIMARY KEY,
    antilink INTEGER DEFAULT 0,
    antispam INTEGER DEFAULT 0,
    antidelete INTEGER DEFAULT 0,
    autoview INTEGER DEFAULT 0,
    welcome INTEGER DEFAULT 0,
    created_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS sudo (
    jid TEXT PRIMARY KEY,
    added_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS chat_history (
    jid TEXT PRIMARY KEY,
    history TEXT DEFAULT '[]'
  );

  CREATE TABLE IF NOT EXISTS spam_settings (
    group_jid TEXT PRIMARY KEY,
    threshold INTEGER DEFAULT 8,
    window INTEGER DEFAULT 10,
    action TEXT DEFAULT 'warn',
    forward_block INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS spam_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid TEXT NOT NULL,
    word TEXT NOT NULL,
    UNIQUE(group_jid, word)
  );

  CREATE TABLE IF NOT EXISTS spam_whitelist (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_jid TEXT NOT NULL,
    domain TEXT NOT NULL,
    UNIQUE(group_jid, domain)
  );
`);

export interface GroupSettings {
  antilink: boolean;
  antispam: boolean;
  antidelete: boolean;
  autoview: boolean;
  welcome: boolean;
}

const DEFAULT_GROUP: GroupSettings = {
  antilink: false,
  antispam: false,
  antidelete: false,
  autoview: false,
  welcome: false,
};

export function getSetting(key: string, fallback = ""): string {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row ? row.value : fallback;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  ).run(key, value);
}

export function getGroupSettings(jid: string): GroupSettings {
  const row = db.prepare("SELECT * FROM groups WHERE jid = ?").get(jid) as
    | Record<string, unknown>
    | undefined;
  if (!row) return { ...DEFAULT_GROUP };
  return {
    antilink: !!row.antilink,
    antispam: !!row.antispam,
    antidelete: !!row.antidelete,
    autoview: !!row.autoview,
    welcome: !!row.welcome,
  };
}

export function setGroupSetting(jid: string, key: keyof GroupSettings, value: boolean): void {
  db.prepare(
    `INSERT INTO groups (jid, ${key}) VALUES (?, ?)
     ON CONFLICT(jid) DO UPDATE SET ${key} = excluded.${key}`
  ).run(jid, value ? 1 : 0);
}

export function ensureGroup(jid: string): void {
  db.prepare("INSERT OR IGNORE INTO groups (jid, created_at) VALUES (?, ?)").run(
    jid,
    Date.now()
  );
}

export function isSudo(jid: string): boolean {
  const row = db.prepare("SELECT jid FROM sudo WHERE jid = ?").get(jid);
  return !!row;
}

export function addSudo(jid: string): void {
  db.prepare("INSERT OR IGNORE INTO sudo (jid, added_at) VALUES (?, ?)").run(jid, Date.now());
}

export function removeSudo(jid: string): void {
  db.prepare("DELETE FROM sudo WHERE jid = ?").run(jid);
}

export function listSudo(): string[] {
  return (db.prepare("SELECT jid FROM sudo").all() as { jid: string }[]).map((r) => r.jid);
}

export function getChatHistory(jid: string): Array<{ role: string; content: string }> {
  const row = db.prepare("SELECT history FROM chat_history WHERE jid = ?").get(jid) as
    | { history: string }
    | undefined;
  if (!row) return [];
  try {
    return JSON.parse(row.history);
  } catch {
    return [];
  }
}

export function setChatHistory(jid: string, history: Array<{ role: string; content: string }>): void {
  db.prepare(
    "INSERT INTO chat_history (jid, history) VALUES (?, ?) ON CONFLICT(jid) DO UPDATE SET history = excluded.history"
  ).run(jid, JSON.stringify(history));
}

export interface SpamSettings {
  threshold: number;
  window: number;
  action: "kick" | "warn" | "mute";
  forwardBlock: boolean;
}

const DEFAULT_SPAM: SpamSettings = {
  threshold: 8,
  window: 10,
  action: "warn",
  forwardBlock: false,
};

export function getSpamSettings(groupJid: string): SpamSettings {
  const row = db.prepare("SELECT * FROM spam_settings WHERE group_jid = ?").get(groupJid) as
    | Record<string, unknown>
    | undefined;
  if (!row) return { ...DEFAULT_SPAM };
  return {
    threshold: (row.threshold as number) ?? 8,
    window: (row.window as number) ?? 10,
    action: (row.action as string as SpamSettings["action"]) ?? "warn",
    forwardBlock: !!row.forward_block,
  };
}

export function setSpamSetting(groupJid: string, key: keyof SpamSettings, value: number | string | boolean): void {
  const colMap: Record<string, string> = {
    threshold: "threshold",
    window: "window",
    action: "action",
    forwardBlock: "forward_block",
  };
  const col = colMap[key];
  if (!col) return;
  const val = typeof value === "boolean" ? (value ? 1 : 0) : value;
  db.prepare(
    `INSERT INTO spam_settings (group_jid, ${col}) VALUES (?, ?)
     ON CONFLICT(group_jid) DO UPDATE SET ${col} = excluded.${col}`
  ).run(groupJid, val);
}

export function addSpamWord(groupJid: string, word: string): void {
  db.prepare("INSERT OR IGNORE INTO spam_words (group_jid, word) VALUES (?, ?)").run(
    groupJid,
    word.toLowerCase()
  );
}

export function removeSpamWord(groupJid: string, word: string): boolean {
  const result = db.prepare("DELETE FROM spam_words WHERE group_jid = ? AND word = ?").run(
    groupJid,
    word.toLowerCase()
  );
  return result.changes > 0;
}

export function listSpamWords(groupJid: string): string[] {
  return (db.prepare("SELECT word FROM spam_words WHERE group_jid = ?").all(groupJid) as { word: string }[]).map(
    (r) => r.word
  );
}

export function addWhitelistDomain(groupJid: string, domain: string): void {
  db.prepare("INSERT OR IGNORE INTO spam_whitelist (group_jid, domain) VALUES (?, ?)").run(
    groupJid,
    domain.toLowerCase()
  );
}

export function removeWhitelistDomain(groupJid: string, domain: string): boolean {
  const result = db.prepare("DELETE FROM spam_whitelist WHERE group_jid = ? AND domain = ?").run(
    groupJid,
    domain.toLowerCase()
  );
  return result.changes > 0;
}

export function listWhitelistDomains(groupJid: string): string[] {
  return (db.prepare("SELECT domain FROM spam_whitelist WHERE group_jid = ?").all(groupJid) as { domain: string }[]).map(
    (r) => r.domain
  );
}

export default db;
