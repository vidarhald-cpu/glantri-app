-- CreateEnum
CREATE TYPE "EquipmentCategory" AS ENUM ('weapon', 'shield', 'armor', 'gear', 'valuables');

-- CreateEnum
CREATE TYPE "CarryMode" AS ENUM ('equipped', 'on_person', 'backpack', 'mount', 'stored');

-- CreateEnum
CREATE TYPE "StorageLocationType" AS ENUM ('equipped_system', 'person_system', 'backpack_system', 'mount_system', 'home', 'camp', 'boat', 'wagon', 'cache', 'building', 'other');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('steel', 'bronze', 'wood', 'leather', 'cloth', 'bone', 'stone', 'silver', 'gold', 'other');

-- CreateEnum
CREATE TYPE "QualityType" AS ENUM ('standard', 'extraordinary');

-- CreateEnum
CREATE TYPE "SpecificityType" AS ENUM ('generic', 'specific');

-- CreateEnum
CREATE TYPE "ItemConditionState" AS ENUM ('intact', 'worn', 'damaged', 'broken', 'lost');

-- CreateTable
CREATE TABLE "CharacterEquipmentItem" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "category" "EquipmentCategory" NOT NULL,
    "displayName" TEXT,
    "specificityType" "SpecificityType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "isStackable" BOOLEAN NOT NULL,
    "material" "MaterialType" NOT NULL,
    "quality" "QualityType" NOT NULL,
    "locationId" TEXT NOT NULL,
    "carryMode" "CarryMode" NOT NULL,
    "conditionState" "ItemConditionState" NOT NULL,
    "durabilityCurrent" INTEGER,
    "durabilityMax" INTEGER,
    "encumbranceOverride" DOUBLE PRECISION,
    "valueOverride" DOUBLE PRECISION,
    "specialPropertiesJson" JSONB,
    "notes" TEXT,
    "isEquipped" BOOLEAN,
    "isFavorite" BOOLEAN,
    "acquiredFrom" TEXT,
    "statusTagsJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterEquipmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterStorageLocation" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StorageLocationType" NOT NULL,
    "parentLocationId" TEXT,
    "isMobile" BOOLEAN NOT NULL,
    "isAccessibleInEncounter" BOOLEAN NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterStorageLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterLoadout" (
    "id" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "wornArmorItemId" TEXT,
    "readyShieldItemId" TEXT,
    "activePrimaryWeaponItemId" TEXT,
    "activeSecondaryWeaponItemId" TEXT,
    "activeMissileWeaponItemId" TEXT,
    "activeAmmoItemIds" TEXT[],
    "quickAccessItemIdsJson" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterLoadout_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharacterEquipmentItem_characterId_idx" ON "CharacterEquipmentItem"("characterId");

-- CreateIndex
CREATE INDEX "CharacterEquipmentItem_characterId_locationId_idx" ON "CharacterEquipmentItem"("characterId", "locationId");

-- CreateIndex
CREATE INDEX "CharacterStorageLocation_characterId_idx" ON "CharacterStorageLocation"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterStorageLocation_characterId_name_key" ON "CharacterStorageLocation"("characterId", "name");

-- CreateIndex
CREATE INDEX "CharacterLoadout_characterId_idx" ON "CharacterLoadout"("characterId");

-- CreateIndex
CREATE INDEX "CharacterLoadout_characterId_isActive_idx" ON "CharacterLoadout"("characterId", "isActive");

-- AddForeignKey
ALTER TABLE "CharacterEquipmentItem" ADD CONSTRAINT "CharacterEquipmentItem_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterStorageLocation" ADD CONSTRAINT "CharacterStorageLocation_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterLoadout" ADD CONSTRAINT "CharacterLoadout_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

