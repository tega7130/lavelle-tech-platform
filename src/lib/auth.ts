import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { Permission, StaffStatus } from "@/generated/prisma/client";
import type { SessionUser } from "@/types/next-auth";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
    // Two separate credential domains per the design's account model —
    // a candidate and a staff member are never the same login surface.
    Credentials({
      id: "candidate",
      name: "Candidate",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const candidate = await prisma.candidate.findUnique({ where: { email } });
        if (!candidate) return null;
        if (!(await verifyPassword(password, candidate.passwordHash))) return null;

        // Suspended candidates can still sign in — the shell shows the
        // suspension banner and gates specific actions, it does not lock
        // the account out entirely (README).
        const user: SessionUser = {
          userType: "candidate",
          id: candidate.id,
          name: `${candidate.firstName} ${candidate.lastName}`,
          email: candidate.email,
          candidateNumber: candidate.candidateNumber,
          provisionalApplicantNumber: candidate.provisionalApplicantNumber,
          accountStatus: candidate.accountStatus,
        };
        return user;
      },
    }),
    Credentials({
      id: "staff",
      name: "Staff",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") return null;

        const staff = await prisma.staff.findUnique({
          where: { email },
          include: { permissionGrants: { where: { granted: true } } },
        });
        if (!staff) return null;
        if (staff.status !== StaffStatus.ACTIVE) return null;
        if (!(await verifyPassword(password, staff.passwordHash))) return null;

        const user: SessionUser = {
          userType: "staff",
          id: staff.id,
          name: staff.name,
          email: staff.email,
          role: staff.role,
          permissions: staff.permissionGrants.map((g) => g.permission as Permission),
        };
        return user;
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) token.user = user as SessionUser;
      return token;
    },
    session({ session, token }) {
      if (token.user) session.user = token.user as unknown as typeof session.user;
      return session;
    },
  },
});
