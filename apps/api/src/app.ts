import express from "express";
import cors from "cors";
import { customerRouter } from "./routes/customer.js";
import { businessRouter } from "./routes/business.js";
import { campaignRouter } from "./routes/campaign.js";
import { unsubscribeRouter } from "./routes/unsubscribe.js";
import { initSentry, Sentry } from "./lib/sentry.js";

initSentry();

const app = express();

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

app.use(express.json());


app.get("/health", (_req, res) => {
    res.json({ 
        status: "ok",
        service: "direconnect-api",
        timestamp: new Date().toISOString(),
    });
});

app.use("/api/businesses", businessRouter);
app.use("/api/businesses/:businessId/customers", customerRouter);
app.use("/api/businesses/:businessId/campaigns", campaignRouter);
app.use("/api/unsubscribe", unsubscribeRouter)

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
