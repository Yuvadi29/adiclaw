import { z } from "zod";
export const MemoryTypeSchema = z.enum([
  "identity",
  "preference",
  "workflow",
  "knowledge",
]);

export const MemorySourceSchema = z.enum(["user", "assistant", "system"]);

export const MemorySchema = z.object({
  id: z.string(),

  type: MemoryTypeSchema,

  text: z.string(),

  confidence: z.number().min(0).max(1),

  tags: z.array(z.string()),

  source: MemorySourceSchema,

  createdAt: z.string(),

  updatedAt: z.string(),

  lastAccessedAt: z.string(),
});

export const MemoryDatabaseSchema = z.object({
  version: z.literal(1),

  memories: z.array(MemorySchema),
});

export type MemorySchemaType = z.infer<typeof MemorySchema>;

export type MemoryDatabaseSchemaType = z.infer<typeof MemoryDatabaseSchema>;
