import fs from "fs";
import path from "path";

const LOCK_FILE = path.resolve(".nexus.lock");

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function acquireLock(): void {
  if (fs.existsSync(LOCK_FILE)) {
    const raw = fs.readFileSync(LOCK_FILE, "utf8");
    const pid = parseInt(raw, 10);
    if (pid && isProcessAlive(pid)) {
      console.error(`❌ Une autre instance du bot tourne déjà (PID ${pid}).`);
      console.error("   Arrête-la d'abord ou supprime .nexus.lock si c'est un résidu.");
      process.exit(1);
    }
  }
  fs.writeFileSync(LOCK_FILE, String(process.pid));
}

export function releaseLock(): void {
  try {
    fs.rmSync(LOCK_FILE, { force: true });
  } catch {
    /* ignore */
  }
}
