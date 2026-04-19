import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { RaceWeekBriefData } from "@/types";

export default async function BriefPage({
  params,
}: {
  params: Promise<{ raceId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const { raceId } = await params;

  const race = await prisma.race.findFirst({
    where: { id: raceId, userId: session.user.id },
    include: { raceWeekBrief: true },
  });

  if (!race) notFound();

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { subscriptionStatus: true },
  });

  const hasPaid = user?.subscriptionStatus === "active";

  if (!hasPaid) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">Race Week Brief is a paid feature</h2>
          <p className="text-gray-500 text-sm mb-6">
            Unlock your personalized pacing strategy, weather forecast, and fueling plan.
          </p>
          <Link
            href="/pricing"
            className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700"
          >
            Unlock — $24
          </Link>
        </div>
      </div>
    );
  }

  if (!race.raceWeekBrief) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-8 max-w-md text-center">
          <div className="text-4xl mb-4">📋</div>
          <h2 className="text-xl font-bold mb-2">Race Week Brief not generated yet</h2>
          <p className="text-gray-500 text-sm mb-6">
            Your brief will be automatically generated 7 days before your race.
            You can also generate it now.
          </p>
          <GenerateBriefButton raceId={raceId} />
        </div>
      </div>
    );
  }

  const brief = race.raceWeekBrief;
  const weather = brief.weather as unknown as RaceWeekBriefData["weather"];
  const pacingStrategy = brief.pacingStrategy as unknown as RaceWeekBriefData["pacingStrategy"];
  const fuelingPlan = brief.fuelingPlan as unknown as RaceWeekBriefData["fuelingPlan"];
  const checklist = brief.checklist as unknown as RaceWeekBriefData["checklist"];

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link href={`/dashboard/races/${raceId}`} className="text-gray-500 hover:text-gray-700 text-sm">
            ← Back to plan
          </Link>
          <div className="h-4 w-px bg-gray-200" />
          <h1 className="font-semibold">Race Week Brief</h1>
          <div className="ml-auto">
            <span className="text-xs text-gray-500">
              {race.name} · {new Date(race.date).toLocaleDateString()}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-6">
        {/* Weather */}
        {weather && (
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span>🌤️</span> Race Day Weather
            </h2>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{Math.round(weather.tempMin)}–{Math.round(weather.tempMax)}°F</p>
                <p className="text-xs text-gray-500">Temperature</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{weather.precipitationProbability}%</p>
                <p className="text-xs text-gray-500">Rain chance</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{Math.round(weather.windSpeed)} mph</p>
                <p className="text-xs text-gray-500">Wind</p>
              </div>
            </div>
            <p className="text-sm text-gray-700 bg-blue-50 rounded-lg p-3">{weather.description}</p>
          </section>
        )}

        {/* Course overview */}
        {brief.courseOverview && (
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold mb-3 flex items-center gap-2">
              <span>🗺️</span> Course Overview
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed">{brief.courseOverview}</p>
            {brief.elevationSummary && (
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{brief.elevationSummary}</p>
            )}
          </section>
        )}

        {/* Pacing strategy */}
        {pacingStrategy?.segments && (
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span>⏱️</span> Pacing Strategy
            </h2>
            <div className="space-y-2">
              {pacingStrategy.segments.map((seg) => (
                <div key={seg.mile} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                  <span className="text-xs font-medium text-gray-500 w-12">Mile {seg.mile}</span>
                  <span className="font-mono text-sm font-semibold text-blue-600 w-16">{seg.targetPace}</span>
                  <span className="text-sm text-gray-600 flex-1">{seg.notes}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Fueling plan */}
        {fuelingPlan && (
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span>🍌</span> Fueling & Hydration Plan
            </h2>
            <div className="bg-blue-50 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-800 font-medium">Hydration</p>
              <p className="text-sm text-blue-700">{fuelingPlan.hydrationIntervals}</p>
            </div>
            {fuelingPlan.gels.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium mb-2">Gel timing</p>
                <div className="space-y-1">
                  {fuelingPlan.gels.map((gel, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500 w-16">Mile {gel.mile}</span>
                      <span className="text-gray-700">{gel.product}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-sm text-gray-600">{fuelingPlan.notes}</p>
          </section>
        )}

        {/* Checklists */}
        {checklist && checklist.length > 0 && (
          <section className="bg-white rounded-2xl border border-gray-100 p-6">
            <h2 className="font-semibold mb-4 flex items-center gap-2">
              <span>✅</span> Pre-Race Checklist
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {checklist.map((cat) => (
                <div key={cat.category}>
                  <h3 className="text-sm font-semibold text-gray-700 mb-2">{cat.category}</h3>
                  <ul className="space-y-1">
                    {cat.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className="text-gray-300 mt-0.5">□</span>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function GenerateBriefButton({ raceId }: { raceId: string }) {
  return (
    <form action={`/api/races/${raceId}/brief`} method="POST">
      <button
        type="submit"
        className="bg-blue-600 text-white px-6 py-3 rounded-xl font-semibold hover:bg-blue-700"
      >
        Generate Race Week Brief
      </button>
    </form>
  );
}
