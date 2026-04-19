# 🏃 Marathon Training Agent

An AI-powered marathon training app that generates personalized 16–20 week training plans, adapts them weekly based on your actual runs, and delivers a race week brief 7 days before your race.

Built with **Next.js 16**, **Claude Sonnet** (Anthropic), **Prisma 7**, **Stripe**, and **Strava OAuth**.

---

## Features

- **5-minute onboarding** — enter race, goal time, and fitness level; get a full plan instantly
- **AI-generated plans** — Claude generates periodized training (base → build → peak → taper) calibrated to your VDOT/pace zones
- **Weekly adaptation** — connects to Strava; every Monday the plan adjusts based on what you actually ran
- **Race Week Brief** — auto-generated 7 days before race day: weather forecast, mile-by-mile pacing, fueling plan, logistics checklist
- **Paywall** — free 2-week preview, then Race Prep Pack ($24 one-time) or Season Pass ($10/mo)
- **Email check-ins** — Monday morning summary via Resend

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS |
| Database | PostgreSQL + Prisma 7 (pg adapter) |
| Auth | NextAuth.js v5 (Google, Strava, email) |
| AI | Anthropic Claude Sonnet (`claude-sonnet-4-6`) |
| Payments | Stripe (Checkout Sessions + Subscriptions) |
| Activity sync | Strava OAuth + webhooks |
| Weather | Open-Meteo (free, no key needed) |
| Email | Resend |
| Deployment | Vercel (with cron) |

---

## Prerequisites

- Node.js 20+
- PostgreSQL database ([Supabase](https://supabase.com) recommended — free tier works)
- API keys for: Anthropic, Stripe, Resend
- OAuth apps for: Strava, Google (optional)

---

## Setup Guide

### 1. Clone & install

```bash
git clone https://github.com/abhilashme/marathon-training-agent.git
cd marathon-training-agent
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in each variable:

| Variable | Where to get it |
|----------|----------------|
| `DATABASE_URL` | PostgreSQL connection string (Supabase → Settings → Database → URI) |
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `http://localhost:3000` (dev) or your production URL |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) → API Keys |
| `STRIPE_SECRET_KEY` | [dashboard.stripe.com](https://dashboard.stripe.com) → Developers → API keys |
| `STRIPE_PUBLISHABLE_KEY` | Same page (publishable key) |
| `STRIPE_WEBHOOK_SECRET` | See Stripe webhook setup below |
| `STRIPE_RACE_PREP_PACK_PRICE_ID` | See Stripe products setup below |
| `STRIPE_SEASON_PASS_PRICE_ID` | See Stripe products setup below |
| `STRAVA_CLIENT_ID` | [strava.com/settings/api](https://www.strava.com/settings/api) |
| `STRAVA_CLIENT_SECRET` | Same page |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Any random string you choose |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys |
| `EMAIL_FROM` | A verified sender in Resend (e.g. `training@yourdomain.com`) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (dev) or production URL |
| `CRON_SECRET` | `openssl rand -base64 32` |

### 3. Database setup

```bash
# Create tables
npx prisma migrate dev --name init

# (Optional) Open visual DB editor
npx prisma studio
```

### 4. Stripe setup

#### Create products

In [Stripe Dashboard](https://dashboard.stripe.com/products), create two products:

**Race Prep Pack**
- Type: One-time payment
- Price: $24.00
- Copy the Price ID → `STRIPE_RACE_PREP_PACK_PRICE_ID`

**Season Pass**
- Type: Recurring subscription
- Price: $10.00 / month
- Copy the Price ID → `STRIPE_SEASON_PASS_PRICE_ID`

#### Webhook — local dev

Install [Stripe CLI](https://stripe.com/docs/stripe-cli), then:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copy the webhook signing secret it prints → `STRIPE_WEBHOOK_SECRET`.

#### Webhook — production

In Stripe Dashboard → Developers → Webhooks → Add endpoint:

- **URL**: `https://your-domain.com/api/webhooks/stripe`
- **Events**: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`

Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.

### 5. Strava OAuth setup

1. Go to [strava.com/settings/api](https://www.strava.com/settings/api)
2. Create an app (or use existing one)
3. Set **Authorization Callback Domain**: `localhost` (dev) or your domain (prod)
4. Copy **Client ID** and **Client Secret** to `.env`

#### Register Strava webhook (optional, enables real-time sync)

```bash
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
  -F client_id=YOUR_STRAVA_CLIENT_ID \
  -F client_secret=YOUR_STRAVA_CLIENT_SECRET \
  -F callback_url=https://your-domain.com/api/strava/webhook \
  -F verify_token=YOUR_STRAVA_WEBHOOK_VERIFY_TOKEN
```

Without a webhook, users can trigger manual sync from the dashboard.

### 6. Google OAuth setup (optional)

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials → Create OAuth 2.0 Client ID
2. Add authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://your-domain.com/api/auth/callback/google`
3. Add to `.env`:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```

### 7. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment (Vercel)

### Deploy

```bash
npm i -g vercel
vercel --prod
```

Add all environment variables in Vercel → Settings → Environment Variables.

### Cron job

The weekly adaptation + email cron runs every Monday at 6am UTC, pre-configured in `vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/weekly-checkin", "schedule": "0 6 * * 1" }]
}
```

The endpoint is protected by `Authorization: Bearer CRON_SECRET`.

### Production database (Supabase)

```bash
# Apply migrations to production
DATABASE_URL="your-supabase-url" npx prisma migrate deploy
```

Use the **Supabase pooler URL** (port 6543) for serverless — add `?pgbouncer=true&connection_limit=1`.

---

## How the AI Plans Work

Plans are generated by `claude-sonnet-4-6` using a **cached system prompt** (~4,000 tokens) encoding:

- **Periodization**: base → build → peak → taper with week-by-week volume ratios
- **Pace zones** from goal marathon pace: easy (+75–90 sec/mi), tempo (−25–35), interval (−60–75)
- **Deload weeks** every 4th week (volume −20%, intensity held)
- **Workout structure rules**: ≤2 quality sessions/week, rest after long run

The system prompt uses `cache_control: "ephemeral"` — subsequent plan calls within 5 minutes hit the cache at ~90% token cost reduction.

**Weekly adaptation logic** (runs every Monday):
- Effort > 8/10 → reduce next week volume by 10%, add recovery day
- Completion < 70% → freeze volume increase
- Completion < 50% (two consecutive weeks) → flag potential overtraining

---

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/       # NextAuth route
│   │   ├── races/                    # Create race, list races
│   │   │   └── [raceId]/brief/       # Race week brief
│   │   ├── strava/sync/              # Manual activity sync
│   │   ├── strava/webhook/           # Strava real-time events
│   │   ├── stripe/checkout/          # Create checkout session
│   │   ├── stripe/portal/            # Billing portal redirect
│   │   ├── webhooks/stripe/          # Stripe event handler
│   │   └── cron/weekly-checkin/      # Monday cron
│   ├── auth/signin/                  # Sign-in page
│   ├── dashboard/                    # Main dashboard
│   │   └── races/[raceId]/           # Plan view + brief page
│   ├── onboarding/                   # 4-step wizard
│   └── pricing/                      # Pricing page
├── lib/
│   ├── ai/training-plan.ts           # Claude plan + adaptation
│   ├── ai/race-brief.ts              # Race week brief generation
│   ├── strava/client.ts              # Strava API + token refresh
│   ├── stripe/client.ts              # Stripe checkout + portal
│   ├── email/templates.ts            # Resend email templates
│   ├── auth.ts                       # NextAuth config (Strava custom provider)
│   └── prisma.ts                     # Prisma client (pg adapter)
├── types/index.ts                    # Shared TypeScript types
prisma/schema.prisma                  # Full DB schema
vercel.json                           # Cron config
.env.example                          # All env variables documented
```

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/races` | Session | Create race + trigger async plan generation |
| `GET` | `/api/races` | Session | List user's active races |
| `POST` | `/api/races/:id/brief` | Session + paid | Generate race week brief |
| `GET` | `/api/races/:id/brief` | Session + paid | Fetch generated brief |
| `POST` | `/api/strava/sync` | Session | Trigger manual Strava sync |
| `GET` | `/api/strava/webhook` | Strava token | Webhook verification handshake |
| `POST` | `/api/strava/webhook` | Strava token | Ingest activity events |
| `POST` | `/api/stripe/checkout` | Session | Create Stripe checkout session |
| `POST` | `/api/stripe/portal` | Session | Create billing portal session |
| `POST` | `/api/webhooks/stripe` | Stripe signature | Handle Stripe events |
| `GET` | `/api/cron/weekly-checkin` | `CRON_SECRET` | Weekly adaptation + emails |

---

## License

MIT
