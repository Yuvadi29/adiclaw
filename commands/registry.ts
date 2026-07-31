import type { Command } from "./types";

export class CommandRegistry {
    private commands = new Map<string, Command>();

    register(command: Command) {
        this.commands.set(command.name, command);
        for (const alias of command.aliases ?? []) {
            this.commands.set(alias, command);
        }
    }

    get(name: string) {
        return this.commands.get(name);
    }

    list() {
        return [
            ...new Set(this.commands.values())
        ]
    }
}