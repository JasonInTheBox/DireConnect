import { Icon, type IconName } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import { deliverySegments, successRateLabel, type DeliverySegment } from "@/lib/dashboard";
import type { DashboardSummary } from "@/lib/types";
import { Panel } from "./panel";

// Status colours are reserved for status; each state also has an icon and a word in the legend.
const STYLE: Record<DeliverySegment["key"], { fill: string; icon: IconName; iconColor: string }> = {
  sent: { fill: "bg-success", icon: "check", iconColor: "text-success" },
  failed: { fill: "bg-danger", icon: "alert", iconColor: "text-danger" },
  pending: { fill: "bg-warning", icon: "clock", iconColor: "text-warning" },
};

export function DeliveryPanel({ messages }: { messages: DashboardSummary["messages"] }) {
  const segments = deliverySegments(messages);
  const drawn = segments.filter((segment) => segment.count > 0);
  const rate = successRateLabel(messages.successRate);

  return (
    <Panel id="delivery-heading" title="Delivery">
      {segments.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          No messages sent yet. Results appear here after your first campaign goes out.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={`Messages: ${segments
              .map((segment) => `${segment.count} ${segment.label.toLowerCase()}`)
              .join(", ")}`}
            className="mt-4 flex h-3 gap-0.5"
          >
            {drawn.map((segment, index) => (
              <div
                key={segment.key}
                title={`${segment.label}: ${segment.count} (${Math.round(segment.percent)}%)`}
                className={cn(
                  "min-w-1",
                  STYLE[segment.key].fill,
                  index === 0 && "rounded-l-[4px]",
                  index === drawn.length - 1 && "rounded-r-[4px]",
                )}
                style={{ flexGrow: segment.count, flexBasis: 0 }}
              />
            ))}
          </div>

          <dl className="mt-4 grid gap-2 sm:grid-cols-3">
            {segments.map((segment) => (
              <div key={segment.key} className="flex items-center gap-2 text-sm">
                <span
                  aria-hidden="true"
                  className={cn("h-2.5 w-2.5 shrink-0 rounded-[3px]", STYLE[segment.key].fill)}
                />
                <dt className="flex items-center gap-1 font-medium text-ink">
                  <Icon name={STYLE[segment.key].icon} className={STYLE[segment.key].iconColor} />
                  {segment.label}
                </dt>
                <dd className="ml-auto text-ink sm:ml-0">
                  <span className="font-semibold">{segment.count}</span>{" "}
                  <span className="text-muted">({Math.round(segment.percent)}%)</span>
                </dd>
              </div>
            ))}
          </dl>

          {rate ? <p className="mt-4 text-sm text-muted">{rate}</p> : null}
        </>
      )}
    </Panel>
  );
}
