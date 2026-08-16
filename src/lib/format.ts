/** feeMinor is integer kobo — never format a float, ever (rule 1). */
export function formatNaira(feeMinor: number): string {
  const naira = feeMinor / 100;
  return `₦${naira.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export function tierLabel(tier: string): string {
  return { FOUNDATION: "Foundation", SPECIALIST: "Specialist", ADVANCED_PRACTITIONER: "Advanced Practitioner" }[tier] ?? tier;
}

const INTAKE_MONTH_LABEL: Record<string, string> = { JANUARY: "January", APRIL: "April", SEPTEMBER: "September" };

export function intakeLabel(month: string, year: number): string {
  return `${INTAKE_MONTH_LABEL[month] ?? month} ${year}`;
}

export function statusLabel(status: string): string {
  return { DRAFT: "Draft", ACTIVE: "Active", ARCHIVED: "Archived" }[status] ?? status;
}

export function professionalStatusLabel(status: string): string {
  return (
    {
      PRACTISING_LAWYER: "Practising Lawyer",
      INHOUSE_COUNSEL: "In-house Counsel",
      LAW_GRADUATE: "Law Graduate",
      LAW_STUDENT: "Law Student",
      REGULATED_NON_LAWYER: "Non-lawyer in a regulated industry",
      OTHER: "Other",
    }[status] ?? status
  );
}

export function experienceBandLabel(band: string): string {
  return { Y0_2: "0–2 years", Y3_5: "3–5 years", Y6_10: "6–10 years", Y10_PLUS: "10+ years" }[band] ?? band;
}

/** Converts a youtube.com/watch, youtu.be or already-embed URL to an embeddable src — null for anything else (a direct hosted video file). */
export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.endsWith("youtube.com")) {
      if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith("/embed/")) return url;
    }
    return null;
  } catch {
    return null;
  }
}
