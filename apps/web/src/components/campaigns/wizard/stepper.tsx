import { Icon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";

/** Which step the user is on, and which are done. State is shown with a number, a check and text. */
export function WizardStepper({
  steps,
  currentIndex,
}: {
  steps: ReadonlyArray<{ id: string; label: string }>;
  currentIndex: number;
}) {
  return (
    <ol aria-label="Campaign steps" className="flex flex-wrap gap-x-6 gap-y-2">
      {steps.map((step, index) => {
        const state = index < currentIndex ? "done" : index === currentIndex ? "current" : "todo";

        return (
          <li
            key={step.id}
            aria-current={state === "current" ? "step" : undefined}
            className="flex items-center gap-2 text-[13px]"
          >
            <span
              aria-hidden="true"
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border text-xs font-medium",
                state === "done" && "border-success bg-success-soft text-success",
                state === "current" && "border-accent bg-accent text-accent-ink",
                state === "todo" && "border-line-strong text-muted",
              )}
            >
              {state === "done" ? <Icon name="check" className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={cn(state === "current" ? "font-medium text-ink" : "text-muted")}>
              {step.label}
              {state === "done" ? <span className="sr-only"> (completed)</span> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
