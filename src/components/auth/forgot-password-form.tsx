"use client";

import * as React from "react";
import Link from "next/link";
import { requestStaffPasswordReset, verifyStaffPasswordResetOtp, setStaffPasswordAfterOtpReset } from "@/app/actions/staff-auth";
import { AuthSplitScreen } from "@/components/auth/auth-split-screen";
import { Button } from "@/components/ui/button";
import { Label, Input } from "@/components/ui/field";
import { PasswordStrengthMeter } from "@/components/auth/password-strength";
import { staffPasswordMeetsRules } from "@/lib/validation/staff";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OTP_RE = /^\d{6}$/;

type View = "email" | "otp-sent" | "otp-verify" | "set-password" | "success";

export function ForgotPasswordForm() {
  const [view, setView] = React.useState<View>("email");
  const [email, setEmail] = React.useState("");
  const [otpCode, setOtpCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [passwordConfirm, setPasswordConfirm] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = React.useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg("");
    try {
      await requestStaffPasswordReset(email.trim());
      setView("otp-sent");
    } catch (err) {
      setErrorMsg("Failed to send OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleOtpVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!OTP_RE.test(otpCode)) {
      setErrorMsg("OTP must be 6 digits");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");
    try {
      const result = await verifyStaffPasswordResetOtp(email, otpCode);
      if (result.ok) {
        setView("set-password");
        setErrorMsg("");
      } else {
        setErrorMsg("Invalid or expired code. Please request a new one.");
      }
    } catch (err) {
      setErrorMsg("Failed to verify OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendCode() {
    setIsLoading(true);
    setErrorMsg("");
    try {
      await requestStaffPasswordReset(email.trim());
      setOtpCode("");
      setErrorMsg("");
    } catch (err) {
      setErrorMsg("Failed to resend code. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== passwordConfirm) {
      setErrorMsg("Passwords do not match");
      return;
    }
    if (!staffPasswordMeetsRules(password)) {
      setErrorMsg("Password does not meet requirements");
      return;
    }
    setIsLoading(true);
    setErrorMsg("");
    try {
      const formData = new FormData();
      formData.append("email", email);
      formData.append("code", otpCode);
      formData.append("password", password);
      const result = await setStaffPasswordAfterOtpReset({}, formData);
      if (result.ok) {
        setView("success");
      } else {
        setErrorMsg(result.message || "Failed to reset password. Please try again.");
      }
    } catch (err) {
      setErrorMsg("Failed to reset password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const emailValid = EMAIL_RE.test(email.trim());
  const otpValid = OTP_RE.test(otpCode.trim());
  const passwordValid = staffPasswordMeetsRules(password);
  const passwordsMatch = password === passwordConfirm && password.length > 0;

  return (
    <AuthSplitScreen
      kicker="Staff access only"
      title="Reset your password."
      body=""
      panelClassName="lv-gradient-dark"
      logoSubtitle="Administration"
      topRight={
        view === "success" ? null : (
          <>
            <span>Remember it?</span>
            <Link href="/staff/sign-in" className="font-medium">
              Staff sign in
            </Link>
          </>
        )
      }
      footer={<span>Access issues: registrar@lavelle.ng</span>}
      formChildren={
        view === "email" ? (
          <form
            onSubmit={handleEmailSubmit}
            className="rounded-xl border border-divider bg-bg p-8 pb-7 shadow-md"
          >
            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Reset your password</h2>
            <p className="mt-2 text-[13px] leading-[1.65] text-neutral-600 text-pretty">
              Enter your staff email address and we'll send you a secure code to reset your password.
            </p>

            <div className="my-5 h-px border-t border-dashed border-neutral-300" />

            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="reset-email">Staff email address</Label>
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="you@lavelle.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              {errorMsg && <p className="text-[13px] text-red-600">{errorMsg}</p>}

              <Button
                type="submit"
                disabled={!emailValid || isLoading}
                className="h-12 w-full text-[15px]"
              >
                {isLoading ? "Sending…" : "Send code"}
              </Button>
            </div>

            <div className="mt-3.5 text-center">
              <Link href="/staff/sign-in" className="text-[12.5px] text-neutral-600">
                ← Back to sign in
              </Link>
            </div>
          </form>
        ) : view === "otp-sent" ? (
          <div className="rounded-xl border border-divider bg-bg p-9 text-center shadow-md">
            <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full border border-accent-200 bg-accent-100">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#1668e3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6.5h18v11H3z" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            </div>
            <h2 className="mt-[18px] text-xl font-semibold">Check your email</h2>
            <p className="mx-auto mt-2.5 max-w-[40ch] text-[13px] leading-[1.65] text-neutral-600 text-pretty">
              We've sent a verification code to <strong className="font-semibold text-text">{email}</strong>. It expires in 15 minutes.
            </p>
            <Button onClick={() => setView("otp-verify")} className="mt-6 h-11 w-full">
              Enter code
            </Button>
            <button type="button" onClick={() => { setView("email"); setEmail(""); setOtpCode(""); }} className="mt-3 text-[12.5px] text-neutral-600">
              Use different email
            </button>
          </div>
        ) : view === "otp-verify" ? (
          <form onSubmit={handleOtpVerify} className="rounded-xl border border-divider bg-bg p-8 pb-7 shadow-md">
            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Enter verification code</h2>
            <p className="mt-2 text-[13px] leading-[1.65] text-neutral-600 text-pretty">
              Check your email for the 6-digit code and enter it below.
            </p>

            <div className="my-5 h-px border-t border-dashed border-neutral-300" />

            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="otp-code">Verification code</Label>
                <Input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  placeholder="000000"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                />
              </div>

              {errorMsg && <p className="text-[13px] text-red-600">{errorMsg}</p>}

              <Button type="submit" disabled={!otpValid || isLoading} className="h-12 w-full text-[15px]">
                {isLoading ? "Verifying…" : "Verify code"}
              </Button>
            </div>

            <div className="mt-3.5 flex flex-col gap-2 text-center">
              <button type="button" onClick={() => setView("otp-sent")} className="text-[12.5px] text-neutral-600">
                ← Back
              </button>
              <button
                type="button"
                onClick={handleResendCode}
                disabled={isLoading}
                className="text-[12.5px] text-neutral-600 hover:text-neutral-900 disabled:opacity-50"
              >
                {isLoading ? "Sending…" : "Resend code"}
              </button>
            </div>
          </form>
        ) : view === "set-password" ? (
          <form onSubmit={handlePasswordSubmit} className="rounded-xl border border-divider bg-bg p-8 pb-7 shadow-md">
            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Create new password</h2>
            <p className="mt-2 text-[13px] leading-[1.65] text-neutral-600 text-pretty">
              Choose a strong password to secure your account.
            </p>

            <div className="my-5 h-px border-t border-dashed border-neutral-300" />

            <div className="flex flex-col gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="new-password">New password</Label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[12.5px] text-neutral-600 hover:text-neutral-900"
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <Input
                  id="new-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                {password && <PasswordStrengthMeter password={password} />}
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <button
                    type="button"
                    onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                    className="text-[12.5px] text-neutral-600 hover:text-neutral-900"
                  >
                    {showPasswordConfirm ? "Hide" : "Show"}
                  </button>
                </div>
                <Input
                  id="confirm-password"
                  type={showPasswordConfirm ? "text" : "password"}
                  placeholder="••••••••"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                />
              </div>

              {errorMsg && <p className="text-[13px] text-red-600">{errorMsg}</p>}

              <Button
                type="submit"
                disabled={!passwordValid || !passwordsMatch || isLoading}
                className="h-12 w-full text-[15px]"
              >
                {isLoading ? "Updating…" : "Update password"}
              </Button>
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-divider bg-bg p-9 text-center shadow-md">
            <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full border border-green-200 bg-green-100">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <h2 className="mt-[18px] text-xl font-semibold">Password updated</h2>
            <p className="mx-auto mt-2.5 max-w-[40ch] text-[13px] leading-[1.65] text-neutral-600 text-pretty">
              Your password has been reset successfully. Please sign in with your new password.
            </p>
            <Link href="/staff/sign-in">
              <Button className="mt-6 h-11 w-full">Go to sign in</Button>
            </Link>
          </div>
        )
      }
    />
  );
}
