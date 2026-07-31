import chalk from "chalk";
import { registry } from "./index";
import type { Command } from "./types";

export const helpCommand: Command = {
    name: "help",
    aliases: ["h", "?"],
    description: "Show available commands",

    async execute() {
        console.log();
        console.log(chalk.bold("  Available Commands:\n"));

        const commands = registry.list();
        const maxName = Math.max(...commands.map(c => c.name.length));

        for (const cmd of commands) {
            const aliases = cmd.aliases?.length
                ? chalk.dim(` (${cmd.aliases.map(a => "/" + a).join(", ")})`)
                : "";
            console.log(
                `  ${chalk.cyan("/" + cmd.name.padEnd(maxName + 2))} ${cmd.description}${aliases}`
            );
        }
        console.log();
    }
};