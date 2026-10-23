"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { AuthCard } from "@/components/auth/auth-card";
import { Button, buttonClasses } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { FormError } from "@/components/ui/state";
import { useToast } from "@/components/ui/toast";
import { authErrorMessage, passwordErrorTarget, validateNewPassword } from "@/lib/account";
import { clearRecoveryLink, recoveryAccessToken, supabase } from "@/lib/supabase";

type Status = "checking" | "ready" | "invalid";

/** How long to wait for supabase-js to confirm a recovery link that was in the address bar. */
const RECOVERY_SETTLE_MS = 3_000;

export default function ResetPasswordPage() {
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<Status>("checking");
  const [values, setValues] = useState({ password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A server refusal arrives after an await, so focus the field from an effect once its error is shown.
  const focusAfterRender = useRef(false);

  useEffect(() => {
    let active = true;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const giveUp = () => setStatus((current) => (current === "ready" ? current : "invalid"));

    // supabase-js reports a valid recovery link with this event, but it may already have fired.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (active && event === "PASSWORD_RECOVERY") {
        clearTimeout(settleTimer);
        setStatus("ready");
      }
    });

    // Backstop for the missed event. getSession() waits for supabase-js to finish reading the link, so
    // the saved session is the link's own when its access token matches. A rejected link never replaces
    // a session, so someone who was already signed in is not let through by it.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) {
          return;
        }
        const linkToken = recoveryAccessToken();
        if (!linkToken) {
          giveUp();
        } else if (data.session?.access_token === linkToken) {
          setStatus("ready");
        } else {
          // A link was present but not accepted (yet): give a late event a moment before giving up.
          settleTimer = setTimeout(giveUp, RECOVERY_SETTLE_MS);
        }
      })
      .catch(() => {
        if (active) {
          giveUp();
        }
      });

    return () => {
      active = false;
      clearTimeout(settleTimer);
      subscription.unsubscribe();
    };
  }, []);

  // The link's tokens have been taken over by the session; do not leave them in the address bar.
  useEffect(() => {
    if (status === "ready" && window.location.hash) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [status]);

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
    if (saving) {
      return;
    }
    setFormError(null);

    const clientErrors = validateNewPassword(values.password, values.confirm);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) {
      focusAfterRender.current = true;
      return;
    }

    setSaving(true);
    let changed = false;
    try {
      const { error } = await supabase.auth.updateUser({ password: values.password });
      if (error) {
        const text = authErrorMessage(error, "Could not change the password. Try again.");
        if (passwordErrorTarget(text) === "password") {
          focusAfterRender.current = true;
          setErrors({ password: text });
        } else {
          setFormError(text);
        }
        return;
      }

      changed = true;
      clearRecoveryLink();
      // The password is changed. Ending the other sessions is a bonus; its failure is not a failed change.
      try {
        await supabase.auth.signOut({ scope: "others" });
      } catch {
        // Ignored on purpose.
      }
      toast.success("Password changed");
      router.replace("/businesses");
    } catch {
      setFormError("Could not change the password. Check your connection and try again.");
    } finally {
      // After a successful change the button stays busy until the navigation unmounts the page.
      if (!changed) {
        setSaving(false);
      }
    }
  }

  if (status === "checking") {
    return (
      <AuthCard title="Choose a new password">
        <p role="status" className="flex items-center gap-2 text-sm text-muted">
          <Spinner />
          Checking your reset link…
        </p>
      </AuthCard>
    );
  }

  if (status === "invalid") {
    return (
      <AuthCard
        title="Choose a new password"
        footer={
          <Link href="/login" className="font-medium text-accent hover:underline">
            Back to log in
          </Link>
        }
      >
        <p className="text-sm text-ink">This reset link has expired or was already used.</p>
        <Link href="/forgot-password" className={buttonClasses({ variant: "primary", className: "mt-6 w-full" })}>
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="space-y-4">
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={(event) => setValues((previous) => ({ ...previous, password: event.target.value }))}
          error={errors.password}
        />
        <TextField
          label="Repeat new password"
          type="password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={(event) => setValues((previous) => ({ ...previous, confirm: event.target.value }))}
          error={errors.confirm}
        />

        {formError ? <FormError message={formError} /> : null}

        <Button type="submit" variant="primary" loading={saving} className="w-full">
          Change password
        </Button>
      </form>
    </AuthCard>
  );
}
