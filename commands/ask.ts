import type { Command } from "./types";
import { runAskMode } from "../modes/ask/orchestrator";

export const askCommand: Command = {
    name: "ask",
    description: "Ask questions about your codebase (read-only)",

    async execute(args) {
        const question = args.length > 0 ? args.join(" ") : undefined;
        await runAskMode(question);
    }
};
