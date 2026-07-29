import { isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";

export async function runAgentMode() {
    console.log(chalk.bold("Running Agent Mode"));

    const goal = await text({
        message: "What would you want the agent to do ?",
        placeholder: "Concrete task for this codebase..."
    });
    if (isCancel(goal) || !goal.trim()) return;

    const config = defaultAgentConfig();
    // This will be our tracker to track all the actions happening 
    const tracker = new ActionTracker();
   
    
}