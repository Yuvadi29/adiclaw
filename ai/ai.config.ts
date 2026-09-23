import { inferenceEngine } from "../inference";
import type { InferenceMode } from "../inference/types";

/**
 * Returns an inference-optimized LanguageModel powered by the AdiClaw Inference Engine.
 * Transparently applies TTFT pre-warming, prompt optimization, prefix caching,
 * turn delta compression, and real-time telemetry.
 */
export function getAgentModel(mode?: InferenceMode) {
  return inferenceEngine.getModel(mode);
}