"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { submitAzubiApplicationAction } from "@/app/actions/azubi";
import { emptyActionState } from "@/lib/action-state";
import { AzubiKicker, AzubiChoice } from "./azubi-ui";
import { AzubiSubmitButton } from "./azubi-button";
import { AzubiPhoneField } from "./azubi-phone-field";
import { AzubiCountrySelect } from "./azubi-country-select";
import { NIGERIA_STATES } from "@/lib/azubi/nigeria-states";

const inputClass =
  "font-azubi text-[17px] px-[14px] py-[13px] border-2 border-azubi-sage rounded-[12px] bg-white text-azubi-ink min-h-[50px] w-full focus:border-azubi-green-900 focus:outline-none";
const errorInputClass = "border-[#b42318]";
const legendClass = "text-[16px] font-bold text-azubi-green-900 p-0";

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-[14px] text-[#b42318]">
      {message}
    </p>
  );
}

export function AzubiApplyForm() {
  const [state, formAction, pending] = useActionState(submitAzubiApplicationAction, emptyActionState);
  const errors = state.errors ?? {};
  const values = state.values ?? {};
  const [country, setCountry] = React.useState(values.country ?? "Nigeria");
  // Controlled, not defaultValue: React's form-action reset reverts a native
  // <select> to its first <option> (no attribute for it to restore to, unlike
  // <input defaultValue>), wiping a chosen state on every failed submission.
  // A controlled value survives that reset since React re-asserts it on render.
  const [stateValue, setStateValue] = React.useState(values.state ?? "");
  const stateFieldRef = React.useRef<HTMLSelectElement | HTMLInputElement>(null);
  // Being controlled isn't quite enough on its own: React only re-asserts
  // the controlled value when IT re-renders, but the browser's post-action
  // form reset can land after that render with nothing left to trigger
  // another one. This effect re-runs on every server round trip (`state`
  // changes identity each dispatch) and forces the DOM back in sync.
  React.useEffect(() => {
    if (stateFieldRef.current) stateFieldRef.current.value = stateValue;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const selectedAreas = (values.areas ?? "").split(",");
  const [otherChecked, setOtherChecked] = React.useState(() => selectedAreas.includes("other"));

  if (state.ok) {
    return (
      <div role="status" className="flex-[2] min-w-[300px] bg-white border-2 border-azubi-mint rounded-[28px] p-6 sm:p-9 lg:p-11 flex flex-col gap-3 items-center text-center py-16">
        <span className="grid place-items-center w-14 h-14 rounded-full bg-azubi-green-900 text-white text-[26px]">✓</span>
        <h2 className="text-[26px]">Application received</h2>
        <p className="text-azubi-muted text-[17px] max-w-[46ch]">
          Thank you for applying to the Azubi Foundation fellowship. We review every application and will contact
          shortlisted applicants by email. Applying does not guarantee a placement.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate className="flex-[2] min-w-[300px] flex flex-col gap-8 bg-white border-2 border-azubi-mint rounded-[28px] p-6 sm:p-9 lg:p-11">
      {state.message && (
        <div role="alert" className="rounded-[12px] border-2 border-[#b42318] bg-[#fdecec] text-[#b42318] px-4 py-3 text-[15px]">
          {state.message}
        </div>
      )}
      {Object.keys(errors).length > 0 && (
        <div role="alert" className="rounded-[12px] border-2 border-[#b42318] bg-[#fdecec] text-[#b42318] px-4 py-3 text-[15px]">
          <p className="font-bold mb-1">Please fix the following:</p>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            {Object.values(errors).map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-col gap-[22px]">
        <AzubiKicker>About you</AzubiKicker>
        <div className="flex flex-wrap gap-[18px]">
          <div className="flex-1 min-w-[240px] flex flex-col gap-[7px]">
            <label htmlFor="a-name" className="text-[16px] font-bold text-azubi-green-900">
              Full name
            </label>
            <input
              id="a-name"
              name="fullName"
              type="text"
              autoComplete="name"
              required
              defaultValue={values.fullName}
              aria-invalid={!!errors.fullName}
              className={`${inputClass} ${errors.fullName ? errorInputClass : ""}`}
            />
            <FieldError id="a-name-err" message={errors.fullName} />
          </div>
          <div className="flex-1 min-w-[240px] flex flex-col gap-[7px]">
            <label htmlFor="a-email" className="text-[16px] font-bold text-azubi-green-900">
              Email address
            </label>
            <input
              id="a-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              defaultValue={values.email}
              aria-invalid={!!errors.email}
              className={`${inputClass} ${errors.email ? errorInputClass : ""}`}
            />
            <FieldError id="a-email-err" message={errors.email} />
          </div>
        </div>
        <div className="flex flex-wrap gap-[18px]">
          <div className="flex-1 min-w-[240px] flex flex-col gap-[7px]">
            <label htmlFor="a-phone-number" className="text-[16px] font-bold text-azubi-green-900">
              Phone number
            </label>
            <AzubiPhoneField
              idPrefix="a-phone"
              dialDefault={values.phoneDialCode}
              numberDefault={values.phoneNumber}
              required
              invalid={!!errors.phoneNumber}
              resyncKey={state}
            />
            <FieldError id="a-phone-err" message={errors.phoneNumber} />
          </div>
          <div className="flex-1 min-w-[240px] flex flex-col gap-[7px]">
            <label htmlFor="a-country" className="text-[16px] font-bold text-azubi-green-900">
              Country
            </label>
            <AzubiCountrySelect id="a-country" name="country" defaultValue={country} required onSelectCountry={setCountry} />
            <FieldError id="a-country-err" message={errors.country} />
          </div>
        </div>
        <div className="flex flex-wrap gap-[18px]">
          <div className="flex-1 min-w-[240px] flex flex-col gap-[7px]">
            <label htmlFor="a-state" className="text-[16px] font-bold text-azubi-green-900">
              State of residence
            </label>
            {country === "Nigeria" ? (
              <select
                id="a-state"
                name="state"
                required
                ref={stateFieldRef as React.RefObject<HTMLSelectElement>}
                value={stateValue}
                onChange={(e) => setStateValue(e.target.value)}
                aria-invalid={!!errors.state}
                className={`${inputClass} ${errors.state ? errorInputClass : ""}`}
              >
                <option value="" disabled>
                  Choose a state
                </option>
                {NIGERIA_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="a-state"
                name="state"
                type="text"
                autoComplete="address-level1"
                required
                ref={stateFieldRef as React.RefObject<HTMLInputElement>}
                value={stateValue}
                onChange={(e) => setStateValue(e.target.value)}
                aria-invalid={!!errors.state}
                placeholder="State, province or region"
                className={`${inputClass} ${errors.state ? errorInputClass : ""}`}
              />
            )}
            <FieldError id="a-state-err" message={errors.state} />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-[22px]">
        <AzubiKicker dot="bg-azubi-sage-light">Where you are now</AzubiKicker>
        <fieldset className="flex flex-col gap-[10px]">
          <legend className={legendClass}>Your current status</legend>
          <div className="flex flex-wrap gap-[10px] mt-[10px]">
            <AzubiChoice id="a-st1" name="statusKind" type="radio" value="student" required defaultChecked={values.statusKind === "student"}>
              Law student
            </AzubiChoice>
            <AzubiChoice id="a-st2" name="statusKind" type="radio" value="awaiting_call" defaultChecked={values.statusKind === "awaiting_call"}>
              Completed law school, awaiting call to the Bar
            </AzubiChoice>
            <AzubiChoice id="a-st3" name="statusKind" type="radio" value="called" defaultChecked={values.statusKind === "called"}>
              Called to the Nigerian Bar
            </AzubiChoice>
          </div>
          <FieldError id="a-status-err" message={errors.statusKind} />
        </fieldset>
        <div className="flex flex-col gap-[7px]">
          <label htmlFor="a-inst" className="text-[16px] font-bold text-azubi-green-900">
            University or law school attended
          </label>
          <input
            id="a-inst"
            name="institution"
            type="text"
            required
            defaultValue={values.institution}
            aria-invalid={!!errors.institution}
            className={`${inputClass} ${errors.institution ? errorInputClass : ""}`}
          />
          <FieldError id="a-inst-err" message={errors.institution} />
        </div>
      </div>

      <div className="flex flex-col gap-[22px]">
        <AzubiKicker dot="bg-azubi-sage-light">How you would like to work</AzubiKicker>
        <fieldset className="flex flex-col gap-[10px]">
          <legend className={legendClass}>Working mode</legend>
          <div className="flex flex-wrap gap-[10px] mt-[10px]">
            <AzubiChoice
              id="a-w1"
              name="workingMode"
              type="radio"
              value="onsite"
              required
              className="basis-[120px]"
              defaultChecked={values.workingMode === "onsite"}
            >
              Onsite
            </AzubiChoice>
            <AzubiChoice id="a-w2" name="workingMode" type="radio" value="hybrid" className="basis-[120px]" defaultChecked={values.workingMode === "hybrid"}>
              Hybrid
            </AzubiChoice>
            <AzubiChoice id="a-w3" name="workingMode" type="radio" value="online" className="basis-[120px]" defaultChecked={values.workingMode === "online"}>
              Online
            </AzubiChoice>
          </div>
          <FieldError id="a-mode-err" message={errors.workingMode} />
        </fieldset>
        <fieldset className="flex flex-col gap-[10px]">
          <legend className={legendClass}>Areas you would like exposure to</legend>
          <div className="flex flex-wrap gap-[10px] mt-[10px]">
            <AzubiChoice id="a-i1" name="areas" type="checkbox" value="corporate_commercial" defaultChecked={selectedAreas.includes("corporate_commercial")}>
              Corporate and commercial
            </AzubiChoice>
            <AzubiChoice id="a-i2" name="areas" type="checkbox" value="litigation_dispute" defaultChecked={selectedAreas.includes("litigation_dispute")}>
              Litigation and dispute resolution
            </AzubiChoice>
            <AzubiChoice id="a-i3" name="areas" type="checkbox" value="property_land" defaultChecked={selectedAreas.includes("property_land")}>
              Property and land
            </AzubiChoice>
            <AzubiChoice id="a-i4" name="areas" type="checkbox" value="research_policy" defaultChecked={selectedAreas.includes("research_policy")}>
              Research and policy
            </AzubiChoice>
            <AzubiChoice id="a-i5" name="areas" type="checkbox" value="other" defaultChecked={otherChecked} onChange={setOtherChecked}>
              Other
            </AzubiChoice>
          </div>
          <FieldError id="a-areas-err" message={errors.areas} />
          {otherChecked && (
            <div className="flex flex-col gap-[7px] mt-[4px]">
              <label htmlFor="a-other-area" className="text-[16px] font-bold text-azubi-green-900">
                Tell us what other area you mean
              </label>
              <input
                id="a-other-area"
                name="otherAreaDetail"
                type="text"
                required
                maxLength={200}
                defaultValue={values.otherAreaDetail}
                aria-invalid={!!errors.otherAreaDetail}
                className={`${inputClass} ${errors.otherAreaDetail ? errorInputClass : ""}`}
              />
              <FieldError id="a-other-area-err" message={errors.otherAreaDetail} />
            </div>
          )}
        </fieldset>
      </div>

      <div className="flex flex-col gap-[22px]">
        <AzubiKicker>In your words</AzubiKicker>
        <div className="flex flex-col gap-[7px]">
          <label htmlFor="a-stmt" className="text-[16px] font-bold text-azubi-green-900">
            Why do you want to join the fellowship?
          </label>
          <textarea
            id="a-stmt"
            name="statement"
            rows={6}
            required
            maxLength={1500}
            defaultValue={values.statement}
            aria-invalid={!!errors.statement}
            className={`${inputClass} ${errors.statement ? errorInputClass : ""}`}
          />
          <FieldError id="a-stmt-err" message={errors.statement} />
        </div>

        {/* Honeypot — real users never see or fill this. */}
        <div aria-hidden="true" className="absolute left-[-9999px] w-px h-px overflow-hidden">
          <label htmlFor="a-hp">Leave this field empty</label>
          <input id="a-hp" name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <label htmlFor="a-consent" className="flex gap-3 items-start text-[16px] text-azubi-muted">
          <input
            id="a-consent"
            name="consent"
            type="checkbox"
            required
            defaultChecked={values.consent === "on" || values.consent === "true"}
            className="w-[22px] h-[22px] mt-[1px] accent-azubi-green-900 flex-none"
          />
          <span>
            I confirm that the information above is accurate and I agree that Azubi Foundation may use it to assess
            my application. Read the{" "}
            <Link href="/azubi/privacy" className="text-azubi-green-700 underline">
              privacy notice
            </Link>
            .
          </span>
        </label>
        <FieldError id="a-consent-err" message={errors.consent} />

        <div>
          <AzubiSubmitButton disabled={pending}>{pending ? "Submitting…" : "Submit application"}</AzubiSubmitButton>
          <p className="text-[15px] text-azubi-muted mt-3">Applying does not guarantee a placement.</p>
        </div>
      </div>
    </form>
  );
}
