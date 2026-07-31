export interface CommandContext {
    exit(): Promise<void>;
    clear(): void;
}

export interface Command {
    // Primary command name;
    name: string;

    // Optional aliases
    aliases?: string[];

    // Description shown in /help
    description: string;

    // Execute command args: /ask explain planner
    execute(
        args: string[],
        context: CommandContext,
    ): Promise<void>;
}