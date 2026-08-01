import { MCPRegistry } from "./registry";
import { createMCPProvider } from "./runtime/client";
import { githubProviderConfig } from "./providers/github";
import { tool } from "ai";

export const mcpRegistry = new MCPRegistry();

export async function initMCP() {
    try {
        const githubProvider = await createMCPProvider(githubProviderConfig);
        mcpRegistry.register(githubProvider);
        console.log(`Registered MCP provider: ${githubProvider.name}`);
    } catch (err) {
        console.error("Failed to initialize Github MCP provider:", err);
    }
}

export function getAITools() {
    const aiTools: Record<string, any> = {};
    const mcpTools = mcpRegistry.getTools();
    
    for (const mcpTool of mcpTools) {
        // Sanitize tool name (replace hyphens with underscores)
        const safeName = mcpTool.name.replace(/-/g, '_');
        aiTools[safeName] = tool({
            description: mcpTool.description,
            parameters: mcpTool.schema,
            execute: async (args: any) => {
                return await mcpTool.execute(args);
            }
        });
    }
    return aiTools;
}