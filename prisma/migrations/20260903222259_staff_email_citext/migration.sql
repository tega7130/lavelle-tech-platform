-- DropForeignKey
ALTER TABLE "Enrolment" DROP CONSTRAINT "Enrolment_intakeId_fkey";

-- DropForeignKey
ALTER TABLE "GuestCheckout" DROP CONSTRAINT "GuestCheckout_intakeId_fkey";

-- AlterTable
ALTER TABLE "Staff" ALTER COLUMN "email" SET DATA TYPE CITEXT;

-- AddForeignKey
ALTER TABLE "Enrolment" ADD CONSTRAINT "Enrolment_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestCheckout" ADD CONSTRAINT "GuestCheckout_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE SET NULL ON UPDATE CASCADE;
