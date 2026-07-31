import { streamText, Output } from "ai";
import { getAgentModel } from "./ai/ai.config";
import { aiSession } from "./ai/session";
aiSession.set({ provider: "ollama", model: "mistral:latest", providerName: "ollama" });

async function run() {
  const result = await streamText({
    model: getAgentModel(),
    prompt: "hi"
  });

  const finalResponse = await result.response;
  console.log(finalResponse.messages);
  
  const text = await result.text;
  console.log("TEXT:", typeof text);
}
