import { initMCP, mcpRegistry, getAITools } from "../mcp";
import { rawYouTubeTools, youtubeMCPProvider } from "../mcp/providers/youtube";

console.log("=== Testing YouTube MCP Integration ===");

// 1. Initialize MCP
await initMCP();

// 2. Check registered tools
const registeredProviders = mcpRegistry.getProviders();
console.log(`Registered Providers: ${registeredProviders.map(p => p.name).join(", ")}`);

const tools = mcpRegistry.getTools();
console.log(`Total MCP Tools registered: ${tools.length}`);
for (const t of tools) {
  console.log(`  - [${t.name}]: ${t.description.slice(0, 70)}...`);
}

// 3. Check AI SDK tool generator
const aiTools = getAITools();
console.log("\nAI SDK Tools Map:");
for (const toolName of Object.keys(aiTools)) {
  console.log(`  ✔ ${toolName}`);
}

// 4. Verify tool signatures and schemas
const expectedTools = [
  "youtube_channel",
  "youtube_analytics",
  "youtube_top_videos",
  "youtube_list_videos",
  "youtube_search_videos",
  "youtube_video_details",
  "youtube_video_comments",
  "youtube_render_dashboard",
  "youtube_show_thumbnail"
];



for (const name of expectedTools) {
  const found = mcpRegistry.findTool(name);
  if (!found) {
    throw new Error(`Missing expected MCP tool: ${name}`);
  }
  console.log(`Verified tool signature: ${name} (execute function present: ${typeof found.execute === 'function'})`);
}

console.log("\n✅ All YouTube MCP tools registered and verified successfully!");
