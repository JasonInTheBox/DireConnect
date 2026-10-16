"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { pageTitle } from "@/lib/pageTitle";
import { Icon } from "./icons";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
        {items.map((item, index) => (
          <li key={`${index}-${item.label}`} className="flex min-w-0 items-center gap-1">
            {index > 0 ? <Icon name="chevronRight" className="h-3 w-3" /> : null}
            {item.href ? (
              <Link href={item.href} className="truncate hover:text-ink hover:underline">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="truncate text-ink">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The page's single <h1>, with optional breadcrumbs above and primary actions on the right. */
export function PageHeader({
  title,
  description,
  breadcrumbs,
  actions,
}: {
  title: string;
  description?: string;
  breadcrumbs?: Crumb[];
  actions?: ReactNode;
}) {
  // Client pages cannot export metadata, so each page names itself (WCAG 2.4.2).
  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);

  return (
    <header className="mb-6 space-y-3">
      {breadcrumbs ? <Breadcrumbs items={breadcrumbs} /> : null}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1
            id="page-title"
            tabIndex={-1}
            className="break-words text-xl font-semibold tracking-tight text-ink [overflow-wrap:anywhere] focus:outline-none"
          >{title}</h1>
          {description ? <p className="mt-1 max-w-prose text-sm text-muted">{description}</p> : null}
        </div>
        {actions ? <div className="flex max-w-full flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}

export function PageContainer({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">{children}</div>;
}
