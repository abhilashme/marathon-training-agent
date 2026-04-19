export type DistanceType = "marathon" | "half_marathon" | "10k" | "5k";
export type WorkoutType = "easy" | "tempo" | "interval" | "long_run" | "rest" | "cross_train";
export type TrainingPhase = "base" | "build" | "peak" | "taper";
export type SubscriptionPlan = "race_prep_pack" | "season_pass";

export interface PaceZone {
  min: string;
  max: string;
}

export interface WorkoutData {
  day: string;
  type: WorkoutType;
  targetMiles?: number;
  duration?: number;
  paceZone?: PaceZone;
  effortLevel?: string;
  explanation: string;
}

export interface WeekData {
  weekNumber: number;
  phase: TrainingPhase;
  isDeload: boolean;
  totalMiles: number;
  workouts: WorkoutData[];
}

export interface TrainingPlanData {
  metadata: {
    totalWeeks: number;
    startDate: string;
    raceDate: string;
    goalPace: string;
    distanceType: DistanceType;
  };
  paceZones: {
    vdot?: number;
    easy: PaceZone;
    tempo: PaceZone;
    interval: PaceZone;
    marathon: string;
  };
  weeks: WeekData[];
}

export interface RaceWeekBriefData {
  weather: {
    date: string;
    tempMin: number;
    tempMax: number;
    precipitationProbability: number;
    windSpeed: number;
    description: string;
  };
  courseOverview: string;
  elevationSummary: string;
  pacingStrategy: {
    segments: Array<{
      mile: number;
      targetPace: string;
      notes: string;
    }>;
  };
  fuelingPlan: {
    hydrationIntervals: string;
    gels: Array<{ mile: number; product: string }>;
    notes: string;
  };
  checklist: Array<{
    category: string;
    items: string[];
  }>;
}
