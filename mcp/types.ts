import type { ZodTypeAny } from "zod";

export interface MCPTool<TInput = unknown, TResult = unknown>{
    // Unique tool name
    name: string;
    // Humand readable description
    description: string;
    // Schema used by AI SDK
    schema: any;
    // Execute tools
    execute(input: TInput): Promise<TResult>;
}

export interface MCPProvider {
    // Provider name
    name: string;
    // Return tools by provider
    getTools(): MCPTool[];
}