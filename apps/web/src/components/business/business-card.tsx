"use client";

import Link from "next/link";
import { Monogram } from "@/components/shell/monogram";
import { buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
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

      {/* Pinned to the bottom so every card in a row lines its buttons up. */}
      <div className="mt-auto flex items-center gap-2 pt-5">
        <Link
          href={`/businesses/${business.id}/dashboard`}
          aria-label={`Open ${business.name}`}
          className={buttonClasses({ variant: "primary" })}
        >
          Open
        </Link>
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${business.name}`}
          className={buttonClasses({ variant: "secondary" })}
        >
          <Icon name="edit" /> Edit
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Delete ${business.name}`}
          title="Delete"
          className={buttonClasses({ variant: "ghost", className: "ml-auto w-10 px-0 text-muted hover:text-danger" })}
        >
          <Icon name="trash" />
        </button>
      </div>
    </li>
  );
}
