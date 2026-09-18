import { test, expect, describe, beforeEach } from "bun:test";
import { sessionTracker, classifyTool } from "./session-tracker";

describe("SessionTracker", () => {
    beforeEach(() => {
        sessionTracker.start("openrouter", "anthropic/claude-3.5-sonnet");
    });

    test("initializes metrics correctly", () => {
        const metrics = sessionTracker.get();
        expect(metrics.provider).toBe("openrouter");
        expect(metrics.model).toBe("anthropic/claude-3.5-sonnet");
        expect(metrics.inputTokens).toBe(0);
        expect(metrics.outputTokens).toBe(0);
        expect(metrics.toolCalls).toBe(0);
        expect(metrics.estimatedCost).toBe(0);
    });

    test("accumulates tokens and computes estimated cost for Claude 3.5 Sonnet", () => {
        // Claude 3.5 Sonnet: $3/M in, $15/M out
        // 100,000 in = $0.30, 10,000 out = $0.15 => total = $0.45
        sessionTracker.addTokens(100_000, 10_000);
        const metrics = sessionTracker.get();
        expect(metrics.inputTokens).toBe(100_000);
        expect(metrics.outputTokens).toBe(10_000);
        expect(metrics.aiRequests).toBe(1);
        expect(metrics.estimatedCost).toBeCloseTo(0.45, 3);
        expect(sessionTracker.getFormattedCost()).toBe("$0.45");
    });

    test("classifies tool categories accurately", () => {
        expect(classifyTool("read_file")).toBe("workspace");
        expect(classifyTool("modify_file")).toBe("workspace");
        expect(classifyTool("search_files")).toBe("workspace");
        expect(classifyTool("youtube_analytics")).toBe("mcp");
        expect(classifyTool("github_create_issue")).toBe("mcp");
        expect(classifyTool("web_search")).toBe("web");
        expect(classifyTool("fetch_url")).toBe("web");
        expect(classifyTool("obsidian_search")).toBe("obsidian");
        expect(classifyTool("execute_shell")).toBe("shell");
        expect(classifyTool("custom_unknown_tool")).toBe("other");
    });

    test("records tool executions with duration and categories", () => {
        sessionTracker.recordToolExecution("read_file", 45, true);
        sessionTracker.recordToolExecution("youtube_analytics", 120, true);
        sessionTracker.recordToolExecution("execute_shell", 300, false);

        const metrics = sessionTracker.get();
        expect(metrics.toolsByCategory.workspace).toBe(1);
        expect(metrics.toolsByCategory.mcp).toBe(1);
        expect(metrics.toolsByCategory.shell).toBe(1);
        expect(metrics.toolHistory.length).toBe(3);
        expect(metrics.toolHistory[0]!.toolName).toBe("read_file");
        expect(metrics.toolHistory[0]!.durationMs).toBe(45);
        expect(metrics.toolHistory[0]!.success).toBe(true);
        expect(metrics.toolHistory[2]!.success).toBe(false);
    });

    test("tracks turns and speed", async () => {
        sessionTracker.startTurn();
        sessionTracker.addTokens(500, 200);
        sessionTracker.incrementToolCalls();
        await Bun.sleep(50);
        sessionTracker.endTurn();

        const metrics = sessionTracker.get();
        expect(metrics.turnCount).toBe(1);
        expect(metrics.currentTurn).toBeDefined();
        expect(metrics.currentTurn?.inputTokens).toBe(500);
        expect(metrics.currentTurn?.outputTokens).toBe(200);
        expect(metrics.currentTurn?.toolCalls).toBe(1);
        expect(metrics.currentTurn?.durationMs).toBeGreaterThanOrEqual(40);
    });

    test("produces informative ticker summaries", () => {
        sessionTracker.addTokens(1200, 400);
        sessionTracker.incrementToolCalls();
        sessionTracker.incrementToolCalls();

        const ticker = sessionTracker.getTickerSummary();
        expect(ticker).toContain("1.6k tok");
        expect(ticker).toContain("2 tools");
    });
});
