import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createOllama } from "ai-sdk-ollama";
import { aiSession } from "./session";

const openRouter = createOpenRouter({
    apiKey: process.env.OPENROUTER_API_KEY!,

});
const ollama = createOllama();

export function getAgentModel() {
    const session = aiSession.get();
    switch (session.provider) {
        case "ollama":
        default:
            return ollama(session.model);

        case "openrouter":
            return openRouter(session.model);

    }

};