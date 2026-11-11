import type { WASocket } from "@whiskeysockets/baileys";
import { getGroupSettings } from "../database";

export function registerGroupHandler(sock: WASocket): void {
  sock.ev.on("group-participants.update", async (update) => {
    try {
      const { id, participants, action } = update;
      if (!getGroupSettings(id).welcome) return;
      const meta = await sock.groupMetadata(id);
      const subject = meta.subject ?? "le groupe";
      for (const jid of participants) {
        const name = jid.split("@")[0];
        if (action === "add") {
          await sock.sendMessage(id, {
            text: `👋 Bienvenue @${name} dans *${subject}* !`,
            mentions: [jid],
          });
        } else if (action === "remove") {
          await sock.sendMessage(id, {
            text: `👋 @${name} a quitté/quitté le groupe.`,
            mentions: [jid],
          });
        }
      }
    } catch {
      /* ignore */
    }
  });
}
