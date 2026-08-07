"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { registerCandidate } from "@/app/actions/candidate-auth";
import { emptyActionState } from "@/lib/action-state";
import { AuthSplitScreen } from "@/components/auth/auth-split-screen";
import { Button } from "@/components/ui/button";
import { Label, Input, FieldError } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/checkbox";

const PHONE_CODES = [
  { value: "+234", label: "🇳🇬 +234" },
  { value: "+233", label: "🇬🇭 +233" },
  { value: "+254", label: "🇰🇪 +254" },
  { value: "+44", label: "🇬🇧 +44" },
  { value: "+1", label: "🇺🇸 +1" },
];

const NEXT_STEPS = [
  { n: "1", title: "Verify your email address", meta: "You can confirm it any time from your dashboard." },
  {
    n: "2",
    title: "Browse the programme catalogue",
    meta: "Foundation, Specialist and Advanced Practitioner tiers, with intake dates and fees.",
  },
  {
    n: "3",
    title: "Enrol and pay per programme",
    meta: "Course materials, assessments and your candidate ID card are issued once payment clears.",
  },
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

export default function RegisterPage() {
  const [state, formAction, pending] = useActionState(registerCandidate, emptyActionState);
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
  // Adjust local error state during render when a new server result comes
  // in, rather than in an effect — this is a single render pass, not a
  // cascading extra one (react.dev/learn/you-might-not-need-an-effect).
  const [prevStateErrors, setPrevStateErrors] = React.useState(state.errors);
  if (state.errors !== prevStateErrors) {
    setPrevStateErrors(state.errors);
    setErrors(state.errors ?? {});
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

  if (state.ok && state.data?.applicantNumber) {
    return (
      <AuthSplitScreen
        kicker="Candidate registration"
        title="Specialist practice, formally credentialed."
        body="Lavelle prepares practitioners across the Nigerian legal market through structured specialization programmes, assessed and certified against a published standard."
        topRight={<span />}
        formMaxWidth="520px"
        formChildren={
          <>
            <div className="rounded-xl border border-divider bg-bg p-[38px_34px_30px] text-center shadow-md">
              <div className="mx-auto flex h-[54px] w-[54px] items-center justify-center rounded-full border border-accent-200 bg-accent-100">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1668e3" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6.5h18v11H3z" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
              </div>
              <h2 className="mt-5 text-[23px] font-semibold tracking-[-0.01em]">
                Check your email to verify your account
              </h2>
              <p className="mx-auto mt-2.5 max-w-[44ch] text-[13.5px] leading-[1.65] text-neutral-600 text-pretty">
                We have sent a verification link to <strong className="font-semibold text-text">{values.email}</strong>.
                Confirm it to activate your candidate account — the link is valid for 24 hours.
              </p>

              <div className="mt-6 rounded-[10px] border border-dashed border-neutral-300 bg-neutral-100 p-5">
                <div className="text-[10px] tracking-[0.16em] text-neutral-500 uppercase">
                  Provisional applicant number
                </div>
                <div className="mt-2 font-heading text-[26px] font-semibold tracking-[0.06em] text-accent-800">
                  {state.data.applicantNumber as string}
                </div>
                <div className="mx-auto mt-2 max-w-[40ch] text-[11.5px] leading-[1.6] text-neutral-600 text-pretty">
                  Quote this number in any correspondence. It becomes your candidate number once you enrol and
                  payment is confirmed.
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-3.5 border-t border-dashed border-neutral-300 pt-[22px] text-left">
                <div className="text-[10px] tracking-[0.16em] text-neutral-500 uppercase">What happens next</div>
                {NEXT_STEPS.map((step) => (
                  <div key={step.n} className="flex items-start gap-3">
                    <div className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-full bg-accent-100 text-[11px] font-semibold text-accent-700">
                      {step.n}
                    </div>
                    <div>
                      <div className="text-[13.5px] font-medium">{step.title}</div>
                      <div className="text-xs leading-[1.55] text-neutral-600">{step.meta}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex flex-col gap-2.5">
                <Link
                  href="/portal/dashboard"
                  className="flex h-12 items-center justify-center rounded-md bg-accent font-heading text-[15px] font-semibold text-accent-2 no-underline hover:bg-accent-600"
                >
                  Continue to the platform
                </Link>
              </div>
            </div>
            <div className="mt-[18px] text-center text-[11.5px] text-neutral-500">
              Wrong address?{" "}
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.reload();
                }}
              >
                Register again
              </a>{" "}
              or email <a href="mailto:candidates@lavelle.ng">candidates@lavelle.ng</a>
            </div>
          </>
        }
      >
        {LADDER}
      </AuthSplitScreen>
    );
  }

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
          <form action={formAction} className="rounded-xl border border-divider bg-bg p-[34px_34px_30px] shadow-md">
            <h2 className="text-[23px] font-semibold tracking-[-0.01em]">Create your candidate account</h2>
            <p className="mt-2.5 text-[13.5px] leading-[1.6] text-neutral-600 text-pretty">
              Registration takes a minute and commits you to nothing. You will receive a provisional applicant
              number, then browse programmes and enrol when you are ready.
            </p>

            <div className="my-6 h-px border-t border-dashed border-neutral-300" />

            {state.message && !state.errors && (
              <div className="mb-4 rounded-md border border-[#f3c4bf] bg-[#fdecec] px-3.5 py-2.5 text-[13px] text-[#912019]">
                {state.message}
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
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    placeholder="At least 8 characters"
                    value={values.password}
                    onChange={field("password")}
                    invalid={!!errors.password}
                  />
                  <FieldError>{errors.password}</FieldError>
                </div>
                <div>
                  <Label htmlFor="confirmPassword">Confirm password</Label>
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
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

              <Button type="submit" disabled={pending} className="mt-2 h-12 w-full text-[15px]">
                {pending ? "Creating account…" : "Create account"}
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
