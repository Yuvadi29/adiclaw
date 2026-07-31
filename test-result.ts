import { ToolLoopAgent, ModelMessage } from "ai";
async function test() {
  const m: ModelMessage = {
     role: "user",
     content: [{ type: "text", text: "hello" }]
  };
}
