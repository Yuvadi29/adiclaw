import type { Command } from "./types";
import { runAgentMode } from "../modes/agent/orchestrator";

export const agentCommand: Command = {
    name: "agent",
    aliases: ["a"],
    description: "Run the autonomous agent to execute tasks",

    async execute(args) {
        // If args are provided, pass them as the initial goal
        const goal = args.length > 0 ? args.join(" ") : undefined;
        await runAgentMode(goal);
    }
};