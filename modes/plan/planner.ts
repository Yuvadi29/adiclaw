import { z } from "zod";
import { ToolExecutor } from "../agent/tool-executor";
import { extractJsonMiddleware, generateText, Output, stepCountIs, streamText, tool, wrapLanguageModel } from "ai";
import { defaultAgentConfig } from "../agent/types";
import { ActionTracker } from "../agent/action-tracker";
import { getAgentModel } from "../../ai/ai.config";
import chalk from "chalk";
import type { PlanStep } from "./types";
import { createWebTools } from "./web-tools";

const planSchema = z.object({
    researchSummary: z.string().optional(),
    steps: z
        .array(
            z.object({
                title: z.string(),
                description: z.string(),
                hints: z.array(z.string()).optional(),
                complexity: z.enum(["low", "medium", "high"]).optional(),
            }),
        ).min(1).max(15),
});

function readOnlyTools(executor: ToolExecutor) {
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
};

const PLAN_INSTRUCTIONS = (codebase: string, hasWeb: boolean) => [
    "You are a Plan-Mode planner. You DO NOT modify files.",
    `Workspace: ${codebase}`,
    "Use read-only tools for codebase/skills research.",
    hasWeb ? "Web tools are available (web_search/web_crawl/fetch_url). Use only when needed." : "Web tools are unavailable (no FIRECRAWL_API_KEY).",
    "Output must match the provided JSON schema.",
    "Keep it short: 1-15 steps.",
    "CRITICAL RULES FOR OBSIDIAN VAULT:",
    "1. Whenever you are asked to work on a project, search for notes, or check Obsidian, you MUST use the 'obsidian_search' tool first.",
    "2. DO NOT use 'search_files' or 'list_files' to look for Obsidian notes. The vault is outside the workspace and ONLY accessible via 'obsidian_search' and 'obsidian_read'.",
].join("\n");

export async function generatePlan(goal: string) {
    const config = defaultAgentConfig();
    const tracker = new ActionTracker();
    const executor = new ToolExecutor(tracker, config);

    const hasWeb = !!process.env.FIRECRAWL_API_KEY;
    const model = wrapLanguageModel({
        model: getAgentModel(),
        middleware: extractJsonMiddleware()
    });

    const tools = { ...readOnlyTools(executor), ...(hasWeb ? createWebTools(tracker) : {}) };
    console.log(chalk.cyan("\n🔍 Researching & drafting a plan…\n"));

    const result = await streamText({
        model,
        tools,
        stopWhen: stepCountIs(20),
        system: PLAN_INSTRUCTIONS(config.codebasePath, hasWeb),
        prompt: `User goal: \b${goal}`,
        output: Output.object({
            schema: planSchema
        })
    });

    for await (const chunk of result.textStream) {
        process.stdout.write(chalk.cyan(chunk));
    }
    
    const finalOutput = await result.output;
    const validated = planSchema.parse(finalOutput);

    const steps: PlanStep[] = validated.steps.map((s, i) => ({
        id: `step-${i + 1}`,
        title: s.title,
        description: s.description,
        hints: s.hints,
        complexity: s.complexity
    }));

    return {
        goal,
        researchSummary: validated.researchSummary,
        steps
    }
}