import { afterEach, describe, expect, it, vi } from "vitest";
import { readPreference, writePreference } from "./preferences";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("preferences", () => {
  it("round-trips a value through localStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    });

    writePreference("dc.sidebar", "collapsed");
    expect(readPreference("dc.sidebar")).toBe("collapsed");
    expect(readPreference("missing")).toBeNull();
  });

  it("returns null when storage is unavailable", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(readPreference("dc.sidebar")).toBeNull();
    expect(() => writePreference("dc.sidebar", "collapsed")).not.toThrow();
  });

  it("swallows errors thrown by blocked storage", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    });

    expect(readPreference("dc.sidebar")).toBeNull();
    expect(() => writePreference("dc.sidebar", "collapsed")).not.toThrow();
  });
});
