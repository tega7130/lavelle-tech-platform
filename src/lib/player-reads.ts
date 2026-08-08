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
    include: { programme: true },
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
  const [modules, progressRows, releaseDeadlines] = await Promise.all([
    prisma.module.findMany({
      where: { programmeId },
      orderBy: { orderIndex: "asc" },
      include: {
        lectures: { orderBy: { orderIndex: "asc" } },
        quiz: { include: { questions: { select: { id: true } } } },
      },
    }),
    prisma.lectureProgress.findMany({ where: { enrolmentId } }),
    prisma.deadline.findMany({ where: { enrolmentId, kind: "LECTURE_RELEASE" } }),
  ]);

  const progressByLecture = new Map(progressRows.map((p) => [p.lectureId, p]));
  const releaseByModule = new Map(releaseDeadlines.map((d) => [d.moduleId, d]));
  const now = new Date();

  let totalLectures = 0;
  let completedLectures = 0;

  const moduleTree = modules.map((mod) => {
    const release = releaseByModule.get(mod.id);
    const isReleased = !release || release.dueAt.getTime() <= now.getTime();
    const moduleHasQuiz = !!mod.quiz && mod.quiz.questions.length > 0;

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
    imageUrl: s.imageAsset ? getSignedAssetUrl(s.imageAsset.storageKey) : null,
    narrationUrl: s.narrationAsset ? getSignedAssetUrl(s.narrationAsset.storageKey) : null,
  }));

  const [progress, draftingSubmission] = await Promise.all([
    prisma.lectureProgress.findUnique({ where: { enrolmentId_lectureId: { enrolmentId, lectureId } } }),
    lecture.draftingPrompt
      ? prisma.draftingSubmission.findFirst({ where: { enrolmentId, lectureId }, orderBy: { attemptNumber: "desc" } })
      : Promise.resolve(null),
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
    module: { id: currentModule.id, title: currentModule.title, weekNumber: currentModule.weekNumber },
    lecture: {
      id: lecture.id,
      title: lecture.title,
      mediaKind: lecture.mediaKind,
      videoUrl: lecture.videoAsset ? getSignedAssetUrl(lecture.videoAsset.storageKey) : lecture.videoUrl,
      narrationMode: lecture.narrationMode,
      narrationAutoAdvance: lecture.narrationAutoAdvance,
      narrationRequireFull: lecture.narrationRequireFull,
      fullNarrationUrl: lecture.fullNarrationAsset ? getSignedAssetUrl(lecture.fullNarrationAsset.storageKey) : null,
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
