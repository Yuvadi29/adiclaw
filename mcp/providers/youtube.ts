import { tool } from "ai";
import { z } from "zod";
import { getMyChannel, CHANNEL_ID } from "../../youtube/channel";
import { getCodingAddaAnalytics } from "../../youtube/analytics";
import { getYouTubeClient } from "../../youtube/client";
import { renderYouTubeDashboard } from "../../youtube/dashboard";
import type { MCPProvider, MCPTool } from "../types";

// ==========================================
// Helper Utilities
// ==========================================

function extractVideoId(input: string): string {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.hostname.includes("youtube.com")) {
      const v = parsed.searchParams.get("v");
      if (v) return v;
    }
    if (parsed.hostname.includes("youtu.be")) {
      const path = parsed.pathname.slice(1);
      if (path) return path;
    }
  } catch {
    const match = trimmed.match(/(?:v=|\/embed\/|\/v\/|https:\/\/youtu\.be\/|\/e\/)([^#&?]*).*/);
    if (match && match[1]) return match[1];
  }
  return trimmed;
}

function parseIsoDuration(durationStr?: string | null): string {
  if (!durationStr) return "N/A";
  const matches = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!matches) return durationStr;
  const hours = matches[1] ? parseInt(matches[1], 10) : 0;
  const minutes = matches[2] ? parseInt(matches[2], 10) : 0;
  const seconds = matches[3] ? parseInt(matches[3], 10) : 0;

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes === 0) {
    return `${seconds}s`;
  }
  return `${minutes}m ${seconds}s`;
}

// ==========================================
// Raw Tool Definitions
// ==========================================

export const rawYouTubeTools = {
  youtube_channel: {
    name: "youtube_channel",
    description:
      "Get current Coding Adda YouTube channel statistics and metadata (subscribers, lifetime views, video uploads, channel ID, description).",
    schema: z.object({}),
    execute: async () => {
      try {
        const channel = await getMyChannel();
        return {
          success: true,
          channel: {
            id: channel.id,
            title: channel.title,
            description: channel.description,
            subscribers: channel.subscribers,
            totalViews: channel.views,
            totalVideos: channel.videos,
            thumbnail: channel.thumbnail,
            url: `https://www.youtube.com/channel/${channel.id}`,
          },
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },

  youtube_analytics: {
    name: "youtube_analytics",
    description:
      "Get YouTube analytics performance report for the Coding Adda channel (views, watch time, avg view duration, likes, comments, subscriber gains/losses, retention rate). Supports periods: '7d', '28d', '90d', '365d' or custom date ranges.",
    schema: z.object({
      period: z
        .enum(["7d", "28d", "90d", "365d"])
        .optional()
        .default("28d")
        .describe("Analytics period. Defaults to '28d'."),
      startDate: z
        .string()
        .optional()
        .describe("Optional start date in YYYY-MM-DD format (overrides period)."),
      endDate: z
        .string()
        .optional()
        .describe("Optional end date in YYYY-MM-DD format (overrides period)."),
    }),
    execute: async ({
      period = "28d",
      startDate,
      endDate,
    }: {
      period?: "7d" | "28d" | "90d" | "365d";
      startDate?: string;
      endDate?: string;
    }) => {
      try {
        const channel = await getMyChannel();
        const analytics = await getCodingAddaAnalytics({ period, startDate, endDate });

        const netSubs = analytics.subscribersGained - analytics.subscribersLost;
        const watchHours = analytics.estimatedMinutesWatched / 60;
        const subRetentionRate =
          analytics.subscribersGained > 0
            ? (Math.max(0, netSubs) / analytics.subscribersGained) * 100
            : 100;
        const engagementRate =
          analytics.views > 0
            ? ((analytics.likes + analytics.comments) / analytics.views) * 100
            : 0;

        return {
          success: true,
          channel: {
            id: channel.id,
            title: channel.title,
            subscribers: channel.subscribers,
            totalViews: channel.views,
            totalVideos: channel.videos,
          },
          period: {
            start: analytics.startDate,
            end: analytics.endDate,
            requestedPeriod: period,
          },
          analytics: {
            views: analytics.views,
            likes: analytics.likes,
            comments: analytics.comments,
            estimatedMinutesWatched: analytics.estimatedMinutesWatched,
            estimatedHoursWatched: Number(watchHours.toFixed(1)),
            averageViewDurationSeconds: analytics.averageViewDuration,
            averageViewDurationFormatted: `${Math.floor(analytics.averageViewDuration / 60)}m ${Math.round(analytics.averageViewDuration % 60)}s`,
            subscribersGained: analytics.subscribersGained,
            subscribersLost: analytics.subscribersLost,
            netSubscribers: netSubs,
            subscriberRetentionRatePct: Number(subRetentionRate.toFixed(2)),
            engagementRatePct: Number(engagementRate.toFixed(2)),
          },
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },

  youtube_top_videos: {
    name: "youtube_top_videos",
    description:
      "Get top performing videos from the Coding Adda YouTube channel ranked by view count, likes, comments, or engagement. Use this whenever the user asks for top videos, best performing videos, most popular videos, or highest view count videos.",
    schema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(5)
        .describe("Number of top videos to return (1-50). Defaults to 5."),
      sortBy: z
        .enum(["views", "likes", "comments", "engagement"])
        .optional()
        .default("views")
        .describe(
          "Metric to rank videos by: 'views' (default), 'likes', 'comments', or 'engagement'."
        ),
    }),
    execute: async ({
      limit = 5,
      sortBy = "views",
    }: {
      limit?: number;
      sortBy?: "views" | "likes" | "comments" | "engagement";
    }) => {
      try {
        const youtube = await getYouTubeClient();

        // Query YouTube search for channel videos ordered by viewCount
        const searchResponse = await youtube.search.list({
          part: ["snippet"],
          channelId: CHANNEL_ID,
          type: ["video"],
          order: "viewCount",
          maxResults: Math.min(50, Math.max(limit * 2, 20)),
        });

        const videoIds = (searchResponse.data.items ?? [])
          .map((item) => item.id?.videoId)
          .filter((id): id is string => Boolean(id));

        if (videoIds.length === 0) {
          return {
            success: true,
            channel: "Coding Adda",
            totalReturned: 0,
            rankedBy: sortBy,
            videos: [],
          };
        }

        const videosResponse = await youtube.videos.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: videoIds,
        });

        const allVideos = (videosResponse.data.items ?? []).map((video) => {
          const views = Number(video.statistics?.viewCount ?? 0);
          const likes = Number(video.statistics?.likeCount ?? 0);
          const comments = Number(video.statistics?.commentCount ?? 0);
          const engagements = likes + comments;
          const engagementRate = views > 0 ? (engagements / views) * 100 : 0;

          return {
            id: video.id,
            title: video.snippet?.title ?? "",
            description: video.snippet?.description ?? "",
            publishedAt: video.snippet?.publishedAt ?? null,
            views,
            likes,
            comments,
            engagementRatePct: Number(engagementRate.toFixed(2)),
            duration: parseIsoDuration(video.contentDetails?.duration),
            thumbnail:
              video.snippet?.thumbnails?.maxres?.url ??
              video.snippet?.thumbnails?.high?.url ??
              video.snippet?.thumbnails?.default?.url ??
              "",
            url: video.id ? `https://www.youtube.com/watch?v=${video.id}` : null,
          };
        });

        allVideos.sort((a, b) => {
          if (sortBy === "likes") return b.likes - a.likes;
          if (sortBy === "comments") return b.comments - a.comments;
          if (sortBy === "engagement") return b.engagementRatePct - a.engagementRatePct;
          return b.views - a.views;
        });

        const topVideos = allVideos.slice(0, limit).map((video, idx) => ({
          rank: `#${idx + 1}`,
          ...video,
        }));

        return {
          success: true,
          channel: "Coding Adda",
          rankedBy: sortBy,
          totalReturned: topVideos.length,
          videos: topVideos,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },

  youtube_list_videos: {
    name: "youtube_list_videos",
    description:
      "List uploaded videos from Coding Adda channel. Supports order: 'date' for recent uploads, or 'viewCount' for top performing videos.",
    schema: z.object({
      limit: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of videos to return (1-50). Defaults to 10."),
      order: z
        .enum(["date", "viewCount", "rating", "title"])
        .optional()
        .default("date")
        .describe("Sort order. Use 'date' for latest uploads, 'viewCount' for top viewed videos."),
    }),
    execute: async ({
      limit = 10,
      order = "date",
    }: {
      limit?: number;
      order?: "date" | "viewCount" | "rating" | "title";
    }) => {
      try {
        const youtube = await getYouTubeClient();

        if (order === "viewCount") {
          const searchResponse = await youtube.search.list({
            part: ["snippet"],
            channelId: CHANNEL_ID,
            type: ["video"],
            order: "viewCount",
            maxResults: limit,
          });

          const videoIds = (searchResponse.data.items ?? [])
            .map((item) => item.id?.videoId)
            .filter((id): id is string => Boolean(id));

          if (videoIds.length === 0) {
            return {
              success: true,
              channel: "Coding Adda",
              totalReturned: 0,
              videos: [],
            };
          }

          const videosResponse = await youtube.videos.list({
            part: ["snippet", "statistics", "contentDetails"],
            id: videoIds,
          });

          const videos = (videosResponse.data.items ?? []).map((video) => ({
            id: video.id,
            title: video.snippet?.title ?? "",
            description: video.snippet?.description ?? "",
            publishedAt: video.snippet?.publishedAt ?? null,
            views: Number(video.statistics?.viewCount ?? 0),
            likes: Number(video.statistics?.likeCount ?? 0),
            comments: Number(video.statistics?.commentCount ?? 0),
            duration: parseIsoDuration(video.contentDetails?.duration),
            thumbnail: video.snippet?.thumbnails?.high?.url ?? video.snippet?.thumbnails?.default?.url ?? "",
            url: video.id ? `https://www.youtube.com/watch?v=${video.id}` : null,
          }));

          videos.sort((a, b) => b.views - a.views);

          return {
            success: true,
            channel: "Coding Adda",
            order: "viewCount",
            totalReturned: videos.length,
            videos,
          };
        }

        const channelResponse = await youtube.channels.list({
          part: ["contentDetails"],
          id: [CHANNEL_ID],
        });

        const uploadsPlaylistId =
          channelResponse.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

        if (!uploadsPlaylistId) {
          throw new Error("Coding Adda uploads playlist could not be found.");
        }

        const playlistResponse = await youtube.playlistItems.list({
          part: ["snippet", "contentDetails"],
          playlistId: uploadsPlaylistId,
          maxResults: limit,
        });

        const videoIds = (playlistResponse.data.items ?? [])
          .map((item) => item.contentDetails?.videoId)
          .filter((id): id is string => Boolean(id));

        if (videoIds.length === 0) {
          return {
            success: true,
            channel: "Coding Adda",
            totalReturned: 0,
            videos: [],
          };
        }

        const videosResponse = await youtube.videos.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: videoIds,
        });

        const videos = (videosResponse.data.items ?? []).map((video) => ({
          id: video.id,
          title: video.snippet?.title ?? "",
          description: video.snippet?.description ?? "",
          publishedAt: video.snippet?.publishedAt ?? null,
          views: Number(video.statistics?.viewCount ?? 0),
          likes: Number(video.statistics?.likeCount ?? 0),
          comments: Number(video.statistics?.commentCount ?? 0),
          duration: parseIsoDuration(video.contentDetails?.duration),
          rawDuration: video.contentDetails?.duration ?? null,
          thumbnail: video.snippet?.thumbnails?.high?.url ?? video.snippet?.thumbnails?.default?.url ?? "",
          url: video.id ? `https://www.youtube.com/watch?v=${video.id}` : null,
        }));

        return {
          success: true,
          channel: "Coding Adda",
          order: "date",
          totalReturned: videos.length,
          videos,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },


  youtube_search_videos: {
    name: "youtube_search_videos",
    description:
      "Search Coding Adda YouTube videos by keyword (e.g. topic, technology, title search), returning matching videos with stats and URLs.",
    schema: z.object({
      query: z
        .string()
        .describe("Search query keywords to find in Coding Adda channel videos."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(25)
        .optional()
        .default(10)
        .describe("Number of search results to return (1-25). Defaults to 10."),
    }),
    execute: async ({ query, limit = 10 }: { query: string; limit?: number }) => {
      try {
        const youtube = await getYouTubeClient();

        const searchResponse = await youtube.search.list({
          part: ["snippet"],
          channelId: CHANNEL_ID,
          q: query,
          type: ["video"],
          maxResults: limit,
          order: "relevance",
        });

        const videoIds = (searchResponse.data.items ?? [])
          .map((item) => item.id?.videoId)
          .filter((id): id is string => Boolean(id));

        if (videoIds.length === 0) {
          return {
            success: true,
            query,
            totalFound: 0,
            videos: [],
          };
        }

        const videosResponse = await youtube.videos.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: videoIds,
        });

        const videos = (videosResponse.data.items ?? []).map((video) => ({
          id: video.id,
          title: video.snippet?.title ?? "",
          description: video.snippet?.description ?? "",
          publishedAt: video.snippet?.publishedAt ?? null,
          views: Number(video.statistics?.viewCount ?? 0),
          likes: Number(video.statistics?.likeCount ?? 0),
          comments: Number(video.statistics?.commentCount ?? 0),
          duration: parseIsoDuration(video.contentDetails?.duration),
          thumbnail: video.snippet?.thumbnails?.high?.url ?? video.snippet?.thumbnails?.default?.url ?? "",
          url: video.id ? `https://www.youtube.com/watch?v=${video.id}` : null,
        }));

        return {
          success: true,
          query,
          totalFound: videos.length,
          videos,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },

  youtube_video_details: {
    name: "youtube_video_details",
    description:
      "Get detailed information, statistics, tags, and description for a specific YouTube video by ID or URL.",
    schema: z.object({
      videoId: z
        .string()
        .describe("YouTube video ID (e.g. 'dQw4w9WgXcQ') or full YouTube video URL."),
    }),
    execute: async ({ videoId: rawId }: { videoId: string }) => {
      try {
        const videoId = extractVideoId(rawId);
        const youtube = await getYouTubeClient();

        const response = await youtube.videos.list({
          part: ["snippet", "statistics", "contentDetails", "status"],
          id: [videoId],
        });

        const video = response.data.items?.[0];
        if (!video) {
          return {
            success: false,
            message: `Video not found with ID: ${videoId}`,
          };
        }

        return {
          success: true,
          video: {
            id: video.id,
            title: video.snippet?.title ?? "",
            description: video.snippet?.description ?? "",
            channelTitle: video.snippet?.channelTitle ?? "",
            publishedAt: video.snippet?.publishedAt ?? null,
            tags: video.snippet?.tags ?? [],
            categoryId: video.snippet?.categoryId ?? null,
            privacyStatus: video.status?.privacyStatus ?? "public",
            duration: parseIsoDuration(video.contentDetails?.duration),
            views: Number(video.statistics?.viewCount ?? 0),
            likes: Number(video.statistics?.likeCount ?? 0),
            comments: Number(video.statistics?.commentCount ?? 0),
            thumbnail: video.snippet?.thumbnails?.maxres?.url ?? video.snippet?.thumbnails?.high?.url ?? "",
            url: `https://www.youtube.com/watch?v=${video.id}`,
          },
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },

  youtube_video_comments: {
    name: "youtube_video_comments",
    description:
      "Get top comments and community reactions from a specific YouTube video.",
    schema: z.object({
      videoId: z
        .string()
        .describe("YouTube video ID or full YouTube video URL."),
      maxResults: z
        .number()
        .int()
        .min(1)
        .max(50)
        .optional()
        .default(10)
        .describe("Number of top comments to return (1-50). Defaults to 10."),
    }),
    execute: async ({
      videoId: rawId,
      maxResults = 10,
    }: {
      videoId: string;
      maxResults?: number;
    }) => {
      try {
        const videoId = extractVideoId(rawId);
        const youtube = await getYouTubeClient();

        const response = await youtube.commentThreads.list({
          part: ["snippet"],
          videoId,
          maxResults,
          order: "relevance",
        });

        const comments = (response.data.items ?? []).map((item) => {
          const topComment = item.snippet?.topLevelComment?.snippet;
          return {
            id: item.id,
            author: topComment?.authorDisplayName ?? "Anonymous",
            authorChannelUrl: topComment?.authorChannelUrl ?? null,
            text: topComment?.textDisplay ?? "",
            likeCount: Number(topComment?.likeCount ?? 0),
            publishedAt: topComment?.publishedAt ?? null,
            totalReplyCount: Number(item.snippet?.totalReplyCount ?? 0),
          };
        });

        return {
          success: true,
          videoId,
          totalReturned: comments.length,
          comments,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },

  youtube_render_dashboard: {
    name: "youtube_render_dashboard",
    description:
      "Render the visual YouTube Studio Terminal UI dashboard for Coding Adda directly into the console output.",
    schema: z.object({
      period: z
        .enum(["7d", "28d", "90d", "365d"])
        .optional()
        .default("28d")
        .describe("Analytics period for the dashboard (defaults to '28d')."),
    }),
    execute: async ({
      period = "28d",
    }: {
      period?: "7d" | "28d" | "90d" | "365d";
    }) => {
      try {
        const channel = await getMyChannel();
        const analytics = await getCodingAddaAnalytics({ period });
        renderYouTubeDashboard(channel, analytics);

        return {
          success: true,
          rendered: true,
          channel: channel.title,
          subscribers: channel.subscribers,
          period: `${analytics.startDate} → ${analytics.endDate}`,
          views: analytics.views,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },

  youtube_show_thumbnail: {

    name: "youtube_show_thumbnail",
    description:
      "Display a YouTube channel avatar or video thumbnail directly inside the terminal using graphical terminal protocols (iTerm2, VSCode, Ghostty, WezTerm).",
    schema: z.object({
      source: z
        .string()
        .describe("YouTube video ID, video URL, channel ID, or direct thumbnail image URL."),
      width: z
        .number()
        .int()
        .min(10)
        .max(100)
        .optional()
        .default(40)
        .describe("Width of the displayed thumbnail in character columns. Defaults to 40."),
    }),
    execute: async ({
      source,
      width = 40,
    }: {
      source: string;
      width?: number;
    }) => {
      try {
        let imageUrl = source.trim();

        // If it's a video ID or URL, resolve the highest quality thumbnail
        if (
          !source.startsWith("http://") &&
          !source.startsWith("https://") ||
          source.includes("youtube.com") ||
          source.includes("youtu.be")
        ) {
          const videoId = extractVideoId(source);
          if (videoId && videoId.length === 11) {
            imageUrl = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          }
        }

        const { displayThumbnail } = await import("../../youtube/thumbnail");
        await displayThumbnail(imageUrl, { width });

        return {
          success: true,
          source,
          resolvedImageUrl: imageUrl,
          displayedWidth: width,
        };
      } catch (error) {
        return {
          success: false,
          message: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },
};


// ==========================================
// MCP Provider & AI SDK Exports
// ==========================================

export const youtubeMCPProvider: MCPProvider = {
  name: "youtube",
  getTools(): MCPTool[] {
    return Object.values(rawYouTubeTools).map((def) => ({
      name: def.name,
      description: def.description,
      schema: def.schema,
      execute: def.execute,
    }));
  },
};

export function createYouTubeMCPProvider(): MCPProvider {
  return youtubeMCPProvider;
}

export function createYouTubeTools() {
  const tools: Record<string, any> = {};
  for (const [key, def] of Object.entries(rawYouTubeTools)) {
    tools[key] = tool({
      description: def.description,
      inputSchema: def.schema,
      execute: def.execute as any,
    });
  }
  return tools;
}

