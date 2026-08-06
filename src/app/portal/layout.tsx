import { redirect } from "next/navigation";
import { auth, signOut } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CandidateShell } from "@/components/shell/candidate-shell";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session || session.user.userType !== "candidate") redirect("/");

  const candidate = await prisma.candidate.findUnique({
    where: { id: session.user.id },
    include: {
      enrolments: {
        where: { status: "ACTIVE" },
        include: { cohort: true },
        take: 1,
      },
    },
  });
  if (!candidate) redirect("/");

  const initials = `${candidate.firstName[0] ?? ""}${candidate.lastName[0] ?? ""}`.toUpperCase();
  const cohort = candidate.enrolments[0]?.cohort?.label;

  return (
    <CandidateShell
      candidate={{
        name: `${candidate.firstName} ${candidate.lastName}`,
        initials,
        id: candidate.candidateNumber ?? candidate.provisionalApplicantNumber,
        cohort,
      }}
      enrolled={candidate.accountStatus !== "APPLICANT"}
      onSignOut={async () => {
        "use server";
        await signOut();
      }}
    >
      {children}
    </CandidateShell>
  );
}
