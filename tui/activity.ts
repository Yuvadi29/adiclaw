import chalk from "chalk";
import { spinner } from "@clack/prompts";
import { sessionTracker, classifyTool, type ToolCategory } from "../ai/session/session-tracker";

export function formatArgsSummary(toolName: string, args: any): string {
    if (!args || typeof args !== "object") return "";
    
    // Custom formatted summaries for known tools
    if (args.path && typeof args.path === "string") {
        let extra = "";
        if (args.content && typeof args.content === "string") {
            const lineCount = args.content.split("\n").length;
            extra = chalk.dim(` (${lineCount} lines)`);
        }
        return ` ${chalk.dim("path=")}${chalk.cyan(`"${args.path}"`)}${extra}`;
    }

    if (args.pattern && typeof args.pattern === "string") {
        return ` ${chalk.dim("pattern=")}${chalk.cyan(`"${args.pattern}"`)}`;
    }

    if (args.command && typeof args.command === "string") {
        const cmdPreview = args.command.length > 35 ? args.command.slice(0, 32) + "..." : args.command;
        return ` ${chalk.dim("cmd=")}${chalk.cyan(`"${cmdPreview}"`)}`;
    }

    if (args.query && typeof args.query === "string") {
        const queryPreview = args.query.length > 35 ? args.query.slice(0, 32) + "..." : args.query;
        return ` ${chalk.dim("query=")}${chalk.cyan(`"${queryPreview}"`)}`;
    }

    if (args.url && typeof args.url === "string") {
        return ` ${chalk.dim("url=")}${chalk.cyan(`"${args.url}"`)}`;
    }

    if (args.notePath && typeof args.notePath === "string") {
        return ` ${chalk.dim("note=")}${chalk.cyan(`"${args.notePath}"`)}`;
    }

    const entries = Object.entries(args);
    if (entries.length === 0) return "";

    const summaryParts: string[] = [];
    for (const [k, v] of entries.slice(0, 3)) {
        if (k === "content") {
            const lines = typeof v === "string" ? v.split("\n").length : 1;
            summaryParts.push(`${chalk.dim(k)}=${chalk.dim(`[${lines} lines]`)}`);
            continue;
        }
        let valStr = typeof v === "string" ? `"${v}"` : JSON.stringify(v);
        if (valStr.length > 25) {
            valStr = valStr.slice(0, 22) + '..."';
        }
        summaryParts.push(`${chalk.dim(k)}=${chalk.cyan(valStr)}`);
    }

    return summaryParts.length ? ` ${chalk.dim(`(${summaryParts.join(" ")})`)}` : "";
}

export function formatToolCategoryBadge(toolName: string): string {
    const category = classifyTool(toolName);
    switch (category) {
        case "workspace":
            return chalk.bgHex("#2563EB").white.bold(" WORKSPACE ");
        case "mcp":
            if (toolName.startsWith("youtube_")) {
                return chalk.bgHex("#DC2626").white.bold(" MCP: YOUTUBE ");
            }
            if (toolName.startsWith("github_")) {
                return chalk.bgHex("#18181B").white.bold(" MCP: GITHUB ");
            }
            return chalk.bgHex("#475569").white.bold(" MCP ");
        case "web":
            return chalk.bgHex("#0284C7").white.bold(" WEB ");
        case "obsidian":
            return chalk.bgHex("#7C3AED").white.bold(" OBSIDIAN ");
        case "shell":
            return chalk.bgHex("#D97706").white.bold(" SHELL ");
        default:
            return chalk.bgHex("#4B5563").white.bold(" SYSTEM ");
    }
}

export function formatToolCallBadge(
    toolName: string,
    args: any,
    durationMs?: number,
    success: boolean = true
): string {
    const sourceBadge = formatToolCategoryBadge(toolName);
    const formattedArgs = formatArgsSummary(toolName, args);

    let durationStr = "";
    if (durationMs !== undefined && durationMs >= 0) {
        durationStr = chalk.dim(durationMs < 1000 ? ` (${durationMs}ms)` : ` (${(durationMs / 1000).toFixed(1)}s)`);
    }

    const toolNameStyled = success ? chalk.bold.white(toolName) : chalk.bold.red(toolName);
    return `${sourceBadge} ${toolNameStyled}${formattedArgs}${durationStr}`;
}

export class ActivityRenderer {
    private s = spinner();
    private _isBusy = false;
    private started = false;
    private provider = "";
    private model = "";

    // Step & Phase context
    private currentStep?: { current: number; total: number };
    private currentPhase?: string;
    private actionStartTime: number = 0;
    private currentActionMessage: string = "Thinking...";

    get isBusy() {
        return this._isBusy;
    }

    setStep(current: number, total: number) {
        this.currentStep = { current, total };
        if (this.started) {
            this.update(this.currentActionMessage);
        }
    }

    clearStep() {
        this.currentStep = undefined;
    }

    setPhase(phase: string) {
        this.currentPhase = phase;
        if (this.started) {
            this.update(this.currentActionMessage);
        }
    }

    private formatDisplayMessage(message: string): string {
        const stepPrefix = this.currentStep
            ? chalk.hex("#A5B4FC").bold(`[Step ${this.currentStep.current}/${this.currentStep.total}] `)
            : "";

        const phasePrefix = this.currentPhase ? chalk.magenta(`[${this.currentPhase}] `) : "";

        const ticker = sessionTracker.getTickerSummary();
        return `${stepPrefix}${phasePrefix}${chalk.bold(message)} ${chalk.dim(`[${ticker}]`)}`;
    }

    start(message?: string) {
        const startMsg = message ?? "Thinking...";
        this.currentActionMessage = startMsg;
        this.actionStartTime = Date.now();

        if (this.started) {
            this.update(startMsg);
            return;
        }

        this.started = true;
        this._isBusy = true;
        this.s.start(this.formatDisplayMessage(startMsg));
    }

    update(message: string) {
        this._isBusy = true;
        this.currentActionMessage = message;

        if (this.started) {
            this.s.message(this.formatDisplayMessage(message));
        }
    }

    /**
     * Log a completed step or tool permanently to the console feed
     * above the active spinner without interrupting the flow.
     */
    logCompletedAction(
        toolName: string,
        args: any,
        durationMs?: number,
        success: boolean = true,
        customMessage?: string
    ) {
        const statusIcon = success ? chalk.green("✔") : chalk.red("✖");
        const badge = customMessage ?? formatToolCallBadge(toolName, args, durationMs, success);

        if (this.started) {
            // Temporarily stop spinner without clearing message
            this.s.stop();
            console.log(`  ${statusIcon} ${badge}`);
            // Restart spinner with updated stats ticker
            this.s.start(this.formatDisplayMessage(this.currentActionMessage));
        } else {
            console.log(`  ${statusIcon} ${badge}`);
        }
    }

    success(message: string) {
        this._isBusy = false;
        if (this.started) {
            this.s.message(chalk.green(`✔ ${message}`));
        }
    }

    done(message?: string) {
        this._isBusy = false;
        if (this.started && message) {
            this.s.message(chalk.gray(message));
        }
    }

    fail(message: string) {
        this._isBusy = false;
        if (this.started) {
            this.s.message(chalk.red(`✖ ${message}`));
        }
    }

    stop(finalMessage?: string) {
        if (!this.started) return;
        this.started = false;
        this._isBusy = false;
        this.currentStep = undefined;
        this.currentPhase = undefined;
        this.s.stop(finalMessage ? chalk.green(`✔ ${finalMessage}`) : undefined);
    }

    setSession(provider: string, model: string) {
        this.provider = provider;
        this.model = model;
    }
}

export const activity = new ActivityRenderer();