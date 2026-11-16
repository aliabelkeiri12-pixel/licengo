-- AlterTable
ALTER TABLE "Club" ADD COLUMN     "dailyDigest" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "footclubsMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payAfterCheck" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Registration" ADD COLUMN     "fffCheckedAt" TIMESTAMP(3),
ADD COLUMN     "fffDeclaredAt" TIMESTAMP(3),
ADD COLUMN     "fffMissing" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "fffStatus" TEXT,
ADD COLUMN     "footclubsDoneAt" TIMESTAMP(3);
