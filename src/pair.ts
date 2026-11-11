import fs from "fs";
import readline from "readline";
import makeWASocket, {
  useMultiFileAuthState,
  Browsers,
  DisconnectReason,
} from "@whiskeysockets/baileys";
import qrcode from "qrcode-terminal";
import { config } from "./config";
import { baileysLogger } from "./lib/logger";

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(q: string): Promise<string> {
  return new Promise((r) => rl.question(q, r));
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function copySessionFiles(src: string, dest: string): void {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const f of fs.readdirSync(src)) {
    if (!f.endsWith(".json")) continue;
    fs.copyFileSync(`${src}/${f}`, `${dest}/${f}`);
  }
}

/**
 * Attend que la session soit réellement synchronisée : `creds.json` + au moins
 * une clé app-state + quelques pre-keys. Ces fichiers arrivent APRÈS l'event
 * `open`. Sans cette attente, on copie une session incomplète (GALERES.md §8).
 */
async function waitForSyncedSession(dir: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    const hasCreds = files.includes("creds.json");
    const hasAppState = files.some((f) => f.startsWith("app-state-sync-key-"));
    const preKeys = files.filter((f) => f.startsWith("pre-key-")).length;
    if (hasCreds && hasAppState && preKeys >= 5) {
      await sleep(1500); // petite marge pour les derniers flush
      return;
    }
    await sleep(1000);
  }
  console.log("⚠️  Synchronisation partielle (timeout) — on copie quand même.");
}

async function main(): Promise<void> {
  console.log("🔐 Appairage — NexusBot\n");

  // repart d'un état propre à chaque appairage
  fs.rmSync("./session-pair", { recursive: true, force: true });

  const phoneArg = process.argv[2];
  const phone = phoneArg || (await ask("Numéro de téléphone (international, ex: 33612345678) — laisser vide pour QR : "));

  let finalized = false;
  let reconnecting = false;

  const startPairing = async () => {
    const { state, saveCreds } = await useMultiFileAuthState("./session-pair");

    const sock = makeWASocket({
      auth: state,
      browser: Browsers.ubuntu("Chrome"),
      printQRInTerminal: false,
      connectTimeoutMs: 60_000,
      defaultQueryTimeoutMs: 60_000,
      logger: baileysLogger,
    });

    sock.ev.on("creds.update", saveCreds);

    let pairingRequested = false;

    sock.ev.on("connection.update", async (update) => {
      const { connection, qr, lastDisconnect } = update;
      console.log(`[DEBUG] connection.update: connection=${connection}, qr=${!!qr}, phone=${phone}`);
      
      if (qr) {
        console.log("\n📱 Scanne ce QR code :\n");
        qrcode.generate(qr, { small: true });
      }

      if (connection === "open") {
        console.log("[DEBUG] Connection ouverte !");
        if (phone && /^\d{8,15}$/.test(phone) && !pairingRequested) {
          pairingRequested = true;
          console.log(`[DEBUG] Demande du code de pairing pour ${phone}...`);
          try {
            const code = await sock.requestPairingCode(phone);
            console.log("\n📲 Ouvre WhatsApp → Appareils liés → Lier un appareil → saisis ce code :");
            console.log(`\n   🔑 ${code}\n`);
          } catch (err) {
            console.error("[DEBUG] Erreur requestPairingCode:", err);
          }
        }
      }

      if (connection === "open" && !finalized) {
        finalized = true;
        console.log("\n✅ Connecté ! Synchronisation de la session (pré-clés, app-state)…");
        // les pre-keys et clés app-state arrivent APRÈS le `open` : on attend
        // qu'elles soient écrites avant de copier, sinon session incomplète
        // (cf. GALERES.md §8)
        await waitForSyncedSession("./session-pair", 20000);

        copySessionFiles("./session-pair", config.sessionDir);

        console.log("📂 Session copiée dans ./session");
        console.log("\n🎉 Lance `npm start`.\n");

        rl.close();
        process.exit(0);
      }

      if (connection === "close" && !finalized) {
        const statusCode = (
          lastDisconnect?.error as { output?: { statusCode?: number } } | undefined
        )?.output?.statusCode;

        if (statusCode === DisconnectReason.loggedOut) {
          console.log("\n❌ Session déconnectée (logged out). Réessaie.");
          process.exit(1);
        }

        // après un appairage réussi, le serveur envoie "restart required" (515) :
        // c'est normal, on se reconnecte avec les nouvelles credentials.
        if (reconnecting) return;
        reconnecting = true;
        console.log("🔄 Reconnexion après appairage...");
        setTimeout(() => {
          void startPairing();
        }, 2000);
      }
    });
  };

  await startPairing();
}

main().catch((e) => {
  console.error("Erreur :", e);
  process.exit(1);
});
