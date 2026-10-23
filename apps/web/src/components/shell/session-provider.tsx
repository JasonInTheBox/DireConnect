"use client";

import { createContext, Fragment, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { toSessionUser, type SessionUser } from "@/lib/session";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback: ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setUser(toSessionUser(data.session.user));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }
      if (!session) {
        setUser(null);
        router.replace("/login");
        return;
      }
      setUser(toSessionUser(session.user));
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (!user) {
    return <>{fallback}</>;
  }

  return (
    <SessionContext.Provider value={user}>
      <Fragment key={user.id}>{children}</Fragment>
    </SessionContext.Provider>
  );
}

export function useSession(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) {
    throw new Error("useSession must be used inside SessionProvider");
  }
  return user;
}
