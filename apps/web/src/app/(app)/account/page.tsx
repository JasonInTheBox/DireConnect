"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLogout } from "@/components/shell/use-logout";
import { useSession } from "@/components/shell/session-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icons";
import { PageContainer, PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { FormError } from "@/components/ui/state";
import { setThemePreference, useThemePreference, type ThemePreference } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/toast";
import {
  authErrorMessage,
  isWrongPassword,
  passwordErrorTarget,
  validatePasswordForm,
} from "@/lib/account";
import { focusFirstInvalid } from "@/lib/forms";
import { toSessionUser } from "@/lib/session";
import { supabase } from "@/lib/supabase";

export default function AccountPage() {
  return (
    <PageContainer>
      <PageHeader
        breadcrumbs={[{ label: "Account" }]}
        title="Account"
        description="How DireConnect looks, your sign-in details and your session."
      />
      <div className="max-w-2xl space-y-4">
        <AppearancePanel />
        <SignInPanel />
        <PasswordPanel />
        <SessionPanel />
      </div>
    </PageContainer>
  );
}

const THEME_CHOICES: Array<{ value: ThemePreference; label: string; hint: string; icon: IconName }> = [
  { value: "system", label: "Match this device", hint: "Follows your computer or phone setting.", icon: "dashboard" },
  { value: "light", label: "Light", hint: "Paper and navy ink.", icon: "sun" },
  { value: "dark", label: "Dark", hint: "Navy paper, easier at night.", icon: "moon" },
];

/** Saved on this device; the theme toggle in the sidebar changes the same setting. */
function AppearancePanel() {
  const preference = useThemePreference();

  return (
    <Panel id="account-appearance-heading" title="Appearance">
      <fieldset className="mt-4">
        <legend className="text-sm text-muted">Theme, remembered on this device.</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {THEME_CHOICES.map((choice) => (
            <label
              key={choice.value}
              className="flex cursor-pointer gap-3 rounded-control border border-line-strong p-3 transition-colors hover:bg-sunken has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input
                type="radio"
                name="theme"
                value={choice.value}
                checked={preference === choice.value}
                onChange={(event) => {
                  const box = event.currentTarget.getBoundingClientRect();
                  setThemePreference(choice.value, { x: box.left + box.width / 2, y: box.top + box.height / 2 });
                }}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-accent"
              />
              <span>
                <span className="flex items-center gap-1.5 text-sm font-medium text-ink">
                  <Icon name={choice.icon} /> {choice.label}
                </span>
                <span className="mt-0.5 block text-xs text-muted">{choice.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </Panel>
  );
}

function SignInPanel() {
  const user = useSession();
  const toast = useToast();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function resend() {
    if (!user.email || resending) {
      return;
    }
    setResending(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.resend({ type: "signup", email: user.email });
      if (error) {
        setMessage(authErrorMessage(error, "Could not send the confirmation email. Try again."));
        return;
      }
      toast.success("Confirmation email sent");
    } finally {
      setResending(false);
    }
  }

  async function recheck() {
    if (checking) {
      return;
    }
    setChecking(true);
    setMessage(null);
    try {
      // A fresh session carries the current confirmation state; SessionProvider picks it up.
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session) {
        setMessage(authErrorMessage(error, "Could not check your email status. Try again."));
        return;
      }
      if (toSessionUser(data.session.user).emailConfirmed) {
        toast.success("Email confirmed");
      } else {
        setMessage("Your email isn’t confirmed yet. Open the link in the confirmation email first.");
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <Panel id="account-signin-heading" title="Sign-in">
      <dl className="mt-3 space-y-3 text-sm">
        <div>
          <dt className="text-muted">Email</dt>
          <dd className="break-words font-medium text-ink">{user.email ?? "Signed in"}</dd>
        </div>
        <div>
          <dt className="text-muted">Email status</dt>
          <dd className="mt-1">
            {user.emailConfirmed ? (
              <Badge tone="success" icon="check">
                Email confirmed
              </Badge>
            ) : (
              <Badge tone="warning" icon="alert">
                Email not confirmed
              </Badge>
            )}
          </dd>
        </div>
      </dl>

      {user.emailConfirmed ? null : (
        <div className="mt-4 space-y-3">
          <p className="max-w-prose text-sm text-muted">
            Campaigns can only be sent from accounts with a confirmed email address. Open the link
            in the confirmation email, or send it again.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={resend} loading={resending}>
              <Icon name="send" />
              Resend confirmation email
            </Button>
            <Button onClick={recheck} loading={checking}>
              I’ve confirmed it
            </Button>
          </div>
          {message ? <FormError message={message} /> : null}
        </div>
      )}
    </Panel>
  );
}

function PasswordPanel() {
  const user = useSession();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({ current: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A server refusal arrives after an await, so focus the field from an effect once its error is shown.
  const focusAfterRender = useRef(false);

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

    const clientErrors = validatePasswordForm(values);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      focusFirstInvalid(formRef.current);
      return;
    }
    setErrors({});

    setSaving(true);
    try {
      // Supabase does not check the old password when it is changed, so prove it first.
      if (!user.email) {
        setFormError(
          "We couldn’t check your current password. Log out and back in, then try again.",
        );
        return;
      }
      let verifyError: unknown = null;
      try {
        ({ error: verifyError } = await supabase.auth.signInWithPassword({
          email: user.email,
          password: values.current,
        }));
      } catch {
        setFormError("Could not check your current password. Try again.");
        return;
      }
      if (verifyError) {
        if (isWrongPassword(verifyError)) {
          focusAfterRender.current = true;
          setErrors({ current: "That isn’t your current password." });
        } else {
          setFormError(
            authErrorMessage(verifyError, "Could not check your current password. Try again."),
          );
        }
        return;
      }

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

      // The password is changed. Ending the other sessions is a bonus: if it fails, say so, but do
      // not report the change as failed. The scope keeps this device signed in.
      let othersFailed = false;
      try {
        const { error: othersError } = await supabase.auth.signOut({ scope: "others" });
        othersFailed = Boolean(othersError);
      } catch {
        othersFailed = true;
      }

      setValues({ current: "", password: "", confirm: "" });
      toast.success(
        othersFailed
          ? "Password changed. We couldn’t sign out your other devices; log out and back in there."
          : "Password changed",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel id="account-password-heading" title="Password">
      <form ref={formRef} onSubmit={handleSubmit} noValidate className="mt-3 max-w-sm space-y-4">
        <TextField
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={values.current}
          onChange={(event) => setValues((previous) => ({ ...previous, current: event.target.value }))}
          error={errors.current}
        />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          required
          value={values.password}
          onChange={(event) => setValues((previous) => ({ ...previous, password: event.target.value }))}
          error={errors.password}
        />
        <TextField
          label="Repeat new password"
          type="password"
          autoComplete="new-password"
          required
          value={values.confirm}
          onChange={(event) => setValues((previous) => ({ ...previous, confirm: event.target.value }))}
          error={errors.confirm}
        />
        {formError ? <FormError message={formError} /> : null}
        <Button type="submit" variant="primary" loading={saving}>
          Change password
        </Button>
      </form>
    </Panel>
  );
}

function SessionPanel() {
  const logout = useLogout();
  const [busy, setBusy] = useState(false);

  return (
    <Panel id="account-session-heading" title="Session">
      <p className="mt-2 max-w-prose text-sm text-muted">
        Log out of DireConnect.
      </p>
      <Button
        className="mt-4"
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await logout();
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="logout" />
        Log out
      </Button>
    </Panel>
  );
}
