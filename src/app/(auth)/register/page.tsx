"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { requestRegistrationOtp, verifyRegistrationOtp, registerCandidate } from "@/app/actions/candidate-auth";
import { emptyActionState } from "@/lib/action-state";
import { AuthSplitScreen } from "@/components/auth/auth-split-screen";
import { Button } from "@/components/ui/button";
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

type Phase = "identity" | "otp" | "password";

export default function RegisterPage() {
  const [phase, setPhase] = React.useState<Phase>("identity");
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
  const [code, setCode] = React.useState("");
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const [otpRequestState, otpRequestAction, otpRequestPending] = useActionState(
    requestRegistrationOtp,
    emptyActionState
  );
  const [otpVerifyState, otpVerifyAction, otpVerifyPending] = useActionState(
    verifyRegistrationOtp,
    emptyActionState
  );
  const [registerState, registerAction, registerPending] = useActionState(registerCandidate, emptyActionState);

  // Adjust local error state during render when a new server result comes
  // in, rather than in an effect — a single render pass, not a cascading
  // extra one (react.dev/learn/you-might-not-need-an-effect).
  const [prevOtpRequestErrors, setPrevOtpRequestErrors] = React.useState(otpRequestState.errors);
  if (otpRequestState.errors !== prevOtpRequestErrors) {
    setPrevOtpRequestErrors(otpRequestState.errors);
    setErrors(otpRequestState.errors ?? {});
  }
  const [prevOtpRequestData, setPrevOtpRequestData] = React.useState(otpRequestState.data);
  if (otpRequestState.data !== prevOtpRequestData) {
    setPrevOtpRequestData(otpRequestState.data);
    if (otpRequestState.ok && otpRequestState.data?.otpSent) {
      setPhase("otp");
      setCode("");
      setDevCode(typeof otpRequestState.data.devCode === "string" ? otpRequestState.data.devCode : null);
    }
  }

  const [prevOtpVerifyErrors, setPrevOtpVerifyErrors] = React.useState(otpVerifyState.errors);
  if (otpVerifyState.errors !== prevOtpVerifyErrors) {
    setPrevOtpVerifyErrors(otpVerifyState.errors);
    setErrors(otpVerifyState.errors ?? {});
  }
  const [prevOtpVerifyData, setPrevOtpVerifyData] = React.useState(otpVerifyState.data);
  if (otpVerifyState.data !== prevOtpVerifyData) {
    setPrevOtpVerifyData(otpVerifyState.data);
    if (otpVerifyState.ok && otpVerifyState.data?.verified) {
      setPhase("password");
    }
  }

  const [prevRegisterErrors, setPrevRegisterErrors] = React.useState(registerState.errors);
  if (registerState.errors !== prevRegisterErrors) {
    setPrevRegisterErrors(registerState.errors);
    setErrors(registerState.errors ?? {});
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
          {phase === "identity" && (
            <form
              action={otpRequestAction}
              className="rounded-xl border border-divider bg-bg p-[34px_34px_30px] shadow-md"
            >
              <h2 className="text-[23px] font-semibold tracking-[-0.01em]">Create your candidate account</h2>
              <p className="mt-2.5 text-[13.5px] leading-[1.6] text-neutral-600 text-pretty">
                Start with your name and email — we will send a verification code before you set a password.
              </p>

              <div className="my-6 h-px border-t border-dashed border-neutral-300" />

              {otpRequestState.message && !otpRequestState.errors && (
                <div className="mb-4 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-[#912019]">
                  {otpRequestState.message}
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
                  {emailKnown && (
                    <div className="mt-[6px] text-[11.5px] text-neutral-600">
                      <Link href="/sign-in" className="text-accent font-medium">
                        Sign in instead →
                      </Link>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={otpRequestPending || !values.firstName || !values.lastName || !values.email}
                  className="mt-2 h-12 w-full text-[15px]"
                >
                  {otpRequestPending ? "Sending code…" : "Send verification code"}
                </Button>
              </div>
            </form>
          )}

          {phase === "otp" && (
            <form
              action={otpVerifyAction}
              className="rounded-xl border border-divider bg-bg p-[34px_34px_30px] shadow-md"
            >
              <input type="hidden" name="email" value={values.email} />

              <h2 className="text-[23px] font-semibold tracking-[-0.01em]">Check your email</h2>
              <p className="mt-2.5 text-[13.5px] leading-[1.6] text-neutral-600 text-pretty">
                We sent a 6-digit code to <strong className="font-semibold text-text">{values.email}</strong>. Enter
                it below to confirm this is your address.
              </p>

              <div className="my-6 h-px border-t border-dashed border-neutral-300" />

              {devCode && (
                <div className="mb-4 rounded-md border border-dashed border-accent-300 bg-accent-100 px-3.5 py-2.5 text-[13px] text-accent-800">
                  <strong className="font-semibold">Dev mode</strong> — no email provider is wired up yet. Your code
                  is <span className="font-heading font-bold tracking-[0.08em]">{devCode}</span>.
                </div>
              )}

              {otpVerifyState.message && !otpVerifyState.errors && (
                <div className="mb-4 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-[#912019]">
                  {otpVerifyState.message}
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
                    onChange={(e) => {
                      setCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                      setErrors((errs) => {
                        if (!("code" in errs)) return errs;
                        const next = { ...errs };
                        delete next.code;
                        return next;
                      });
                    }}
                    invalid={!!errors.code}
                    className="text-center text-[20px] tracking-[0.3em] font-heading font-semibold"
                  />
                  <FieldError>{errors.code}</FieldError>
                </div>

                <Button type="submit" disabled={otpVerifyPending || code.length !== 6} className="h-12 w-full text-[15px]">
                  {otpVerifyPending ? "Verifying…" : "Verify email"}
                </Button>

                <div className="flex items-center justify-between text-[12.5px]">
                  <button
                    type="button"
                    onClick={() => {
                      setPhase("identity");
                      setErrors({});
                    }}
                    className="border-0 bg-transparent p-0 font-medium text-neutral-600 hover:text-text"
                  >
                    ← Change email
                  </button>
                  <button
                    type="button"
                    disabled={otpRequestPending}
                    onClick={() => {
                      const fd = new FormData();
                      fd.set("email", values.email);
                      React.startTransition(() => otpRequestAction(fd));
                    }}
                    className="border-0 bg-transparent p-0 font-medium text-accent hover:underline disabled:opacity-60"
                  >
                    {otpRequestPending ? "Sending…" : "Resend code"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {phase === "password" && (
            <form
              action={registerAction}
              className="rounded-xl border border-divider bg-bg p-[34px_34px_30px] shadow-md"
            >
              <input type="hidden" name="firstName" value={values.firstName} />
              <input type="hidden" name="lastName" value={values.lastName} />
              <input type="hidden" name="email" value={values.email} />

              <h2 className="text-[23px] font-semibold tracking-[-0.01em]">Set your password</h2>
              <p className="mt-2.5 text-[13.5px] leading-[1.6] text-neutral-600 text-pretty">
                <strong className="font-semibold text-text">{values.email}</strong> is verified. Add a phone number
                and password to finish creating your account.
              </p>

              <div className="my-6 h-px border-t border-dashed border-neutral-300" />

              {registerState.message && !registerState.errors && (
                <div className="mb-4 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-[#912019]">
                  {registerState.message}
                </div>
              )}

              <div className="flex flex-col gap-4">
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

                <Button type="submit" disabled={registerPending} className="mt-2 h-12 w-full text-[15px]">
                  {registerPending ? "Creating account…" : "Create account"}
                </Button>
              </div>
            </form>
          )}

          <div className="mx-auto mt-[18px] max-w-[46ch] text-center text-[11.5px] leading-[1.6] text-neutral-500 text-pretty">
            Registration does not enrol you in a programme. Enrolment is confirmed once payment for a selected
            programme is received.
          </div>
        </>
      }
    >
      {LADDER}
    </AuthSplitScreen>
  );
}
