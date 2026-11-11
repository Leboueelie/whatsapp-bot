import { proto } from "@whiskeysockets/baileys";
import type { WAMessage } from "@whiskeysockets/baileys";
import db from "../database";

/**
 * Cache des messages déjà vus/envoyés, indexé par `key.id`.
 *
 * Pourquoi : quand un correspondant n'arrive pas à déchiffrer un message
 * (sessions Signal désynchronisées), WhatsApp renvoie un « retry receipt »
 * qui demande à l'émetteur de RE-chiffrer et renvoyer ce message précis.
 * Baileys délègue cette récupération au callback `getMessage(key)`. Sans
 * store, le bot répond « message not available » → sa réponse est perdue.
 *
 * Deux niveaux :
 *  - `mem` : petit cache en RAM (accès immédiat, couvre le cas courant où le
 *    retry arrive quelques secondes après l'envoi).
 *  - table SQLite `cached_messages` : survit à un redémarrage et garde un
 *    historique un peu plus long, borné pour ne pas grossir sans fin.
 */

const MEM_MAX = 500;
const DB_MAX = 4000;
const PRUNE_EVERY = 250;

const mem = new Map<string, proto.IMessage>();

db.exec(`
  CREATE TABLE IF NOT EXISTS cached_messages (
    id TEXT PRIMARY KEY,
    content BLOB NOT NULL,
    ts INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_cached_messages_ts ON cached_messages (ts);
`);

const upsertStmt = db.prepare(
  `INSERT INTO cached_messages (id, content, ts) VALUES (?, ?, ?)
   ON CONFLICT(id) DO UPDATE SET content = excluded.content, ts = excluded.ts`
);
const selectStmt = db.prepare("SELECT content FROM cached_messages WHERE id = ?");
const pruneStmt = db.prepare(
  `DELETE FROM cached_messages WHERE id IN (
     SELECT id FROM cached_messages ORDER BY ts DESC LIMIT -1 OFFSET ?
   )`
);

let sinceLastPrune = 0;

function memSet(id: string, content: proto.IMessage): void {
  mem.delete(id); // ré-insère en fin => ordre LRU
  mem.set(id, content);
  if (mem.size > MEM_MAX) {
    const oldest = mem.keys().next().value as string | undefined;
    if (oldest) mem.delete(oldest);
  }
}

/** Mémorise un message (le nôtre ou celui d'un tiers) pour un éventuel renvoi. */
export function rememberMessage(msg: WAMessage | undefined | null): void {
  const id = msg?.key?.id;
  const content = msg?.message;
  if (!id || !content) return;

  memSet(id, content);

  try {
    const buf = Buffer.from(proto.Message.encode(content).finish());
    upsertStmt.run(id, buf, Date.now());
    if (++sinceLastPrune >= PRUNE_EVERY) {
      sinceLastPrune = 0;
      pruneStmt.run(DB_MAX);
    }
  } catch {
    /* un message non sérialisable ne doit pas casser le flux */
  }
}

/** Récupère le contenu d'un message déjà vu, pour répondre à un retry receipt. */
export function recallMessage(id: string | null | undefined): proto.IMessage | undefined {
  if (!id) return undefined;

  const hit = mem.get(id);
  if (hit) {
    memSet(id, hit);
    return hit;
  }

  try {
    const row = selectStmt.get(id) as { content: Buffer } | undefined;
    if (!row) return undefined;
    const decoded = proto.Message.decode(row.content);
    memSet(id, decoded);
    return decoded;
  } catch {
    return undefined;
  }
}
