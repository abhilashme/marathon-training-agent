"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Step = "race" | "fitness" | "connect" | "preview";

interface OnboardingData {
  raceName: string;
  raceDate: string;
  distanceType: string;
  goalFinishTime: string;
  trainingDaysPerWeek: number;
  currentWeeklyMiles: string;
  longestRecentRun: string;
  recentRaceTimes: string;
  fitnessLevel: string;
}

const DISTANCES = [
  { value: "marathon", label: "Marathon (26.2 mi)" },
  { value: "half_marathon", label: "Half Marathon (13.1 mi)" },
  { value: "10k", label: "10K (6.2 mi)" },
  { value: "5k", label: "5K (3.1 mi)" },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("race");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<OnboardingData>({
    raceName: "",
    raceDate: "",
    distanceType: "marathon",
    goalFinishTime: "",
    trainingDaysPerWeek: 4,
    currentWeeklyMiles: "",
    longestRecentRun: "",
    recentRaceTimes: "",
    fitnessLevel: "intermediate",
  });

  const steps: Step[] = ["race", "fitness", "connect", "preview"];
  const stepIndex = steps.indexOf(step);

  function update(field: keyof OnboardingData, value: string | number) {
    setData((d) => ({ ...d, [field]: value }));
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/races", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.raceName,
          date: data.raceDate,
          distanceType: data.distanceType,
          goalFinishTime: data.goalFinishTime || undefined,
          trainingDaysPerWeek: data.trainingDaysPerWeek,
          currentWeeklyMiles: data.currentWeeklyMiles ? Number(data.currentWeeklyMiles) : undefined,
          longestRecentRun: data.longestRecentRun ? Number(data.longestRecentRun) : undefined,
          recentRaceTimes: data.recentRaceTimes || undefined,
          fitnessLevel: data.fitnessLevel,
        }),
      });

      if (res.status === 401) {
        router.push("/auth/signin?callbackUrl=/onboarding");
        return;
      }

      if (!res.ok) {
        const err = await res.json();
        setError(err.error ?? "Something went wrong");
        return;
      }

      const { race } = await res.json();
      router.push(`/dashboard/races/${race.id}?new=1`);
    } catch {
      setError("Failed to create race. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  i <= stepIndex ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
                }`}
              >
                {i + 1}
              </div>
              {i < steps.length - 1 && (
                <div className={`h-0.5 flex-1 ${i < stepIndex ? "bg-blue-600" : "bg-gray-200"}`} />
              )}
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {step === "race" && (
            <div>
              <h2 className="text-2xl font-bold mb-6">Tell us about your race</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Race Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Boston Marathon 2026"
                    value={data.raceName}
                    onChange={(e) => update("raceName", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Race Date</label>
                  <input
                    type="date"
                    value={data.raceDate}
                    onChange={(e) => update("raceDate", e.target.value)}
                    min={new Date(Date.now() + 28 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Distance</label>
                  <div className="grid grid-cols-2 gap-2">
                    {DISTANCES.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => update("distanceType", d.value)}
                        className={`py-2.5 px-3 rounded-lg border text-sm font-medium transition-colors ${
                          data.distanceType === d.value
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Goal Finish Time <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 3:45:00 or 1:55:00"
                    value={data.goalFinishTime}
                    onChange={(e) => update("goalFinishTime", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Training days per week
                  </label>
                  <div className="flex gap-2">
                    {[3, 4, 5, 6].map((n) => (
                      <button
                        key={n}
                        onClick={() => update("trainingDaysPerWeek", n)}
                        className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                          data.trainingDaysPerWeek === n
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "fitness" && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Your current fitness</h2>
              <p className="text-gray-500 text-sm mb-6">
                Help us calibrate your plan. Skip anything you don't know — we'll estimate.
              </p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Current weekly mileage <span className="text-gray-400">(miles)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 25"
                    value={data.currentWeeklyMiles}
                    onChange={(e) => update("currentWeeklyMiles", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Longest recent run <span className="text-gray-400">(miles)</span>
                  </label>
                  <input
                    type="number"
                    placeholder="e.g. 12"
                    value={data.longestRecentRun}
                    onChange={(e) => update("longestRecentRun", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Recent race times <span className="text-gray-400">(optional)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 5K: 24:00, half: 2:05"
                    value={data.recentRaceTimes}
                    onChange={(e) => update("recentRaceTimes", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Experience level</label>
                  <div className="grid grid-cols-3 gap-2">
                    {(["beginner", "intermediate", "advanced"] as const).map((l) => (
                      <button
                        key={l}
                        onClick={() => update("fitnessLevel", l)}
                        className={`py-2.5 rounded-lg border text-sm font-medium capitalize transition-colors ${
                          data.fitnessLevel === l
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-gray-300 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {step === "connect" && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Connect your apps</h2>
              <p className="text-gray-500 text-sm mb-6">
                Connect Strava or Garmin to auto-sync your runs and get weekly plan adaptations.
                You can skip this and log runs manually.
              </p>
              <div className="space-y-3">
                <a
                  href="/api/auth/signin/strava"
                  className="flex items-center gap-4 border border-gray-200 rounded-xl p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                    S
                  </div>
                  <div>
                    <div className="font-medium text-sm">Connect Strava</div>
                    <div className="text-xs text-gray-500">Auto-sync all your runs</div>
                  </div>
                  <div className="ml-auto text-gray-400">→</div>
                </a>
                <div className="flex items-center gap-4 border border-gray-200 rounded-xl p-4 opacity-60 cursor-not-allowed">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-sm">
                    G
                  </div>
                  <div>
                    <div className="font-medium text-sm">Connect Garmin</div>
                    <div className="text-xs text-gray-500">Coming soon</div>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-4 text-center">
                We only read activity data. We never post on your behalf.
              </p>
            </div>
          )}

          {step === "preview" && (
            <div>
              <h2 className="text-2xl font-bold mb-2">Ready to build your plan</h2>
              <p className="text-gray-500 text-sm mb-6">
                Here's what we'll generate for you:
              </p>
              <div className="bg-blue-50 rounded-xl p-4 mb-6 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Race</span>
                  <span className="font-medium">{data.raceName || "Your race"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Distance</span>
                  <span className="font-medium">
                    {DISTANCES.find((d) => d.value === data.distanceType)?.label}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Race date</span>
                  <span className="font-medium">
                    {data.raceDate ? new Date(data.raceDate).toLocaleDateString() : "—"}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Goal</span>
                  <span className="font-medium">{data.goalFinishTime || "Finish"}</span>
                </div>
              </div>
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-4">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {stepIndex > 0 && (
              <button
                onClick={() => setStep(steps[stepIndex - 1]!)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Back
              </button>
            )}
            {step !== "preview" ? (
              <button
                onClick={() => setStep(steps[stepIndex + 1]!)}
                disabled={step === "race" && (!data.raceName || !data.raceDate)}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Continue →
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isLoading}
                className="flex-1 bg-blue-600 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60"
              >
                {isLoading ? "Generating plan…" : "Generate My Plan →"}
              </button>
            )}
          </div>

          {step === "connect" && (
            <button
              onClick={() => setStep("preview")}
              className="w-full text-center text-sm text-gray-400 hover:text-gray-600 mt-3"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
