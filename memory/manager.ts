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
   * Search memories.
   */
  search(query: string): Memory[] {
    const q = query.toLowerCase();

    const ranked = this.db.memories
      .map((memory) => {
        let score = 0;

        if (memory.text.toLowerCase().includes(q)) {
          score += 5;
        }

        for (const tag of memory.tags) {
          if (tag.toLowerCase().includes(q)) {
            score += 2;
          }
        }

        score += memory.confidence;

        return {
          memory,
          score,
        };
      })
      .filter((m) => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const now = new Date().toISOString();

    for (const item of ranked) {
      item.memory.lastAccessedAt = now;
    }

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
