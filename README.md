# DireConnect

DireConnect is a portfolio full-stack customer and campaign management app. It uses Next.js, an Express API, Supabase Auth and PostgreSQL, Prisma, and BullMQ for campaign jobs.

## Features

- Supabase sign-in and protected API routes
- Business and customer management with owner checks
- Email campaign creation, audience preview, scheduling, unsubscribe handling, and delivery logs
- BullMQ campaign queue and an independently runnable worker
- SMS consent and historical campaign data remain stored, while SMS sending is disabled
- Development email simulation that never contacts an email provider
- Sentry error reporting and automated CI/E2E checks

## Services

| Concern | Service |
| --- | --- |
| Frontend | Vercel, subject to Hobby plan's personal and non-commercial use restriction |
| API | Render Free web service |
| Database, auth, and file storage | Supabase Free |
| Email | Resend Node.js SDK |
| Queue | BullMQ with a Redis-compatible service or local Redis |
| Worker | Run locally for development/demo; no always-on free worker is assumed |
| Monitoring | Sentry |

See [DEPLOYMENT.md](DEPLOYMENT.md) for account setup, environment variables, free-tier limits, and AWS cleanup steps. `render.yaml` describes the free Render API web service. The worker is intentionally not included in that deployment because Render's free web service sleeps when idle and a continuous background worker is not a free service type.

## Local development

Use Node.js 22 and npm. Start local Redis with Docker Compose:

```bash
docker compose up redis -d
```

Copy and fill in the example environment files. Use real Supabase values and a local or TLS-enabled Redis URL as needed. Keep `MESSAGE_MODE=fake` while developing:

```text
apps/web/.env.example       -> apps/web/.env.local
apps/api/.env.example       -> apps/api/.env
apps/worker/.env.example    -> apps/worker/.env
packages/db/.env.example    -> packages/db/.env
```

Install dependencies, generate Prisma Client, and build shared packages:

```bash
npm ci
npm run db:generate
npm run build:packages
```

Run each app in its own terminal:

```bash
npm run dev:web
npm run dev:api
npm run dev:worker
```

`npm run process:campaigns` is retained as a worker CLI alias and listens to the same BullMQ queue. Keep `MESSAGE_MODE=fake` while developing. Set `MESSAGE_MODE=resend` only after reviewing the exact campaign and recipients and intentionally enabling live delivery.

## Checks

```bash
npm test
npm run test:e2e
npm run build
```

CI uses fake Supabase configuration and `MESSAGE_MODE=fake`; it does not send email or SMS.
