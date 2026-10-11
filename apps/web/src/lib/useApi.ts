"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, apiFetch } from "./apiClient";

/** After this long without a response, pages explain that the server may be waking up. */
export const SLOW_RESPONSE_MS = 4_000;

type ApiState<T> = {
  data: T | null;
  error: ApiError | null;
  loading: boolean;
  slow: boolean;
};

export function useApi<T>(path: string | null) {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    error: null,
    loading: path !== null,
    slow: false,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (path === null) {
      setState({ data: null, error: null, loading: false, slow: false });
      return;
    }

    const controller = new AbortController();
    setState((previous) => ({ ...previous, error: null, loading: true, slow: false }));

    const slowTimer = setTimeout(() => {
      setState((previous) => (previous.loading ? { ...previous, slow: true } : previous));
    }, SLOW_RESPONSE_MS);

    apiFetch<T>(path, { signal: controller.signal })
      .then((data) => {
        setState({ data, error: null, loading: false, slow: false });
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
          loading: false,
          slow: false,
        }));
      })
      .finally(() => clearTimeout(slowTimer));

    return () => {
      controller.abort();
      clearTimeout(slowTimer);
    };
  }, [path, attempt]);

  const refetch = useCallback(() => setAttempt((value) => value + 1), []);

  return { ...state, refetch };
}
