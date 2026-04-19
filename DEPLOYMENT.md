# Deployment Guide

This document covers every way to deploy Marathon Training Agent so it's accessible from your laptop, phone, or anywhere with an internet connection.

---

## Comparison

| | Vercel | Railway | Self-hosted VPS | Docker (VPS) |
|--|--------|---------|----------------|--------------|
| Setup time | ~15 min | ~20 min | ~60 min | ~45 min |
| Monthly cost | Free–$20 | Free–$5 | $4–$8 | $4–$8 |
| Maintenance | None | None | You manage | Minimal |
| Custom domain | ✓ | ✓ | ✓ (+ SSL) | ✓ (+ SSL) |
| Cron jobs | Built-in | Built-in | Manual crontab | Docker cron |
| Database included | No (use Supabase) | Yes (Postgres add-on) | Self-managed | Self-managed |
| Best for | Fastest start | All-in-one | Full control | Portability |

---

## Option 1 — Vercel (recommended, ~15 minutes)

Vercel is built by the Next.js team and handles builds, scaling, and cron jobs automatically.

### Prerequisites
- GitHub account with the repo pushed
- [Supabase](https://supabase.com) account for the database (free tier works)

### Steps

**1. Create a Supabase database**

1. Go to [supabase.com](https://supabase.com) → New project
2. Choose a region close to you
3. Settings → Database → Connection string → **URI** → copy it
4. It looks like: `postgresql://postgres:[password]@db.[ref].supabase.co:5432/postgres`

**2. Run database migrations from your laptop**

```bash
DATABASE_URL="your-supabase-url" npx prisma migrate deploy
```

**3. Import to Vercel**

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import Git Repository** → select `marathon-training-agent`
3. Vercel auto-detects Next.js — leave all build settings as-is
4. Expand **Environment Variables** and add every key from your `.env.example`
5. Click **Deploy**

**4. Set your production URL**

After the first deploy, Vercel gives you a URL (e.g. `marathon-training-agent.vercel.app`).

Go back to Environment Variables and update:
```
NEXTAUTH_URL=https://marathon-training-agent.vercel.app
NEXT_PUBLIC_APP_URL=https://marathon-training-agent.vercel.app
```

Redeploy for the change to take effect (Deployments → ⋯ → Redeploy).

**5. Cron job**

Already configured in `vercel.json` — Vercel runs it automatically every Monday at 6am UTC. No extra setup needed.

**6. Custom domain (optional)**

Vercel Dashboard → Project → Settings → Domains → Add → follow the DNS instructions from your registrar.

### Cost
- **Hobby plan**: Free — includes 100GB bandwidth, serverless functions, cron jobs
- **Pro plan**: $20/mo — needed if you exceed hobby limits or want team features

---

## Option 2 — Railway (~20 minutes)

Railway provisions both your app and a Postgres database in one place.

### Steps

**1. Create a Railway project**

1. Go to [railway.app](https://railway.app) → New Project
2. Select **Deploy from GitHub repo** → connect `marathon-training-agent`

**2. Add a Postgres database**

In your Railway project → **+ New** → **Database** → **PostgreSQL**

Click the database → **Connect** tab → copy the `DATABASE_URL`.

**3. Add environment variables**

Project → your service → **Variables** tab → add all keys from `.env.example`.

Set `DATABASE_URL` to the value from the Railway Postgres connection.

**4. Run migrations**

In Railway → your service → **Settings** → **Deploy** → set **Start Command**:

```bash
npx prisma migrate deploy && npm start
```

This runs migrations automatically on every deploy.

**5. Set your domain**

Railway gives you a generated domain (e.g. `marathon-agent.up.railway.app`).

Settings → Networking → **Generate Domain** or add a custom domain.

Update `NEXTAUTH_URL` and `NEXT_PUBLIC_APP_URL` to match.

**6. Cron job**

Railway doesn't run Vercel-style crons. Add a cron service instead:

1. In your project → **+ New** → **Empty Service**
2. Set start command: `curl -H "Authorization: Bearer $CRON_SECRET" $NEXT_PUBLIC_APP_URL/api/cron/weekly-checkin`
3. Settings → **Cron Schedule**: `0 6 * * 1` (every Monday 6am UTC)

### Cost
- **Hobby plan**: $5/mo — includes $5 of compute credit (usually enough for this app)
- Postgres: ~$1–2/mo extra on top of compute

---

## Option 3 — Self-hosted VPS (~60 minutes)

Full control on your own Linux server. Good choice if you want no vendor lock-in.

### Recommended providers
| Provider | Cheapest plan | Location options |
|----------|-------------|-----------------|
| [Hetzner](https://hetzner.com) | €3.79/mo (CX22) | EU, US |
| [DigitalOcean](https://digitalocean.com) | $6/mo (Basic Droplet) | Worldwide |
| [Vultr](https://vultr.com) | $6/mo | Worldwide |
| [Linode (Akamai)](https://linode.com) | $5/mo | Worldwide |

Choose a server with at least **1 vCPU, 2GB RAM** and **Ubuntu 24.04 LTS**.

### Steps

**1. Create and access your server**

After creating your server, SSH in:

```bash
ssh root@YOUR_SERVER_IP
```

**2. Install Node.js, PostgreSQL, PM2, and nginx**

```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt-get install -y nodejs

# PostgreSQL
apt-get install -y postgresql postgresql-contrib

# PM2 (process manager — keeps app running after reboots)
npm install -g pm2

# nginx (reverse proxy — routes web traffic to your app)
apt-get install -y nginx

# Git
apt-get install -y git
```

**3. Create a database**

```bash
sudo -u postgres psql
```

```sql
CREATE USER marathon WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE marathon_db OWNER marathon;
\q
```

**4. Clone and build the app**

```bash
git clone https://github.com/abhilashme/marathon-training-agent.git
cd marathon-training-agent
npm install
```

Create your environment file:

```bash
nano .env
```

Paste all variables from `.env.example`. For the database:

```
DATABASE_URL="postgresql://marathon:choose-a-strong-password@localhost:5432/marathon_db"
NEXTAUTH_URL="http://YOUR_SERVER_IP"
NEXT_PUBLIC_APP_URL="http://YOUR_SERVER_IP"
```

Run migrations and build:

```bash
npx prisma migrate deploy
npm run build
```

**5. Start with PM2**

```bash
pm2 start npm --name "marathon-agent" -- start
pm2 save          # persist across reboots
pm2 startup       # register PM2 as a system service
# copy and run the command PM2 prints
```

Check it's running:

```bash
pm2 status
pm2 logs marathon-agent
```

**6. Configure nginx**

```bash
nano /etc/nginx/sites-available/marathon
```

Paste:

```nginx
server {
    listen 80;
    server_name YOUR_SERVER_IP;   # replace with your domain once you have one

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable and reload:

```bash
ln -s /etc/nginx/sites-available/marathon /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

Visit `http://YOUR_SERVER_IP` from your laptop or phone — the app is live.

**7. Set up the weekly cron job**

The Vercel cron from `vercel.json` doesn't run on a VPS. Add a Linux cron instead:

```bash
crontab -e
```

Add this line:

```
0 6 * * 1 curl -s -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/weekly-checkin
```

**8. Add HTTPS with a free SSL certificate (requires a domain)**

Point your domain's DNS A record to your server IP, then:

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

Certbot auto-renews the certificate every 90 days.

Update nginx `server_name` and your `.env` `NEXTAUTH_URL`/`NEXT_PUBLIC_APP_URL` to use `https://yourdomain.com`, then rebuild:

```bash
npm run build && pm2 restart marathon-agent
```

### Updating the app

When you push new code to GitHub:

```bash
cd marathon-training-agent
git pull
npm install
npx prisma migrate deploy
npm run build
pm2 restart marathon-agent
```

---

## Option 4 — Docker on a VPS (~45 minutes)

Docker packages the app into a container, making it easy to move between servers and update cleanly.

### Dockerfile

Create `Dockerfile` in the project root:

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

Add to `next.config.ts`:

```ts
const nextConfig = {
  output: "standalone",
};
```

### docker-compose.yml

```yaml
services:
  app:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: marathon
      POSTGRES_PASSWORD: your-password
      POSTGRES_DB: marathon_db
    volumes:
      - pgdata:/var/lib/postgresql/data
    restart: unless-stopped

volumes:
  pgdata:
```

Set `DATABASE_URL` in `.env`:

```
DATABASE_URL="postgresql://marathon:your-password@db:5432/marathon_db"
```

### Deploy

On your server:

```bash
git clone https://github.com/abhilashme/marathon-training-agent.git
cd marathon-training-agent
cp .env.example .env
# fill in .env
docker compose up -d
docker compose exec app npx prisma migrate deploy
```

### Update

```bash
git pull
docker compose build
docker compose up -d
```

---

## Post-deployment checklist

After deploying with any method, verify these:

- [ ] App loads at your URL from a phone on mobile data (not just your home Wi-Fi)
- [ ] Sign in works (Google or Strava OAuth callback URL matches your deployed URL)
- [ ] Create a race — plan generates within 30 seconds
- [ ] Strava OAuth connect flow completes successfully
- [ ] Stripe checkout opens (use test card `4242 4242 4242 4242` in test mode)
- [ ] Stripe webhook receives events (check Stripe Dashboard → Developers → Webhooks → recent deliveries)
- [ ] Weekly cron endpoint returns 200 when called manually:
  ```bash
  curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://your-domain.com/api/cron/weekly-checkin
  ```

---

## Environment variables reference

All variables are documented in [`.env.example`](./.env.example).

The three most commonly misconfigured:

| Variable | Common mistake |
|----------|---------------|
| `NEXTAUTH_URL` | Must match the exact URL users visit — including `https://` in production |
| `STRIPE_WEBHOOK_SECRET` | Different for local CLI vs production dashboard — don't mix them up |
| `DATABASE_URL` | Supabase pooler URLs need `?pgbouncer=true&connection_limit=1` appended |
