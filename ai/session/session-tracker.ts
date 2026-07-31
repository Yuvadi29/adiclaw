export type SessionStatus = "completed" | "cancelled" | "crashed";

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

    filesRead: number;
    filesModified: number;
    filesCreated: number;
    filesDeleted: number;

    shellCommands: number;
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

        filesRead: 0,
        filesModified: 0,
        filesCreated: 0,
        filesDeleted: 0,

        shellCommands: 0,
    };

    start(provider: string, model: string) {

        this.metrics.startedAt = Date.now();
        this.metrics.provider = provider;
        this.metrics.model = model;

    }

    finish(status: SessionStatus = "completed") {
        this.metrics.endedAt = Date.now();
        this.metrics.status = status;
    }

    get() {
        return this.metrics;
    }

    addTokens(input: number, output: number) {

        this.metrics.aiRequests++;

        this.metrics.inputTokens += input;
        this.metrics.outputTokens += output;

    }

    incrementToolCalls() {
        this.metrics.toolCalls++;
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
    }

}

export const sessionTracker = new SessionTracker();