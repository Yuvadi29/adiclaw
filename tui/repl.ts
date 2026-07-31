import chalk from "chalk";
import { CommandRouter } from "../commands/router";
import { registry } from "../commands/index";
import type { CommandContext } from "../commands/types";
import { shutdown } from "../ai/session/shutdown";
import * as readline from "readline/promises";
import { select, isCancel } from "@clack/prompts";

const PROMPT = chalk.hex("#A5B4FC")("adiclaw") + chalk.dim(" > ");

export async function runREPL() {
    console.log(
        chalk.dim("  Type /help to see available commands, or start chatting.\n")
    );

    let prefilledInput = "";
    
    // We recreate the readline interface in each loop iteration.
    // This is vital to ensure readline is COMPLETELY detached when @clack/prompts 
    // runs during commands, preventing keyboard duplication glitches!
    while (true) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        if (prefilledInput) {
            rl.write(prefilledInput);
            prefilledInput = "";
        }

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

        let slashIntercepted = false;

        const onKeypress = (str: string, key: any) => {
            // Intercept slash if it's the first character on the line
            if (rl.line === "/" && str === "/") {
                setTimeout(() => {
                    // If they kept typing (pasting/fast typing), abort the dropdown
                    if (rl.line !== "/") return;

                    process.stdout.write('\x1b[2K\r'); // clear line
                    slashIntercepted = true;
                    rl.write('\n'); // Force rl.question to resolve so we can safely exit the readline loop
                }, 10);
            }
        };

        process.stdin.on("keypress", onKeypress);

        // Wait for user to press Enter or for our interceptor to force a newline
        const answer = await rl.question(PROMPT);
        
        process.stdin.removeListener("keypress", onKeypress);
        
        // Ensure rl is completely shut down before executing commands or launching clack
        rl.close();

        // If the user triggered the slash dropdown
        if (slashIntercepted) {
            const commands = registry.list().map(c => ({
                label: `/${c.name.padEnd(10)} - ${chalk.dim(c.description)}`,
                value: c.name,
            }));

            process.stdout.write('\x1b[s'); // Save cursor
            console.log(); // Give clack room to render

            const choice = await select({
                message: "Choose a command",
                options: commands,
            });

            process.stdout.write('\x1b[u\x1b[J'); // Restore cursor and erase menu

            if (!isCancel(choice)) {
                prefilledInput = `/${choice} `; // Pre-fill buffer for next loop
            } else {
                prefilledInput = "/"; 
            }
            continue; // Restart the loop (creates a fresh rl)
        }

        // If we reached here, the user actually pressed Enter on the rl prompt
        const input = answer.trim();
        if (!input) continue;

        // Command executes with full terminal control (rl is dead)
        const handled = await router.handle(input);

        if (!handled) {
            // Not a slash command — treat as a natural-language prompt
            console.log(chalk.dim("  (AI chat coming soon — use /help to see commands)\n"));
        }
    }
}
