import { isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { createAgentTools } from "./agent-tools";

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
    //    This will be our tool executor which takes care of executing the tools
    const executor = new ToolExecutor(tracker, config);
    // This is where we will be creating the tools that the agent can use
    const tools = createAgentTools(executor);
}