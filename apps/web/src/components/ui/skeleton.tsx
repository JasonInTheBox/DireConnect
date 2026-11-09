import { cn } from "@/lib/cn";
import { SlowNotice } from "./state";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-control bg-sunken", className)} />;
}

/**
 * A page while it loads, laid out like a real one: the same centred container as PageContainer,
 * a page header (breadcrumbs, title, description, an action) and rows where the content goes.
 */
export function PageSkeleton({ slow = false }: { slow?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      <span className="sr-only">Loading</span>
      <div className="mb-6 space-y-3">
        <Skeleton className="h-4 w-48" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2.5">
            <Skeleton className="h-8 w-52 sm:h-9" />
            <Skeleton className="h-5 w-96 max-w-full" />
          </div>
          <Skeleton className="hidden h-10 w-36 sm:block" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
      {slow ? <div className="mt-4"><SlowNotice /></div> : null}
    </div>
  );
}

export function ListSkeleton({ rows = 6, slow = false }: { rows?: number; slow?: boolean }) {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-14 w-full" />
      ))}
      {slow ? <SlowNotice /> : null}
    </div>
  );
}
