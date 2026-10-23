"use client";

import { useEffect } from "react";
import { apiUrl } from "./api";

/**
 * Pings the API health endpoint so a sleeping free-tier server starts waking up
 * while the visitor reads the page. The result is intentionally ignored.
 */
export function useApiWarmup() {
  useEffect(() => {
    void fetch(apiUrl("/health")).catch(() => undefined);
  }, []);
}
