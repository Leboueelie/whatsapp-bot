import type { WASocket, WAMessage, proto } from "@whiskeysockets/baileys";

export interface CommandContext {
  sock: WASocket;
  msg: WAMessage;
  body: string;
  command: string;
  args: string;
  sender: string;
  pushName: string;
  chat: string;
  isGroup: boolean;
  isOwner: boolean;
  isSudo: boolean;
  prefix: string;
  reply: (text: string, options?: Record<string, unknown>) => Promise<unknown>;
  react: (emoji: string) => Promise<unknown>;
}

export interface Command {
  name: string;
  aliases?: string[];
  description: string;
  category: string;
  usage?: string;
  isOwner?: boolean;
  isSudo?: boolean;
  groupOnly?: boolean;
  cooldown?: number;
  execute: (ctx: CommandContext) => Promise<unknown>;
}

export type ContentMessage = proto.IMessage;

export { WAMessage };
