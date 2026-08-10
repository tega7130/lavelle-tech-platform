"use client";

import * as React from "react";
import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { staffSignIn, requestStaffPasswordReset } from "@/app/actions/staff-auth";
import { emptyActionState } from "@/lib/action-state";
import { AuthSplitScreen } from "@/components/auth/auth-split-screen";
import { Button } from "@/components/ui/button";
import { Label, Input, FieldError } from "@/components/ui/field";

function SignInForm() {
  const searchParams = useSearchParams();
  const signedOut = searchParams.get("signedOut") === "1";
  const expired = searchParams.get("expired") === "1";
  const nextPath = searchParams.get("next");
  const [state, formAction, pending] = useActionState(staffSignIn, emptyActionState);
  const [values, setValues] = React.useState({ email: "", password: "" });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [prevStateErrors, setPrevStateErrors] = React.useState(state.errors);
  if (state.errors !== prevStateErrors) {
    setPrevStateErrors(state.errors);
    setErrors(state.errors ?? {});
  }

  const [view, setView] = React.useState<"form" | "reset" | "sent">("form");
  const [resetEmail, setResetEmail] = React.useState("");
  const [resetBusy, setResetBusy] = React.useState(false);

  function field(key: "email" | "password") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      setErrors((errs) => {
        if (!(key in errs)) return errs;
        const next = { ...errs };
        delete next[key];
        return next;
      });
    };
  }

  async function submitReset() {
    setResetBusy(true);
    try {
      await requestStaffPasswordReset(resetEmail);
      setView("sent");
    } finally {
      setResetBusy(false);
    }
  }

  return (
    <AuthSplitScreen
      kicker="Staff access only"
      title="Admin Console."
      body=""
      panelClassName="lv-gradient-dark"
      logoSubtitle="Administration"
      topRight={null}
      footer={<span>Access issues: registrar@lavelle.ng</span>}
      formChildren={
        view === "form" ? (
          <div className="rounded-xl border border-divider bg-bg p-8 pb-7 shadow-md">
            {expired && (
              <div className="mb-5 flex items-start gap-2.5 rounded-md border border-warning-border bg-warning-bg px-3.5 py-3">
                <span className="flex-none text-sm font-bold text-warning-text">!</span>
                <div className="text-xs leading-[1.55] text-warning-text text-pretty">
                  <div className="font-heading font-semibold">You were signed out for security</div>
                  <div className="mt-1">Sessions end after 24 hours. Sign in again to pick up where you left off.</div>
                </div>
              </div>
            )}

            {signedOut && !expired && (
              <div className="mb-5 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-100 px-3.5 py-2.5">
                <span className="flex-none text-xs font-bold text-accent">✓</span>
                <div className="text-xs leading-[1.55] text-accent-800 text-pretty">
                  You have been signed out of the console.
                </div>
              </div>
            )}

            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Admin sign in</h2>
            <p className="mt-2 text-[13px] leading-[1.6] text-neutral-600">Use your Lavelle staff email address.</p>

            <div className="my-5 h-px border-t border-dashed border-neutral-300" />

            {state.message && (
              <div className="mb-4 flex items-start gap-2.5 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5">
                <span className="flex-none text-xs font-bold text-[#b42318]">!</span>
                <div className="text-xs leading-[1.55] text-[#912019] text-pretty">{state.message}</div>
              </div>
            )}

            <form action={formAction} className="flex flex-col gap-4">
              <input type="hidden" name="next" value={nextPath ?? ""} />
              <div>
                <Label htmlFor="email">Staff email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@lavelle.ng"
                  value={values.email}
                  onChange={field("email")}
                  invalid={!!errors.email}
                />
                <FieldError>{errors.email}</FieldError>
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <Label htmlFor="password" className="mb-0">
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => setView("reset")}
                    className="mb-1.5 text-[11.5px] text-accent"
                  >
                    Forgot password?
                  </button>
                </div>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Your password"
                  value={values.password}
                  onChange={field("password")}
                  invalid={!!errors.password}
                />
                <FieldError>{errors.password}</FieldError>
              </div>

              <Button type="submit" disabled={pending} className="h-12 w-full text-[15px]">
                {pending ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>
        ) : view === "reset" ? (
          <div className="rounded-xl border border-divider bg-bg p-8 pb-7 shadow-md">
            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Reset your password</h2>
            <p className="mt-2 text-[13px] leading-[1.65] text-neutral-600 text-pretty">
              Enter your staff email address and we will send a secure link. It is valid for one hour and can be used once.
            </p>

            <div className="my-5 h-px border-t border-dashed border-neutral-300" />

            <div>
              <Label htmlFor="reset-email">Staff email address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@lavelle.ng"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
              />
            </div>

            <Button disabled={resetBusy || !resetEmail.trim()} onClick={submitReset} className="mt-4 h-12 w-full text-[15px]">
              {resetBusy ? "Sending…" : "Send reset link"}
            </Button>
            <div className="mt-3.5 text-center">
              <button type="button" onClick={() => setView("form")} className="text-[12.5px] text-neutral-600">
                &larr; Back to sign in
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-divider bg-bg p-9 text-center shadow-md">
            <div className="mx-auto flex h-[52px] w-[52px] items-center justify-center rounded-full border border-accent-200 bg-accent-100">
              <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="#1668e3" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6.5h18v11H3z" />
                <path d="M3 7l9 6 9-6" />
              </svg>
            </div>
            <h2 className="mt-[18px] text-xl font-semibold">Check your email</h2>
            <p className="mx-auto mt-2.5 max-w-[40ch] text-[13px] leading-[1.65] text-neutral-600 text-pretty">
              If <strong className="font-semibold text-text">{resetEmail || "your address"}</strong> belongs to a Lavelle staff account, a reset link is on its way. It expires in one hour.
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

export default function StaffSignInPage() {
  return (
    <React.Suspense fallback={null}>
      <SignInForm />
    </React.Suspense>
  );
}
