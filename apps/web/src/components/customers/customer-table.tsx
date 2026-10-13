"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icons";
import { Menu } from "@/components/ui/menu";
import { Table, TBody, Td, Th, THead, Tr } from "@/components/ui/table";
import { emailConsentOf, fullName } from "@/lib/customers";
import type { Customer } from "@/lib/types";

type Handlers = {
  onEdit: (customer: Customer) => void;
  onDelete: (customer: Customer) => void;
};

function Missing({ label }: { label: string }) {
  return (
    <span className="text-muted">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

function ConsentBadges({ customer }: { customer: Customer }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {emailConsentOf(customer) === "opted-in" ? (
        <Badge tone="success" icon="check">
          Email opted in
        </Badge>
      ) : (
        <Badge icon="minus">Email not opted in</Badge>
      )}
      {customer.smsOptIn ? <Badge icon="check">SMS opted in</Badge> : null}
    </span>
  );
}

function RowActions({ customer, onEdit, onDelete }: { customer: Customer } & Handlers) {
  const name = fullName(customer);

  return (
    <Menu
      align="end"
      items={[
        { id: "edit", label: "Edit", icon: <Icon name="edit" />, onSelect: () => onEdit(customer) },
        {
          id: "delete",
          label: "Delete",
          icon: <Icon name="trash" />,
          onSelect: () => onDelete(customer),
        },
      ]}
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          aria-label={`Actions for ${name}`}
          className="flex min-h-10 min-w-10 items-center justify-center rounded-control text-muted transition-colors hover:bg-sunken hover:text-ink lg:min-h-9 lg:min-w-9"
        >
          <Icon name="more" />
        </button>
      )}
    />
  );
}

function Truncated({ children }: { children: ReactNode }) {
  return <div className="max-w-[16rem] truncate">{children}</div>;
}

/** A table from `lg` up; stacked cards below, where a table would be cramped. */
export function CustomerTable({
  customers,
  onEdit,
  onDelete,
}: { customers: Customer[] } & Handlers) {
  return (
    <>
      <div className="hidden lg:block">
        <Table caption="Customers">
          <THead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Phone</Th>
              <Th>Consent</Th>
              <Th className="w-14">
                <span className="sr-only">Actions</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {customers.map((customer) => (
              <Tr key={customer.id}>
                <Td className="font-medium text-ink">
                  <Truncated>{fullName(customer)}</Truncated>
                </Td>
                <Td>
                  <Truncated>{customer.email || <Missing label="No email" />}</Truncated>
                </Td>
                <Td>
                  <Truncated>{customer.phone || <Missing label="No phone" />}</Truncated>
                </Td>
                <Td>
                  <ConsentBadges customer={customer} />
                </Td>
                <Td className="text-right">
                  <RowActions customer={customer} onEdit={onEdit} onDelete={onDelete} />
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </div>

      <ul className="space-y-2 lg:hidden">
        {customers.map((customer) => (
          <li key={customer.id} className="rounded-container border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-2">
                <p className="truncate text-sm font-medium text-ink">{fullName(customer)}</p>
                <ConsentBadges customer={customer} />
              </div>
              <div className="-mr-2 -mt-2">
                <RowActions customer={customer} onEdit={onEdit} onDelete={onDelete} />
              </div>
            </div>
            <dl className="mt-3 space-y-1 text-[13px] text-muted">
              <div className="flex gap-2">
                <dt className="sr-only">Email</dt>
                <dd className="truncate">{customer.email || <Missing label="No email" />}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="sr-only">Phone</dt>
                <dd className="truncate">{customer.phone || <Missing label="No phone" />}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}
