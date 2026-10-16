import { pageTitle } from "@/lib/pageTitle";
import { Skeleton } from "@/components/ui/skeleton";

/** Shown while the session is being confirmed, so the page does not flash. */
export function ShellSkeleton() {
  return (
    <div role="status" className="min-h-screen lg:flex">
      <title>{pageTitle("")}</title>
      <span className="sr-only">Loading</span>
      <aside className="hidden h-screen w-64 shrink-0 space-y-3 border-r border-line bg-surface p-3 lg:block">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </aside>
      <div className="flex-1 space-y-4 px-4 py-8 sm:px-6">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-40 w-full max-w-3xl" />
      </div>
    </div>
  );
}
