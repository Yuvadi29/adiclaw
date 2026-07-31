import type { Command } from "./types";

export const clearCommand: Command = {
    name: "clear",
    aliases: ["cls"],
    description: "Clear the terminal screen",

    async execute(_args, context) {
        context.clear();
    }
};
