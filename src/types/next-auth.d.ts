import type { CandidateAccountStatus, Permission, StaffRole } from "@/generated/prisma/client";

type CandidateSessionUser = {
  userType: "candidate";
  id: string;
  name: string;
  email: string;
  candidateNumber: string | null;
  provisionalApplicantNumber: string;
  accountStatus: CandidateAccountStatus;
};

type StaffSessionUser = {
  userType: "staff";
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  permissions: Permission[];
};

export type SessionUser = CandidateSessionUser | StaffSessionUser;

declare module "next-auth" {
  interface Session {
    user: SessionUser;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    user?: SessionUser;
  }
}
