import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const STRAVA_API = "https://www.strava.com/api/v3";

interface StravaTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

async function refreshStravaToken(userId: string, tokens: StravaTokens): Promise<string> {
  if (new Date() < tokens.expiresAt) {
    return tokens.accessToken;
  }

  const res = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: process.env.STRAVA_CLIENT_ID,
      client_secret: process.env.STRAVA_CLIENT_SECRET,
      grant_type: "refresh_token",
      refresh_token: tokens.refreshToken,
    }),
  });

  if (!res.ok) throw new Error(`Strava token refresh failed: ${res.status}`);

  const data = await res.json();

  await prisma.oAuthToken.update({
    where: { userId_provider: { userId, provider: "strava" } },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(data.expires_at * 1000),
    },
  });

  return data.access_token;
}

export async function getStravaActivities(
  userId: string,
  afterTimestamp?: number
): Promise<StravaActivity[]> {
  const tokenRecord = await prisma.oAuthToken.findUnique({
    where: { userId_provider: { userId, provider: "strava" } },
  });

  if (!tokenRecord) throw new Error("No Strava connection found");

  const accessToken = await refreshStravaToken(userId, {
    accessToken: tokenRecord.accessToken,
    refreshToken: tokenRecord.refreshToken ?? "",
    expiresAt: tokenRecord.expiresAt,
  });

  const params = new URLSearchParams({
    per_page: "30",
    ...(afterTimestamp ? { after: afterTimestamp.toString() } : {}),
  });

  const res = await fetch(`${STRAVA_API}/athlete/activities?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    // Check rate limits
    const usage = res.headers.get("X-RateLimit-Usage");
    if (res.status === 429 || (usage && parseInt(usage.split(",")[0]) > 80)) {
      throw new Error("RATE_LIMIT_EXCEEDED");
    }
    throw new Error(`Strava API error: ${res.status}`);
  }

  return res.json();
}

export async function syncStravaActivities(userId: string): Promise<number> {
  // Get most recent activity we have
  const lastActivity = await prisma.activityLog.findFirst({
    where: { userId, source: "strava" },
    orderBy: { date: "desc" },
  });

  const afterTimestamp = lastActivity
    ? Math.floor(lastActivity.date.getTime() / 1000)
    : Math.floor((Date.now() - 60 * 24 * 60 * 60 * 1000) / 1000); // 60 days ago

  const activities = await getStravaActivities(userId, afterTimestamp);
  let synced = 0;

  for (const activity of activities) {
    if (!["Run", "Trail Run", "Race"].includes(activity.type)) continue;

    // Idempotent upsert — won't duplicate
    await prisma.activityLog.upsert({
      where: {
        userId_externalId_source: {
          userId,
          externalId: activity.id.toString(),
          source: "strava",
        },
      },
      create: {
        userId,
        externalId: activity.id.toString(),
        source: "strava",
        date: new Date(activity.start_date),
        type: "run",
        distance: activity.distance / 1609.34, // meters to miles
        duration: activity.moving_time,
        avgPace: metersPerSecToMilePace(activity.average_speed),
        avgHeartRate: activity.average_heartrate,
        raw: activity as unknown as Prisma.InputJsonValue,
      },
      update: {
        avgHeartRate: activity.average_heartrate,
        raw: activity as unknown as Prisma.InputJsonValue,
      },
    });
    synced++;
  }

  return synced;
}

function metersPerSecToMilePace(metersPerSec: number): string {
  if (!metersPerSec || metersPerSec === 0) return "";
  const secondsPerMile = 1609.34 / metersPerSec;
  const minutes = Math.floor(secondsPerMile / 60);
  const seconds = Math.round(secondsPerMile % 60);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export interface StravaActivity {
  id: number;
  name: string;
  type: string;
  start_date: string;
  distance: number;
  moving_time: number;
  average_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  total_elevation_gain?: number;
}
