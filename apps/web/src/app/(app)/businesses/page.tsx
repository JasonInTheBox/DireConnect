"use client";

import { useState } from "react";
import { BusinessCard } from "@/components/business/business-card";
import { BusinessFormDialog } from "@/components/shell/business-form-dialog";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { ListSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/apiClient";
import type { Business } from "@/lib/types";

export default function BusinessesPage() {
  const { businesses, status, error, slow, refetch } = useBusinesses();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Business | null>(null);
  const [deleting, setDeleting] = useState<Business | null>(null);

  return (
    <PageContainer>
      <PageHeader
        title="Businesses"
        description="Each business has its own customers and campaigns."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" />
            New business
          </Button>
        }
      />

      {status === "loading" ? (
        <ListSkeleton rows={4} slow={slow} />
      ) : status === "error" ? (
        <ErrorState
          title="Couldn’t load your businesses"
          message={error?.message ?? "Try again in a moment."}
          onRetry={refetch}
        />
      ) : businesses.length === 0 ? (
        <EmptyState
          title="Create your first business"
          description="Add the business you want to keep in touch with customers for. You can add more later."
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              Create business
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {businesses.map((business) => (
            <BusinessCard
              key={business.id}
              business={business}
              onEdit={() => setEditing(business)}
              onDelete={() => setDeleting(business)}
            />
          ))}
        </ul>
      )}

      <BusinessFormDialog open={creating} onClose={() => setCreating(false)} />
      <BusinessFormDialog
        open={editing !== null}
        business={editing}
        onClose={() => setEditing(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name ?? "this business"}?`}
        description="This permanently deletes the business along with its customers and campaigns. This can’t be undone."
        confirmLabel="Delete business"
        confirmText={deleting?.name}
        onConfirm={async () => {
          if (!deleting) {
            return;
          }
          await apiFetch(`/api/businesses/${deleting.id}`, { method: "DELETE" });
          refetch();
          toast.success("Business deleted");
        }}
      />
    </PageContainer>
  );
}
