import type { ReactNode } from "react";
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
  return (
    <div className="w-full max-w-md">
      {/* React hoists <title> into <head>, on the server too (WCAG 2.4.2). */}
      <title>{pageTitle(title)}</title>
      <section className="rounded-[16px] border border-line bg-surface p-8 shadow-float">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-2 text-base text-muted">{subtitle}</p> : null}
        <div className="mt-6">{children}</div>
      </section>
      {footer ? <p className="mt-4 text-center text-sm text-muted">{footer}</p> : null}
    </div>
  );
}
