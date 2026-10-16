"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Only a refresh the user started is announced ("Refreshing…") and drives the button's loading state;
 * background ticks stay silent so a screen reader is not interrupted every 15 seconds.
 * `busy` is true while any reload is running; call `start` from the click handler.
 */
export function useManualRefresh(busy: boolean): { manual: boolean; start: () => void } {
  const [manual, setManual] = useState(false);
  // The reload begins a render after the click, so wait to see it start before waiting for it to end.
  const sawBusy = useRef(false);

  useEffect(() => {
    if (!manual) {
      return;
    }
    if (busy) {
      sawBusy.current = true;
    } else if (sawBusy.current) {
      sawBusy.current = false;
      setManual(false);
    }
  }, [manual, busy]);

  const start = useCallback(() => {
    sawBusy.current = false;
    setManual(true);
  }, []);

  return { manual, start };
}

/**
 * True once a reload has failed and stays true until a reload succeeds. `useApi` clears its error as
 * each reload starts, which would unmount and re-announce a failure notice on every attempt during an
 * outage; this keeps the notice mounted. `loading` is the same hook's loading flag.
 */
export function useReloadFailed(error: boolean, loading: boolean): boolean {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (error) {
      setFailed(true);
    } else if (!loading) {
      setFailed(false);
    }
  }, [error, loading]);

  return error || failed;
}
