import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { generateTrainingPlan } from "@/lib/ai/training-plan";
import { z } from "zod";

const CreateRaceSchema = z.object({
  name: z.string().min(1),
  date: z.string().refine((d) => !isNaN(Date.parse(d))),
  distanceType: z.enum(["marathon", "half_marathon", "10k", "5k"]),
  goalFinishTime: z.string().optional(),
  trainingDaysPerWeek: z.number().int().min(3).max(7).default(4),
  currentWeeklyMiles: z.number().optional(),
  longestRecentRun: z.number().optional(),
  recentRaceTimes: z.string().optional(),
  fitnessLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = CreateRaceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;
  const raceDate = new Date(data.date);
  const weeksUntilRace = Math.floor((raceDate.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000));

  if (weeksUntilRace < 4) {
    return NextResponse.json(
      { error: "Race is too soon. Minimum 4 weeks required for a training plan." },
      { status: 400 }
    );
  }

  // Create race record
  const race = await prisma.race.create({
    data: {
      userId: session.user.id,
      name: data.name,
      date: raceDate,
      distanceType: data.distanceType,
      goalFinishTime: data.goalFinishTime,
      trainingDaysPerWeek: data.trainingDaysPerWeek,
    },
  });

  // Generate AI plan (async — return race immediately, plan generates in background)
  generateTrainingPlanAndSave(race.id, session.user.id, data).catch(console.error);

  return NextResponse.json({ race, status: "generating" }, { status: 201 });
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const races = await prisma.race.findMany({
    where: { userId: session.user.id },
    include: {
      trainingPlan: {
        select: { currentWeek: true, totalWeeks: true, phase: true },
      },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(races);
}

async function generateTrainingPlanAndSave(
  raceId: string,
  userId: string,
  data: z.infer<typeof CreateRaceSchema>
) {
  const planData = await generateTrainingPlan({
    distanceType: data.distanceType,
    raceDate: data.date,
    goalFinishTime: data.goalFinishTime ?? "",
    trainingDaysPerWeek: data.trainingDaysPerWeek,
    currentWeeklyMiles: data.currentWeeklyMiles,
    longestRecentRun: data.longestRecentRun,
    recentRaceTimes: data.recentRaceTimes,
    fitnessLevel: data.fitnessLevel,
  });

  const plan = await prisma.trainingPlan.create({
    data: {
      raceId,
      totalWeeks: planData.metadata.totalWeeks,
      phase: planData.weeks[0]?.phase ?? "base",
      planData: planData as unknown as Prisma.InputJsonValue,
    },
  });

  // Persist individual weeks and workouts
  for (const week of planData.weeks) {
    const dbWeek = await prisma.trainingWeek.create({
      data: {
        planId: plan.id,
        weekNumber: week.weekNumber,
        phase: week.phase,
        isDeload: week.isDeload,
        totalMiles: week.totalMiles,
      },
    });

    const dayIndex: Record<string, number> = {
      Sunday: 0, Monday: 1, Tuesday: 2, Wednesday: 3,
      Thursday: 4, Friday: 5, Saturday: 6,
    };

    await prisma.trainingWorkout.createMany({
      data: week.workouts.map((w, i) => ({
        weekId: dbWeek.id,
        dayOfWeek: dayIndex[w.day] ?? i,
        type: w.type,
        distance: w.targetMiles,
        duration: w.duration,
        paceZoneMin: w.paceZone?.min,
        paceZoneMax: w.paceZone?.max,
        effortLevel: w.effortLevel,
        explanation: w.explanation,
        order: i,
      })),
    });
  }

  void userId; // suppress unused warning
}
