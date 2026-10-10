import "dotenv/config";
import { initSentry } from "./lib/sentry.js";

// Loaded by Node's --import flag before Express and the route modules load.
initSentry();
