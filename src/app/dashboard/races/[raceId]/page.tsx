import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { TrainingPlanData, WeekData } from "@/types";

export default async function RacePage({
  params,
  searchParams,
}: {
  params: Promise<{ raceId: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { raceId } = await params;
  const { new: isNew } = await searchParams;

  const race = await prisma.race.findFirst({
    where: { id: raceId, userId: session.user.id },
    include: {
      trainingPlan: {
        include: {
          weeks: {
            include: { workouts: { orderBy: { order: "asc" } } },
            orderBy: { weekNumber: "asc" },
          },
        },
      },
      raceWeekBrief: true,
    },
  });

  if (!race) notFound();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { subscriptionStatus: true, subscriptionPlan: true },
  });

  const hasPaid = user?.subscriptionStatus === "active";
  const daysToRace = Math.ceil((race.date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
  const showRaceWeekBrief = daysToRace <= 7;

  const plan = race.trainingPlan;
  const planData = plan?.planData as unknown as TrainingPlanData | null;
  const currentWeek = plan?.currentWeek ?? 1;

  // Show first 2 weeks free, rest locked behind paywall
  const weeksToShow = hasPaid ? plan?.weeks ?? [] : (plan?.weeks ?? []).slice(0, 2);
  const hasMoreWeeks = !hasPaid && (plan?.weeks.length ?? 0) > 2;

  const WORKOUT_COLORS: Record<string, string> = {
    easy: "bg-green-50 border-green-200 text-green-800",
    tempo: "bg-orange-50 border-orange-200 text-orange-800",
    interval: "bg-red-50 border-red-200 text-red-800",
    long_run: "bg-blue-50 border-blue-200 text-blue-800",
    rest: "bg-gray-50 border-gray-200 text-gray-500",
    cross_train: "bg-purple-50 border-purple-200 text-purple-800",
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href="/dashboard" className="text-gray-500 hover:text-gray-700 text-sm">
            ← Dashboard
          </Link>
          <div className="h-4 w-px bg-gray-200" />
          <h1 className="font-semibold truncate">{race.name}</h1>
          <div className="ml-auto flex items-center gap-3">
            {showRaceWeekBrief && hasPaid && !race.raceWeekBrief && (
              <Link
                href={`/dashboard/races/${raceId}/brief`}
                className="bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-600"
              >
                🎯 Generate Race Brief
              </Link>
            )}
            {race.raceWeekBrief && (
              <Link
                href={`/dashboard/races/${raceId}/brief`}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium"
              >
                Race Week Brief →
              </Link>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {isNew && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
            <p className="text-green-800 font-medium text-sm">
              🎉 Your training plan is being generated! It'll be ready in about 30 seconds.
              Refresh the page to see it.
            </p>
          </div>
        )}

        {/* Race info bar */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Race date</p>
            <p className="font-semibold text-sm">
              {new Date(race.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Distance</p>
            <p className="font-semibold text-sm capitalize">{race.distanceType.replace("_", " ")}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Goal</p>
            <p className="font-semibold text-sm">{race.goalFinishTime ?? "Finish"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Days to race</p>
            <p className="font-semibold text-sm text-blue-600">{daysToRace} days</p>
          </div>
        </div>

        {/* Pace zones */}
        {planData?.paceZones && (
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-6">
            <h3 className="font-semibold text-sm mb-3">Your pace zones</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Easy", value: `${planData.paceZones.easy.min}–${planData.paceZones.easy.max}`, color: "text-green-600" },
                { label: "Tempo", value: `${planData.paceZones.tempo.min}–${planData.paceZones.tempo.max}`, color: "text-orange-600" },
                { label: "Interval", value: `${planData.paceZones.interval.min}–${planData.paceZones.interval.max}`, color: "text-red-600" },
                { label: "Marathon", value: planData.paceZones.marathon, color: "text-blue-600" },
              ].map((z) => (
                <div key={z.label} className="text-center">
                  <p className={`font-bold text-sm ${z.color}`}>{z.value}</p>
                  <p className="text-xs text-gray-500">{z.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Training plan */}
        {!plan ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-3xl mb-3 animate-pulse">⏳</div>
            <p className="text-gray-500">Your training plan is being generated…</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                Training Plan · {plan.totalWeeks} weeks
              </h2>
              <span className="text-sm text-gray-500">
                Week {currentWeek} of {plan.totalWeeks}
              </span>
            </div>

            {weeksToShow.map((week) => (
              <WeekCard
                key={week.id}
                week={week as unknown as WeekWithWorkouts}
                isCurrent={week.weekNumber === currentWeek}
                workoutColors={WORKOUT_COLORS}
              />
            ))}

            {hasMoreWeeks && (
              <div className="bg-white rounded-2xl border border-gray-200 p-8 text-center">
                <div className="text-3xl mb-3">🔒</div>
                <h3 className="font-semibold mb-2">
                  {plan.totalWeeks - 2} more weeks in your plan
                </h3>
                <p className="text-gray-500 text-sm mb-6">
                  Unlock your full training plan + race week brief
                </p>
                <Link
                  href="/pricing"
                  className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700"
                >
                  Unlock Full Plan — $24
                </Link>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

interface WorkoutRow {
  id: string;
  dayOfWeek: number;
  type: string;
  distance: number | null;
  paceZoneMin: string | null;
  paceZoneMax: string | null;
  effortLevel: string | null;
  explanation: string | null;
}

interface WeekWithWorkouts {
  id: string;
  weekNumber: number;
  phase: string;
  isDeload: boolean;
  totalMiles: number | null;
  workouts: WorkoutRow[];
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function WeekCard({
  week,
  isCurrent,
  workoutColors,
}: {
  week: WeekWithWorkouts;
  isCurrent: boolean;
  workoutColors: Record<string, string>;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border p-5 ${
        isCurrent ? "border-blue-400 shadow-blue-100 shadow-md" : "border-gray-100"
      }`}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="text-sm font-semibold text-gray-700">Week {week.weekNumber}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
          { base: "bg-green-100 text-green-700", build: "bg-yellow-100 text-yellow-700",
            peak: "bg-orange-100 text-orange-700", taper: "bg-blue-100 text-blue-700" }[week.phase] ?? "bg-gray-100 text-gray-600"
        }`}>
          {week.phase}
        </span>
        {week.isDeload && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
            Deload
          </span>
        )}
        {isCurrent && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-600 text-white font-medium">
            Current
          </span>
        )}
        {week.totalMiles && (
          <span className="ml-auto text-xs text-gray-500">{week.totalMiles} mi</span>
        )}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DAYS.map((day, i) => {
          const workout = week.workouts.find((w) => w.dayOfWeek === i);
          return (
            <div key={day} className="text-center">
              <p className="text-xs text-gray-400 mb-1">{day}</p>
              {workout ? (
                <div
                  className={`rounded-lg border p-1.5 ${workoutColors[workout.type] ?? "bg-gray-50 border-gray-200"}`}
                  title={workout.explanation ?? ""}
                >
                  <p className="text-xs font-medium capitalize leading-tight">
                    {workout.type.replace("_", " ")}
                  </p>
                  {workout.distance && (
                    <p className="text-xs">{workout.distance}mi</p>
                  )}
                </div>
              ) : (
                <div className="rounded-lg border border-gray-100 p-1.5 h-10" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
