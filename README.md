# DireConnect
This is the repository for Junjie Liu's DireConnect personal project.

## What is DireConnect
DireConnect is a tool for small businesses that attracts new customers and turns them into clients. DireConnect introduces a business-controlled loyalty-program platform that enables businesses to customize deals, rewards, and promotion. They can easily manage client data and send out advertisements through SMS and email. On the consumer side, they can invite friends to earn bonus points, creating a long chain of clients

## Why DireConnect?
Often, small businesses fall behind in the competitive advertisement environment and suffer slow growth. They do not have a way to compete with larger businesses who would spend way more on online ads nor a systematic way to connect with their clients and attract new customers.

## Tech Stack
- **Frontend**: Next.js + React + TypeScript
- **Backend**: Express
- **DB**: Supabase Postgres
- **Auth**: Supabase Auth
- **ORM**: Prisma
- **Validation**: Zod
- **SMS/Email**: Amazon SNS + Amazon SES
- **Background jobs**: BullMQ + Redis
- **Storage**: Supabase Storage
- **Hosting**: AWS Amplify for frontend, AWS ECS/Fargate for API/worker
- **Monitoring**: Sentry
- **Testing**: Vitest/Jest + Playwright
- **CI/CD**: GitHub Actions


## Running the Backend with Docker

DireConnect can run its backend services with Docker Compose. This starts the Redis job queue, Express API, and BullMQ worker together.

The frontend is still run locally with Next.js during development.

### Services Started by Docker Compose

```text
redis    → Redis job queue used by BullMQ
api      → Express API running on http://localhost:4000
worker   → BullMQ worker that processes campaign jobs
```

### Required Environment Files

Before starting Docker Compose, create the following real environment files:

```text
apps/api/.env
apps/worker/.env
```

These files are not committed to Git because they contain secrets.

Use the `.env.example` files as references:

```text
apps/api/.env.example
apps/worker/.env.example
```

When using Docker `env_file`, write environment values without quotes.

Use this style:

```env
SUPABASE_URL=https://your-project.supabase.co
CLIENT_URL=http://localhost:3000
PORT=4000
```

Avoid this style:

```env
SUPABASE_URL="https://your-project.supabase.co"
CLIENT_URL="http://localhost:3000"
PORT="4000"
```

### API Environment Variables

The API needs:

```env
DATABASE_URL=your-supabase-database-url
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_JWT_SECRET=your-supabase-jwt-secret
REDIS_URL=redis://localhost:6379
CLIENT_URL=http://localhost:3000
PORT=4000
```

When running through Docker Compose, `REDIS_URL` is overridden to:

```env
REDIS_URL=redis://redis:6379
```

This is because Docker containers communicate with each other by service name. In `docker-compose.yml`, the Redis service is named `redis`.

### Worker Environment Variables

The worker needs:

```env
DATABASE_URL=your-supabase-database-url
REDIS_URL=redis://localhost:6379

MESSAGE_MODE=fake
APP_URL=http://localhost:4000
```

For real Amazon SES email sending, use:

```env
MESSAGE_MODE=aws
AWS_REGION=your-aws-region
SES_FROM_EMAIL=your-verified-ses-email
AWS_ACCESS_KEY_ID=your-aws-access-key-id
AWS_SECRET_ACCESS_KEY=your-aws-secret-access-key
```

When running through Docker Compose, `REDIS_URL` is overridden to:

```env
REDIS_URL=redis://redis:6379
```

### Start Backend Services

From the project root:

```powershell
docker compose up --build
```

This builds and starts:

```text
Redis
Express API
BullMQ worker
```

The API will be available at:

```text
http://localhost:4000
```

### Test the API

Open this URL in the browser:

```text
http://localhost:4000/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "direconnect-api",
  "timestamp": "..."
}
```

### Run the Frontend

In a separate terminal, run:

```powershell
npm run dev:web
```

Then open:

```text
http://localhost:3000
```

The local development setup is now:

```text
Frontend       → local Next.js dev server
API            → Docker container
Worker         → Docker container
Redis          → Docker container
Database/Auth  → Supabase
```

### Stop Docker Services

```powershell
docker compose down
```

### Rebuild Docker Services

Use this after changing Dockerfiles, package dependencies, or backend source code:

```powershell
docker compose up --build
```

### Run Docker in the Background

```powershell
docker compose up --build -d
```

### View Logs

View logs for all services:

```powershell
docker compose logs -f
```

View only API logs:

```powershell
docker compose logs -f api
```

View only worker logs:

```powershell
docker compose logs -f worker
```

### Remove Old Containers

If Docker reports a container name conflict, run:

```powershell
docker compose down
```

For manually created containers, remove them with:

```powershell
docker rm -f direconnect-api
docker rm -f direconnect-worker
docker rm -f direconnect-redis
```

### Notes

Inside Docker, `localhost` refers to the current container, not the host computer. That is why the API and worker use:

```env
REDIS_URL=redis://redis:6379
```

instead of:

```env
REDIS_URL=redis://localhost:6379
```

Docker Compose automatically creates a shared network where the `api`, `worker`, and `redis` services can communicate by service name.

