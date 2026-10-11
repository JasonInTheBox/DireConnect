import type { ReactNode } from "react";
import { Button } from "./button";
import { Icon, type IconName } from "./icons";

export function SlowNotice() {
  return (
    <p className="text-sm text-muted">
      Waking up the server. The first load after a quiet period can take up to a minute.
    </p>
  );
}

export function EmptyState({
  icon = "building",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-container bg-accent-soft text-accent">
        <Icon name={icon} className="h-5 w-5" />
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div role="alert" className="mx-auto flex max-w-md flex-col items-center px-4 py-16 text-center">
      <span className="mb-4 flex h-10 w-10 items-center justify-center rounded-container bg-danger-soft text-danger">
        <Icon name="alert" className="h-5 w-5" />
      </span>
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      <p className="mt-1 text-sm text-muted">{message}</p>
      {onRetry ? (
        <Button className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-control border border-danger bg-danger-soft px-3 py-2 text-sm text-danger">
      {message}
    </p>
  );
}
