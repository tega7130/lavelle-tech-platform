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
}: {
  idPrefix: string;
  dialDefault?: string;
  numberDefault?: string;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <div className="flex gap-[8px]">
      <select
        id={`${idPrefix}-dial`}
        name="phoneDialCode"
        defaultValue={dialDefault ?? "+234"}
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
