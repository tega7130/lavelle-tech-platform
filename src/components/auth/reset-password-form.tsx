"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { setStaffPassword } from "@/app/actions/staff-auth";
import { emptyActionState } from "@/lib/action-state";
import { STAFF_PASSWORD_RULES } from "@/lib/validation/staff";
import { AuthSplitScreen } from "@/components/auth/auth-split-screen";
import { Button } from "@/components/ui/button";
import { Label, FieldError } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import type { InvitationTokenPreview } from "@/lib/staff-invitation";

const STRENGTHS = ["Too weak", "Weak", "Fair", "Good", "Strong"];
const METER_COLORS = ["#e0e4ea", "#b42318", "#a16207", "#1668e3", "#15803d"];

/** Minute-aware, unlike set-password-form's hours-only expiryLabel — a
 * password-reset token's TTL (30 minutes) would round up to a misleading
 * "1 hour" under that function. */
function expiryLabel(expiresAt: Date) {
  const minutes = Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 60_000));
  if (minutes < 60) return `in about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

export function ResetPasswordForm({ token, preview }: { token: string; preview: InvitationTokenPreview | null }) {
  const [state, formAction, pending] = useActionState(setStaffPassword, emptyActionState);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const metCount = STAFF_PASSWORD_RULES.filter((r) => r.test(password)).length;
  const confirmError = confirmPassword.length > 0 && confirmPassword !== password ? "Passwords do not match" : state.errors?.confirmPassword;

  // Success — deliberately does NOT auto-sign the admin in (setStaffPasswordCore
  // returns a null sessionToken for a reset). The admin goes back to the
  // normal sign-in page and authenticates with their new password.
  if (state.ok) {
    return (
      <AuthSplitScreen
        kicker="Staff access only"
        title="Password updated."
        panelClassName="lv-gradient-dark"
        logoSubtitle="Administration"
        topRight={null}
        footer={<span>Access issues: registrar@lavelle.ng</span>}
        formChildren={
          <div className="rounded-xl border border-divider bg-bg p-9 text-center shadow-md">
            <div className="mx-auto flex h-[54px] w-[54px] items-center justify-center rounded-full border-[1.5px] border-accent-2-300 bg-accent-2-100">
              <svg width="26" height="26" viewBox="0 0 30 30" fill="none">
                <circle cx="15" cy="15" r="11" fill="#ffc629" />
                <path d="M10 15.4l3.3 3.3L20.2 11.8" stroke="#08234a" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h2 className="mt-[18px] text-xl font-semibold">Password updated successfully</h2>
            <p className="mx-auto mt-2.5 max-w-[38ch] text-[13px] leading-[1.65] text-neutral-600 text-pretty">
              Your password has been changed. Please log in with your new password.
            </p>
            <Link
              href="/staff/sign-in"
              className="mt-6 flex h-[46px] w-full items-center justify-center rounded-md bg-accent font-heading text-[14.5px] font-semibold text-accent-2 no-underline"
            >
              Go to login
            </Link>
          </div>
        }
      />
    );
  }

  // Invalid, expired, already-used, or malformed token.
  if (!preview) {
    return (
      <AuthSplitScreen
        kicker="Staff access only"
        title="Reset your password."
        panelClassName="lv-gradient-dark"
        logoSubtitle="Administration"
        topRight={null}
        footer={<span>Access issues: registrar@lavelle.ng</span>}
        formChildren={
          <div className="rounded-xl border border-divider bg-bg p-9 text-center shadow-md">
            <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full border border-warning-border bg-warning-bg text-[22px] font-bold text-warning-text">
              !
            </div>
            <h2 className="mt-[18px] text-xl font-semibold">This reset link is no longer valid</h2>
            <p className="mx-auto mt-2.5 max-w-[42ch] text-[13px] leading-[1.65] text-neutral-600 text-pretty">
              The link may have expired or already been used. Please request a new password reset link.
            </p>
            <Link href="/staff/forgot-password" className={"mt-6 flex h-[46px] w-full items-center justify-center rounded-md bg-accent font-heading text-[14.5px] font-semibold text-accent-2 no-underline"}>
              Request a new link
            </Link>
          </div>
        }
      />
    );
  }

  return (
    <AuthSplitScreen
      kicker="Staff access only"
      title="Choose a new password."
      body="Signing in as the staff account below. Choose a new password to complete your reset."
      panelClassName="lv-gradient-dark"
      logoSubtitle="Administration"
      topRight={
        <>
          <span>Remembered it?</span>
          <Link href="/staff/sign-in" className="font-medium">
            Staff sign in
          </Link>
        </>
      }
      footer={<span>Not expecting this? Contact registrar@lavelle.ng</span>}
      formChildren={
        <div className="rounded-xl border border-divider bg-bg p-8 pb-7 shadow-md">
          <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Reset your password</h2>
          <p className="mt-2 text-[13px] leading-[1.6] text-neutral-600 text-pretty">
            Resetting the password for <strong className="font-semibold text-text">{preview.staffEmail}</strong>. This
            link expires {expiryLabel(preview.expiresAt)}.
          </p>

          <div className="my-5 h-px border-t border-dashed border-neutral-300" />

          {state.message && (
            <div className="mb-4 flex items-start gap-2.5 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5">
              <span className="flex-none text-xs font-bold text-[#b42318]">!</span>
              <div className="text-xs leading-[1.55] text-[#912019] text-pretty">{state.message}</div>
            </div>
          )}

          <form action={formAction} className="flex flex-col gap-4">
            <input type="hidden" name="token" value={token} />

            <div>
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                name="password"
                placeholder="At least 10 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={!!state.errors?.password}
              />

              <div className="mt-2.5 flex gap-1.5">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-1 flex-1 rounded-full"
                    style={{ background: i < metCount ? METER_COLORS[metCount] : "var(--color-neutral-200)" }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex items-baseline justify-between gap-3">
                <span className="text-[11.5px] font-medium" style={{ color: METER_COLORS[metCount] }}>
                  {STRENGTHS[metCount]}
                </span>
                <span className="text-[11.5px] text-neutral-500">{metCount} of 4 met</span>
              </div>

              <div className="mt-3 flex flex-col gap-1.5 rounded-md border border-dashed border-neutral-300 bg-neutral-100 px-3.5 py-3">
                {STAFF_PASSWORD_RULES.map((rule) => {
                  const ok = rule.test(password);
                  return (
                    <div key={rule.key} className="flex items-center gap-2">
                      <span
                        className="flex h-3.5 w-3.5 flex-none items-center justify-center rounded-full border-[1.5px] text-[8px] font-bold text-white"
                        style={{ background: ok ? "#15803d" : "transparent", borderColor: ok ? "#15803d" : "var(--color-neutral-400)" }}
                      >
                        {ok ? "✓" : ""}
                      </span>
                      <span className="text-[11.5px]" style={{ color: ok ? "var(--color-neutral-700)" : "var(--color-neutral-500)" }}>
                        {rule.label}
                      </span>
                    </div>
                  );
                })}
              </div>
              <FieldError>{state.errors?.password}</FieldError>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Re-enter password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                invalid={!!confirmError}
              />
              <FieldError>{confirmError}</FieldError>
            </div>

            <Button type="submit" disabled={pending} className="mt-1 h-12 w-full text-[14.5px]">
              {pending ? "Resetting…" : "Reset password"}
            </Button>
          </form>
        </div>
      }
    />
  );
}
