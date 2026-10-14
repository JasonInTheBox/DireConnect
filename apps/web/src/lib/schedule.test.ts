import { describe, expect, it } from "vitest";
import {
  formatDateTime,
  isFutureIso,
  localInputToIso,
  localTimeZoneLabel,
  toLocalInput,
  validateSchedule,
} from "./schedule";

// Tests build dates with the local-time constructor so they hold in any time zone.
const local = (year: number, month: number, day: number, hour: number, minute: number) =>
  new Date(year, month - 1, day, hour, minute);

describe("toLocalInput / localInputToIso", () => {
  it("converts an ISO instant to the datetime-local format in local time", () => {
    expect(toLocalInput(local(2030, 1, 15, 9, 30).toISOString())).toBe("2030-01-15T09:30");
  });

  it("converts a datetime-local value to the matching ISO instant", () => {
    expect(localInputToIso("2030-01-15T09:30")).toBe(local(2030, 1, 15, 9, 30).toISOString());
  });

  it("round-trips to the minute", () => {
    const iso = local(2031, 12, 31, 23, 59).toISOString();
    expect(localInputToIso(toLocalInput(iso))).toBe(iso);
  });

  it("returns empty or null for blank and unparsable input", () => {
    expect(toLocalInput("")).toBe("");
    expect(toLocalInput("nonsense")).toBe("");
    expect(localInputToIso("")).toBeNull();
    expect(localInputToIso("   ")).toBeNull();
    expect(localInputToIso("nonsense")).toBeNull();
  });
});

describe("isFutureIso", () => {
  const now = local(2030, 1, 15, 9, 0);

  it("is true only strictly after now", () => {
    expect(isFutureIso(local(2030, 1, 15, 9, 1).toISOString(), now)).toBe(true);
    expect(isFutureIso(now.toISOString(), now)).toBe(false);
    expect(isFutureIso(local(2030, 1, 14, 9, 0).toISOString(), now)).toBe(false);
    expect(isFutureIso("nonsense", now)).toBe(false);
  });
});

describe("validateSchedule", () => {
  const now = local(2030, 1, 15, 9, 0);

  it("accepts a future time", () => {
    expect(validateSchedule("2030-01-15T09:30", now)).toBeNull();
  });

  it("asks for a value when blank", () => {
    expect(validateSchedule("", now)).toBe("Choose a date and time.");
    expect(validateSchedule("   ", now)).toBe("Choose a date and time.");
  });

  it("rejects an unparsable value", () => {
    expect(validateSchedule("not a date", now)).toBe("Enter a valid date and time.");
  });

  it("rejects the past and the present", () => {
    expect(validateSchedule("2030-01-15T08:59", now)).toBe("Choose a time in the future.");
    expect(validateSchedule("2030-01-15T09:00", now)).toBe("Choose a time in the future.");
  });
});

describe("formatDateTime", () => {
  it("formats in the requested time zone", () => {
    expect(formatDateTime("2030-02-01T09:30:00.000Z", "UTC")).toMatch(/^Feb 1, 2030, 9:30\sAM$/);
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatDateTime("nonsense")).toBe("");
  });
});

describe("localTimeZoneLabel", () => {
  it("names a time zone", () => {
    expect(localTimeZoneLabel().length).toBeGreaterThan(0);
  });
});
