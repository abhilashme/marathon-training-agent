# Marathon Training Agent

Next.js 16 app (App Router, TypeScript). AI-powered marathon training with Claude Sonnet — personalized plans, Strava sync, Stripe payments, race week brief.

## Tech stack
- **Next.js 16** — App Router, server components, API routes
- **Prisma 7** + pg adapter — requires `DATABASE_URL` in `.env`
- **NextAuth v5** — `AUTH_SECRET` + `NEXTAUTH_URL` required; Strava is a custom provider
- **Anthropic SDK** — `ANTHROPIC_API_KEY` required; uses `claude-sonnet-4-6`
- **Stripe 22** — apiVersion `"2026-03-25.dahlia"`; dual model (one-time + subscription)
- **Resend** — email via `RESEND_API_KEY`
- **Open-Meteo** — weather API, free, no key needed

## Dev setup
```bash
cp .env.example .env   # fill in all keys
npx prisma migrate dev
npm run dev
```

## Key files
- `src/lib/ai/training-plan.ts` — Claude plan generation + weekly adaptation (cached system prompt)
- `src/lib/ai/race-brief.ts` — race week brief generation + Open-Meteo weather fetch
- `src/lib/auth.ts` — NextAuth config with Strava custom OAuth provider
- `src/lib/strava/client.ts` — Strava token refresh, activity sync, rate limit handling
- `src/lib/stripe/client.ts` — Stripe checkout sessions + billing portal
- `src/lib/prisma.ts` — Prisma client with pg adapter
- `prisma/schema.prisma` — full DB schema
- `vercel.json` — cron job (Monday 6am UTC weekly check-in)

## App routes
- `/` — landing page
- `/onboarding` — 4-step wizard (race → fitness → Strava connect → preview)
- `/dashboard` — race list + countdown
- `/dashboard/races/[raceId]` — week-by-week plan (paywall after week 2)
- `/dashboard/races/[raceId]/brief` — race week brief (paid only)
- `/pricing` — Race Prep Pack ($24) vs Season Pass ($10/mo)

## API routes
- `POST /api/races` — create race + trigger async plan generation
- `POST /api/races/[raceId]/brief` — generate race week brief
- `POST /api/strava/sync` — manual activity sync
- `POST /api/webhooks/stripe` — Stripe event handler (idempotent)
- `GET /api/strava/webhook` — Strava webhook verification
- `GET /api/cron/weekly-checkin` — weekly plan adaptation + emails (secured by CRON_SECRET)

## Conventions
- JSON fields passed to Prisma must be cast as `Prisma.InputJsonValue`
- All third-party clients (Anthropic, Stripe, Resend) are lazily initialized — never at module level
- Strava activity upserts use `@@unique([userId, externalId, source])` for idempotency
- Stripe webhook events are deduplicated via `WebhookEvent` table
