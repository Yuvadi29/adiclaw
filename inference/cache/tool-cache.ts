export interface SerializedTool {
  name: string;
  description: string;
  parameters: any;
}

export class ToolSchemaCache {
  private readonly cache = new Map<string, SerializedTool>();

  /**
   * Get or serialize a tool schema
   */
  getOrSerialize(name: string, toolObj: any): SerializedTool {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }

    const description = toolObj.description || "";
    let parameters = toolObj.parameters || toolObj.inputSchema || {};

    // If it's a Zod schema or AI SDK tool with internal schema
    if (toolObj.inputSchema && typeof toolObj.inputSchema === "object") {
      parameters = toolObj.inputSchema;
    }

    const serialized: SerializedTool = {
      name,
      description,
      parameters,
    };

    this.cache.set(name, serialized);
    return serialized;
  }

  /**
   * Batch get/serialize all tools for a request
   */
  getBatch(tools: Record<string, any>): SerializedTool[] {
    return Object.entries(tools).map(([name, tool]) => this.getOrSerialize(name, tool));
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

export const toolSchemaCache = new ToolSchemaCache();
