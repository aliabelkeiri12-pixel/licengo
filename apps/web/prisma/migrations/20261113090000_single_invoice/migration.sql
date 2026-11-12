-- One invoice per payment (demo data only existed with the previous per-issuer model)
DELETE FROM "Invoice";
DELETE FROM "InvoiceCounter";
DROP INDEX IF EXISTS "Invoice_installmentId_issuer_key";
ALTER TABLE "Invoice" DROP COLUMN "issuer", DROP COLUMN "installmentId";
DROP TYPE "InvoiceIssuer";
CREATE UNIQUE INDEX "Invoice_paymentId_key" ON "Invoice"("paymentId");
