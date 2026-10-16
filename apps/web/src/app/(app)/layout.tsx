import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { BusinessesProvider } from "@/components/shell/businesses-provider";
import { SessionProvider } from "@/components/shell/session-provider";
import { ShellSkeleton } from "@/components/shell/shell-skeleton";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionProvider fallback={<ShellSkeleton />}>
      <BusinessesProvider>
        <AppShell>{children}</AppShell>
      </BusinessesProvider>
    </SessionProvider>
  );
}
