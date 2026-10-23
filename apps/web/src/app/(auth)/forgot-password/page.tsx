"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { buttonClasses, Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormError } from "@/components/ui/state";
import {
  isRecoverNetworkFailure,
  isRecoverNeutralFailure,
  isRecoverRateLimited,
  validateResetEmail,
} from "@/lib/account";
import { supabase } from "@/lib/supabase";

const SUBTITLE = "Enter your email and we’ll send you a link to choose a new password.";
const NETWORK_ERROR = "Could not send the email. Check your connection and try again.";

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
      // Registered and unregistered addresses must look identical. Supabase answers an unknown
      // address with a silent 200, so any failure that only happens when an email would really be
      // sent (a server or SMTP error, the email limit, the per-address cooldown) is shown exactly like
      // success (see isRecoverNeutralFailure). Only a request that never got a reply, or a rate limit
      // that says nothing about the address, is reported. An unsent email for a real account is
      // therefore invisible here: watch the Supabase auth logs and configure custom SMTP.
      if (error && !isRecoverNeutralFailure(error)) {
        if (isRecoverNetworkFailure(error)) {
          setFormError(NETWORK_ERROR);
          return;
        }
        if (isRecoverRateLimited(error)) {
          // Never the raw Supabase message.
          setFormError("Too many requests. Wait a few minutes and try again.");
          return;
        }
      }
      setSentTo(address);
    } catch (thrown) {
      // auth-js throws every HTTP 5xx; those are neutral too. Anything else never got a reply.
      if (isRecoverNeutralFailure(thrown)) {
        setSentTo(address);
      } else {
        setFormError(NETWORK_ERROR);
      }
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
