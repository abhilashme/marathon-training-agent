import Anthropic from "@anthropic-ai/sdk";
import { DistanceType, TrainingPlanData } from "@/types";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// Cached system prompt encodes all training science knowledge
const TRAINING_SCIENCE_SYSTEM_PROMPT = `You are an elite marathon and distance running coach with 20+ years of experience coaching recreational to competitive runners. You generate scientifically-sound, personalized training plans.

## Periodization Principles
- **Base phase** (weeks 1-6 of 16-20wk plan): 70% easy, 15% tempo, 15% long run. Build aerobic base. Max HR at 70-75%. Focus: volume over intensity.
- **Build phase** (weeks 7-12): 60% easy, 20% tempo/threshold, 20% long run. Introduce lactate threshold work. Deload every 4th week (reduce volume 20%, maintain intensity).
- **Peak phase** (weeks 13-15): 50% easy, 25% race-specific intensity, 25% long run. Marathon-pace workouts. Race simulation long runs.
- **Taper phase** (last 2-3 weeks): Reduce volume 40-50%, maintain some intensity. Final long run 3 weeks out. Cutback week before race.

## Pace Zones (by goal marathon pace)
Calculate from goal marathon pace (GMP):
- Easy: GMP + 75-90 sec/mile
- Long run: GMP + 45-75 sec/mile
- Tempo/threshold: GMP - 25-35 sec/mile
- Marathon pace: GMP ± 10 sec/mile
- Interval (5K pace): GMP - 60-75 sec/mile

## Weekly Structure Rules
- Max 1 quality session per week in base phase; 2 in build/peak
- Long run on weekend (Saturday or Sunday)
- Never schedule quality sessions on consecutive days
- Rest day required after long run or quality session
- Minimum 2 easy/recovery days per week

## Workout Explanations
Every workout must include a 1-2 sentence explanation of its purpose. Be specific (e.g., "This tempo run builds your lactate threshold — the pace you can sustain for your marathon. Running at this effort trains your body to clear lactic acid more efficiently.").

## Deload Weeks
Week 4, 8, 12 (and in peak): reduce total volume by 20%, keep intensity. Label isDeload: true.

## Output Format
Always respond with valid JSON matching the TrainingPlanData schema. No additional text outside the JSON.`;

export interface GeneratePlanInput {
  distanceType: DistanceType;
  raceDate: string;
  goalFinishTime: string;
  trainingDaysPerWeek: number;
  currentWeeklyMiles?: number;
  longestRecentRun?: number;
  recentRaceTimes?: string;
  fitnessLevel?: "beginner" | "intermediate" | "advanced";
}

export async function generateTrainingPlan(
  input: GeneratePlanInput
): Promise<TrainingPlanData> {
  const weeksUntilRace = Math.floor(
    (new Date(input.raceDate).getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000)
  );
  const planWeeks = Math.min(Math.max(weeksUntilRace, 8), 20);
  const startDate = new Date();

  const userPrompt = `Generate a ${planWeeks}-week ${input.distanceType.replace("_", " ")} training plan.

Athlete Profile:
- Race date: ${input.raceDate}
- Goal finish time: ${input.goalFinishTime}
- Available training days/week: ${input.trainingDaysPerWeek}
- Current weekly mileage: ${input.currentWeeklyMiles ?? "unknown"} miles
- Longest recent run: ${input.longestRecentRun ?? "unknown"} miles
- Recent race times: ${input.recentRaceTimes ?? "none provided"}
- Fitness level: ${input.fitnessLevel ?? "intermediate"}
- Plan start date: ${startDate.toISOString().split("T")[0]}

Return a JSON object matching this exact TypeScript interface:
{
  metadata: {
    totalWeeks: number,
    startDate: string (ISO date),
    raceDate: string (ISO date),
    goalPace: string (min/mile, e.g. "8:30"),
    distanceType: string
  },
  paceZones: {
    easy: { min: string, max: string },
    tempo: { min: string, max: string },
    interval: { min: string, max: string },
    marathon: string
  },
  weeks: [{
    weekNumber: number,
    phase: "base" | "build" | "peak" | "taper",
    isDeload: boolean,
    totalMiles: number,
    workouts: [{
      day: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday",
      type: "easy" | "tempo" | "interval" | "long_run" | "rest" | "cross_train",
      targetMiles?: number,
      duration?: number (minutes),
      paceZone?: { min: string, max: string },
      effortLevel?: string (e.g. "3-4/10"),
      explanation: string (1-2 sentences why this workout)
    }]
  }]
}`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8000,
    system: [
      {
        type: "text",
        text: TRAINING_SCIENCE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type from Claude");

  // Strip markdown code blocks if present
  const jsonText = content.text
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  return JSON.parse(jsonText) as TrainingPlanData;
}

export interface AdaptPlanInput {
  currentWeek: number;
  plannedWorkouts: Array<{
    day: string;
    type: string;
    targetMiles?: number;
    targetPace?: string;
  }>;
  actualActivities: Array<{
    date: string;
    distance: number;
    avgPace: string;
    perceivedEffort: number;
  }>;
  remainingWeeks: number;
  distanceType: DistanceType;
  goalPace: string;
}

export async function adaptWeeklyPlan(
  input: AdaptPlanInput
): Promise<{ summary: string; adjustments: string[]; nextWeek: WeekAdjustment }> {
  const completionRate =
    input.actualActivities.length / Math.max(input.plannedWorkouts.filter((w) => w.type !== "rest").length, 1);
  const avgEffort =
    input.actualActivities.reduce((sum, a) => sum + a.perceivedEffort, 0) /
    Math.max(input.actualActivities.length, 1);

  const userPrompt = `Analyze week ${input.currentWeek} performance and generate next week adjustments.

Planned vs Actual:
- Planned workouts: ${JSON.stringify(input.plannedWorkouts)}
- Actual activities: ${JSON.stringify(input.actualActivities)}
- Completion rate: ${Math.round(completionRate * 100)}%
- Average perceived effort: ${avgEffort.toFixed(1)}/10
- Weeks remaining: ${input.remainingWeeks}
- Goal: ${input.distanceType.replace("_", " ")} at ${input.goalPace}/mile

Adaptation rules:
- Effort > 8/10: reduce next week volume by 10%, add recovery day
- Effort < 5/10 AND completion > 95%: increase intensity (not volume) by 5%
- Completion < 70%: do not increase next week; add easy day
- Completion < 50% (2 consecutive): flag potential overtraining, suggest medical check
- Never increase weekly volume > 10% from previous week

Return JSON:
{
  "summary": "2-3 sentence plain-language summary for the runner",
  "adjustments": ["list of specific changes made"],
  "nextWeek": {
    "volumeMultiplier": number (e.g. 1.0, 0.9, 1.05),
    "addRecoveryDay": boolean,
    "intensityNotes": string,
    "flagOvertraining": boolean
  }
}`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: [
      {
        type: "text",
        text: TRAINING_SCIENCE_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonText = content.text
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  return JSON.parse(jsonText);
}

interface WeekAdjustment {
  volumeMultiplier: number;
  addRecoveryDay: boolean;
  intensityNotes: string;
  flagOvertraining: boolean;
}
