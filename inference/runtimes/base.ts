import type {
  InferenceRequest,
  InferenceResponse,
  InferenceStreamChunk,
  RuntimeCapabilities,
  RuntimeModel,
} from "../types";

export interface InferenceRuntime {
  readonly name: string;
  readonly provider: string;
  readonly capabilities: RuntimeCapabilities;

  isAvailable(): Promise<boolean>;
  listModels(): Promise<RuntimeModel[]>;
  warmup?(modelId?: string): Promise<boolean>;
  generate(request: InferenceRequest): Promise<InferenceResponse>;
  stream(request: InferenceRequest): AsyncIterable<InferenceStreamChunk>;
  cancel(requestId: string): Promise<void>;
}

export abstract class BaseRuntime implements InferenceRuntime {
  abstract readonly name: string;
  abstract readonly provider: string;
  abstract readonly capabilities: RuntimeCapabilities;

  protected activeControllers = new Map<string, AbortController>();

  abstract isAvailable(): Promise<boolean>;
  abstract listModels(): Promise<RuntimeModel[]>;
  abstract generate(request: InferenceRequest): Promise<InferenceResponse>;
  abstract stream(request: InferenceRequest): AsyncIterable<InferenceStreamChunk>;

  async warmup?(modelId?: string): Promise<boolean> {
    return true;
  }

  async cancel(requestId: string): Promise<void> {
    const ctrl = this.activeControllers.get(requestId);
    if (ctrl) {
      ctrl.abort();
      this.activeControllers.delete(requestId);
    }
  }

  protected createController(request: InferenceRequest): AbortController {
    const ctrl = new AbortController();
    if (request.abortSignal) {
      if (request.abortSignal.aborted) {
        ctrl.abort();
      } else {
        request.abortSignal.addEventListener("abort", () => ctrl.abort(), { once: true });
      }
    }
    this.activeControllers.set(request.id, ctrl);
    return ctrl;
  }

  protected cleanupController(requestId: string): void {
    this.activeControllers.delete(requestId);
  }
}
