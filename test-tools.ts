import { ToolLoopAgent, stepCountIs, tool } from "ai";
import { z } from "zod";
import { createOllama } from "ai-sdk-ollama";

async function run() {
  const ollama = createOllama();
  const agent = new ToolLoopAgent({
    model: ollama('mistral:latest'),
    tools: {
      test_tool: tool({
        description: "Test tool",
        inputSchema: z.object({}),
        execute: async () => {
          console.log("TOOL EXECUTED NATIVELY");
          return "Tool success";
        }
      })
    },
    stopWhen: stepCountIs(2)
  });

  console.log("Generating...");
  const res = await agent.generate({
    prompt: "Call the test_tool.",
    onStepFinish: ({ toolCalls }) => {
      console.log("onStepFinish toolCalls length:", toolCalls.length);
      console.log("onStepFinish toolCalls:", toolCalls);
    }
  });

  console.log("Final text:", res.text);
}

run().catch(console.error);
