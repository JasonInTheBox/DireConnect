"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useBusinesses } from "@/components/shell/businesses-provider";
import { buttonClasses } from "@/components/ui/button";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { pageTitle } from "@/lib/pageTitle";

export default function BusinessLayout({ children }: { children: ReactNode }) {
  const { businessId } = useParams<{ businessId: string }>();
  const { businesses, status, error, slow, refetch } = useBusinesses();

  // These states render no page header, so they name the page themselves (WCAG 2.4.2).
  if (status === "loading") {
    return (
      <>
        <title>{pageTitle("")}</title>
        <PageSkeleton slow={slow} />
      </>
    );
  }

  if (status === "error") {
    return (
      <>
        <title>{pageTitle("")}</title>
        <ErrorState
          title="Couldn’t load your businesses"
          message={error?.message ?? "Try again in a moment."}
          onRetry={refetch}
        />
      </>
    );
  }

  if (!businesses.some((business) => business.id === businessId)) {
    return (
      <>
        <title>{pageTitle("Business not found")}</title>
        <EmptyState
          title="Business not found"
          description="This business doesn’t exist or isn’t part of your account."
          action={
            <Link href="/businesses" className={buttonClasses({ variant: "primary" })}>
              Back to businesses
            </Link>
          }
        />
      </>
    );
  }

  return <>{children}</>;
}
