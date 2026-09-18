import chalk from "chalk";
import { sessionTracker } from "./session-tracker";

function formatDuration(ms: number) {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`;
}

export function printSessionSummary() {
    const s = sessionTracker.get();
    
    if ((global as any).__SESSION_SUMMARY_PRINTED__) return;
    (global as any).__SESSION_SUMMARY_PRINTED__ = true;
    
    const elapsedMs = ((s.endedAt ?? Date.now()) - s.startedAt);
    const fmt = (n: number) => n.toLocaleString();
    const costStr = sessionTracker.getFormattedCost();
    
    console.log();
    console.log(chalk.hex("#6366F1")("╭────────────────────────────────────────────────────────────╮"));
    console.log(chalk.hex("#6366F1")("│") + " ".repeat(21) + chalk.bold.whiteBright("AdiClaw Session") + " ".repeat(24) + chalk.hex("#6366F1")("│"));
    console.log(chalk.hex("#6366F1")("├────────────────────────────────────────────────────────────┤"));
    
    console.log(chalk.hex("#6366F1")("│") + ` Provider        ${(s.provider || "-").padEnd(41)}` + chalk.hex("#6366F1")("│"));
    console.log(chalk.hex("#6366F1")("│") + ` Model           ${(s.model || "-").padEnd(41)}` + chalk.hex("#6366F1")("│"));
    console.log(chalk.hex("#6366F1")("│") + ` Duration        ${formatDuration(elapsedMs).padEnd(41)}` + chalk.hex("#6366F1")("│"));
    console.log(chalk.hex("#6366F1")("│") + " ".repeat(58) + chalk.hex("#6366F1")("│"));
    
    const reqStr = `${fmt(s.aiRequests)} requests (${s.turnCount} turns)`;
    console.log(chalk.hex("#6366F1")("│") + ` AI Requests     ${reqStr.padEnd(41)}` + chalk.hex("#6366F1")("│"));
    
    const tokenStr = `${fmt(s.inputTokens + s.outputTokens)} (${fmt(s.inputTokens)} in • ${fmt(s.outputTokens)} out)`;
    console.log(chalk.hex("#6366F1")("│") + ` Tokens          ${tokenStr.padEnd(41)}` + chalk.hex("#6366F1")("│"));
    console.log(chalk.hex("#6366F1")("│") + ` Estimated Cost  ${costStr.padEnd(41)}` + chalk.hex("#6366F1")("│"));
    console.log(chalk.hex("#6366F1")("│") + " ".repeat(58) + chalk.hex("#6366F1")("│"));
    
    const fileStr = `${s.filesRead} read • ${s.filesModified} mod • ${s.filesCreated} new • ${s.filesDeleted} del`;
    console.log(chalk.hex("#6366F1")("│") + ` Files           ${fileStr.padEnd(41)}` + chalk.hex("#6366F1")("│"));
    
    const { workspace: ws, mcp, web, obsidian: obs, shell } = s.toolsByCategory;
    const toolStr = `${fmt(s.toolCalls)} total (${ws} ws • ${mcp} mcp • ${web} web • ${shell} sh)`;
    console.log(chalk.hex("#6366F1")("│") + ` Tool Calls      ${toolStr.padEnd(41)}` + chalk.hex("#6366F1")("│"));
    console.log(chalk.hex("#6366F1")("│") + " ".repeat(58) + chalk.hex("#6366F1")("│"));
    
    let rawStatus = "";
    let statusText = "";
    
    switch (s.status) {
        case "completed":
            rawStatus = "✓ Completed";
            statusText = chalk.green(rawStatus);
            break;
        case "cancelled":
            rawStatus = "⚠ Cancelled (Ctrl+C)";
            statusText = chalk.yellow(rawStatus);
            break;
        case "crashed":
            rawStatus = "✖ Crashed";
            statusText = chalk.red(rawStatus);
            break;
        default:
            rawStatus = "✓ Completed";
            statusText = chalk.green(rawStatus);
            break;
    }
    
    const statusSpace = " ".repeat(Math.max(0, 41 - rawStatus.length));
    console.log(chalk.hex("#6366F1")("│") + ` Status          ${statusText}${statusSpace}` + chalk.hex("#6366F1")("│"));
    
    console.log(chalk.hex("#6366F1")("╰────────────────────────────────────────────────────────────╯"));
}