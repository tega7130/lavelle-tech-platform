"use server";

import { getClientIp } from "@/lib/request-info";
import { submitAzubiApplicationCore, submitAzubiEnquiryCore } from "@/lib/azubi/forms";
import { azubiApplicationSchema, azubiEnquirySchema, fieldErrors } from "@/lib/validation/azubi";
import type { FormActionState } from "@/lib/action-state";

/** Collects repeated keys (the Apply form's "areas" checkboxes) into an array instead of overwriting. */
function formToObject(formData: FormData): Record<string, string | string[]> {
  const obj: Record<string, string | string[]> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v !== "string") continue;
    const existing = obj[k];
    if (existing === undefined) obj[k] = v;
    else obj[k] = Array.isArray(existing) ? [...existing, v] : [existing, v];
  }
  return obj;
}

function toValues(raw: Record<string, string | string[]>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) out[k] = Array.isArray(v) ? v.join(",") : v;
  return out;
}

export async function submitAzubiApplicationAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const raw = formToObject(formData);
  const parsed = azubiApplicationSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: toValues(raw) };

  const ip = await getClientIp();
  const result = await submitAzubiApplicationCore(parsed.data, ip);
  if (!result.ok) return { message: result.error, values: toValues(raw) };

  return { ok: true };
}

export async function submitAzubiEnquiryAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const raw = formToObject(formData);
  const parsed = azubiEnquirySchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: toValues(raw) };

  const ip = await getClientIp();
  const result = await submitAzubiEnquiryCore(parsed.data, ip);
  if (!result.ok) return { message: result.error, values: toValues(raw) };

  return { ok: true };
}
