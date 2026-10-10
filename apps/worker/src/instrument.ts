import "dotenv/config";
import { initSentry } from "./lib/sentry.js";

// Loaded by Node's --import flag before BullMQ and Redis modules load.
initSentry();
