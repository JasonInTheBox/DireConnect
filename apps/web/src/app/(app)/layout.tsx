import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { BusinessesProvider } from "@/components/shell/businesses-provider";
import { SessionProvider } from "@/components/shell/session-provider";
import { ShellSkeleton } from "@/components/shell/shell-skeleton";
import { ToastProvider } from "@/components/ui/toast";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <SessionProvider fallback={<ShellSkeleton />}>
        <BusinessesProvider>
          <AppShell>{children}</AppShell>
        </BusinessesProvider>
      </SessionProvider>
    </ToastProvider>
  );
}
