import { google } from "googleapis";
import { getYouTubeAuth } from "./auth";

let authPromise: ReturnType<typeof getYouTubeAuth> | null = null;

async function getAuth() {
  if (!authPromise) {
    authPromise = getYouTubeAuth();
  }

  return authPromise;
}

export async function getYouTubeClient() {
  const auth = await getAuth();

  return google.youtube({
    version: "v3",
    auth,
  });
}

export async function getYouTubeAnalyticsClient() {
  const auth = await getAuth();

  return google.youtubeAnalytics({
    version: "v2",
    auth,
  });
}
