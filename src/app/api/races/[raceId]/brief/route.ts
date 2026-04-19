import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { generateRaceWeekBrief } from "@/lib/ai/race-brief";
import { sendRaceWeekBriefReady } from "@/lib/email/templates";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { raceId } = await params;

  // Verify ownership and subscription
  const race = await prisma.race.findFirst({
    where: { id: raceId, userId: session.user.id },
    include: { trainingPlan: true },
  });

  if (!race) return NextResponse.json({ error: "Race not found" }, { status: 404 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  const hasPaid = user?.subscriptionStatus === "active";

  if (!hasPaid) {
    return NextResponse.json(
      { error: "Race Prep Pack or Season Pass required" },
      { status: 403 }
    );
  }

  // Return existing brief if generated
  const existing = await prisma.raceWeekBrief.findUnique({ where: { raceId } });
  if (existing) return NextResponse.json(existing);

  const body = await req.json().catch(() => ({}));

  const brief = await generateRaceWeekBrief({
    raceName: race.name,
    raceDate: race.date.toISOString(),
    distanceType: race.distanceType as "marathon" | "half_marathon" | "10k" | "5k",
    goalFinishTime: race.goalFinishTime ?? "finish",
    goalPace: calculateGoalPace(race.goalFinishTime, race.distanceType),
    latitude: body.latitude,
    longitude: body.longitude,
    trainingPeakWeekMiles: body.peakWeekMiles,
  });

  const saved = await prisma.raceWeekBrief.create({
    data: {
      raceId,
      weather: brief.weather as unknown as Prisma.InputJsonValue,
      courseOverview: brief.courseOverview,
      elevationSummary: brief.elevationSummary,
      pacingStrategy: brief.pacingStrategy as unknown as Prisma.InputJsonValue,
      fuelingPlan: brief.fuelingPlan as unknown as Prisma.InputJsonValue,
      checklist: brief.checklist as unknown as Prisma.InputJsonValue,
    },
  });

  // Send email notification
  if (user?.email) {
    sendRaceWeekBriefReady(
      user.email,
      user.name ?? "Runner",
      race.name,
      race.date.toISOString(),
      raceId
    ).catch(console.error);
  }

  return NextResponse.json(saved, { status: 201 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ raceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { raceId } = await params;

  const race = await prisma.race.findFirst({
    where: { id: raceId, userId: session.user.id },
  });
  if (!race) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const brief = await prisma.raceWeekBrief.findUnique({ where: { raceId } });
  if (!brief) return NextResponse.json({ error: "Brief not generated yet" }, { status: 404 });

  return NextResponse.json(brief);
}

function calculateGoalPace(goalTime: string | null, distanceType: string): string {
  if (!goalTime) return "unknown";
  const [h, m, s] = goalTime.split(":").map(Number);
  const totalSeconds = (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0);
  const miles = { marathon: 26.2, half_marathon: 13.1, "10k": 6.2, "5k": 3.1 }[distanceType] ?? 26.2;
  const paceSeconds = totalSeconds / miles;
  const paceMins = Math.floor(paceSeconds / 60);
  const paceSecs = Math.round(paceSeconds % 60);
  return `${paceMins}:${paceSecs.toString().padStart(2, "0")}`;
}
