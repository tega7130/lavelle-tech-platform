"use client";

import * as React from "react";
import { AZUBI_COUNTRIES } from "@/lib/azubi/countries";

const inputClass =
  "font-azubi text-[17px] px-[14px] py-[13px] border-2 border-azubi-sage rounded-[12px] bg-white text-azubi-ink min-h-[50px] focus:border-azubi-green-900 focus:outline-none";

/** Dial-code select + local number input — submitted as two fields and combined server-side into one `phone` string. */
export function AzubiPhoneField({
  idPrefix,
  dialDefault,
  numberDefault,
  required,
  invalid,
  resyncKey,
}: {
  idPrefix: string;
  dialDefault?: string;
  numberDefault?: string;
  required?: boolean;
  invalid?: boolean;
  /** The parent's useActionState `state` object — changes identity on every
   *  dispatch (even if field values repeat), so it reliably re-triggers the
   *  resync effect below on every submission, not just ones with new values. */
  resyncKey?: unknown;
}) {
  // Controlled, not defaultValue: a native <select> doesn't keep a
  // resettable default the way <input defaultValue> does, so React's
  // form-action reset (fired after every submission, success or not)
  // reverts it to the first option — wiping the chosen dial code on any
  // validation error. Controlled alone isn't quite enough either (the
  // reset can land after React's own render with nothing left to
  // trigger another one), so the effect below re-asserts the DOM value
  // imperatively every time a fresh value arrives from the parent.
  const [dial, setDial] = React.useState(dialDefault ?? "+234");
  const selectRef = React.useRef<HTMLSelectElement>(null);

  React.useEffect(() => {
    if (selectRef.current) selectRef.current.value = dial;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resyncKey]);

  return (
    <div className="flex gap-[8px]">
      <select
        id={`${idPrefix}-dial`}
        name="phoneDialCode"
        ref={selectRef}
        value={dial}
        onChange={(e) => setDial(e.target.value)}
        aria-label="Country code"
        className={`${inputClass} w-[110px] flex-none px-[8px]`}
      >
        {AZUBI_COUNTRIES.map((c) => (
          <option key={c.iso2} value={c.dial}>
            {c.dial} {c.iso2}
          </option>
        ))}
      </select>
      <input
        id={`${idPrefix}-number`}
        name="phoneNumber"
        type="tel"
        autoComplete="tel-national"
        required={required}
        defaultValue={numberDefault}
        aria-invalid={invalid}
        className={`${inputClass} flex-1 min-w-0 ${invalid ? "border-[#b42318]" : ""}`}
      />
    </div>
  );
}
