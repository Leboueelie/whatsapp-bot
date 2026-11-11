import { execFile } from "child_process";
import fs from "fs";
import { promisify } from "util";
import { tmpPath, cleanEnv } from "./utils";

const execFileP = promisify(execFile);

export interface DownloadResult {
  path: string;
  title: string;
  ext: string;
}

function runYtdlp(args: string[], timeout = 120_000): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(
      "yt-dlp",
      args,
      { timeout, maxBuffer: 10 * 1024 * 1024, env: cleanEnv() },
      (err, stdout, stderr) => {
        if (err) {
          const msg = (stderr || err.message || "").toString();
          reject(new Error(msg.split("\n").filter(Boolean).slice(-3).join(" | ") || "yt-dlp failed"));
        } else {
          resolve({ stdout: stdout.toString(), stderr: stderr.toString() });
        }
      }
    );
  });
}

export async function isYtdlpAvailable(): Promise<boolean> {
  try {
    await execFileP("yt-dlp", ["--version"], { env: cleanEnv() });
    return true;
  } catch {
    return false;
  }
}

export async function downloadVideo(url: string): Promise<DownloadResult> {
  const out = tmpPath(".mp4");
  const titleOut = tmpPath(".txt");
  const args = [
    "--no-playlist",
    "--no-progress",
    "--no-warnings",
    "-f",
    "mp4/best[ext=mp4]/best",
    "--merge-output-format",
    "mp4",
    "-o",
    out,
    "--print",
    "%(title)s",
    url,
  ];
  const { stdout } = await runYtdlp(args);
  if (!fs.existsSync(out)) throw new Error("Impossible de télécharger ce média.");
  const title = stdout.trim().split("\n").pop() ?? "Média";
  void titleOut;
  return { path: out, title, ext: "mp4" };
}

export async function downloadAudio(url: string): Promise<DownloadResult> {
  const out = tmpPath(".mp3");
  const args = [
    "--no-playlist",
    "--no-progress",
    "--no-warnings",
    "-x",
    "--audio-format",
    "mp3",
    "--audio-quality",
    "0",
    "-o",
    out,
    "--print",
    "%(title)s",
    url,
  ];
  const { stdout } = await runYtdlp(args);
  if (!fs.existsSync(out)) throw new Error("Impossible de télécharger cet audio.");
  const title = stdout.trim().split("\n").pop() ?? "Audio";
  return { path: out, title, ext: "mp3" };
}

export async function searchSong(query: string): Promise<DownloadResult> {
  return downloadAudio(`ytsearch1:${query}`);
}

export async function searchVideo(query: string): Promise<DownloadResult> {
  return downloadVideo(`ytsearch1:${query}`);
}

export function cleanupFile(path: string): void {
  try {
    if (path && fs.existsSync(path)) fs.rmSync(path);
  } catch {
    /* ignore */
  }
}
