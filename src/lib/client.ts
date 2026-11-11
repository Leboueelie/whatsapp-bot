import makeWASocket, {
  useMultiFileAuthState,
  makeCacheableSignalKeyStore,
  Browsers,
  DisconnectReason,
  type WASocket,
  type ConnectionState,
  type AnyMessageContent,
} from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { config } from "../config";
import { baileysLogger } from "./logger";
import { recallMessage, rememberMessage } from "./msg-store";
import { announceQr, resetQrThrottle } from "./qr";

export interface StartOptions {
  setup?: (sock: WASocket) => void;
}

/* ------------------------------------------------------------------ */
/*  État du gestionnaire de connexion                                  */
/* ------------------------------------------------------------------ */

let sock: WASocket | null = null;
let startOpts: StartOptions = {};

let connecting = false; // un seul `connect()` en vol à la fois
let stopped = false; // arrêt volontaire : on ne se reconnecte plus
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let attempt = 0; // compteur pour le backoff exponentiel
let everOnline = false;
let badSessionStreak = 0; // erreurs de flux "500" consécutives sans reconnexion réussie
let authResetCount = 0; // nb de sessions effacées automatiquement depuis le démarrage
let ciphertextStreak = 0; // messages CIPHERTEXT consécutifs (sessions Signal périmées)

let ownerJids: string[] = [];

const MAX_BACKOFF_MS = 60_000;
const BASE_BACKOFF_MS = 1_000;
const BAD_SESSION_ALERT_AT = 8;
const BAD_SESSION_REPAIR_AT = 20;
const MAX_AUTH_RESETS = 3;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

export function getSock(): WASocket {
  if (!sock) throw new Error("Socket non initialisé");
  return sock;
}

/**
 * Appele par le handler de messages quand un message CIPHERTEXT (non
 * déchiffrable) est reçu. C'est NORMAL pour un appareil lié : les sessions
 * Signal ne sont pas encore établies avec tous les contacts. Baileys gère
 * automatiquement les retry via sendRetryRequest. On log juste un warning
 * si ça dure trop longtemps (possible vrai problème de session).
 */
export function notifyCiphertext(): void {
  ciphertextStreak += 1;
  // Après 30 CIPHERTEXT (~30 messages), on alerte mais on ne détruit PAS la
  // session : Baileys devrait résoudre ça en quelques minutes tout seul.
  if (ciphertextStreak === 30) {
    console.warn("⚠️  30 messages CIPHERTEXT consécutifs — les sessions Signal semblent bloquées. Baileys devrait résoudre ça automatiquement via retry.");
  }
}

/** Remet le compteur à zéro quand un message est correctement déchiffré. */
export function clearCiphertextStreak(): void {
  ciphertextStreak = 0;
}

export async function notifyOwner(text: string): Promise<void> {
  if (!sock) return;
  const jids =
    ownerJids.length > 0
      ? ownerJids
      : config.ownerNumbers.map((n) => `${n.replace(/\D/g, "")}@s.whatsapp.net`);
  for (const jid of jids) {
    try {
      await sock.sendMessage(jid, { text });
    } catch {
      /* ignore */
    }
  }
}

/** Code de statut HTTP-like renvoyé par WhatsApp à la fermeture (Boom). */
function closeStatus(state: Partial<ConnectionState>): number | undefined {
  const err = state.lastDisconnect?.error as
    | { output?: { statusCode?: number } }
    | undefined;
  return err?.output?.statusCode;
}

function reasonName(code: number | undefined): string {
  if (code == null) return "inconnu";
  const entry = Object.entries(DisconnectReason).find(([, v]) => v === code);
  return entry ? `${entry[0]} (${code})` : String(code);
}

function backoffDelay(): number {
  // 1s, 2s, 4s, 8s … plafonné à 60s, + jitter pour éviter les reconnexions synchronisées
  const exp = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  attempt += 1;
  return exp + Math.floor(Math.random() * 1_000);
}

function scheduleReconnect(delayMs: number): void {
  if (stopped || reconnectTimer) return;
  const secs = Math.round(delayMs / 1000);
  console.log(`🔄 Reconnexion dans ${secs}s (tentative ${attempt})…`);
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void connect();
  }, delayMs);
}

/**
 * Détache proprement l'ancien socket AVANT d'en créer un nouveau.
 * Sans ça, `sock.end()` fait ré-émettre `connection.update: close` sur
 * l'ancien socket (dont les listeners sont toujours branchés) → une
 * deuxième reconnexion se programme → 2, 4, 8 sockets concurrents sur la
 * même identité → WhatsApp coupe tout. C'était la « tempête de reconnexion ».
 */
function teardown(old: WASocket | null): void {
  if (!old) return;
  try {
    old.ev.removeAllListeners("connection.update");
    old.ev.removeAllListeners("creds.update");
    old.ev.removeAllListeners("messages.upsert");
  } catch {
    /* ignore */
  }
  try {
    old.end(undefined);
  } catch {
    /* ignore */
  }
}

/**
 * Efface la session sur disque puis programme une reconnexion : au prochain
 * `connect()`, Baileys n'a plus de credentials → il émet un `qr` → `announceQr`
 * l'envoie sur Telegram. Ré-appairage 100 % automatique, sans SSH.
 *
 * Garde-fou : au-delà de MAX_AUTH_RESETS effacements, on arrête et on alerte —
 * si scanner le QR ne suffit pas, c'est un vrai problème (numéro banni, device
 * retiré côté téléphone en boucle, horloge serveur fausse…).
 */
/**
 * Vide le CONTENU du dossier de session — surtout pas le dossier lui-même : en
 * prod c'est un point de montage de volume Docker, `rmdir` dessus renvoie
 * `EBUSY: resource busy or locked`. On supprime chaque entrée à l'intérieur.
 */
function wipeSessionFiles(): boolean {
  try {
    const dir = config.sessionDir;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      return true;
    }
    for (const entry of fs.readdirSync(dir)) {
      fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
    }
    return true;
  } catch (e) {
    console.error("Effacement session échoué :", (e as Error).message ?? e);
    return false;
  }
}

function resetSessionAndRepair(cause: string): void {
  authResetCount += 1;
  if (authResetCount > MAX_AUTH_RESETS) {
    stopped = true;
    console.error(
      `⛔ ${authResetCount - 1} ré-appairages automatiques n'ont pas tenu (${cause}). Arrêt.\n` +
        "   Intervention manuelle nécessaire (numéro, horloge serveur, device côté téléphone)."
    );
    void notifyOwner(
      `⛔ *${config.botName}* : le ré-appairage automatique échoue en boucle (${cause}). ` +
        "Bot arrêté, il faut regarder de près."
    );
    return;
  }

  console.warn(`♻️  Session effacée (${cause}) — nouvel appairage QR (tentative ${authResetCount}/${MAX_AUTH_RESETS}).`);
  // on coupe l'ancien socket AVANT d'effacer : sinon un `creds.update` tardif
  // pourrait ré-écrire creds.json juste après le nettoyage
  teardown(sock);
  sock = null;
  if (!wipeSessionFiles()) {
    stopped = true;
    void notifyOwner(
      `⛔ *${config.botName}* : impossible d'effacer la session (${cause}). Intervention manuelle requise.`
    );
    return;
  }
  void notifyOwner(
    `♻️ *${config.botName}* : session invalide (${cause}). ` +
      "Je génère un nouveau QR, tu vas le recevoir ici — scanne-le depuis WhatsApp."
  );
  scheduleReconnect(2_000);
}

/* ------------------------------------------------------------------ */
/*  Cycle de connexion                                                 */
/* ------------------------------------------------------------------ */

async function handleClose(state: Partial<ConnectionState>): Promise<void> {
  connecting = false;
  const code = closeStatus(state);
  console.log(`🔌 Connexion fermée — raison : ${reasonName(code)}`);

  switch (code) {
    case DisconnectReason.loggedOut: // 401
      // WhatsApp a invalidé la session (device retiré, purge serveur…). Les
      // credentials sont mortes : on efface et on relance un appairage QR.
      resetSessionAndRepair("logged out");
      return;

    case DisconnectReason.connectionReplaced: // 440
      stopped = true;
      console.error(
        "⛔ Une autre instance s'est connectée avec cette session.\n" +
          "   Cette instance s'arrête pour ne pas entrer en guerre de reconnexion.\n" +
          "   (Ne lance qu'UN seul bot à la fois sur la même session.)"
      );
      void notifyOwner(
        `⛔ *${config.botName}* : une autre instance a pris la connexion. Arrêt de celle-ci.`
      );
      return;

    case DisconnectReason.badSession: {
      // 500 = code par défaut de Baileys pour TOUT `<stream:error>` sans code
      // explicite (cf. getErrorCodeFromStreamError). C'est presque toujours
      // transitoire (hiccup serveur WA, migration de shard, coupure réseau) :
      // on se reconnecte au lieu de tuer le bot. On n'alerte qu'après plusieurs
      // échecs d'affilée sans jamais réussir à revenir en ligne.
      badSessionStreak += 1;
      if (badSessionStreak === BAD_SESSION_ALERT_AT) {
        console.error(`⚠️  ${badSessionStreak} erreurs de flux consécutives — le bot continue d'essayer.`);
        void notifyOwner(
          `⚠️ *${config.botName}* : ${badSessionStreak} erreurs de flux d'affilée. Reconnexion en cours…`
        );
      }
      if (badSessionStreak >= BAD_SESSION_REPAIR_AT) {
        badSessionStreak = 0;
        resetSessionAndRepair("erreurs de flux persistantes");
        return;
      }
      scheduleReconnect(backoffDelay());
      return;
    }

    case DisconnectReason.multideviceMismatch: // 411
      resetSessionAndRepair("incohérence multi-appareils");
      return;

    case DisconnectReason.restartRequired: // 515
      // Normal juste après un appairage : WhatsApp demande un redémarrage
      // du flux avec les nouvelles credentials. On reconnecte tout de suite.
      console.log("↻ restart required (normal après appairage) — reconnexion immédiate.");
      scheduleReconnect(0);
      return;

    default:
      // 408 timedOut, 428 connectionClosed, 503 unavailable, réseau coupé, undefined…
      if (everOnline && attempt === 0) {
        void notifyOwner(`🔴 *${config.botName}* a perdu la connexion. Reconnexion…`).catch(() => {});
      }
      scheduleReconnect(backoffDelay());
  }
}

function handleOpen(): void {
  connecting = false;
  const wasReconnect = everOnline;
  everOnline = true;
  attempt = 0;
  badSessionStreak = 0;
  ciphertextStreak = 0;
  // authResetCount n'est PAS reset ici : si le bot se reconnecte mais
  // re-déclenche immédiatement une réparation (CIPHERTEXT, badSession…),
  // la garde MAX_AUTH_RESETS doit pouvoir arrêter la boucle.
  resetQrThrottle();

  ownerJids = config.ownerNumbers.map((n) => `${n.replace(/\D/g, "")}@s.whatsapp.net`);
  console.log(`\n✅ CONNECTÉ — ${config.botName} est en ligne.`);

  if (config.ownerNumbers.length > 0) {
    void notifyOwner(
      wasReconnect ? `🟢 *${config.botName}* reconnecté.` : `🟢 *${config.botName}* est en ligne !`
    );
  }
}

async function handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
  const { connection, qr } = update;

  if (qr) announceQr(qr);

  if (connection === "connecting") console.log("… connexion à WhatsApp");
  if (connection === "open") handleOpen();
  if (connection === "close") await handleClose(update);
}

/**
 * (Re)crée le socket. Idempotent : si une connexion est déjà en cours, on
 * ne fait rien (garde `connecting`).
 */
async function connect(): Promise<WASocket> {
  if (connecting && sock) return sock;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  connecting = true;

  teardown(sock);
  sock = null;

  const { state, saveCreds } = await useMultiFileAuthState(config.sessionDir);

  const ws = makeWASocket({
    auth: {
      creds: state.creds,
      // cache en RAM des clés Signal (TTL 5 min) : moins de lectures disque,
      // moins de thrash sur les fichiers session-*.json
      keys: makeCacheableSignalKeyStore(state.keys, baileysLogger as never),
    },
    browser: Browsers.ubuntu("Chrome"),
    printQRInTerminal: false,
    // le bot ne se déclare PAS "en ligne" : le téléphone principal reste
    // l'appareil prioritaire pour la livraison, ce qui fiabilise le relais
    // des médias view-once vers l'appareil lié
    markOnlineOnConnect: false,
    syncFullHistory: false,
    // false : ne PAS aller chercher les URLs reçues pour fabriquer un aperçu
    // riche. Économise des requêtes sortantes (surface SSRF : le serveur du bot
    // ferait des GET vers des URLs choisies par l'expéditeur), du réseau et du
    // bruit dans les logs ("url generation failed").
    generateHighQualityLinkPreview: false,
    fireInitQueries: true,
    connectTimeoutMs: 60_000,
    defaultQueryTimeoutMs: 60_000,
    // ping fréquent mais pas trop agressif : 30s (défaut Baileys) give
    // une fenêtre de tolérance de 35s, suffisante pour les réseaux instables
    // tout en détectant rapidement les connexions mortes.
    keepAliveIntervalMs: 30_000,
    logger: baileysLogger as never,
    // clé de voûte du chantier 1 : permet de répondre aux retry receipts
    getMessage: async (key) => recallMessage(key.id),
  });

  sock = ws;

  ws.ev.on("creds.update", saveCreds);
  ws.ev.on("connection.update", (u) => void handleConnectionUpdate(u));

  // Mémoriser tout ce qui passe (nos envois ET les messages entrants) pour
  // pouvoir les re-fournir sur retry receipt.
  ws.ev.on("messages.upsert", ({ messages }) => {
    for (const m of messages) rememberMessage(m);
  });

  // Mémoriser aussi le retour de sendMessage : le retry receipt peut arriver
  // avant même l'écho `messages.upsert` de notre propre message.
  const origSend = ws.sendMessage.bind(ws);
  ws.sendMessage = (async (jid: string, content: AnyMessageContent, options?: unknown) => {
    const sent = await origSend(jid, content, options as never);
    rememberMessage(sent);
    return sent;
  }) as typeof ws.sendMessage;

  startOpts.setup?.(ws);

  connecting = false;
  return ws;
}

export async function startBot(opts: StartOptions = {}): Promise<WASocket> {
  startOpts = opts;
  stopped = false;
  attempt = 0;
  everOnline = false;
  return connect();
}
