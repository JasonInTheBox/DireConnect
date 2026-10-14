"use client";

import Link from "next/link";
import { CampaignStatusBadge } from "@/components/campaigns/status-badge";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { Menu, type MenuItem } from "@/components/ui/menu";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import {
  deliveryLabel,
  rowActionsFor,
  whenLabel,
  type CampaignDelivery,
} from "@/lib/campaignDisplay";
import { channelLabel } from "@/lib/campaignStatus";
import { campaignHref } from "@/lib/dashboard";
import type { Campaign } from "@/lib/types";

type Handlers = {
  onEdit: (campaign: Campaign) => void;
  onDelete: (campaign: Campaign) => void;
};

function RowActions({ campaign, onEdit, onDelete }: { campaign: Campaign } & Handlers) {
  const actions = rowActionsFor(campaign);
  if (actions.length === 0) {
    return null;
  }

  const items: MenuItem[] = actions.map((action) =>
    action === "edit"
      ? { id: "edit", label: "Edit", icon: <Icon name="edit" />, onSelect: () => onEdit(campaign) }
      : {
          id: "delete",
          label: "Delete",
          icon: <Icon name="trash" />,
          onSelect: () => onDelete(campaign),
        },
  );

  return (
    <Menu
      align="end"
      items={items}
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          aria-label={`Actions for ${campaign.title}`}
          className="flex min-h-10 min-w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-sunken hover:text-ink lg:min-h-9 lg:min-w-9"
        >
          <Icon name="more" />
        </button>
      )}
    />
  );
}

function NameCell({ businessId, campaign }: { businessId: string; campaign: Campaign }) {
  return (
    <div className="min-w-0">
      <Link
        href={campaignHref(businessId, campaign)}
        title={campaign.title}
        className="inline-flex min-h-10 max-w-full items-center font-medium text-ink hover:underline lg:min-h-9"
      >
        <span className="truncate">{campaign.title}</span>
      </Link>
      {campaign.channel === "SMS" ? (
        <p className="text-xs text-muted">SMS sending is paused</p>
      ) : null}
    </div>
  );
}

/** A table from `xl` up; stacked cards below, where six columns would be cramped. */
export function CampaignTable({
  businessId,
  campaigns,
  deliveries,
  onEdit,
  onDelete,
}: {
  businessId: string;
  campaigns: Campaign[];
  deliveries: Record<string, CampaignDelivery>;
} & Handlers) {
  return (
    <>
      <div className="hidden xl:block">
        <Table caption="Campaigns" fixed>
          <THead>
            <tr>
              <Th>Name</Th>
              <Th className="w-24">Channel</Th>
              <Th className="w-32">Status</Th>
              <Th className="w-48">When</Th>
              <Th className="w-56">Delivery</Th>
              <Th className="w-[4.5rem]">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {campaigns.map((campaign) => (
              <Tr key={campaign.id}>
                <Td className="overflow-hidden">
                  <NameCell businessId={businessId} campaign={campaign} />
                </Td>
                <Td>
                  <Badge>{channelLabel(campaign.channel)}</Badge>
                </Td>
                <Td>
                  <CampaignStatusBadge status={campaign.status} sendAt={campaign.sendAt} />
                </Td>
                <Td className="text-muted">{whenLabel(campaign)}</Td>
                <Td className="text-muted">{deliveryLabel(campaign, deliveries[campaign.id])}</Td>
                <Td className="text-right">
                  <RowActions campaign={campaign} onEdit={onEdit} onDelete={onDelete} />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      <ul className="space-y-2 xl:hidden">
        {campaigns.map((campaign) => (
          <li key={campaign.id} className="rounded-container border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-2">
                <NameCell businessId={businessId} campaign={campaign} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <CampaignStatusBadge status={campaign.status} sendAt={campaign.sendAt} />
                  <Badge>{channelLabel(campaign.channel)}</Badge>
                </div>
              </div>
              <div className="-mr-2 -mt-2">
                <RowActions campaign={campaign} onEdit={onEdit} onDelete={onDelete} />
              </div>
            </div>
            <dl className="mt-3 space-y-1 text-[13px]">
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 font-medium text-ink">When</dt>
                <dd className="text-muted">{whenLabel(campaign)}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-16 shrink-0 font-medium text-ink">Delivery</dt>
                <dd className="text-muted">{deliveryLabel(campaign, deliveries[campaign.id])}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
