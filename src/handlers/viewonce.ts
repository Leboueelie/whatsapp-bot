import fs from "fs";
import path from "path";
import type { WASocket, WAMessage } from "@whiskeysockets/baileys";
import { config } from "../config";
import { downloadMsgMedia, isViewOnce, getViewOnceMedia, getQuoted } from "../lib/message";
import { sendTelegramMedia, isTelegramConfigured, sendTelegramText } from "../lib/telegram";
import { recallMessage } from "../lib/msg-store";

const LOG_FILE = path.resolve("./data/viewonce.log");

function log(...args: unknown[]): void {
  const line = `[${new Date().toISOString()}] ${args.map((a) => String(a)).join(" ")}`;
  console.log(line);
  // écriture async : ne bloque pas la boucle d'événements
  fs.appendFile(LOG_FILE, line + "\n", () => {});
}

/* --- anti-doublon : un view-once peut être capté 2 fois (à la réception ET
   quand tu y réponds). On ne l'envoie qu'une fois sur Telegram. --- */
const forwarded = new Set<string>();
const FORWARDED_MAX = 300;

function claimForward(id: string | null | undefined): boolean {
  if (!id) return false;
  if (forwarded.has(id)) return false;
  forwarded.add(id);
  if (forwarded.size > FORWARDED_MAX) {
    const oldest = forwarded.values().next().value as string | undefined;
    if (oldest) forwarded.delete(oldest);
  }
  return true;
}

function getSenderLabel(source: WAMessage): string {
  return (source.key.participant ?? source.key.remoteJid ?? "").split("@")[0].split(":")[0];
}

function telegramError(e: unknown): string {
  const err = e as { response?: { data?: { description?: string } }; message?: string };
  return err?.response?.data?.description ?? err?.message ?? String(e);
}

/**
 * Traitement des view-once → Telegram, silencieux. Une seule logique, partout.
 *
 * Déclencheurs :
 *  1. le message reçu EST un view-once → capté à l'arrivée, SI le téléphone
 *     principal a relayé le média à l'appareil lié (sinon on ne reçoit qu'une
 *     coquille vide — cf. GALERES.md §7) ;
 *  2. tu RÉPONDS à un view-once → le message cité embarque le média : marche
 *     toujours, même si le téléphone était hors-ligne à la 1re réception.
 *     ⇒ méthode fiable.
 *  3. tu RÉAGIS à un view-once → seulement si le bot avait déjà reçu le média
 *     (présent en cache). La réaction ne transporte rien et le téléphone ne
 *     répond pas aux demandes de renvoi de view-once → best-effort, souvent
 *     inopérant. Préfère la réponse (cas 2).
 *
 * Aucune réaction, aucune réponse, aucun renvoi sur WhatsApp. Détaché du
 * pipeline `messages.upsert` (download + upload prennent plusieurs secondes).
 */
export function handleViewOnce(sock: WASocket, msg: WAMessage): void {
  if (!msg.message) return;
  if (!isTelegramConfigured(config.telegramBotToken, config.telegramChatId)) return;

  let target: WAMessage | null = null;

  if (isViewOnce(msg)) {
    // cas 1 : on reçoit un view-once
    target = msg;
  } else if (msg.key.fromMe) {
    // cas 2 : tu réponds à un view-once (le média est dans le message cité)
    const quoted = getQuoted(msg);
    if (quoted && isViewOnce(quoted)) {
      target = quoted;
    } else {
      // cas 3 : tu réagis à un view-once déjà reçu (présent en cache)
      const reactedKey = msg.message.reactionMessage?.key;
      const stored = reactedKey?.id ? recallMessage(reactedKey.id) : undefined;
      if (stored && reactedKey && isViewOnce({ key: reactedKey, message: stored } as WAMessage)) {
        target = { key: reactedKey, message: stored } as WAMessage;
      }
    }
  }
  if (!target?.message) return;

  const media = getViewOnceMedia(target.message);
  if (!media) return;
  const isImage = !!media.imageMessage;
  const isVideo = !!media.videoMessage;
  if (!isImage && !isVideo) return;

  if (!claimForward(target.key.id)) return;

  const source = target;
  void (async () => {
    const sender = getSenderLabel(source);
    try {
      const buf = await downloadMsgMedia(source, sock);
      if (!buf) {
        // média view-once pas encore livré à l'appareil lié ; la relance de
        // placeholder resend est gérée dans lib/unavailable.ts, et une
        // réponse au message refera passer ici
        log("view-once download FAILED —", sender, "(média non disponible — le téléphone principal n'a peut-être pas relayé le contenu)");
        forwarded.delete(source.key.id ?? "");
        // feedback Telegram pour prévenir l'utilisateur
        try {
          await sendTelegramText(config.telegramBotToken, config.telegramChatId,
            `⚠️ View once de ${sender} non récupéré — le média n'a pas été relayé par le téléphone. Réponds au message view-once sur WhatsApp pour le renvoyer.`);
        } catch { /* ignore */ }
        return;
      }
      log(`view-once ${isImage ? "photo" : "vidéo"} — ${sender} (${buf.length} octets)`);
      await sendTelegramMedia(config.telegramBotToken, config.telegramChatId, {
        kind: isImage ? "photo" : "video",
        buffer: buf,
        filename: `viewonce_${sender}_${Date.now()}.${isImage ? "jpg" : "mp4"}`,
        caption: `🔒 View once de ${sender}`,
      });
      log("📨 Telegram OK —", sender);
    } catch (e) {
      log("view-once ERROR —", sender, telegramError(e));
      forwarded.delete(source.key.id ?? "");
    }
  })();
}
