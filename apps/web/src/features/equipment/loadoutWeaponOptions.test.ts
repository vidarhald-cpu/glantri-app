import { describe, expect, it } from "vitest";
import type { EquipmentItem, EquipmentTemplate, StorageLocation } from "@glantri/domain";

import type { EquipmentFeatureState } from "./types";
import {
  buildLoadoutMeleeWeaponOptions,
  buildLoadoutMissileWeaponOptions,
  buildLoadoutThrowingWeaponOptions,
} from "./loadoutWeaponOptions";

const characterId = "character-1";

function createWeaponItem(
  overrides: Partial<EquipmentItem> & Pick<EquipmentItem, "id" | "templateId">,
): EquipmentItem {
  return {
    acquiredFrom: null,
    category: "weapon",
    characterId,
    conditionState: "intact",
    displayName: null,
    isFavorite: false,
    isStackable: false,
    material: "steel",
    quality: "standard",
    quantity: 1,
    specificityType: "generic",
    storageAssignment: {
      carryMode: "equipped",
      locationId: "loc-with-you",
    },
    ...overrides,
  };
}

function createStorageLocation(
  overrides: Partial<StorageLocation> & Pick<StorageLocation, "id" | "name">,
): StorageLocation {
  return {
    availabilityClass: "with_you",
    characterId,
    isAccessibleInEncounter: true,
    isMobile: true,
    type: "equipped_system",
    ...overrides,
  };
}

function createWeaponTemplate(
  overrides: Partial<EquipmentTemplate> &
    Pick<Extract<EquipmentTemplate, { category: "weapon" }>, "id" | "name">,
): Extract<EquipmentTemplate, { category: "weapon" }> {
  return {
    attackModes: [{ id: "mode-1", provenance: "imported" }],
    baseEncumbrance: 1,
    category: "weapon",
    defaultMaterial: "steel",
    handlingClass: "one_handed",
    specificityTypeDefault: "generic",
    tags: [],
    weaponClass: "sword",
    weaponSkill: "Swords",
    ...overrides,
  } as Extract<EquipmentTemplate, { category: "weapon" }>;
}

function createState(): EquipmentFeatureState {
  return {
    activeLoadoutByCharacterId: {},
    itemsById: {
      "item-hand-axe": createWeaponItem({
        id: "item-hand-axe",
        templateId: "weapon-template-hand-axe",
      }),
      "item-longsword": createWeaponItem({
        id: "item-longsword",
        templateId: "weapon-template-long-sword",
      }),
      "item-pistol": createWeaponItem({
        id: "item-pistol",
        templateId: "weapon-template-pistol",
      }),
      "item-short-bow": createWeaponItem({
        id: "item-short-bow",
        material: "wood",
        templateId: "weapon-template-short-bow",
      }),
      "item-t-javelin": createWeaponItem({
        id: "item-t-javelin",
        material: "wood",
        templateId: "weapon-template-t-javelin",
      }),
    },
    locationsById: {
      "loc-with-you": createStorageLocation({
        id: "loc-with-you",
        name: "With you",
      }),
    },
    templates: {
      templatesById: {
        "weapon-template-hand-axe": createWeaponTemplate({
          attackModes: [{ id: "mode-1", provenance: "imported" }, { id: "mode-3", provenance: "derived" }],
          handlingClass: "one_handed",
          id: "weapon-template-hand-axe",
          name: "Hand axe",
          tags: ["thrown"],
          weaponClass: "axe",
          weaponSkill: "Axes",
        }),
        "weapon-template-long-sword": createWeaponTemplate({
          id: "weapon-template-long-sword",
          name: "Long sword",
        }),
        "weapon-template-pistol": createWeaponTemplate({
          handlingClass: "missile",
          id: "weapon-template-pistol",
          name: "Pistol",
          tags: ["firearm", "missile"],
          weaponClass: "firearm",
          weaponSkill: "Firearms",
        }),
        "weapon-template-short-bow": createWeaponTemplate({
          defaultMaterial: "wood",
          handlingClass: "missile",
          id: "weapon-template-short-bow",
          name: "Short bow",
          tags: ["bow", "missile"],
          weaponClass: "bow",
          weaponSkill: "Bow",
        }),
        "weapon-template-t-javelin": createWeaponTemplate({
          defaultMaterial: "wood",
          handlingClass: "thrown",
          id: "weapon-template-t-javelin",
          name: "T. Javelin",
          sourceMetadata: {
            rawRow: { A: "T. Javelin" },
            row: 9,
            sheet: "Weapon2",
            sourceColumns: { name: "A" },
            sourceRange: "Weapon2!A9:K9",
            workbook: "Themistogenes 1.07.xlsx",
          } as never,
          tags: ["thrown"],
          weaponClass: "polearm",
          weaponSkill: "Thrown Weapons",
        }),
      },
    },
  };
}

describe("loadout weapon option filtering", () => {
  it("shows melee weapons only in primary and secondary choices", () => {
    const state = createState();

    expect(buildLoadoutMeleeWeaponOptions({ characterId, state }).map((option) => option.label)).toEqual([
      "Hand axe",
      "Long sword",
    ]);
  });

  it("shows bows and pistols only in missile choices", () => {
    const state = createState();

    expect(buildLoadoutMissileWeaponOptions({ characterId, state }).map((option) => option.label)).toEqual([
      "Pistol",
      "Short bow",
    ]);
  });

  it("shows only weapons with thrown stats in throwing choices", () => {
    const state = createState();

    expect(buildLoadoutThrowingWeaponOptions({ characterId, state }).map((option) => option.label)).toEqual([
      "Hand axe",
      "T. Javelin",
    ]);
  });

  it("does not treat a thrown tag alone as real thrown stats for loadout throwing choices", () => {
    const state = createState();
    state.itemsById["item-tag-only-thrown"] = createWeaponItem({
      id: "item-tag-only-thrown",
      templateId: "weapon-template-tag-only-thrown",
    });
    state.templates.templatesById["weapon-template-tag-only-thrown"] = createWeaponTemplate({
      id: "weapon-template-tag-only-thrown",
      name: "Tag only thrown",
      tags: ["thrown"],
      weaponClass: "knife",
      weaponSkill: "Thrown Weapons",
    });

    expect(buildLoadoutThrowingWeaponOptions({ characterId, state }).map((option) => option.label)).not.toContain(
      "Tag only thrown",
    );
  });
});
