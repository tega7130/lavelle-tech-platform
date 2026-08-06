import type { NextAuthConfig } from "next-auth";

/**
 * Edge-safe half of the config — consumed by middleware.ts. Must not
 * reference Prisma or bcrypt (Credentials `authorize` lives in auth.ts
 * only, which runs in the Node runtime on the actual sign-in request).
 */
export const authConfig = {
  pages: {
    // No dedicated sign-in screen exists yet in this foundation build
    // (Register/Sign In are later-handoff, user-facing screens per the
    // design README). Unauthenticated visits bounce to the marketing stub.
    signIn: "/",
  },
  callbacks: {
    authorized({ auth, request }) {
      const isPortal = request.nextUrl.pathname.startsWith("/portal");
      const isAdmin = request.nextUrl.pathname.startsWith("/admin");
      if (!isPortal && !isAdmin) return true;

      const user = auth?.user;
      if (!user) return false;
      if (isPortal) return user.userType === "candidate";
      if (isAdmin) return user.userType === "staff";
      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
