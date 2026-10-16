"use client";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";

/**
 * Refresh control shared by the Results and Delivery log tabs. `refreshing` is true only for a refresh
 * the user started; background refreshes are silent.
 */
export function RefreshBar({
  refreshing,
  failed,
  earlier = "numbers",
  onRefresh,
}: {
  refreshing: boolean;
  /** A refresh failed while earlier data is still on screen. */
  failed: boolean;
  /** What stays on screen when a reload fails: "Showing the earlier numbers." or "…earlier list.". */
  earlier?: "numbers" | "list";
  onRefresh: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Button loading={refreshing} onClick={onRefresh}>
          <Icon name="clock" />
          Refresh
        </Button>
        <span role="status" aria-live="polite" className="text-[13px] text-muted">
          {refreshing ? "Refreshing…" : ""}
        </span>
      </div>
      {failed ? (
        <div
          role="alert"
          className="flex flex-wrap items-center gap-3 rounded-control border border-warning bg-warning-soft px-3 py-2 text-sm"
        >
          <span className="text-ink">Couldn’t refresh. Showing the earlier {earlier}.</span>
          <Button size="sm" onClick={onRefresh}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
