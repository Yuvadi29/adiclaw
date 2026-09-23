import { createHash } from "node:crypto";

export interface CacheEntry {
  prefixHash: string;
  fingerprint: string;
  tokenEstimate: number;
  lastUsedAt: number;
  hitCount: number;
  slotId?: number;
}

export interface CacheMatch {
  hit: boolean;
  prefixHash: string;
  matchedTokens: number;
  totalTokens: number;
  savingRatio: number;
  slotId?: number;
}

export class PromptPrefixCache {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly maxEntries: number;
  private totalHits = 0;
  private totalMisses = 0;
  private totalTokensSaved = 0;

  constructor(maxEntries = 50) {
    this.maxEntries = maxEntries;
  }

  /**
   * Fast hash of a text block to use as a prefix fingerprint
   */
  hashPrefix(text: string): string {
    return createHash("sha256").update(text.trim()).digest("hex").slice(0, 16);
  }

  /**
   * Rough token estimation (1 token ~ 3.8 characters for English/code)
   */
  estimateTokens(text: string): number {
    if (!text) return 0;
    return Math.ceil(text.length / 3.8);
  }

  /**
   * Check if an invariant prompt prefix (e.g. System Prompt + Tools) is in the cache
   */
  checkPrefix(prefix: string, fullPromptLength?: number): CacheMatch {
    if (!prefix || prefix.trim().length === 0) {
      return {
        hit: false,
        prefixHash: "",
        matchedTokens: 0,
        totalTokens: fullPromptLength ? this.estimateTokens(prefix) : 0,
        savingRatio: 0,
      };
    }

    const hash = this.hashPrefix(prefix);
    const estimated = this.estimateTokens(prefix);
    const fullTokens = fullPromptLength ? Math.max(estimated, Math.ceil(fullPromptLength / 3.8)) : estimated;

    const entry = this.entries.get(hash);
    if (entry) {
      entry.lastUsedAt = Date.now();
      entry.hitCount++;
      this.totalHits++;
      this.totalTokensSaved += estimated;

      return {
        hit: true,
        prefixHash: hash,
        matchedTokens: estimated,
        totalTokens: fullTokens,
        savingRatio: fullTokens > 0 ? Number((estimated / fullTokens).toFixed(2)) : 1,
        slotId: entry.slotId,
      };
    }

    // Miss: register new prefix entry
    this.totalMisses++;
    this.registerPrefix(hash, prefix, estimated);

    return {
      hit: false,
      prefixHash: hash,
      matchedTokens: 0,
      totalTokens: fullTokens,
      savingRatio: 0,
    };
  }

  /**
   * Store or update prefix entry, enforcing LRU eviction
   */
  registerPrefix(hash: string, prefixText: string, tokenEstimate: number, slotId?: number): void {
    if (this.entries.size >= this.maxEntries) {
      // Evict oldest used
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, val] of this.entries.entries()) {
        if (val.lastUsedAt < oldestTime) {
          oldestTime = val.lastUsedAt;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        this.entries.delete(oldestKey);
      }
    }

    this.entries.set(hash, {
      prefixHash: hash,
      fingerprint: prefixText.slice(0, 100),
      tokenEstimate,
      lastUsedAt: Date.now(),
      hitCount: 1,
      slotId,
    });
  }

  /**
   * Associate a llama.cpp slot with a prefix hash
   */
  bindSlot(hash: string, slotId: number): void {
    const entry = this.entries.get(hash);
    if (entry) {
      entry.slotId = slotId;
    }
  }

  /**
   * Retrieve statistics
   */
  getStats() {
    const total = this.totalHits + this.totalMisses;
    const hitRate = total > 0 ? Number(((this.totalHits / total) * 100).toFixed(1)) : 0;

    return {
      cachedPrefixes: this.entries.size,
      totalHits: this.totalHits,
      totalMisses: this.totalMisses,
      hitRatePercentage: hitRate,
      totalTokensSaved: this.totalTokensSaved,
    };
  }

  clear() {
    this.entries.clear();
    this.totalHits = 0;
    this.totalMisses = 0;
    this.totalTokensSaved = 0;
  }
}

export const promptPrefixCache = new PromptPrefixCache();
