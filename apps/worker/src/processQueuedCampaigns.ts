import { startCampaignWorker } from "./campaignWorker.js";

// Preserve the historical CLI entry point while routing work through the same
// consent checks, SMS guard, and provider adapter as the BullMQ worker.
startCampaignWorker();
