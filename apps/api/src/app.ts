import express from "express";
import cors from "cors";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { customerRouter } from "./routes/customer.js";
import { businessRouter } from "./routes/business.js";
import { campaignRouter } from "./routes/campaign.js";
import { unsubscribeRouter } from "./routes/unsubscribe.js";
import { keepaliveRouter } from "./routes/keepalive.js";
import { initSentry, Sentry } from "./lib/sentry.js";

initSentry();

const app = express();

// Render sits one proxy in front, so the client IP is the first hop (rate limits key on it).
app.set("trust proxy", 1);
app.disable("x-powered-by");
// A JSON-only API: helmet's defaults (HSTS, nosniff, frame-deny, a locked-down CSP) fit as they are.
app.use(helmet());

const allowedOrigins = new Set([
  ...(process.env.CLIENT_URL ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean),
  "http://localhost:3000",
]);

app.use(
    cors({ 
        origin(origin, callback) {
            if (!origin || allowedOrigins.has(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error(`Not allowed by CORS: ${origin}`));
        },
        credentials: true,
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.use(express.json({ limit: "100kb" }));

// shortcut: in-memory counters per API instance; move to a Redis store if the API scales out.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});
// Unsubscribe links are public, so they get a tighter budget against token guessing.
const unsubscribeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});


app.get("/health", (_req, res) => {
    res.json({ 
        status: "ok",
        service: "direconnect-api",
        timestamp: new Date().toISOString(),
    });
});

// Authenticated by its own shared bearer token (no Supabase user), for the daily keep-alive ping.
app.use("/api", apiLimiter);
app.use("/api/keepalive", keepaliveRouter);

app.use("/api/businesses", businessRouter);
app.use("/api/businesses/:businessId/customers", customerRouter);
app.use("/api/businesses/:businessId/campaigns", campaignRouter);
app.use("/api/unsubscribe", unsubscribeLimiter, unsubscribeRouter);

Sentry.setupExpressErrorHandler(app);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);

    res.status(500).json({
      error: "Internal server error",
    });
  },
);


export { app };
