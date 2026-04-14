import {
  getEffectiveEncumbrance,
  type EquipmentItem,
  type WeaponAttackMode,
  type WeaponTemplate,
} from "@glantri/domain";

import { formatEncumbranceDisplay } from "./displayFormatting";
import { formatOptionalDisplayValue, formatWeaponModeDmb } from "./meleeWeaponDisplay";
import type { EquipmentFeatureState } from "./types";

export interface WeaponCatalogOptionRow {
  label: string;
  template: WeaponTemplate;
  encumbrance: string;
}

export interface WeaponCatalogTableModel {
  columns: string[];
  rows: string[][];
}

export const CANONICAL_MELEE_WEAPON_TABLE_COLUMNS = [
  "Weapon",
  "I",
  "Attack 1",
  "OB",
  "DMB",
  "Crit 1",
  "Sec",
  "AM",
  "Attack 2",
  "OB2",
  "DMB2",
  "Crit 2",
  "AM 2",
  "Throwing",
  "OB T",
  "DMB T",
  "Crit T",
  "AM T",
  "Range T",
  "Parry",
  "Defensive value",
  "Weapon skill",
  "Class",
  "Handling",
  "Range",
  "Encumbrance",
] as const;

export const CANONICAL_MISSILE_WEAPON_TABLE_COLUMNS = [
  "Weapon",
  "I",
  "Attack 1",
  "OB",
  "DMB",
  "Crit 1",
  "Sec",
  "AM",
  "Attack 2",
  "OB2",
  "DMB2",
  "Crit 2",
  "AM 2",
  "Range",
  "Weapon skill",
  "Class",
  "Handling",
  "Encumbrance",
] as const;

function formatLabel(value: string): string {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getAttackMode(template: WeaponTemplate, id: string): WeaponAttackMode | null {
  return template.attackModes?.find((mode) => mode.id === id) ?? null;
}

function formatAttackLabel(mode: WeaponAttackMode | null): string {
  return mode?.label ?? "—";
}

function formatRange(value: string | null | undefined): string {
  return value?.trim() ? value : "—";
}

function getThrownMode(template: WeaponTemplate): WeaponAttackMode | null {
  return getAttackMode(template, "mode-3")
    ?? (template.handlingClass === "thrown" ? getAttackMode(template, "mode-1") : null);
}

function buildPrimaryModeCells(mode: WeaponAttackMode | null, template: WeaponTemplate): string[] {
  return [
    formatAttackLabel(mode),
    formatOptionalDisplayValue(mode?.ob),
    mode ? formatWeaponModeDmb(mode) : "—",
    formatOptionalDisplayValue(mode?.crit),
    formatOptionalDisplayValue(mode?.secondCrit ?? template.secondCrit),
    formatOptionalDisplayValue(mode?.armorModifier),
  ];
}

function buildSecondaryModeCells(mode: WeaponAttackMode | null): string[] {
  return [
    formatAttackLabel(mode),
    formatOptionalDisplayValue(mode?.ob),
    mode ? formatWeaponModeDmb(mode) : "—",
    formatOptionalDisplayValue(mode?.crit),
    formatOptionalDisplayValue(mode?.armorModifier),
  ];
}

function buildThrownCells(template: WeaponTemplate): string[] {
  const thrownMode = getThrownMode(template);

  return [
    formatAttackLabel(thrownMode),
    formatOptionalDisplayValue(thrownMode?.ob),
    thrownMode ? formatWeaponModeDmb(thrownMode) : "—",
    formatOptionalDisplayValue(thrownMode?.crit),
    formatOptionalDisplayValue(thrownMode?.armorModifier),
    formatRange(template.range),
  ];
}

export function isCatalogMissileWeaponTemplate(template: WeaponTemplate): boolean {
  return template.handlingClass === "missile";
}

export function isCatalogMeleeWeaponTemplate(template: WeaponTemplate): boolean {
  return template.handlingClass !== "missile";
}

export function getCharacterWeaponCatalogRows(input: {
  characterId: string;
  items: EquipmentItem[];
  state: EquipmentFeatureState;
}): WeaponCatalogOptionRow[] {
  return input.items
    .filter((item) => item.characterId === input.characterId && item.category === "weapon")
    .map((item) => {
      const template = input.state.templates.templatesById[item.templateId];
      return template?.category === "weapon"
        ? {
            label: item.displayName ?? template.name,
            template,
            encumbrance: formatEncumbranceDisplay(getEffectiveEncumbrance(item, template)),
          }
        : null;
    })
    .filter((row): row is WeaponCatalogOptionRow => row !== null)
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function getAdminWeaponCatalogRows(input: {
  material: EquipmentItem["material"];
  quality: EquipmentItem["quality"];
  templates: WeaponTemplate[];
}): WeaponCatalogOptionRow[] {
  return input.templates
    .map((template) => {
      const syntheticItem: EquipmentItem = {
        id: `admin-${template.id}`,
        characterId: "admin-preview",
        templateId: template.id,
        category: "weapon",
        displayName: null,
        specificityType: template.specificityTypeDefault,
        quantity: 1,
        isStackable: false,
        material: input.material,
        quality: input.quality,
        storageAssignment: {
          locationId: "admin-preview",
          carryMode: "equipped",
        },
        conditionState: "intact",
        durabilityCurrent: null,
        durabilityMax: null,
        encumbranceOverride: null,
        valueOverride: null,
        specialProperties: null,
        notes: null,
        isEquipped: null,
        isFavorite: null,
        acquiredFrom: null,
        statusTags: null,
      };

      return {
        label: template.name,
        template,
        encumbrance: formatEncumbranceDisplay(getEffectiveEncumbrance(syntheticItem, template)),
      };
    })
    .sort((left, right) => left.template.weaponSkill.localeCompare(right.template.weaponSkill) || left.label.localeCompare(right.label));
}

export function buildMeleeWeaponCatalogTable(rows: WeaponCatalogOptionRow[]): WeaponCatalogTableModel {
  return {
    columns: [...CANONICAL_MELEE_WEAPON_TABLE_COLUMNS],
    rows: rows
      .filter((row) => isCatalogMeleeWeaponTemplate(row.template))
      .map((row) => {
        const mode1 = getAttackMode(row.template, "mode-1");
        const mode2 = getAttackMode(row.template, "mode-2");

        return [
          row.label,
          formatOptionalDisplayValue(row.template.initiative),
          ...buildPrimaryModeCells(mode1, row.template),
          ...buildSecondaryModeCells(mode2),
          ...buildThrownCells(row.template),
          formatOptionalDisplayValue(row.template.parry),
          formatOptionalDisplayValue(row.template.defensiveValue),
          row.template.weaponSkill,
          formatLabel(row.template.weaponClass),
          formatLabel(row.template.handlingClass),
          formatRange(row.template.range),
          row.encumbrance,
        ];
      }),
  };
}

export function buildMissileWeaponCatalogTable(rows: WeaponCatalogOptionRow[]): WeaponCatalogTableModel {
  return {
    columns: [...CANONICAL_MISSILE_WEAPON_TABLE_COLUMNS],
    rows: rows
      .filter((row) => isCatalogMissileWeaponTemplate(row.template))
      .map((row) => {
        const mode1 = getAttackMode(row.template, "mode-1");
        const mode2 = getAttackMode(row.template, "mode-2");

        return [
          row.label,
          formatOptionalDisplayValue(row.template.initiative),
          ...buildPrimaryModeCells(mode1, row.template),
          ...buildSecondaryModeCells(mode2),
          formatRange(row.template.range),
          row.template.weaponSkill,
          formatLabel(row.template.weaponClass),
          formatLabel(row.template.handlingClass),
          row.encumbrance,
        ];
      }),
  };
}
