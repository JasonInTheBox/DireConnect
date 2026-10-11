"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { readPreference, writePreference } from "@/lib/preferences";
import { Dialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icons";
import { Sidebar } from "./sidebar";

const SIDEBAR_KEY = "dc.sidebar";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setCollapsed(readPreference(SIDEBAR_KEY) === "collapsed");
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    writePreference(SIDEBAR_KEY, next ? "collapsed" : "expanded");
  }

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-control focus:bg-surface focus:px-3 focus:py-2 focus:shadow-float"
      >
        Skip to content
      </a>

      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 border-r border-line bg-surface transition-[width] duration-150 lg:block",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-line bg-surface px-3 lg:hidden">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setDrawerOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-control text-ink transition-colors hover:bg-sunken"
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold tracking-tight">DireConnect</span>
        </header>

        <main id="main-content" tabIndex={-1} className="min-w-0 focus:outline-none">
          {children}
        </main>
      </div>

      <Dialog
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Navigation"
        placement="left"
        hideTitle
      >
        <Sidebar collapsed={false} onNavigate={() => setDrawerOpen(false)} />
      </Dialog>
    </div>
  );
}
