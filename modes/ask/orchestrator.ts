import { confirm, isCancel, text } from "@clack/prompts";
import chalk from "chalk";
import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { getAgentModel } from "../../ai/ai.config";
import { ActionTracker } from "../agent/action-tracker";
import { ToolExecutor } from "../agent/tool-executor";
import { defaultAgentConfig } from "../agent/types";
import { renderTerminalMarkdown } from "../../tui/terminal-md";
import { runApprovalFlow } from "../agent/approval";
import { createWebTools } from "../plan/web-tools";
import { activity } from "../../tui/activity";
import { activityEvents } from "../agent/activity-events";
import { sessionTracker } from "../../ai/session/session-tracker";
import { getAITools } from "../../mcp";
import { buildWorkspaceSummary } from "../../workspace/summary";
function createAskTools(executor: ToolExecutor) {
    return {
        read_file: tool({
            description:
                "Read a text file from the workspace. Use a path relative to the project root.",
            inputSchema: z.object({
                path: z.string().describe("Relative file path"),
            }),
            execute: async ({ path: p }) => executor.readFile(p),
        }),

        list_files: tool({
            description: "List files and directories under a path.",
            inputSchema: z.object({
                path: z.string(),
                recursive: z.boolean().optional().default(false),
            }),
            execute: async ({ path: p, recursive }) =>
                executor.listFiles(p, recursive),
        }),

        search_files: tool({
            description:
                'Find files matching a glob pattern (e.g. "*.ts", "**/*.md"). Optional content substring filter.',
            inputSchema: z.object({
                root: z.string().describe("Directory to search, relative to root"),
                pattern: z
                    .string()
                    .describe("Glob-like pattern using * and ** (forward slashes)"),
                content_contains: z.string().optional(),
            }),
            execute: async ({ root, pattern, content_contains }) =>
                executor.searchFiles(root, pattern, content_contains),
        }),

        analyze_codebase: tool({
            description:
                "Summarize structure: file counts, size, extensions. Read-only.",
            inputSchema: z.object({
                path: z.string().default("."),
            }),
            execute: async ({ path: p }) => executor.analyzeCodebase(p),
        }),

        list_skills: tool({
            description:
                "List absolute paths to SKILL.md files under configured skill directories (Cursor / Claude).",
            inputSchema: z.object({}),
            execute: async () => executor.listSkills(),
        }),

        read_skill: tool({
            description:
                "Read a SKILL.md file. Path must be absolute and under skill roots, or use a path returned by list_skills.",
            inputSchema: z.object({
                path: z.string(),
            }),
            execute: async ({ path: p }) => executor.readSkill(p),
        }),

        obsidian_search: tool({
            description: "Search for a query in your Obsidian vault.",
            inputSchema: z.object({
                query: z.string().describe("Search query"),
            }),
            execute: async ({ query }) => executor.searchObsidian(query),
        }),

        obsidian_read: tool({
            description: "Read a specific markdown note from your Obsidian vault.",
            inputSchema: z.object({
                notePath: z.string().describe("Relative path to the note (e.g., 'Ideas/AdiClaw.md')"),
            }),
            execute: async ({ notePath }) => executor.readObsidian(notePath),
        }),
    };
}

function asMd(question: string, answer: string): string {
    return `# Ask Mode\n\n## Question\n\n${question.trim()}\n\n## Answer\n\n${answer.trim()}\n`;
};

export async function runAskMode(initialQuestion?: string): Promise<void> { 
    console.log(chalk.bold("\n❓ Ask Mode\n"));
    activityEvents.onStart(msg => activity.update(msg));
    activityEvents.onFinish(msg => activity.success(msg));
    activityEvents.onSilentFinish(msg => activity.done(msg));
    activityEvents.onFail(msg => activity.fail(msg));

    let question = initialQuestion;
    if (!question) {
        const input = await text({
            message: "What do you want to ask ?",
            placeholder: "e.g. How does the router work?",
        });
        if (isCancel(input) || !input.trim()) return;
        question = input.trim();
    }
    
    const config = defaultAgentConfig();
    const summary = buildWorkspaceSummary();
    const gitRemoteText = summary.gitRemote ? `Connected to GitHub repository: ${summary.gitRemote}` : "";
    config.tools.allowFileCreation = true;
    config.tools.allowFileModification = false;
    config.tools.allowFolderCreation = false;
    config.tools.allowShellExecution = false;

    const tracker = new ActionTracker();
    const executor = new ToolExecutor(tracker, config);

    const hasWeb = !!process.env.FIRECRAWL_API_KEY;
    const tools = {
        ...createAskTools(executor),
        ...(hasWeb ? createWebTools(tracker) : {}),
        ...getAITools(),
    };

    const agent = new ToolLoopAgent({
        model: getAgentModel(),
        stopWhen: stepCountIs(20),
        instructions: [
            "You are a helpful AI assistant. You have access to tools that can read the file system. YOU MUST USE THESE TOOLS natively to answer the user's questions.",
            "DO NOT write scripts to read files. DO NOT hallucinate file contents. ALWAYS use the `read_file` or `search_files` tool first to gather information.",
            "CRITICAL: You are in READ-ONLY mode. You CANNOT create, modify, or delete files. If the user asks you to create a file, you MUST inform them to use /agent or /plan mode instead.",
            `Workspace root: ${config.codebasePath}`,
            gitRemoteText,
            hasWeb
                ? "Web tools are available (web_search, web_crawl, fetch_url). Use web_crawl or fetch_url to scrape content from URLs when requested."
                : "Web tools are unavailable.",
            "CRITICAL RULES FOR OBSIDIAN VAULT:",
            "1. Whenever you are asked to work on a project, search for notes, or check Obsidian, you MUST use the 'obsidian_search' tool first.",
            "2. DO NOT use 'search_files' or 'list_files' to look for Obsidian notes. The vault is outside the workspace and ONLY accessible via 'obsidian_search' and 'obsidian_read'.",
        ].join("\n"),
        tools,
    });

    activityEvents.clear();
    activityEvents.onStart(msg => {
        if (!activity.isBusy) activity.start(msg);
        else activity.update(msg);
    });
    activityEvents.onFinish(msg => activity.update(msg + chalk.green(" ✓")));
    activityEvents.onSilentFinish(msg => activity.update(msg + chalk.dim(" ✓")));
    activityEvents.onFail(msg => {
        activity.update(chalk.red("Failed: " + msg));
    });

    let messages: any[] = [];
    let currentInput = question.trim();

    while (true) {
        activity.start("Thinking...");
        const allToolCalls: { toolName: string, input: any }[] = [];

        const generateOpts: any = {
            onStepFinish: ({ toolCalls, usage }: any) => {
                if (usage) {
                    const u = usage as any;
                    sessionTracker.addTokens(u.promptTokens ?? u.inputTokens ?? 0, u.completionTokens ?? u.outputTokens ?? 0);
                }
                for (const tc of toolCalls) {
                    if (!tc) continue;
                    sessionTracker.incrementToolCalls();
                    allToolCalls.push(tc);
                }
            }
        };

        if (messages.length > 0) {
            generateOpts.messages = [...messages, { role: "user", content: [{ type: "text", text: currentInput }] }];
        } else {
            generateOpts.prompt = currentInput;
        }

        const result = await agent.stream(generateOpts);

        // Consume the text stream and output it directly to stdout
        for await (const chunk of result.textStream) {
            if (activity.isBusy) {
                activity.stop(); // Hides the spinner while streaming text
            }
            process.stdout.write(chunk);
        }
        
        console.log(); // Final newline

        activity.stop("Ask Finished");

        if (allToolCalls.length > 0) {
            console.log(chalk.bold.cyan("\n🛠️  Tools Executed:"));
            for (const tc of allToolCalls) {
                const preview = JSON.stringify(tc.input).slice(0, 80);
                console.log(
                    chalk.green(' ✔️'),
                    chalk.bold(String(tc.toolName)),
                    chalk.dim(preview + (preview.length >= 80 ? "..." : ""))
                );
            }
            console.log();
        }

        const responseText = await result.text;
        const answer = responseText?.trim() || "(no answer)";
        messages = (await result.response).messages;

        const nextInput = await text({
            message: "Continue chatting? (leave empty to exit or save)"
        });

        if (isCancel(nextInput) || !(nextInput as string).trim()) {
            break;
        }
        currentInput = (nextInput as string).trim();
    }

    const wantToSave = await confirm({
        message: "Save this conversation to a markdown file in the current directory ?",
        initialValue: false,
    });
    if (isCancel(wantToSave) || !wantToSave) return;

    const filename = await text({
        message: "Filename",
        initialValue: "ask.md",
        validate: (v) => {
            const s = (v ?? '').trim();
            if (!s) return "Required";
            if (s.includes('..') || s.includes('/') || s.includes('\\')) return 'No Paths';
            if (!s.toLowerCase().endsWith('.md')) return "Must end with a .md";
        },
    });

    if (isCancel(filename) || !(filename as string)?.trim()) {
        return;
    }

    const fileContent = messages
        .filter(m => m.role === "user" || m.role === "assistant")
        .map(m => `**${m.role.toUpperCase()}:**\n${m.content.map((c: any) => c.text).join("\n")}\n\n`)
        .join("\n");

    executor.createFile((filename as string), fileContent);
    const ok = await runApprovalFlow(tracker);
    if (!ok) return executor.clearStaging();

    executor.applyApprovedFromTracker();
    executor.clearStaging();
}
