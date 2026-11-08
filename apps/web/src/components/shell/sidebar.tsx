"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { getBusinessIdFromPath, isNavActive } from "@/lib/navigation";
import { Icon, type IconName } from "@/components/ui/icons";
import { useBusinesses } from "./businesses-provider";
import { BusinessSwitcher } from "./business-switcher";
import { useSession } from "./session-provider";
import { useLogout } from "./use-logout";
import { BrandMark } from "@/components/ui/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type NavEntry = { href: string; label: string; icon: IconName; exact?: boolean };

function NavGroup({
  heading,
  entries,
  pathname,
  collapsed,
  onNavigate,
}: {
  heading: string;
  entries: NavEntry[];
  pathname: string;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="space-y-1">
      {collapsed ? (
        <div role="separator" className="mx-2 my-2 h-px bg-line" />
      ) : (
        <p className="truncate px-2.5 pb-1.5 pt-4 text-xs font-semibold text-muted">{heading}</p>
      )}
      {entries.map((entry) => {
        const active = isNavActive(pathname, entry.href, entry.exact);
        return (
          <Link
            key={entry.href}
            href={entry.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            aria-label={collapsed ? entry.label : undefined}
            title={collapsed ? entry.label : undefined}
            className={cn(
              "relative flex items-center rounded-control text-sm font-medium transition-colors",
              "h-10",
              collapsed ? "justify-center" : "gap-2.5 px-2.5",
              active
                ? "bg-surface font-semibold text-accent shadow-card"
                : "text-ink/80 hover:bg-surface/70 hover:text-ink",
            )}
          >
            <Icon name={entry.icon} />
            {collapsed ? null : <span className="truncate">{entry.label}</span>}
          </Link>
        );
      })}
    </div>
  );
}

export function Sidebar({
  collapsed,
  onToggleCollapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const user = useSession();
  const { businesses } = useBusinesses();

  const businessId = getBusinessIdFromPath(pathname);
  const business = businesses.find((candidate) => candidate.id === businessId) ?? null;

  const businessEntries: NavEntry[] = business
    ? [
        { href: `/businesses/${business.id}/dashboard`, label: "Dashboard", icon: "dashboard" },
        { href: `/businesses/${business.id}/customers`, label: "Customers", icon: "users" },
        { href: `/businesses/${business.id}/campaigns`, label: "Campaigns", icon: "send" },
      ]
    : [];

  const handleLogout = useLogout();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("space-y-3 p-3", collapsed && "px-2")}>
        {collapsed ? null : (
          <p className="px-1 pt-1"><BrandMark size="sm" /></p>
        )}
        <BusinessSwitcher collapsed={collapsed} onNavigate={onNavigate} />
      </div>

      <nav aria-label="Primary" className={cn("min-h-0 flex-1 overflow-y-auto pb-3", collapsed ? "px-2" : "px-3")}>
        <NavGroup
          heading="Workspace"
          entries={[{ href: "/businesses", label: "Businesses", icon: "building", exact: true }]}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
        {business ? (
          <NavGroup
            heading={business.name}
            entries={businessEntries}
            pathname={pathname}
            collapsed={collapsed}
            onNavigate={onNavigate}
          />
        ) : null}
        <NavGroup
          heading="Account"
          entries={[{ href: "/account", label: "Account", icon: "user", exact: true }]}
          pathname={pathname}
          collapsed={collapsed}
          onNavigate={onNavigate}
        />
      </nav>

      <div className={cn("space-y-1 border-t border-line p-3", collapsed && "px-2")}>
        {collapsed ? null : (
          <div className="mb-2 flex items-center gap-2.5 rounded-control bg-surface px-2.5 py-2 shadow-card">
            <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold uppercase text-accent">
              {(user.email ?? "?")[0]}
            </span>
            <span className="min-w-0">
              <span className="block text-xs text-muted">Signed in as</span>
              <span className="block truncate text-sm font-medium text-ink" title={user.email ?? undefined}>
                {user.email ?? "Signed in"}
              </span>
            </span>
          </div>
        )}
        <ThemeToggle showLabel={!collapsed} className="hover:bg-surface/70" />
        <button
          type="button"
          onClick={handleLogout}
          aria-label={collapsed ? "Log out" : undefined}
          title={collapsed ? "Log out" : undefined}
          className={cn(
            "flex h-10 w-full items-center rounded-control text-sm font-medium text-ink transition-colors hover:bg-surface/70",
            collapsed ? "justify-center" : "gap-2.5 px-2.5",
          )}
        >
          <Icon name="logout" />
          {collapsed ? null : "Log out"}
        </button>
        {onToggleCollapsed ? (
          <button
            type="button"
            onClick={onToggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-10 w-full items-center rounded-control text-sm font-medium text-muted transition-colors hover:bg-surface/70 hover:text-ink",
              collapsed ? "justify-center" : "gap-2.5 px-2.5",
            )}
          >
            <Icon name="panel" />
            {collapsed ? null : "Collapse"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
