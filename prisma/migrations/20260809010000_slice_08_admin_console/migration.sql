-- Slice 08: admin console.
--
-- Staff/PermissionGrant already carry real rows (six seeded staff, plus a
-- fair amount of orphaned test-run debris under the old role/permission
-- values) — this migration converts them in place rather than wiping and
-- reseeding, exactly as a production migration would have to.

-- ── New standalone enums (no existing data) ────────────────────────────

CREATE TYPE "RequestCategory" AS ENUM ('ENROLMENT', 'PAYMENT', 'TECHNICAL', 'PROGRAMME', 'OTHER');
CREATE TYPE "RequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED');
CREATE TYPE "AnnouncementState" AS ENUM ('DRAFT', 'SCHEDULED', 'SENT', 'WITHDRAWN');
CREATE TYPE "Channel" AS ENUM ('IN_APP', 'EMAIL', 'WHATSAPP', 'SMS');

-- ── StaffRole: rename in place, converting existing rows ───────────────

BEGIN;
CREATE TYPE "StaffRole_new" AS ENUM ('SUPER_ADMIN', 'REGISTRAR', 'ACADEMIC_ADMIN', 'FACULTY', 'FINANCE', 'SUPPORT', 'READ_ONLY');
ALTER TABLE "Staff" ALTER COLUMN "role" TYPE "StaffRole_new" USING (
  CASE "role"::text
    WHEN 'OPERATIONS_ADMIN' THEN 'REGISTRAR'
    WHEN 'FINANCE_ADMIN' THEN 'FINANCE'
    WHEN 'SUPPORT_AGENT' THEN 'SUPPORT'
    ELSE "role"::text
  END
)::"StaffRole_new";
ALTER TYPE "StaffRole" RENAME TO "StaffRole_old";
ALTER TYPE "StaffRole_new" RENAME TO "StaffRole";
DROP TYPE "public"."StaffRole_old";
COMMIT;

-- ── StaffStatus: rename in place, converting existing rows ─────────────

BEGIN;
CREATE TYPE "StaffStatus_new" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED', 'DEACTIVATED');
ALTER TABLE "Staff" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Staff" ALTER COLUMN "status" TYPE "StaffStatus_new" USING (
  CASE "status"::text
    WHEN 'INACTIVE' THEN 'DEACTIVATED'
    ELSE "status"::text
  END
)::"StaffStatus_new";
ALTER TYPE "StaffStatus" RENAME TO "StaffStatus_old";
ALTER TYPE "StaffStatus_new" RENAME TO "StaffStatus";
DROP TYPE "public"."StaffStatus_old";
ALTER TABLE "Staff" ALTER COLUMN "status" SET DEFAULT 'INVITED';
COMMIT;

-- ── Staff: new columns ───────────────────────────────────────────────────

ALTER TABLE "Staff" ADD COLUMN "invitedByStaffId" TEXT,
ADD COLUMN "lastActiveAt" TIMESTAMP(3);

-- ── PermissionGrant -> StaffPermission ──────────────────────────────────
--
-- The 18-permission catalogue collapses/splits into 17 differently-drawn
-- permissions (e.g. old MANAGE_PROGRAMMES covered both programme
-- authoring and exam authoring; the new catalogue separates
-- manage_programmes from manage_exams). Existing holders of the old,
-- broader permission are carried over onto BOTH of its successors —
-- over-granting on a rename is the safe direction; silently narrowing an
-- existing admin's access would not be.

CREATE TABLE "_old_grants" AS
SELECT "staffId", "permission"::text AS "permission", "updatedAt"
FROM "PermissionGrant"
WHERE "granted" = true;

ALTER TABLE "PermissionGrant" DROP CONSTRAINT "PermissionGrant_staffId_fkey";
DROP TABLE "PermissionGrant";
DROP TYPE "Permission";

CREATE TYPE "Permission" AS ENUM ('VIEW_CANDIDATES', 'EDIT_CANDIDATE_DETAILS', 'SUSPEND_CANDIDATES', 'MANAGE_PROGRAMMES', 'MANAGE_INTAKES_COHORTS', 'MARK_SUBMISSIONS', 'MODERATE_GRADES', 'MANAGE_EXAMS', 'VIEW_FINANCE', 'CONFIRM_PAYMENTS', 'MANAGE_FINANCE', 'ISSUE_CERTIFICATES', 'REVOKE_CERTIFICATES', 'MANAGE_ANNOUNCEMENTS', 'RESPOND_SUPPORT', 'MANAGE_STAFF', 'VIEW_AUDIT_LOG');

CREATE TABLE "StaffPermission" (
    "staffId" TEXT NOT NULL,
    "permission" "Permission" NOT NULL,
    "grantedByStaffId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPermission_pkey" PRIMARY KEY ("staffId","permission")
);

-- Self-granted is the only honest answer for pre-existing rows — there is
-- no real "who granted this" history to backfill from.
INSERT INTO "StaffPermission" ("staffId", "permission", "grantedByStaffId", "grantedAt")
SELECT g."staffId", mapped."permission"::"Permission", g."staffId", g."updatedAt"
FROM "_old_grants" g
CROSS JOIN LATERAL (
  VALUES
    (CASE g."permission"
      WHEN 'VIEW_CANDIDATES' THEN ARRAY['VIEW_CANDIDATES']
      WHEN 'EDIT_CANDIDATES' THEN ARRAY['EDIT_CANDIDATE_DETAILS', 'SUSPEND_CANDIDATES']
      WHEN 'VIEW_CONTACT_REQUESTS' THEN ARRAY['RESPOND_SUPPORT']
      WHEN 'RESOLVE_CONTACT_REQUESTS' THEN ARRAY['RESPOND_SUPPORT']
      WHEN 'ADD_ADMIN_NOTES' THEN ARRAY['VIEW_CANDIDATES']
      WHEN 'VIEW_PAYMENTS' THEN ARRAY['VIEW_FINANCE']
      WHEN 'MANAGE_PAYMENTS' THEN ARRAY['CONFIRM_PAYMENTS', 'MANAGE_FINANCE']
      WHEN 'VIEW_GRADES' THEN ARRAY['VIEW_CANDIDATES']
      WHEN 'GRADE_ASSESSMENTS' THEN ARRAY['MARK_SUBMISSIONS']
      WHEN 'MODERATE_MARKS' THEN ARRAY['MODERATE_GRADES']
      WHEN 'MANAGE_PROGRAMMES' THEN ARRAY['MANAGE_PROGRAMMES', 'MANAGE_EXAMS']
      WHEN 'MANAGE_INTAKES' THEN ARRAY['MANAGE_INTAKES_COHORTS']
      WHEN 'ISSUE_CERTIFICATES' THEN ARRAY['ISSUE_CERTIFICATES']
      WHEN 'REVOKE_CERTIFICATES' THEN ARRAY['REVOKE_CERTIFICATES']
      WHEN 'VIEW_AUDIT_LOG' THEN ARRAY['VIEW_AUDIT_LOG']
      WHEN 'EXPORT_DATA' THEN ARRAY['MARK_SUBMISSIONS']
      WHEN 'MANAGE_STAFF' THEN ARRAY['MANAGE_STAFF']
      WHEN 'SUPER_ADMIN' THEN ARRAY[]::text[] -- now a role, not a permission row; SUPER_ADMIN-role staff get all 17 below
      ELSE ARRAY[]::text[]
    END)
) AS m("permissions")
CROSS JOIN LATERAL unnest(m."permissions") AS mapped("permission")
ON CONFLICT ("staffId", "permission") DO NOTHING;

-- SUPER_ADMIN holds every permission as real rows, not a bypass flag.
INSERT INTO "StaffPermission" ("staffId", "permission", "grantedByStaffId", "grantedAt")
SELECT s."id", p."permission"::"Permission", s."id", now()
FROM "Staff" s
CROSS JOIN unnest(enum_range(NULL::"Permission")) AS p("permission")
WHERE s."role" = 'SUPER_ADMIN'
ON CONFLICT ("staffId", "permission") DO NOTHING;

DROP TABLE "_old_grants";

ALTER TABLE "StaffPermission" ADD CONSTRAINT "StaffPermission_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffPermission" ADD CONSTRAINT "StaffPermission_grantedByStaffId_fkey" FOREIGN KEY ("grantedByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Staff" ADD CONSTRAINT "Staff_invitedByStaffId_fkey" FOREIGN KEY ("invitedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ── ContactRequest / AdminNote: dropped wholesale (zero rows, zero readers) ──

ALTER TABLE "AdminNote" DROP CONSTRAINT "AdminNote_candidateId_fkey";
ALTER TABLE "AdminNote" DROP CONSTRAINT "AdminNote_staffId_fkey";
ALTER TABLE "ContactRequest" DROP CONSTRAINT "ContactRequest_candidateId_fkey";
ALTER TABLE "ContactRequest" DROP CONSTRAINT "ContactRequest_resolvedByStaffId_fkey";
DROP TABLE "AdminNote";
DROP TABLE "ContactRequest";
DROP TYPE "ContactRequestStatus";

-- ── New tables: support desk, notes, announcements ──────────────────────

CREATE TABLE "SupportRequest" (
    "id" TEXT NOT NULL,
    "candidateId" UUID NOT NULL,
    "subject" TEXT NOT NULL,
    "category" "RequestCategory" NOT NULL,
    "body" TEXT NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'OPEN',
    "assignedStaffId" TEXT,
    "firstRespondedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportMessage" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "authorStaffId" TEXT,
    "authorCandidateId" UUID,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupportMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CandidateNote" (
    "id" TEXT NOT NULL,
    "candidateId" UUID NOT NULL,
    "authorStaffId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandidateNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "audienceFilter" JSONB NOT NULL,
    "channels" "Channel"[],
    "state" "AnnouncementState" NOT NULL DEFAULT 'DRAFT',
    "scheduledFor" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "recipientCount" INTEGER,
    "createdByStaffId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnnouncementDelivery" (
    "id" TEXT NOT NULL,
    "announcementId" TEXT NOT NULL,
    "candidateId" UUID NOT NULL,
    "channel" "Channel" NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "AnnouncementDelivery_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SupportRequest_status_idx" ON "SupportRequest"("status");
CREATE INDEX "SupportRequest_candidateId_idx" ON "SupportRequest"("candidateId");
CREATE INDEX "SupportMessage_requestId_createdAt_idx" ON "SupportMessage"("requestId", "createdAt");
CREATE INDEX "CandidateNote_candidateId_createdAt_idx" ON "CandidateNote"("candidateId", "createdAt");
CREATE INDEX "Announcement_state_scheduledFor_idx" ON "Announcement"("state", "scheduledFor");
CREATE INDEX "AnnouncementDelivery_announcementId_idx" ON "AnnouncementDelivery"("announcementId");
CREATE UNIQUE INDEX "AnnouncementDelivery_announcementId_candidateId_channel_key" ON "AnnouncementDelivery"("announcementId", "candidateId", "channel");

ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_assignedStaffId_fkey" FOREIGN KEY ("assignedStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SupportRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorStaffId_fkey" FOREIGN KEY ("authorStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SupportMessage" ADD CONSTRAINT "SupportMessage_authorCandidateId_fkey" FOREIGN KEY ("authorCandidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CandidateNote" ADD CONSTRAINT "CandidateNote_authorStaffId_fkey" FOREIGN KEY ("authorStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Announcement" ADD CONSTRAINT "Announcement_createdByStaffId_fkey" FOREIGN KEY ("createdByStaffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnnouncementDelivery" ADD CONSTRAINT "AnnouncementDelivery_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnnouncementDelivery" ADD CONSTRAINT "AnnouncementDelivery_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
