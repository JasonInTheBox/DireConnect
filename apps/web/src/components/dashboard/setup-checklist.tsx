import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";
import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { SetupStep } from "@/lib/dashboard";

/** Shown only while a step is open. A finished step shows a check mark, an open one an empty ring. */
export function SetupChecklist({
  businessId,
  steps,
  onAddCustomer,
}: {
  businessId: string;
  steps: SetupStep[];
  onAddCustomer: () => void;
}) {
  return (
    <section
      aria-labelledby="setup-heading"
      className="mb-4 rounded-container border border-line bg-surface p-5"
    >
      <h2 id="setup-heading" className="text-base font-semibold text-ink">
        Get started
      </h2>
      <p className="mt-1 text-sm text-muted">Two steps to your first campaign.</p>

      <ol className="mt-4 divide-y divide-line">
        {steps.map((step) => (
          <li key={step.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                step.done
                  ? "border-success bg-success-soft text-success"
                  : "border-line-strong text-transparent",
              )}
            >
              <Icon name="check" className="h-3.5 w-3.5" />
            </span>

            <div className="min-w-0 flex-[1_1_12rem]">
              <p className={cn("text-sm font-medium", step.done ? "text-muted" : "text-ink")}>
                {step.title}
                {step.done ? <span className="sr-only"> (done)</span> : null}
              </p>
              {step.done ? null : <p className="text-[13px] text-muted">{step.description}</p>}
            </div>

            {step.done ? null : step.id === "customer" ? (
              <Button variant="primary" onClick={onAddCustomer}>
                Add customer
              </Button>
            ) : (
              <Link
                href={`/businesses/${businessId}/campaigns`}
                className={buttonClasses({ variant: "secondary" })}
              >
                Go to campaigns
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
