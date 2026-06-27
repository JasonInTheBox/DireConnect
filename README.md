## DireConnect

DireConnect is a full-stack customer and campaign management application built to practice production-style software engineering. The app lets authenticated users create businesses, manage customers, create email or SMS campaigns, preview eligible recipients, queue campaigns, process campaign jobs in a background worker, and view campaign logs and analytics.


## Live Demo

Frontend: https://main.d8j6rr4pntmji.amplifyapp.com  
API Health Check: https://d9auoa5p89nsz.cloudfront.net/health

Note: The deployed API/worker may be scaled down outside of demo periods to control AWS costs.


## Tech Stack

### Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* Supabase Auth

### Backend

* Node.js
* Express
* TypeScript
* Prisma
* Zod
* Supabase PostgreSQL

### Background Jobs

* BullMQ
* Redis
* Worker service for campaign processing

### Cloud / Deployment

* AWS Amplify for frontend hosting
* Amazon ECR for Docker image storage
* Amazon ECS Fargate for API and worker containers
* Application Load Balancer for API traffic
* CloudFront for HTTPS API access
* CloudWatch for logs
* GitHub Actions for CI checks

## Core Features

* User authentication with Supabase Auth
* Business creation and ownership-based access control
* Customer CRUD operations
* Email and SMS opt-in tracking
* Campaign creation and editing
* Campaign audience preview
* Campaign queueing with recipient snapshots
* Background worker processing through BullMQ
* Message logs and campaign analytics
* Unsubscribe support through customer tokens

## Architecture Overview

The frontend is deployed through AWS Amplify and communicates with the backend API over HTTPS through CloudFront. CloudFront forwards API requests to an Application Load Balancer, which routes traffic to the Express API running on ECS Fargate.

The API handles authentication, business/customer/campaign routes, validation, and campaign queueing. Campaign jobs are pushed into Redis through BullMQ. A separate ECS Fargate worker consumes queued jobs, checks recipient snapshots, sends messages in fake or real mode, and writes message logs back to the database.


## Architecture

```text
User Browser
    |
    v
AWS Amplify Frontend
    |
    v
CloudFront HTTPS API URL
    |
    v
Application Load Balancer
    |
    v
ECS Fargate API Container
    |
    +--> Supabase PostgreSQL
    |
    +--> Redis / BullMQ Queue
              |
              v
        ECS Fargate Worker
              |
              v
        Message Logs / Campaign Analytics

## Testing

This project includes several layers of automated testing:

* Zod schema validation tests
* Express validation middleware tests
* API route tests for business, customer, and campaign routes
* Campaign eligibility unit tests
* Worker tests for campaign job processing
* Playwright frontend smoke tests
* GitHub Actions CI for automated build and test checks

## Deployment

The application was deployed using AWS services:

* Frontend: AWS Amplify
* API: ECS Fargate behind an Application Load Balancer
* API HTTPS layer: CloudFront
* Worker: ECS Fargate background service
* Docker images: Amazon ECR
* Logs: CloudWatch
* Database/Auth: Supabase
* Queue: Redis/BullMQ

## Local Development

Install dependencies:

```bash
npm install
```

Generate Prisma client:

```bash
npm run db:generate
```

Build shared packages:

```bash
npm run build:packages
```

Run the frontend:

```bash
npm run dev:web
```

Run the API:

```bash
npm run dev:api
```

Run the worker:

```bash
npm run dev:worker
```

Run tests:

```bash
npm test
```

Run frontend E2E tests:

```bash
npm run test:e2e
```

Run full build:

```bash
npm run build
```

## What I Learned

Through this project, I practiced full-stack development, authentication, database modeling, API design, background job processing, cloud deployment, Docker, AWS ECS/Fargate, CloudFront, CI/CD, automated testing, and production-style debugging.
