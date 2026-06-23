# DireConnect Deployment Plan

This document outlines the planned production deployment setup for DireConnect.

DireConnect is a full-stack application with a Next.js frontend, Express API, BullMQ worker, Redis queue, Supabase Postgres database, Supabase Auth, and Amazon SES email delivery.

## Deployment Overview

Planned production architecture:

```text
Frontend        → AWS Amplify
API             → AWS ECS/Fargate
Worker          → AWS ECS/Fargate
Redis           → Managed Redis
Database/Auth   → Supabase
Email           → Amazon SES
```

The frontend will be deployed separately from the backend services. The API and worker will run as Docker containers. Redis will be used by BullMQ to queue and process campaign sending jobs.

## Services

### Frontend

Location:

```text
apps/web
```

Purpose:

```text
Next.js frontend used by business owners to log in, manage businesses, manage customers, create campaigns, preview audiences, queue/schedule campaigns, and view analytics.
```

Planned hosting:

```text
AWS Amplify
```

### API

Location:

```text
apps/api
```

Purpose:

```text
Express backend API for authentication checks, business management, customer management, campaign management, recipient snapshots, message logs, analytics, unsubscribe handling, and queueing campaign jobs.
```

Planned hosting:

```text
AWS ECS/Fargate
```

Dockerfile:

```text
apps/api/Dockerfile
```

Local Docker image:

```text
direconnect-api
```

Exposed port:

```text
4000
```

### Worker

Location:

```text
apps/worker
```

Purpose:

```text
BullMQ worker that processes queued or scheduled campaign jobs, reads recipient snapshots, sends messages using fake mode or Amazon SES, creates message logs, and updates campaign status.
```

Planned hosting:

```text
AWS ECS/Fargate
```

Dockerfile:

```text
apps/worker/Dockerfile
```

Local Docker image:

```text
direconnect-worker
```

The worker does not expose a public HTTP port because it runs as a background service.

### Redis

Purpose:

```text
Redis is used by BullMQ to store queued and delayed campaign jobs.
```

Local development:

```text
Docker Compose Redis service
```

Production:

```text
Managed Redis service
```

In Docker Compose, the API and worker connect to Redis using:

```env
REDIS_URL=redis://redis:6379
```

In production, this should be replaced with the managed Redis connection URL.

### Database and Auth

Provider:

```text
Supabase
```

Used for:

```text
Postgres database
Supabase Auth
Business data
Customer data
Campaigns
Recipient snapshots
Message logs
Unsubscribe tokens
```

## Frontend Environment Variables

File used locally:

```text
apps/web/.env.local
```

Production environment variables should be configured in AWS Amplify.

Required variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_API_URL=https://your-production-api-domain.com
```

Local development values:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
```

Production value:

```env
NEXT_PUBLIC_API_URL=https://your-production-api-domain.com
```

Notes:

```text
NEXT_PUBLIC_* variables are exposed to the browser.
Do not put private secrets in frontend environment variables.
```

## API Environment Variables

File used locally:

```text
apps/api/.env
```

Production environment variables should be configured in the ECS/Fargate task definition or secret manager.

Required variables:

```env
DATABASE_URL=your-supabase-database-url
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
REDIS_URL=your-managed-redis-url
CLIENT_URL=https://your-production-frontend-domain.com
PORT=4000
```

Local development values:

```env
CLIENT_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
PORT=4000
```

Docker Compose overrides Redis with:

```env
REDIS_URL=redis://redis:6379
```

Production values should look like:

```env
CLIENT_URL=https://your-production-frontend-domain.com
REDIS_URL=your-managed-redis-url
PORT=4000
```

Important:

```text
Do not commit apps/api/.env to GitHub.
Use apps/api/.env.example as documentation only.
```

## Worker Environment Variables

File used locally:

```text
apps/worker/.env
```

Production environment variables should be configured in the ECS/Fargate task definition or secret manager.

Required variables:

```env
DATABASE_URL=your-supabase-database-url
REDIS_URL=your-managed-redis-url
MESSAGE_MODE=aws
APP_URL=https://your-production-api-domain.com
```

For Amazon SES email sending:

```env
AWS_REGION=your-aws-region
SES_FROM_EMAIL=your-verified-ses-sender
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
```

Local development fake mode:

```env
MESSAGE_MODE=fake
APP_URL=http://localhost:4000
REDIS_URL=redis://localhost:6379
```

Docker Compose overrides Redis with:

```env
REDIS_URL=redis://redis:6379
```

Production mode:

```env
MESSAGE_MODE=aws
APP_URL=https://your-production-api-domain.com
```

Important:

```text
Do not commit apps/worker/.env to GitHub.
Use apps/worker/.env.example as documentation only.
```

## Database

Provider:

```text
Supabase Postgres
```

Prisma package location:

```text
packages/db
```

Prisma commands:

```powershell
cd packages\db
npx prisma db push
npx prisma generate
cd ..\..
```

Production notes:

```text
Use the correct Supabase database connection string for production.
Use a direct/session connection for Prisma migrations when needed.
Use a pooled connection for runtime if appropriate.
Do not expose the database URL in frontend code.
```

## Redis

Local Docker Compose value:

```env
REDIS_URL=redis://redis:6379
```

Local non-Docker value:

```env
REDIS_URL=redis://localhost:6379
```

Production value:

```env
REDIS_URL=your-managed-redis-url
```

Notes:

```text
Inside Docker, localhost refers to the current container.
That is why Docker Compose uses redis://redis:6379.
In production, the API and worker should both point to the same managed Redis instance.
```

## Email / Amazon SES

Email provider:

```text
Amazon SES
```

Current local development mode:

```env
MESSAGE_MODE=fake
```

Production mode:

```env
MESSAGE_MODE=aws
```

Required SES setup:

```text
Verify sender email or domain in Amazon SES.
Make sure AWS_REGION matches the region where SES is configured.
If still in SES sandbox mode, recipient emails must also be verified.
For production, request SES production access.
```

Worker variables for SES:

```env
AWS_REGION=your-aws-region
SES_FROM_EMAIL=your-verified-ses-sender
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
```

## Docker Images

API image build:

```powershell
docker build -f apps/api/Dockerfile -t direconnect-api .
```

Worker image build:

```powershell
docker build -f apps/worker/Dockerfile -t direconnect-worker .
```

Docker Compose local backend:

```powershell
docker compose up --build
```

Stop Docker Compose:

```powershell
docker compose down
```

## Deployment Checklist

### Before Deployment

```text
[ ] Confirm npm run build passes locally
[ ] Confirm docker compose up --build works locally
[ ] Confirm API health route works at /health
[ ] Confirm worker processes campaign jobs locally
[ ] Confirm real .env files are not committed
[ ] Confirm .env.example files are updated
[ ] Confirm README has Docker setup instructions
[ ] Confirm DEPLOYMENT.md is updated
```

### Frontend Deployment

```text
[ ] Choose frontend hosting provider
[ ] Add frontend environment variables
[ ] Set NEXT_PUBLIC_SUPABASE_URL
[ ] Set NEXT_PUBLIC_SUPABASE_ANON_KEY
[ ] Set NEXT_PUBLIC_API_URL to production API URL
[ ] Deploy frontend
[ ] Confirm frontend can load
```

### API Deployment

```text
[ ] Build API Docker image
[ ] Push API image to container registry
[ ] Create API service on ECS/Fargate
[ ] Add API environment variables
[ ] Connect API to Supabase
[ ] Connect API to managed Redis
[ ] Configure CORS CLIENT_URL
[ ] Expose API port 4000
[ ] Configure load balancer or public API URL
[ ] Test /health endpoint
```

### Worker Deployment

```text
[ ] Build worker Docker image
[ ] Push worker image to container registry
[ ] Create worker service on ECS/Fargate
[ ] Add worker environment variables
[ ] Connect worker to Supabase
[ ] Connect worker to managed Redis
[ ] Set MESSAGE_MODE=aws for real sending
[ ] Confirm worker logs show successful startup
```

### Redis Deployment

```text
[ ] Choose managed Redis provider
[ ] Create Redis instance
[ ] Add Redis connection URL to API
[ ] Add Redis connection URL to worker
[ ] Confirm API can queue jobs
[ ] Confirm worker can process jobs
```

### SES Deployment

```text
[ ] Verify SES sender email or domain
[ ] Confirm AWS region
[ ] Request SES production access if needed
[ ] Add SES variables to worker service
[ ] Send test campaign
[ ] Confirm email delivery
```

## Post-Deployment Testing

After deployment, test this full flow:

```text
1. Open production frontend
2. Sign up or log in
3. Create or open a business
4. Add a customer
5. Create a campaign
6. Preview campaign audience
7. Queue or schedule campaign
8. Confirm API queues the job
9. Confirm worker processes the job
10. Confirm message logs are created
11. Confirm campaign analytics update
12. Confirm dashboard summary updates
13. Test unsubscribe link
```

## Current Production Risks / Notes

```text
SMS sending is not fully implemented yet.
SES sandbox mode may block emails to unverified recipients.
Managed Redis still needs to be chosen.
Production API domain is not finalized.
Frontend hosting domain is not finalized.
CORS must be updated with the final frontend URL.
APP_URL must be updated with the final API URL.
```
