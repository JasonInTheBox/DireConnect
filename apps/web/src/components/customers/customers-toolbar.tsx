"use client";

import { useId } from "react";
import { Icon } from "@/components/ui/icons";
import { Select } from "@/components/ui/select";
import type { ConsentFilter } from "@/lib/customers";

const FILTER_OPTIONS: Array<{ value: ConsentFilter; label: string }> = [
  { value: "all", label: "All customers" },
  { value: "opted-in", label: "Opted in to email" },
  { value: "not-opted-in", label: "Not opted in" },
];

export function CustomersToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  countLabel,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  filter: ConsentFilter;
  onFilterChange: (filter: ConsentFilter) => void;
  countLabel: string;
}) {
  const searchId = useId();

  return (
    <div className="mb-4 space-y-2">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            Search customers
          </label>
          <Icon
            name="search"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Search by name, email or phone"
            className="block h-10 w-full rounded-control border border-line-strong bg-surface pl-9 pr-3 text-sm text-ink placeholder:text-muted lg:h-9"
          />
        </div>
        <div className="sm:w-56">
          <Select
            label="Filter by consent"
            hideLabel
            value={filter}
            onChange={(event) => onFilterChange(event.target.value as ConsentFilter)}
            options={FILTER_OPTIONS}
          />
        </div>
      </div>
      <p aria-live="polite" className="text-[13px] text-muted">
        {countLabel}
      </p>
    </div>
  );
}
