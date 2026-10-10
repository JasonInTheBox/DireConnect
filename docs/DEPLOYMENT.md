# Free-tier deployment guide

This repo is configured for a Vercel frontend, a Render Free Express API, Supabase, Resend email, and a configurable BullMQ Redis connection. The worker remains independently runnable and is not deployed as an always-on free service.

## What is implemented

- Next.js frontend, Express API, Prisma, Supabase Auth/PostgreSQL, BullMQ, ioredis, Sentry, Vitest, Playwright, and GitHub Actions are present.
- API and worker use Redis through `REDIS_URL`; ioredis accepts `redis://` locally and `rediss://` for TLS endpoints.
- The BullMQ worker sends one message per eligible campaign recipient through the Resend Node.js SDK. Development and CI default to a local simulation.
- SMS fields and historical campaigns remain in the database. New SMS campaigns, SMS campaign edits, and queueing SMS drafts are blocked in both the UI and API; the worker also fails any legacy SMS job without calling a provider.
- Supabase Storage upload code and a SendGrid or Twilio integration were not found in the repository. No storage migration or subscriber import is required for this code change.
- Prisma schema and migrations were not changed. No cloud database was reset or modified.

## Target architecture

```text
Browser -> Vercel Next.js -> Render Express API -> Supabase Postgres/Auth
                                         |       -> Redis/BullMQ queue
                                         |
                                         +-- local/demo worker -> Resend (only when enabled)
```

The API can run on Render Free and has `/health` for health checks. Render Free web services sleep after 15 minutes without inbound traffic and can take about a minute to wake. Render background workers are a different, continuously running service type and are not a free compute option. Run the worker locally for development or a controlled demo; queued or scheduled campaigns will wait while it is offline. Do not use keep-alive requests to simulate an always-on worker. [Render free service limits](https://render.com/docs/free) · [Render background workers](https://render.com/docs/background-workers)

Vercel Hobby currently costs $0, but its terms restrict use to personal, non-commercial projects. Use it for a non-commercial portfolio demonstration only. A live commercial SaaS needs a plan that permits commercial use; no paid plan is configured by this repo. [Vercel Hobby plan](https://vercel.com/docs/plans/hobby) · [Vercel terms](https://vercel.com/legal/terms)

## Deploy the API to Render

1. Connect the GitHub repository to Render and create a Blueprint from `render.yaml`.
2. Keep the API service on the `Free` plan. The blueprint builds the monorepo, generates Prisma Client, builds the shared packages and API, and uses `/health` as its health check.
3. Set the prompted values in Render:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | Supabase pooled connection URL for runtime requests |
   | `DIRECT_URL` | Supabase direct or session-mode connection URL for Prisma CLI operations |
   | `SUPABASE_URL` | Supabase project URL |
   | `SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key used by the API's Supabase client |
   | `REDIS_URL` | The same BullMQ-compatible Redis URL used by the worker |
   | `CLIENT_URL` | Comma-separated exact Vercel origins, without trailing slashes or paths |
   | `SENTRY_DSN` | Optional API Sentry DSN; leave unset to disable reporting |

   Render provides `PORT`; the blueprint sets the app port to `4000` for clarity. Do not put database, JWT, Redis, Resend, or Sentry secrets in `NEXT_PUBLIC_` variables.

4. After the first deploy, copy the Render `onrender.com` URL. Set that as `NEXT_PUBLIC_API_URL` in Vercel and set Render's `CLIENT_URL` to every active Vercel origin, comma-separated (for example, `https://direconnect.app,https://www.direconnect.app`).
5. Confirm `https://<render-api-host>/health` returns `{"status":"ok","service":"direconnect-api",...}`.

The free web service has a cold start and usage limits. Avoid paid add-ons, persistent disks, and paid plan upgrades if the goal is $0/month. Render can bill for some overages if a payment method is attached; otherwise it can suspend free services when limits are exceeded. Check workspace usage in the Render dashboard. [Render free limits and billing behavior](https://render.com/docs/free)

## Deploy the frontend to Vercel

1. Import the repository into Vercel and set the project Root Directory to `apps/web`.
2. Use the Next.js framework preset. If Vercel does not detect the workspace install automatically, set the install command to `npm ci` from the repository root and enable access to files outside the app root.
3. Configure these variables for the deployment environment:

   ```env
   NEXT_PUBLIC_API_URL=https://<render-api-host>
   NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>
   NEXT_PUBLIC_SENTRY_DSN=<optional frontend DSN>
   ```

   The Supabase publishable key is intended for browser use. Never add a service-role key, JWT signing secret, database password, Redis URL, or Resend API key to the frontend project.

4. In Supabase Auth settings, update the Site URL and allowed redirect URLs to include the Vercel deployment origin. Keep any localhost callback needed for local development.
5. Redeploy the frontend after changing environment variables.

Vercel Hobby is only suitable when the project remains personal and non-commercial. The official terms reserve the right to change or disable Hobby services. [Vercel Hobby plan](https://vercel.com/docs/plans/hobby)

## Redis and the worker

- Keep `REDIS_URL` configurable. Use `redis://localhost:6379` for the included local Docker Compose Redis, or `rediss://...` when a hosted provider offers TLS. ioredis negotiates TLS from the `rediss://` URL.
- Use one Redis database for the API and worker. Confirm the service supports standard Redis TCP commands and BullMQ's blocking/persistent connections; an HTTP-only Redis API is not sufficient.
- No provider was named in the current repo configuration, so this change does not switch Redis accounts or assume the existing managed service is free. Check its billing plan or choose a free service that meets the connection requirements. Redis Cloud's current Free Essentials plan does not offer TLS, so consider that before putting its endpoint and password on a public network. [Redis TLS support](https://redis.io/docs/latest/operate/rc/security/database-security/tls-ssl/)
- The worker runs locally with `npm run dev:worker` (or `npm run process:campaigns`) and the same `DATABASE_URL`, `REDIS_URL`, and `APP_URL` used for the demo. Point `APP_URL` at the public Render API origin so generated unsubscribe links work.
- Keep `MESSAGE_MODE=fake` for development, seed data, and CI. Fake mode makes no external request and does not log recipient addresses or message bodies. Only set `MESSAGE_MODE=resend` after reviewing the exact campaign and recipients and intentionally enabling live delivery.
- BullMQ retries temporary provider failures up to three times with exponential backoff, respecting Resend's `Retry-After` value when it is longer. Campaign and recipient identifiers produce a stable SHA-256 idempotency key for provider retries; sent recipients are skipped on retry, and exhausted jobs remain in BullMQ's failed set while the campaign is marked failed.

## Resend email setup

Create a Resend API key and verify `direconnect.app` in Resend. The configured sender is `promotions@direconnect.app`. No customer contacts are imported or synchronized by this integration.

Configure the **worker** environment (the API service does not send campaign messages):

```env
MESSAGE_MODE=resend
RESEND_API_KEY=<server-side API key>
RESEND_FROM_EMAIL=promotions@direconnect.app
```

DireConnect calls Resend's `emails.send` SDK method once per queued recipient. This preserves the app's live consent checks, per-customer unsubscribe URLs, recipient-level delivery logs, and retry handling. Resend accepts idempotency keys for 24 hours; retries during that window use the same hashed key. The integration classifies rate limits, provider server errors, concurrent idempotency conflicts, and network failures as retryable; permanent provider errors are recorded as delivery failures. [Resend Node.js SDK](https://github.com/resend/resend-node) · [Resend send-email API](https://resend.com/docs/api-reference/emails/send-email) · [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys)

Resend's Broadcasts API is designed for an Audience or Segment and manages its own contact unsubscribe state. This worker intentionally sends individually so DireConnect can continue using its existing database audience snapshots and unsubscribe tokens without synchronizing customer lists. If you later move campaigns to Broadcasts, add business-scoped audience/contact synchronization and a plan for reconciling Resend unsubscribes back into DireConnect first. [Resend Broadcasts](https://resend.com/docs/api-reference/broadcasts/create-broadcast) · [Resend Audiences](https://resend.com/docs/dashboard/audiences/introduction)

## Supabase and Prisma

- Keep the existing Supabase project, Auth, Postgres data, and schema.
- Use `DATABASE_URL` with a pooler for application runtime when available. `packages/db/prisma.config.ts` uses `DIRECT_URL` for Prisma CLI commands when set, falling back to `DATABASE_URL`.
- No database migration is needed for this service change. Do not run `prisma db push` or reset the production database as part of deployment.
- Supabase Free currently includes 500 MB database storage, 1 GB file storage, and 5 GB egress; free projects can pause after one week of inactivity and do not include automatic backups. Monitor actual project usage and keep independent backups for important data. [Supabase pricing](https://supabase.com/pricing)

## Environment files

Copy the example files to the corresponding ignored local files and keep secrets out of Git:

| App | Local file | Main variables |
| --- | --- | --- |
| Web | `apps/web/.env.local` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, optional `NEXT_PUBLIC_SENTRY_DSN` |
| API | `apps/api/.env` | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `REDIS_URL`, `CLIENT_URL`, `PORT`, optional `SENTRY_DSN` |
| Worker | `apps/worker/.env` | `DATABASE_URL`, `REDIS_URL`, `APP_URL`, `MESSAGE_MODE=fake`, optional Resend/Sentry values |
| Prisma CLI | `packages/db/.env` | `DIRECT_URL` and `DATABASE_URL` |

The root `.env.example` is a consolidated reference. Each workspace loads its own `.env` when run through its npm workspace script.

## Verification before switching traffic

```bash
npm ci
npm run db:generate
npm test
npm run build
npm run test:e2e
```

CI uses dummy configuration and `MESSAGE_MODE=fake`; it never contacts Resend or sends SMS. For a deployment smoke test, verify login, business/customer ownership checks, campaign creation, audience preview, API health, and unsubscribe handling. Run a queued test campaign with fake mode first. For a real test, temporarily set `MESSAGE_MODE=resend` on a worker configured with your Resend API key, and queue exactly one opted-in recipient address that you control. Review the worker's Redis queue first so there are no other waiting campaigns, then return the worker to `MESSAGE_MODE=fake` after confirming the test.

## AWS cutover and manual cleanup

The repo previously described Amplify, ECR, ECS/Fargate, an Application Load Balancer, CloudFront, CloudWatch, and a SES email path. The SES code and AWS deployment files have been removed or replaced, but **no AWS account resources were changed**. Deploy and verify Vercel/Render first. Then manually decide when to stop the old ECS services and audit AWS billing. Stopping ECS tasks alone may leave charges for the load balancer, NAT gateway, public IPv4 addresses, CloudFront, ECR storage, CloudWatch logs, or Redis. Retain any data or artifacts you still need before deleting resources. Also review GitHub's AWS OIDC role and repository variables after the old workflows are no longer used.

The new source changes do not affect already running ECS tasks; the AWS deployment continues to serve its previous image until you switch traffic or stop it. After the new services pass the smoke checks, stop the old API/worker and inspect any remaining billable AWS resources. AWS resource shutdown/deletion is outside this repository change; no database, cloud deployment, subscriber list, or paid plan was modified automatically.

### Credential rotation

The former tracked CI workflow contained a Supabase database connection password and legacy JWT signing secret. The current workflow uses dummy build-only values, but Git history still contains the previous entries. Reset the database password in Supabase and update `DATABASE_URL` and `DIRECT_URL` in every active consumer (including the old AWS service during the overlap, Render, and local environments) before restarting them. The API did not use the JWT secret to verify users; it was only an unnecessary required env value, now removed. Treat the historical secret as exposed: check the project's current JWT Signing Keys state and follow Supabase's dashboard rotation/revocation flow. Legacy-key rotation can affect existing sessions, so coordinate it with the cutover and confirm which keys remain active. Do not paste secrets into GitHub Actions YAML. [Supabase database password reset](https://supabase.com/docs/guides/troubleshooting/how-do-i-reset-my-supabase-database-password) · [Supabase JWT signing keys and rotation](https://supabase.com/docs/guides/auth/signing-keys)

## Cost estimate and limits

| Service | Expected monthly cost | Limit to review |
| --- | ---: | --- |
| Vercel Hobby | $0 | Personal/non-commercial use only; usage caps can pause features |
| Render Free API | $0 within included usage | Sleeps after idle; overages may bill with a payment method |
| Supabase Free | $0 | Project/storage/egress limits; inactivity pause; no automatic backups |
| Resend | Depends on current plan | Check account limits before enabling live delivery |
| Redis | $0 only if the selected provider and plan are free | Current provider and TLS/BullMQ compatibility must be verified |
| Sentry and GitHub Actions | $0 within each account's free allowances | Event, build, and artifact limits vary by account |
| Background worker | $0 when run on your own development machine | Not continuously available while the machine is off |

The target recurring infrastructure bill is **$0/month** if every selected account remains inside its free plan and Vercel's non-commercial terms apply. Domain registration, any existing AWS resources, usage above provider allowances, or a continuously hosted worker can add cost. This repo does not upgrade plans or automatically create paid resources.
