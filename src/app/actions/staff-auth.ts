"use server";

import { redirect } from "next/navigation";
import { Permission } from "@/generated/prisma/client";
import { getClientIp, getUserAgent } from "@/lib/request-info";
import { setStaffSessionCookie, destroyStaffSession } from "@/lib/staff-session";
import { requireStaffPermission } from "@/lib/staff-auth";
import * as core from "@/lib/staff-auth-actions";
import { staffSignInSchema, staffSetPasswordSchema, fieldErrors } from "@/lib/validation/staff";
import type { FormActionState } from "@/lib/action-state";

function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && v !== "") obj[k] = v;
  return obj;
}

export async function staffSignIn(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const raw = formToObject(formData);
  const parsed = staffSignInSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const ip = await getClientIp();
  const userAgent = await getUserAgent();
  const result = await core.staffSignInCore(parsed.data.email, parsed.data.password, ip, userAgent);
  if (!result.ok) return { values: raw, message: result.message };

  await setStaffSessionCookie(result.sessionToken);
  // README H3 rule 16 — same discipline as the candidate sign-in: `next`
  // only ever comes from proxy.ts's own redirect (a same-origin /admin
  // path).
  const next = raw.next;
  redirect(next && next.startsWith("/admin/") ? next : "/admin/overview");
}

/** Silent by design (same rule as requestStaffPasswordReset) — the caller never learns whether the address matched a real account. */
export async function requestStaffLoginOtp(email: string): Promise<void> {
  const ip = await getClientIp();
  await core.requestStaffLoginOtpCore(email.trim().toLowerCase(), ip);
}

export async function verifyStaffLoginOtp(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const code = String(formData.get("code") ?? "").trim();
  const next = String(formData.get("next") ?? "");

  const ip = await getClientIp();
  const userAgent = await getUserAgent();
  const result = await core.verifyStaffLoginOtpCore(email, code, ip, userAgent);
  if (!result.ok) return { message: result.message };

  await setStaffSessionCookie(result.sessionToken);
  redirect(next && next.startsWith("/admin/") ? next : "/admin/overview");
}

export async function staffSignOut() {
  await destroyStaffSession();
  redirect("/staff/sign-in?signedOut=1");
}

export async function setStaffPassword(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const raw = formToObject(formData);
  const parsed = staffSetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  const ip = await getClientIp();
  const userAgent = await getUserAgent();
  const result = await core.setStaffPasswordCore(parsed.data.token, parsed.data.password, ip, userAgent);
  if (!result.ok) return { message: "This link has expired or was already used." };

  // sessionToken is null for a password reset (see setStaffPasswordCore) —
  // that path deliberately does not sign the admin in; they return to
  // /staff/sign-in and authenticate normally with the new password.
  if (result.sessionToken) await setStaffSessionCookie(result.sessionToken);
  // Not a redirect() — the set-password page shows an activation
  // confirmation (role, who invited them) before the staff member moves
  // on themselves; the session cookie is already live.
  return { ok: true, data: { name: result.name, role: result.role } };
}

export async function resendStaffInvitation(staffId: string) {
  const actor = await requireStaffPermission(Permission.MANAGE_STAFF);
  await core.resendStaffInvitationCore(staffId, actor.id);
}

export async function requestStaffPasswordReset(email: string): Promise<void> {
  const ip = await getClientIp();
  await core.requestStaffPasswordResetCore(email.trim().toLowerCase(), ip);
}
