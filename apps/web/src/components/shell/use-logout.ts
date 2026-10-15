"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { supabase } from "@/lib/supabase";

/** Signs out everywhere if possible, and always on this device, then returns to the login page. */
export function useLogout(): () => Promise<void> {
  const router = useRouter();

  return useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      await supabase.auth.signOut({ scope: "local" });
    }
    router.replace("/login");
  }, [router]);
}
