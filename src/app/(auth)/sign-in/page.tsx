"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { signInCandidate } from "@/app/actions/candidate-auth";
import { emptyActionState } from "@/lib/action-state";
import { AuthSplitScreen } from "@/components/auth/auth-split-screen";
import { Button } from "@/components/ui/button";
import { Label, Input, FieldError } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";

const ASSURANCES = [
  "Programme progress, deadlines and drafting submissions stay exactly as you left them.",
  "Certificates remain verifiable on the public portal whether or not you are signed in.",
  "Sessions end automatically 24 hours after signing in, with no exception for a paper you are still sitting.",
];

function SignInForm() {
  const searchParams = useSearchParams();
  const signedOut = searchParams.get("signedOut") === "1";
  const expired = searchParams.get("expired") === "1";
  const nextPath = searchParams.get("next");
  const [state, formAction, pending] = useActionState(signInCandidate, emptyActionState);
  // Prefilled after a guest checkout ("Apply for this programme") confirms
  // payment — the candidate already knows the password they just set,
  // this just saves retyping the email they were shown on that page.
  const [values, setValues] = React.useState({ email: searchParams.get("email") ?? "", password: "", remember: true });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  // Adjust during render rather than in an effect — see the same pattern
  // (and its rationale) in the register page.
  const [prevStateErrors, setPrevStateErrors] = React.useState(state.errors);
  if (state.errors !== prevStateErrors) {
    setPrevStateErrors(state.errors);
    setErrors(state.errors ?? {});
  }

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

  const suspended = !!state.data?.suspended;

  return (
    <AuthSplitScreen
      kicker="Candidate portal"
      title="Welcome back to your practice record."
      body="Sign in to continue a programme, sit a certifying examination, or download a credential. Your progress is saved exactly where you left it."
      topRight={
        <>
          <span>New to Lavelle?</span>
          <Link href="/register" className="font-medium">
            Create an account
          </Link>
        </>
      }
      formChildren={
        <>
          <form action={formAction} className="rounded-xl border border-divider bg-bg p-8 pb-7 shadow-md">
            <input type="hidden" name="next" value={nextPath ?? ""} />

            {expired && !suspended && (
              <div className="mb-5 flex items-start gap-2.5 rounded-md border border-warning-border bg-warning-bg px-3.5 py-3">
                <span className="flex-none text-sm font-bold text-warning-text">!</span>
                <div className="text-xs leading-[1.55] text-warning-text text-pretty">
                  <div className="font-heading font-semibold">You were signed out for security</div>
                  <div className="mt-1">
                    Sessions end after 24 hours. Anything you had saved is intact — sign in again to pick up exactly
                    where you left off.
                  </div>
                </div>
              </div>
            )}

            {signedOut && !suspended && !expired && (
              <div className="mb-5 flex items-start gap-2.5 rounded-md border border-accent-200 bg-accent-100 px-3.5 py-2.5">
                <span className="flex-none text-xs font-bold text-accent">✓</span>
                <div className="text-xs leading-[1.55] text-accent-800 text-pretty">
                  You have been signed out. Your progress was saved.
                </div>
              </div>
            )}

            {suspended && (
              <div className="mb-5 flex items-start gap-2.5 rounded-md border border-warning-border bg-warning-bg px-3.5 py-3">
                <span className="flex-none text-sm font-bold text-warning-text">!</span>
                <div className="text-xs leading-[1.55] text-warning-text text-pretty">
                  <div className="font-heading font-semibold">This account is suspended</div>
                  <div className="mt-1">
                    {(state.data?.suspendedReason as string) || "Contact the registrar for details."}
                    {state.data?.suspendedAt
                      ? ` — ${new Date(state.data.suspendedAt as string).toLocaleDateString()}`
                      : ""}
                  </div>
                </div>
              </div>
            )}

            {state.message && !suspended && !state.errors && (
              <div className="mb-5 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-[#912019]">
                {state.message}
              </div>
            )}

            <h2 className="text-[22px] font-semibold tracking-[-0.01em]">Sign in</h2>
            <p className="mt-2 text-[13px] leading-[1.6] text-neutral-600">
              Use the email address on your candidate record.
            </p>

            <div className="my-5 h-px border-t border-dashed border-neutral-300" />

            <div className="flex flex-col gap-4">
              <div>
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@firm.com"
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
                  <a href="#" onClick={(e) => e.preventDefault()} className="mb-1.5 text-[11.5px]">
                    Forgot password?
                  </a>
                </div>
                <PasswordInput
                  id="password"
                  name="password"
                  placeholder="Your password"
                  value={values.password}
                  onChange={field("password")}
                  invalid={!!errors.password}
                />
                <FieldError>{errors.password}</FieldError>
              </div>

              <label className="flex items-center gap-2.5 text-[13px] text-neutral-700">
                <Checkbox
                  name="remember"
                  checked={values.remember}
                  onChange={(e) => setValues((v) => ({ ...v, remember: e.target.checked }))}
                />
                <span>Keep me signed in on this device</span>
              </label>

              <Button type="submit" disabled={pending} className="h-12 w-full text-[15px]">
                {pending ? "Signing in…" : "Sign in"}
              </Button>

              <div className="my-0.5 flex items-center gap-3.5">
                <div className="flex-1 border-t border-dashed border-neutral-300" />
                <span className="text-[11px] tracking-[0.1em] text-neutral-500 uppercase">or</span>
                <div className="flex-1 border-t border-dashed border-neutral-300" />
              </div>

              <button
                type="button"
                disabled
                title="Not available yet"
                className="flex h-[46px] w-full cursor-not-allowed items-center justify-center gap-2.5 rounded-md border border-neutral-300 bg-bg text-sm font-medium text-text opacity-60"
              >
                <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden="true">
                  <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.7H9v3.3h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.5 2.7-3.8 2.7-6.5Z" />
                  <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.5-1.6-5.2-3.8H.8v2.3A9 9 0 0 0 9 18Z" />
                  <path fill="#FBBC05" d="M3.8 10.7a5.4 5.4 0 0 1 0-3.4V5H.8a9 9 0 0 0 0 8l3-2.3Z" />
                  <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .8 5l3 2.3C4.5 5.1 6.6 3.6 9 3.6Z" />
                </svg>
                <span>Continue with Google</span>
              </button>
            </div>
          </form>

          <div className="mx-auto mt-[18px] max-w-[46ch] text-center text-[11.5px] leading-[1.6] text-neutral-500 text-pretty">
            Trouble signing in? Email <a href="mailto:candidates@lavelle.ng">candidates@lavelle.ng</a> with your
            candidate number and a representative will assist.
          </div>
        </>
      }
    >
      <div className="mt-9 flex flex-col gap-3 border-t border-dashed border-white/22 pt-[26px]">
        {ASSURANCES.map((a) => (
          <div key={a} className="flex items-start gap-[11px]">
            <span className="mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full bg-accent-2/18 text-[9px] font-bold text-accent-2">
              ✓
            </span>
            <span className="text-[12.5px] leading-[1.55] text-white/68 text-pretty">{a}</span>
          </div>
        ))}
      </div>
    </AuthSplitScreen>
  );
}

export default function SignInPage() {
  return (
    <React.Suspense fallback={null}>
      <SignInForm />
    </React.Suspense>
  );
}
