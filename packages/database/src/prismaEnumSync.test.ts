import {
  CampaignAssetType,
  CampaignRosterCategory,
  CampaignRosterSourceType,
  CampaignStatus,
  CarryMode,
  EquipmentCategory,
  ItemConditionState,
  LocationAvailabilityClass,
  MaterialType,
  QualityType,
  ReusableEntityKind,
  ScenarioCombatStatus,
  ScenarioKind,
  ScenarioParticipantJoinSource,
  ScenarioParticipantRole,
  ScenarioParticipantSourceType,
  ScenarioRelationshipType,
  ScenarioStatus,
  ScenarioVisibility,
  SpecificityType,
  StorageLocationType,
} from "@prisma/client";
import {
  campaignAssetTypeSchema,
  campaignRosterCategorySchema,
  campaignRosterSourceTypeSchema,
  campaignStatusSchema,
  reusableEntityKindSchema,
  scenarioCombatStatusSchema,
  scenarioKindSchema,
  scenarioParticipantJoinSourceSchema,
  scenarioParticipantRoleSchema,
  scenarioParticipantSourceTypeSchema,
  scenarioRelationshipTypeSchema,
  scenarioStatusSchema,
  scenarioVisibilitySchema,
} from "@glantri/domain";
import {
  CarryModeSchema,
  EquipmentCategorySchema,
  ItemConditionStateSchema,
  LocationAvailabilityClassSchema,
  MaterialTypeSchema,
  QualityTypeSchema,
  SpecificityTypeSchema,
  StorageLocationTypeSchema,
} from "@glantri/domain/equipment";

function prismaValues<T extends Record<string, string>>(e: T) {
  return Object.values(e).sort();
}

describe("Prisma enum sync — campaign/scenario", () => {
  it("CampaignStatus", () => {
    expect(prismaValues(CampaignStatus)).toEqual([...campaignStatusSchema.options].sort());
  });
  it("ScenarioKind", () => {
    expect(prismaValues(ScenarioKind)).toEqual([...scenarioKindSchema.options].sort());
  });
  it("ScenarioStatus", () => {
    expect(prismaValues(ScenarioStatus)).toEqual([...scenarioStatusSchema.options].sort());
  });
  it("ScenarioCombatStatus", () => {
    expect(prismaValues(ScenarioCombatStatus)).toEqual([...scenarioCombatStatusSchema.options].sort());
  });
  it("ScenarioParticipantSourceType", () => {
    expect(prismaValues(ScenarioParticipantSourceType)).toEqual([...scenarioParticipantSourceTypeSchema.options].sort());
  });
  it("ScenarioParticipantRole", () => {
    expect(prismaValues(ScenarioParticipantRole)).toEqual([...scenarioParticipantRoleSchema.options].sort());
  });
  it("ScenarioParticipantJoinSource", () => {
    expect(prismaValues(ScenarioParticipantJoinSource)).toEqual([...scenarioParticipantJoinSourceSchema.options].sort());
  });
  it("ScenarioRelationshipType", () => {
    expect(prismaValues(ScenarioRelationshipType)).toEqual([...scenarioRelationshipTypeSchema.options].sort());
  });
  it("ScenarioVisibility", () => {
    expect(prismaValues(ScenarioVisibility)).toEqual([...scenarioVisibilitySchema.options].sort());
  });
  it("CampaignAssetType", () => {
    expect(prismaValues(CampaignAssetType)).toEqual([...campaignAssetTypeSchema.options].sort());
  });
  it("ReusableEntityKind", () => {
    expect(prismaValues(ReusableEntityKind)).toEqual([...reusableEntityKindSchema.options].sort());
  });
  it("CampaignRosterSourceType", () => {
    expect(prismaValues(CampaignRosterSourceType)).toEqual([...campaignRosterSourceTypeSchema.options].sort());
  });
  it("CampaignRosterCategory", () => {
    expect(prismaValues(CampaignRosterCategory)).toEqual([...campaignRosterCategorySchema.options].sort());
  });
});

describe("Prisma enum sync — equipment", () => {
  it("EquipmentCategory", () => {
    expect(prismaValues(EquipmentCategory)).toEqual([...EquipmentCategorySchema.options].sort());
  });
  it("CarryMode", () => {
    expect(prismaValues(CarryMode)).toEqual([...CarryModeSchema.options].sort());
  });
  it("StorageLocationType", () => {
    expect(prismaValues(StorageLocationType)).toEqual([...StorageLocationTypeSchema.options].sort());
  });
  it("LocationAvailabilityClass", () => {
    expect(prismaValues(LocationAvailabilityClass)).toEqual([...LocationAvailabilityClassSchema.options].sort());
  });
  it("MaterialType", () => {
    expect(prismaValues(MaterialType)).toEqual([...MaterialTypeSchema.options].sort());
  });
  it("QualityType", () => {
    expect(prismaValues(QualityType)).toEqual([...QualityTypeSchema.options].sort());
  });
  it("SpecificityType", () => {
    expect(prismaValues(SpecificityType)).toEqual([...SpecificityTypeSchema.options].sort());
  });
  it("ItemConditionState", () => {
    expect(prismaValues(ItemConditionState)).toEqual([...ItemConditionStateSchema.options].sort());
  });
});
