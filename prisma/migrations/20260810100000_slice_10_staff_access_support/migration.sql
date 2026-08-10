-- CreateEnum
CREATE TYPE "RequestPriority" AS ENUM ('LOW', 'NORMAL', 'URGENT');

-- AlterEnum
ALTER TYPE "NotificationCategory" ADD VALUE 'SUPPORT';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "staffId" TEXT,
ALTER COLUMN "candidateId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "staffId" TEXT,
ALTER COLUMN "candidateId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Staff" ADD COLUMN     "activatedAt" TIMESTAMP(3),
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "SupportRequest" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedByStaffId" TEXT,
ADD COLUMN     "assignmentNote" TEXT,
ADD COLUMN     "priority" "RequestPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "resolvedByStaffId" TEXT;

-- CreateTable
-- invitedByStaffId is nullable: null means a self-service password reset
-- (requestStaffPasswordReset), non-null means a real invitation.
CREATE TABLE "StaffInvitationToken" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "invitedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffInvitationToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffInvitationToken_staffId_consumedAt_idx" ON "StaffInvitationToken"("staffId", "consumedAt");

-- CreateIndex
CREATE INDEX "Notification_staffId_createdAt_idx" ON "Notification"("staffId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Session_staffId_revokedAt_idx" ON "Session"("staffId", "revokedAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitationToken" ADD CONSTRAINT "StaffInvitationToken_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffInvitationToken" ADD CONSTRAINT "StaffInvitationToken_invitedByStaffId_fkey" FOREIGN KEY ("invitedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_assignedByStaffId_fkey" FOREIGN KEY ("assignedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_resolvedByStaffId_fkey" FOREIGN KEY ("resolvedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CheckConstraint (hand-added — Prisma has no schema syntax for this yet)
-- Exactly one of candidateId/staffId is non-null: one session table for
-- both applications, but a row must belong to exactly one of them.
ALTER TABLE "Session" ADD CONSTRAINT "session_exactly_one_owner" CHECK (num_nonnulls("candidateId", "staffId") = 1);

-- CheckConstraint (hand-added) — same rule for Notification.
ALTER TABLE "Notification" ADD CONSTRAINT "notification_exactly_one_owner" CHECK (num_nonnulls("candidateId", "staffId") = 1);

