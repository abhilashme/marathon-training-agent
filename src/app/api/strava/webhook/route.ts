import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { syncStravaActivities } from "@/lib/strava/client";

// Strava webhook verification (GET)
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");

  if (mode === "subscribe" && token === process.env.STRAVA_WEBHOOK_VERIFY_TOKEN) {
    return NextResponse.json({ "hub.challenge": challenge });
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Strava webhook event (POST)
export async function POST(req: NextRequest) {
  const body = await req.json();
  const eventId = `${body.object_id}_${body.event_time}_${body.aspect_type}`;

  // Idempotency: skip if already processed
  const existing = await prisma.webhookEvent.findUnique({
    where: { provider_eventId: { provider: "strava", eventId } },
  });
  if (existing?.processedAt) {
    return NextResponse.json({ status: "already_processed" });
  }

  // Record event
  await prisma.webhookEvent.upsert({
    where: { provider_eventId: { provider: "strava", eventId } },
    create: {
      provider: "strava",
      eventId,
      eventType: body.aspect_type,
      payload: body as Prisma.InputJsonValue,
    },
    update: {},
  });

  // Only process activity creates/updates
  if (body.object_type === "activity" && ["create", "update"].includes(body.aspect_type)) {
    // Find user by Strava athlete ID
    const oauthToken = await prisma.oAuthToken.findFirst({
      where: { provider: "strava", athleteId: body.owner_id?.toString() },
    });

    if (oauthToken) {
      await syncStravaActivities(oauthToken.userId);
    }
  }

  // Mark as processed
  await prisma.webhookEvent.update({
    where: { provider_eventId: { provider: "strava", eventId } },
    data: { processedAt: new Date() },
  });

  return NextResponse.json({ status: "ok" });
}
