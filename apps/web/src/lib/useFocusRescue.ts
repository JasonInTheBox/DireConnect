"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * After a save the control that opened a dialog can unmount once the refetch lands (for example
 * an empty-state button); focus then drops to <body>. `arm()` before the refetch; when `trigger`
 * (the refetched data) changes, move focus to the page title if it was lost.
 */
export function useFocusRescue(trigger: unknown): () => void {
  const armed = useRef(false);

  const arm = useCallback(() => {
    armed.current = true;
  }, []);

  useEffect(() => {
    if (!armed.current) {
      return;
    }
    armed.current = false;

    const active = document.activeElement;
    if (!active || active === document.body || !active.isConnected) {
      document.getElementById("page-title")?.focus();
    }
  }, [trigger]);

  return arm;
}
