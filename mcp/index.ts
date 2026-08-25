import { MCPRegistry } from "./registry";
import { createMCPProvider } from "./runtime/client";
import { githubProviderConfig } from "./providers/github";
import { tool } from "ai";
import { youtubeMCPProvider, createYouTubeTools } from "./providers/youtube";
import chalk from "chalk";

export const mcpRegistry = new MCPRegistry();

export async function initMCP() {
    // 1. Register Native YouTube MCP provider for Coding Adda
    try {
        mcpRegistry.register(youtubeMCPProvider);
        console.log(chalk.gray(`Registered MCP provider: ${youtubeMCPProvider.name} (${youtubeMCPProvider.getTools().length} tools)`));
    } catch (err) {
        console.error("Failed to initialize YouTube MCP provider:", err);
    }

    // 2. Register GitHub Stdio MCP provider if token is present
    if (process.env.GITHUB_PERSONAL_ACCESS_TOKEN) {
        try {
            const githubProvider = await createMCPProvider(githubProviderConfig);
            mcpRegistry.register(githubProvider);
            console.log(chalk.gray(`Registered MCP provider: ${githubProvider.name}`));
        } catch (err) {
            console.error("Failed to initialize Github MCP provider:", err);
        }
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
            inputSchema: mcpTool.schema,
            execute: async (args: any) => {
                return await mcpTool.execute(args);
            }
        });
    }
    return aiTools;
}

export { youtubeMCPProvider, createYouTubeTools };