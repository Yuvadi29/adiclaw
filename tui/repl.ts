import chalk from "chalk";
import { CommandRouter } from "../commands/router";
import { registry } from "../commands/index";
import type { CommandContext } from "../commands/types";
import { shutdown } from "../ai/session/shutdown";
import * as readline from "readline";

const PROMPT = chalk.hex("#A5B4FC")("adiclaw") + chalk.dim(" > ");

export async function runREPL() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: PROMPT,
    });

    const context: CommandContext = {
        async exit() {
            rl.close();
            shutdown("completed", 0);
        },
        clear() {
            console.clear();
        },
    };

    const router = new CommandRouter(registry, context);

    console.log(
        chalk.dim("  Type /help to see available commands, or start chatting.\n")
    );

    rl.prompt();

    for await (const line of rl) {
        const input = line.trim();
        if (!input) {
            rl.prompt();
            continue;
        }

        const handled = await router.handle(input);

        if (!handled) {
            // Not a slash command — treat as a natural-language prompt (Agent mode default)
            console.log(chalk.dim("  (AI chat coming soon — use /help to see commands)\n"));
        }

        rl.prompt();
    }
}
