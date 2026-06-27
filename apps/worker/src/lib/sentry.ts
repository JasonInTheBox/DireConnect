import * as Sentry from "@sentry/node";

let initialized = false;

export function initSentry() {
  if (initialized) {
    return;
  }

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    enabled: Boolean(process.env.SENTRY_DSN) && process.env.NODE_ENV !== "test",
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    sendDefaultPii: false,
  });

  initialized = true;
}

export { Sentry };
