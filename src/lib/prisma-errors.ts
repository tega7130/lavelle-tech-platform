import type { Prisma } from "@/generated/prisma/client";

/**
 * The column(s) that violated a P2002 unique constraint. Prisma 7's
 * `@prisma/adapter-pg` driver reports this at
 * `meta.driverAdapterError.cause.constraint.fields`, NOT the classic
 * `meta.target` — code written against `meta.target` silently gets an
 * empty array and falls through to the wrong branch (e.g. treating a
 * duplicate email as some unrelated failure). Checks both shapes so this
 * keeps working regardless of which one a given Prisma/adapter version
 * actually populates.
 */
export function p2002Target(e: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = e.meta as Record<string, unknown> | undefined;
  if (Array.isArray(meta?.target)) return meta.target as string[];
  const driverAdapterError = meta?.driverAdapterError as { cause?: { constraint?: { fields?: unknown } } } | undefined;
  const fields = driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(fields)) return fields as string[];
  return [];
}
