import type { InferenceMode, InferenceProvider } from "../types";
import type { InferenceRuntime } from "../runtimes/base";
import { OllamaRuntime } from "../runtimes/ollama";
import { LlamaCppRuntime } from "../runtimes/llamacpp";
import { OpenRouterRuntime } from "../runtimes/openrouter";

export interface RouteResolution {
  runtime: InferenceRuntime;
  provider: InferenceProvider;
  isFallback: boolean;
  reason: string;
}

export class ModelRouter {
  private readonly runtimes: Map<InferenceProvider, InferenceRuntime> = new Map();

  constructor() {
    this.runtimes.set("ollama", new OllamaRuntime());
    this.runtimes.set("llamacpp", new LlamaCppRuntime());
    this.runtimes.set("openrouter", new OpenRouterRuntime());
  }

  getRuntime(provider: InferenceProvider): InferenceRuntime | undefined {
    return this.runtimes.get(provider);
  }

  /**
   * Resolve best available runtime, applying smart fallback if preferred runtime is unavailable
   */
  async resolve(preferredProvider?: InferenceProvider, mode?: InferenceMode): Promise<RouteResolution> {
    const preferred = preferredProvider || "ollama";
    const primaryRuntime = this.runtimes.get(preferred);

    if (primaryRuntime && (await primaryRuntime.isAvailable())) {
      return {
        runtime: primaryRuntime,
        provider: preferred,
        isFallback: false,
        reason: `Preferred provider '${preferred}' is available`,
      };
    }

    // Fallback search order: llama.cpp -> ollama -> openrouter
    const fallbackCandidates: InferenceProvider[] =
      preferred === "llamacpp"
        ? ["ollama", "openrouter"]
        : preferred === "ollama"
        ? ["llamacpp", "openrouter"]
        : ["ollama", "llamacpp"];

    for (const cand of fallbackCandidates) {
      const candidateRuntime = this.runtimes.get(cand);
      if (candidateRuntime && (await candidateRuntime.isAvailable())) {
        return {
          runtime: candidateRuntime,
          provider: cand,
          isFallback: true,
          reason: `Provider '${preferred}' unavailable; fell back to '${cand}'`,
        };
      }
    }

    // Return primary anyway (errors will be raised gracefully during execution)
    return {
      runtime: primaryRuntime || new OllamaRuntime(),
      provider: preferred,
      isFallback: false,
      reason: `Defaulting to '${preferred}'`,
    };
  }

  /**
   * Health check all configured runtimes
   */
  async checkHealth(): Promise<Record<InferenceProvider, boolean>> {
    const results: any = {};
    for (const [provider, runtime] of this.runtimes.entries()) {
      results[provider] = await runtime.isAvailable();
    }
    return results;
  }
}

export const modelRouter = new ModelRouter();
