import { isCancel, select } from "@clack/prompts";
import chalk from "chalk";
import { runAgentMode } from "./agent/orchestrator";
import { runAskMode } from "./ask/orchestrator";
import { runPlanMode } from "./plan/orchestrator";
import { shutdown } from "../ai/session/shutdown";

export async function runCliMode() {
    while (true) {
        const mode = await select({
            message: "Choose CLI sub-mode",
            options: [
                {
                    value: "agent",
                    label: "Agent Mode"
                },
                {
                    value: "plan",
                    label: "Plan Mode",
                },
                {
                    value: "ask",
                    label: "Ask Mode",
                },
                {
                    value: "back",
                    label: "Exit"
                }
            ]
        });

        if (isCancel(mode)) {
            shutdown("cancelled", 0);
            return;
        }

        if (mode === "back") {
            return;
        }

        if(mode === "agent"){
            await runAgentMode();
        }
        if(mode === "ask"){
            await runAskMode();
        }
        if(mode === "plan"){
            await runPlanMode();
        }

        if (mode !== "agent" && mode !== "plan" && mode !== "ask"){
            console.log(chalk.yellow("Invalid mode selected"))
        }
    }
}