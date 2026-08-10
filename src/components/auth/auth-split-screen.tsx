import * as React from "react";

export interface AuthSplitScreenProps {
  kicker: string;
  title: string;
  body?: string;
  /** The ladder (Register) or assurances list (Sign in) — brand-panel content below the intro copy. */
  children?: React.ReactNode;
  topRight: React.ReactNode;
  formChildren: React.ReactNode;
  formMaxWidth?: string;
  /** Overrides the panel's background — the admin console uses a darker ground than the candidate portal so the two are never confused (Slice 10 README A6). Defaults to the brand's standard institutional gradient. */
  panelClassName?: string;
  /** The small caps line under the wordmark — "Professional Specialization" for candidates, "Administration" for staff. */
  logoSubtitle?: string;
  /** Overrides the panel's bottom-left footer row. Defaults to the candidate portal's own. */
  footer?: React.ReactNode;
}

/** Shared split-screen shell for Register/Sign in — the deep-blue institutional panel plus the form column. */
export function AuthSplitScreen({
  kicker,
  title,
  body,
  children,
  topRight,
  formChildren,
  formMaxWidth = "452px",
  panelClassName = "lv-gradient",
  logoSubtitle = "Professional Specialization",
  footer,
}: AuthSplitScreenProps) {
  return (
    <div className="flex min-h-screen bg-surface text-text font-body max-[900px]:flex-col">
      <div
        className={`relative flex w-[42%] min-w-[360px] flex-none flex-col overflow-hidden p-12 text-white max-[900px]:w-auto max-[900px]:min-h-0 max-[900px]:px-6 max-[900px]:py-7 ${panelClassName}`}
      >
        <div
          className="pointer-events-none absolute -top-[140px] -right-[120px] h-[420px] w-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(22,104,227,.42), rgba(22,104,227,0) 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-[90px] -left-[70px] h-[300px] w-[300px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(255,198,41,.13), rgba(255,198,41,0) 70%)" }}
        />

        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[10px] bg-accent-2 font-heading text-2xl font-bold text-[#08234a]">
            L
          </div>
          <div>
            <div className="font-heading text-lg font-bold tracking-[0.02em]">LAVELLE INSTITUTE</div>
            <div className="text-[10px] tracking-[0.14em] text-white/62 uppercase">{logoSubtitle}</div>
          </div>
        </div>

        <div className="relative mt-auto pt-14">
          <div className="text-[10px] tracking-[0.16em] text-accent-2 uppercase">{kicker}</div>
          <h1 className="mt-3.5 max-w-[20ch] text-[34px] leading-[1.18] tracking-[-0.02em] text-white text-balance">
            {title}
          </h1>
          {body && <p className="mt-4 max-w-[42ch] text-sm leading-[1.65] text-white/72 text-pretty">{body}</p>}

          {children}
        </div>

        <div className="relative mt-auto flex gap-6 pt-12 text-[11px] text-white/45 max-[900px]:hidden">
          {footer ?? (
            <>
              <span>Intakes: January · April · September</span>
              <span>candidates@lavelle.ng</span>
            </>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-9 px-12 pb-14 max-[900px]:px-5 max-[900px]:pb-12">
        <div className="flex items-center justify-end gap-2 text-[13px] text-neutral-600">{topRight}</div>
        <div
          className="mx-auto flex w-full flex-1 flex-col justify-center py-7"
          style={{ maxWidth: formMaxWidth }}
        >
          {formChildren}
        </div>
      </div>
    </div>
  );
}
