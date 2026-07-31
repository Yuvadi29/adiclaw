export type AIProvider = | "openrouter" | "ollama";

export interface ProviderInfo{
    id: AIProvider;
    name: string;
    description: string;
    local: boolean;
}

export const PROVIDERS: ProviderInfo[] = [
    {
        id: "openrouter",
        name: "OpenRouter",
        description: "Free Cloud Models",
        local: false,
    },
        {
        id: "ollama",
        name: "Ollama",
        description: "Run Local Models",
        local: true,
    }
];