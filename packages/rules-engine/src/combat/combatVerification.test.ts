import { describe, expect, it } from "vitest";

import type {
  CharacterLoadout,
  EquipmentItem,
  EquipmentTemplate,
  StorageLocation
} from "@glantri/domain";
import { defaultCombatAllocationState } from "./combatAllocationState";
import { equipmentTemplates } from "../../../../packages/content/src/equipment";
import { deriveCombatStateSnapshot } from "../../../../apps/web/src/features/equipment/combatStateDerivation.ts";

type EquipmentState = Parameters<typeof deriveCombatStateSnapshot>[0];
type CharacterInputs = NonNullable<Parameters<typeof deriveCombatStateSnapshot>[2]>;
type AllocationInputs = NonNullable<Parameters<typeof deriveCombatStateSnapshot>[3]>;

type DerivedComparableValue = number | string;

interface VerificationExpected {
  db: DerivedComparableValue;
  dmb: DerivedComparableValue;
  dm: DerivedComparableValue;
  encumbrance: number;
  ob: DerivedComparableValue;
  parry: DerivedComparableValue;
}

interface VerificationActual extends VerificationExpected {
  loadNotes: string;
}

interface CombatVerificationCase {
  actorSlot: "missile" | "primary" | "unarmed";
  allocation?: AllocationInputs;
  armorTemplateId?: string;
  expected: VerificationExpected;
  isExpectedMismatch?: boolean;
  loadout: {
    missileWeaponTemplateId?: string;
    primaryWeaponTemplateId?: string;
    shieldTemplateId?: string;
  };
  name: string;
  notes: string;
  skillXp?: Record<string, number>;
  skills: Record<string, number>;
  strength?: number;
}

const verificationCharacterId = "char-combat-verification";

const baseLocations: StorageLocation[] = [
  {
    id: `${verificationCharacterId}:loc-equipped`,
    characterId: verificationCharacterId,
    name: "Equipped",
    type: "equipped_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null
  },
  {
    id: `${verificationCharacterId}:loc-person`,
    characterId: verificationCharacterId,
    name: "On Person",
    type: "person_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null
  },
  {
    id: `${verificationCharacterId}:loc-backpack`,
    characterId: verificationCharacterId,
    name: "Backpack",
    type: "backpack_system",
    availabilityClass: "with_you",
    parentLocationId: null,
    isMobile: true,
    isAccessibleInEncounter: true,
    notes: null
  },
  {
    id: `${verificationCharacterId}:loc-home`,
    characterId: verificationCharacterId,
    name: "Home",
    type: "home",
    availabilityClass: "elsewhere",
    parentLocationId: null,
    isMobile: false,
    isAccessibleInEncounter: false,
    notes: null
  }
];

const combatVerificationCases: CombatVerificationCase[] = [
  {
    name: "Long sword + round shield",
    actorSlot: "primary",
    loadout: {
      primaryWeaponTemplateId: "weapon-template-longsword",
      shieldTemplateId: "shield-template-round-shield"
    },
    skills: {
      "1-h edged": 37,
      Brawling: 18,
      Parry: 12
    },
    expected: {
      ob: 14,
      db: 13,
      dm: 3,
      dmb: 9,
      parry: "14 (allocation pending)",
      encumbrance: 15
    },
    notes:
      "Workbook-faithful melee OB/DMB with Long sword mode-1, using skill XP 15 and Str GM 3 while keeping current shield DB/DM behavior.",
    skillXp: {
      "1-h edged": 15,
      Brawling: 9,
      Parry: 13
    },
    strength: 17
  },
  {
    name: "Hand axe strike",
    actorSlot: "primary",
    loadout: {
      primaryWeaponTemplateId: "weapon-template-hand-axe"
    },
    skills: {
      "1-h conc./axe": 28,
      Brawling: 18,
      Parry: 12
    },
    expected: {
      ob: 13,
      db: 11,
      dm: 1,
      dmb: 10,
      parry: "10 (allocation pending)",
      encumbrance: 7
    },
    notes: "Workbook-faithful strike-main conc./axe case using Hand axe mode-1 with skill XP 15 and Str GM 3.",
    skillXp: {
      "1-h conc./axe": 15,
      Brawling: 9,
      Parry: 13
    },
    strength: 17
  },
  {
    name: "2-h Spear thrust",
    actorSlot: "primary",
    loadout: {
      primaryWeaponTemplateId: "weapon-template-spear"
    },
    skills: {
      Polearms: 28,
      Brawling: 18,
      Parry: 12
    },
    expected: {
      ob: 16,
      db: 11,
      dm: 1,
      dmb: 9,
      parry: "17 (allocation pending)",
      encumbrance: 8
    },
    notes: "Workbook-faithful thrust-main polearm case using 2-h Spear mode-1 with skill XP 15 and Str GM 3.",
    skillXp: {
      Polearms: 15,
      Brawling: 9,
      Parry: 13
    },
    strength: 17
  },
  {
    name: "Short bow missile",
    actorSlot: "missile",
    loadout: {
      missileWeaponTemplateId: "weapon-template-bow"
    },
    skills: {
      Bow: 28,
      Brawling: 18,
      Parry: 12
    },
    expected: {
      ob: 31,
      db: 11,
      dm: "—",
      dmb: "2d6 (formula)",
      parry: "—",
      encumbrance: 5
    },
    notes: "Workbook Weapon2 row 14 short bow preserves dice DMB instead of collapsing it to a number."
  },
  {
    name: "Composite bow formula DMB",
    actorSlot: "missile",
    loadout: {
      missileWeaponTemplateId: "weapon-template-composite-bow"
    },
    skills: {
      Bow: 30,
      Brawling: 18,
      Parry: 12
    },
    expected: {
      ob: 32,
      db: 11,
      dm: "—",
      dmb: "2d6 + GMstr (formula)",
      parry: "—",
      encumbrance: 8
    },
    notes: "Workbook Weapon2 row 15 keeps the GMstr-based DMB expression explicit."
  },
  {
    name: "Unarmed / brawling baseline",
    actorSlot: "unarmed",
    loadout: {},
    skills: {
      Brawling: 18,
      Parry: 12
    },
    expected: {
      ob: 19,
      db: 11,
      dm: "—",
      dmb: 0,
      parry: "19 (allocation pending)",
      encumbrance: 0
    },
    notes:
      "Workbook Weapon1 row 40 Punch is now surfaced as a workbook-backed virtual brawling row through the standard weapon derivation path."
  },
  {
    name: "Ballista ammo-linked encumbrance",
    actorSlot: "missile",
    loadout: {
      missileWeaponTemplateId: "weapon-template-ballista"
    },
    skills: {
      Crossbow: 25,
      Brawling: 18,
      Parry: 12
    },
    expected: {
      ob: 28,
      db: 11,
      dm: "—",
      dmb: "4d8+1 (formula)",
      parry: "—",
      encumbrance: 40
    },
    isExpectedMismatch: true,
    notes:
      "Workbook Weapon2 row 30 encumbrance is source text 20+20, while current personal encumbrance totals still use compatibility base 20 and preserve the ammo-linked note separately."
  }
];

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function createItem(input: {
  category: EquipmentItem["category"];
  id: string;
  templateId: string;
}): EquipmentItem {
  return {
    id: input.id,
    characterId: verificationCharacterId,
    templateId: input.templateId,
    category: input.category,
    displayName: null,
    specificityType: "generic",
    quantity: 1,
    isStackable: false,
    material: "steel",
    quality: "standard",
    storageAssignment: {
      locationId: `${verificationCharacterId}:loc-equipped`,
      carryMode: "equipped"
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
    statusTags: null
  };
}

function buildCharacterInputs(
  skills: Record<string, number>,
  skillXp?: Record<string, number>,
  strength = 11,
): CharacterInputs {
  return {
    dexterityGm: 0,
    dexterity: 11,
    parrySkill: skills.Parry ?? null,
    brawlingSkill: skills.Brawling ?? null,
    skillXpByName: skillXp ?? {},
    skillTotalsByName: skills,
    strengthGm: Math.trunc((strength - 11) / 2),
    strength
  };
}

function buildEquipmentState(testCase: CombatVerificationCase): EquipmentState {
  const items: EquipmentItem[] = [];
  const activeLoadout: CharacterLoadout = {
    id: `${verificationCharacterId}:loadout-active`,
    characterId: verificationCharacterId,
    name: "Verification",
    isActive: true,
    wornArmorItemId: null,
    readyShieldItemId: null,
    activePrimaryWeaponItemId: null,
    activeSecondaryWeaponItemId: null,
    activeMissileWeaponItemId: null,
    activeAmmoItemIds: [],
    quickAccessItemIds: [],
    notes: null
  };

  if (testCase.armorTemplateId) {
    const armor = createItem({
      category: "armor",
      id: "armor-item-verification",
      templateId: testCase.armorTemplateId
    });
    armor.material = "leather";
    items.push(armor);
    activeLoadout.wornArmorItemId = armor.id;
  }

  if (testCase.loadout.primaryWeaponTemplateId) {
    const primary = createItem({
      category: "weapon",
      id: "weapon-item-primary",
      templateId: testCase.loadout.primaryWeaponTemplateId
    });
    items.push(primary);
    activeLoadout.activePrimaryWeaponItemId = primary.id;
  }

  if (testCase.loadout.missileWeaponTemplateId) {
    const missile = createItem({
      category: "weapon",
      id: "weapon-item-missile",
      templateId: testCase.loadout.missileWeaponTemplateId
    });
    items.push(missile);
    activeLoadout.activeMissileWeaponItemId = missile.id;
  }

  if (testCase.loadout.shieldTemplateId) {
    const shield = createItem({
      category: "shield",
      id: "shield-item-ready",
      templateId: testCase.loadout.shieldTemplateId
    });
    shield.material = "wood";
    items.push(shield);
    activeLoadout.readyShieldItemId = shield.id;
  }

  return {
    templates: {
      templatesById: indexById<EquipmentTemplate>(equipmentTemplates)
    },
    itemsById: indexById(items),
    locationsById: indexById(structuredClone(baseLocations)),
    activeLoadoutByCharacterId: {
      [verificationCharacterId]: activeLoadout
    }
  };
}

function extractActualValues(
  testCase: CombatVerificationCase,
  snapshot: ReturnType<typeof deriveCombatStateSnapshot>
): VerificationActual {
  const row = snapshot.weaponRows.find((candidate) =>
    testCase.actorSlot === "primary"
      ? candidate.slotLabel === "Primary weapon"
      : testCase.actorSlot === "missile"
        ? candidate.slotLabel === "Missile weapon"
        : candidate.slotLabel === "Punch"
  );

  return {
    ob: row?.ob1 ?? "—",
    db: row?.db ?? "—",
    dm: row?.dm ?? "—",
    dmb: row?.dmb1 ?? "—",
    parry: row?.parry ?? "—",
    encumbrance: snapshot.personalEncumbrance,
    loadNotes: snapshot.loadNotes
  };
}

function buildMismatchMessage(
  testCase: CombatVerificationCase,
  expected: VerificationExpected,
  actual: VerificationActual
): string {
  const mismatches = Object.entries(expected)
    .filter(([key, value]) => actual[key as keyof VerificationExpected] !== value)
    .map(
      ([key, value]) =>
        `${key}: expected ${JSON.stringify(value)}, actual ${JSON.stringify(actual[key as keyof VerificationActual])}`
    );

  return [
    `Spreadsheet verification failed for ${testCase.name}.`,
    `Notes: ${testCase.notes}`,
    ...mismatches,
    `Load notes: ${actual.loadNotes}`
  ].join("\n");
}

describe("combat verification against Themistogenes spreadsheet", () => {
  for (const testCase of combatVerificationCases.filter((entry) => !entry.isExpectedMismatch)) {
    it(`matches ${testCase.name}`, () => {
      const snapshot = deriveCombatStateSnapshot(
        buildEquipmentState(testCase),
        verificationCharacterId,
        buildCharacterInputs(testCase.skills, testCase.skillXp, testCase.strength),
        testCase.allocation ?? defaultCombatAllocationState
      );
      const actual = extractActualValues(testCase, snapshot);

      expect(actual, buildMismatchMessage(testCase, testCase.expected, actual)).toEqual({
        ...testCase.expected,
        loadNotes: actual.loadNotes
      });
    });
  }

  it.fails("documents the current ballista ammo-linked encumbrance mismatch explicitly", () => {
    const testCase = combatVerificationCases.find(
      (entry) => entry.name === "Ballista ammo-linked encumbrance"
    );

    if (!testCase) {
      throw new Error("Ballista verification case is missing.");
    }

    const snapshot = deriveCombatStateSnapshot(
      buildEquipmentState(testCase),
      verificationCharacterId,
      buildCharacterInputs(testCase.skills, testCase.skillXp, testCase.strength),
      testCase.allocation ?? defaultCombatAllocationState
    );
    const actual = extractActualValues(testCase, snapshot);

    expect(actual, buildMismatchMessage(testCase, testCase.expected, actual)).toEqual({
      ...testCase.expected,
      loadNotes: actual.loadNotes
    });
  });
});
