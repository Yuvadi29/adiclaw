import { randomUUID } from "crypto";

import { MemoryStorage } from "./storage";
import type { Memory, MemoryDatabase, MemoryType, MemorySource } from "./types";

export class MemoryManager {
  private storage = new MemoryStorage();

  private db: MemoryDatabase = {
    version: 1,
    memories: [],
  };

  /**
   * Initialize memory database.
   */
  initialize() {
    this.storage.initialize();
    this.db = this.storage.load();
  }

  /**
   * Persist to disk.
   */
  save() {
    this.storage.save(this.db);
  }

  /**
   * Return every memory.
   */
  all(): Memory[] {
    return [...this.db.memories];
  }

  /**
   * Number of stored memories.
   */
  count() {
    return this.db.memories.length;
  }

  /**
   * Find a memory by id.
   */
  get(id: string) {
    return this.db.memories.find((m) => m.id === id);
  }

  /**
   * Create a new memory.
   *
   * If a duplicate already exists,
   * increase confidence instead.
   */
  remember(input: {
    type: MemoryType;
    text: string;
    tags?: string[];
    source?: MemorySource;
    confidence?: number;
  }): Memory {
    const text = input.text.trim();

    const duplicate = this.db.memories.find(
      (m) =>
        m.type === input.type && m.text.toLowerCase() === text.toLowerCase(),
    );

    if (duplicate) {
      duplicate.confidence = Math.min(1, duplicate.confidence + 0.05);

      duplicate.updatedAt = new Date().toISOString();

      this.save();

      return duplicate;
    }

    const now = new Date().toISOString();

    const memory: Memory = {
      id: randomUUID(),

      type: input.type,

      text,

      confidence: input.confidence ?? 0.8,

      tags: input.tags ?? [],

      source: input.source ?? "assistant",

      createdAt: now,

      updatedAt: now,

      lastAccessedAt: now,
    };

    this.db.memories.push(memory);

    this.save();

    return memory;
  }

  /**
   * Remove a memory.
   */
  forget(id: string): boolean {
    const before = this.db.memories.length;

    this.db.memories = this.db.memories.filter((m) => m.id !== id);

    const removed = before !== this.db.memories.length;

    if (removed) {
      this.save();
    }

    return removed;
  }

  /**
   * Internal tokenizer: lowercases, strips punctuation, and removes common stopwords.
   */
  private tokenize(text: string): string[] {
    const stopWords = new Set([
      "a", "an", "the", "and", "or", "but", "is", "are", "was", "were", 
      "in", "on", "at", "to", "for", "of", "with", "by", "this", "that", 
      "it", "i", "you", "he", "she", "we", "they", "my", "your", "do", 
      "does", "did", "have", "has", "had", "what", "where", "when", 
      "why", "how", "can", "could", "would", "should"
    ]);
    return text.toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter(w => w.length > 0 && !stopWords.has(w));
  }

  /**
   * Search memories using BM25 semantic ranking.
   */
  search(query: string): Memory[] {
    const queryTokens = this.tokenize(query);
    if (queryTokens.length === 0) return [];

    const memories = this.db.memories;
    const N = memories.length;
    if (N === 0) return [];

    // Precompute tokenized memories and average document length (avgdl)
    const tokenizedMemories = memories.map(m => {
      // Combine text and tags to form the document
      const doc = this.tokenize(m.text).concat(m.tags.flatMap(t => this.tokenize(t)));
      return { memory: m, tokens: doc, length: doc.length };
    });

    const avgdl = tokenizedMemories.reduce((sum, m) => sum + m.length, 0) / N;

    // Calculate document frequency for each query term
    const df = new Map<string, number>();
    for (const q of queryTokens) {
      let count = 0;
      for (const m of tokenizedMemories) {
        if (m.tokens.includes(q)) count++;
      }
      df.set(q, count);
    }

    // BM25 parameters
    const k1 = 1.5;
    const b = 0.75;

    const ranked = tokenizedMemories.map(m => {
      let score = m.memory.confidence; // Baseline score based on confidence

      for (const q of queryTokens) {
        // Calculate Term Frequency (f) of q in this memory
        const f = m.tokens.filter(t => t === q).length;
        if (f === 0) continue;

        // Calculate IDF for q
        const docFreq = df.get(q) || 0;
        const idf = Math.log((N - docFreq + 0.5) / (docFreq + 0.5) + 1);

        // BM25 Term Score
        const termScore = idf * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (m.length / (avgdl || 1))));
        score += termScore;
      }

      return { score, memory: m.memory };
    })
    .filter(x => x.score > 1.2) // Threshold
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

    const now = new Date().toISOString();
    ranked.forEach((r) => (r.memory.lastAccessedAt = now));

    this.save();

    return ranked.map((r) => r.memory);
  }

  /**
   * Return only memories relevant
   * to a prompt.
   */
  getRelevant(prompt: string): Memory[] {
    return this.search(prompt);
  }

  /**
   * Simple stats.
   */
  stats() {
    const byType = {
      identity: 0,

      preference: 0,

      workflow: 0,

      knowledge: 0,
    };

    for (const m of this.db.memories) {
      byType[m.type]++;
    }

    return {
      total: this.db.memories.length,

      ...byType,
    };
  }
}
