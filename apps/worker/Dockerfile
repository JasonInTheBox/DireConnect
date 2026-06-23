FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./

COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/worker/package.json ./apps/worker/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/validation/package.json ./packages/validation/package.json

RUN npm ci --no-audit --no-fund

COPY . .

RUN npm run generate -w packages/db
RUN npm run build -w packages/db
RUN npm run build -w packages/validation
RUN npm run build -w apps/worker

CMD ["npm", "run", "start", "-w", "apps/worker"]
