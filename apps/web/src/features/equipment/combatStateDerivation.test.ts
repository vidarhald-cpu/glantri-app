import { describe, expect, it } from "vitest";

import type {
  CharacterLoadout,
  EquipmentItem,
  EquipmentTemplate,
  StorageLocation,
} from "@glantri/domain";
import type { CombatAllocationState } from "../../../../../packages/rules-engine/src/combat/combatAllocationState";
import { createCombatSession } from "../../../../../packages/rules-engine/src/combat/combatSessionState";
import type { CharacterSheetSummary } from "@glantri/rules-engine";

import { equipmentTemplates } from "../../../../../packages/content/src/equipment";
import type { EquipmentFeatureState } from "./types";
import {
  buildCombatStateCharacterInputs,
  deriveCombatStateSnapshot,
  getActorCombatState,
} from "./combatStateDerivation";

const sampleCharacterId = "char-themistogenes";

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

const sampleLocations: StorageLocation[] = [
  {
    id: `${sampleCharacterId}:loc-equipped`,
    characterId: sampleCharacterId,
    name: "Equipped",
    type: "equipped_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${sampleCharacterId}:loc-person`,
    characterId: sampleCharacterId,
    name: "On Person",
    type: "person_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${sampleCharacterId}:loc-backpack`,
    characterId: sampleCharacterId,
    name: "Backpack",
    type: "backpack_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${sampleCharacterId}:loc-mount`,
    characterId: sampleCharacterId,
    name: "Mount",
    type: "mount_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null,
  },
  {
    id: `${sampleCharacterId}:loc-home`,
    characterId: sampleCharacterId,
    name: "Home",
    type: "home",
    availabilityClass: "elsewhere",
    parentLocationId: null,
    isMobile: false,
    isAccessibleInEncounter: false,
    notes: null,
  },
];

const sampleEquipmentItems: EquipmentItem[] = [
  {
    id: "weapon-item-longsword-1",
    characterId: sampleCharacterId,
    templateId: "weapon-template-longsword",
    category: "weapon",
    displayName: null,
    specificityType: "generic",
    quantity: 1,
    isStackable: false,
    material: "steel",
    quality: "standard",
    storageAssignment: {
      locationId: `${sampleCharacterId}:loc-equipped`,
      carryMode: "equipped",
    },
    conditionState: "intact",
    durabilityCurrent: 12,
    durabilityMax: 12,
    encumbranceOverride: null,
    valueOverride: null,
    specialProperties: null,
    notes: null,
    isEquipped: true,
    isFavorite: null,
    acquiredFrom: null,
    statusTags: null,
  },
  {
    id: "shield-item-round-1",
    characterId: sampleCharacterId,
    templateId: "shield-template-medium-shield",
    category: "shield",
    displayName: null,
    specificityType: "generic",
    quantity: 1,
    isStackable: false,
    material: "wood",
    quality: "standard",
    storageAssignment: {
      locationId: `${sampleCharacterId}:loc-equipped`,
      carryMode: "equipped",
    },
    conditionState: "intact",
    durabilityCurrent: null,
    durabilityMax: null,
    encumbranceOverride: null,
    valueOverride: null,
    specialProperties: null,
    notes: null,
    isEquipped: true,
    isFavorite: null,
    acquiredFrom: null,
    statusTags: null,
  },
  {
    id: "armor-item-jerkin-1",
    characterId: sampleCharacterId,
    templateId: "armor-template-leather-jerkin",
    category: "armor",
    displayName: null,
    specificityType: "generic",
    quantity: 1,
    isStackable: false,
    material: "leather",
    quality: "standard",
    storageAssignment: {
      locationId: `${sampleCharacterId}:loc-equipped`,
      carryMode: "equipped",
    },
    conditionState: "intact",
    durabilityCurrent: null,
    durabilityMax: null,
    encumbranceOverride: null,
    valueOverride: null,
    specialProperties: null,
    notes: null,
    isEquipped: true,
    isFavorite: null,
    acquiredFrom: null,
    statusTags: null,
  },
  {
    id: "gear-item-rope-1",
    characterId: sampleCharacterId,
    templateId: "gear-template-rope",
    category: "gear",
    displayName: null,
    specificityType: "generic",
    quantity: 1,
    isStackable: false,
    material: "cloth",
    quality: "standard",
    storageAssignment: {
      locationId: `${sampleCharacterId}:loc-person`,
      carryMode: "on_person",
    },
    conditionState: "intact",
    durabilityCurrent: null,
    durabilityMax: null,
    encumbranceOverride: null,
    valueOverride: null,
    specialProperties: null,
    notes: null,
    isEquipped: false,
    isFavorite: null,
    acquiredFrom: null,
    statusTags: null,
  },
];

const sampleActiveLoadout: CharacterLoadout = {
  id: `${sampleCharacterId}:loadout-active`,
  characterId: sampleCharacterId,
  name: "Current",
  isActive: true,
  wornArmorItemId: "armor-item-jerkin-1",
  readyShieldItemId: "shield-item-round-1",
  activePrimaryWeaponItemId: "weapon-item-longsword-1",
  activeSecondaryWeaponItemId: null,
  activeMissileWeaponItemId: null,
  activeAmmoItemIds: [],
  quickAccessItemIds: [],
  notes: null,
};

const sampleCharacterInputs = {
  dexterityGm: 0,
  dexterity: 11,
  parryCombatSkillXp: 13,
  brawlingCombatSkillXp: 9,
  combatSkillXpByName: {
    "1-h edged": 15,
    Brawling: 9,
    Parry: 13,
  },
  strengthGm: 3,
  strength: 17,
} as const;

function createAllocationInputs(input?: Partial<CombatAllocationState>): CombatAllocationState {
  return {
    defensePosture: "none",
    ...input,
    parry: {
      allocatedOb: null,
      source: "none",
      ...input?.parry,
    },
    situationalModifiers: {
      attack: 0,
      defense: 0,
      movement: 0,
      perception: 0,
      ...input?.situationalModifiers,
    },
  };
}

function cloneState(): EquipmentFeatureState {
  return {
    templates: {
      templatesById: indexById<EquipmentTemplate>(equipmentTemplates),
    },
    itemsById: indexById(structuredClone(sampleEquipmentItems)),
    locationsById: indexById(structuredClone(sampleLocations)),
    activeLoadoutByCharacterId: {
      [sampleCharacterId]: structuredClone(sampleActiveLoadout),
    },
  };
}

function getRowBySlotLabel(
  snapshot: ReturnType<typeof deriveCombatStateSnapshot>,
  slotLabel: string,
) {
  return snapshot.weaponRows.find((row) => row.slotLabel === slotLabel);
}

describe("combatStateDerivation", () => {
  it("derives current one-handed plus shield combat rows from the persisted loadout", () => {
    const snapshot = deriveCombatStateSnapshot(
      cloneState(),
      "char-themistogenes",
      sampleCharacterInputs,
    );
    const primaryRow = getRowBySlotLabel(snapshot, "Primary weapon");
    const shieldRow = getRowBySlotLabel(snapshot, "Shield");
    const punchRow = getRowBySlotLabel(snapshot, "Punch");
    const kickRow = getRowBySlotLabel(snapshot, "Kick");

    expect(snapshot.gripSummary).toBe("One-handed + shield");
    expect(snapshot.wornArmorLabel).toBe("Leather Jerkin");
    expect(snapshot.readyShieldLabel).toBe("Medium shield");
    expect(primaryRow).toMatchObject({
      slotLabel: "Primary weapon",
      currentItemLabel: "Long sword",
      initiative: 1,
      ob1: 14,
      dmb1: 9,
      attack1: "Slash (Edged)",
      crit1: "FS",
      armorMod1: "C",
      ob2: 13,
      dmb2: 7,
      attack2: "Thrust (Pointed)",
      crit2: "EP",
      armorMod2: "C",
      db: 16,
      dm: 6,
      parry: "14 (allocation pending)",
    });
    expect(primaryRow?.notes).toContain("Thrust Pointed | AM C");
    expect(shieldRow).toMatchObject({
      slotLabel: "Shield",
      currentItemLabel: "Medium shield",
      attack1: "Strike (Blunt)",
      ob1: 0,
      dmb1: 0,
      crit1: "AC",
      attack2: "—",
      db: 16,
      dm: 5,
      parry: 5,
    });
    expect(getRowBySlotLabel(snapshot, "Unarmed / brawling")).toBeUndefined();
    expect(punchRow).toMatchObject({
      slotLabel: "Punch",
      currentItemLabel: "Punch",
      initiative: 0,
      attack1: "Strike (Blunt)",
      crit1: "AC",
      armorMod1: "A",
    });
    expect(kickRow).toMatchObject({
      slotLabel: "Kick",
      currentItemLabel: "Kick",
      initiative: 0,
      attack1: "Strike (Blunt)",
      crit1: "AC",
      armorMod1: "A",
    });
    expect(getRowBySlotLabel(snapshot, "Secondary weapon")).toBeUndefined();
    expect(snapshot.defenseSummary).toContain("DB 16");
    expect(snapshot.defenseSummary).toContain("DM 6");
    expect(snapshot.defenseSummary).toContain("Parry 14 (allocation pending)");
    expect(snapshot.unarmedSummary).toContain("Punch and Kick");
  });

  it("derives the displayed secondary melee DMB from the secondary mode values", () => {
    const snapshot = deriveCombatStateSnapshot(
      cloneState(),
      "char-themistogenes",
      sampleCharacterInputs,
    );
    const primaryRow = getRowBySlotLabel(snapshot, "Primary weapon");

    expect(primaryRow?.ob1).toBe(14);
    expect(primaryRow?.dmb1).toBe(9);
    expect(primaryRow?.ob2).toBe(13);
    expect(primaryRow?.dmb2).toBe(7);
  });

  it("surfaces formula-based missile DMB and special encumbrance notes without faking precision", () => {
    const state = cloneState();

    state.itemsById["weapon-item-longsword-1"].storageAssignment = {
      carryMode: "on_person",
      locationId: "char-themistogenes:loc-person",
    };
    state.itemsById["weapon-item-longsword-1"].isEquipped = false;
    state.activeLoadoutByCharacterId["char-themistogenes"] = {
      ...state.activeLoadoutByCharacterId["char-themistogenes"],
      readyShieldItemId: null,
      activePrimaryWeaponItemId: null,
      activeMissileWeaponItemId: "weapon-item-longsword-1",
    };
    state.itemsById["weapon-item-longsword-1"].templateId = "weapon-template-ballista";

    const snapshot = deriveCombatStateSnapshot(state, "char-themistogenes");
    const missileRow = getRowBySlotLabel(snapshot, "Missile weapon");

    expect(snapshot.gripSummary).toBe("Missile ready");
    expect(missileRow?.currentItemLabel).toBe("Ballista");
    expect(missileRow?.dmb1).toBe("4d8+1 (formula)");
    expect(missileRow?.attack1).toBe("Shot (Pointed)");
    expect(missileRow?.db).toBe("—");
    expect(missileRow?.notes).toContain("Source encumbrance 20+20 is ammo-linked");
    expect(snapshot.loadNotes).toContain("Source encumbrance 20+20 is ammo-linked");
  });

  it("uses explicit combat allocation inputs for parry posture and situation modifiers", () => {
    const snapshot = deriveCombatStateSnapshot(
      cloneState(),
      sampleCharacterId,
      sampleCharacterInputs,
      createAllocationInputs({
        defensePosture: "parry",
        parry: {
          allocatedOb: 15,
          source: "primary",
        },
        situationalModifiers: {
          attack: 2,
          defense: 1,
          movement: -1,
          perception: -2,
        },
      }),
    );

    const primaryRow = getRowBySlotLabel(snapshot, "Primary weapon");

    expect(primaryRow?.ob1).toBe(16);
    expect(primaryRow?.db).toBe(17);
    expect(primaryRow?.parry).toBe(16);
    expect(snapshot.readinessSummary).toContain("Posture Parry");
    expect(snapshot.defenseSummary).toContain("Posture Parry");
    expect(snapshot.defenseSummary).toContain("DB 17");
    expect(snapshot.defenseSummary).toContain("Parry 16");
    expect(snapshot.movementModifierSummary).toContain("situational");
    expect(snapshot.perceptionSummary).toContain("Current perception modifier -2");
  });

  it("reuses session actor allocation to derive actor combat state without duplicating logic", () => {
    const session = createCombatSession([
      {
        actorId: "actor-longsword",
        characterId: sampleCharacterId,
        allocation: createAllocationInputs({
          defensePosture: "parry",
          parry: {
            allocatedOb: 15,
            source: "primary",
          },
          situationalModifiers: {
            attack: 2,
            defense: 1,
            movement: -1,
            perception: -2,
          },
        }),
      },
    ]);

    const snapshot = getActorCombatState(session, "actor-longsword", {
      equipmentState: cloneState(),
      characterStats: sampleCharacterInputs,
    });

    expect(snapshot).not.toBeNull();
    expect(getRowBySlotLabel(snapshot!, "Primary weapon")?.ob1).toBe(16);
    expect(getRowBySlotLabel(snapshot!, "Primary weapon")?.db).toBe(17);
    expect(getRowBySlotLabel(snapshot!, "Primary weapon")?.parry).toBe(16);
    expect(snapshot?.readinessSummary).toContain("Posture Parry");
  });

  it("shows a fully derived secondary weapon row only when a secondary weapon is equipped", () => {
    const state = cloneState();
    state.itemsById["weapon-item-dagger-1"] = {
      id: "weapon-item-dagger-1",
      characterId: sampleCharacterId,
      templateId: "weapon-template-dagger",
      category: "weapon",
      displayName: null,
      specificityType: "generic",
      quantity: 1,
      isStackable: false,
      material: "steel",
      quality: "standard",
      storageAssignment: {
        locationId: `${sampleCharacterId}:loc-equipped`,
        carryMode: "equipped",
      },
      conditionState: "intact",
      durabilityCurrent: 12,
      durabilityMax: 12,
      encumbranceOverride: null,
      valueOverride: null,
      specialProperties: null,
      notes: null,
      isEquipped: true,
      isFavorite: null,
      acquiredFrom: null,
      statusTags: null,
    };
    state.activeLoadoutByCharacterId[sampleCharacterId] = {
      ...state.activeLoadoutByCharacterId[sampleCharacterId],
      readyShieldItemId: null,
      activeSecondaryWeaponItemId: "weapon-item-dagger-1",
    };

    const snapshot = deriveCombatStateSnapshot(state, sampleCharacterId, sampleCharacterInputs);
    const secondaryRow = getRowBySlotLabel(snapshot, "Secondary weapon");

    expect(getRowBySlotLabel(snapshot, "Shield")).toBeUndefined();
    expect(secondaryRow).toMatchObject({
      slotLabel: "Secondary weapon",
      currentItemLabel: "Dagger",
      attack1: "Thrust (Pointed)",
      ob1: 14,
      dmb1: 4,
    });
  });

  it("uses workbook-faithful melee initiative for equipped weapons and brawling rows", () => {
    const snapshot = deriveCombatStateSnapshot(
      cloneState(),
      sampleCharacterId,
      sampleCharacterInputs,
    );

    expect(getRowBySlotLabel(snapshot, "Primary weapon")?.initiative).toBe(1);
    expect(getRowBySlotLabel(snapshot, "Punch")?.initiative).toBe(0);
    expect(getRowBySlotLabel(snapshot, "Kick")?.initiative).toBe(0);
  });

  it("uses workbook-equivalent total skill XP rather than direct specific ranks for initiative lookup", () => {
    const sheetSummary = {
      adjustedStats: {
        dex: 13,
        str: 11,
      },
      combat: {
        combatGroups: [],
        dodge: 0,
        hasShield: false,
        parry: 0,
        weaponSkills: [],
      },
      distractionLevel: 0,
      draftView: {
        education: {
          baseEducation: 0,
          gmInt: 0,
          socialClassEducationValue: 0,
          theoreticalSkillCount: 0,
        },
        groups: [],
        primaryPoolAvailable: 0,
        secondaryPoolAvailable: 0,
        skills: [
          {
            category: "ordinary",
            effectiveSkillNumber: 6,
            groupId: "martial",
            groupIds: ["martial"],
            groupLevel: 4,
            linkedStatAverage: 0,
            name: "1-h edged",
            primaryRanks: 2,
            requiresLiteracy: "no",
            secondaryRanks: 0,
            skillId: "skill-1h-edged",
            specificSkillLevel: 2,
            totalSkill: 6,
          },
        ],
        specializations: [],
        totalSkillPointsInvested: 6,
      },
      equipment: {
        armorSummary: "None",
        carriedItems: [],
        equippedWeapons: [],
        equippedArmor: [],
        equippedShields: [],
        hasEquippedShield: false,
        readinessLabel: "Unarmed",
        shieldBonus: 0,
      },
      gms: {
        byGroup: [],
        total: 0,
      },
      seniority: 6,
      totalSkillPointsInvested: 6,
    } satisfies CharacterSheetSummary;

    const inputs = buildCombatStateCharacterInputs(sheetSummary);
    const snapshot = deriveCombatStateSnapshot(
      cloneState(),
      sampleCharacterId,
      {
        ...sampleCharacterInputs,
        dexterity: 13,
        dexterityGm: 1,
        combatSkillXpByName: {
          ...sampleCharacterInputs.combatSkillXpByName,
          "1-h edged": inputs.combatSkillXpByName["1-h edged"],
        },
      },
    );

    expect(inputs.combatSkillXpByName["1-h edged"]).toBe(6);
    expect(getRowBySlotLabel(snapshot, "Primary weapon")?.initiative).toBe(1);
  });

  it("gives longsword, punch, and kick initiative 1 for dex gm 1 and combat skill xp 6", () => {
    const snapshot = deriveCombatStateSnapshot(cloneState(), sampleCharacterId, {
      ...sampleCharacterInputs,
      dexterity: 13,
      dexterityGm: 1,
      combatSkillXpByName: {
        ...sampleCharacterInputs.combatSkillXpByName,
        "1-h edged": 6,
        Brawling: 6,
      },
    });

    expect(getRowBySlotLabel(snapshot, "Primary weapon")?.initiative).toBe(1);
    expect(getRowBySlotLabel(snapshot, "Punch")?.initiative).toBe(1);
    expect(getRowBySlotLabel(snapshot, "Kick")?.initiative).toBe(1);
  });

  it("uses workbook-equivalent total skill XP for non-workbook OB fallback paths", () => {
    const state = cloneState();

    state.itemsById["weapon-item-longsword-1"].storageAssignment = {
      carryMode: "on_person",
      locationId: "char-themistogenes:loc-person",
    };
    state.itemsById["weapon-item-longsword-1"].isEquipped = false;
    state.activeLoadoutByCharacterId["char-themistogenes"] = {
      ...state.activeLoadoutByCharacterId["char-themistogenes"],
      readyShieldItemId: null,
      activePrimaryWeaponItemId: null,
      activeMissileWeaponItemId: "weapon-item-longsword-1",
    };
    state.itemsById["weapon-item-longsword-1"].templateId = "weapon-template-bow";

    const snapshot = deriveCombatStateSnapshot(state, sampleCharacterId, {
      ...sampleCharacterInputs,
      combatSkillXpByName: {
        ...sampleCharacterInputs.combatSkillXpByName,
        Bow: 6,
      },
    });

    expect(getRowBySlotLabel(snapshot, "Missile weapon")?.ob1).toBe(9);
  });
});
