"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { ApiError } from "@/lib/apiClient";
import type { Business } from "@/lib/types";
import { useApi } from "@/lib/useApi";

type BusinessesContextValue = {
  businesses: Business[];
  status: "loading" | "ready" | "error";
  error: ApiError | null;
  slow: boolean;
  refetch: () => void;
  addBusiness: (business: Business) => void;
};

const BusinessesContext = createContext<BusinessesContextValue | null>(null);

export function BusinessesProvider({ children }: { children: ReactNode }) {
  const { data, error, slow, refetch } = useApi<Business[]>("/api/businesses");
  const [created, setCreated] = useState<Business[]>([]);

  // Once a created business shows up in a fetch, the fetched list is the source of truth.
  // Dropping it here keeps a later deletion from being masked by the stale local copy.
  useEffect(() => {
    if (!data) {
      return;
    }
    setCreated((previous) => {
      const next = previous.filter((candidate) => !data.some((business) => business.id === candidate.id));
      return next.length === previous.length ? previous : next;
    });
  }, [data]);

  const value = useMemo<BusinessesContextValue>(() => {
    const fetched = data ?? [];
    const justCreated = created.filter((candidate) => !fetched.some((business) => business.id === candidate.id));

    return {
      businesses: [...fetched, ...justCreated],
      status: data !== null ? "ready" : error ? "error" : "loading",
      error,
      slow,
      refetch,
      addBusiness: (business) => {
        setCreated((previous) => [...previous, business]);
        refetch();
      },
    };
  }, [data, error, slow, refetch, created]);

  return <BusinessesContext.Provider value={value}>{children}</BusinessesContext.Provider>;
}

export function useBusinesses(): BusinessesContextValue {
  const value = useContext(BusinessesContext);
  if (!value) {
    throw new Error("useBusinesses must be used inside BusinessesProvider");
  }
  return value;
}
