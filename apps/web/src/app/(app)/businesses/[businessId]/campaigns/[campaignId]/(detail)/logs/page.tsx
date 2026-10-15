"use client";

import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { logStatusMeta, sendLimitNotes } from "@/lib/campaignDetail";
import { pluralize } from "@/lib/format";
import { formatDateTime } from "@/lib/schedule";
import type { MessageLog } from "@/lib/types";
import { useApi } from "@/lib/useApi";

function LogStatus({ status }: { status: MessageLog["status"] }) {
  const meta = logStatusMeta(status);
  return (
    <Badge tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}

function sentAtLabel(log: MessageLog): string {
  return log.sentAt ? formatDateTime(log.sentAt) : "Not sent";
}

export default function CampaignDeliveryLogPage() {
  const { businessId, campaignId } = useParams<{ businessId: string; campaignId: string }>();
  const { data, error, slow, refetch } = useApi<MessageLog[]>(
    `/api/businesses/${businessId}/campaigns/${campaignId}/logs`,
  );

  if (data === null && error === null) {
    return <ListSkeleton rows={3} slow={slow} />;
  }
  if (data === null && error) {
    return <ErrorState title="Couldn’t load the delivery log" message={error.message} onRetry={refetch} />;
  }
  if (!data) {
    return null;
  }

  const failed = data.filter((log) => log.status === "FAILED").length;

  return (
    <div className="space-y-4">
      <Panel id="log-limits-heading" title="Why a message can fail">
        <p className="mt-2 text-sm text-muted">
          Each failed message below explains what went wrong. Daily sending limits are a common
          reason:
        </p>
        <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-muted">
          {sendLimitNotes().map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </Panel>

      {data.length === 0 ? (
        <EmptyState
          icon="send"
          title="No messages yet"
          description="Messages appear here once the campaign starts sending."
        />
      ) : (
        <>
          <p className="text-sm text-muted">
            {pluralize(data.length, "message")}
            {failed > 0 ? `, ${failed} failed` : ""}
          </p>

          <div className="hidden lg:block">
            <Table caption="Delivery log" fixed>
              <THead>
                <tr>
                  <Th className="w-[30%]">Recipient</Th>
                  <Th className="w-32">Status</Th>
                  <Th className="w-48">Sent</Th>
                  <Th>Details</Th>
                </tr>
              </THead>
              <TBody>
                {data.map((log) => (
                  <Tr key={log.id}>
                    <Td className="overflow-hidden">
                      <div className="truncate font-medium text-ink" title={log.recipient}>
                        {log.recipient}
                      </div>
                    </Td>
                    <Td>
                      <LogStatus status={log.status} />
                    </Td>
                    <Td className="text-muted">{sentAtLabel(log)}</Td>
                    <Td className="break-words text-muted">{log.errorMessage || "—"}</Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          </div>

          <ul className="space-y-2 lg:hidden" aria-label="Delivery log">
            {data.map((log) => (
              <li key={log.id} className="rounded-container border border-line bg-surface p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 break-words text-sm font-medium text-ink">{log.recipient}</p>
                  <LogStatus status={log.status} />
                </div>
                <p className="mt-1 text-[13px] text-muted">{sentAtLabel(log)}</p>
                {log.errorMessage ? (
                  <p className="mt-1 break-words text-[13px] text-ink">{log.errorMessage}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
