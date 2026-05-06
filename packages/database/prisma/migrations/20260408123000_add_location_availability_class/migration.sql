-- CreateEnum
CREATE TYPE "LocationAvailabilityClass" AS ENUM ('with_you', 'elsewhere');

-- AlterTable
ALTER TABLE "CharacterStorageLocation"
ADD COLUMN "availabilityClass" "LocationAvailabilityClass";

-- Backfill existing locations
UPDATE "CharacterStorageLocation"
SET "availabilityClass" = CASE
  WHEN "type" IN ('equipped_system', 'person_system', 'backpack_system', 'mount_system')
    THEN 'with_you'::"LocationAvailabilityClass"
  ELSE 'elsewhere'::"LocationAvailabilityClass"
END;

-- Make column required
ALTER TABLE "CharacterStorageLocation"
ALTER COLUMN "availabilityClass" SET NOT NULL;
