import { BaseRuntime } from "./base";
import type {
  InferenceRequest,
  InferenceResponse,
  InferenceStreamChunk,
  RuntimeCapabilities,
  RuntimeModel,
  SlotInfo,
} from "../types";
import { metricsCollector } from "../telemetry/metrics-collector";
import { promptPrefixCache } from "../cache/prompt-cache";

export class LlamaCppRuntime extends BaseRuntime {
  readonly name = "Local llama.cpp Server";
  readonly provider = "llamacpp";
  readonly capabilities: RuntimeCapabilities = {
    streaming: true,
    tools: true,
    vision: false,
    reasoning: true,
    promptCache: true,
    maxContext: 32768,
  };

  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    super();
    this.baseUrl = baseUrl || process.env.LLAMACPP_BASE_URL || "http://127.0.0.1:8080";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/health`, { method: "GET", signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
      // Fallback check to /v1/models
      const res2 = await fetch(`${this.baseUrl}/v1/models`, { method: "GET", signal: AbortSignal.timeout(1000) });
      return res2.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<RuntimeModel[]> {
    try {
      const res = await fetch(`${this.baseUrl}/v1/models`, { method: "GET", signal: AbortSignal.timeout(2000) });
      if (!res.ok) return [];
      const json: any = await res.json();
      return (json.data || []).map((m: any) => ({
        id: m.id || "llama-cpp-local",
        provider: "llamacpp",
        name: m.id,
        contextLength: 32768,
        capabilities: this.capabilities,
      }));
    } catch {
      return [
        {
          id: "llama-cpp-local",
          provider: "llamacpp",
          name: "llama.cpp local instance",
          contextLength: 32768,
          capabilities: this.capabilities,
        },
      ];
    }
  }

  /**
   * Query slot utilization in llama-server
   */
  async getSlots(): Promise<SlotInfo[]> {
    try {
      const res = await fetch(`${this.baseUrl}/slots`, { method: "GET", signal: AbortSignal.timeout(1500) });
      if (!res.ok) return [];
      const json: any = await res.json();
      return (json || []).map((s: any) => ({
        id: s.id,
        nContext: s.n_ctx || 0,
        nPast: s.n_past || 0,
        state: s.is_processing ? "processing" : "idle",
      }));
    } catch {
      return [];
    }
  }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    metricsCollector.initRequest(request.id, "llamacpp", request.modelId || "llama-cpp-local");
    const ctrl = this.createController(request);

    try {
      const payload = this.buildPayload(request, false);
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`llama.cpp request failed with status ${res.status}: ${await res.text()}`);
      }

      const json: any = await res.json();
      const choice = json.choices?.[0] || {};
      const text = choice.message?.content || "";
      const toolCalls = (choice.message?.tool_calls || []).map((tc: any) => ({
        toolName: tc.function?.name || "",
        args: tc.function?.arguments ? (typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments) : {},
        id: tc.id,
      }));

      const inputTokens = json.usage?.prompt_tokens || 0;
      const outputTokens = json.usage?.completion_tokens || 0;

      // Prefix cache check
      const prefixText = request.system || "";
      const match = promptPrefixCache.checkPrefix(prefixText);

      const metrics = metricsCollector.recordCompletion(request.id, {
        input: inputTokens,
        output: outputTokens,
        total: inputTokens + outputTokens,
        cached: match.hit ? match.matchedTokens : 0,
        cacheHit: match.hit,
      })!;

      return {
        requestId: request.id,
        text,
        metrics,
        toolCalls: toolCalls.length ? toolCalls : undefined,
      };
    } catch (err) {
      metricsCollector.recordFailure(request.id, ctrl.signal.aborted);
      throw err;
    } finally {
      this.cleanupController(request.id);
    }
  }

  async *stream(request: InferenceRequest): AsyncIterable<InferenceStreamChunk> {
    metricsCollector.initRequest(request.id, "llamacpp", request.modelId || "llama-cpp-local");
    const ctrl = this.createController(request);

    try {
      const payload = this.buildPayload(request, true);
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`llama.cpp stream failed with status ${res.status}: ${await res.text()}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      const prefixText = request.system || "";
      const match = promptPrefixCache.checkPrefix(prefixText);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data:")) continue;
          const jsonStr = trimmed.replace(/^data:\s*/, "");
          if (jsonStr === "[DONE]") continue;

          try {
            const chunk: any = JSON.parse(jsonStr);
            const delta = chunk.choices?.[0]?.delta;

            if (delta?.content) {
              metricsCollector.recordFirstToken(request.id);
              yield {
                type: "text",
                text: delta.content,
              };
            }

            if (delta?.tool_calls && delta.tool_calls.length > 0) {
              for (const tc of delta.tool_calls) {
                yield {
                  type: "tool-call",
                  toolName: tc.function?.name,
                  toolArgs: tc.function?.arguments,
                };
              }
            }

            if (chunk.usage) {
              totalInputTokens = chunk.usage.prompt_tokens || totalInputTokens;
              totalOutputTokens = chunk.usage.completion_tokens || totalOutputTokens;
            }
          } catch {
            // Incomplete SSE chunk
          }
        }
      }

      const metrics = metricsCollector.recordCompletion(request.id, {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalInputTokens + totalOutputTokens,
        cached: match.hit ? match.matchedTokens : 0,
        cacheHit: match.hit,
      });

      yield {
        type: "finish",
        metrics,
      };
    } catch (err) {
      metricsCollector.recordFailure(request.id, ctrl.signal.aborted);
      yield {
        type: "error",
        data: err,
      };
      throw err;
    } finally {
      this.cleanupController(request.id);
    }
  }

  private buildPayload(request: InferenceRequest, stream: boolean): any {
    const messages: any[] = [];
    if (request.system) {
      messages.push({ role: "system", content: request.system });
    }

    if (request.messages && request.messages.length > 0) {
      for (const m of request.messages) {
        messages.push({
          role: m.role,
          content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
        });
      }
    } else if (request.prompt) {
      messages.push({ role: "user", content: request.prompt });
    }

    const payload: any = {
      model: request.modelId || "llama-cpp-local",
      messages,
      stream,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxOutputTokens ?? 4096,
      cache_prompt: true, // llama.cpp native prompt caching flag
    };

    if (request.tools && Object.keys(request.tools).length > 0) {
      payload.tools = Object.entries(request.tools).map(([name, tool]: [string, any]) => ({
        type: "function",
        function: {
          name,
          description: tool.description || "",
          parameters: tool.inputSchema || tool.parameters || {},
        },
      }));
    }

    return payload;
  }
}
