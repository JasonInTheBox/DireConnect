"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { getBusinessIdFromPath, isNavActive } from "@/lib/navigation";
import { supabase } from "@/lib/supabase";
import { Icon, type IconName } from "@/components/ui/icons";
import { useBusinesses } from "./businesses-provider";
import { BusinessSwitcher } from "./business-switcher";
import { useSession } from "./session-provider";

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
        <p className="truncate px-2.5 pb-1 pt-3 text-xs font-medium text-muted">{heading}</p>
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
              "h-10 lg:h-9",
              collapsed ? "justify-center" : "gap-2.5 px-2.5",
              active
                ? "bg-accent-soft font-semibold text-accent before:absolute before:inset-y-1.5 before:left-0 before:w-0.5 before:rounded-full before:bg-accent"
                : "text-ink hover:bg-sunken",
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
  const router = useRouter();
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

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      await supabase.auth.signOut({ scope: "local" });
    }
    router.replace("/login");
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={cn("space-y-3 p-3", collapsed && "px-2")}>
        {collapsed ? null : (
          <p className="px-1 text-sm font-semibold tracking-tight text-ink">DireConnect</p>
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
      </nav>

      <div className={cn("space-y-1 border-t border-line p-3", collapsed && "px-2")}>
        {collapsed ? null : (
          <p className="truncate px-2.5 pb-1 text-xs text-muted" title={user.email ?? undefined}>
            {user.email ?? "Signed in"}
          </p>
        )}
        <button
          type="button"
          onClick={handleLogout}
          aria-label={collapsed ? "Log out" : undefined}
          title={collapsed ? "Log out" : undefined}
          className={cn(
            "flex h-10 w-full items-center rounded-control text-sm font-medium text-ink transition-colors hover:bg-sunken lg:h-9",
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
              "flex h-10 w-full items-center rounded-control text-sm font-medium text-muted transition-colors hover:bg-sunken hover:text-ink lg:h-9",
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
