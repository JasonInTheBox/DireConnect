"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SlowNotice } from "@/components/ui/state";
import { SLOW_RESPONSE_MS } from "@/lib/useApi";

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
  const [slow, setSlow] = useState(false);

  // A cold server can take a minute; explain the wait once it passes the usual response time.
  useEffect(() => {
    if (!sending) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), SLOW_RESPONSE_MS);
    return () => clearTimeout(timer);
  }, [sending]);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      description={description}
      dismissible={!sending}
    >
      <div aria-live="polite" className="mb-3 empty:hidden">
        {sending && slow ? <SlowNotice /> : null}
      </div>
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
