"use server";

import { revalidatePath } from "next/cache";
import { getCurrentCandidate } from "@/lib/candidate-session";
import { enforceRateLimit, RateLimitError } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-info";
import {
  startLawyerWebsite,
  updateLawyerWebsiteVerification,
  updateLawyerWebsiteHandle,
  updateLawyerWebsiteLookAndFeel,
  TemplateNotAvailableError,
  HandleNotOwnNameError,
  HandleTakenError,
  requestPublishLawyerWebsite,
  PublishCheckError,
  acknowledgeConductDisclaimer,
  updateLawyerWebsiteAbout,
  getLawyerWebsiteForCandidate,
  addLawyerQualification,
  updateLawyerQualification,
  deleteLawyerQualification,
  reorderLawyerQualifications,
  addLawyerExperience,
  updateLawyerExperience,
  deleteLawyerExperience,
  reorderLawyerExperiences,
  addLawyerPublication,
  updateLawyerPublication,
  deleteLawyerPublication,
  reorderLawyerPublications,
  addLawyerActivity,
  updateLawyerActivity,
  deleteLawyerActivity,
  reorderLawyerActivities,
} from "@/lib/lawyer-website";
import {
  startLawyerWebsiteSchema,
  updateLawyerWebsiteVerificationSchema,
  updateHandleSchema,
  updateLookAndFeelSchema,
  acknowledgeConductDisclaimerSchema,
  updateLawyerWebsiteAboutSchema,
  addQualificationSchema,
  updateQualificationSchema,
  experienceSchema,
  publicationSchema,
  activitySchema,
  fieldErrors,
} from "@/lib/validation/lawyer-website";
import type { FormActionState } from "@/lib/action-state";

function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") obj[k] = v;
  return obj;
}

function revalidateAll() {
  revalidatePath("/portal/website");
}

export async function startLawyerWebsiteAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { message: "You must be signed in." };

  const raw = formToObject(formData);
  const parsed = startLawyerWebsiteSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  await startLawyerWebsite(candidate.id, {
    entityType: parsed.data.entityType,
    firmName: parsed.data.firmName ?? null,
  });

  revalidateAll();
  return { ok: true };
}

export async function updateLawyerWebsiteVerificationAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { message: "You must be signed in." };

  const site = await getLawyerWebsiteForCandidate(candidate.id);
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  // entityType comes from the existing site, never the submitted form —
  // see the schema's own comment on why that matters.
  const parsed = updateLawyerWebsiteVerificationSchema.safeParse({ ...raw, entityType: site.entityType });
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  await updateLawyerWebsiteVerification(site.id, {
    scnNumber: parsed.data.scnNumber ?? null,
    idCardEvidenceAssetId: parsed.data.idCardEvidenceAssetId ?? null,
    cacNumber: parsed.data.cacNumber ?? null,
    firmEvidenceAssetId: parsed.data.firmEvidenceAssetId ?? null,
  });

  revalidateAll();
  return { ok: true };
}

export async function updateLawyerWebsiteHandleAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { message: "You must be signed in." };

  const site = await getLawyerWebsiteForCandidate(candidate.id);
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = updateHandleSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  try {
    await updateLawyerWebsiteHandle(site.id, candidate.id, parsed.data.handle);
  } catch (e) {
    if (e instanceof HandleNotOwnNameError || e instanceof HandleTakenError) return { message: e.message };
    throw e;
  }
  revalidateAll();
  return { ok: true };
}

export async function updateLawyerWebsiteLookAndFeelAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { message: "You must be signed in." };

  const site = await getLawyerWebsiteForCandidate(candidate.id);
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = updateLookAndFeelSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  try {
    await updateLawyerWebsiteLookAndFeel(site.id, parsed.data);
  } catch (e) {
    if (e instanceof TemplateNotAvailableError) return { message: e.message };
    throw e;
  }
  revalidateAll();
  return { ok: true };
}

export async function requestPublishLawyerWebsiteAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { message: "You must be signed in." };

  const raw = formToObject(formData);
  if (raw.acknowledged !== "true") return { message: "You must accept the disclaimer to publish." };

  const site = await getLawyerWebsiteForCandidate(candidate.id);
  if (!site) return { message: "Start your website first." };

  try {
    await enforceRateLimit("lawyer_website_publish", { email: candidate.email, ip: await getClientIp() }, { limit: 10, windowSeconds: 3600 });
  } catch (e) {
    if (e instanceof RateLimitError) return { message: e.message };
    throw e;
  }

  try {
    await requestPublishLawyerWebsite(site.id);
  } catch (e) {
    if (e instanceof PublishCheckError) return { message: e.failures.map((f) => f.reason).join(" ") };
    throw e;
  }
  revalidateAll();
  return { ok: true };
}

export async function acknowledgeConductDisclaimerAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { message: "You must be signed in." };

  const site = await getLawyerWebsiteForCandidate(candidate.id);
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = acknowledgeConductDisclaimerSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  await acknowledgeConductDisclaimer(site.id);

  revalidateAll();
  return { ok: true };
}

export async function updateLawyerWebsiteAboutAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { message: "You must be signed in." };

  const site = await getLawyerWebsiteForCandidate(candidate.id);
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = updateLawyerWebsiteAboutSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  await updateLawyerWebsiteAbout(site.id, parsed.data);

  revalidateAll();
  return { ok: true };
}

async function requireOwnSite() {
  const candidate = await getCurrentCandidate();
  if (!candidate) return { candidate: null, site: null };
  const site = await getLawyerWebsiteForCandidate(candidate.id);
  return { candidate, site };
}

export async function addQualificationAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const { candidate, site } = await requireOwnSite();
  if (!candidate) return { message: "You must be signed in." };
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = addQualificationSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  try {
    await addLawyerQualification(site.id, candidate.id, parsed.data);
  } catch (e) {
    return { message: e instanceof Error ? e.message : "Could not add this qualification." };
  }
  revalidateAll();
  return { ok: true };
}

export async function updateQualificationAction(id: string, _prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const { site } = await requireOwnSite();
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = updateQualificationSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  try {
    await updateLawyerQualification(id, site.id, parsed.data);
  } catch (e) {
    return { message: e instanceof Error ? e.message : "Could not update this qualification." };
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteQualificationAction(id: string) {
  const { site } = await requireOwnSite();
  if (!site) throw new Error("Start your website first.");
  await deleteLawyerQualification(id, site.id);
  revalidateAll();
}

export async function reorderQualificationsAction(orderedIds: string[]) {
  const { site } = await requireOwnSite();
  if (!site) throw new Error("Start your website first.");
  await reorderLawyerQualifications(site.id, orderedIds);
  revalidateAll();
}

export async function addExperienceAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const { site } = await requireOwnSite();
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = experienceSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  await addLawyerExperience(site.id, parsed.data);
  revalidateAll();
  return { ok: true };
}

export async function updateExperienceAction(id: string, _prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const { site } = await requireOwnSite();
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = experienceSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  try {
    await updateLawyerExperience(id, site.id, parsed.data);
  } catch (e) {
    return { message: e instanceof Error ? e.message : "Could not update this entry." };
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteExperienceAction(id: string) {
  const { site } = await requireOwnSite();
  if (!site) throw new Error("Start your website first.");
  await deleteLawyerExperience(id, site.id);
  revalidateAll();
}

export async function reorderExperiencesAction(orderedIds: string[]) {
  const { site } = await requireOwnSite();
  if (!site) throw new Error("Start your website first.");
  await reorderLawyerExperiences(site.id, orderedIds);
  revalidateAll();
}

export async function addPublicationAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const { site } = await requireOwnSite();
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = publicationSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  await addLawyerPublication(site.id, parsed.data);
  revalidateAll();
  return { ok: true };
}

export async function updatePublicationAction(id: string, _prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const { site } = await requireOwnSite();
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = publicationSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  try {
    await updateLawyerPublication(id, site.id, { ...parsed.data, isPublished: raw.isPublished === "true" });
  } catch (e) {
    return { message: e instanceof Error ? e.message : "Could not update this publication." };
  }
  revalidateAll();
  return { ok: true };
}

export async function deletePublicationAction(id: string) {
  const { site } = await requireOwnSite();
  if (!site) throw new Error("Start your website first.");
  await deleteLawyerPublication(id, site.id);
  revalidateAll();
}

export async function reorderPublicationsAction(orderedIds: string[]) {
  const { site } = await requireOwnSite();
  if (!site) throw new Error("Start your website first.");
  await reorderLawyerPublications(site.id, orderedIds);
  revalidateAll();
}

export async function addActivityAction(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const { site } = await requireOwnSite();
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = activitySchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  await addLawyerActivity(site.id, parsed.data);
  revalidateAll();
  return { ok: true };
}

export async function updateActivityAction(id: string, _prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const { site } = await requireOwnSite();
  if (!site) return { message: "Start your website first." };

  const raw = formToObject(formData);
  const parsed = activitySchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };

  try {
    await updateLawyerActivity(id, site.id, parsed.data);
  } catch (e) {
    return { message: e instanceof Error ? e.message : "Could not update this entry." };
  }
  revalidateAll();
  return { ok: true };
}

export async function deleteActivityAction(id: string) {
  const { site } = await requireOwnSite();
  if (!site) throw new Error("Start your website first.");
  await deleteLawyerActivity(id, site.id);
  revalidateAll();
}

export async function reorderActivitiesAction(orderedIds: string[]) {
  const { site } = await requireOwnSite();
  if (!site) throw new Error("Start your website first.");
  await reorderLawyerActivities(site.id, orderedIds);
  revalidateAll();
}
