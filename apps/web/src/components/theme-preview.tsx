"use client";

import { useEffect, useState } from "react";

// Dev-only switcher for comparing the theme options on real pages (?theme=postmark etc.).
const THEMES = [
  { id: "", label: "Current" },
  { id: "postmark", label: "A · Postmark" },
  { id: "mainstreet", label: "B · Main Street" },
  { id: "routemap", label: "C · Route map" },
] as const;

const KEY = "direconnect-theme-preview";

export function ThemePreview() {
  const [theme, setTheme] = useState("");

  useEffect(() => {
    let initial = new URLSearchParams(location.search).get("theme") ?? "";
    try {
      initial ||= sessionStorage.getItem(KEY) ?? "";
    } catch {}
    setTheme(initial);
  }, []);

  useEffect(() => {
    if (theme) document.documentElement.dataset.theme = theme;
    else delete document.documentElement.dataset.theme;
    try {
      sessionStorage.setItem(KEY, theme);
    } catch {}
  }, [theme]);

  return (
    <div
      role="group"
      aria-label="Theme preview"
      className="fixed bottom-4 right-4 z-50 flex gap-1 rounded-full border border-line bg-surface p-1 text-xs shadow-float"
    >
      {THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          aria-pressed={theme === t.id}
          onClick={() => setTheme(t.id)}
          className={`rounded-full px-3 py-1.5 font-medium transition-colors ${
            theme === t.id ? "bg-accent text-accent-ink" : "text-muted hover:text-ink"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
