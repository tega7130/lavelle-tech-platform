import { prisma } from "@/lib/prisma";
import { LectureState, SubmissionState, MarkableKind, MarkState, EnrolmentStatus } from "@/generated/prisma/client";
import { deriveLectureSteps, isLectureComplete, type LectureStep } from "@/lib/lecture-steps";
import { recordAuditEvent } from "@/lib/audit";
import { issueCertificateForCourseCompletion, NotEligibleForCourseCertificateError } from "@/lib/certificate-actions";

// No "server-only" / candidate-session import here, deliberately — same
// discipline as src/lib/offline-recording.ts and enrolment-transaction.ts.
// candidateId is always passed in by the caller (a "use server" Action
// that already resolved it via getCurrentCandidate()), so this file stays
// importable from both Vitest and the seed script.

export class NotYourEnrolmentError extends Error {
  constructor() {
    super("This enrolment does not belong to you.");
    this.name = "NotYourEnrolmentError";
  }
}

async function assertOwnedEnrolment(candidateId: string, enrolmentId: string) {
  const enrolment = await prisma.enrolment.findUniqueOrThrow({ where: { id: enrolmentId } });
  if (enrolment.candidateId !== candidateId) throw new NotYourEnrolmentError();
  return enrolment;
}

/**
 * The position-save route handler's actual logic, extracted so it's
 * testable without a live Next.js request context (`cookies()` inside a
 * route handler only works inside a real request lifecycle, not under
 * Vitest). Never downgrades `state` — reopening a completed lecture to
 * review it can't silently revert it to IN_PROGRESS; only completeStep
 * makes that transition (rule 3). Resuming after an abrupt disconnect
 * relies on nothing more than the last successful upsert here.
 */
export async function savePosition(
  candidateId: string,
  enrolmentId: string,
  lectureId: string,
  position: { slideIndex?: number; mediaPositionSeconds?: number }
) {
  await assertOwnedEnrolment(candidateId, enrolmentId);
  const now = new Date();
  return prisma.lectureProgress.upsert({
    where: { enrolmentId_lectureId: { enrolmentId, lectureId } },
    create: {
      enrolmentId,
      lectureId,
      state: LectureState.IN_PROGRESS,
      slideIndex: position.slideIndex ?? 0,
      mediaPositionSeconds: position.mediaPositionSeconds ?? 0,
      startedAt: now,
      lastSeenAt: now,
    },
    update: {
      ...(position.slideIndex != null ? { slideIndex: position.slideIndex } : {}),
      ...(position.mediaPositionSeconds != null ? { mediaPositionSeconds: position.mediaPositionSeconds } : {}),
      lastSeenAt: now,
    },
  });
}

async function computeStepsForLecture(lectureId: string): Promise<LectureStep[]> {
  const lecture = await prisma.lecture.findUniqueOrThrow({
    where: { id: lectureId },
    include: {
      module: {
        include: {
          lectures: { orderBy: { orderIndex: "asc" }, select: { id: true } },
          quiz: { include: { questions: { select: { id: true } } } },
        },
      },
    },
  });
  const isLastInModule = lecture.module.lectures[lecture.module.lectures.length - 1]?.id === lectureId;
  const moduleHasQuiz =
    !!lecture.module.quiz && lecture.module.quiz.status === "PUBLISHED" && lecture.module.quiz.questions.length > 0;
  return deriveLectureSteps({
    scenarioPrompt: lecture.scenarioPrompt,
    draftingPrompt: lecture.draftingPrompt,
    isLastInModule,
    moduleHasQuiz,
  });
}

/**
 * Idempotent — re-marking an already-completed step is a no-op, not an
 * error. The step list is always recomputed from the authored lecture
 * here (never trusted from the caller), so a lecture completes exactly
 * when every AUTHORED step is in stepsCompleted (rule 3).
 */
export async function completeStep(candidateId: string, enrolmentId: string, lectureId: string, step: LectureStep) {
  await assertOwnedEnrolment(candidateId, enrolmentId);
  const steps = await computeStepsForLecture(lectureId);
  if (!steps.includes(step)) throw new Error(`"${step}" is not an authored step of this lecture`);

  const now = new Date();
  const existing = await prisma.lectureProgress.findUnique({ where: { enrolmentId_lectureId: { enrolmentId, lectureId } } });
  const stepsCompleted = Array.from(new Set([...(existing?.stepsCompleted ?? []), step]));
  const nowComplete = isLectureComplete(stepsCompleted, steps);

  const progress = existing
    ? await prisma.lectureProgress.update({
        where: { id: existing.id },
        data: {
          stepsCompleted,
          state: nowComplete ? LectureState.COMPLETED : LectureState.IN_PROGRESS,
          completedAt: nowComplete ? (existing.completedAt ?? now) : existing.completedAt,
          lastSeenAt: now,
        },
      })
    : await prisma.lectureProgress.create({
        data: {
          enrolmentId,
          lectureId,
          stepsCompleted,
          state: nowComplete ? LectureState.COMPLETED : LectureState.IN_PROGRESS,
          startedAt: now,
          completedAt: nowComplete ? now : null,
          lastSeenAt: now,
        },
      });

  return { state: progress.state, stepsCompleted: progress.stepsCompleted as string[], isComplete: nowComplete };
}

/**
 * A lecture with no drafting prompt has no submission to make — the
 * caller should never reach here for one. Overdue drafting is still
 * submittable (rule 13): this records lateness by setting metAt
 * regardless of whether dueAt has already passed, rather than blocking
 * the submission.
 */
export async function submitDrafting(candidateId: string, enrolmentId: string, lectureId: string) {
  await assertOwnedEnrolment(candidateId, enrolmentId);
  const lecture = await prisma.lecture.findUniqueOrThrow({ where: { id: lectureId } });
  if (!lecture.draftingPrompt) throw new Error("This lecture has no drafting exercise.");

  const existing = await prisma.draftingSubmission.findFirst({
    where: { enrolmentId, lectureId },
    orderBy: { attemptNumber: "desc" },
  });
  // RESUBMITTED is the same "still being written" state as DRAFT — it
  // just marks that THIS attempt exists because a prior one was referred
  // (requestResubmission), not that it's somehow already submitted.
  if (!existing || (existing.state !== SubmissionState.DRAFT && existing.state !== SubmissionState.RESUBMITTED)) {
    throw new Error("Nothing to submit — save a draft first.");
  }
  if (existing.body.trim().length === 0) throw new Error("Write something before submitting.");

  const now = new Date();
  // Captured before the deadline is marked met, so lateness reflects
  // whether the candidate was already overdue at the moment they
  // submitted (rule: lateness is recorded, never auto-penalised —
  // src/lib/marking-actions.ts is where it's shown to the marker).
  const deadline = await prisma.deadline.findFirst({ where: { enrolmentId, lectureId, kind: "DRAFTING_DUE" } });
  const isLate = !!deadline && deadline.dueAt.getTime() < now.getTime();

  const submission = await prisma.draftingSubmission.update({
    where: { id: existing.id },
    data: { state: SubmissionState.SUBMITTED, submittedAt: now },
  });

  await prisma.deadline.updateMany({
    where: { enrolmentId, lectureId, kind: "DRAFTING_DUE", metAt: null },
    data: { metAt: now },
  });

  // Enters the Slice 05 marking queue — every drafting submission gets
  // exactly one Mark row per attempt (draftingSubmissionId is @unique on
  // Mark), created here rather than left for a marker to notice the
  // submission exists some other way.
  await prisma.mark.create({
    data: { enrolmentId, kind: MarkableKind.DRAFTING, draftingSubmissionId: submission.id, state: MarkState.AWAITING, isLate },
  });

  await completeStep(candidateId, enrolmentId, lectureId, "drafting");
  return submission;
}

/** The question set only — options carry no isCorrect flag (rule 4). */
export async function startQuizAttempt(candidateId: string, enrolmentId: string, quizId: string) {
  await assertOwnedEnrolment(candidateId, enrolmentId);
  const quiz = await prisma.quiz.findUniqueOrThrow({
    where: { id: quizId },
    include: { questions: { orderBy: { orderIndex: "asc" }, include: { options: { orderBy: { orderIndex: "asc" } } } } },
  });
  if (quiz.status !== "PUBLISHED") throw new Error("This quiz is not currently available.");

  const inProgress = await prisma.quizAttempt.findFirst({ where: { enrolmentId, quizId, submittedAt: null } });
  const attempt =
    inProgress ??
    (await (async () => {
      const last = await prisma.quizAttempt.findFirst({ where: { enrolmentId, quizId }, orderBy: { attemptNumber: "desc" } });
      return prisma.quizAttempt.create({ data: { enrolmentId, quizId, attemptNumber: (last?.attemptNumber ?? 0) + 1 } });
    })());

  return {
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    passMarkPercent: quiz.passMarkPercent,
    questions: quiz.questions.map((q) => ({
      id: q.id,
      prompt: q.prompt,
      marks: q.marks,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    })),
  };
}

/**
 * Grades server-side from the real answer key — the client sends only
 * questionId/selectedOptionId pairs, no isCorrect claim is ever read even
 * if one is sent (rule 4/6). Re-postable: answers are replaced, not
 * appended, so a retried submit after a dropped response can't double up.
 */
export async function submitQuizAttempt(
  candidateId: string,
  attemptId: string,
  answers: { questionId: string; selectedOptionId: string | null }[]
) {
  const attempt = await prisma.quizAttempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: {
      enrolment: true,
      quiz: {
        include: {
          questions: { include: { options: true } },
          module: { include: { lectures: { orderBy: { orderIndex: "asc" } } } },
        },
      },
    },
  });
  if (attempt.enrolment.candidateId !== candidateId) throw new NotYourEnrolmentError();
  if (attempt.submittedAt) throw new Error("This attempt has already been submitted.");

  const answerByQuestion = new Map(answers.map((a) => [a.questionId, a.selectedOptionId]));
  let correctCount = 0;
  const results: {
    questionId: string;
    selectedOptionId: string | null;
    correctOptionId: string | null;
    isCorrect: boolean;
    explanation: string | null;
  }[] = [];

  for (const q of attempt.quiz.questions) {
    const selectedOptionId = answerByQuestion.get(q.id) ?? null;
    const correctOption = q.options.find((o) => o.isCorrect) ?? null;
    const isCorrect = selectedOptionId != null && correctOption?.id === selectedOptionId;
    if (isCorrect) correctCount++;
    results.push({
      questionId: q.id,
      selectedOptionId,
      correctOptionId: correctOption?.id ?? null,
      isCorrect,
      explanation: q.explanation,
    });
  }

  const scorePercent = attempt.quiz.questions.length > 0 ? Math.round((correctCount / attempt.quiz.questions.length) * 100) : 0;
  const passed = scorePercent >= attempt.quiz.passMarkPercent;
  const now = new Date();

  await prisma.$transaction([
    prisma.quizAnswer.deleteMany({ where: { attemptId } }),
    prisma.quizAnswer.createMany({
      data: results.map((r) => ({
        attemptId,
        questionId: r.questionId,
        selectedOptionId: r.selectedOptionId,
        isCorrect: r.isCorrect,
      })),
    }),
    prisma.quizAttempt.update({ where: { id: attemptId }, data: { scorePercent, passed, submittedAt: now } }),
    prisma.deadline.updateMany({
      where: { enrolmentId: attempt.enrolmentId, moduleId: attempt.quiz.moduleId, kind: "QUIZ_DUE", metAt: null },
      data: { metAt: now },
    }),
  ]);

  // Submitting the quiz (not passing it) is what completes the "quiz"
  // step — a fail is a real, visible result but the LMS is formative
  // here, not gating; nothing in the README makes lecture completion
  // conditional on a pass.
  const lastLecture = attempt.quiz.module.lectures[attempt.quiz.module.lectures.length - 1];
  if (lastLecture) await completeStep(candidateId, attempt.enrolmentId, lastLecture.id, "quiz");

  return { scorePercent, passed, passMarkPercent: attempt.quiz.passMarkPercent, results };
}

/**
 * The candidate-facing "Complete Programme" moment — every PUBLISHED
 * lecture must already be COMPLETED (recomputed here, never trusted from
 * the caller, same discipline as completeStep). Idempotent: re-clicking
 * after completion just re-reads the same certificate state rather than
 * erroring.
 *
 * Two very different certificate paths meet here:
 *  - A programme WITH a certifying exam: a certificate is NOT minted
 *    here — issueCertificate only fires off a passed, released exam
 *    Sitting (src/lib/certificate-actions.ts), a separate staff-graded
 *    flow. This just reports whether one already exists.
 *  - A programme with NO exam at all: there's no Sitting to gate on, so
 *    finishing the course is what earns it — issued right here via
 *    issueCertificateForCourseCompletion, which re-validates completion
 *    and every module quiz's pass state itself before minting anything.
 */
export async function completeProgramme(candidateId: string, enrolmentId: string) {
  const enrolment = await assertOwnedEnrolment(candidateId, enrolmentId);

  const [totalPublished, completedCount] = await Promise.all([
    prisma.lecture.count({ where: { module: { programmeId: enrolment.programmeId }, status: "PUBLISHED" } }),
    prisma.lectureProgress.count({ where: { enrolmentId, state: LectureState.COMPLETED } }),
  ]);
  if (totalPublished === 0 || completedCount < totalPublished) {
    throw new Error("Not every lecture in this programme has been completed yet.");
  }

  const now = new Date();
  if (!enrolment.completedAt) {
    await prisma.enrolment.update({
      where: { id: enrolmentId },
      data: {
        completedAt: now,
        status: enrolment.status === EnrolmentStatus.ACTIVE ? EnrolmentStatus.COMPLETED : enrolment.status,
      },
    });
    await recordAuditEvent(prisma, {
      actorStaffId: null,
      subjectType: "enrolment",
      subjectId: enrolmentId,
      action: "enrolment.programme_completed",
      description: `Candidate ${candidateId} completed every lecture in programme ${enrolment.programmeId}`,
      ipAddress: null,
    });
  }

  const programmeHasExam = !!(await prisma.exam.findFirst({ where: { programmeId: enrolment.programmeId }, select: { id: true } }));
  if (!programmeHasExam) {
    try {
      const certificate = await issueCertificateForCourseCompletion(enrolmentId);
      return { certificateNumber: certificate.certificateNumber };
    } catch (e) {
      if (!(e instanceof NotEligibleForCourseCertificateError)) throw e;
      // Not eligible yet (a module quiz not yet passed, or no template
      // active for the tier) — fall through to the read-only lookup below,
      // same "results still pending" outcome as the exam-gated path.
    }
  }

  const certificate = await prisma.certificate.findFirst({
    where: { candidateId, programmeId: enrolment.programmeId, status: "ACTIVE" },
    select: { certificateNumber: true },
  });

  return { certificateNumber: certificate?.certificateNumber ?? null };
}
