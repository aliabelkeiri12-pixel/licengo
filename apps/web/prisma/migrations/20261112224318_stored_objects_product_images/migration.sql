-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "imageData" BYTEA,
ADD COLUMN     "imageMime" TEXT;

-- CreateTable
CREATE TABLE "StoredObject" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoredObject_pkey" PRIMARY KEY ("key")
);
