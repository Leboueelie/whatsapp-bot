import figlet from "figlet";
import gradient from "gradient-string";
import { config } from "./config";
import { getSetting } from "./database";
import { loadCommands, listCommands } from "./lib/command";
import { startBot, notifyOwner } from "./lib/client";
import { checkDeps, printDepsWarning } from "./lib/deps";
import { installConsoleFilter } from "./lib/noise";
import { acquireLock, releaseLock } from "./lib/lock";
import { cleanTemp } from "./lib/utils";
import { registerMessageHandler } from "./handlers/messages";
import { registerGroupHandler } from "./handlers/groups";

installConsoleFilter();

async function main(): Promise<void> {
  console.clear();
  console.log(
    gradient.pastel(figlet.textSync(config.botName || "NexusBot", { horizontalLayout: "fitted" }))
  );
  console.log("\n🤖 Bot WhatsApp personnel — Démarrage...\n");

  acquireLock();

  const savedPrefix = getSetting("prefix", "");
  if (savedPrefix) config.prefix = savedPrefix;
  const savedName = getSetting("botname", "");
  if (savedName) config.botName = savedName;

  loadCommands();
  console.log(`✅ ${listCommands().length} commandes chargées.`);

  const deps = await checkDeps();
  printDepsWarning(deps);

  await startBot({
    setup: (sock) => {
      registerMessageHandler(sock);
      registerGroupHandler(sock);
    },
  });

  setInterval(cleanTemp, 5 * 60 * 1000);
  cleanTemp();

  const shutdown = () => {
    console.log("\n👋 Arrêt du bot...");
    releaseLock();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", releaseLock);

  process.on("unhandledRejection", (reason) => {
    console.error("⚠️ unhandledRejection :", reason);
    void notifyOwner(`⚠️ *${config.botName}* — erreur non gérée :\n${String(reason).slice(0, 500)}`).catch(() => {});
  });
  process.on("uncaughtException", (err) => {
    console.error("⚠️ uncaughtException :", err);
    void notifyOwner(`⚠️ *${config.botName}* — exception :\n${err?.message ?? err}`).catch(() => {});
  });
}

main().catch((e) => {
  console.error("❌ Erreur fatale :", e);
  process.exit(1);
});
