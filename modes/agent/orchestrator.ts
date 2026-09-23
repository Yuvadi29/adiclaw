import { isCancel, spinner, text } from "@clack/prompts";
import chalk from "chalk";
import { defaultAgentConfig } from "./types";
import { ActionTracker } from "./action-tracker";
import { ToolExecutor } from "./tool-executor";
import { createAgentTools } from "./agent-tools";
import { TaskTracker } from "./task-tracker";
import { stepCountIs, ToolLoopAgent } from "ai";
import { getAgentModel } from "../../ai/ai.config";
import { renderTerminalMarkdown } from "../../tui/terminal-md";
import { runApprovalFlow } from "./approval";
import { createWebTools } from "../plan/web-tools";
import { activity, formatToolCallBadge } from "../../tui/activity";
import { activityEvents } from "./activity-events";
import { sessionTracker } from "../../ai/session/session-tracker";
import { getAITools } from "../../mcp";
import { buildSystemPrompt } from "../../context/prompt-builder";
import { extractFileMentions } from "../../input/file-mentions";
import { buildFileContents } from "../../input/build-file-contents";

function getToolMessage(toolName: string, input: any): string {
    switch (toolName) {
        case "read_file":
            return `📖 Reading ${input.path}`;

        case "modify_file":
            return `✏️ Editing ${input.path}`;

        case "create_file":
            return `📄 Creating ${input.path}`;

        case "delete_file":
            return `🗑️ Deleting ${input.path}`;

        case "create_folder":
            return `📁 Creating ${input.path}`;

        case "list_files":
            return `📂 Listing ${input.path}`;

        case "search_files":
            return `🔍 Searching ${input.pattern}`;

        case "analyze_codebase":
            return `📊 Analyzing project`;

        case "execute_shell":
            return `💻 Queueing shell command`;

        case "list_skills":
            return `🧠 Loading skills`;

        case "read_skill":
            return `📘 Reading skill`;

        case "web_search":
            return `🌐 Searching web`;

        case "web_crawl":
            return `🌍 Crawling website`;

        case "fetch_url":
            return `🔗 Fetching URL`;

        case "manage_tasks":
            return `📋 Managing Tasks`;

        case "run_tests":
            return `🧪 Running Tests`;

        case "obsidian_search":
            return `📓 Searching Obsidian`;

        case "obsidian_read":
            return `📓 Reading Note`;

        case "youtube_analytics":
            return `📊 Fetching YouTube Analytics (${input?.period || "28d"})`;

        case "youtube_channel":
            return `📺 Fetching YouTube Channel Info`;

        case "youtube_list_videos":
            return `🎬 Listing YouTube Videos (${input?.limit || 10} videos)`;

        case "youtube_search_videos":
            return `🔍 Searching YouTube: "${input?.query || ""}"`;

        case "youtube_video_details":
            return `📹 Fetching YouTube Video Details`;

        case "youtube_video_comments":
            return `💬 Fetching YouTube Video Comments`;

        case "youtube_render_dashboard":
            return `📊 Rendering YouTube Dashboard`;

        default:
            return `⚙️ ${toolName}`;
    }
}

export async function runAgentMode(initialGoal?: string) {
    console.log(chalk.bold("Running Agent Mode"));
    activityEvents.clear();
    activityEvents.onStart((msg) => {
        if (!activity.isBusy) activity.start(msg);
        else activity.update(msg);
    });
    activityEvents.onFinish((msg, data) => {
        if (data?.toolName) {
            activity.logCompletedAction(data.toolName, data.args, data.durationMs, true, msg);
        } else {
            activity.update(msg + chalk.green(" ✓"));
        }
    });
    activityEvents.onSilentFinish((msg, data) => {
        if (data?.toolName) {
            activity.logCompletedAction(data.toolName, data.args, data.durationMs, true, msg);
        } else {
            activity.update(msg + chalk.dim(" ✓"));
        }
    });
    activityEvents.onFail((msg, data) => {
        if (data?.toolName) {
            activity.logCompletedAction(data.toolName, data.args, data.durationMs, false, chalk.red("Failed: " + msg));
        } else {
            activity.update(chalk.red("Failed: " + msg));
        }
    });


    let goal = initialGoal;
    if (!goal) {
        const input = await text({
            message: "What would you want the agent to do ?",
            placeholder: "Concrete task for this codebase..."
        });
        if (isCancel(input) || !input.trim()) return;
        goal = input.trim();
    }

    const config = defaultAgentConfig();
    // 
    // This will be our tracker to track all the actions happening 
    const tracker = new ActionTracker();
    //    This will be our tool executor which takes care of executing the tools
    const executor = new ToolExecutor(tracker, config);

    // Initialize the task tracker
    const taskTracker = new TaskTracker();

    const hasWeb = !!process.env.FIRECRAWL_API_KEY;
    // This is where we will be creating the tools that the agent can use
    const tools = {
        ...createAgentTools(executor, taskTracker),
        ...(hasWeb ? createWebTools(tracker) : {}),
        ...getAITools(),
    };

    // Create the tool loop
  const agent = new ToolLoopAgent({
    model: getAgentModel("agent"),
    stopWhen: stepCountIs(40),
        instructions: buildSystemPrompt({
          mode: "agent",
          userPrompt: goal.trim(),
          workspaceRoot: config.codebasePath,
          hasWeb,
        }),
        tools,
    });

    // Display actions as they happen, then ask the user to approve the action after the agent is done with its job
    let messages: any[] = [];
    let currentInput = goal.trim();

    while (true) {
        let result;

        try {
            sessionTracker.startTurn();
            let currentStep = 1;
            activity.setStep(currentStep, 40);
            activity.start("Parsing file mentions...");
            
            let finalInput = currentInput;
            const mentions = extractFileMentions(currentInput);
            if (mentions.length > 0) {
                const fileData = await buildFileContents(mentions);
                if (fileData) {
                    finalInput = `${currentInput}\n\n${fileData}`;
                }
            }

            // Loader
            activity.start("Thinking...");

            const allToolCalls: { toolName: string; args: any }[] = [];

            const generateOpts: any = {
                onStepFinish: ({ toolCalls, usage }: any) => {
                    currentStep++;
                    activity.setStep(Math.min(currentStep, 40), 40);

                    if (usage) {
                        const u = usage as any;
                        sessionTracker.addTokens(
                            u.promptTokens ?? u.inputTokens ?? 0,
                            u.completionTokens ?? u.outputTokens ?? 0,
                        );
                    }
                    for (const tc of toolCalls ?? []) {
                        if (!tc) continue;
                        sessionTracker.incrementToolCalls();
                        const args = tc.args ?? tc.input ?? {};
                        allToolCalls.push({ toolName: tc.toolName, args });
                        
                        // Live log to activity feed so user sees progress immediately
                        activity.logCompletedAction(tc.toolName, args);
                        activity.update(getToolMessage(tc.toolName, args));
                    }

                    // Force a refresh of the spinner with updated stats even if no tool was called
                    if (!toolCalls || toolCalls.length === 0) {
                        activity.update("Thinking...");
                    }
                }
            };

            if (messages.length > 0) {
                generateOpts.messages = [...messages, { role: "user", content: [{ type: "text", text: finalInput }] }];
            } else {
                generateOpts.prompt = finalInput;
            }

            result = await agent.stream(generateOpts);

            const responseText = await result.text;
            sessionTracker.endTurn();
            
            if (activity.isBusy) {
                activity.stop();
            }

            if (responseText || allToolCalls.length > 0) {
                taskTracker.detach();
            }

            if (responseText) {
                console.log(renderTerminalMarkdown(responseText));
            }

        } catch (err) {
            activity.fail("Agent Failed");
            activity.stop();
            throw err;
        }

        messages = (await result.response).messages;

        // Approval Flow 
        const ok = await runApprovalFlow(tracker);
        if (!ok) {
            executor.clearStaging();
        } else {
            const { errors } = executor.applyApprovedFromTracker();
            if (errors.length) {
                console.log(chalk.red("\nSome operations reported errors:\n"));
                for (const e of errors) {
                    console.log(chalk.red(` ⏺ ${e}`));
                }
            } else {
                console.log(chalk.green("\n✔️ Applied.\n"));
            }
            executor.clearStaging();
        }

        const nextInput = await text({
            message: "Continue chatting? (leave empty to exit)"
        });

        if (isCancel(nextInput) || !(nextInput as string).trim()) {
            break;
        }
        currentInput = (nextInput as string).trim();
    }
}