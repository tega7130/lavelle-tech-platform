import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";

// Uses the edge-safe half of the config only (no Prisma/bcrypt) so this
// can run in the middleware runtime.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*"],
};
