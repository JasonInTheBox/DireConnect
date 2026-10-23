import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type FieldMeta = {
  label: string;
  hint?: string;
  error?: string | undefined;
};

const CONTROL =
  "block w-full rounded-control border bg-surface px-3 text-sm text-ink placeholder:text-muted transition-colors duration-150";

function describedBy(id: string, hint?: string, error?: string) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldMeta & { id: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-[13px] font-medium text-ink">
        {label}
        {required ? (
          <span aria-hidden="true" className="text-muted">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: FieldMeta & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error} required={props.required}>
      <input
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(CONTROL, "h-10 lg:h-9", error ? "border-danger" : "border-line-strong", className)}
        {...props}
      />
    </FieldFrame>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: FieldMeta & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;

  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error} required={props.required}>
      <textarea
        id={fieldId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={cn(CONTROL, "min-h-24 resize-y py-2", error ? "border-danger" : "border-line-strong", className)}
        {...props}
      />
    </FieldFrame>
  );
}
