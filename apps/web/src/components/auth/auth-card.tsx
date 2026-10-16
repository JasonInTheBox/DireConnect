"use client";

import { useEffect, type ReactNode } from "react";
import { pageTitle } from "@/lib/pageTitle";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  // Client pages cannot export metadata, so each page names itself (WCAG 2.4.2).
  useEffect(() => {
    document.title = pageTitle(title);
  }, [title]);

  return (
    <div className="w-full max-w-sm">
      <p className="mb-6 text-center text-sm font-semibold tracking-tight text-ink">DireConnect</p>
      <section className="rounded-container border border-line bg-surface p-6">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </section>
      {footer ? <p className="mt-4 text-center text-sm text-muted">{footer}</p> : null}
    </div>
  );
}
