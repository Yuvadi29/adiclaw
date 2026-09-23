import { describe, it, expect, beforeEach } from "bun:test";
import { PromptPrefixCache } from "./cache/prompt-cache";
import { ContextOptimizer } from "./cache/context-optimizer";
import { ToolSchemaCache } from "./cache/tool-cache";
import { MetricsCollector } from "./telemetry/metrics-collector";
import { ModelRouter } from "./router/model-router";
import { AdiClawInferenceEngine } from "./engine";

describe("PromptPrefixCache", () => {
  let cache: PromptPrefixCache;

  beforeEach(() => {
    cache = new PromptPrefixCache(5);
  });

  it("should detect cache miss on first encounter and hit on subsequent", () => {
    const prefix = "You are AdiClaw, an expert coding assistant.";
    const firstCheck = cache.checkPrefix(prefix, 100);
    expect(firstCheck.hit).toBe(false);
    expect(firstCheck.prefixHash.length).toBeGreaterThan(0);

    const secondCheck = cache.checkPrefix(prefix, 100);
    expect(secondCheck.hit).toBe(true);
    expect(secondCheck.matchedTokens).toBeGreaterThan(0);
    expect(secondCheck.savingRatio).toBeGreaterThan(0);

    const stats = cache.getStats();
    expect(stats.totalHits).toBe(1);
    expect(stats.totalMisses).toBe(1);
    expect(stats.hitRatePercentage).toBe(50);
  });

  it("should correctly bind and retrieve slot IDs", () => {
    const prefix = "System Instructions with Tools";
    const match = cache.checkPrefix(prefix);
    cache.bindSlot(match.prefixHash, 42);

    const match2 = cache.checkPrefix(prefix);
    expect(match2.slotId).toBe(42);
  });

  it("should evict oldest entry when capacity is exceeded", () => {
    for (let i = 0; i < 6; i++) {
      cache.checkPrefix(`Prefix content for item number ${i}`);
    }
    const stats = cache.getStats();
    expect(stats.cachedPrefixes).toBeLessThanOrEqual(5);
  });
});

describe("ContextOptimizer", () => {
  let optimizer: ContextOptimizer;

  beforeEach(() => {
    optimizer = new ContextOptimizer();
  });

  it("should build invariant prefix combining system prompt and tools", () => {
    const system = "You are AdiClaw.";
    const tools = {
      read_file: { description: "Read file" },
      modify_file: { description: "Modify file" },
    };
    const prefix = optimizer.buildInvariantPrefix(system, tools);
    expect(prefix).toContain("You are AdiClaw.");
    expect(prefix).toContain("modify_file,read_file");
  });

  it("should compress older agent turns while keeping recent turns intact", () => {
    const bulkyOldResult = "x".repeat(3000);
    const recentResult = "console.log('hello');";

    const messages = [
      { role: "user", content: "Check codebase" },
      {
        role: "tool",
        content: [{ type: "tool-result", toolName: "read_file", result: bulkyOldResult }],
      },
      { role: "assistant", content: "I inspected the file." },
      { role: "user", content: "Next step" },
      {
        role: "tool",
        content: [{ type: "tool-result", toolName: "modify_file", result: recentResult }],
      },
      { role: "assistant", content: "File updated." },
      { role: "user", content: "Run test" },
    ];

    const result = optimizer.optimizeMessages(messages, "System instructions", {
      maxRecentDetailedTurns: 2,
      maxToolResultChars: 200,
    });

    expect(result.optimizedMessages.length).toBe(messages.length);
    expect(result.prunedTokensEstimate).toBeGreaterThan(0);

    // Old turn should have been compressed
    const compressedOld = result.optimizedMessages[1].content[0].result;
    expect(compressedOld.length).toBeLessThan(bulkyOldResult.length);
    expect(compressedOld).toContain("truncated from earlier turn history");

    // Recent turn should be preserved
    const recent = result.optimizedMessages[4].content[0].result;
    expect(recent).toBe(recentResult);
  });
});

describe("ToolSchemaCache", () => {
  it("should serialize and memoize tool schemas", () => {
    const cache = new ToolSchemaCache();
    const toolObj = {
      description: "Read file tool",
      inputSchema: { type: "object", properties: { path: { type: "string" } } },
    };

    const first = cache.getOrSerialize("read_file", toolObj);
    expect(first.name).toBe("read_file");
    expect(first.description).toBe("Read file tool");

    const second = cache.getOrSerialize("read_file", toolObj);
    expect(second).toBe(first); // Same reference
    expect(cache.size()).toBe(1);
  });
});

describe("MetricsCollector", () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  it("should record TTFT and tokens per second accurately", () => {
    const reqId = "test-req-1";
    collector.initRequest(reqId, "ollama", "gemma4:latest");

    // Simulate first token after 40ms
    const ttft = collector.recordFirstToken(reqId);
    expect(ttft).toBeDefined();

    // Simulate completion with 50 output tokens
    const metrics = collector.recordCompletion(reqId, {
      input: 100,
      output: 50,
      total: 150,
      cached: 80,
      cacheHit: true,
    });

    expect(metrics).toBeDefined();
    expect(metrics?.inputTokens).toBe(100);
    expect(metrics?.outputTokens).toBe(50);
    expect(metrics?.cacheHit).toBe(true);

    const status = collector.getStatus(0);
    expect(status.totalRequests).toBe(1);
    expect(status.completedRequests).toBe(1);
    expect(status.cacheHitRate).toBe(100);
    expect(status.totalCachedTokens).toBe(80);
  });
});

describe("ModelRouter", () => {
  it("should detect available local Ollama runtime", async () => {
    const router = new ModelRouter();
    const health = await router.checkHealth();
    expect(health).toHaveProperty("ollama");
    expect(health).toHaveProperty("llamacpp");
    expect(health).toHaveProperty("openrouter");

    const resolution = await router.resolve("ollama");
    expect(resolution.runtime).toBeDefined();
    expect(resolution.provider).toBe("ollama");
  });
});

describe("AdiClawInferenceEngine", () => {
  it("should provide initial status and metrics", () => {
    const engine = new AdiClawInferenceEngine();
    const status = engine.getStatus();
    expect(status).toBeDefined();
    expect(status.activeProvider).toBeDefined();
    expect(status.totalRequests).toBeGreaterThanOrEqual(0);
  });
});
