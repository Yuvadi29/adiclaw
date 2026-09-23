import type {
  InferenceRequest,
  InferenceResponse,
  InferenceStreamChunk,
} from "../types";

export interface RuntimeModel {
  id: string;

  provider: string;

  name?: string;

  contextLength?: number;

  capabilities?: {
    streaming?: boolean;
    tools?: boolean;
    vision?: boolean;
    reasoning?: boolean;
  };
}

export interface InferenceRuntime {
  readonly name: string;

  isAvailable(): Promise<boolean>;

  listModels(): Promise<RuntimeModel[]>;

  generate(request: InferenceRequest): Promise<InferenceResponse>;

  stream(request: InferenceRequest): AsyncIterable<InferenceStreamChunk>;

  cancel(requestId: string): Promise<void>;
}
