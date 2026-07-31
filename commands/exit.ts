import type { Command } from "./types";

export const exitCommand: Command = {
    name: "exit",
    aliases: ["quit", "q"],
    description: "Exit AdiClaw",

    async execute(_args, context) {
        await context.exit();
    }
};
