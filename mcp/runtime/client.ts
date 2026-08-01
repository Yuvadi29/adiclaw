import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { MCPProvider, MCPTool } from "../types";
import { jsonSchema } from "ai";

export interface MCPClientConfig {
    name: string;
    command: string;
    args: string[];
    env?: Record<string, string>;
}

export async function createMCPProvider(config: MCPClientConfig): Promise<MCPProvider> {
    const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: {
            ...process.env,
            ...config.env,
        }
    });

    const client = new Client({
        name: `adiclaw-${config.name}-client`,
        version: "1.0.0",
    }, {
        capabilities: {}
    });

    await client.connect(transport);

    const toolsResult = await client.listTools();
    const mcpTools: MCPTool[] = toolsResult.tools.map(tool => ({
        name: tool.name,
        description: tool.description || "",
        // Convert MCP JSON schema to AI SDK schema
        schema: jsonSchema(tool.inputSchema as any),
        execute: async (input: any) => {
            const result = await client.callTool({
                name: tool.name,
                arguments: input
            });
            // Result.content usually contains text or image array
            // Format to a string for simpler consumption by default
            return result.content.map(c => c.type === 'text' ? c.text : '').join('\n');
        }
    }));

    return {
        name: config.name,
        getTools: () => mcpTools,
    };
}
