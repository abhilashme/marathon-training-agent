import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncStravaActivities } from "@/lib/strava/client";

export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const synced = await syncStravaActivities(session.user.id);
    return NextResponse.json({ synced });
  } catch (error) {
    if (error instanceof Error && error.message === "RATE_LIMIT_EXCEEDED") {
      return NextResponse.json({ error: "Rate limit exceeded. Try again in 15 minutes." }, { status: 429 });
    }
    if (error instanceof Error && error.message === "No Strava connection found") {
      return NextResponse.json({ error: "Strava not connected" }, { status: 404 });
    }
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
