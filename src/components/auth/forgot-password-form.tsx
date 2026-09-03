"use client";

import * as React from "react";
import Link from "next/link";
import { requestStaffPasswordReset } from "@/app/actions/staff-auth";
import { AuthSplitScreen } from "@/components/auth/auth-split-screen";
import { Button } from "@/components/ui/button";
import { Label, Input } from "@/components/ui/field";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type View = "form" | "sent";

export function ForgotPasswordForm() {
  const [view, setView] = React.useState<View>("form");
  const [email, setEmail] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSending(true);
    try {
      await requestStaffPasswordReset(email.trim());
      setView("sent");
    } finally {
      setIsSending(false);
    }
  }

  const emailValid = EMAIL_RE.test(email.trim());

  return (
    <AuthSplitScreen
      kicker="Staff access only"
      title="Reset your password."
      body=""
      panelClassName="lv-gradient-dark"
      logoSubtitle="Administration"
      topRight={
        <>
          <span>Remember it?</span>
          <Link href="/staff/sign-in" className="font-medium">
            Staff sign in
          </Link>
        </>
      }
      footer={<span>Access issues: registrar@lavelle.ng</span>}
      formChildren={
        view === "form" ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-xl border border-divider bg-bg p-8 pb-7 shadow-md"
          >
            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Forgot your password?</h2>
            <p className="mt-2 text-[13px] leading-[1.65] text-neutral-600 text-pretty">
              Enter the email address associated with your admin account and we'll send you a secure link to reset your
              password.
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

              <Button
                type="submit"
                disabled={!emailValid || isSending}
                className="h-12 w-full text-[15px]"
              >
                {isSending ? "Sending…" : "Send reset link"}
              </Button>
            </div>

            <div className="mt-3.5 text-center">
              <Link href="/staff/sign-in" className="text-[12.5px] text-neutral-600">
                ← Back to sign in
              </Link>
            </div>
          </form>
        ) : (
          <div className="rounded-xl border border-divider bg-bg p-9 text-center shadow-md">
            <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full border border-accent-200 bg-accent-100">
              <svg
                width="23"
                height="23"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#1668e3"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6.5h18v11H3z" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            </div>
            <h2 className="mt-[18px] text-xl font-semibold">Check your email</h2>
            <p className="mx-auto mt-2.5 max-w-[40ch] text-[13px] leading-[1.65] text-neutral-600 text-pretty">
              If <strong className="font-semibold text-text">{email || "your address"}</strong> belongs to a Lavelle
              staff account, a password reset link is on its way. It expires in 30 minutes.
            </p>
            <Button variant="secondary" onClick={() => setView("form")} className="mt-6 h-11 w-full">
              Back to sign in
            </Button>
          </div>
        )
      }
    />
  );
}
