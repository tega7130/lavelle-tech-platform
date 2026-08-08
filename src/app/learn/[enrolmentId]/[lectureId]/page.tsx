import { redirect } from "next/navigation";
import { getCurrentCandidate, requireEnrolled } from "@/lib/candidate-session";
import { getLecturePlayer, LectureLockedError, NotYourEnrolmentError } from "@/lib/player-reads";
import { LecturePlayer } from "@/components/portal/lecture-player";

// Its own full-window layout — no portal sidebar/header (README) — this
// route deliberately sits outside app/portal/* so it doesn't inherit
// PortalLayout's CandidateShell wrapper.
export default async function Page({
  params,
}: {
  params: Promise<{ enrolmentId: string; lectureId: string }>;
}) {
  const { enrolmentId, lectureId } = await params;
  const candidate = await getCurrentCandidate();
  if (!candidate) redirect("/sign-in");
  requireEnrolled(candidate);

  let data: Awaited<ReturnType<typeof getLecturePlayer>>;
  try {
    data = await getLecturePlayer(candidate.id, enrolmentId, lectureId);
  } catch (e) {
    if (e instanceof NotYourEnrolmentError) redirect("/portal/dashboard");
    if (e instanceof LectureLockedError) redirect("/portal/programme");
    throw e;
  }

  return <LecturePlayer enrolmentId={enrolmentId} data={data} />;
}
