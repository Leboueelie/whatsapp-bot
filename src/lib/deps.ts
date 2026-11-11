import { execFile } from "child_process";
import { cleanEnv } from "./utils";

export interface DepStatus {
  name: string;
  available: boolean;
  hint: string;
}

function check(bin: string, args: string[]): Promise<boolean> {
  return new Promise((resolve) => {
    execFile(bin, args, { timeout: 15_000, env: cleanEnv() }, (err) => resolve(!err));
  });
}

export async function checkDeps(): Promise<DepStatus[]> {
  const [ytdlp, ffmpeg] = await Promise.all([
    check("yt-dlp", ["--version"]),
    check("ffmpeg", ["-version"]),
  ]);

  return [
    {
      name: "yt-dlp",
      available: ytdlp,
      hint: "pip install yt-dlp   (ou : apt install yt-dlp)",
    },
    {
      name: "ffmpeg",
      available: ffmpeg,
      hint: "apt install ffmpeg",
    },
  ];
}

export function printDepsWarning(deps: DepStatus[]): void {
  const missing = deps.filter((d) => !d.available);
  if (missing.length === 0) {
    console.log("✅ Dépendances système : yt-dlp & ffmpeg détectés.\n");
    return;
  }
  console.log("⚠️  Dépendances manquantes :");
  for (const d of missing) {
    console.log(`   • ${d.name} → ${d.hint}`);
  }
  console.log("   ➜ Lance `bash setup.sh` pour les installer automatiquement.\n");
}
