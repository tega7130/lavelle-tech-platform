"use client";

import * as React from "react";
import { useActionState } from "react";
import { submitEnquiry, type SubmitEnquiryState } from "@/app/actions/website";
import { buttonClassName } from "@/components/ui/button";
import { Reveal, CTA_HOVER } from "@/components/site/motion";
import { cn } from "@/lib/cn";

const YEARS_OPTIONS = ["Not yet called", "0–2 years", "3–5 years", "6–10 years", "10+ years"];

/** Calm border-color focus treatment, matching the search input on the programme catalogue. */
const FIELD = "lv-in w-full h-11 px-3 rounded-[9px] border border-neutral-300 bg-bg text-[14px] outline-none transition-colors duration-200 focus:border-accent-200";
const FIELD_AREA = "lv-in w-full px-3 py-[11px] rounded-[9px] border border-neutral-300 bg-bg text-[14px] leading-[1.6] resize-y outline-none transition-colors duration-200 focus:border-accent-200";

export function ContactForm({ listings }: { listings: { code: string; title: string }[] }) {
  const [state, formAction, pending] = useActionState<SubmitEnquiryState, FormData>(submitEnquiry, null);

  if (state?.ok) {
    return (
      <Reveal variant="scale" className="text-center py-[22px]">
        <div className="w-[50px] h-[50px] mx-auto rounded-full bg-accent-2-100 border border-accent-2-300 flex items-center justify-center text-accent-2-800 text-[20px] font-bold">
          ✓
        </div>
        <h3 className="font-heading font-semibold text-[20px] mt-[18px]">Your enquiry is with us</h3>
        <p className="text-[13.5px] leading-[1.68] text-neutral-700 mt-[10px] mx-auto max-w-[48ch]">
          Thank you for reaching out to Lavelle. Our team will review your enquiry and be in touch within one working day.
        </p>
        <p className="text-[13.5px] leading-[1.68] text-neutral-700 mt-[12px] mx-auto max-w-[48ch]">
          We look forward to speaking with you.
        </p>
      </Reveal>
    );
  }

  return (
    <form action={formAction}>
      <Reveal threshold={0.05}><h3 className="font-heading font-semibold text-[19px]">Contact a representative</h3></Reveal>
      <Reveal delay={60} threshold={0.05}><div className="text-[12.5px] text-neutral-700 mt-[5px]">We reply within one working day.</div></Reveal>

      <Reveal delay={120} threshold={0.05} className="grid grid-cols-1 sm:grid-cols-2 gap-[13px] mt-[22px]">
        <div>
          <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">Full name</label>
          <input name="name" required className={FIELD} placeholder="Adaeze Okonkwo" />
        </div>
        <div>
          <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">Email address</label>
          <input name="email" type="email" required className={FIELD} placeholder="you@firm.com" />
        </div>
      </Reveal>

      <Reveal delay={170} threshold={0.05} className="grid grid-cols-1 sm:grid-cols-2 gap-[13px] mt-[14px]">
        <div>
          <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">Phone</label>
          <input name="phone" required className={FIELD} placeholder="+234 803 552 8841" />
        </div>
        <div>
          <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">Years in practice</label>
          <select name="yearsInPractice" defaultValue="3–5 years" className={FIELD}>
            {YEARS_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </Reveal>

      <Reveal delay={220} threshold={0.05} className="mt-[14px]">
        <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">Programme of interest</label>
        <select name="programmeOfInterestCode" defaultValue="" className={FIELD}>
          <option value="">Not sure yet, please advise</option>
          {listings.map((l) => (
            <option key={l.code} value={l.code}>
              {l.title}
            </option>
          ))}
        </select>
      </Reveal>

      <Reveal delay={270} threshold={0.05} className="mt-[14px]">
        <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">What would you like to know?</label>
        <textarea
          name="message"
          required
          rows={4}
          className={FIELD_AREA}
          placeholder="I am six years into commercial practice and increasingly doing energy work. Which tier should I start at?"
        />
      </Reveal>

      {/* Honeypot — hidden from real visitors via CSS, not display:none (some bots skip those). */}
      <div className="absolute -left-[9999px] opacity-0" aria-hidden="true">
        <label htmlFor="cf-website">Leave this field blank</label>
        <input id="cf-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {state && !state.ok && (
        <div className="flex items-center gap-[6px] mt-3 text-[11.5px] text-[#c0392b]">
          <span>⚠</span>
          <span>{state.error}</span>
        </div>
      )}

      <Reveal delay={320} threshold={0.05}>
        <button type="submit" disabled={pending} className={cn(buttonClassName("primary", "w-full mt-5 h-[50px] rounded-[9px] text-[14.5px]"), CTA_HOVER)}>
          {pending ? "Sending…" : "Send enquiry"}
        </button>
        <div className="text-[11px] text-neutral-700 text-center mt-3">No obligation, and we never share your details.</div>
      </Reveal>
    </form>
  );
}
