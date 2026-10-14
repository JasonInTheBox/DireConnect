"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * Asks for the final confirmation. It holds no error state: a refused send closes it and the
 * wizard shows the server's message in a panel on the Review step, where it stays.
 */
export function SendConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  sending,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  sending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      dismissible={!sending}
    >
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel} disabled={sending} data-autofocus="true">
          Cancel
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={sending}>
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
