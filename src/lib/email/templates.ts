import { Resend } from "resend";

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");
  return new Resend(process.env.RESEND_API_KEY);
}

const FROM = process.env.EMAIL_FROM ?? "training@marathon-agent.com";

export async function sendWeeklyCheckIn(
  email: string,
  name: string,
  raceId: string,
  weekSummary: string,
  nextWorkouts: string[]
) {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: "Your training week starts now 🏃",
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Good morning, ${name}!</h2>
        <h3>Last week's summary</h3>
        <p>${weekSummary}</p>
        <h3>This week's key workouts</h3>
        <ul>
          ${nextWorkouts.map((w) => `<li>${w}</li>`).join("")}
        </ul>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/races/${raceId}"
           style="background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px;">
          View Full Plan
        </a>
        <p style="color:#6b7280;font-size:12px;margin-top:32px;">
          You're receiving this because you have an active training plan.
          <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications">Manage notifications</a>
        </p>
      </div>
    `,
  });
}

export async function sendRaceWeekBriefReady(
  email: string,
  name: string,
  raceName: string,
  raceDate: string,
  raceId: string
) {
  await getResend().emails.send({
    from: FROM,
    to: email,
    subject: `Your Race Week Brief is ready — ${raceName} 🎯`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Race week is here, ${name}!</h2>
        <p>Your personalized Race Week Brief for <strong>${raceName}</strong> (${new Date(raceDate).toLocaleDateString()}) is ready.</p>
        <p>It includes:</p>
        <ul>
          <li>Race-day weather forecast</li>
          <li>Mile-by-mile pacing strategy</li>
          <li>Fueling and hydration plan</li>
          <li>Pre-race logistics checklist</li>
        </ul>
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/races/${raceId}/brief"
           style="background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:16px;">
          View Race Week Brief
        </a>
        <p style="color:#4b5563;margin-top:24px;">You've put in the work. Now go run your race.</p>
      </div>
    `,
  });
}
