"use client";

import { useState, type FormEvent } from "react";
import { ApiError } from "@/lib/apiClient";
import { Button } from "./button";
import { Dialog } from "./dialog";
import { TextField } from "./field";
import { FormError } from "./state";

type ConfirmDialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  confirmLabel: string;
  /** Require this exact text to be typed before the action is enabled. */
  confirmText?: string;
  /**
   * Runs the action. Throw to keep the dialog open and show the message inline. On success,
   * fire the success toast as the last statement; the dialog closes right after it returns.
   */
  onConfirm: () => Promise<void>;
};

export function ConfirmDialog(props: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);

  return (
    <Dialog
      open={props.open}
      onClose={props.onClose}
      title={props.title}
      description={props.description}
      dismissible={!busy}
    >
      <ConfirmForm {...props} onBusyChange={setBusy} />
    </Dialog>
  );
}

function ConfirmForm({
  onClose,
  confirmLabel,
  confirmText,
  onConfirm,
  onBusyChange,
}: ConfirmDialogProps & { onBusyChange: (busy: boolean) => void }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const matches = confirmText === undefined || typed.trim() === confirmText.trim();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches || pending) {
      return;
    }

    setError(null);
    setPending(true);
    onBusyChange(true);
    try {
      await onConfirm();
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Something went wrong. Try again.",
      );
    } finally {
      setPending(false);
      onBusyChange(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      {confirmText !== undefined ? (
        <TextField
          label={`Type “${confirmText}” to confirm`}
          data-autofocus="true"
          autoComplete="off"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
        />
      ) : null}

      {error ? <FormError message={error} /> : null}

      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          onClick={onClose}
          disabled={pending}
          data-autofocus={confirmText === undefined ? "true" : undefined}
        >
          Cancel
        </Button>
        <Button type="submit" variant="danger" loading={pending} disabled={!matches}>
          {confirmLabel}
        </Button>
      </div>
    </form>
  );
}
