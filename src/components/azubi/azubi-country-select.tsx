"use client";

import * as React from "react";
import { AZUBI_COUNTRIES } from "@/lib/azubi/countries";

const inputClass =
  "font-azubi text-[17px] px-[14px] py-[13px] border-2 border-azubi-sage rounded-[12px] bg-white text-azubi-ink min-h-[50px] w-full focus:border-azubi-green-900 focus:outline-none";

/**
 * A searchable country combobox (build brief: "they can also search in the
 * dropdown"). The visible input is just for typing/filtering; the actual
 * submitted value is the hidden input, only set once a real option is
 * chosen — typed text that never resolves to a country submits empty,
 * which zod then rejects.
 */
export function AzubiCountrySelect({
  id,
  name,
  defaultValue,
  required,
  onSelectCountry,
}: {
  id: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  onSelectCountry?: (countryName: string) => void;
}) {
  const [query, setQuery] = React.useState(defaultValue ?? "");
  const [selected, setSelected] = React.useState(defaultValue ?? "");
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const matches = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === selected.toLowerCase()) return AZUBI_COUNTRIES;
    return AZUBI_COUNTRIES.filter((c) => c.name.toLowerCase().includes(q));
  }, [query, selected]);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery(selected);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, selected]);

  function choose(name: string) {
    setSelected(name);
    setQuery(name);
    setOpen(false);
    onSelectCountry?.(name);
  }

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={selected} required={required} />
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        aria-autocomplete="list"
        autoComplete="off"
        placeholder="Start typing to search…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className={inputClass}
      />
      {open && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-20 mt-[6px] max-h-[260px] w-full overflow-y-auto bg-white border-2 border-azubi-mint rounded-[12px] shadow-[0_12px_32px_rgba(15,58,48,0.14)] py-[6px]"
        >
          {matches.length === 0 && <li className="px-[14px] py-[10px] text-[15px] text-azubi-muted">No matching country</li>}
          {matches.map((c) => (
            <li key={c.iso2}>
              <button
                type="button"
                role="option"
                aria-selected={c.name === selected}
                onClick={() => choose(c.name)}
                className="w-full text-left px-[14px] py-[10px] text-[16px] text-azubi-ink hover:bg-azubi-mint cursor-pointer"
              >
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
