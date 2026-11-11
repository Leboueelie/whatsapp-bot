import QRCode from "qrcode";
import qrTerminal from "qrcode-terminal";
import { config } from "../config";
import { sendTelegramMedia, isTelegramConfigured } from "./telegram";

/**
 * Diffusion du QR code d'appairage WhatsApp.
 *
 * Baileys ré-émet un `qr` toutes les ~20 s tant que personne n'a scanné. On
 * l'affiche en ASCII dans les logs à chaque fois (fallback), mais on ne
 * l'envoie sur Telegram qu'au plus une fois par `TELEGRAM_THROTTLE_MS` pour ne
 * pas spammer la conversation.
 *
 * ⚠️ Le QR contient des secrets d'appairage : il est rendu en PNG *localement*
 * (paquet `qrcode`), jamais via une API externe.
 */
const TELEGRAM_THROTTLE_MS = 45_000;
let lastTelegramSend = 0;

export function announceQr(qr: string): void {
  // 1. toujours dans les logs — utile en `docker logs` ou terminal
  console.log("\n📱 Scanne ce QR (WhatsApp → Appareils liés → Lier un appareil) :\n");
  qrTerminal.generate(qr, { small: true });

  // 2. sur Telegram, en photo, throttlé
  if (!isTelegramConfigured(config.telegramBotToken, config.telegramChatId)) return;
  const now = Date.now();
  if (now - lastTelegramSend < TELEGRAM_THROTTLE_MS) return;
  lastTelegramSend = now;

  void (async () => {
    try {
      const png = await QRCode.toBuffer(qr, { type: "png", width: 512, margin: 2 });
      await sendTelegramMedia(config.telegramBotToken, config.telegramChatId, {
        kind: "photo",
        buffer: png,
        filename: `nexus_qr_${now}.png`,
        caption:
          `🔐 *${config.botName}* attend un appairage.\n` +
          "Ouvre WhatsApp → Appareils liés → Lier un appareil, et scanne ce QR.\n" +
          "(Il change toutes les ~20 s — utilise le dernier reçu.)",
      });
    } catch (e) {
      console.error("Envoi QR Telegram échoué :", (e as Error).message ?? e);
    }
  })();
}

/** Remet le compteur à zéro une fois connecté (pour un futur ré-appairage). */
export function resetQrThrottle(): void {
  lastTelegramSend = 0;
}
