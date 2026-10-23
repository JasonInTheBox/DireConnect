"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "./apiClient";

/** After this long without a response, pages explain that the server may be waking up. */
export const SLOW_RESPONSE_MS = 4_000;

/**
 * State is tagged with the path it belongs to, so a path change never exposes
 * the previous path's data, error or loading flag.
 */
type ApiState<T> = {
  data: T | null;
  error: ApiError | null;
  pending: boolean;
  slow: boolean;
  forPath: string | null;
};

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    pending: path !== null,
    slow: false,
    forPath: path,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (path === null) {
      setState((previous) =>
        previous.forPath === null &&
        previous.data === null &&
        previous.error === null &&
        !previous.pending &&
        !previous.slow
          ? previous
          : { data: null, error: null, pending: false, slow: false, forPath: null },
      );
      return;
    }

    const controller = new AbortController();
    setState((previous) =>
      previous.forPath === path
        // Same path (refetch): keep the old data visible while revalidating.
        ? { ...previous, error: null, pending: true, slow: false }
        : { data: null, error: null, pending: true, slow: false, forPath: path },
    );

    const slowTimer = setTimeout(() => {
      setState((previous) =>
        previous.forPath === path && previous.pending ? { ...previous, slow: true } : previous,
      );
    }, SLOW_RESPONSE_MS);

    apiFetch<T>(path, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) {
          return;
        }
        setState({ data, error: null, pending: false, slow: false, forPath: path });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setState((previous) => ({
          ...previous,
          error:
            error instanceof ApiError
              ? error
              : new ApiError(0, "Something went wrong. Try again."),
          pending: false,
          slow: false,
          forPath: path,
        }));
      })
      .finally(() => clearTimeout(slowTimer));

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, [path, attempt]);

  const refetch = useCallback(() => setAttempt((value) => value + 1), []);

  const current = state.forPath === path;

  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: path !== null && (!current || state.pending),
    slow: current && state.slow,
    refetch,
  };
}
