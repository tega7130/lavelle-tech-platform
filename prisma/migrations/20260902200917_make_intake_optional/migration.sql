-- Programmes are independently enrollable; intake assignment is optional
-- AlterTable
ALTER TABLE "Enrolment" ALTER COLUMN "intakeId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "GuestCheckout" ALTER COLUMN "intakeId" DROP NOT NULL;
