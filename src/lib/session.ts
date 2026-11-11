import fs from "fs";
import path from "path";
import { config } from "../config";

/**
 * La session WhatsApp vit uniquement dans le dossier `./session/` (géré par
 * `useMultiFileAuthState` de Baileys). Pas de `SESSION_ID` encodé dans `.env` :
 * pour déplacer le bot, on copie le dossier `./session/` (et en Docker c'est un
 * volume qui persiste).
 */

export function sessionExists(): boolean {
  return fs.existsSync(path.join(config.sessionDir, "creds.json"));
}

export function clearSession(): void {
  fs.rmSync(config.sessionDir, { recursive: true, force: true });
  fs.mkdirSync(config.sessionDir, { recursive: true });
}
