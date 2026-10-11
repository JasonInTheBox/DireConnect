"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button, buttonClasses } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormError } from "@/components/ui/state";
import { focusFirstInvalid } from "@/lib/forms";
import { supabase } from "@/lib/supabase";
import { useApiWarmup } from "@/lib/useApiWarmup";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [checkInbox, setCheckInbox] = useState(false);

  useApiWarmup();

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    if (!password) nextErrors.password = "Choose a password.";
    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(form);
      return;
    }

    setSubmitting(true);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
    setSubmitting(false);

    if (error) {
      setFormError(error.message);
      return;
    }

    // With email confirmation off, Supabase signs the user in straight away.
    if (data.session) {
      router.replace("/businesses");
      return;
    }

    setCheckInbox(true);
  }

  if (checkInbox) {
    return (
      <AuthCard
        title="Check your inbox"
        subtitle={`We sent a confirmation link to ${email.trim()}. Confirm your email before sending campaigns.`}
      >
        <Link href="/login" className={buttonClasses({ variant: "primary", className: "w-full" })}>
          Go to log in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create account"
      subtitle="Start managing your businesses and customer promotions."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSignup} noValidate className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <TextField
          label="Password"
          type="password"
          autoComplete="new-password"
          placeholder="Choose a password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />

        {formError ? <FormError message={formError} /> : null}

        <Button type="submit" variant="primary" loading={submitting} className="w-full">
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
