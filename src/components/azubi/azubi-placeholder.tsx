import { AZUBI_PLACEHOLDERS, type AzubiPlaceholderKey } from "@/lib/azubi/placeholders";

/** Renders one entry from AZUBI_PLACEHOLDERS with the design's dashed-border `.ph` styling. */
export function AzubiPlaceholder({ k }: { k: AzubiPlaceholderKey }) {
  return (
    <span
      data-azubi-placeholder={k}
      className="bg-azubi-apricot-100 border border-dashed border-azubi-green-700 rounded-[6px] px-[6px] py-[1px] font-semibold"
    >
      {AZUBI_PLACEHOLDERS[k]}
    </span>
  );
}
