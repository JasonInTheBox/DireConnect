"use client";

import { useEffect, useRef } from "react";
import type { CampaignStatus } from "./types";

export const AUTO_REFRESH_MS = 15_000;

/** Only a queued campaign is still changing, and polling a hidden tab is wasted work. */
export function shouldAutoRefresh({
  status,
  visible,
}: {
  status: CampaignStatus;
  visible: boolean;
}): boolean {
  return status === "QUEUED" && visible;
}

/**
 * Calls `refetch` every `intervalMs` while `active`, and once when a hidden tab becomes visible
 * again. The timer is cleared as soon as `active` turns false or the page unmounts. When `active`
 * turns from true to false (the campaign finished), `onStop` runs once so the final numbers are
 * read after the status changed rather than alongside it.
 */
export function useAutoRefresh(
  active: boolean,
  refetch: () => void,
  intervalMs: number = AUTO_REFRESH_MS,
  onStop?: () => void,
): void {
  const latest = useRef(refetch);
  const latestStop = useRef(onStop);
  const wasActive = useRef(active);
  useEffect(() => {
    latest.current = refetch;
    latestStop.current = onStop;
  }, [refetch, onStop]);

  useEffect(() => {
    if (wasActive.current && !active) {
      latestStop.current?.();
    }
    wasActive.current = active;
  }, [active]);

  useEffect(() => {
    if (!active) {
      return;
    }
    const tick = () => {
      if (document.visibilityState === "visible") {
        latest.current();
      }
    };
    const timer = setInterval(tick, intervalMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active, intervalMs]);
}
