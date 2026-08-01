import { tool } from "ai";
import { z } from "zod";
import type { ToolExecutor } from "./tool-executor";
import type { TaskTracker } from "./task-tracker";

export function createAgentTools(executor: ToolExecutor, taskTracker?: TaskTracker) {
    return {
        read_file: tool({
            description:
                "Read a text file from the workspace. Use a path relative to the project root.",
            inputSchema: z.object({
                path: z.string().describe("Relative file path"),
            }),
            execute: async ({ path: p }) => executor.readFile(p),
        }),

        create_file: tool({
            description:
                "Stage creation of a new file (not written until the user approves).",
            inputSchema: z.object({
                path: z.string(),
                content: z.string(),
            }),
            execute: async ({ path: p, content }) => executor.createFile(p, content),
        }),

        modify_file: tool({
            description:
                "Stage a full-file replacement for an existing file (pending approval).",
            inputSchema: z.object({
                path: z.string(),
                content: z.string().describe("Complete new file contents"),
            }),
            execute: async ({ path: p, content }) => executor.modifyFile(p, content),
        }),

        delete_file: tool({
            description: "Stage deletion of a file (pending approval).",
            inputSchema: z.object({
                path: z.string(),
            }),
            execute: async ({ path: p }) => executor.deleteFile(p),
        }),

        create_folder: tool({
            description:
                "Stage creation of a directory tree (pending approval). Uses mkdir -p on apply.",
            inputSchema: z.object({
                path: z.string().describe("Relative directory path"),
            }),
            execute: async ({ path: p }) => executor.createFolder(p),
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

        execute_shell: tool({
            description:
                "Queue a shell command to run in the workspace after user approval. Use with care.",
            inputSchema: z.object({
                command: z.string().describe("Single command; runs with shell: true"),
            }),
            execute: async ({ command }) => executor.queueShell(command),
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

        manage_tasks: tool({
            description: "Manage a checklist of tasks to track your own progress.",
            inputSchema: z.object({
                action: z.enum(["set", "start", "complete", "fail"]),
                tasks: z.array(z.object({
                    id: z.string(),
                    title: z.string(),
                    status: z.enum(["pending", "running", "completed", "failed"])
                })).optional().describe("Provide full task list when action is 'set'"),
                taskId: z.string().optional().describe("Provide taskId when action is start/complete/fail")
            }),
            execute: async ({ action, tasks, taskId }) => {
                if (!taskTracker) return "Task tracker unavailable.";
                switch (action) {
                    case "set":
                        if (tasks) taskTracker.setTasks(tasks);
                        return "Tasks set.";
                    case "start":
                        if (taskId) taskTracker.start(taskId);
                        return `Task ${taskId} started.`;
                    case "complete":
                        if (taskId) taskTracker.complete(taskId);
                        return `Task ${taskId} completed.`;
                    case "fail":
                        if (taskId) taskTracker.fail(taskId);
                        return `Task ${taskId} failed.`;
                }
            }
        }),

        run_tests: tool({
            description: "Run 'bun test' on the codebase. Pass an optional file path to test a specific file.",
            inputSchema: z.object({
                target: z.string().optional().describe("Optional file path to test"),
            }),
            execute: async ({ target }) => executor.runTests(target),
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