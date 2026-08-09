import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireStaffPermission } from "@/lib/staff-auth";
import { Permission } from "@/generated/prisma/client";

const bodySchema = z.object({
  markId: z.string().trim().min(1),
  scorePercent: z.number().int().min(0).max(100).optional(),
  feedback: z.string().optional(),
  rubricScores: z.record(z.string(), z.number()).optional(),
});

/**
 * A route handler, not a Server Action — debounced feedback autosave
 * while the marker types. A mark already RETURNED refuses the write
 * (409): returning is final, an autosave racing a return must not
 * silently clobber it.
 */
export async function POST(request: NextRequest) {
  let staff;
  try {
    staff = await requireStaffPermission(Permission.MARK_SUBMISSIONS);
  } catch {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const json = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { markId, scorePercent, feedback, rubricScores } = parsed.data;

  const mark = await prisma.mark.findUnique({ where: { id: markId } });
  if (!mark) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (mark.state === "RETURNED") return NextResponse.json({ error: "already_returned" }, { status: 409 });

  await prisma.mark.update({
    where: { id: markId },
    data: {
      ...(scorePercent != null ? { scorePercent } : {}),
      ...(feedback != null ? { feedback } : {}),
      ...(rubricScores != null ? { rubricScores } : {}),
      markedByStaffId: mark.markedByStaffId ?? staff.id,
    },
  });

  return NextResponse.json({ ok: true });
}
