"use client";

import { useState } from "react";
import { Pagination } from "@/components/ui/pagination";
import { paginate } from "@/lib/customers";

const PAGE_SIZE = 25;

export type RecipientItem = { key: string; primary: string; secondary?: string };

/** A short titled list that pages itself (a draft preview can list every customer). */
export function RecipientList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: RecipientItem[];
  emptyText: string;
}) {
  const [page, setPage] = useState(1);
  const visible = paginate(items, page, PAGE_SIZE);

  return (
    <section
      aria-label={title}
      className="rounded-container border border-line bg-surface p-5"
    >
      <h3 className="text-sm font-semibold text-ink">
        {title} <span className="font-normal text-muted">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="mt-2 text-sm text-muted">{emptyText}</p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-line">
            {visible.items.map((item) => (
              <li key={item.key} className="py-2 first:pt-0 last:pb-0">
                <p className="break-words text-sm text-ink">{item.primary}</p>
                {item.secondary ? (
                  <p className="text-[13px] text-muted">{item.secondary}</p>
                ) : null}
              </li>
            ))}
          </ul>
          <Pagination
            page={visible.page}
            pageCount={visible.pageCount}
            from={visible.from}
            to={visible.to}
            total={visible.total}
            onPageChange={setPage}
          />
        </>
      )}
    </section>
  );
}
