/** feeMinor is integer kobo — never format a float, ever (rule 1). */
export function formatNaira(feeMinor: number): string {
  const naira = feeMinor / 100;
  return `₦${naira.toLocaleString("en-NG", { maximumFractionDigits: 0 })}`;
}

export function tierLabel(tier: string): string {
  return { FOUNDATION: "Foundation", SPECIALIST: "Specialist", ADVANCED_PRACTITIONER: "Advanced Practitioner" }[tier] ?? tier;
}

export function statusLabel(status: string): string {
  return { DRAFT: "Draft", ACTIVE: "Active", ARCHIVED: "Archived" }[status] ?? status;
}
