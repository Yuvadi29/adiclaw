import { wrapLanguageModel, type LanguageModel } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ai-sdk-ollama";
import type { InferenceMode } from "./types";
import { aiSession } from "../ai/session";
import { sessionTracker } from "../ai/session/session-tracker";
import { promptPrefixCache } from "./cache/prompt-cache";
import { contextOptimizer } from "./cache/context-optimizer";
import { toolSchemaCache } from "./cache/tool-cache";
import { metricsCollector } from "./telemetry/metrics-collector";
import { randomUUID } from "node:crypto";

import { macHardware } from "./hardware";

const openRouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || "",
});

const ollama = createOllama();

/**
 * Creates an inference-optimized LanguageModel for Vercel AI SDK
 * Integrates transparently into ToolLoopAgent, streamText, and generateText.
 */
export function createInferenceModel(mode?: InferenceMode): LanguageModel {
  const session = aiSession.get();
  const provider = (session.provider || "ollama").toLowerCase();
  const modelName = session.model || (provider === "ollama" ? "gemma4:latest" : "anthropic/claude-3.5-sonnet");

  let baseModel: any;
  if (provider === "openrouter") {
    baseModel = openRouter(modelName);
  } else {
    // Ollama with Apple Silicon Metal GPU/CPU acceleration
    const hw = macHardware.getOptionsForMode(mode);
    baseModel = ollama(modelName, {
      keep_alive: "2h",
      options: {
        num_ctx: hw.num_ctx || 16384,
        num_thread: hw.num_thread || 10,
        num_gpu: hw.num_gpu || 99,
        num_batch: hw.num_batch || 1024,
        num_ubatch: hw.num_ubatch || 512,
        temperature: hw.temperature ?? 0.6,
      },
    });
  }

  // Wrap the model with our inference engine optimization middleware
  return wrapLanguageModel({
    model: baseModel,
    middleware: {
      transformParams: async ({ type, params }) => {
        // 1. Optimize prompt history for repeated turns and context budgeting
        if (params.prompt && Array.isArray(params.prompt)) {
          const systemMsg = params.prompt.find((m: any) => m.role === "system");
          const systemText = systemMsg ? (typeof systemMsg.content === "string" ? systemMsg.content : JSON.stringify(systemMsg.content)) : "";

          // 2. Check prefix cache on invariant prefix (System + Tools)
          const prefixInvariant = contextOptimizer.buildInvariantPrefix(
            systemText,
            params.tools as any,
          );
          promptPrefixCache.checkPrefix(prefixInvariant);

          // Delta compression for long multi-turn sessions (> 6 messages)
          if (params.prompt.length > 6) {
            const otherMessages = params.prompt.filter((m: any) => m.role !== "system");
            const optResult = contextOptimizer.optimizeMessages(otherMessages, systemText, {
              maxRecentDetailedTurns: 3,
              maxToolResultChars: 400,
            });

            const newPrompt: any[] = [];
            if (systemMsg) {
              newPrompt.push(systemMsg);
            }
            newPrompt.push(...optResult.optimizedMessages);

            return {
              ...params,
              prompt: newPrompt,
            };
          }
        }

        return params;
      },

      wrapStream: async ({ doStream, params }) => {
        const requestId = `inf_${randomUUID()}`;
        const startedAt = Date.now();
        metricsCollector.initRequest(requestId, provider as any, modelName);

        const result = await doStream();
        let firstTokenAt: number | undefined;
        let totalOutputTokens = 0;

        // Wrap stream to intercept first token timing (TTFT) and throughput (TPS)
        const transformStream = new TransformStream({
          transform(chunk, controller) {
            if (firstTokenAt === undefined) {
              const chunkType = (chunk as any).type;
              if (chunkType === "text-delta" || chunkType === "tool-call") {
                firstTokenAt = Date.now();
                metricsCollector.recordFirstToken(requestId);
              }
            }
            if ((chunk as any).type === "text-delta" && ((chunk as any).delta || (chunk as any).textDelta)) {
              totalOutputTokens++;
            }
            controller.enqueue(chunk);
          },
          flush() {
            // Stream completed
            const completedAt = Date.now();
            const totalDuration = completedAt - startedAt;
            const ttft = firstTokenAt ? firstTokenAt - startedAt : totalDuration;
            const genDuration = firstTokenAt ? completedAt - firstTokenAt : totalDuration;
            const tps = genDuration > 0 ? Number(((totalOutputTokens / genDuration) * 1000).toFixed(1)) : 0;

            metricsCollector.recordCompletion(requestId, {
              output: totalOutputTokens,
              total: totalOutputTokens,
              cacheHit: promptPrefixCache.getStats().totalHits > 0,
            });
          },
        });

        return {
          ...result,
          stream: result.stream.pipeThrough(transformStream),
        };
      },

      wrapGenerate: async ({ doGenerate, params }) => {
        const requestId = `inf_${randomUUID()}`;
        metricsCollector.initRequest(requestId, provider as any, modelName);
        try {
          const result = await doGenerate();
          const usage = result.usage;
          metricsCollector.recordCompletion(requestId, {
            input: usage?.inputTokens,
            output: usage?.outputTokens,
            total: usage?.totalTokens,
            cacheHit: promptPrefixCache.getStats().totalHits > 0,
          });
          return result;
        } catch (err) {
          metricsCollector.recordFailure(requestId);
          throw err;
        }
      },
    },
  });
}
