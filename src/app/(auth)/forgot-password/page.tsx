"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { requestPasswordResetOtp, verifyPasswordResetOtp, resetPasswordWithOtp } from "@/app/actions/candidate-auth";
import { emptyActionState } from "@/lib/action-state";
import { AuthSplitScreen } from "@/components/auth/auth-split-screen";
import { Button } from "@/components/ui/button";
import { Label, Input, FieldError } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

type Step = "email" | "code" | "password";

export default function ForgotPasswordPage() {
  const [step, setStep] = React.useState<Step>("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [password, setPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");

  const [requestState, requestAction, requestPending] = useActionState(
    requestPasswordResetOtp,
    emptyActionState
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(verifyPasswordResetOtp, emptyActionState);
  const [resetState, resetAction, resetPending] = useActionState(resetPasswordWithOtp, emptyActionState);

  // Adjust local state during render when a new server result comes in —
  // same pattern (and rationale) as the register page.
  const [prevRequestData, setPrevRequestData] = React.useState(requestState.data);
  if (requestState.data !== prevRequestData) {
    setPrevRequestData(requestState.data);
    if (requestState.ok && requestState.data?.otpSent) {
      setStep("code");
      setCode("");
      setDevCode(typeof requestState.data.devCode === "string" ? requestState.data.devCode : null);
    }
  }

  const [prevVerifyData, setPrevVerifyData] = React.useState(verifyState.data);
  if (verifyState.data !== prevVerifyData) {
    setPrevVerifyData(verifyState.data);
    if (verifyState.ok && verifyState.data?.verified) setStep("password");
  }

  function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    const fd = new FormData();
    fd.set("email", email);
    React.startTransition(() => requestAction(fd));
  }

  const emailValid = EMAIL_RE.test(email.trim());
  const passwordsValid = password.length >= 8 && password === confirmPassword;

  return (
    <AuthSplitScreen
      kicker="Candidate portal"
      title="Reset your password."
      body="We'll send a 6-digit code to your email to confirm it's you before you choose a new password."
      topRight={
        <>
          <span>Remembered it?</span>
          <Link href="/sign-in" className="font-medium">
            Sign in
          </Link>
        </>
      }
      formChildren={
        <>
          {step === "email" && (
            <form
              onSubmit={sendCode}
              className="rounded-xl border border-divider bg-bg p-[34px_34px_30px] shadow-md"
            >
              <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Forgot your password?</h2>
              <p className="mt-2.5 text-[13.5px] leading-[1.6] text-neutral-600 text-pretty">
                Enter the email address on your candidate account and we'll send you a code.
              </p>

              <div className="my-6 h-px border-t border-dashed border-neutral-300" />

              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="email">Email address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@firm.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    invalid={!!requestState.errors?.email}
                  />
                  <FieldError>{requestState.errors?.email}</FieldError>
                </div>

                <Button type="submit" disabled={!emailValid || requestPending} className="mt-1 h-12 w-full text-[15px]">
                  {requestPending ? "Sending code…" : "Send code"}
                </Button>
              </div>
            </form>
          )}

          {step === "code" && (
            <form action={verifyAction} className="rounded-xl border border-divider bg-bg p-[34px_34px_30px] shadow-md">
              <input type="hidden" name="email" value={email} />

              <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Enter your code</h2>
              <p className="mt-2.5 text-[13.5px] leading-[1.6] text-neutral-600 text-pretty">
                We sent a 6-digit code to <strong className="font-semibold text-text">{email}</strong>.
              </p>

              <div className="my-6 h-px border-t border-dashed border-neutral-300" />

              {devCode && (
                <div className="mb-4 rounded-md border border-dashed border-accent-300 bg-accent-100 px-3.5 py-2.5 text-[13px] text-accent-800">
                  <strong className="font-semibold">Dev mode</strong> — no email provider is wired up yet. Your code
                  is <span className="font-heading font-bold tracking-[0.08em]">{devCode}</span>.
                </div>
              )}

              {verifyState.message && !verifyState.errors && (
                <div className="mb-4 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-[#912019]">
                  {verifyState.message}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="code">6-digit code</Label>
                  <Input
                    id="code"
                    name="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="000000"
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    invalid={!!verifyState.errors?.code}
                    className="text-center text-[20px] tracking-[0.3em] font-heading font-semibold"
                  />
                  <FieldError>{verifyState.errors?.code}</FieldError>
                </div>

                <Button type="submit" disabled={verifyPending || code.length !== 6} className="h-12 w-full text-[15px]">
                  {verifyPending ? "Verifying…" : "Verify code"}
                </Button>

                <div className="flex items-center justify-between text-[12.5px]">
                  <button
                    type="button"
                    onClick={() => setStep("email")}
                    className="border-0 bg-transparent p-0 font-medium text-neutral-600 hover:underline"
                  >
                    ← Use a different email
                  </button>
                  <button
                    type="button"
                    disabled={requestPending}
                    onClick={() => sendCode()}
                    className="border-0 bg-transparent p-0 font-medium text-accent hover:underline disabled:opacity-60"
                  >
                    {requestPending ? "Sending…" : "Resend code"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {step === "password" && (
            <form action={resetAction} className="rounded-xl border border-divider bg-bg p-[34px_34px_30px] shadow-md">
              <input type="hidden" name="email" value={email} />

              <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Choose a new password</h2>
              <p className="mt-2.5 text-[13.5px] leading-[1.6] text-neutral-600 text-pretty">
                This replaces your current password and signs you out everywhere else.
              </p>

              <div className="my-6 h-px border-t border-dashed border-neutral-300" />

              {resetState.message && !resetState.errors && (
                <div className="mb-4 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-[#912019]">
                  {resetState.message}
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div>
                  <Label htmlFor="password">New password</Label>
                  <PasswordInput
                    id="password"
                    name="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    invalid={!!resetState.errors?.password}
                  />
                  <FieldError>{resetState.errors?.password}</FieldError>
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm new password</Label>
                  <PasswordInput
                    id="confirmPassword"
                    name="confirmPassword"
                    placeholder="Re-enter password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    invalid={!!resetState.errors?.confirmPassword}
                  />
                  <FieldError>{resetState.errors?.confirmPassword}</FieldError>
                </div>

                <Button type="submit" disabled={!passwordsValid || resetPending} className="mt-1 h-12 w-full text-[15px]">
                  {resetPending ? "Resetting…" : "Reset password"}
                </Button>
              </div>
            </form>
          )}

          <div className="mx-auto mt-[18px] max-w-[46ch] text-center text-[11.5px] leading-[1.6] text-neutral-500 text-pretty">
            Trouble resetting? Email <a href="mailto:candidates@lavelle.ng">candidates@lavelle.ng</a> with your
            candidate number and a representative will assist.
          </div>
        </>
      }
    />
  );
}
