-- AlterTable
ALTER TABLE "AzubiApplication" ADD COLUMN     "assignedOrganizationId" TEXT,
ADD COLUMN     "assignedSupervisorId" TEXT,
ADD COLUMN     "suspended" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AzubiOrganization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supervisorName" TEXT,
    "supervisorEmail" TEXT,
    "supervisorPhone" TEXT,
    "capacity" INTEGER,
    "preferredPracticeAreas" TEXT,
    "preferredFellowLevel" TEXT,
    "desiredFellowTraits" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AzubiOrganization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AzubiSupervisor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" CITEXT NOT NULL,
    "phone" TEXT,
    "staffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AzubiSupervisor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AzubiOrganization_name_key" ON "AzubiOrganization"("name");

-- CreateIndex
CREATE INDEX "AzubiOrganization_name_idx" ON "AzubiOrganization"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AzubiSupervisor_email_key" ON "AzubiSupervisor"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AzubiSupervisor_staffId_key" ON "AzubiSupervisor"("staffId");

-- CreateIndex
CREATE INDEX "AzubiApplication_assignedOrganizationId_idx" ON "AzubiApplication"("assignedOrganizationId");

-- CreateIndex
CREATE INDEX "AzubiApplication_assignedSupervisorId_idx" ON "AzubiApplication"("assignedSupervisorId");

-- CreateIndex
CREATE INDEX "AzubiApplication_suspended_idx" ON "AzubiApplication"("suspended");

-- AddForeignKey
ALTER TABLE "AzubiApplication" ADD CONSTRAINT "AzubiApplication_assignedOrganizationId_fkey" FOREIGN KEY ("assignedOrganizationId") REFERENCES "AzubiOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AzubiApplication" ADD CONSTRAINT "AzubiApplication_assignedSupervisorId_fkey" FOREIGN KEY ("assignedSupervisorId") REFERENCES "AzubiSupervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AzubiSupervisor" ADD CONSTRAINT "AzubiSupervisor_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
