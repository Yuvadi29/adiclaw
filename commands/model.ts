import chalk from "chalk";
import { select, isCancel } from "@clack/prompts";
import type { Command } from "./types";
import { aiSession } from "../ai/session";
import { checkOllama } from "../ai/ollama";

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB"];
    let size = bytes;
    let unit = -1;
    do {
        size /= 1024;
        unit++;
    } while (size >= 1024 && unit < units.length - 1);
    return `${size.toFixed(1)} ${units[unit]}`;
}

export const modelCommand: Command = {
    name: "model",
    aliases: ["m"],
    description: "Switch the active AI model",

    async execute(args) {
        const sess = aiSession.get();

        // If an arg was provided, set it directly: /model mistral:latest
        if (args.length > 0) {
            const newModel = args.join(" ");
            aiSession.set({ ...sess, model: newModel });
            console.log(chalk.green(`\n  ✔ Model set to ${chalk.bold(newModel)}\n`));
            return;
        }

        // Otherwise show picker based on provider
        if (sess.provider === "ollama") {
            const status = await checkOllama();

            if (!status.running) {
                console.log(chalk.red("\n  ⚠ Ollama is not running. Start it with: ollama serve\n"));
                return;
            }

            if (!status.models || status.models.length === 0) {
                console.log(chalk.yellow("\n  ⚠ No models found. Pull one with: ollama pull mistral\n"));
                return;
            }

            process.stdout.write('\x1b[s'); // Save cursor
            console.log(); // Give clack room to render

            const choice = await select<string>({
                message: "Choose a model",
                options: status.models.map(m => ({
                    value: m.name,
                    label: m.name,
                    hint: formatBytes(m.size),
                })),
            });

            process.stdout.write('\x1b[u\x1b[J'); // Restore cursor and erase menu

            if (isCancel(choice)) return;

            aiSession.set({ ...sess, model: choice });
            console.log(chalk.green(`\n  ✔ Model set to ${chalk.bold(choice)}\n`));
        } else {
            // OpenRouter — just prompt for model name
            console.log(chalk.dim(`\n  Current model: ${sess.model}`));
            console.log(chalk.dim(`  Usage: /model <model-name>\n`));
        }
    }
};
