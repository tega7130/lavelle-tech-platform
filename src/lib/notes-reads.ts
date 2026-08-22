import "server-only";
import { prisma } from "@/lib/prisma";
import { EnrolmentStatus } from "@/generated/prisma/client";
import { markupToPlainTextPreview } from "@/lib/rich-text";

/**
 * Every note a candidate has written, across every active/completed
 * enrolment — same two-step (enrolment -> child rows) query shape as
 * listDeadlines/listCandidateProgrammes in player-reads.ts, not a nested
 * relation filter, so a withdrawn/refunded enrolment's notes don't
 * surface here either. Grouped programme -> module -> lecture for the
 * Notes page; each note carries the enrolmentId/lectureId needed to link
 * back into the player.
 */
export async function getCandidateNotes(candidateId: string) {
  const enrolments = await prisma.enrolment.findMany({
    where: { candidateId, status: { in: [EnrolmentStatus.ACTIVE, EnrolmentStatus.COMPLETED] } },
    select: { id: true, programme: { select: { id: true, title: true, code: true } } },
  });
  const enrolmentIds = enrolments.map((e) => e.id);
  if (enrolmentIds.length === 0) return [];
  const enrolmentById = new Map(enrolments.map((e) => [e.id, e]));

  const notes = await prisma.lectureNote.findMany({
    where: { enrolmentId: { in: enrolmentIds } },
    orderBy: { updatedAt: "desc" },
    include: {
      lecture: { select: { id: true, title: true, module: { select: { id: true, title: true, weekNumber: true } } } },
    },
  });

  type ProgrammeGroup = {
    programmeId: string;
    programmeTitle: string;
    programmeCode: string;
    enrolmentId: string;
    notes: {
      lectureId: string;
      lectureTitle: string;
      moduleTitle: string;
      weekNumber: number;
      preview: string;
      updatedAt: Date;
    }[];
  };

  const groups = new Map<string, ProgrammeGroup>();
  for (const note of notes) {
    const enrolment = enrolmentById.get(note.enrolmentId);
    if (!enrolment) continue; // withdrawn/refunded since this enrolment list was loaded — skip rather than throw
    const key = enrolment.id;
    let group = groups.get(key);
    if (!group) {
      group = {
        programmeId: enrolment.programme.id,
        programmeTitle: enrolment.programme.title,
        programmeCode: enrolment.programme.code,
        enrolmentId: enrolment.id,
        notes: [],
      };
      groups.set(key, group);
    }
    group.notes.push({
      lectureId: note.lecture.id,
      lectureTitle: note.lecture.title,
      moduleTitle: note.lecture.module.title,
      weekNumber: note.lecture.module.weekNumber,
      preview: markupToPlainTextPreview(note.body),
      updatedAt: note.updatedAt,
    });
  }

  return Array.from(groups.values());
}
