import crypto from "crypto";
import fs from "fs";
import { config } from "../config";

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function cleanEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (k === "SESSION_ID") continue;
    env[k] = v;
  }
  return env;
}

export const randomId = (n = 8) => crypto.randomBytes(n).toString("hex");

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function normalizeJid(jid: string): string {
  return jid?.split("@")[0]?.replace(/\D/g, "") ?? "";
}

export function isGroupJid(jid: string): boolean {
  return jid?.endsWith("@g.us") ?? false;
}

export function tmpPath(ext = ""): string {
  const name = `${Date.now()}-${randomId(6)}${ext}`;
  return `${config.tempDir}/${name}`;
}

export function cleanTemp(): void {
  if (!fs.existsSync(config.tempDir)) return;
  const now = Date.now();
  for (const f of fs.readdirSync(config.tempDir)) {
    const p = `${config.tempDir}/${f}`;
    try {
      const st = fs.statSync(p);
      if (now - st.mtimeMs > 10 * 60 * 1000) fs.rmSync(p, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

export function parseArgs(text: string): string {
  return text.trim();
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}j`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(" ");
}
