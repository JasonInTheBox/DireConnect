"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Only a refresh the user started is announced ("Refreshing…") and drives the button's loading state;
 * background ticks stay silent so a screen reader is not interrupted every 15 seconds.
 * `busy` is true while any reload is running. `start` returns false (and does nothing) while a
 * refresh the user started is still running, so a second click, from Refresh or from the failure
 * notice's Try again, is ignored instead of restarting the request.
 */
export function useManualRefresh(busy: boolean): { manual: boolean; start: () => boolean } {
  const [manual, setManual] = useState(false);
  const running = useRef(false);
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
      running.current = false;
      setManual(false);
    }
  }, [manual, busy]);

  const start = useCallback(() => {
    if (running.current) {
      return false;
    }
    running.current = true;
    sawBusy.current = false;
    setManual(true);
    return true;
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

  // `failed` is only kept while a reload is running: once a reload has finished without an error the
  // notice goes at once, instead of lingering for one commit until the effect above clears the flag.
  return error || (failed && loading);
}
