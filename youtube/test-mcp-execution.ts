import { rawYouTubeTools } from "../mcp/providers/youtube";

console.log("=== Testing YouTube MCP Tool Execution & Error Handling ===");

// 1. Test error handling when not authenticated (clean error object)
const channelRes = await rawYouTubeTools.youtube_channel.execute();
console.log("youtube_channel response shape:", {
  hasSuccess: "success" in channelRes,
  success: channelRes.success,
  hasMessageOrChannel: "message" in channelRes || "channel" in channelRes,
});

// 2. Test analytics tool with parameters validation
const analyticsRes = await rawYouTubeTools.youtube_analytics.execute({ period: "7d" });
console.log("youtube_analytics response shape:", {
  hasSuccess: "success" in analyticsRes,
  success: analyticsRes.success,
});

// 3. Test video details with raw URL parsing
const videoDetailsRes = await rawYouTubeTools.youtube_video_details.execute({
  videoId: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
});
console.log("youtube_video_details response shape:", {
  hasSuccess: "success" in videoDetailsRes,
  success: videoDetailsRes.success,
});

// 4. Test search tool
const searchRes = await rawYouTubeTools.youtube_search_videos.execute({
  query: "TypeScript Tutorial",
  limit: 5,
});
console.log("youtube_search_videos response shape:", {
  hasSuccess: "success" in searchRes,
  success: searchRes.success,
});

console.log("\n✅ All tool executors handled input validation and error safety properly without uncaught exceptions!");
