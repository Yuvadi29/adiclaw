
export interface OllamaStatus {
    running: boolean;
    models?: OllamaModel[];
};

export interface OllamaModel {
    name: string;
    size: number;
    modified: string;
}

const BASE_URL = "http://localhost:11434";

export async function checkOllama(): Promise<OllamaStatus> {
    try {
        const res = await fetch(`${BASE_URL}/api/tags`);
        if (!res.ok) {
            return {
                running: false,
            }
        }

        const json = await res.json();

        return {
            running: true,
            models: (json.models ?? []).map((m: any) => ({
                name: m.name,
                size: m.size,
                modified: m.modified,
            })),
        };
    } catch (error) {
        return {
            running: false
        }
    }
}