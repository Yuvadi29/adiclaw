import type { InferenceProvider } from "./types";
import { modelRouter } from "./router/model-router";
import { metricsCollector } from "./telemetry/metrics-collector";

export interface PrewarmResult {
  provider: InferenceProvider;
  model: string;
  success: boolean;
  durationMs: number;
}

export class ModelLifecycleManager {
  private prewarmedModel: string | null = null;
  private prewarmedProvider: InferenceProvider | null = null;
  private isPrewarming = false;

  /**
   * Pre-warm a model in background (loads weights into GPU/unified memory)
   */
  async warmup(modelId?: string, provider?: InferenceProvider): Promise<PrewarmResult> {
    if (this.isPrewarming) {
      return {
        provider: provider || "ollama",
        model: modelId || "",
        success: false,
        durationMs: 0,
      };
    }

    this.isPrewarming = true;
    const started = Date.now();
    const resolution = await modelRouter.resolve(provider);
    const targetModel = modelId || process.env.ADICLAW_MODEL || "gemma4:latest";

    try {
      let success = false;
      if (resolution.runtime.warmup) {
        success = await resolution.runtime.warmup(targetModel);
      } else {
        success = true;
      }

      if (success) {
        this.prewarmedModel = targetModel;
        this.prewarmedProvider = resolution.provider;
        metricsCollector.setActiveState(resolution.provider, targetModel, true);
      }

      const durationMs = Date.now() - started;
      return {
        provider: resolution.provider,
        model: targetModel,
        success,
        durationMs,
      };
    } catch {
      return {
        provider: resolution.provider,
        model: targetModel,
        success: false,
        durationMs: Date.now() - started,
      };
    } finally {
      this.isPrewarming = false;
    }
  }

  isModelPrewarmed(modelId: string, provider: InferenceProvider): boolean {
    return this.prewarmedModel === modelId && this.prewarmedProvider === provider;
  }

  getPrewarmStatus() {
    return {
      model: this.prewarmedModel,
      provider: this.prewarmedProvider,
      isPrewarmed: Boolean(this.prewarmedModel),
    };
  }
}

export const modelManager = new ModelLifecycleManager();
