-- AlterTable
ALTER TABLE "ProgrammeListing" ADD COLUMN     "comingSoonMessage" TEXT,
ADD COLUMN     "isComingSoon" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ProgrammeNotificationSubscription" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "candidateId" UUID,
    "email" TEXT NOT NULL,
    "notifiedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeNotificationSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgrammeNotificationSubscription_listingId_notifiedAt_idx" ON "ProgrammeNotificationSubscription"("listingId", "notifiedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeNotificationSubscription_listingId_email_key" ON "ProgrammeNotificationSubscription"("listingId", "email");

-- AddForeignKey
ALTER TABLE "ProgrammeNotificationSubscription" ADD CONSTRAINT "ProgrammeNotificationSubscription_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "ProgrammeListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeNotificationSubscription" ADD CONSTRAINT "ProgrammeNotificationSubscription_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
