import chalk from "chalk";
import { CommandRegistry } from "./registry";
import type { CommandContext } from "./types";

export class CommandRouter {

    constructor(
        private readonly registry: CommandRegistry,
        private readonly context: CommandContext,
    ) { }

    async handle(input: string): Promise<boolean> {
        if (!input.startsWith("/"))
            return false;

        const tokens = input
            .slice(1)
            .trim()
            .split(/\s+/);

        const name = tokens[0];

        if (!name) return true;

        const args = tokens.slice(1);

        const command = this.registry.get(name);

        if (!command) {
            console.log(chalk.yellow(`  Unknown command: /${name}`) + chalk.dim(`  Run /help to see available commands.`));
            return true;
        }

        await command.execute(args, this.context);
        return true;
    }
}