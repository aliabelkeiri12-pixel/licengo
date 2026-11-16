-- Proof documents uploaded by families to claim a reduction (checked by the club)
ALTER TYPE "DocumentType" ADD VALUE 'ARS_CERTIFICATE';
ALTER TYPE "DocumentType" ADD VALUE 'PASS_SPORT';
ALTER TABLE "ClubFee" ADD COLUMN "proofDocType" TEXT;
