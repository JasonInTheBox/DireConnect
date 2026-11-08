"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { THEME_KEY } from "@/lib/theme";
import { Icon } from "./icons";

type Theme = "light" | "dark";

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme;
}

/** Switches light and dark with a circle that grows from the button. */
export function ThemeToggle({ showLabel = false, className }: { showLabel?: boolean; className?: string }) {
  // null until mounted: the server cannot know the theme, so the state-dependent label waits.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(currentTheme());

    // Follow the OS while the visitor has not chosen.
    const media = matchMedia("(prefers-color-scheme: dark)");
    const follow = (event: MediaQueryListEvent) => {
      let saved: string | null = null;
      try {
        saved = localStorage.getItem(THEME_KEY);
      } catch {}
      if (saved) return;
      const next: Theme = event.matches ? "dark" : "light";
      apply(next);
      setTheme(next);
    };
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, []);

  function toggle(event: React.MouseEvent<HTMLButtonElement>) {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {}

    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || !document.startViewTransition) {
      apply(next);
      setTheme(next);
      return;
    }

    // The new theme is revealed as a circle from the button's centre out to the farthest corner.
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));

    const transition = document.startViewTransition(() => {
      apply(next);
      setTheme(next);
    });
    transition.ready
      .then(() => {
        document.documentElement.animate(
          { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
          { duration: 1100, easing: "cubic-bezier(0.2, 0, 0, 1)", pseudoElement: "::view-transition-new(root)" },
        );
      })
      .catch(() => undefined);
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
