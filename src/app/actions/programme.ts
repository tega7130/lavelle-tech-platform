"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Permission, Prisma, ProgrammeStatus } from "@/generated/prisma/client";
import { requireStaffPermission } from "@/lib/staff-auth";
import { getCurrentStaff } from "@/lib/staff-session";
import { recordAuditEvent } from "@/lib/audit";
import { PermissionDeniedError } from "@/lib/rbac";
import { slugify } from "@/lib/slug";
import { CodeImmutableError, PublishCheckError } from "@/lib/programme-errors";
import { computePublishFailures } from "@/lib/programme-publish";
import { createProgrammeSchema, updateProgrammeSchema, fieldErrors } from "@/lib/validation/programme";
import type { FormActionState } from "@/lib/action-state";

const DEFAULT_WEIGHTS = { QUIZ: 20, DRAFTING: 40, EXAMINATION: 40 } as const;

function formToObject(formData: FormData): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string" && v !== "") obj[k] = v;
  return obj;
}

/** Case-insensitive dedupe on name — returns the existing row on match rather than creating a near-duplicate. */
export async function createCategory(name: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name is required.");

  const existing = await prisma.programmeCategory.findFirst({
    where: { name: { equals: trimmed, mode: "insensitive" } },
  });
  if (existing) return existing;

  const created = await prisma.programmeCategory.create({
    data: { name: trimmed, slug: slugify(trimmed) },
  });
  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme_category",
    subjectId: created.id,
    action: "programme_category.created",
    description: `Created category "${trimmed}"`,
  });
  revalidatePath("/programmes/new");
  return created;
}

/** Step 1 of the builder — creates the programme, its category if new, and the three weighting rows in one transaction. */
export async function createProgramme(_prev: FormActionState, formData: FormData): Promise<FormActionState> {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const raw = formToObject(formData);
  const parsed = createProgrammeSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const data = parsed.data;

  try {
    const programme = await prisma.$transaction(async (tx) => {
      let categoryId = data.categoryId;
      if (!categoryId && data.newCategoryName) {
        const trimmed = data.newCategoryName.trim();
        const existing = await tx.programmeCategory.findFirst({
          where: { name: { equals: trimmed, mode: "insensitive" } },
        });
        const category = existing ?? (await tx.programmeCategory.create({ data: { name: trimmed, slug: slugify(trimmed) } }));
        categoryId = category.id;
      }
      if (!categoryId) throw new Error("A category is required.");

      const created = await tx.programme.create({
        data: {
          code: data.code,
          title: data.title,
          categoryId,
          tier: data.tier,
          summary: data.summary,
          authorName: data.authorName ?? null,
          weeks: data.weeks,
          weeklyHoursLabel: data.weeklyHoursLabel,
          feeMinor: Math.round(data.feeNaira * 100),
          currency: data.currency,
          deliveryLabel: data.deliveryLabel,
          prerequisiteTier: data.prerequisiteTier,
          // Mutually exclusive at the UI level — whichever the form sent
          // wins; the other stays unset since a fresh programme has
          // neither yet.
          coverVideoUrl: data.coverVideoAssetId ? null : data.coverVideoUrl,
          coverVideoAssetId: data.coverVideoUrl ? null : data.coverVideoAssetId,
          createdByStaffId: staff.id,
        },
      });

      await tx.assessmentWeighting.createMany({
        data: (Object.entries(DEFAULT_WEIGHTS) as [keyof typeof DEFAULT_WEIGHTS, number][]).map(([kind, weightPercent]) => ({
          programmeId: created.id,
          kind,
          weightPercent,
        })),
      });

      await recordAuditEvent(tx, {
        actorStaffId: staff.id,
        subjectType: "programme",
        subjectId: created.id,
        action: "programme.created",
        description: `Created programme ${created.code} — ${created.title}`,
      });

      return created;
    });

    revalidatePath("/programmes");
    return { ok: true, data: { id: programme.id, code: programme.code } };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { code: "A programme with this code already exists" }, values: raw };
    }
    throw e;
  }
}

/** Rejects a code change once any enrolment exists (rule 3) — code appears on certificates and in candidate correspondence. */
export async function updateProgramme(
  id: string,
  _prev: FormActionState,
  formData: FormData
): Promise<FormActionState> {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);
  const raw = formToObject(formData);
  const parsed = updateProgrammeSchema.safeParse(raw);
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: raw };
  const data = parsed.data;

  // Read directly rather than through `raw` (formToObject drops
  // empty-string fields, e.g. "" for feeNaira) — the form's hidden
  // authorName input is always present, so an empty value here means
  // "explicitly cleared", not "field omitted". Going through `data`
  // would silently keep whatever author was already saved.
  const authorNameField = formData.get("authorName");
  const authorName = typeof authorNameField === "string" ? authorNameField.trim() : null;

  const existing = await prisma.programme.findUniqueOrThrow({ where: { id } });

  if (data.code && data.code !== existing.code) {
    const enrolmentCount = await prisma.enrolment.count({ where: { programmeId: id } });
    if (enrolmentCount > 0) return { errors: { code: new CodeImmutableError().message }, values: raw };
  }

  try {
    await prisma.$transaction(async (tx) => {
      let categoryId = data.categoryId;
      if (!categoryId && data.newCategoryName) {
        const trimmed = data.newCategoryName.trim();
        const found = await tx.programmeCategory.findFirst({
          where: { name: { equals: trimmed, mode: "insensitive" } },
        });
        const category = found ?? (await tx.programmeCategory.create({ data: { name: trimmed, slug: slugify(trimmed) } }));
        categoryId = category.id;
      }

      await tx.programme.update({
        where: { id },
        data: {
          ...(data.title !== undefined ? { title: data.title } : {}),
          ...(data.code !== undefined ? { code: data.code } : {}),
          ...(categoryId ? { categoryId } : {}),
          ...(data.tier !== undefined ? { tier: data.tier } : {}),
          ...(data.summary !== undefined ? { summary: data.summary } : {}),
          ...(authorNameField !== null ? { authorName: authorName || null } : {}),
          ...(data.weeks !== undefined ? { weeks: data.weeks } : {}),
          ...(data.weeklyHoursLabel !== undefined ? { weeklyHoursLabel: data.weeklyHoursLabel } : {}),
          ...(data.feeNaira !== undefined ? { feeMinor: Math.round(data.feeNaira * 100) } : {}),
          ...(data.currency !== undefined ? { currency: data.currency } : {}),
          ...(data.deliveryLabel !== undefined ? { deliveryLabel: data.deliveryLabel } : {}),
          ...(data.prerequisiteTier !== undefined ? { prerequisiteTier: data.prerequisiteTier } : {}),
          // Whichever the form sent replaces BOTH fields — a link and an
          // uploaded asset are mutually exclusive, so setting one always
          // clears the other rather than leaving a stale reference behind.
          ...(data.coverVideoUrl !== undefined ? { coverVideoUrl: data.coverVideoUrl, coverVideoAssetId: null } : {}),
          ...(data.coverVideoAssetId !== undefined
            ? { coverVideoAssetId: data.coverVideoAssetId, coverVideoUrl: null }
            : {}),
        },
      });

      await recordAuditEvent(tx, {
        actorStaffId: staff.id,
        subjectType: "programme",
        subjectId: id,
        action: "programme.updated",
        description: `Updated programme details for ${existing.code}`,
      });
    });

    revalidatePath(`/programmes/${id}/edit`);
    revalidatePath("/programmes");
    return { ok: true };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { errors: { code: "A programme with this code already exists" }, values: raw };
    }
    throw e;
  }
}

/**
 * Runs the publish checks when moving to ACTIVE (rule 2): at least one
 * module; every module has at least one lecture; weights total 100;
 * feeMinor > 0. Returns the specific failures rather than a generic
 * refusal — the builder lists them. Moving to ARCHIVED is Slice 02's
 * soft-delete mechanism (rule 4); there is no hard-delete action.
 */
export async function setProgrammeStatus(id: string, status: ProgrammeStatus) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);

  const programme = await prisma.programme.findUniqueOrThrow({
    where: { id },
    include: { modules: { include: { lectures: true } }, assessmentWeightings: true },
  });

  if (status === "ACTIVE") {
    const failures = computePublishFailures(programme);
    if (failures.length > 0) throw new PublishCheckError(failures);
  }

  const updated = await prisma.programme.update({ where: { id }, data: { status } });

  // Slice 11 Part C rule 3: archiving must name the affected listing so
  // whoever archived it knows what they just changed — the listing stays
  // live with enrolment closed (README C1), it is not unpublished here.
  let description = `Changed ${programme.code} status from ${programme.status} to ${status}`;
  if (status === "ARCHIVED") {
    const listing = await prisma.programmeListing.findUnique({ where: { programmeId: id } });
    if (listing?.isPublished) {
      description += ` — its listing "${programme.title}" remains live with enrolment now closed`;
    }
  }

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: id,
    action: "programme.status_changed",
    description,
  });

  revalidatePath(`/programmes/${id}/content`);
  revalidatePath("/programmes");
  return updated;
}

function nextCopyCode(baseCode: string, existingCodes: Set<string>): string {
  let candidate = `${baseCode}-COPY`;
  let n = 2;
  while (existingCodes.has(candidate)) {
    candidate = `${baseCode}-COPY-${n}`;
    n++;
  }
  return candidate;
}

/** Deep copy as a new DRAFT with a new code — saves authoring a sibling programme from nothing. */
export async function duplicateProgramme(id: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);

  const source = await prisma.programme.findUniqueOrThrow({
    where: { id },
    include: {
      assessmentWeightings: true,
      listing: true,
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lectures: {
            orderBy: { orderIndex: "asc" },
            include: { slides: { orderBy: { orderIndex: "asc" } } },
          },
          quiz: { include: { questions: { orderBy: { orderIndex: "asc" }, include: { options: { orderBy: { orderIndex: "asc" } } } } } },
        },
      },
    },
  });

  const existingCodes = new Set((await prisma.programme.findMany({ select: { code: true } })).map((p) => p.code));
  const newCode = nextCopyCode(source.code, existingCodes);

  const copy = await prisma.$transaction(async (tx) => {
    const newProgramme = await tx.programme.create({
      data: {
        code: newCode,
        title: `${source.title} (Copy)`,
        categoryId: source.categoryId,
        tier: source.tier,
        status: "DRAFT",
        summary: source.summary,
        weeks: source.weeks,
        weeklyHoursLabel: source.weeklyHoursLabel,
        feeMinor: source.feeMinor,
        currency: source.currency,
        deliveryLabel: source.deliveryLabel,
        prerequisiteTier: source.prerequisiteTier,
        createdByStaffId: staff.id,
      },
    });

    await tx.assessmentWeighting.createMany({
      data: source.assessmentWeightings.map((w) => ({
        programmeId: newProgramme.id,
        kind: w.kind,
        weightPercent: w.weightPercent,
      })),
    });

    // Carry over the source's website listing copy, if any was authored —
    // otherwise the duplicate lands on the website editor with
    // useDefaults reset to true and an empty outcomes/includes, silently
    // dropping content the source programme already had. The copy always
    // starts unpublished regardless of the source's publish state
    // (publishedAt/publishedByStaffId/unpublishedAt/isPublished all left
    // at their schema defaults), consistent with the programme itself
    // always starting DRAFT.
    if (source.listing) {
      await tx.programmeListing.create({
        data: {
          programmeId: newProgramme.id,
          useDefaults: source.listing.useDefaults,
          headline: source.listing.headline,
          summary: source.listing.summary,
          outcomes: source.listing.outcomes ?? undefined,
          includes: source.listing.includes ?? undefined,
          assessmentNote: source.listing.assessmentNote,
          paymentNote: source.listing.paymentNote,
          heroAssetId: source.listing.heroAssetId,
          useCoverVideo: source.listing.useCoverVideo,
          videoUrl: source.listing.videoUrl,
          videoAssetId: source.listing.videoAssetId,
        },
      });
    }

    for (const mod of source.modules) {
      const newModule = await tx.module.create({
        data: {
          programmeId: newProgramme.id,
          weekNumber: mod.weekNumber,
          title: mod.title,
          summary: mod.summary,
          examQuestionDraw: mod.examQuestionDraw,
          orderIndex: mod.orderIndex,
        },
      });

      for (const lec of mod.lectures) {
        const newLecture = await tx.lecture.create({
          data: {
            moduleId: newModule.id,
            orderIndex: lec.orderIndex,
            title: lec.title,
            mediaKind: lec.mediaKind,
            videoUrl: lec.videoUrl,
            videoAssetId: lec.videoAssetId,
            narrationMode: lec.narrationMode,
            narrationAutoAdvance: lec.narrationAutoAdvance,
            narrationRequireFull: lec.narrationRequireFull,
            fullNarrationAssetId: lec.fullNarrationAssetId,
            scenarioPrompt: lec.scenarioPrompt,
            scenarioGuidance: lec.scenarioGuidance,
            draftingPrompt: lec.draftingPrompt,
            draftingWordLimit: lec.draftingWordLimit,
          },
        });

        for (const slide of lec.slides) {
          await tx.slide.create({
            data: {
              lectureId: newLecture.id,
              orderIndex: slide.orderIndex,
              title: slide.title,
              body: slide.body,
              // Media assets are shared by reference, not duplicated — the
              // underlying uploaded bytes don't need copying, only the link.
              imageAssetId: slide.imageAssetId,
              narrationAssetId: slide.narrationAssetId,
            },
          });
        }
      }

      if (mod.quiz) {
        const newQuiz = await tx.quiz.create({
          data: { moduleId: newModule.id, passMarkPercent: mod.quiz.passMarkPercent },
        });
        for (const q of mod.quiz.questions) {
          await tx.quizQuestion.create({
            data: {
              quizId: newQuiz.id,
              orderIndex: q.orderIndex,
              prompt: q.prompt,
              marks: q.marks,
              explanation: q.explanation,
              options: {
                create: q.options.map((o) => ({ orderIndex: o.orderIndex, text: o.text, isCorrect: o.isCorrect })),
              },
            },
          });
        }
      }
    }

    await recordAuditEvent(tx, {
      actorStaffId: staff.id,
      subjectType: "programme",
      subjectId: newProgramme.id,
      action: "programme.duplicated",
      description: `Duplicated ${source.code} as ${newCode}`,
    });

    return newProgramme;
  });

  revalidatePath("/programmes");
  return copy;
}

/** Form-action wrapper for the Programmes list row button — duplicates then lands the staff member on the new DRAFT copy's details. */
export async function duplicateProgrammeAndRedirect(id: string) {
  const copy = await duplicateProgramme(id);
  redirect(`/admin/programmes/${copy.id}/edit`);
}

/** Unpublish a programme from the public listing. Requires MANAGE_PROGRAMMES permission. */
export async function unpublishProgramme(id: string) {
  const staff = await requireStaffPermission(Permission.MANAGE_PROGRAMMES);

  const programme = await prisma.programme.findUniqueOrThrow({
    where: { id },
    include: { listing: true },
  });

  if (!programme.listing?.isPublished) {
    throw new Error("Programme is not published");
  }

  const updated = await prisma.programmeListing.update({
    where: { programmeId: id },
    data: { isPublished: false },
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staff.id,
    subjectType: "programme",
    subjectId: id,
    action: "programme.unpublished",
    description: `Unpublished ${programme.code} from the public listing`,
  });

  revalidatePath("/");
  revalidatePath("/admin/programmes");
  return updated;
}

/** Delete a programme and all related data. Requires SUPER_ADMIN role. Hard delete is only allowed for DRAFT programmes with zero enrolments. */
export async function deleteProgramme(id: string) {
  const staffRecord = await getCurrentStaff();
  if (!staffRecord || staffRecord.role !== "SUPER_ADMIN") {
    throw new PermissionDeniedError(Permission.MANAGE_PROGRAMMES);
  }

  const programme = await prisma.programme.findUniqueOrThrow({
    where: { id },
    include: {
      _count: { select: { enrolments: true } },
      listing: true,
    },
  });

  // Only allow deletion of DRAFT programmes with zero enrolments
  if (programme.status !== "DRAFT") {
    throw new Error("Only DRAFT programmes can be deleted");
  }

  if (programme._count.enrolments > 0) {
    throw new Error("Cannot delete programmes with existing enrolments");
  }

  // Delete in transaction to maintain consistency
  const deleted = await prisma.$transaction(async (tx) => {
    // Unpublish first if needed
    if (programme.listing?.isPublished) {
      await tx.programmeListing.delete({
        where: { programmeId: id },
      });
    }

    // Delete all related data (cascades from Prisma schema)
    return tx.programme.delete({ where: { id } });
  });

  await recordAuditEvent(prisma, {
    actorStaffId: staffRecord.id,
    subjectType: "programme",
    subjectId: id,
    action: "programme.deleted",
    description: `Deleted DRAFT programme ${programme.code} with zero enrolments`,
  });

  revalidatePath("/admin/programmes");
  return deleted;
}
