import { isCancel, select } from "@clack/prompts";
import chalk from "chalk";
import { runAgentMode } from "./agent/orchestrator";

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
                    label: "Back to main menu"
                }
            ]
        });

        if(isCancel(mode) || mode === "back") return;

        if(mode === "agent"){
            await runAgentMode();
        }
        if(mode === "ask"){
            console.log("Ask Mode")
        }
        if(mode === "plan"){
            console.log("Plan Mode")
        }

        if (mode !== "agent" && mode !== "plan" && mode !== "ask"){
            console.log(chalk.yellow("Invalid mode selected"))
        }
    }
}