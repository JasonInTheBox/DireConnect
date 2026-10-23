"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "./apiClient";
import type { CampaignDelivery } from "./campaignDisplay";
import type { Campaign, CampaignAnalyticsResponse } from "./types";

/**
 * Delivery numbers for the non-draft campaigns on screen. Each request is independent, so one
 * failure only marks its own row as unavailable. Drafts never trigger a request.
 */
export function useCampaignDeliveries(
  businessId: string,
  campaigns: Array<Pick<Campaign, "id" | "status">>,
): Record<string, CampaignDelivery> {
  const [deliveries, setDeliveries] = useState<Record<string, CampaignDelivery>>({});
  // The status is part of the key so a campaign that finishes sending is fetched again.
  const wanted = campaigns
    .filter((item) => item.status !== "DRAFT")
    .map((item) => `${item.id}:${item.status}`)
    .join(",");

  useEffect(() => {
    if (!wanted) {
      return;
    }
    const ids = wanted.split(",").map((entry) => entry.split(":")[0]);
    const controller = new AbortController();

    setDeliveries((previous) => {
      const next = { ...previous };
      for (const id of ids) {
        next[id] = previous[id] ?? { status: "loading" };
      }
      return next;
    });

    Promise.allSettled(
      ids.map((id) =>
        apiFetch<CampaignAnalyticsResponse>(
          `/api/businesses/${businessId}/campaigns/${id}/analytics`,
          { signal: controller.signal },
        ),
      ),
    ).then((results) => {
      if (controller.signal.aborted) {
        return;
      }
      setDeliveries((previous) => {
        const next = { ...previous };
        results.forEach((result, index) => {
          next[ids[index]] =
            result.status === "fulfilled"
              ? { status: "ready", summary: result.value.summary }
              : { status: "error" };
        });
        return next;
      });
    });

    return () => controller.abort();
  }, [businessId, wanted]);

  return deliveries;
}
