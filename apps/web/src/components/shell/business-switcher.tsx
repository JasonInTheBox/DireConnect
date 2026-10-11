"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { getBusinessIdFromPath, pathForBusinessSwitch } from "@/lib/navigation";
import { Icon } from "@/components/ui/icons";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { useBusinesses } from "./businesses-provider";
import { CreateBusinessDialog } from "./create-business-dialog";
import { Monogram } from "./monogram";

export function BusinessSwitcher({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { businesses, status } = useBusinesses();
  const [creating, setCreating] = useState(false);

  const currentId = getBusinessIdFromPath(pathname);
  const current = businesses.find((business) => business.id === currentId) ?? null;

  const title =
    current?.name ??
    (status === "loading"
      ? "Loading businesses…"
      : status === "error"
        ? "Couldn’t load businesses"
        : businesses.length > 0
          ? "Choose a business"
          : "Create your first business");

  const items: MenuItem[] = [
    ...businesses.map((business) => ({
      id: business.id,
      label: business.name,
      selected: business.id === currentId,
      icon: <Monogram name={business.name} size="sm" />,
      onSelect: () => {
        if (business.id !== currentId) {
          router.push(pathForBusinessSwitch(pathname, business.id));
          onNavigate?.();
        }
      },
    })),
    {
      id: "create-business",
      label: "Create business",
      icon: <Icon name="plus" />,
      separatorBefore: businesses.length > 0,
      onSelect: () => setCreating(true),
    },
  ];

  return (
    <>
      <Menu
        items={items}
        trigger={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            aria-label={collapsed ? (current ? `Managing ${current.name}` : title) : undefined}
            className={cn(
              "flex w-full items-center rounded-control border border-line bg-surface text-left transition-colors hover:bg-sunken",
              collapsed ? "justify-center p-1.5" : "gap-2.5 px-2.5 py-2",
            )}
          >
            <Monogram name={current?.name ?? "?"} />
            {collapsed ? null : (
              <>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted">{current ? "Managing" : "Business"}</span>
                  <span className="block truncate text-sm font-medium text-ink">{title}</span>
                </span>
                <Icon name="chevrons" className="text-muted" />
              </>
            )}
          </button>
        )}
      />
      <CreateBusinessDialog open={creating} onClose={() => setCreating(false)} />
    </>
  );
}
