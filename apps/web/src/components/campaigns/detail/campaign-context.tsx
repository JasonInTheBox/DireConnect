"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Campaign } from "@/lib/types";

type CampaignContextValue = {
  campaign: Campaign;
  refetch: () => void;
  /** The campaign list is being reloaded while the earlier details stay on screen. */
  refreshing: boolean;
  /** The last reload of the campaign list failed; the earlier details are still shown. */
  refreshError: boolean;
};

const CampaignContext = createContext<CampaignContextValue | null>(null);

export function CampaignProvider({
  campaign,
  refetch,
  refreshing,
  refreshError,
  children,
}: CampaignContextValue & { children: ReactNode }) {
  return (
    <CampaignContext.Provider value={{ campaign, refetch, refreshing, refreshError }}>
      {children}
    </CampaignContext.Provider>
  );
}

/** The campaign the detail layout loaded, plus a way to reload it (for example after delivery progresses). */
export function useCampaign(): CampaignContextValue {
  const value = useContext(CampaignContext);
  if (!value) {
    throw new Error("useCampaign must be used inside the campaign detail layout");
  }
  return value;
}
