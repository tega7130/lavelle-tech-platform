-- CreateEnum
CREATE TYPE "GuestCheckoutStatus" AS ENUM ('PENDING', 'CONSUMED');

-- AlterTable
ALTER TABLE "Payment" ALTER COLUMN "candidateId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "GuestCheckout" (
    "id" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "intakeId" TEXT NOT NULL,
    "firstName" VARCHAR(80) NOT NULL,
    "lastName" VARCHAR(80) NOT NULL,
    "email" CITEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3) NOT NULL,
    "acceptedTermsAt" TIMESTAMP(3) NOT NULL,
    "marketingOptIn" BOOLEAN NOT NULL DEFAULT false,
    "checkoutToken" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" "GuestCheckoutStatus" NOT NULL DEFAULT 'PENDING',
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestCheckout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GuestCheckout_checkoutToken_key" ON "GuestCheckout"("checkoutToken");

-- CreateIndex
CREATE UNIQUE INDEX "GuestCheckout_paymentId_key" ON "GuestCheckout"("paymentId");

-- CreateIndex
CREATE INDEX "GuestCheckout_email_idx" ON "GuestCheckout"("email");

-- AddForeignKey
ALTER TABLE "GuestCheckout" ADD CONSTRAINT "GuestCheckout_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestCheckout" ADD CONSTRAINT "GuestCheckout_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "Intake"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuestCheckout" ADD CONSTRAINT "GuestCheckout_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
