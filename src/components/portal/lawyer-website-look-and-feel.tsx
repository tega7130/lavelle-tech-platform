"use client";

import * as React from "react";
import { updateLawyerWebsiteLookAndFeelAction } from "@/app/actions/lawyer-website";
import { emptyActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { FieldError } from "@/components/ui/field";
import { StepCard } from "@/components/portal/lawyer-website-builder";
import { LAWYER_WEBSITE_TEMPLATES, LAWYER_WEBSITE_COLOR_THEMES, LAWYER_WEBSITE_FONT_PAIRINGS } from "@/lib/lawyer-website-templates";

export function LawyerWebsiteLookAndFeel({
  templateKey,
  colorThemeKey,
  fontPairingKey,
}: {
  templateKey: string | null;
  colorThemeKey: string | null;
  fontPairingKey: string | null;
}) {
  const [template, setTemplate] = React.useState(templateKey ?? LAWYER_WEBSITE_TEMPLATES[0].key);
  const [colorTheme, setColorTheme] = React.useState(colorThemeKey ?? LAWYER_WEBSITE_COLOR_THEMES[0].key);
  const [fontPairing, setFontPairing] = React.useState(fontPairingKey ?? LAWYER_WEBSITE_FONT_PAIRINGS[0].key);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    const fd = new FormData();
    fd.set("templateKey", template);
    fd.set("colorThemeKey", colorTheme);
    fd.set("fontPairingKey", fontPairing);
    const result = await updateLawyerWebsiteLookAndFeelAction(emptyActionState, fd);
    setSaving(false);
    if (!result.ok) {
      setError(result.message ?? "Could not save your look & feel.");
      return;
    }
    setSaved(true);
  }

  return (
    <StepCard title="Look & feel">
      <p className="text-[13px] text-neutral-600 mb-[var(--space-4)] max-w-[60ch]">
        Placeholder templates and colors for now — real designs are on the way. Everything here is free.
      </p>

      <div className="mb-[var(--space-4)]">
        <div className="text-[12px] font-medium text-neutral-700 mb-2">Template</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {LAWYER_WEBSITE_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTemplate(t.key)}
              className={`text-left rounded-md border p-3 cursor-pointer ${template === t.key ? "border-accent bg-accent-100" : "border-neutral-300 hover:bg-neutral-100"}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium">{t.name}</span>
                {t.tier === "PAID" && <Tag variant="accent-2">Paid</Tag>}
              </div>
              <div className="text-[11.5px] text-neutral-500 mt-0.5">{t.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-[var(--space-4)]">
        <div className="text-[12px] font-medium text-neutral-700 mb-2">Color theme</div>
        <div className="flex flex-wrap gap-2.5">
          {LAWYER_WEBSITE_COLOR_THEMES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setColorTheme(c.key)}
              title={c.name}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 cursor-pointer ${colorTheme === c.key ? "border-accent" : "border-neutral-300 hover:bg-neutral-100"}`}
            >
              <span className="flex gap-1">
                <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: c.primary }} />
                <span className="w-4 h-4 rounded-full border border-black/10" style={{ background: c.accent }} />
              </span>
              <span className="text-[12.5px]">{c.name}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mb-[var(--space-4)]">
        <div className="text-[12px] font-medium text-neutral-700 mb-2">Typography</div>
        <div className="flex flex-wrap gap-2.5">
          {LAWYER_WEBSITE_FONT_PAIRINGS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFontPairing(f.key)}
              style={{ fontFamily: f.headingFont }}
              className={`rounded-md border px-3 py-1.5 cursor-pointer text-[13px] ${fontPairing === f.key ? "border-accent bg-accent-100" : "border-neutral-300 hover:bg-neutral-100"}`}
            >
              {f.name}
            </button>
          ))}
        </div>
      </div>

      <FieldError>{error}</FieldError>
      {saved && <p className="text-[12px] text-[#15803d] mb-[6px]">Saved.</p>}
      <Button onClick={save} disabled={saving}>
        {saving ? "Saving…" : "Save look & feel"}
      </Button>
    </StepCard>
  );
}
