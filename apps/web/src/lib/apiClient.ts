import { apiUrl } from "./api";
import { supabase } from "./supabase";

/** The Render free API can take about a minute to wake up, so wait well past that. */
export const API_TIMEOUT_MS = 90_000;

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

type ApiFetchOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

function redirectToLogin() {
  if (typeof window !== "undefined") {
    window.location.assign("/login");
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = (await response.json().catch(() => null)) as {
    error?: unknown;
    details?: unknown;
  } | null;
  const message =
    typeof body?.error === "string" && body.error
      ? body.error
      : `Request failed (${response.status}).`;

  return new ApiError(response.status, message, body?.details);
}

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    redirectToLogin();
    throw new ApiError(401, "You need to log in to continue.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, API_TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort();
    } else {
      options.signal.addEventListener("abort", onCallerAbort, { once: true });
    }
  }

  try {
    const hasBody = options.body !== undefined;
    const response = await fetch(apiUrl(path), {
      method: options.method ?? "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });

    if (response.status === 401) {
      redirectToLogin();
      throw new ApiError(401, "Your session has expired. Log in again.");
    }

    if (!response.ok) {
      throw await toApiError(response);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    try {
      return (await response.json()) as T;
    } catch (error) {
      if (controller.signal.aborted) {
        // A timeout or caller cancellation during the body read: let the outer catch classify it.
        throw error;
      }
      throw new ApiError(response.status, "The server sent an unexpected response.");
    }
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (timedOut) {
      throw new ApiError(0, "The server took too long to respond. Try again in a moment.");
    }
    if (options.signal?.aborted) {
      throw error;
    }
    throw new ApiError(0, "Could not reach the server. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onCallerAbort);
  }
}

/** Maps the API's zod validation issues (`details`) to `{ fieldName: message }`. */
export function fieldErrorsFromApiError(error: unknown): Record<string, string> {
  if (!(error instanceof ApiError) || !Array.isArray(error.details)) {
    return {};
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of error.details as Array<{ path?: unknown[]; message?: unknown }>) {
    const field = issue?.path?.[0];
    if (
      typeof field === "string" &&
      typeof issue.message === "string" &&
      !(field in fieldErrors)
    ) {
      fieldErrors[field] = issue.message;
    }
  }
  return fieldErrors;
}
