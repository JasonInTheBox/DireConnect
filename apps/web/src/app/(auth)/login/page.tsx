"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { FormError } from "@/components/ui/state";
import { focusFirstInvalid } from "@/lib/forms";
import { supabase } from "@/lib/supabase";
import { useApiWarmup } from "@/lib/useApiWarmup";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useApiWarmup();

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = "Enter your email address.";
    if (!password) nextErrors.password = "Enter your password.";
    setErrors(nextErrors);
    setFormError(null);

    if (Object.keys(nextErrors).length > 0) {
      focusFirstInvalid(form);
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });

    if (error) {
      setSubmitting(false);
      setFormError(error.message);
      return;
    }

    router.replace("/businesses");
  }

  return (
    <AuthCard
      title="Log in"
      subtitle="Access your DireConnect business dashboard."
      footer={
        <>
          Don’t have an account?{" "}
          <Link href="/signup" className="font-medium text-accent hover:underline">
            Sign up
          </Link>
        </>
      }
    >
      <form onSubmit={handleLogin} noValidate className="space-y-4">
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
          autoComplete="current-password"
          placeholder="Your password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />

        {formError ? <FormError message={formError} /> : null}

        <Button type="submit" variant="primary" loading={submitting} className="w-full">
          Log in
        </Button>
      </form>
    </AuthCard>
  );
}
