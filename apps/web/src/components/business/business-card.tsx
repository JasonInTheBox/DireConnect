"use client";

import Link from "next/link";
import { Monogram } from "@/components/shell/monogram";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import type { Business } from "@/lib/types";

export function BusinessCard({
  business,
  onEdit,
  onDelete,
}: {
  business: Business;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const contact = [business.email, business.phone, business.website].filter(
    (item): item is string => Boolean(item),
  );

  return (
    <li className="flex flex-col rounded-container border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <Monogram name={business.name} />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold text-ink" title={business.name}>
            {business.name}
          </h2>
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">
            {business.description || "No description yet."}
          </p>
        </div>
        <Menu
          align="end"
          items={[
            { id: "edit", label: "Edit", icon: <Icon name="edit" />, onSelect: onEdit },
            { id: "delete", label: "Delete", icon: <Icon name="trash" />, onSelect: onDelete },
          ]}
          trigger={(triggerProps) => (
            <button
              {...triggerProps}
              type="button"
              aria-label={`Actions for ${business.name}`}
              className="-mr-2 -mt-1 flex min-h-10 min-w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-sunken hover:text-ink lg:min-h-9 lg:min-w-9"
            >
              <Icon name="more" />
            </button>
          )}
        />
      </div>

      {contact.length > 0 ? (
        <ul className="mt-4 space-y-1 text-[13px] text-muted">
          {contact.map((item) => (
            <li key={item} className="truncate">
              {item}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5">
        <Link
          href={`/businesses/${business.id}/dashboard`}
          aria-label={`Open ${business.name}`}
          className={buttonClasses({ variant: "secondary" })}
        >
          Open
        </Link>
      </div>
    </li>
  );
}
