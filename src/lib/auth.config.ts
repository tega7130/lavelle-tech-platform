import type { NextAuthConfig } from "next-auth";
import type { SessionUser } from "@/types/next-auth";

/**
 * Edge-safe half of the config — staff/admin auth only. Must not
 * reference Prisma or bcrypt (Credentials `authorize` lives in auth.ts
 * only, which runs in the Node runtime on the actual sign-in request).
 * middleware.ts calls `auth()` from this config directly to read the
 * staff session for /admin route gating; there is no dedicated staff
 * sign-in screen yet, so `pages.signIn` just bounces to the marketing stub.
 */
export const authConfig = {
  pages: {
    signIn: "/",
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) token.user = user as SessionUser;
      return token;
    },
    session({ session, token }) {
      if (token.user) session.user = token.user as unknown as typeof session.user;
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
