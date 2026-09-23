import { BaseRuntime } from "./base";
import type {
  InferenceRequest,
  InferenceResponse,
  InferenceStreamChunk,
  RuntimeCapabilities,
  RuntimeModel,
} from "../types";
import { metricsCollector } from "../telemetry/metrics-collector";
import { promptPrefixCache } from "../cache/prompt-cache";
import { macHardware } from "../hardware";

export class OllamaRuntime extends BaseRuntime {
  readonly name = "Ollama Daemon";
  readonly provider = "ollama";
  readonly capabilities: RuntimeCapabilities = {
    streaming: true,
    tools: true,
    vision: true,
    reasoning: true,
    promptCache: true,
    maxContext: 131072,
  };

  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    super();
    this.baseUrl = baseUrl || process.env.OLLAMA_HOST || "http://localhost:11434";
  }

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: "GET", signal: AbortSignal.timeout(1500) });
      return res.ok;
    } catch {
      return false;
    }
  }

  async listModels(): Promise<RuntimeModel[]> {
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: "GET", signal: AbortSignal.timeout(3000) });
      if (!res.ok) return [];
      const json: any = await res.json();
      return (json.models || []).map((m: any) => ({
        id: m.name,
        provider: "ollama",
        name: m.name,
        sizeBytes: m.size,
        contextLength: m.details?.context_length,
        capabilities: {
          tools: m.capabilities?.includes("tools") ?? true,
          vision: m.capabilities?.includes("vision") ?? false,
          reasoning: m.capabilities?.includes("thinking") ?? false,
          streaming: true,
          promptCache: true,
          maxContext: m.details?.context_length || 32768,
        },
      }));
    } catch {
      return [];
    }
  }

  /**
   * Pre-load model weights into GPU / unified memory and set keep-alive
   */
  async warmup(modelId?: string): Promise<boolean> {
    const model = modelId || process.env.ADICLAW_MODEL || "gemma4:latest";
    const hw = macHardware.getProfile();
    try {
      const res = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          prompt: "",
          keep_alive: "2h",
          options: {
            ...hw.optimalSettings,
            num_ctx: 4096,
          },
        }),
        signal: AbortSignal.timeout(15000),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    metricsCollector.initRequest(request.id, "ollama", request.modelId);
    const ctrl = this.createController(request);

    try {
      const payload = this.buildPayload(request, false);
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`Ollama generate failed with status ${res.status}: ${await res.text()}`);
      }

      const json: any = await res.json();
      const text = json.message?.content || "";
      const toolCalls = (json.message?.tool_calls || []).map((tc: any) => ({
        toolName: tc.function?.name || "",
        args: tc.function?.arguments || {},
      }));

      const inputTokens = json.prompt_eval_count || 0;
      const outputTokens = json.eval_count || 0;

      // Check prefix cache match
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
    metricsCollector.initRequest(request.id, "ollama", request.modelId);
    const ctrl = this.createController(request);

    try {
      const payload = this.buildPayload(request, true);
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Ollama stream failed with status ${res.status}: ${await res.text()}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      // Prefix cache check
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
          if (!trimmed) continue;

          try {
            const data: any = JSON.parse(trimmed);

            // Record TTFT on first text token chunk
            if (data.message?.content) {
              metricsCollector.recordFirstToken(request.id);
              yield {
                type: "text",
                text: data.message.content,
              };
            }

            if (data.message?.tool_calls && data.message.tool_calls.length > 0) {
              for (const tc of data.message.tool_calls) {
                yield {
                  type: "tool-call",
                  toolName: tc.function?.name,
                  toolArgs: tc.function?.arguments,
                };
              }
            }

            if (data.done) {
              totalInputTokens = data.prompt_eval_count || 0;
              totalOutputTokens = data.eval_count || 0;
            }
          } catch {
            // Partial JSON chunk, wait for next read
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
    const mode = request.metadata?.mode;
    const hwOptions = macHardware.getOptionsForMode(mode);

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
      model: request.modelId || process.env.ADICLAW_MODEL || "gemma4:latest",
      messages,
      stream,
      keep_alive: hwOptions.keep_alive || "2h",
      options: {
        ...hwOptions,
        temperature: request.temperature ?? hwOptions.temperature ?? 0.7,
      },
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
