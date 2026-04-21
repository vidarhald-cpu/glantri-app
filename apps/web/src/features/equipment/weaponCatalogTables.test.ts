import { describe, expect, it } from "vitest";
import type { EquipmentItem, EquipmentTemplate, StorageLocation } from "@glantri/domain";
import { equipmentTemplates } from "@glantri/content/equipment";

import {
  buildMeleeWeaponCatalogTable,
  buildMissileWeaponCatalogTable,
  CANONICAL_MELEE_WEAPON_TABLE_COLUMNS,
  CANONICAL_MISSILE_WEAPON_TABLE_COLUMNS,
  getAdminWeaponCatalogRows,
  getCharacterWeaponCatalogRows,
  truncateWeaponCatalogNote,
} from "./weaponCatalogTables";
import type { EquipmentFeatureState } from "./types";

const characterId = "char-weapon-catalog";

function indexById<T extends { id: string }>(items: T[]): Record<string, T> {
  return Object.fromEntries(items.map((item) => [item.id, item]));
}

function createWeaponItem(id: string, templateId: string, material: EquipmentItem["material"] = "steel"): EquipmentItem {
  return {
    id,
    characterId,
    templateId,
    category: "weapon",
    displayName: null,
    specificityType: "generic",
    quantity: 1,
    isStackable: false,
    material,
    quality: "standard",
    storageAssignment: {
      locationId: "loc-equipped",
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
}

function createState(): EquipmentFeatureState {
  const items = [
    createWeaponItem("item-longsword", "weapon-template-longsword"),
    createWeaponItem("item-composite-bow", "weapon-template-composite-bow", "wood"),
    createWeaponItem("item-dagger", "weapon-template-dagger"),
    createWeaponItem("item-hand-axe", "weapon-template-hand-axe"),
  ];
  const locations: StorageLocation[] = [
    {
      id: "loc-equipped",
      characterId,
      name: "Equipped",
      type: "equipped_system",
      availabilityClass: "with_you",
      parentLocationId: null,
      isMobile: true,
      isAccessibleInEncounter: true,
      notes: null,
    },
  ];

  return {
    templates: {
      templatesById: indexById<EquipmentTemplate>(equipmentTemplates),
    },
    itemsById: indexById(items),
    locationsById: indexById(locations),
    activeLoadoutByCharacterId: {},
  };
}

describe("weaponCatalogTables", () => {
  it("keeps missile weapons out of the melee table and retains thrown columns for thrown-capable melee weapons", () => {
    const state = createState();
    const rows = getCharacterWeaponCatalogRows({
      characterId,
      items: Object.values(state.itemsById),
      state,
    });

    const meleeTable = buildMeleeWeaponCatalogTable(rows);

    expect(meleeTable.columns).toEqual([...CANONICAL_MELEE_WEAPON_TABLE_COLUMNS]);
    expect(meleeTable.rows.map((row) => row[0])).toEqual(["Dagger", "Hand axe", "Long sword"]);

    const daggerRow = meleeTable.rows.find((row) => row[0] === "Dagger");
    const handAxeRow = meleeTable.rows.find((row) => row[0] === "Hand axe");
    const longSwordRow = meleeTable.rows.find((row) => row[0] === "Long sword");

    expect(daggerRow?.[13]).toBe("Throw");
    expect(handAxeRow?.[13]).toBe("Throw");
    expect(longSwordRow?.[13]).toBe("—");
  });

  it("moves missile weapons into the missile table", () => {
    const state = createState();
    const rows = getCharacterWeaponCatalogRows({
      characterId,
      items: Object.values(state.itemsById),
      state,
    });

    const missileTable = buildMissileWeaponCatalogTable(rows);

    expect(missileTable.columns).toEqual([...CANONICAL_MISSILE_WEAPON_TABLE_COLUMNS]);
    expect(missileTable.rows.map((row) => row[0])).toEqual(["Composite bow"]);
  });

  it("uses the same aligned melee and missile table structures for admin and character catalogs", () => {
    const state = createState();
    const characterRows = getCharacterWeaponCatalogRows({
      characterId,
      items: Object.values(state.itemsById),
      state,
    });
    const adminRows = getAdminWeaponCatalogRows({
      material: "steel",
      quality: "standard",
      templates: equipmentTemplates.filter(
        (template): template is Extract<EquipmentTemplate, { category: "weapon" }> => template.category === "weapon",
      ),
    });

    expect(buildMeleeWeaponCatalogTable(characterRows).columns).toEqual(buildMeleeWeaponCatalogTable(adminRows).columns);
    expect(buildMissileWeaponCatalogTable(characterRows).columns).toEqual(buildMissileWeaponCatalogTable(adminRows).columns);
  });

  it("truncates long notes cleanly for compact table display", () => {
    expect(
      truncateWeaponCatalogNote(
        "This is a very long weapon note that should be trimmed before it widens the character catalog table too much.",
      ),
    ).toBe("This is a very long weapon note that should be trimmed...");
    expect(truncateWeaponCatalogNote("  ")).toBe("—");
  });
});
