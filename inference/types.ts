import type { LanguageModel, ModelMessage, Tool } from "ai";

export type InferenceMode = "ask" | "plan" | "agent";

export type InferenceProvider = "ollama" | "openrouter" | "llamacpp";

export interface RuntimeCapabilities {
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  reasoning: boolean;
  promptCache: boolean;
  maxContext: number;
}

export interface RuntimeModel {
  id: string;
  provider: InferenceProvider | string;
  name?: string;
  contextLength?: number;
  sizeBytes?: number;
  capabilities?: Partial<RuntimeCapabilities>;
}

export interface SlotInfo {
  id: number;
  nContext: number;
  nPast: number;
  state: "idle" | "processing" | "prompt-eval";
  promptPrefixHash?: string;
}

export interface InferenceRequest {
  id: string;
  model?: LanguageModel | any;
  modelId?: string;
  provider?: InferenceProvider;
  messages?: ModelMessage[] | any[];
  prompt?: string;
  system?: string;
  tools?: Record<string, Tool | any>;
  temperature?: number;
  maxOutputTokens?: number;
  abortSignal?: AbortSignal;
  metadata?: {
    mode?: InferenceMode;
    sessionId?: string;
    provider?: InferenceProvider;
    modelId?: string;
    turnIndex?: number;
    optimizeContext?: boolean;
    usePrefixCache?: boolean;
    [key: string]: any;
  };
}

export interface InferenceMetrics {
  requestId: string;
  startedAt: number;
  firstTokenAt?: number;
  completedAt?: number;
  timeToFirstToken?: number; // ms
  promptEvalLatency?: number; // ms
  generationLatency?: number; // ms
  totalLatency?: number; // ms
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  tokensPerSecond?: number;
  cachedTokens?: number;
  cacheHit?: boolean;
  provider?: string;
  modelId?: string;
  mode?: InferenceMode;
}

export interface InferenceStatus {
  activeRequests: number;
  totalRequests: number;
  completedRequests: number;
  failedRequests: number;
  cancelledRequests: number;
  activeProvider: InferenceProvider;
  activeModel: string;
  isPrewarmed: boolean;
  averageTTFT: number;
  averageTPS: number;
  cacheHitRate: number;
  totalCachedTokens: number;
}

export interface InferenceResponse {
  requestId: string;
  text: string;
  metrics: InferenceMetrics;
  toolCalls?: Array<{
    toolName: string;
    args: any;
    id?: string;
  }>;
}

export interface InferenceStreamChunk {
  type: "text" | "reasoning" | "tool-call" | "tool-result" | "finish" | "error";
  text?: string;
  toolName?: string;
  toolArgs?: any;
  data?: unknown;
  metrics?: InferenceMetrics;
}

export interface InferenceEngine {
  generate(request: InferenceRequest): Promise<InferenceResponse>;
  stream(request: InferenceRequest): AsyncIterable<InferenceStreamChunk>;
  cancel(requestId: string): Promise<void>;
  warmup(modelId?: string, provider?: InferenceProvider): Promise<boolean>;
  getStatus(): InferenceStatus;
  getMetrics(requestId?: string): InferenceMetrics | InferenceMetrics[] | undefined;
  getModel(mode?: InferenceMode): LanguageModel;
}
