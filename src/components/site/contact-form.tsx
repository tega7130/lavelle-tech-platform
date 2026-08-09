"use client";

import * as React from "react";
import { useActionState } from "react";
import { submitEnquiry, type SubmitEnquiryState } from "@/app/actions/website";
import { buttonClassName } from "@/components/ui/button";

const YEARS_OPTIONS = ["Not yet called", "0–2 years", "3–5 years", "6–10 years", "10+ years"];

export function ContactForm({ listings }: { listings: { code: string; title: string }[] }) {
  const [state, formAction, pending] = useActionState<SubmitEnquiryState, FormData>(submitEnquiry, null);

  if (state?.ok) {
    return (
      <div className="text-center py-[22px]">
        <div className="w-[50px] h-[50px] mx-auto rounded-full bg-accent-2-100 border border-accent-2-300 flex items-center justify-center text-accent-2-800 text-[20px] font-bold">
          ✓
        </div>
        <h3 className="font-heading font-semibold text-[20px] mt-[18px]">Thank you. That is with us</h3>
        <p className="text-[13.5px] leading-[1.68] text-neutral-700 mt-[10px] mx-auto max-w-[38ch]">
          Your enquiry is logged as <strong className="text-text">{state.reference}</strong>. A representative will reply within one working day.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction}>
      <h3 className="font-heading font-semibold text-[19px]">Contact a representative</h3>
      <div className="text-[12.5px] text-neutral-700 mt-[5px]">We reply within one working day.</div>

      <div className="grid grid-cols-2 gap-[13px] mt-[22px]">
        <div>
          <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">Full name</label>
          <input name="name" required className="lv-in w-full h-11 px-3 rounded-[9px] border border-neutral-300 bg-bg text-[14px]" placeholder="Adaeze Okonkwo" />
        </div>
        <div>
          <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">Email address</label>
          <input name="email" type="email" required className="lv-in w-full h-11 px-3 rounded-[9px] border border-neutral-300 bg-bg text-[14px]" placeholder="you@firm.com" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-[13px] mt-[14px]">
        <div>
          <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">Phone (optional)</label>
          <input name="phone" className="lv-in w-full h-11 px-3 rounded-[9px] border border-neutral-300 bg-bg text-[14px]" placeholder="+234 803 552 8841" />
        </div>
        <div>
          <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">Years in practice</label>
          <select name="yearsInPractice" defaultValue="3–5 years" className="lv-in w-full h-11 px-3 rounded-[9px] border border-neutral-300 bg-bg text-[14px]">
            {YEARS_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-[14px]">
        <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">Programme of interest</label>
        <select name="programmeOfInterestCode" defaultValue="" className="lv-in w-full h-11 px-3 rounded-[9px] border border-neutral-300 bg-bg text-[14px]">
          <option value="">Not sure yet, please advise</option>
          {listings.map((l) => (
            <option key={l.code} value={l.code}>
              {l.title}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-[14px]">
        <label className="lv-lab block text-[12px] font-medium text-neutral-700 mb-[6px]">What would you like to know?</label>
        <textarea
          name="message"
          required
          rows={4}
          className="lv-in w-full px-3 py-[11px] rounded-[9px] border border-neutral-300 bg-bg text-[14px] leading-[1.6] resize-y"
          placeholder="I am six years into commercial practice and increasingly doing energy work. Which tier should I start at?"
        />
      </div>

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

      <button type="submit" disabled={pending} className={buttonClassName("primary", "w-full mt-5 h-[50px] rounded-[9px] text-[14.5px]")}>
        {pending ? "Sending…" : "Send enquiry"}
      </button>
      <div className="text-[11px] text-neutral-700 text-center mt-3">No obligation, and we never share your details.</div>
    </form>
  );
}
