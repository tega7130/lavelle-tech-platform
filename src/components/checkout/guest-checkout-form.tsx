"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { requestRegistrationOtp, verifyRegistrationOtp } from "@/app/actions/candidate-auth";
import { initiateGuestCheckout } from "@/app/actions/payment";
import { emptyActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Input, FieldError } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export function GuestCheckoutForm({
  programmeId,
  programmeTitle,
  fee,
}: {
  programmeId: string;
  programmeTitle: string;
  fee: string;
}) {
  const [values, setValues] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
    terms: false,
    marketingOptIn: true,
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [emailVerified, setEmailVerified] = React.useState(false);
  const [otpModalOpen, setOtpModalOpen] = React.useState(false);
  const [code, setCode] = React.useState("");
  const [devCode, setDevCode] = React.useState<string | null>(null);

  const [otpRequestState, otpRequestAction, otpRequestPending] = useActionState(requestRegistrationOtp, emptyActionState);
  const [otpVerifyState, otpVerifyAction, otpVerifyPending] = useActionState(verifyRegistrationOtp, emptyActionState);
  const [checkoutState, checkoutAction, checkoutPending] = useActionState(initiateGuestCheckout, emptyActionState);

  // Adjust local state during render when a new server result comes in,
  // rather than in an effect — same pattern as the register form.
  const [prevOtpRequestData, setPrevOtpRequestData] = React.useState(otpRequestState.data);
  if (otpRequestState.data !== prevOtpRequestData) {
    setPrevOtpRequestData(otpRequestState.data);
    if (otpRequestState.ok && otpRequestState.data?.otpSent) {
      setOtpModalOpen(true);
      setCode("");
      setDevCode(typeof otpRequestState.data.devCode === "string" ? otpRequestState.data.devCode : null);
    }
  }
  const [prevOtpRequestErrors, setPrevOtpRequestErrors] = React.useState(otpRequestState.errors);
  if (otpRequestState.errors !== prevOtpRequestErrors) {
    setPrevOtpRequestErrors(otpRequestState.errors);
    if (otpRequestState.errors) setErrors((errs) => ({ ...errs, ...otpRequestState.errors }));
  }

  const [prevOtpVerifyData, setPrevOtpVerifyData] = React.useState(otpVerifyState.data);
  if (otpVerifyState.data !== prevOtpVerifyData) {
    setPrevOtpVerifyData(otpVerifyState.data);
    if (otpVerifyState.ok && otpVerifyState.data?.verified) {
      setEmailVerified(true);
      setOtpModalOpen(false);
    }
  }

  const [prevCheckoutErrors, setPrevCheckoutErrors] = React.useState(checkoutState.errors);
  if (checkoutState.errors !== prevCheckoutErrors) {
    setPrevCheckoutErrors(checkoutState.errors);
    if (checkoutState.errors) setErrors((errs) => ({ ...errs, ...checkoutState.errors }));
  }

  // Redirecting to the payment provider is a side effect, not a state
  // derivation — unlike the "adjust during render" blocks above, this one
  // belongs in an effect.
  React.useEffect(() => {
    if (checkoutState.ok && typeof checkoutState.data?.checkoutUrl === "string") {
      window.location.href = checkoutState.data.checkoutUrl;
    }
  }, [checkoutState]);

  function field(key: keyof typeof values) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      setErrors((errs) => {
        if (!(key in errs)) return errs;
        const next = { ...errs };
        delete next[key];
        return next;
      });
      if (key === "email") setEmailVerified(false);
    };
  }

  function check(key: "terms" | "marketingOptIn") {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.checked }));
      setErrors((errs) => {
        if (!(key in errs)) return errs;
        const next = { ...errs };
        delete next[key];
        return next;
      });
    };
  }

  function sendCode() {
    const fd = new FormData();
    fd.set("email", values.email);
    React.startTransition(() => otpRequestAction(fd));
  }

  const emailValid = EMAIL_RE.test(values.email.trim());
  const emailKnown = errors.email === "An account with this email already exists";
  const redirecting = checkoutState.ok && typeof checkoutState.data?.checkoutUrl === "string";

  return (
    <>
      <form action={checkoutAction} className="rounded-xl border border-divider bg-bg p-[34px_34px_30px] shadow-md">
        <input type="hidden" name="programmeId" value={programmeId} />

        <h2 className="text-[23px] font-semibold tracking-[-0.01em]">Apply for {programmeTitle}</h2>
        <p className="mt-2.5 text-[13.5px] leading-[1.6] text-neutral-600 text-pretty">
          The name below is what appears on your certificate. The password you set is what you&apos;ll use to sign
          in to your portal once payment is confirmed.
        </p>

        <div className="my-6 flex items-center justify-between rounded-md border border-dashed border-accent-300 bg-accent-100 px-4 py-3">
          <span className="text-[13px] font-medium text-accent-800">Programme fee</span>
          <span className="font-heading font-bold text-[17px] text-accent-800">{fee}</span>
        </div>

        {checkoutState.message && !checkoutState.errors && (
          <div className="mb-4 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-[#912019]">
            {checkoutState.message}
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
            <div>
              <Label htmlFor="firstName">First name</Label>
              <Input
                id="firstName"
                name="firstName"
                placeholder="Adaeze"
                value={values.firstName}
                onChange={field("firstName")}
                invalid={!!errors.firstName}
              />
              <FieldError>{errors.firstName}</FieldError>
            </div>
            <div>
              <Label htmlFor="lastName">Last name</Label>
              <Input
                id="lastName"
                name="lastName"
                placeholder="Okonkwo"
                value={values.lastName}
                onChange={field("lastName")}
                invalid={!!errors.lastName}
              />
              <FieldError>{errors.lastName}</FieldError>
            </div>
          </div>
          <div className="-mt-2 text-[11px] text-neutral-500">This name will appear on your certificate.</div>

          <div>
            <Label htmlFor="email">Email address</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@firm.com"
                value={values.email}
                onChange={field("email")}
                invalid={!!errors.email}
                className="flex-1"
              />
              {emailVerified ? (
                <span className="flex h-11 flex-none items-center gap-1.5 rounded-md border border-accent-2-300 bg-accent-2-100 px-3 text-[13px] font-medium text-accent-2-800">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-accent-2 text-[9px] font-bold text-[#08234a]">
                    ✓
                  </span>
                  Verified
                </span>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={sendCode}
                  disabled={!emailValid || otpRequestPending}
                  className="h-11 flex-none text-[13px]"
                >
                  {otpRequestPending ? "Sending…" : "Verify"}
                </Button>
              )}
            </div>
            <FieldError>{errors.email}</FieldError>
            {emailKnown && (
              <div className="mt-[6px] text-[11.5px] text-neutral-600">
                <Link href="/sign-in" className="text-accent font-medium">
                  Sign in instead →
                </Link>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3.5 max-[900px]:grid-cols-1">
            <div>
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="password"
                placeholder="At least 8 characters"
                value={values.password}
                onChange={field("password")}
                invalid={!!errors.password}
              />
              <FieldError>{errors.password}</FieldError>
            </div>
            <div>
              <Label htmlFor="confirmPassword">Confirm password</Label>
              <PasswordInput
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Re-enter password"
                value={values.confirmPassword}
                onChange={field("confirmPassword")}
                invalid={!!errors.confirmPassword}
              />
              <FieldError>{errors.confirmPassword}</FieldError>
            </div>
          </div>
          <div className="-mt-2 text-[11px] text-neutral-500">
            This creates your account — use it to sign in to your portal after payment.
          </div>

          <div className="mt-1 flex flex-col gap-2.5">
            <label className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-neutral-700">
              <Checkbox name="terms" checked={values.terms} onChange={check("terms")} className="mt-0.5" />
              <span>
                I accept the <a href="#">Terms of Use</a> and <a href="#">Privacy Policy</a>
              </span>
            </label>
            <FieldError>{errors.terms}</FieldError>
            <label className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-neutral-700">
              <Checkbox name="marketingOptIn" checked={values.marketingOptIn} onChange={check("marketingOptIn")} className="mt-0.5" />
              <span>
                Send me programme and intake updates <span className="text-neutral-500">(optional)</span>
              </span>
            </label>
          </div>

          <Button type="submit" disabled={checkoutPending || redirecting || !emailVerified} className="mt-2 h-12 w-full text-[15px]">
            {redirecting ? "Redirecting to payment…" : checkoutPending ? "Preparing checkout…" : `Pay ${fee} and apply`}
          </Button>
          {!emailVerified && (
            <div className="-mt-2 text-center text-[11.5px] text-neutral-500">
              Verify your email address above to continue.
            </div>
          )}
        </div>
      </form>

      <div className="mx-auto mt-[18px] max-w-[46ch] text-center text-[11.5px] leading-[1.6] text-neutral-500 text-pretty">
        You will be redirected to a secure payment page. Your account is created only once payment is confirmed.
      </div>

      <Dialog open={otpModalOpen} onClose={() => setOtpModalOpen(false)} title="Verify your email" className="bg-bg text-text">
        <form action={otpVerifyAction} className="flex flex-col gap-4">
          <input type="hidden" name="email" value={values.email} />

          <p className="text-[13.5px] leading-[1.6] text-neutral-600 text-pretty">
            We sent a 6-digit code to <strong className="font-semibold text-text">{values.email}</strong>.
          </p>

          {devCode && (
            <div className="rounded-md border border-dashed border-accent-300 bg-accent-100 px-3.5 py-2.5 text-[13px] text-accent-800">
              <strong className="font-semibold">Dev mode</strong> — no email provider is wired up yet. Your code is{" "}
              <span className="font-heading font-bold tracking-[0.08em]">{devCode}</span>.
            </div>
          )}

          {otpVerifyState.message && !otpVerifyState.errors && (
            <div className="rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-[#912019]">
              {otpVerifyState.message}
            </div>
          )}

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
              invalid={!!otpVerifyState.errors?.code}
              className="text-center text-[20px] tracking-[0.3em] font-heading font-semibold"
            />
            <FieldError>{otpVerifyState.errors?.code}</FieldError>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={otpRequestPending}
              onClick={sendCode}
              className="border-0 bg-transparent p-0 text-[12.5px] font-medium text-accent hover:underline disabled:opacity-60"
            >
              {otpRequestPending ? "Sending…" : "Resend code"}
            </button>
            <Button type="submit" disabled={otpVerifyPending || code.length !== 6} className="h-11 text-[13.5px]">
              {otpVerifyPending ? "Verifying…" : "Verify email"}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
