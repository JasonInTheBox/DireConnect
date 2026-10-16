"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { buttonClasses, Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormError } from "@/components/ui/state";
import { validateResetEmail } from "@/lib/account";
import { supabase } from "@/lib/supabase";

const SUBTITLE = "Enter your email and we’ll send you a link to choose a new password.";
const NETWORK_ERROR = "Could not send the email. Check your connection and try again.";

/** A rate limit is the one refusal worth reporting; it says nothing about whether an account exists. */
function isRateLimit(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { status?: unknown }).status === 429;
}

function isNetworkFailure(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AuthRetryableFetchError";
}

export default function ForgotPasswordPage() {
  const formRef = useRef<HTMLFormElement>(null);
  const [email, setEmail] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const focusAfterRender = useRef(false);

  // Focus the invalid field from an effect, once React has rendered its error.
  useEffect(() => {
    if (!focusAfterRender.current) {
      return;
    }
    const invalid = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (invalid) {
      focusAfterRender.current = false;
      invalid.focus();
    }
  }, [errors]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) {
      return;
    }
    setFormError(null);

    const nextErrors = validateResetEmail(email);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      focusAfterRender.current = true;
      return;
    }

    const address = email.trim();
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (isRateLimit(error)) {
        setFormError(error instanceof Error && error.message ? error.message : "Too many requests. Wait a few minutes and try again.");
        return;
      }
      if (isNetworkFailure(error)) {
        setFormError(NETWORK_ERROR);
        return;
      }
      // Any other answer, including "no such account", looks the same: never reveal who has an account.
      setSentTo(address);
    } catch {
      setFormError(NETWORK_ERROR);
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <AuthCard title="Reset your password">
        <p role="status" className="text-sm text-ink">
          If an account exists for <span className="font-medium break-words">{sentTo}</span>, a reset link is on its way. Check your inbox and spam folder.
        </p>
        <Link href="/login" className={buttonClasses({ className: "mt-6 w-full" })}>
          Back to log in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      subtitle={SUBTITLE}
      footer={
        <Link href="/login" className="font-medium text-accent hover:underline">
          Back to log in
        </Link>
      }
    >
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />

        {formError ? <FormError message={formError} /> : null}

        <Button type="submit" variant="primary" loading={submitting} className="w-full">
          Send reset link
        </Button>
      </form>
    </AuthCard>
  );
}
