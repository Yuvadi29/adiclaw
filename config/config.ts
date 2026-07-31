import type { AIProvider } from "../ai/provider";

export interface AdiClawConfig {
    provider: AIProvider;
    providerName: string;
    model: string;
}

const PROVIDER_NAMES: Record<AIProvider, string> = {
    ollama: "Ollama",
    openrouter: "OpenRouter",
};

export function loadConfig(): AdiClawConfig {
    const provider = (process.env.ADICLAW_PROVIDER ?? "ollama") as AIProvider;
    const model = process.env.ADICLAW_MODEL
        ?? (provider === "ollama" ? "mistral:latest" : "openrouter/free");

    return {
        provider,
        providerName: PROVIDER_NAMES[provider] ?? provider,
        model,
    };
}