"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icons";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  placement?: "center" | "left";
  /** Keep the title for screen readers but do not show a header. */
  hideTitle?: boolean;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  placement = "center",
  hideTitle = false,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const pointerDownOnBackdrop = useRef(false);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    if (open && !element.open) {
      element.showModal();
    } else if (!open && element.open) {
      element.close();
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  const isDrawer = placement === "left";

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      // Fires for Escape and for element.close(); only report user-initiated closes.
      onClose={() => {
        if (open) {
          onClose();
        }
      }}
      onPointerDown={(event) => {
        pointerDownOnBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        // Close only when both the press and the release landed on the backdrop itself,
        // so a drag that starts inside the content and ends outside does not dismiss.
        const startedOnBackdrop = pointerDownOnBackdrop.current;
        pointerDownOnBackdrop.current = false;
        if (startedOnBackdrop && event.target === event.currentTarget) {
          onClose();
        }
      }}
      className={cn(
        "bg-surface p-0 text-ink shadow-float backdrop:bg-black/50",
        isDrawer
          ? "drawer m-0 mr-auto h-dvh max-h-none w-72 max-w-[85vw] overflow-visible border-r border-line"
          : "m-auto w-[calc(100%-2rem)] max-w-md rounded-container border border-line",
      )}
    >
      {open ? (
        <div className={cn(isDrawer ? "flex h-full flex-col" : "p-5")}>
          {hideTitle ? (
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
          ) : (
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 id={titleId} className="text-base font-semibold">
                  {title}
                </h2>
                {description ? (
                  <p id={descriptionId} className="mt-1 text-sm text-muted">
                    {description}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="-my-2 -mr-3 flex min-h-10 min-w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-sunken hover:text-ink lg:-my-1.5 lg:-mr-2.5 lg:min-h-9 lg:min-w-9"
              >
                <Icon name="x" />
              </button>
            </div>
          )}
          {children}
        </div>
      ) : null}
    </dialog>
  );
}
