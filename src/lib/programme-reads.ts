import "server-only";
import { prisma } from "@/lib/prisma";
import { getSignedAssetUrl } from "@/lib/storage";
import type { ProgrammeStatus, ProgrammeTier, NarrationMode } from "@/generated/prisma/client";

// Server functions — called directly from Server Components, no client
// fetch (Handoff 02 README's server-surface table).

export interface ListProgrammesParams {
  q?: string;
  tier?: ProgrammeTier;
  status?: ProgrammeStatus;
  categoryId?: string;
}

export async function listProgrammes(params: ListProgrammesParams = {}) {
  return prisma.programme.findMany({
    where: {
      // Auto-created shells behind a standalone exam (createStandaloneExam,
      // exam-builder-actions.ts) are managed entirely through the exam
      // builder — they must never appear here.
      isExamOnlyShell: false,
      ...(params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: "insensitive" } },
              { code: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(params.tier ? { tier: params.tier } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.categoryId ? { categoryId: params.categoryId } : {}),
    },
    include: {
      category: true,
      _count: { select: { enrolments: true, modules: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function listCategories() {
  return prisma.programmeCategory.findMany({ orderBy: { name: "asc" } });
}

/** Distinct author names already used across programmes — the "pick existing or type a new one" picker's candidate list. */
export async function listProgrammeAuthors(): Promise<string[]> {
  const rows = await prisma.programme.findMany({
    where: { authorName: { not: null } },
    select: { authorName: true },
    distinct: ["authorName"],
    orderBy: { authorName: "asc" },
  });
  return rows.map((r) => r.authorName).filter((name): name is string => !!name);
}

export async function getProgrammeForEdit(id: string) {
  return prisma.programme.findUnique({
    where: { id },
    include: {
      category: true,
      assessmentWeightings: true,
      _count: { select: { enrolments: true } },
      coverVideoAsset: { select: { id: true, originalFilename: true } },
    },
  });
}

/** True once any enrolment references the programme — gates code edits (rule 3). */
export async function programmeHasEnrolments(id: string): Promise<boolean> {
  const count = await prisma.enrolment.count({ where: { programmeId: id } });
  return count > 0;
}

export async function getProgrammeContent(id: string) {
  return prisma.programme.findUnique({
    where: { id },
    include: {
      modules: {
        orderBy: { orderIndex: "asc" },
        include: {
          lectures: {
            orderBy: { orderIndex: "asc" },
            include: {
              slides: { orderBy: { orderIndex: "asc" }, include: { narrationAsset: true, imageAsset: true } },
              fullNarrationAsset: true,
              videoAsset: true,
            },
          },
          quiz: { include: { questions: { orderBy: { orderIndex: "asc" }, include: { options: { orderBy: { orderIndex: "asc" } } } } } },
        },
      },
      assessmentWeightings: true,
    },
  });
}

/**
 * A lecture's estimated duration is always derived, never entered (rule
 * "no duration input anywhere in the admin UI"). Sums narration assets
 * (per-slide or full-lecture) or the uploaded video's probed duration —
 * a pasted videoUrl with nothing uploaded has nothing to sum, so it
 * falls through to "pending" like any other lecture with no assets yet.
 */
export interface LectureDuration {
  seconds: number | null;
  source: "per_slide" | "full_lecture" | "video" | "pending";
}

export function computeLectureDuration(lecture: {
  narrationMode: NarrationMode;
  fullNarrationAsset?: { durationSeconds: number | null } | null;
  videoAsset?: { durationSeconds: number | null } | null;
  slides?: { narrationAsset?: { durationSeconds: number | null } | null }[];
}): LectureDuration {
  if (lecture.narrationMode === "FULL_LECTURE" && lecture.fullNarrationAsset?.durationSeconds) {
    return { seconds: lecture.fullNarrationAsset.durationSeconds, source: "full_lecture" };
  }
  if (lecture.narrationMode === "PER_SLIDE" && lecture.slides?.length) {
    const known = lecture.slides
      .map((s) => s.narrationAsset?.durationSeconds)
      .filter((s): s is number => typeof s === "number");
    if (known.length > 0) {
      return { seconds: known.reduce((a, b) => a + b, 0), source: "per_slide" };
    }
  }
  if (lecture.videoAsset?.durationSeconds) {
    return { seconds: lecture.videoAsset.durationSeconds, source: "video" };
  }
  return { seconds: null, source: "pending" };
}

export function formatDuration(seconds: number | null): string {
  if (seconds == null) return "Duration pending";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** A PER_SLIDE lecture missing narration on some slides is authorable, not blocked — surfaced as a warning (rule 5). */
export function narrationWarning(lecture: {
  narrationMode: NarrationMode;
  slides?: { narrationAsset?: unknown }[];
}): string | null {
  if (lecture.narrationMode !== "PER_SLIDE" || !lecture.slides?.length) return null;
  const missing = lecture.slides.filter((s) => !s.narrationAsset).length;
  if (missing === 0) return null;
  return `${missing} of ${lecture.slides.length} slides missing narration`;
}

/** Fresh signed URLs for whatever assets a lecture/slide references — content is never reachable any other way. */
export function signedUrlFor(storageKey: string | null | undefined, resourceType: "image" | "video" | "raw" = "image"): string | null {
  return storageKey ? getSignedAssetUrl(storageKey, resourceType) : null;
}
