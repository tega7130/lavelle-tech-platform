"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { requestRegistrationOtp, verifyRegistrationOtp, registerCandidate } from "@/app/actions/candidate-auth";
import { emptyActionState } from "@/lib/action-state";
import { AuthSplitScreen } from "@/components/auth/auth-split-screen";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label, Input, FieldError } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { Checkbox } from "@/components/ui/checkbox";

const PHONE_CODES = [
  { value: "+234", label: "🇳🇬 +234" },
  { value: "+233", label: "🇬🇭 +233" },
  { value: "+254", label: "🇰🇪 +254" },
  { value: "+44", label: "🇬🇧 +44" },
  { value: "+1", label: "🇺🇸 +1" },
];

const LADDER = (
  <div className="mt-9 border-t border-dashed border-white/22 pt-[26px]">
    <div className="text-[10px] tracking-[0.16em] text-white/50 uppercase">Credentialing ladder</div>
    <div className="mt-4 flex flex-wrap items-center gap-2.5">
      <div className="flex items-center gap-2">
        <div className="h-[9px] w-[9px] rounded-full bg-accent-2" />
        <span className="text-[13px] font-medium">Foundation</span>
      </div>
      <div className="h-px w-[26px] bg-white/28" />
      <div className="flex items-center gap-2">
        <div className="h-[9px] w-[9px] rounded-full border-[1.5px] border-accent-2/60" />
        <span className="text-[13px] font-medium text-white/80">Specialist</span>
      </div>
      <div className="h-px w-[26px] bg-white/28" />
      <div className="flex items-center gap-2">
        <div className="h-[9px] w-[9px] rounded-full border-[1.5px] border-white/30" />
        <span className="text-[13px] font-medium text-white/66">Advanced Practitioner</span>
      </div>
    </div>
    <div className="mt-3.5 max-w-[44ch] text-xs leading-[1.6] text-white/55">
      Candidates progress one tier at a time. Registration opens the platform; programmes are selected and paid for
      individually.
    </div>
  </div>
);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

export default function RegisterPage() {
  const [values, setValues] = React.useState({
    firstName: "",
    lastName: "",
    email: "",
    phoneCountryCode: "+234",
    phone: "",
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

  const [otpRequestState, otpRequestAction, otpRequestPending] = useActionState(
    requestRegistrationOtp,
    emptyActionState
  );
  const [otpVerifyState, otpVerifyAction, otpVerifyPending] = useActionState(
    verifyRegistrationOtp,
    emptyActionState
  );
  const [registerState, registerAction, registerPending] = useActionState(registerCandidate, emptyActionState);

  // Adjust local state during render when a new server result comes in,
  // rather than in an effect — a single render pass, not a cascading extra
  // one (react.dev/learn/you-might-not-need-an-effect).
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

  const [prevRegisterErrors, setPrevRegisterErrors] = React.useState(registerState.errors);
  if (registerState.errors !== prevRegisterErrors) {
    setPrevRegisterErrors(registerState.errors);
    if (registerState.errors) setErrors((errs) => ({ ...errs, ...registerState.errors }));
  }

  function field(key: keyof typeof values) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
      setErrors((errs) => {
        if (!(key in errs)) return errs;
        const next = { ...errs };
        delete next[key];
        return next;
      });
      // A verified email stops being verified the moment it's edited — the
      // OTP proved ownership of the old value, not whatever's typed next.
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

  return (
    <AuthSplitScreen
      kicker="Candidate registration"
      title="Specialist practice, formally credentialed."
      body="Lavelle prepares practitioners across the Nigerian legal market through structured specialization programmes, assessed and certified against a published standard."
      formMaxWidth="520px"
      topRight={
        <>
          <span>Already have an account?</span>
          <Link href="/sign-in" className="font-medium">
            Sign in
          </Link>
        </>
      }
      formChildren={
        <>
          <form action={registerAction} className="rounded-xl border border-divider bg-bg p-[34px_34px_30px] shadow-md">
            <h2 className="text-[23px] font-semibold tracking-[-0.01em]">Create your candidate account</h2>
            <p className="mt-2.5 text-[13.5px] leading-[1.6] text-neutral-600 text-pretty">
              Registration takes a minute and commits you to nothing. You will receive a provisional applicant
              number, then browse programmes and enrol when you are ready.
            </p>

            <div className="my-6 h-px border-t border-dashed border-neutral-300" />

            {registerState.message && !registerState.errors && (
              <div className="mb-4 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-[#912019]">
                {registerState.message}
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

              <div>
                <Label htmlFor="phone">Phone number</Label>
                <div className="flex gap-2">
                  <select
                    name="phoneCountryCode"
                    value={values.phoneCountryCode}
                    onChange={field("phoneCountryCode")}
                    className="h-11 w-[104px] flex-none rounded-md border border-neutral-300 bg-bg px-2 text-sm text-text"
                  >
                    {PHONE_CODES.map((c) => (
                      <option key={c.value} value={c.value}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <Input
                    id="phone"
                    name="phone"
                    className="flex-1"
                    placeholder="803 552 8841"
                    value={values.phone}
                    onChange={field("phone")}
                    invalid={!!errors.phone}
                  />
                </div>
                <FieldError>{errors.phone}</FieldError>
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

              <div className="mt-1 flex flex-col gap-2.5">
                <label className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-neutral-700">
                  <Checkbox name="terms" checked={values.terms} onChange={check("terms")} className="mt-0.5" />
                  <span>
                    I accept the <a href="#">Terms of Use</a> and <a href="#">Privacy Policy</a>
                  </span>
                </label>
                <FieldError>{errors.terms}</FieldError>
                <label className="flex items-start gap-2.5 text-[13px] leading-[1.5] text-neutral-700">
                  <Checkbox
                    name="marketingOptIn"
                    checked={values.marketingOptIn}
                    onChange={check("marketingOptIn")}
                    className="mt-0.5"
                  />
                  <span>
                    Send me programme and intake updates <span className="text-neutral-500">(optional)</span>
                  </span>
                </label>
              </div>

              <Button
                type="submit"
                disabled={registerPending || !emailVerified}
                className="mt-2 h-12 w-full text-[15px]"
              >
                {registerPending ? "Creating account…" : "Create account"}
              </Button>
              {!emailVerified && (
                <div className="-mt-2 text-center text-[11.5px] text-neutral-500">
                  Verify your email address above to continue.
                </div>
              )}

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
            Registration does not enrol you in a programme. Enrolment is confirmed once payment for a selected
            programme is received.
          </div>
        </>
      }
    >
      {LADDER}

      <Dialog
        open={otpModalOpen}
        onClose={() => setOtpModalOpen(false)}
        title="Verify your email"
        className="bg-bg text-text"
      >
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
    </AuthSplitScreen>
  );
}
