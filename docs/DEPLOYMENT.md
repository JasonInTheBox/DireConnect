# DireConnect Deployment Runbook

## Production URLs

Frontend:

```text
https://main.d8j6rr4pntmji.amplifyapp.com
```

API Health Check
```
https://d9auoa5p89nsz.cloudfront.net/health
```

## AWS Services
```
DireConnect uses the following AWS services:

AWS Amplify for the frontend
Amazon ECR for Docker images
Amazon ECS Fargate for the API and worker
Application Load Balancer for API routing
CloudFront for HTTPS API access
CloudWatch for logs
GitHub Actions OIDC for AWS deployment access
GitHub Actions Workflows
DireConnect CI

Runs unit tests, API tests, worker tests, validation tests, and monorepo build checks.

DireConnect E2E

Runs Playwright frontend smoke tests.

DireConnect Docker Build

Builds API and worker Docker images without pushing them. This verifies that deployment images still build correctly.

DireConnect Manual ECS Deploy

Manually builds, pushes, and deploys API and worker Docker images to ECS.

Use this when deploying a new backend/worker version.

DireConnect Scale ECS Services

Manually starts or stops the ECS API and worker services.

Use this to control AWS costs.
```

## Starting the App
```
Go to:

GitHub → Actions → DireConnect Scale ECS Services → Run workflow

Use:

action: start
scale_api: true
scale_worker: true

Then verify:

curl.exe https://d9auoa5p89nsz.cloudfront.net/health

Expected result:

{
  "status": "ok",
  "service": "direconnect-api"
}
```
## Stopping the App
```
Go to:

GitHub → Actions → DireConnect Scale ECS Services → Run workflow

Use:

action: stop
scale_api: true
scale_worker: true

After stopping, the API may return 503. This is expected because there are no running ECS API tasks.

Deploying API and Worker

Go to:

GitHub → Actions → DireConnect Manual ECS Deploy → Run workflow

Use:

deploy_api: true
deploy_worker: true

After the workflow passes, verify:

curl.exe https://d9auoa5p89nsz.cloudfront.net/health

Also check:

AWS ECS → direconnect-cluster → Services

Expected:

direconnect-api-service: running 1/1
direconnect-worker-service: running 1/1
Checking ECS Service Status
aws ecs describe-services `
  --cluster direconnect-cluster `
  --services direconnect-api-service direconnect-worker-service `
  --region us-west-1 `
  --query "services[*].{name:serviceName,desired:desiredCount,running:runningCount,pending:pendingCount}"
Common Issue: API Health Check Returns 503

A 503 usually means CloudFront or the ALB cannot reach a healthy API task.
```

## Check service counts:
```
aws ecs describe-services `
  --cluster direconnect-cluster `
  --services direconnect-api-service `
  --region us-west-1 `
  --query "services[0].{desired:desiredCount,running:runningCount,pending:pendingCount,events:events[0:5].message}"

If desired count is 0, start the service through the scale workflow.

If desired count is 1 but running count is 0, check CloudWatch logs.
```

## CloudWatch Logs
```
API logs:

CloudWatch → Log groups → /ecs/direconnect-api

Worker logs:

CloudWatch → Log groups → /ecs/direconnect-worker
```

## Sentry Monitoring
```
Sentry is configured for:

Frontend errors
API errors
Worker errors

Use Sentry to inspect runtime exceptions and CloudWatch for container startup/runtime logs.
```


## Local Verification Before Deploying
```
Before deploying, run:

npm test
npm run test:e2e
npm run build

Optional Docker verification:

docker build -f apps/api/Dockerfile -t direconnect-api:local .
docker build -f apps/worker/Dockerfile -t direconnect-worker:local .



