import chalk from "chalk";
import type { Command } from "./types";
import { aiSession } from "../ai/session";
import { sessionTracker } from "../ai/session/session-tracker";
import { workspace } from "../workspace/index";

function visibleLength(str: string): number {
    // Strip ANSI escape codes to get accurate visible character length
    return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, "").length;
}

export const statusCommand: Command = {
    name: "status",
    description: "Show comprehensive live session statistics and activity dashboard",

    async execute() {
        const sess = aiSession.get();
        const metrics = sessionTracker.get();
        const stats = workspace.getStats();

        const elapsed = Date.now() - metrics.startedAt;
        const mins = Math.floor(elapsed / 60_000);
        const secs = Math.floor((elapsed % 60_000) / 1000);
        const uptimeStr = `${mins}m ${secs}s`;

        const fmt = (n: number) => n.toLocaleString();
        const totalTokens = metrics.inputTokens + metrics.outputTokens;
        const costStr = sessionTracker.getFormattedCost();

        const width = 68;
        const border = chalk.hex("#6366F1");
        const header = chalk.hex("#818CF8").bold;
        const label = (txt: string) => chalk.dim(txt.padEnd(16));
        const val = (txt: string) => chalk.whiteBright(txt);

        const padLine = (content: string) => {
            const visLen = visibleLength(content);
            const padding = Math.max(0, width - 4 - visLen);
            return border("│ ") + content + " ".repeat(padding) + border(" │");
        };

        console.log();
        console.log(border("╭" + "─".repeat(width - 2) + "╮"));
        
        // Header
        const headerText = "🐾 AdiClaw Live Session Dashboard";
        const hVis = visibleLength(headerText);
        const headerPaddingLeft = Math.floor((width - 2 - hVis) / 2);
        const headerPaddingRight = width - 2 - hVis - headerPaddingLeft;
        console.log(
            border("│") +
            " ".repeat(headerPaddingLeft) +
            header(headerText) +
            " ".repeat(headerPaddingRight) +
            border("│")
        );
        console.log(border("├" + "─".repeat(width - 2) + "┤"));

        // Runtime Section
        console.log(padLine(chalk.cyan.bold("⚡ SESSION & RUNTIME")));
        console.log(padLine(`  ${label("Provider:")} ${val(sess.providerName || sess.provider || "default")}`));
        console.log(padLine(`  ${label("Model:")} ${val(sess.model || "default")}`));
        console.log(padLine(`  ${label("Uptime:")} ${val(uptimeStr)}`));
        console.log(padLine(`  ${label("AI Requests:")} ${val(fmt(metrics.aiRequests))} ${chalk.dim(`(${metrics.turnCount} turns)`)}`));

        console.log(border("├" + "─".repeat(width - 2) + "┤"));

        // Tokens & Cost Section
        console.log(padLine(chalk.yellow.bold("🪙 TOKENS & ESTIMATED COST")));
        console.log(padLine(`  ${label("Input Tokens:")} ${val(fmt(metrics.inputTokens))}`));
        console.log(padLine(`  ${label("Output Tokens:")} ${val(fmt(metrics.outputTokens))}`));
        console.log(padLine(`  ${label("Total Tokens:")} ${chalk.greenBright.bold(fmt(totalTokens))}`));
        console.log(padLine(`  ${label("Estimated Cost:")} ${chalk.bold.yellowBright(costStr)}`));

        console.log(border("├" + "─".repeat(width - 2) + "┤"));

        // Tools & Activity Section
        const { workspace: wsCount, mcp: mcpCount, web: webCount, obsidian: obsCount, shell: shellCount } = metrics.toolsByCategory;
        const totalTools = metrics.toolCalls;
        console.log(padLine(chalk.magenta.bold(`🛠️  OPERATIONS & TOOLS (${totalTools} total)`)));
        console.log(padLine(`  ${label("Workspace Tools:")} ${val(String(wsCount))}`));
        console.log(padLine(`  ${label("MCP Servers:")} ${val(String(mcpCount))}`));
        console.log(padLine(`  ${label("Web Research:")} ${val(String(webCount))}`));
        console.log(padLine(`  ${label("Obsidian Notes:")} ${val(String(obsCount))}`));
        console.log(padLine(`  ${label("Shell Executions:")} ${val(String(shellCount))}`));

        console.log(border("├" + "─".repeat(width - 2) + "┤"));

        // Filesystem & Workspace Section
        console.log(padLine(chalk.blueBright.bold("📁 FILESYSTEM & WORKSPACE")));
        const fileMetrics = `${metrics.filesRead} read • ${metrics.filesModified} modified • ${metrics.filesCreated} created • ${metrics.filesDeleted} deleted`;
        console.log(padLine(`  ${label("File Activity:")} ${val(fileMetrics)}`));
        const wsMetrics = `${fmt(stats.totalFiles)} files in ${fmt(stats.totalDirectories)} directories`;
        console.log(padLine(`  ${label("Workspace:")} ${val(wsMetrics)}`));

        console.log(border("╰" + "─".repeat(width - 2) + "╯"));
        console.log();
    }
};
