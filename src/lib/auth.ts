import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/lib/auth.config";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { Permission, StaffStatus } from "@/generated/prisma/client";
import type { SessionUser } from "@/types/next-auth";

// Staff/admin auth only — candidates use hand-rolled DB sessions
// (src/lib/candidate-session.ts), not Auth.js. See that file's header
// comment for why the two aren't unified.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  session: { strategy: "jwt" },
  providers: [
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
          include: { permissionGrants: true },
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
});
