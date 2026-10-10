# Deployment

Current free-tier deployment guidance, environment variables, service limitations, cost notes, and manual AWS cutover steps are in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

The Render API service is described by `render.yaml`. Deploy the Next.js app separately from `apps/web` on a Vercel plan whose terms permit the intended use. The BullMQ worker remains independently runnable and is not configured as an always-on free service.
