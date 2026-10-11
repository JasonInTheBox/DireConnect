import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

import { supabase } from "./supabase";
import {
  API_TIMEOUT_MS,
  ApiError,
  apiFetch,
  fieldErrorsFromApiError,
} from "./apiClient";

const getSession = vi.mocked(supabase.auth.getSession);
const fetchMock = vi.fn();
const assign = vi.fn();

function signedIn() {
  getSession.mockResolvedValue({
    data: { session: { access_token: "token-123" } },
    error: null,
  } as never);
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  getSession.mockReset();
  assign.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", { location: { assign } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("apiFetch", () => {
  it("sends the bearer token and parses JSON", async () => {
    signedIn();
    fetchMock.mockResolvedValue(jsonResponse(200, [{ id: "b1" }]));

    const result = await apiFetch<Array<{ id: string }>>("/api/businesses");

    expect(result).toEqual([{ id: "b1" }]);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://localhost:4000/api/businesses");
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer token-123");
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("sends a JSON body with a content type", async () => {
    signedIn();
    fetchMock.mockResolvedValue(jsonResponse(201, { id: "new" }));

    await apiFetch("/api/businesses", { method: "POST", body: { name: "Cafe" } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(init.body).toBe(JSON.stringify({ name: "Cafe" }));
  });

  it("returns undefined for 204 responses", async () => {
    signedIn();
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(
      apiFetch("/api/businesses/b1", { method: "DELETE" }),
    ).resolves.toBeUndefined();
  });

  it("throws an ApiError carrying the server message", async () => {
    signedIn();
    fetchMock.mockResolvedValue(jsonResponse(404, { error: "Business not found" }));

    await expect(apiFetch("/api/businesses/x/dashboard")).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Business not found",
    });
  });

  it("falls back to a generic message when the error body is not JSON", async () => {
    signedIn();
    fetchMock.mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));

    await expect(apiFetch("/api/businesses")).rejects.toMatchObject({
      status: 502,
      message: "Request failed (502).",
    });
  });

  it("reports an unexpected non-JSON success response", async () => {
    signedIn();
    fetchMock.mockResolvedValue(new Response("not json", { status: 200 }));

    await expect(apiFetch("/api/businesses")).rejects.toMatchObject({
      status: 200,
      message: "The server sent an unexpected response.",
    });
  });

  it("sends the user to /login on a 401", async () => {
    signedIn();
    fetchMock.mockResolvedValue(jsonResponse(401, { error: "Unauthorized" }));

    await expect(apiFetch("/api/businesses")).rejects.toMatchObject({ status: 401 });
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("does not call the API without a session", async () => {
    getSession.mockResolvedValue({ data: { session: null }, error: null } as never);

    await expect(apiFetch("/api/businesses")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(assign).toHaveBeenCalledWith("/login");
  });

  it("turns a network failure into a readable error", async () => {
    signedIn();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(apiFetch("/api/businesses")).rejects.toMatchObject({
      status: 0,
      message: "Could not reach the server. Check your connection and try again.",
    });
  });

  it("waits up to the timeout, then reports a slow server", async () => {
    vi.useFakeTimers();
    signedIn();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );

    const pending = apiFetch("/api/businesses");
    const assertion = expect(pending).rejects.toMatchObject({
      status: 0,
      message: "The server took too long to respond. Try again in a moment.",
    });

    await vi.advanceTimersByTimeAsync(API_TIMEOUT_MS - 1);
    // Still pending one millisecond before the timeout: a cold start is not an error.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it("lets a caller cancellation propagate as an AbortError", async () => {
    signedIn();
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    );
    const controller = new AbortController();

    const pending = apiFetch("/api/businesses", { signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    controller.abort();
    await assertion;
    await expect(pending).rejects.not.toBeInstanceOf(ApiError);
  });
});

describe("fieldErrorsFromApiError", () => {
  it("maps validation issues to the first message per field", () => {
    const error = new ApiError(400, "Invalid request body", [
      { path: ["email"], message: "Invalid email" },
      { path: ["email"], message: "Second message ignored" },
      { path: ["name"], message: "Business name is required" },
      { path: [], message: "No field" },
    ]);

    expect(fieldErrorsFromApiError(error)).toEqual({
      email: "Invalid email",
      name: "Business name is required",
    });
  });

  it("returns an empty object for other errors", () => {
    expect(fieldErrorsFromApiError(new Error("boom"))).toEqual({});
    expect(fieldErrorsFromApiError(new ApiError(500, "Server error"))).toEqual({});
    expect(fieldErrorsFromApiError(undefined)).toEqual({});
  });
});
