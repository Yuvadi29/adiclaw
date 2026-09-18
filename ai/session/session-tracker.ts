export type SessionStatus = "completed" | "cancelled" | "crashed";

export type ToolCategory = "workspace" | "mcp" | "web" | "obsidian" | "shell" | "other";

export interface ToolExecutionRecord {
    toolName: string;
    category: ToolCategory;
    durationMs: number;
    success: boolean;
    timestamp: number;
}

export interface TurnMetrics {
    startedAt: number;
    endedAt?: number;
    inputTokens: number;
    outputTokens: number;
    toolCalls: number;
    durationMs: number;
    tokensPerSec: number;
}

export interface SessionMetrics {
    startedAt: number;
    endedAt?: number;
    status?: SessionStatus;

    provider: string;
    model: string;

    aiRequests: number;

    inputTokens: number;
    outputTokens: number;

    toolCalls: number;

    // Granular tool category counts
    toolsByCategory: Record<ToolCategory, number>;
    toolHistory: ToolExecutionRecord[];

    filesRead: number;
    filesModified: number;
    filesCreated: number;
    filesDeleted: number;

    shellCommands: number;

    // Cost estimation
    estimatedCost: number;

    // Active/current turn metrics
    turnCount: number;
    currentTurn?: TurnMetrics;
}

// Pricing per million tokens (input / output)
const MODEL_PRICING: Record<string, { in: number; out: number }> = {
    // Anthropic
    "claude-3-5-sonnet": { in: 3.0, out: 15.0 },
    "claude-3.5-sonnet": { in: 3.0, out: 15.0 },
    "claude-3-opus": { in: 15.0, out: 75.0 },
    "claude-3-5-haiku": { in: 0.8, out: 4.0 },
    "claude-3.5-haiku": { in: 0.8, out: 4.0 },
    
    // OpenAI
    "gpt-4o": { in: 2.5, out: 10.0 },
    "gpt-4o-mini": { in: 0.15, out: 0.6 },
    "o1": { in: 15.0, out: 60.0 },
    "o1-mini": { in: 3.0, out: 12.0 },
    "o3-mini": { in: 1.1, out: 4.4 },

    // DeepSeek
    "deepseek-chat": { in: 0.14, out: 0.28 },
    "deepseek-r1": { in: 0.55, out: 2.19 },
    "deepseek-reasoner": { in: 0.55, out: 2.19 },

    // Google Gemini
    "gemini-2.0-flash": { in: 0.10, out: 0.40 },
    "gemini-1.5-pro": { in: 1.25, out: 5.00 },
    "gemini-1.5-flash": { in: 0.075, out: 0.30 },

    // Meta Llama
    "llama-3.3-70b": { in: 0.35, out: 0.40 },
    "llama-3.1-8b": { in: 0.05, out: 0.05 },

    // Ollama / Local
    "ollama": { in: 0.0, out: 0.0 },
};

export function classifyTool(toolName: string): ToolCategory {
    if (toolName.startsWith("youtube_") || toolName.startsWith("github_")) {
        return "mcp";
    }
    if (toolName.startsWith("web_") || toolName === "fetch_url") {
        return "web";
    }
    if (toolName.startsWith("obsidian_")) {
        return "obsidian";
    }
    if (toolName === "execute_shell") {
        return "shell";
    }
    const workspaceTools = [
        "read_file",
        "create_file",
        "modify_file",
        "delete_file",
        "create_folder",
        "list_files",
        "search_files",
        "analyze_codebase",
        "list_skills",
        "read_skill",
        "search_memory",
        "manage_tasks",
        "run_tests",
    ];
    if (workspaceTools.includes(toolName)) {
        return "workspace";
    }
    return "other";
}

class SessionTracker {
    private metrics: SessionMetrics = {
        startedAt: 0,
        provider: "",
        model: "",
        aiRequests: 0,
        inputTokens: 0,
        outputTokens: 0,
        toolCalls: 0,
        toolsByCategory: {
            workspace: 0,
            mcp: 0,
            web: 0,
            obsidian: 0,
            shell: 0,
            other: 0,
        },
        toolHistory: [],
        filesRead: 0,
        filesModified: 0,
        filesCreated: 0,
        filesDeleted: 0,
        shellCommands: 0,
        estimatedCost: 0,
        turnCount: 0,
    };

    start(provider: string, model: string) {
        this.metrics = {
            startedAt: Date.now(),
            provider,
            model,
            aiRequests: 0,
            inputTokens: 0,
            outputTokens: 0,
            toolCalls: 0,
            toolsByCategory: {
                workspace: 0,
                mcp: 0,
                web: 0,
                obsidian: 0,
                shell: 0,
                other: 0,
            },
            toolHistory: [],
            filesRead: 0,
            filesModified: 0,
            filesCreated: 0,
            filesDeleted: 0,
            shellCommands: 0,
            estimatedCost: 0,
            turnCount: 0,
        };
    }

    startTurn() {
        this.metrics.turnCount++;
        this.metrics.currentTurn = {
            startedAt: Date.now(),
            inputTokens: 0,
            outputTokens: 0,
            toolCalls: 0,
            durationMs: 0,
            tokensPerSec: 0,
        };
    }

    endTurn() {
        if (this.metrics.currentTurn) {
            this.metrics.currentTurn.endedAt = Date.now();
            this.metrics.currentTurn.durationMs = this.metrics.currentTurn.endedAt - this.metrics.currentTurn.startedAt;
            const seconds = Math.max(0.1, this.metrics.currentTurn.durationMs / 1000);
            const totalTurnTokens = this.metrics.currentTurn.inputTokens + this.metrics.currentTurn.outputTokens;
            this.metrics.currentTurn.tokensPerSec = Math.round(totalTurnTokens / seconds);
        }
    }

    finish(status: SessionStatus = "completed") {
        this.metrics.endedAt = Date.now();
        this.metrics.status = status;
        this.endTurn();
    }

    get(): SessionMetrics {
        return this.metrics;
    }

    private computeCost(inputTokens: number, outputTokens: number): number {
        const providerKey = this.metrics.provider.toLowerCase();
        if (providerKey === "ollama") return 0;

        const modelLower = this.metrics.model.toLowerCase();
        let match = Object.entries(MODEL_PRICING).find(([key]) => modelLower.includes(key));
        
        // Fallback pricing if model name isn't directly matched
        const rates = match ? match[1] : { in: 1.0, out: 3.0 };
        const cost = (inputTokens / 1_000_000) * rates.in + (outputTokens / 1_000_000) * rates.out;
        return cost;
    }

    addTokens(input: number, output: number) {
        this.metrics.aiRequests++;
        this.metrics.inputTokens += input;
        this.metrics.outputTokens += output;

        if (this.metrics.currentTurn) {
            this.metrics.currentTurn.inputTokens += input;
            this.metrics.currentTurn.outputTokens += output;
            const elapsedSec = Math.max(0.1, (Date.now() - this.metrics.currentTurn.startedAt) / 1000);
            this.metrics.currentTurn.tokensPerSec = Math.round(
                (this.metrics.currentTurn.inputTokens + this.metrics.currentTurn.outputTokens) / elapsedSec
            );
        }

        this.metrics.estimatedCost = this.computeCost(this.metrics.inputTokens, this.metrics.outputTokens);
    }

    incrementToolCalls() {
        this.metrics.toolCalls++;
        if (this.metrics.currentTurn) {
            this.metrics.currentTurn.toolCalls++;
        }
    }

    recordToolExecution(toolName: string, durationMs: number, success: boolean = true) {
        const category = classifyTool(toolName);
        this.metrics.toolsByCategory[category] = (this.metrics.toolsByCategory[category] || 0) + 1;
        
        // Keep last 50 tool execution records
        this.metrics.toolHistory.push({
            toolName,
            category,
            durationMs,
            success,
            timestamp: Date.now(),
        });
        if (this.metrics.toolHistory.length > 50) {
            this.metrics.toolHistory.shift();
        }
    }

    incrementFilesRead() {
        this.metrics.filesRead++;
    }

    incrementFilesModified() {
        this.metrics.filesModified++;
    }

    incrementFilesCreated() {
        this.metrics.filesCreated++;
    }

    incrementFilesDeleted() {
        this.metrics.filesDeleted++;
    }

    incrementShellCommands() {
        this.metrics.shellCommands++;
        this.metrics.toolsByCategory.shell++;
    }

    getEstimatedCost(): number {
        return this.metrics.estimatedCost;
    }

    getFormattedCost(): string {
        const cost = this.metrics.estimatedCost;
        if (cost === 0) return "$0.00";
        if (cost < 0.001) return `<$0.001`;
        if (cost < 0.01) return `$${cost.toFixed(3)}`;
        return `$${cost.toFixed(2)}`;
    }

    getFormattedTime(ms?: number): string {
        const durationSec = Math.floor(((ms ?? (Date.now() - this.metrics.startedAt))) / 1000);
        if (durationSec < 60) return `${durationSec}s`;
        const m = Math.floor(durationSec / 60);
        const s = durationSec % 60;
        return `${m}m ${s}s`;
    }

    /**
     * Compact live ticker for spinners, prompts, and headers.
     * e.g. "⚡ 2.4k tok ($0.004) │ 🛠️ 6 tools │ ⏱️ 3m 45s"
     */
    getTickerSummary(turnOnly: boolean = false): string {
        const formatK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString());
        
        if (turnOnly && this.metrics.currentTurn) {
            const { inputTokens, outputTokens, toolCalls, startedAt } = this.metrics.currentTurn;
            const totalTurnTokens = inputTokens + outputTokens;
            const turnSec = Math.max(1, Math.floor((Date.now() - startedAt) / 1000));
            const turnSpeed = this.metrics.currentTurn.tokensPerSec ? ` (${this.metrics.currentTurn.tokensPerSec} t/s)` : "";
            return `⚡ ${formatK(totalTurnTokens)} tok${turnSpeed} │ 🛠️ ${toolCalls} tools │ ⏱️ ${turnSec}s`;
        }

        const { inputTokens, outputTokens, toolCalls } = this.metrics;
        const total = inputTokens + outputTokens;
        const costStr = this.getFormattedCost();
        const durationStr = this.getFormattedTime();

        return `⚡ ${formatK(total)} tok (${costStr}) │ 🛠️ ${toolCalls} tools │ ⏱️ ${durationStr}`;
    }

    /**
     * Existing summary compatibility method
     */
    getSummary() {
        const { inputTokens, outputTokens, toolCalls, startedAt } = this.metrics;
        const duration = Math.floor((Date.now() - startedAt) / 1000);
        
        const formatK = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString());
        const formatTime = (s: number) => {
            if (s < 60) return `${s}s`;
            return `${Math.floor(s / 60)}m ${s % 60}s`;
        };

        const cost = this.getFormattedCost();
        return `Tokens: ${formatK(inputTokens)}/${formatK(outputTokens)} (${cost}) | Tools: ${toolCalls} | ${formatTime(duration)}`;
    }
}

export const sessionTracker = new SessionTracker();