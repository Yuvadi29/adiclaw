import { getYouTubeAnalyticsClient } from "./client";

import { CHANNEL_ID } from "./channel";

export interface YouTubeAnalyticsSummary {
  startDate: string;
  endDate: string;

  views: number;
  likes: number;
  comments: number;

  estimatedMinutesWatched: number;

  averageViewDuration: number;

  subscribersGained: number;
  subscribersLost: number;
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getCodingAddaAnalytics(): Promise<YouTubeAnalyticsSummary> {
  const analytics = await getYouTubeAnalyticsClient();

  const end = new Date();

  const start = new Date();

  start.setDate(start.getDate() - 28);

  const startDate = formatDate(start);

  const endDate = formatDate(end);

  const response = await analytics.reports.query({
    ids: `channel==${CHANNEL_ID}`,

    startDate,

    endDate,

    metrics: [
      "views",
      "likes",
      "comments",
      "estimatedMinutesWatched",
      "averageViewDuration",
      "subscribersGained",
      "subscribersLost",
    ].join(","),
  });

  const row = response.data.rows?.[0];

  if (!row) {
    return {
      startDate,
      endDate,

      views: 0,
      likes: 0,
      comments: 0,

      estimatedMinutesWatched: 0,

      averageViewDuration: 0,

      subscribersGained: 0,
      subscribersLost: 0,
    };
  }

  return {
    startDate,
    endDate,

    views: Number(row[0] ?? 0),

    likes: Number(row[1] ?? 0),

    comments: Number(row[2] ?? 0),

    estimatedMinutesWatched: Number(row[3] ?? 0),

    averageViewDuration: Number(row[4] ?? 0),

    subscribersGained: Number(row[5] ?? 0),

    subscribersLost: Number(row[6] ?? 0),
  };
}
