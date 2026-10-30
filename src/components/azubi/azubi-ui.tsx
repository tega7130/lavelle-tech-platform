import { cn } from "@/lib/cn";

export function AzubiKicker({ dot = "bg-azubi-apricot", children }: { dot?: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-[10px] font-azubi font-bold text-[13px] tracking-[0.16em] uppercase text-azubi-green-900">
      <i aria-hidden="true" className={cn("w-[12px] h-[12px] rounded-[4px] block flex-none", dot)} />
      {children}
    </span>
  );
}

export function AzubiTag({ bg = "bg-azubi-sage-light", children }: { bg?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-block font-azubi font-bold text-[13px] leading-[1.4] tracking-[0.12em] uppercase text-center px-[14px] py-[9px] rounded-[14px] text-azubi-green-900",
        bg
      )}
    >
      {children}
    </span>
  );
}

/** Downward chevron for custom-styled (appearance: none) selects — see azubiSelectClass. */
export function AzubiSelectChevron() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute right-[14px] top-1/2 -translate-y-1/2 text-azubi-green-900"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
    >
      <path d="M2.5 5L7 9.5L11.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Strips the native select arrow and reserves room for AzubiSelectChevron
 * instead — the browser's own arrow was overlapping short/narrow fields
 * like the phone dial-code select, with neither the arrow nor the text
 * comfortably fitting.
 */
export const azubiSelectClass = "appearance-none pr-[38px] bg-none";

export function AzubiDisc({ bg = "bg-azubi-apricot", children }: { bg?: string; children: React.ReactNode }) {
  return (
    <span className={cn("grid place-items-center w-9 h-9 rounded-full font-azubi font-bold text-[18px] text-azubi-green-900 flex-none", bg)}>
      {children}
    </span>
  );
}

/** A radio/checkbox styled as a bordered card, highlighting apricot when checked (design's `.choice`). */
export function AzubiChoice({
  id,
  name,
  type,
  value,
  required,
  defaultChecked,
  onChange,
  children,
  className,
}: {
  id: string;
  name: string;
  type: "radio" | "checkbox";
  value: string;
  required?: boolean;
  defaultChecked?: boolean;
  onChange?: (checked: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex gap-3 items-center border-2 border-azubi-mint bg-white rounded-[14px] px-4 py-[13px] text-[17px] min-h-[52px] cursor-pointer flex-1 basis-[200px]",
        "has-[:checked]:bg-azubi-apricot-100 has-[:checked]:border-azubi-green-900",
        className
      )}
    >
      <input
        id={id}
        name={name}
        type={type}
        value={value}
        required={required}
        defaultChecked={defaultChecked}
        onChange={onChange ? (e) => onChange(e.target.checked) : undefined}
        className="w-[22px] h-[22px] m-0 accent-azubi-green-900 flex-none"
      />
      {children}
    </label>
  );
}

export function AzubiFaqItem({ question, children }: { question: string; children: React.ReactNode }) {
  return (
    <details className="group bg-white rounded-[16px] px-5">
      <summary className="list-none cursor-pointer flex justify-between items-center gap-4 min-h-[60px] py-3 font-azubi font-bold text-[18px] leading-[1.4] text-azubi-green-900 [&::-webkit-details-marker]:hidden">
        {question}
        <span
          aria-hidden="true"
          className="grid place-items-center w-[30px] h-[30px] rounded-[8px] bg-azubi-apricot text-[20px] leading-none flex-none group-open:hidden"
        >
          +
        </span>
        <span
          aria-hidden="true"
          className="hidden group-open:grid place-items-center w-[30px] h-[30px] rounded-[8px] bg-azubi-apricot text-[20px] leading-none flex-none"
        >
          &#8211;
        </span>
      </summary>
      <div className="pb-5 text-[17px] leading-[1.7] text-azubi-muted max-w-[60ch]">{children}</div>
    </details>
  );
}
