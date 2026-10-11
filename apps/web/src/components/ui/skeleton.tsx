import { cn } from "@/lib/cn";
import { SlowNotice } from "./state";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-control bg-sunken", className)} />;
}

export function PageSkeleton({ slow = false }: { slow?: boolean }) {
  return (
    <div role="status" aria-live="polite" className="mx-auto max-w-5xl space-y-4 px-4 py-8 sm:px-6">
      <span className="sr-only">Loading</span>
      <Skeleton className="h-7 w-48" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <Skeleton className="mt-6 h-40 w-full" />
      {slow ? <SlowNotice /> : null}
    </div>
  );
}
