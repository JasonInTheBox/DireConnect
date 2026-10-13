"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomerTable } from "@/components/customers/customer-table";
import { CustomersToolbar } from "@/components/customers/customers-toolbar";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Pagination } from "@/components/ui/pagination";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/apiClient";
import {
  customerCountLabel,
  filterCustomers,
  fullName,
  paginate,
  type ConsentFilter,
} from "@/lib/customers";
import type { Customer } from "@/lib/types";
import { useApi } from "@/lib/useApi";

export default function CustomersPage() {
  const { businessId } = useParams<{ businessId: string }>();
  // Keyed so search, filter, page and open dialogs reset when the business changes.
  return <CustomersView key={businessId} businessId={businessId} />;
}

function CustomersView({ businessId }: { businessId: string }) {
  const { businesses } = useBusinesses();
  const toast = useToast();
  const businessName = businesses.find((business) => business.id === businessId)?.name ?? "Business";
  const { data, error, slow, refetch } = useApi<Customer[]>(
    `/api/businesses/${businessId}/customers`,
  );

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ConsentFilter>("all");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);

  const customers = data ?? [];
  const filtered = filterCustomers(customers, query, filter);
  const visible = paginate(filtered, page);

  function changeQuery(next: string) {
    setQuery(next);
    setPage(1);
  }

  function changeFilter(next: ConsentFilter) {
    setFilter(next);
    setPage(1);
  }

  function clearFilters() {
    setQuery("");
    setFilter("all");
    setPage(1);
  }

  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[
          { label: "Businesses", href: "/businesses" },
          { label: businessName, href: `/businesses/${businessId}/dashboard` },
          { label: "Customers" },
        ]}
        title="Customers"
        description="The people you keep in touch with. Only customers who agreed to receive emails are included in campaigns."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            Add customer
          </Button>
        }
      />

      {data === null && error === null ? (
        <ListSkeleton slow={slow} />
      ) : data === null && error ? (
        <ErrorState title="Couldn’t load customers" message={error.message} onRetry={refetch} />
      ) : customers.length === 0 ? (
        <EmptyState
          icon="users"
          title="No customers yet"
          description="Add the people you want to keep in touch with. Only customers who agreed to receive emails will get your campaigns."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Add your first customer
            </Button>
          }
        />
      ) : (
        <>
          <CustomersToolbar
            query={query}
            onQueryChange={changeQuery}
            filter={filter}
            onFilterChange={changeFilter}
            countLabel={customerCountLabel(filtered.length, customers.length)}
          />
          {filtered.length === 0 ? (
            <EmptyState
              icon="search"
              title="No customers match your search"
              description="Try a different name, email or phone number."
              action={<Button onClick={clearFilters}>Clear filters</Button>}
            />
          ) : (
            <>
              <CustomerTable customers={visible.items} onEdit={setEditing} onDelete={setDeleting} />
              <Pagination
                page={visible.page}
                pageCount={visible.pageCount}
                from={visible.from}
                to={visible.to}
                total={visible.total}
                onPageChange={setPage}
              />
            </>
          )}
        </>
      )}

      <CustomerFormDialog
        open={creating}
        onClose={() => setCreating(false)}
        businessId={businessId}
        onSaved={refetch}
      />
      <CustomerFormDialog
        open={editing !== null}
        customer={editing}
        onClose={() => setEditing(null)}
        businessId={businessId}
        onSaved={refetch}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting ? fullName(deleting) : "this customer"}?`}
        description="This removes the customer from this business. This can’t be undone."
        confirmLabel="Delete customer"
        onConfirm={async () => {
          if (!deleting) {
            return;
          }
          await apiFetch(`/api/businesses/${businessId}/customers/${deleting.id}`, {
            method: "DELETE",
          });
          refetch();
          toast.success("Customer deleted");
        }}
      />
    </PageContainer>
  );
}
