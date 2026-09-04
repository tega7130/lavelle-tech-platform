import "server-only";
import { prisma } from "@/lib/prisma";
import { getSignedAssetUrl } from "@/lib/storage";
import { deriveLectureSteps } from "@/lib/lecture-steps";
import { computePercent } from "@/lib/progress";
import { computeDeadlineState } from "@/lib/deadline-state";
import { LectureState, EnrolmentStatus } from "@/generated/prisma/client";

export class NotYourEnrolmentError extends Error {
  constructor() {
    super("This enrolment does not belong to you.");
    this.name = "NotYourEnrolmentError";
  }
}

export class LectureLockedError extends Error {
  constructor() {
    super("This lecture has not been released yet.");
    this.name = "LectureLockedError";
  }
}

async function loadOwnedEnrolment(candidateId: string, enrolmentId: string) {
  const enrolment = await prisma.enrolment.findUnique({
    where: { id: enrolmentId },
    include: { programme: { include: { exam: { select: { id: true } }, assessmentWeightings: true } } },
  });
  if (!enrolment || enrolment.candidateId !== candidateId) throw new NotYourEnrolmentError();
  return enrolment;
}

/**
 * Every module + lecture in the programme, each lecture annotated with
 * its derived step list, derived state, and whether its module has
 * released yet — shared by the overview and the player's dark rail so
 * the two screens can never disagree about what's unlocked. A module's
 * release gate is its LECTURE_RELEASE deadline's dueAt, generated at
 * enrolment from the intake start date (rule 6/7); the mockup's lock
 * icon is this, not an authoring gap.
 */
async function loadModuleTree(enrolmentId: string, programmeId: string) {
  const [modules, progressRows, releaseDeadlines, quizAttempts] = await Promise.all([
    prisma.module.findMany({
      // PUBLISHED only — a DRAFT/ARCHIVED module drops its whole subtree
      // out of the candidate-facing programme, regardless of any
      // individual lecture's own status (module status is the umbrella
      // control; lecture status only matters once its module is PUBLISHED).
      where: { programmeId, status: "PUBLISHED" },
      orderBy: { orderIndex: "asc" },
      include: {
        // PUBLISHED only — DRAFT (not yet released) and ARCHIVED (soft-
        // deleted, rule: never hard-delete a lecture) both drop out of the
        // candidate-facing tree here, which is also what blocks direct
        // navigation to a stale lecture URL (getLecturePlayer below looks
        // the id up in this same tree and 404s if it's missing).
        lectures: { where: { status: "PUBLISHED" }, orderBy: { orderIndex: "asc" } },
        quiz: { include: { questions: { select: { id: true } } } },
      },
    }),
    prisma.lectureProgress.findMany({ where: { enrolmentId } }),
    prisma.deadline.findMany({ where: { enrolmentId, kind: "LECTURE_RELEASE" } }),
    // Whether a module's quiz has been passed is read from here, never
    // from a lecture's stepsCompleted — that flag is recorded against
    // whichever lecture was the module's last PUBLISHED one at attempt
    // time, and an admin unpublishing/reordering lectures afterwards
    // shifts which lecture is "last" without moving the flag, silently
    // orphaning a real pass. QuizAttempt is keyed by quizId, which never
    // changes, so it stays correct across any later content edit.
    prisma.quizAttempt.findMany({ where: { enrolmentId, passed: true }, select: { quizId: true } }),
  ]);

  const progressByLecture = new Map(progressRows.map((p) => [p.lectureId, p]));
  const releaseByModule = new Map(releaseDeadlines.map((d) => [d.moduleId, d]));
  const passedQuizIds = new Set(quizAttempts.map((a) => a.quizId));
  const now = new Date();

  let totalLectures = 0;
  let completedLectures = 0;

  const moduleTree = modules.map((mod) => {
    const release = releaseByModule.get(mod.id);
    const isReleased = !release || release.dueAt.getTime() <= now.getTime();
    const moduleHasQuiz = !!mod.quiz && mod.quiz.status === "PUBLISHED" && mod.quiz.questions.length > 0;

    let moduleCompleted = 0;
    const lectures = mod.lectures.map((lec, i) => {
      const progress = progressByLecture.get(lec.id);
      const steps = deriveLectureSteps({
        scenarioPrompt: lec.scenarioPrompt,
        draftingPrompt: lec.draftingPrompt,
        isLastInModule: i === mod.lectures.length - 1,
        moduleHasQuiz,
      });
      const state = progress?.state ?? LectureState.NOT_STARTED;
      if (state === LectureState.COMPLETED) {
        moduleCompleted++;
        completedLectures++;
      }
      totalLectures++;
      return {
        id: lec.id,
        title: lec.title,
        orderIndex: lec.orderIndex,
        mediaKind: lec.mediaKind,
        steps,
        state,
        stepsCompleted: (progress?.stepsCompleted ?? []) as string[],
        lastSeenAt: progress?.lastSeenAt ?? null,
        isLocked: !isReleased,
      };
    });

    return {
      id: mod.id,
      title: mod.title,
      weekNumber: mod.weekNumber,
      orderIndex: mod.orderIndex,
      isReleased,
      releaseAt: release?.dueAt ?? null,
      percent: computePercent(moduleCompleted, mod.lectures.length),
      lectures,
      // Authoritative per-module quiz-pass state — see the comment on the
      // quizAttempt query above for why this is never derived from a
      // lecture's stepsCompleted.
      quizPassed: moduleHasQuiz && passedQuizIds.has(mod.quiz!.id),
    };
  });

  return { moduleTree, programmePercent: computePercent(completedLectures, totalLectures) };
}

export type ModuleTree = Awaited<ReturnType<typeof loadModuleTree>>["moduleTree"];

export async function getProgrammeOverview(candidateId: string, enrolmentId: string) {
  const enrolment = await loadOwnedEnrolment(candidateId, enrolmentId);
  const { moduleTree, programmePercent } = await loadModuleTree(enrolmentId, enrolment.programmeId);

  let upNext: { moduleId: string; moduleTitle: string; lectureId: string; lectureTitle: string } | null = null;
  findUpNext: for (const mod of moduleTree) {
    for (const lec of mod.lectures) {
      if (lec.state !== LectureState.COMPLETED && !lec.isLocked) {
        upNext = { moduleId: mod.id, moduleTitle: mod.title, lectureId: lec.id, lectureTitle: lec.title };
        break findUpNext;
      }
    }
  }

  return { enrolment, programme: enrolment.programme, modules: moduleTree, programmePercent, upNext };
}

export async function getLecturePlayer(candidateId: string, enrolmentId: string, lectureId: string) {
  const enrolment = await loadOwnedEnrolment(candidateId, enrolmentId);
  const { moduleTree } = await loadModuleTree(enrolmentId, enrolment.programmeId);

  const flat: { moduleId: string; lectureId: string }[] = [];
  let currentModule: ModuleTree[number] | undefined;
  let currentLecture: ModuleTree[number]["lectures"][number] | undefined;
  for (const mod of moduleTree) {
    for (const lec of mod.lectures) {
      flat.push({ moduleId: mod.id, lectureId: lec.id });
      if (lec.id === lectureId) {
        currentModule = mod;
        currentLecture = lec;
      }
    }
  }
  if (!currentModule || !currentLecture) throw new Error("Lecture not found in this programme");
  if (currentLecture.isLocked) throw new LectureLockedError();

  const idx = flat.findIndex((f) => f.lectureId === lectureId);
  const prevLectureId = idx > 0 ? flat[idx - 1]!.lectureId : null;
  const nextLectureId = idx < flat.length - 1 ? flat[idx + 1]!.lectureId : null;
  const isLastLectureInProgramme = idx === flat.length - 1;

  const lecture = await prisma.lecture.findUniqueOrThrow({
    where: { id: lectureId },
    include: {
      slides: { orderBy: { orderIndex: "asc" }, include: { imageAsset: true, narrationAsset: true } },
      videoAsset: true,
      fullNarrationAsset: true,
      module: { include: { quiz: true } },
    },
  });

  const slides = lecture.slides.map((s) => ({
    id: s.id,
    title: s.title,
    body: s.body,
    imageUrl: s.imageAsset ? getSignedAssetUrl(s.imageAsset.storageKey, "image") : null,
    narrationUrl: s.narrationAsset ? getSignedAssetUrl(s.narrationAsset.storageKey, "video") : null,
  }));

  const [progress, draftingSubmission, lectureNote] = await Promise.all([
    prisma.lectureProgress.findUnique({ where: { enrolmentId_lectureId: { enrolmentId, lectureId } } }),
    lecture.draftingPrompt
      ? prisma.draftingSubmission.findFirst({ where: { enrolmentId, lectureId }, orderBy: { attemptNumber: "desc" } })
      : Promise.resolve(null),
    // Unconditional, unlike draftingSubmission — every lecture has a
    // content step, so a note is always fetchable regardless of what
    // else the lecture is authored with.
    prisma.lectureNote.findUnique({ where: { enrolmentId_lectureId: { enrolmentId, lectureId } } }),
  ]);

  // Quiz metadata only — question count and pass mark, never the
  // question bank or answer key (rule 4). The full question set is only
  // sent to the client from startQuizAttempt, once, and still without
  // isCorrect.
  let quiz: { quizId: string; questionCount: number; passMarkPercent: number } | null = null;
  let quizAttempt: Awaited<ReturnType<typeof prisma.quizAttempt.findFirst>> = null;
  if (currentLecture.steps.includes("quiz") && lecture.module.quiz) {
    const questionCount = await prisma.quizQuestion.count({ where: { quizId: lecture.module.quiz.id } });
    quiz = { quizId: lecture.module.quiz.id, questionCount, passMarkPercent: lecture.module.quiz.passMarkPercent };
    quizAttempt = await prisma.quizAttempt.findFirst({
      where: { enrolmentId, quizId: lecture.module.quiz.id },
      orderBy: { attemptNumber: "desc" },
    });
  }

  return {
    enrolment,
    programme: enrolment.programme,
    hasExam: !!enrolment.programme.exam,
    module: { id: currentModule.id, title: currentModule.title, weekNumber: currentModule.weekNumber },
    lecture: {
      id: lecture.id,
      title: lecture.title,
      mediaKind: lecture.mediaKind,
      videoUrl: lecture.videoAsset ? getSignedAssetUrl(lecture.videoAsset.storageKey, "video") : lecture.videoUrl,
      narrationMode: lecture.narrationMode,
      narrationAutoAdvance: lecture.narrationAutoAdvance,
      narrationRequireFull: lecture.narrationRequireFull,
      fullNarrationUrl: lecture.fullNarrationAsset ? getSignedAssetUrl(lecture.fullNarrationAsset.storageKey, "video") : null,
      scenarioPrompt: lecture.scenarioPrompt,
      scenarioGuidance: lecture.scenarioGuidance,
      draftingPrompt: lecture.draftingPrompt,
      draftingWordLimit: lecture.draftingWordLimit,
      slides,
    },
    steps: currentLecture.steps,
    lectureState: currentLecture.state,
    stepsCompleted: currentLecture.stepsCompleted,
    resumePosition: { slideIndex: progress?.slideIndex ?? 0, mediaPositionSeconds: progress?.mediaPositionSeconds ?? 0 },
    draftingSubmission,
    lectureNote,
    quiz,
    quizAttempt,
    prevLectureId,
    nextLectureId,
    isLastLectureInProgramme,
    modules: moduleTree,
  };
}

/** Across every active/completed enrolment — a candidate can hold more than one. */
export async function listDeadlines(candidateId: string) {
  const enrolments = await prisma.enrolment.findMany({
    where: { candidateId, status: { in: [EnrolmentStatus.ACTIVE, EnrolmentStatus.COMPLETED] } },
    select: { id: true, programme: { select: { title: true, code: true } } },
  });
  const enrolmentIds = enrolments.map((e) => e.id);
  if (enrolmentIds.length === 0) return [];
  const enrolmentById = new Map(enrolments.map((e) => [e.id, e]));

  const deadlines = await prisma.deadline.findMany({
    where: { enrolmentId: { in: enrolmentIds } },
    orderBy: { dueAt: "asc" },
  });

  const now = new Date();
  return deadlines.map((d) => ({
    ...d,
    state: computeDeadlineState(d, now),
    programmeTitle: enrolmentById.get(d.enrolmentId)?.programme.title ?? "",
    programmeCode: enrolmentById.get(d.enrolmentId)?.programme.code ?? "",
  }));
}

export type ProgrammeListStatus = "not_started" | "in_progress" | "completed";

/**
 * The Your Programmes list — every enrolment, each with its own lecture
 * count and up-next lecture (reusing getProgrammeOverview's locked-aware
 * derivation rather than a raw "first incomplete" query, so a locked
 * lecture is never surfaced as next). Status is computed from progress,
 * not Enrolment.status, since nothing in this codebase transitions an
 * enrolment to COMPLETED yet — 100% lectures done is the real signal.
 */
export async function listCandidateProgrammes(candidateId: string) {
  const enrolments = await prisma.enrolment.findMany({
    where: { candidateId, status: { in: [EnrolmentStatus.ACTIVE, EnrolmentStatus.COMPLETED] } },
    include: { programme: true, intake: true },
    orderBy: { enrolledAt: "desc" },
  });

  return Promise.all(
    enrolments.map(async (e) => {
      const overview = await getProgrammeOverview(candidateId, e.id);
      let completed = 0;
      let total = 0;
      for (const mod of overview.modules) {
        total += mod.lectures.length;
        completed += mod.lectures.filter((l) => l.state === LectureState.COMPLETED).length;
      }
      const percent = overview.programmePercent;
      const status: ProgrammeListStatus = percent === 100 ? "completed" : completed === 0 ? "not_started" : "in_progress";

      return {
        enrolmentId: e.id,
        programmeTitle: e.programme.title,
        programmeCode: e.programme.code,
        tier: e.programme.tier,
        intakeMonth: e.intake?.month ?? null,
        intakeYear: e.intake?.year ?? null,
        enrolledAt: e.enrolledAt,
        completedLectures: completed,
        totalLectures: total,
        percent,
        status,
        upNext: overview.upNext ? { moduleTitle: overview.upNext.moduleTitle, lectureTitle: overview.upNext.lectureTitle } : null,
      };
    })
  );
}
