-- Simple flow by default: photo + medical certificate + club charter (and image rights),
-- the club checks the file and sends the payment request.
ALTER TABLE "Club" ALTER COLUMN "payAfterCheck" SET DEFAULT true;
ALTER TABLE "Club" ALTER COLUMN "requiredUploads" SET DEFAULT ARRAY['PHOTO', 'MEDICAL_CERTIFICATE']::TEXT[];
ALTER TABLE "Club" ALTER COLUMN "requiredSignatures" SET DEFAULT ARRAY['CLUB_RULES']::TEXT[];
