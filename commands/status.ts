import chalk from "chalk";
import type { Command } from "./types";
import { aiSession } from "../ai/session";
import { sessionTracker } from "../ai/session/session-tracker";
import { workspace } from "../workspace/index";

export const statusCommand: Command = {
    name: "status",
    description: "Show current session and workspace info",

    async execute() {
        const sess = aiSession.get();
        const metrics = sessionTracker.get();
        const stats = workspace.getStats();

        const elapsed = Date.now() - metrics.startedAt;
        const mins = Math.floor(elapsed / 60_000);
        const secs = Math.floor((elapsed % 60_000) / 1000);

        console.log();
        console.log(chalk.bold("  Session"));
        console.log(`  Provider:    ${chalk.white(sess.providerName || sess.provider)}`);
        console.log(`  Model:       ${chalk.white(sess.model)}`);
        console.log(`  Uptime:      ${chalk.white(`${mins}m ${secs}s`)}`);
        console.log(`  AI Requests: ${chalk.white(String(metrics.aiRequests))}`);
        console.log(`  Tool Calls:  ${chalk.white(String(metrics.toolCalls))}`);
        console.log();
        console.log(chalk.bold("  Workspace"));
        console.log(`  Files:       ${chalk.white(String(stats.totalFiles))}`);
        console.log(`  Directories: ${chalk.white(String(stats.totalDirectories))}`);
        console.log();
    }
};
