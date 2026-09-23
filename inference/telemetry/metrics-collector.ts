import type { InferenceMetrics, InferenceStatus, InferenceProvider } from "../types";

export class MetricsCollector {
  private readonly metrics = new Map<string, InferenceMetrics>();
  private readonly history: InferenceMetrics[] = [];
  private readonly maxHistory = 100;

  private totalRequests = 0;
  private completedRequests = 0;
  private failedRequests = 0;
  private cancelledRequests = 0;

  private activeProvider: InferenceProvider = "ollama";
  private activeModel = "";
  private isPrewarmed = false;

  initRequest(requestId: string, provider?: InferenceProvider, modelId?: string): InferenceMetrics {
    const startedAt = Date.now();
    const metric: InferenceMetrics = {
      requestId,
      startedAt,
      provider: provider || this.activeProvider,
      modelId: modelId || this.activeModel,
    };
    this.metrics.set(requestId, metric);
    this.totalRequests++;
    return metric;
  }

  recordFirstToken(requestId: string): number | undefined {
    const metric = this.metrics.get(requestId);
    if (!metric) return undefined;

    if (metric.firstTokenAt === undefined) {
      metric.firstTokenAt = Date.now();
      metric.timeToFirstToken = metric.firstTokenAt - metric.startedAt;
    }
    return metric.timeToFirstToken;
  }

  recordCompletion(
    requestId: string,
    tokens: { input?: number; output?: number; total?: number; cached?: number; cacheHit?: boolean },
  ): InferenceMetrics | undefined {
    const metric = this.metrics.get(requestId);
    if (!metric) return undefined;

    const completedAt = Date.now();
    metric.completedAt = completedAt;
    metric.totalLatency = completedAt - metric.startedAt;

    if (metric.firstTokenAt) {
      metric.promptEvalLatency = metric.firstTokenAt - metric.startedAt;
      metric.generationLatency = completedAt - metric.firstTokenAt;
    }

    if (tokens.input !== undefined) metric.inputTokens = tokens.input;
    if (tokens.output !== undefined) metric.outputTokens = tokens.output;
    if (tokens.total !== undefined) metric.totalTokens = tokens.total;
    if (tokens.cached !== undefined) metric.cachedTokens = tokens.cached;
    if (tokens.cacheHit !== undefined) metric.cacheHit = tokens.cacheHit;

    if (metric.outputTokens && metric.totalLatency && metric.totalLatency > 0) {
      const genSeconds = (metric.generationLatency ? metric.generationLatency : metric.totalLatency) / 1000;
      if (genSeconds > 0) {
        metric.tokensPerSecond = Number((metric.outputTokens / genSeconds).toFixed(1));
      }
    }

    this.completedRequests++;
    this.history.push({ ...metric });
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }

    return metric;
  }

  recordFailure(requestId: string, wasCancelled = false): void {
    if (wasCancelled) {
      this.cancelledRequests++;
    } else {
      this.failedRequests++;
    }
    const metric = this.metrics.get(requestId);
    if (metric) {
      metric.completedAt = Date.now();
      metric.totalLatency = metric.completedAt - metric.startedAt;
    }
  }

  setActiveState(provider: InferenceProvider, model: string, prewarmed: boolean): void {
    this.activeProvider = provider;
    this.activeModel = model;
    this.isPrewarmed = prewarmed;
  }

  getStatus(activeRequestsCount = 0): InferenceStatus {
    const recent = this.history.slice(-20);
    const validTTFT = recent.filter((m) => m.timeToFirstToken !== undefined).map((m) => m.timeToFirstToken!);
    const validTPS = recent.filter((m) => m.tokensPerSecond !== undefined).map((m) => m.tokensPerSecond!);

    const avgTTFT = validTTFT.length ? Math.round(validTTFT.reduce((a, b) => a + b, 0) / validTTFT.length) : 0;
    const avgTPS = validTPS.length ? Number((validTPS.reduce((a, b) => a + b, 0) / validTPS.length).toFixed(1)) : 0;

    const hitCount = recent.filter((m) => m.cacheHit).length;
    const cacheHitRate = recent.length ? Number(((hitCount / recent.length) * 100).toFixed(1)) : 0;
    const totalCachedTokens = this.history.reduce((acc, m) => acc + (m.cachedTokens || 0), 0);

    return {
      activeRequests: activeRequestsCount,
      totalRequests: this.totalRequests,
      completedRequests: this.completedRequests,
      failedRequests: this.failedRequests,
      cancelledRequests: this.cancelledRequests,
      activeProvider: this.activeProvider,
      activeModel: this.activeModel,
      isPrewarmed: this.isPrewarmed,
      averageTTFT: avgTTFT,
      averageTPS: avgTPS,
      cacheHitRate,
      totalCachedTokens,
    };
  }

  getMetrics(requestId?: string): InferenceMetrics | InferenceMetrics[] | undefined {
    if (requestId) {
      return this.metrics.get(requestId);
    }
    return [...this.history];
  }

  clear(): void {
    this.metrics.clear();
    this.history.length = 0;
    this.totalRequests = 0;
    this.completedRequests = 0;
    this.failedRequests = 0;
    this.cancelledRequests = 0;
  }
}

export const metricsCollector = new MetricsCollector();
