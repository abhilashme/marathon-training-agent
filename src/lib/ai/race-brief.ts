import Anthropic from "@anthropic-ai/sdk";
import { DistanceType, RaceWeekBriefData } from "@/types";

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

interface WeatherForecast {
  date: string;
  tempMin: number;
  tempMax: number;
  precipitationProbability: number;
  windSpeed: number;
  weatherCode: number;
}

async function fetchWeatherForecast(
  latitude: number,
  longitude: number,
  raceDate: string
): Promise<WeatherForecast | null> {
  try {
    const startDate = new Date(raceDate);
    const endDate = new Date(raceDate);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max,weather_code&start_date=${startDate.toISOString().split("T")[0]}&end_date=${endDate.toISOString().split("T")[0]}&temperature_unit=fahrenheit&wind_speed_unit=mph`;

    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();

    if (!data.daily?.temperature_2m_max?.length) return null;

    return {
      date: raceDate,
      tempMin: data.daily.temperature_2m_min[0],
      tempMax: data.daily.temperature_2m_max[0],
      precipitationProbability: data.daily.precipitation_probability_max[0],
      windSpeed: data.daily.wind_speed_10m_max[0],
      weatherCode: data.daily.weather_code[0],
    };
  } catch {
    return null;
  }
}

export interface GenerateBriefInput {
  raceName: string;
  raceDate: string;
  distanceType: DistanceType;
  goalFinishTime: string;
  goalPace: string;
  latitude?: number;
  longitude?: number;
  trainingPeakWeekMiles?: number;
}

export async function generateRaceWeekBrief(
  input: GenerateBriefInput
): Promise<RaceWeekBriefData> {
  const weather = input.latitude && input.longitude
    ? await fetchWeatherForecast(input.latitude, input.longitude, input.raceDate)
    : null;

  const distanceMiles = {
    marathon: 26.2,
    half_marathon: 13.1,
    "10k": 6.2,
    "5k": 3.1,
  }[input.distanceType];

  const userPrompt = `Generate a complete race week brief for this runner.

Race Details:
- Race: ${input.raceName}
- Date: ${input.raceDate}
- Distance: ${input.distanceType.replace("_", " ")} (${distanceMiles} miles)
- Goal finish time: ${input.goalFinishTime}
- Goal pace: ${input.goalPace}/mile
- Peak training week mileage: ${input.trainingPeakWeekMiles ?? "unknown"} miles

Weather Forecast:
${weather ? JSON.stringify(weather) : "Not available — use general guidance"}

Generate a comprehensive race week brief as JSON matching this interface:
{
  "weather": {
    "date": string,
    "tempMin": number,
    "tempMax": number,
    "precipitationProbability": number,
    "windSpeed": number,
    "description": string (race-day implications, e.g. "Cool and overcast — ideal marathon conditions. Wear a light layer at start that you can discard.")
  },
  "courseOverview": string (2-3 sentences about typical course characteristics for this distance),
  "elevationSummary": string (2 sentences on elevation strategy),
  "pacingStrategy": {
    "segments": [{ "mile": number, "targetPace": string, "notes": string }]
  },
  "fuelingPlan": {
    "hydrationIntervals": string,
    "gels": [{ "mile": number, "product": string }],
    "notes": string
  },
  "checklist": [
    {
      "category": string,
      "items": string[]
    }
  ]
}

Include these checklist categories: "Race Morning", "Gear & Kit", "Nutrition & Hydration", "Mental Preparation"
For pacing: include mile segments every 5 miles + final push.`;

  const response = await getClient().messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 3000,
    messages: [{ role: "user", content: userPrompt }],
  });

  const content = response.content[0];
  if (content.type !== "text") throw new Error("Unexpected response type");

  const jsonText = content.text
    .replace(/^```(?:json)?\n?/m, "")
    .replace(/\n?```$/m, "")
    .trim();

  const briefData = JSON.parse(jsonText) as RaceWeekBriefData;

  // Merge actual weather if we got it
  if (weather && briefData.weather) {
    briefData.weather.tempMin = weather.tempMin;
    briefData.weather.tempMax = weather.tempMax;
    briefData.weather.precipitationProbability = weather.precipitationProbability;
    briefData.weather.windSpeed = weather.windSpeed;
  }

  return briefData;
}
