import { z } from "zod";
import { OfflinePaymentMode } from "@/generated/prisma/client";

// FormData always carries checkbox values as the string "on" — never a
// real boolean (same pattern as validation/candidate.ts).
const checkboxBoolean = z
  .union([z.literal("on"), z.literal("true"), z.boolean()])
  .optional()
  .transform((v) => v === "on" || v === "true" || v === true);

/**
 * All six required inputs for an offline payment recording (README), each
 * validated server-side — the definition of done is explicit that a
 * recording missing any of these must be refused server-side, not only
 * in the dialog.
 */
// The `error` option on the base type constructor (not a chained
// .min()/.positive()) is what catches a field that's MISSING entirely
// (undefined), not just present-but-empty — zod's base type check runs
// before any chained refinement, so a message attached only to .min(1,
// "...") never fires for a field FormData omitted altogether. Every
// required field below carries its friendly message both ways.
export const offlinePaymentInputSchema = z.object({
  amountNaira: z.coerce.number({ error: "Enter the amount received" }).positive("Enter the amount received"),
  offlineReceivedOn: z.coerce.date({ error: "Enter the date the money arrived" }),
  offlineMode: z.enum(OfflinePaymentMode, { error: "Choose a mode of payment" }),
  offlineReference: z
    .string({ error: "A transaction reference is required so the ledger reconciles" })
    .trim()
    .min(1, "A transaction reference is required so the ledger reconciles"),
  receiptAssetId: z
    .string({ error: "Attach the transaction receipt before recording" })
    .trim()
    .min(1, "Attach the transaction receipt before recording"),
  reconciliationNote: z
    .string({ error: "A reconciliation note is required and is written to the audit log" })
    .trim()
    .min(1, "A reconciliation note is required and is written to the audit log"),
  verified: checkboxBoolean.refine((v) => v === true, "Confirm you have verified this against the bank statement"),
});

export const recordOfflinePaymentSchema = offlinePaymentInputSchema.extend({
  candidateId: z.string().trim().min(1),
  programmeId: z.string().trim().min(1),
});

/** Flattens a Zod error into the { fieldName: message } shape the UI renders inline, per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
