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
    };
}

function asMd(question: string, answer: string): string {
    return `# Ask Mode\n\n## Question\n\n${question.trim()}\n\n## Answer\n\n${answer.trim()}\n`;
};

export async function runAskMode(): Promise<void> { 
    console.log(chalk.bold("\n❓ Ask Mode\n"));
    activityEvents.onStart(msg => activity.update(msg));
    activityEvents.onFinish(msg => activity.success(msg));
    activityEvents.onSilentFinish(msg => activity.done(msg));
    activityEvents.onFail(msg => activity.fail(msg));

    const question = await text({
        message:"What do you want to ask ?"
    });
    if(isCancel(question) || !question.trim()) return;
    
    const config = defaultAgentConfig();
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
    };

    const agent = new ToolLoopAgent({
        model: getAgentModel(),
        stopWhen: stepCountIs(20),
        instructions: [
            `Workspace root: ${config.codebasePath}`,
            hasWeb
                ? "Web tools are available (web_search, web_crawl, fetch_url). Use web_crawl or fetch_url to scrape content from URLs when requested."
                : "Web tools are unavailable.",
        ].join("\n"),
        tools,
    });

    activity.start("Thinking...");
    const allToolCalls: { toolName: string, input: any }[] = [];

    const result = await agent.generate({
        prompt: question.trim(),
        onStepFinish: ({ toolCalls }) => {
            for (const tc of toolCalls) {
                if (!tc) continue;
                allToolCalls.push(tc);
            }
        }
    });

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

    const answer = result.text?.trim() || "(no answer)";
    console.log("\n" + renderTerminalMarkdown(answer) + "\n");

    const wantToSave = await confirm({
        message: "Save this to a markdown file in the current directory ?",
        initialValue: false,
    });
    if(isCancel(wantToSave) || !wantToSave) return;

    const filename= await text({
        message: "Filename",
        initialValue: "ask.md",
        validate: (v) => {
            const s = (v ?? '').trim();
            if(!s)return "Required";
            if(s.includes('..') || s.includes('/') || s.includes('\\'))return 'No Paths';
            if(!s.toLowerCase().endsWith('.md')) return "Must end with a .md";
        },
    });

    if(isCancel(filename) || !filename?.trim()){
        return;
    }

    executor.createFile(filename, asMd(question,answer));
    const ok = await runApprovalFlow(tracker);
    if(!ok) return executor.clearStaging();

    executor.applyApprovedFromTracker();
    executor.clearStaging();
}
