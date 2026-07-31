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
    
    console.log();
    console.log(chalk.cyan("╭────────────────────────────────────────────────────────────╮"));
    console.log(chalk.cyan("│") + " ".repeat(21) + chalk.bold("AdiClaw Session") + " ".repeat(24) + chalk.cyan("│"));
    console.log(chalk.cyan("├────────────────────────────────────────────────────────────┤"));
    
    console.log(chalk.cyan("│") + ` Provider        ${(s.provider || "-").padEnd(41)}` + chalk.cyan("│"));
    console.log(chalk.cyan("│") + ` Model           ${(s.model || "-").padEnd(41)}` + chalk.cyan("│"));
    console.log(chalk.cyan("│") + ` Duration        ${formatDuration(elapsedMs).padEnd(41)}` + chalk.cyan("│"));
    console.log(chalk.cyan("│") + " ".repeat(58) + chalk.cyan("│"));
    
    console.log(chalk.cyan("│") + ` AI Requests     ${fmt(s.aiRequests).padEnd(41)}` + chalk.cyan("│"));
    
    const tokenStr = `${fmt(s.inputTokens + s.outputTokens)} (${fmt(s.inputTokens)} in • ${fmt(s.outputTokens)} out)`;
    console.log(chalk.cyan("│") + ` Tokens          ${tokenStr.padEnd(41)}` + chalk.cyan("│"));
    console.log(chalk.cyan("│") + " ".repeat(58) + chalk.cyan("│"));
    
    const fileStr = `${s.filesRead} read • ${s.filesModified} modified • ${s.filesCreated} created`;
    console.log(chalk.cyan("│") + ` Files           ${fileStr.padEnd(41)}` + chalk.cyan("│"));
    console.log(chalk.cyan("│") + ` Commands        ${fmt(s.shellCommands).padEnd(41)}` + chalk.cyan("│"));
    console.log(chalk.cyan("│") + ` Tool Calls      ${fmt(s.toolCalls).padEnd(41)}` + chalk.cyan("│"));
    console.log(chalk.cyan("│") + " ".repeat(58) + chalk.cyan("│"));
    
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
    console.log(chalk.cyan("│") + ` Status          ${statusText}${statusSpace}` + chalk.cyan("│"));
    
    console.log(chalk.cyan("╰────────────────────────────────────────────────────────────╯"));
}