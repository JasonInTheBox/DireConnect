function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** An ISO instant as the local `YYYY-MM-DDTHH:mm` a datetime-local input expects ("" if invalid). */
export function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A datetime-local value (local time) as an ISO instant; null when blank or unparsable. */
export function localInputToIso(value: string): string | null {
  if (!value.trim()) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function isFutureIso(iso: string, now: Date = new Date()): boolean {
  const time = new Date(iso).getTime();
  return !Number.isNaN(time) && time > now.getTime();
}

/** The error to show for a schedule value, or null when it is a valid future time. */
export function validateSchedule(value: string, now: Date = new Date()): string | null {
  if (!value.trim()) {
    return "Choose a date and time.";
  }
  const iso = localInputToIso(value);
  if (iso === null) {
    return "Enter a valid date and time.";
  }
  return isFutureIso(iso, now) ? null : "Choose a time in the future.";
}

/** The browser's time zone, for example "Europe/London". */
export function localTimeZoneLabel(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "your local time zone";
}

export function formatDateTime(iso: string, timeZone?: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}
