export type MemoryType = "identity" | "preference" | "workflow" | "knowledge";

export type MemorySource = "user" | "assistant" | "system";

export interface Memory {
  /** Unique identifier */
  id: string;

  /** Memory category */
  type: MemoryType;

  /** Actual memory text */
  text: string;

  /** Confidence score (0-1) */
  confidence: number;

  /** Keywords for faster lookup */
  tags: string[];

  /** Who created this memory */
  source: MemorySource;

  /** ISO timestamp */
  createdAt: string;

  /** ISO timestamp */
  updatedAt: string;

  /** Updated every time the memory is injected into a prompt */
  lastAccessedAt: string;
}

export interface MemoryDatabase {
  version: 1;

  memories: Memory[];
}
