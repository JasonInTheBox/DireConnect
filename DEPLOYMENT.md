# Deployment

Current free-tier deployment guidance, environment variables, service limitations, cost notes, and manual AWS cutover steps are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

The Render API service is described by `render.yaml`. Deploy the Next.js app separately from `apps/web` on a Vercel plan whose terms permit the intended use. The BullMQ worker runs as a separate Railway service; configure its live-send allowlist alongside the Render API.
