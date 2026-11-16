-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "requiredSignatures" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "requiredUploads" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "ClubFee" ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'SUPPLEMENT',
ADD COLUMN     "proofLabel" TEXT;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "paymentRequestedAt" TIMESTAMP(3);
