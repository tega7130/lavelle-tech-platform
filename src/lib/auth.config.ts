import type { NextAuthConfig } from "next-auth";
import type { SessionUser } from "@/types/next-auth";

/**
 * Edge-safe half of the config — consumed by both auth.ts (full config,
 * Node runtime) and proxy.ts (route protection, Edge runtime). Must not
 * reference Prisma or bcrypt (Credentials `authorize` lives in auth.ts
 * only, which runs in the Node runtime on the actual sign-in request).
 *
 * jwt/session live here rather than in auth.ts: proxy.ts builds its own
 * separate NextAuth(authConfig) instance to read the session for route
 * gating, and that instance only sees whatever callbacks are defined on
 * *this* config — without these two here, its `authorized` callback would
 * decode the JWT using NextAuth's default session shape (just name/email)
 * instead of our custom SessionUser payload, and every route would look
 * unauthenticated.
 */
export const authConfig = {
  pages: {
    // No dedicated sign-in screen exists yet in this foundation build
    // (Register/Sign In are later-handoff, user-facing screens per the
    // design README). Unauthenticated visits bounce to the marketing stub.
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
