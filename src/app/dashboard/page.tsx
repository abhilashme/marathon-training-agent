import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const races = await prisma.race.findMany({
    where: { userId: session.user.id, status: "active" },
    include: {
      trainingPlan: {
        select: { currentWeek: true, totalWeeks: true, phase: true },
      },
      raceWeekBrief: { select: { id: true } },
    },
    orderBy: { date: "asc" },
  });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, subscriptionStatus: true, subscriptionPlan: true },
  });

  const hasPaid = user?.subscriptionStatus === "active";
  const upcomingRace = races[0];
  const daysToRace = upcomingRace
    ? Math.ceil((upcomingRace.date.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">🏃</span>
            <span className="font-bold">Marathon Agent</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {user?.name ?? session.user.email}
            </span>
            <Link
              href="/api/auth/signout"
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Welcome + subscription status */}
        {!hasPaid && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-center justify-between">
            <div>
              <p className="font-medium text-blue-800 text-sm">You're on the free preview</p>
              <p className="text-blue-700 text-xs">Unlock your full plan + race week brief</p>
            </div>
            <Link
              href="/pricing"
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Upgrade →
            </Link>
          </div>
        )}

        {/* Race countdown */}
        {upcomingRace && daysToRace !== null && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 mb-1">Next race</p>
                <h2 className="text-xl font-bold">{upcomingRace.name}</h2>
                <p className="text-gray-500 text-sm mt-1">
                  {new Date(upcomingRace.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-blue-600">{daysToRace}</div>
                <div className="text-sm text-gray-500">days away</div>
              </div>
            </div>
            {upcomingRace.trainingPlan && (
              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center gap-6">
                <div>
                  <p className="text-xs text-gray-500">Current phase</p>
                  <p className="font-medium capitalize">{upcomingRace.trainingPlan.phase}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Progress</p>
                  <p className="font-medium">
                    Week {upcomingRace.trainingPlan.currentWeek} of{" "}
                    {upcomingRace.trainingPlan.totalWeeks}
                  </p>
                </div>
                <Link
                  href={`/dashboard/races/${upcomingRace.id}`}
                  className="ml-auto text-blue-600 text-sm font-medium hover:underline"
                >
                  View plan →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Races grid */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Your races</h2>
          <Link
            href="/onboarding"
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            + Add race
          </Link>
        </div>

        {races.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 p-12 text-center">
            <div className="text-4xl mb-4">🏃</div>
            <h3 className="font-semibold mb-2">No races yet</h3>
            <p className="text-gray-500 text-sm mb-6">Add your first race to get a personalized training plan.</p>
            <Link
              href="/onboarding"
              className="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700"
            >
              Add My First Race →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {races.map((race) => {
              const days = Math.ceil((race.date.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
              const hasWeekBrief = days <= 7 && !!race.raceWeekBrief?.id;
              return (
                <Link
                  key={race.id}
                  href={`/dashboard/races/${race.id}`}
                  className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-semibold">{race.name}</h3>
                    {days <= 7 && (
                      <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-medium">
                        Race week!
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    {new Date(race.date).toLocaleDateString()} · {race.distanceType.replace("_", " ")}
                  </p>
                  {race.trainingPlan ? (
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>Week {race.trainingPlan.currentWeek}/{race.trainingPlan.totalWeeks}</span>
                      <span className="capitalize">{race.trainingPlan.phase} phase</span>
                      {hasWeekBrief && <span className="text-green-600">Brief ready ✓</span>}
                    </div>
                  ) : (
                    <span className="text-xs text-blue-500">Generating plan…</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
