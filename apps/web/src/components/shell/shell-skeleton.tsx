import { pageTitle } from "@/lib/pageTitle";
import { PageSkeleton, Skeleton } from "@/components/ui/skeleton";

/**
 * Shown while the session is being confirmed, so the page does not flash. Mirrors AppShell: the
 * sidebar at its real width (collapsed when <html data-sidebar="collapsed">, set before paint),
 * the phone top bar, and the page skeleton in the same centred container as a real page.
 */
export function ShellSkeleton() {
  return (
    <div className="min-h-screen lg:flex">
      <title>{pageTitle("")}</title>
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-line bg-sunken p-3 lg:flex [[data-sidebar=collapsed]_&]:w-16 [[data-sidebar=collapsed]_&]:px-2">
        <div className="flex items-center justify-between gap-2 pt-1">
          <Skeleton className="h-8 w-32 bg-line [[data-sidebar=collapsed]_&]:hidden" />
          <Skeleton className="h-8 w-8 shrink-0 bg-line [[data-sidebar=collapsed]_&]:mx-auto" />
        </div>
        <Skeleton className="mt-3 h-14 w-full bg-line" />
        <div className="mt-6 space-y-2">
          <Skeleton className="h-10 w-full bg-line" />
          <Skeleton className="h-10 w-full bg-line" />
          <Skeleton className="h-10 w-full bg-line" />
        </div>
        <div className="mt-auto space-y-2 border-t border-line pt-3">
          <Skeleton className="h-14 w-full bg-line [[data-sidebar=collapsed]_&]:hidden" />
          <Skeleton className="h-10 w-full bg-line" />
          <Skeleton className="h-10 w-full bg-line" />
        </div>
      </aside>
      <div className="min-w-0 flex-1">
        <div className="flex h-14 items-center gap-2 border-b border-line bg-surface/90 px-3 lg:hidden">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-6 w-32" />
        </div>
        <PageSkeleton />
      </div>
    </div>
  );
}
