"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { THEME_KEY } from "@/lib/theme";
import { Icon } from "./icons";

type Theme = "light" | "dark";
export type ThemePreference = Theme | "system";

const CHANGE_EVENT = "direconnect-theme-change";

function systemTheme(): Theme {
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function readPreference(): ThemePreference {
  try {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
  } catch {}
  return "system";
}

/** The saved choice, kept in sync across every toggle and the settings page. */
export function useThemePreference(): ThemePreference | null {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGE_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(CHANGE_EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    readPreference,
    () => null,
  );
}

/**
 * Saves the preference and applies it. With an origin, the new theme grows as a circle from
 * that point; reduced motion and browsers without view transitions switch instantly.
 */
export function setThemePreference(preference: ThemePreference, origin?: { x: number; y: number }) {
  try {
    if (preference === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, preference);
  } catch {}

  const next = preference === "system" ? systemTheme() : preference;
  const apply = () => {
    document.documentElement.dataset.theme = next;
    window.dispatchEvent(new Event(CHANGE_EVENT));
  };

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (next === currentTheme() || reduced || !document.startViewTransition) {
    apply();
    return;
  }

  const { x, y } = origin ?? { x: innerWidth / 2, y: innerHeight / 2 };
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
  const transition = document.startViewTransition(apply);
  transition.ready
    .then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 1100, easing: "cubic-bezier(0.2, 0, 0, 1)", pseudoElement: "::view-transition-new(root)" },
      );
    })
    .catch(() => undefined);
}

/** Switches light and dark with a circle that grows from the button. */
export function ThemeToggle({ showLabel = false, className }: { showLabel?: boolean; className?: string }) {
  // null until mounted: the server cannot know the theme, so the state-dependent label waits.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const sync = () => setTheme(currentTheme());
    sync();
    window.addEventListener(CHANGE_EVENT, sync);

    // Follow the OS while the visitor has not chosen.
    const media = matchMedia("(prefers-color-scheme: dark)");
    const follow = () => {
      if (readPreference() === "system") setThemePreference("system");
    };
    media.addEventListener("change", follow);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      media.removeEventListener("change", follow);
    };
  }, []);

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    setThemePreference(currentTheme() === "dark" ? "light" : "dark", { x: left + width / 2, y: top + height / 2 });
  }

  const label = theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={showLabel ? undefined : label}
      title={label}
      className={cn(
        "inline-flex h-10 items-center rounded-control text-ink transition-colors hover:bg-sunken",
        showLabel ? "w-full gap-2.5 px-2.5 text-sm font-medium" : "w-10 justify-center",
        className,
      )}
    >
      {/* Both icons render; CSS shows the one for the current theme, so nothing depends on hydration. */}
      <Icon name="moon" className="h-[18px] w-[18px] dark:hidden" />
      <Icon name="sun" className="hidden h-[18px] w-[18px] dark:block" />
      {showLabel ? (
        <>
          <span className="dark:hidden">Dark mode</span>
          <span className="hidden dark:inline">Light mode</span>
        </>
      ) : null}
    </button>
  );
}
