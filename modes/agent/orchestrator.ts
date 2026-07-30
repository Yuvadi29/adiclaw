import { isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { createAgentTools } from "./agent-tools";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel } from "../../ai/ai.config";
import { renderTerminalMarkdown } from "../../tui/terminal-md";
import { runApprovalFlow } from "./approval";
import { createWebTools } from "../plan/web-tools";

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
    
    const hasWeb = !!process.env.FIRECRAWL_API_KEY;
    // This is where we will be creating the tools that the agent can use
    const tools = {
        ...createAgentTools(executor),
        ...(hasWeb ? createWebTools(tracker) : {}),
    };
    // Create the tool loop
    const agent = new ToolLoopAgent({
        model: getAgentModel(),
        stopWhen: stepCountIs(40),
        instructions: [
            `Workspace root: ${config.codebasePath}`,
            "All mutations are staged until approval.",
            hasWeb ? "Web tools are available (web_search, web_crawl, fetch_url)." : "Web tools are unavailable.",
        ].join("\n"),
        tools,
    });

    // Display actions as they happen, then ask the user to approve the action after the agent is done with its job
    const result = await agent.generate({
        prompt: goal.trim(),
        onStepFinish: ({ toolCalls }) => {
            for (const tc of toolCalls) {
                if (!tc) continue;
                const preview = JSON.stringify(tc.input).slice(0, 160);
                console.log(
                    chalk.green(' ✔️'),
                    chalk.bold(String(tc.toolName)),
                    chalk.dim(preview + (preview.length >= 160 ? "..." : ""))
                )
            }
        }
    });

    if(result.text?.trim()) console.log(renderTerminalMarkdown(result.text));

    // Approval Flow 
    const ok = await runApprovalFlow(tracker);
    if(!ok) return executor.clearStaging();

    const {errors} = executor.applyApprovedFromTracker();

    if(errors.length) {
        console.log(chalk.red("\nSome operations reported errors:\n"));
        for (const e of errors) {
            console.log(chalk.red(` ⏺ ${e}`));
        }
    } else {
        console.log(chalk.green("\n✔️ Applied.\n"));
    }
    executor.clearStaging();
}