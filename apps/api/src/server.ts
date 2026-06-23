import { apiEnv } from "./config/env.js";
import express from "express";
import cors from "cors";
import { customerRouter } from "./routes/customer.js";
import { businessRouter } from "./routes/business.js";
import { campaignRouter } from "./routes/campaign.js";
import { unsubscribeRouter } from "./routes/unsubscribe.js";

const app = express();

const allowedOrigins = apiEnv.clientUrl
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

app.use(
    cors({ 
        origin(origin, callback) {
            if (!origin || allowedOrigins.includes(origin)) {
                callback(null, true);
                return;
            }

            callback(new Error(`Not allowed by CORS: ${origin}`));
        },
        credentials: true,
    })

);

app.use(express.json());

const PORT = apiEnv.port;

app.get("/api/health", (_req, res) => {
    res.json({ message: "DireConnect API is running."});
})

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

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
