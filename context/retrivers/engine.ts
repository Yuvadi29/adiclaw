import { memory } from "../../memory";

export interface RetrievedContext {
  title: string;
  content: string[];
}

export function retrieveMemoryContext(prompt: string): RetrievedContext | null {
  const memories = memory.search(prompt);
  if (memories.length === 0) return null;

  return {
    title: "User Memory",
    content: memories.map((m) => m.text),
  };
}
