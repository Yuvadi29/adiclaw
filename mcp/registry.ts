import type { MCPProvider, MCPTool } from "./types";

export class MCPRegistry {
    private providers = new Map<string, MCPProvider>();

    register(provider: MCPProvider) {
        this.providers.set(provider.name, provider);
    }

    getProviders() {
        return [...this.providers.values()];
    }

    getTools(): MCPTool[] {
        return this.getProviders().flatMap(provider => provider.getTools());
    }

    findTool(name: string) {
        return this.getTools().find(tool => tool.name === name);
    }
}