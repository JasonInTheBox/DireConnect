"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { buttonClasses } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";

export default function BusinessLayout({ children }: { children: ReactNode }) {
  const { businessId } = useParams<{ businessId: string }>();
  const { businesses, status, error, slow, refetch } = useBusinesses();

  if (status === "loading") {
    return <PageSkeleton slow={slow} />;
  }

  if (status === "error") {
    return (
      <ErrorState
        title="Couldn’t load your businesses"
        message={error?.message ?? "Try again in a moment."}
        onRetry={refetch}
      />
    );
  }

  if (!businesses.some((business) => business.id === businessId)) {
    return (
      <EmptyState
        title="Business not found"
        description="This business doesn’t exist or isn’t part of your account."
        action={
          <Link href="/businesses" className={buttonClasses({ variant: "primary" })}>
            Back to businesses
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}
