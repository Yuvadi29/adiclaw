import { randomUUID } from "node:crypto";
import type { LanguageModel } from "ai";
import type {
  InferenceEngine,
  InferenceRequest,
  InferenceResponse,
  InferenceMetrics,
  InferenceStatus,
  InferenceStreamChunk,
  InferenceMode,
  InferenceProvider,
} from "./types";
import { modelRouter } from "./router/model-router";
import { modelManager } from "./manager";
import { metricsCollector } from "./telemetry/metrics-collector";
import { promptPrefixCache } from "./cache/prompt-cache";
import { contextOptimizer } from "./cache/context-optimizer";
import { toolSchemaCache } from "./cache/tool-cache";
import { sessionTracker } from "../ai/session/session-tracker";
import { createInferenceModel } from "./adapter";

export class AdiClawInferenceEngine implements InferenceEngine {
  private readonly activeRequests = new Map<string, AbortController>();

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    const reqId = request.id || `inf_${randomUUID()}`;
    const mode: InferenceMode = request.metadata?.mode || "ask";
    const prefProvider: InferenceProvider = request.provider || request.metadata?.provider || (process.env.ADICLAW_PROVIDER as any) || "ollama";

    // 1. Resolve runtime
    const { runtime, provider } = await modelRouter.resolve(prefProvider, mode);
    const modelId = request.modelId || request.metadata?.modelId || process.env.ADICLAW_MODEL || "gemma4:latest";

    // 2. Optimize prompt and compress repeated agent turns
    const optResult = contextOptimizer.optimizeMessages(
      request.messages || [],
      request.system,
      { maxRecentDetailedTurns: 3 },
    );

    // 3. Check and record prefix cache
    const prefixInvariant = contextOptimizer.buildInvariantPrefix(
      optResult.optimizedSystem || "",
      request.tools,
    );
    const prefixMatch = promptPrefixCache.checkPrefix(prefixInvariant);

    // 4. Pre-cache tool schemas if tools are provided
    if (request.tools) {
      toolSchemaCache.getBatch(request.tools);
    }

    const abortController = this.createRequestController(reqId, request.abortSignal);

    try {
      const optimizedRequest: InferenceRequest = {
        ...request,
        id: reqId,
        provider,
        modelId,
        system: optResult.optimizedSystem,
        messages: optResult.optimizedMessages,
        abortSignal: abortController.signal,
      };

      const response = await runtime.generate(optimizedRequest);

      // 5. Update sessionTracker and telemetry
      if (response.metrics.inputTokens !== undefined && response.metrics.outputTokens !== undefined) {
        sessionTracker.addTokens(response.metrics.inputTokens, response.metrics.outputTokens);
      }

      return response;
    } catch (error) {
      if (abortController.signal.aborted) {
        metricsCollector.recordFailure(reqId, true);
      } else {
        metricsCollector.recordFailure(reqId, false);
      }
      throw error;
    } finally {
      this.activeRequests.delete(reqId);
    }
  }

  stream(request: InferenceRequest): AsyncIterable<InferenceStreamChunk> {
    return this.createStream(request);
  }

  private async *createStream(request: InferenceRequest): AsyncIterable<InferenceStreamChunk> {
    const reqId = request.id || `inf_${randomUUID()}`;
    const mode: InferenceMode = request.metadata?.mode || "ask";
    const prefProvider: InferenceProvider = request.provider || request.metadata?.provider || (process.env.ADICLAW_PROVIDER as any) || "ollama";

    // 1. Resolve runtime
    const { runtime, provider } = await modelRouter.resolve(prefProvider, mode);
    const modelId = request.modelId || request.metadata?.modelId || process.env.ADICLAW_MODEL || "gemma4:latest";

    // 2. Optimize prompt and history
    const optResult = contextOptimizer.optimizeMessages(
      request.messages || [],
      request.system,
      { maxRecentDetailedTurns: 3 },
    );

    // 3. Prefix cache check
    const prefixInvariant = contextOptimizer.buildInvariantPrefix(
      optResult.optimizedSystem || "",
      request.tools,
    );
    promptPrefixCache.checkPrefix(prefixInvariant);

    // 4. Pre-cache tool schemas
    if (request.tools) {
      toolSchemaCache.getBatch(request.tools);
    }

    const abortController = this.createRequestController(reqId, request.abortSignal);

    try {
      const optimizedRequest: InferenceRequest = {
        ...request,
        id: reqId,
        provider,
        modelId,
        system: optResult.optimizedSystem,
        messages: optResult.optimizedMessages,
        abortSignal: abortController.signal,
      };

      for await (const chunk of runtime.stream(optimizedRequest)) {
        if (chunk.type === "finish" && chunk.metrics) {
          if (chunk.metrics.inputTokens !== undefined && chunk.metrics.outputTokens !== undefined) {
            sessionTracker.addTokens(chunk.metrics.inputTokens, chunk.metrics.outputTokens);
          }
        }
        yield chunk;
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        metricsCollector.recordFailure(reqId, true);
      } else {
        metricsCollector.recordFailure(reqId, false);
      }
      yield {
        type: "error",
        data: error,
      };
      throw error;
    } finally {
      this.activeRequests.delete(reqId);
    }
  }

  async cancel(requestId: string): Promise<void> {
    const controller = this.activeRequests.get(requestId);
    if (controller) {
      controller.abort();
      this.activeRequests.delete(requestId);
    }
    // Also cancel across runtimes
    for (const p of ["ollama", "llamacpp", "openrouter"] as InferenceProvider[]) {
      const runtime = modelRouter.getRuntime(p);
      if (runtime) {
        await runtime.cancel(requestId);
      }
    }
  }

  async warmup(modelId?: string, provider?: InferenceProvider): Promise<boolean> {
    const res = await modelManager.warmup(modelId, provider);
    return res.success;
  }

  getStatus(): InferenceStatus {
    return metricsCollector.getStatus(this.activeRequests.size);
  }

  getMetrics(requestId?: string): InferenceMetrics | InferenceMetrics[] | undefined {
    return metricsCollector.getMetrics(requestId);
  }

  getModel(mode?: InferenceMode): LanguageModel {
    return createInferenceModel(mode);
  }

  private createRequestController(requestId: string, externalSignal?: AbortSignal): AbortController {
    const controller = new AbortController();
    if (externalSignal) {
      if (externalSignal.aborted) {
        controller.abort();
      } else {
        externalSignal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }
    this.activeRequests.set(requestId, controller);
    return controller;
  }
}

export const inferenceEngine = new AdiClawInferenceEngine();
