import { memory } from "./index";

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export function buildMemoryPrompt(userPrompt: string): string {
  const tokens = tokenize(userPrompt);

  const scored = memory
    .all()
    .map((m) => {
      let score = m.confidence;

      for (const tag of m.tags) {
        const t = tag.toLowerCase();

        if (tokens.includes(t)) {
          score += 3;
        }

        for (const token of tokens) {
          if (t.includes(token)) score += 1;

          if (m.text.toLowerCase().includes(token)) score += 0.5;
        }
      }

      return {
        memory: m,
        score,
      };
    })
    .filter((m) => m.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (!scored.length) return "";

  const lines = scored.map((m) => `- ${m.memory.text}`);

  return [
    "## User Memory",
    "",
    ...lines,
    "",
    "Use these memories only if they are relevant.",
  ].join("\n");
}
