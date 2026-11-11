import type { WASocket, WAMessageKey } from "@whiskeysockets/baileys";

/**
 * Récupération des messages « unavailable ».
 *
 * Un appareil lié (le bot) ne reçoit pas toujours le contenu d'un message —
 * en particulier les médias view-once : WhatsApp livre une coquille vide et
 * c'est au téléphone principal de renvoyer le vrai contenu (placeholder
 * resend / PDO). Baileys ne le demande qu'UNE fois (timeout 15 s) : si le
 * téléphone est hors-ligne à ce moment-là, le média n'arrive jamais.
 *
 * Ici on relance la demande plusieurs fois, espacée, pendant ~3-4 min. Si le
 * téléphone revient en ligne dans cette fenêtre, le média finit par arriver et
 * déclenche un nouvel événement `messages.upsert` → le forward auto se fait.
 *
 * Les délais sont espacés de > 20 s car Baileys ignore une nouvelle demande
 * tant que la précédente est « en vol » (5 s d'attente + 15 s de timeout PDO,
 * après quoi il oublie la demande et une relance repart de zéro).
 */

const SCHEDULE_MS = [12_000, 30_000, 40_000, 50_000, 60_000, 60_000, 60_000, 60_000];
const MAX_TRACKED = 60;

type SockWithResend = WASocket & {
  requestPlaceholderResend?: (key: WAMessageKey) => Promise<unknown>;
};

const pending = new Map<string, number>(); // id -> index de la prochaine tentative

/** À appeler quand on reçoit un message vide / non déchiffrable. */
export function trackUnavailable(sock: WASocket, key: WAMessageKey): void {
  const id = key.id;
  if (!id || pending.has(id)) return;

  if (pending.size >= MAX_TRACKED) {
    const oldest = pending.keys().next().value as string | undefined;
    if (oldest) pending.delete(oldest);
  }

  pending.set(id, 0);
  armNext(sock as SockWithResend, key);
}

/** À appeler quand le vrai contenu d'un message finit par arriver. */
export function markResolved(id: string | null | undefined): void {
  if (id) pending.delete(id);
}

function armNext(sock: SockWithResend, key: WAMessageKey): void {
  const id = key.id as string;
  const idx = pending.get(id);
  if (idx === undefined || idx >= SCHEDULE_MS.length) {
    pending.delete(id);
    return;
  }

  setTimeout(() => {
    if (!pending.has(id)) return; // résolu entre-temps
    try {
      void sock.requestPlaceholderResend?.(key).catch(() => {});
    } catch {
      /* ignore */
    }
    pending.set(id, idx + 1);
    armNext(sock, key);
  }, SCHEDULE_MS[idx]);
}
