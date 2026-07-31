import type { Command } from "./types";
import { runPlanMode } from "../modes/plan/orchestrator";

export const planCommand: Command = {
    name: "plan",
    aliases: ["p"],
    description: "Generate and execute a structured plan",

    async execute(args) {
        const goal = args.length > 0 ? args.join(" ") : undefined;
        await runPlanMode(goal);
    }
};
