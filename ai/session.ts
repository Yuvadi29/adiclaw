import type { AIProvider } from "./provider";

export interface AISession{
    provider: AIProvider;
    model: string;
    providerName: string;
};

class SessionStore{
    private session: AISession = {
        provider: "openrouter",
        model: "",
        providerName: "",
    };

    set(session: AISession){
        this.session =session;
    }

    get(): AISession {
        return this.session;
    }
}

export const aiSession = new SessionStore();