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

export class OpenRouterRuntime extends BaseRuntime {
  readonly name = "OpenRouter Cloud";
  readonly provider = "openrouter";
  readonly capabilities: RuntimeCapabilities = {
    streaming: true,
    tools: true,
    vision: true,
    reasoning: true,
    promptCache: true,
    maxContext: 128000,
  };

  private readonly apiKey: string;
  private readonly baseUrl = "https://openrouter.ai/api/v1";

  constructor(apiKey?: string) {
    super();
    this.apiKey = apiKey || process.env.OPENROUTER_API_KEY || "";
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async listModels(): Promise<RuntimeModel[]> {
    if (!this.apiKey) return [];
    try {
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) return [];
      const json: any = await res.json();
      return (json.data || []).slice(0, 30).map((m: any) => ({
        id: m.id,
        provider: "openrouter",
        name: m.name,
        contextLength: m.context_length,
        capabilities: this.capabilities,
      }));
    } catch {
      return [];
    }
  }

  async generate(request: InferenceRequest): Promise<InferenceResponse> {
    if (!this.apiKey) {
      throw new Error("OpenRouter API key is not configured. Set OPENROUTER_API_KEY in your environment.");
    }

    metricsCollector.initRequest(request.id, "openrouter", request.modelId);
    const ctrl = this.createController(request);

    try {
      const payload = this.buildPayload(request, false);
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://adiclaw.dev",
          "X-Title": "AdiClaw CLI",
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok) {
        throw new Error(`OpenRouter generate failed with status ${res.status}: ${await res.text()}`);
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
    if (!this.apiKey) {
      throw new Error("OpenRouter API key is not configured. Set OPENROUTER_API_KEY in your environment.");
    }

    metricsCollector.initRequest(request.id, "openrouter", request.modelId);
    const ctrl = this.createController(request);

    try {
      const payload = this.buildPayload(request, true);
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://adiclaw.dev",
          "X-Title": "AdiClaw CLI",
        },
        body: JSON.stringify(payload),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`OpenRouter stream failed with status ${res.status}: ${await res.text()}`);
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
            // Partial chunk
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
      model: request.modelId || process.env.ADICLAW_MODEL || "anthropic/claude-3.5-sonnet",
      messages,
      stream,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxOutputTokens ?? 4096,
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
