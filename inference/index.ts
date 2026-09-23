import { randomUUID } from "node:crypto";
import { AdiClawInferenceEngine, inferenceEngine } from "./engine";

export * from "./types";
export * from "./engine";
export * from "./adapter";
export * from "./cache/prompt-cache";
export * from "./cache/context-optimizer";
export * from "./cache/tool-cache";
export * from "./telemetry/metrics-collector";
export * from "./router/model-router";
export * from "./manager";
export * from "./runtimes/base";
export * from "./runtimes/ollama";
export * from "./runtimes/llamacpp";
export * from "./runtimes/openrouter";

export { inferenceEngine };

export function createInferenceRequestId(): string {
  return `inf_${randomUUID()}`;
}
