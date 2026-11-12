-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "extras" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "ClubFee" (
    "id" TEXT NOT NULL,
    "clubId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "amountCents" INTEGER NOT NULL,
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClubFee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClubFee_clubId_idx" ON "ClubFee"("clubId");

-- AddForeignKey
ALTER TABLE "ClubFee" ADD CONSTRAINT "ClubFee_clubId_fkey" FOREIGN KEY ("clubId") REFERENCES "Club"("id") ON DELETE CASCADE ON UPDATE CASCADE;
