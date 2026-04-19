import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { adaptWeeklyPlan } from "@/lib/ai/training-plan";
import { sendWeeklyCheckIn, sendRaceWeekBriefReady } from "@/lib/email/templates";
import { generateRaceWeekBrief } from "@/lib/ai/race-brief";

// Vercel cron: runs every Monday at 6am UTC
// vercel.json: { "crons": [{ "path": "/api/cron/weekly-checkin", "schedule": "0 6 * * 1" }] }

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const activeRaces = await prisma.race.findMany({
    where: { status: "active", date: { gte: new Date() } },
    include: {
      user: true,
      trainingPlan: {
        include: {
          weeks: {
            where: { weekNumber: { gte: 1 } },
            orderBy: { weekNumber: "asc" },
            take: 2,
            include: { workouts: true },
          },
        },
      },
      raceWeekBrief: { select: { id: true } },
    },
  });

  const results = { processed: 0, errors: 0 };

  for (const race of activeRaces) {
    try {
      const plan = race.trainingPlan;
      if (!plan) continue;

      const daysToRace = Math.ceil((race.date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

      // Auto-generate race week brief T-7
      if (daysToRace <= 7 && daysToRace > 0 && !race.raceWeekBrief) {
        const brief = await generateRaceWeekBrief({
          raceName: race.name,
          raceDate: race.date.toISOString(),
          distanceType: race.distanceType as "marathon" | "half_marathon" | "10k" | "5k",
          goalFinishTime: race.goalFinishTime ?? "finish",
          goalPace: "unknown",
        });

        await prisma.raceWeekBrief.create({
          data: {
            raceId: race.id,
            weather: brief.weather as unknown as Prisma.InputJsonValue,
            courseOverview: brief.courseOverview,
            elevationSummary: brief.elevationSummary,
            pacingStrategy: brief.pacingStrategy as unknown as Prisma.InputJsonValue,
            fuelingPlan: brief.fuelingPlan as unknown as Prisma.InputJsonValue,
            checklist: brief.checklist as unknown as Prisma.InputJsonValue,
          },
        });

        if (race.user.email) {
          await sendRaceWeekBriefReady(
            race.user.email,
            race.user.name ?? "Runner",
            race.name,
            race.date.toISOString(),
            race.id
          );
        }
        results.processed++;
        continue;
      }

      // Weekly adaptation
      const currentWeekData = plan.weeks.find((w) => w.weekNumber === plan.currentWeek);
      if (!currentWeekData) continue;

      // Get last week's activities
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);
      const activities = await prisma.activityLog.findMany({
        where: { userId: race.userId, date: { gte: weekStart } },
      });

      if (activities.length > 0) {
        const adaptation = await adaptWeeklyPlan({
          currentWeek: plan.currentWeek,
          plannedWorkouts: currentWeekData.workouts.map((w) => ({
            day: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w.dayOfWeek] ?? "Mon",
            type: w.type,
            targetMiles: w.distance ?? undefined,
          })),
          actualActivities: activities.map((a) => ({
            date: a.date.toISOString(),
            distance: a.distance,
            avgPace: a.avgPace ?? "",
            perceivedEffort: a.perceivedEffort ?? 5,
          })),
          remainingWeeks: plan.totalWeeks - plan.currentWeek,
          distanceType: race.distanceType as "marathon" | "half_marathon" | "10k" | "5k",
          goalPace: "unknown",
        });

        // Advance to next week
        await prisma.trainingPlan.update({
          where: { id: plan.id },
          data: {
            currentWeek: Math.min(plan.currentWeek + 1, plan.totalWeeks),
            adaptedAt: new Date(),
            version: { increment: 1 },
          },
        });

        // Send weekly check-in email
        const nextWeek = plan.weeks.find((w) => w.weekNumber === plan.currentWeek + 1);
        const nextWorkouts = nextWeek?.workouts
          .filter((w) => w.type !== "rest")
          .map((w) => `${["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][w.dayOfWeek]}: ${w.type.replace("_", " ")} ${w.distance ? `${w.distance}mi` : ""}`)
          .slice(0, 3) ?? [];

        if (race.user.email) {
          await sendWeeklyCheckIn(
            race.user.email,
            race.user.name ?? "Runner",
            race.id,
            adaptation.summary,
            nextWorkouts
          );
        }
      }

      results.processed++;
    } catch (err) {
      console.error(`Cron error for race ${race.id}:`, err);
      results.errors++;
    }
  }

  return NextResponse.json(results);
}
