import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-control font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-sunken",
  ghost: "text-ink hover:bg-sunken",
  danger: "bg-danger text-canvas hover:opacity-90",
};

const SIZES: Record<Size, string> = {
  md: "h-10 px-3.5 text-sm lg:h-9",
  sm: "h-10 px-3 text-[13px] lg:h-9",
};

/** Use on a `<Link>` that should look like a button. */
export function buttonClasses({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: Variant; size?: Size; className?: string } = {}): string {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
};

export function Button({
  variant,
  size,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled}
      // `aria-disabled` instead of `disabled` while loading keeps keyboard focus on the button.
      aria-disabled={loading || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (loading) {
          // Blocks the click, a form submit from this button and implicit submission via Enter.
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
      className={buttonClasses({ variant, size, className: cn(loading && "opacity-50 aria-disabled:cursor-default", className) })}
      {...rest}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
