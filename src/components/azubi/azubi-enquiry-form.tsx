"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { submitAzubiEnquiryAction } from "@/app/actions/azubi";
import { emptyActionState } from "@/lib/action-state";
import { AzubiSubmitButton } from "./azubi-button";

const inputClass =
  "font-azubi text-[17px] px-[14px] py-[13px] border-2 border-azubi-sage rounded-[12px] bg-white text-azubi-ink min-h-[50px] w-full focus:border-azubi-green-900 focus:outline-none";
const errorInputClass = "border-[#b42318]";

const WRITING_AS_OPTIONS = [
  "A prospective fellow",
  "A law firm or legal organisation",
  "Another organisation",
  "Something else",
] as const;

/**
 * Shared by the Home page's #contact section and /azubi/contact — same
 * field set per the build brief, posting to the same submitAzubiEnquiryAction
 * (source differs so the admin inbox can tell them apart).
 */
export function AzubiEnquiryForm({
  idPrefix,
  source,
  defaultWritingAs,
}: {
  idPrefix: string;
  source: "contact_page" | "home_form";
  defaultWritingAs?: (typeof WRITING_AS_OPTIONS)[number];
}) {
  const [state, formAction, pending] = useActionState(submitAzubiEnquiryAction, emptyActionState);
  const id = (name: string) => `${idPrefix}-${name}`;
  const errors = state.errors ?? {};
  const values = state.values ?? {};

  if (state.ok) {
    return (
      <div role="status" className="text-center py-8 flex flex-col gap-3 items-center">
        <span className="grid place-items-center w-12 h-12 rounded-full bg-azubi-green-900 text-white text-[22px]">✓</span>
        <h3 className="text-[22px]">Message sent</h3>
        <p className="text-azubi-muted text-[17px] max-w-[42ch]">
          Thanks for writing to us. We review messages regularly and will reply to the email address you provided.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="flex flex-col gap-[22px]">
      <input type="hidden" name="source" value={source === "contact_page" ? "CONTACT_PAGE" : "HOME_FORM"} />

      {state.message && (
        <div role="alert" className="rounded-[12px] border-2 border-[#b42318] bg-[#fdecec] text-[#b42318] px-4 py-3 text-[15px]">
          {state.message}
        </div>
      )}

      <div className="flex flex-wrap gap-[18px]">
        <div className="flex-1 min-w-[240px] flex flex-col gap-[7px]">
          <label htmlFor={id("name")} className="text-[16px] font-bold text-azubi-green-900">
            Full name
          </label>
          <input
            id={id("name")}
            name="fullName"
            type="text"
            autoComplete="name"
            required
            defaultValue={values.fullName}
            aria-invalid={!!errors.fullName}
            aria-describedby={errors.fullName ? id("name-err") : undefined}
            className={`${inputClass} ${errors.fullName ? errorInputClass : ""}`}
          />
          {errors.fullName && (
            <p id={id("name-err")} className="text-[14px] text-[#b42318]">
              {errors.fullName}
            </p>
          )}
        </div>
        <div className="flex-1 min-w-[240px] flex flex-col gap-[7px]">
          <label htmlFor={id("email")} className="text-[16px] font-bold text-azubi-green-900">
            Email address
          </label>
          <input
            id={id("email")}
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={values.email}
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? id("email-err") : undefined}
            className={`${inputClass} ${errors.email ? errorInputClass : ""}`}
          />
          {errors.email && (
            <p id={id("email-err")} className="text-[14px] text-[#b42318]">
              {errors.email}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-[18px]">
        <div className="flex-1 min-w-[240px] flex flex-col gap-[7px]">
          <label htmlFor={id("org")} className="text-[16px] font-bold text-azubi-green-900">
            Organisation <span className="font-normal text-azubi-muted">(optional)</span>
          </label>
          <input id={id("org")} name="organisation" type="text" autoComplete="organization" defaultValue={values.organisation} className={inputClass} />
        </div>
        <div className="flex-1 min-w-[240px] flex flex-col gap-[7px]">
          <label htmlFor={id("role")} className="text-[16px] font-bold text-azubi-green-900">
            I am writing as
          </label>
          <select id={id("role")} name="writingAs" defaultValue={values.writingAs ?? defaultWritingAs ?? WRITING_AS_OPTIONS[0]} className={inputClass}>
            {WRITING_AS_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-[7px]">
        <label htmlFor={id("msg")} className="text-[16px] font-bold text-azubi-green-900">
          Message
        </label>
        <textarea
          id={id("msg")}
          name="message"
          rows={5}
          required
          maxLength={4000}
          defaultValue={values.message}
          aria-invalid={!!errors.message}
          aria-describedby={errors.message ? id("msg-err") : undefined}
          className={`${inputClass} ${errors.message ? errorInputClass : ""}`}
        />
        {errors.message && (
          <p id={id("msg-err")} className="text-[14px] text-[#b42318]">
            {errors.message}
          </p>
        )}
      </div>

      {/* Honeypot — real users never see or fill this. */}
      <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
        <label htmlFor={id("hp")}>Leave this field empty</label>
        <input id={id("hp")} name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <label htmlFor={id("consent")} className="flex gap-3 items-start text-[16px] text-azubi-muted">
        <input id={id("consent")} name="consent" type="checkbox" required className="w-[22px] h-[22px] mt-[1px] accent-azubi-green-900 flex-none" />
        <span>
          I agree that Azubi Foundation may use these details to reply to me. Read the{" "}
          <Link href="/azubi/privacy" className="text-azubi-green-700 underline">
            privacy notice
          </Link>
          . Please do not send details of a legal matter.
        </span>
      </label>
      {errors.consent && <p className="text-[14px] text-[#b42318] -mt-3">{errors.consent}</p>}

      <div>
        <AzubiSubmitButton disabled={pending}>{pending ? "Sending…" : "Send message"}</AzubiSubmitButton>
      </div>
    </form>
  );
}
