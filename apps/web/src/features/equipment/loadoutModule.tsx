"use client";

import type { ReactNode } from "react";
import type { CanonicalContent } from "@glantri/content";
import type { CharacterBuild } from "@glantri/domain";
import { getAccessTier, isWithYouLocation, type CarryMode } from "@glantri/domain/equipment";
import {
  buildCharacterSheetSummary,
  defaultCombatAllocationState,
  lookupWorkbookPercentageAdjustment,
  lookupWorkbookSkillInitiativeModifier
} from "@glantri/rules-engine";

import { buildCharacterArmorSummary, getWorkbookCharacterSize } from "./armorSummary";
import { buildCombatStateCharacterInputs, deriveCombatStateSnapshot } from "./combatStateDerivation";
import { buildLoadoutCombatStatsTable } from "./loadoutCombatStats";
import { buildLoadoutMeleeWeaponOptions, buildLoadoutMissileWeaponOptions, buildLoadoutThrowingWeaponOptions } from "./loadoutWeaponOptions";
import {
  getCharacterArmorItems,
  getCharacterShieldItems,
  getEquipmentTemplateById,
  getLoadoutEquipment
} from "./equipmentSelectors";
import {
  buildCombatStatePanelModel,
  type CombatStateDetailRow,
  type CombatStateTableModel
} from "./combatStatePanel";
import { CombatStatePanel } from "./components/CombatStatePanel";
import type { EquipmentFeatureState } from "./types";
import { lookupWorkbookCompositeAdjustment } from "./workbookCompositeTable";

type EncumbranceDependentSkillType = "combat" | "covert" | "physical";
type LoadoutFieldId = "armor" | "missile" | "primary" | "secondary" | "shield" | "throwing";

const ENCOMBRANCE_SKILL_TYPE_ORDER: EncumbranceDependentSkillType[] = [
  "combat",
  "covert",
  "physical"
];

export type EquipmentLoadoutModuleMode = "editable" | "readonly";

export interface EquipmentLoadoutFieldOption {
  id: string;
  label: string;
}

export interface EquipmentLoadoutFieldModel {
  error?: string;
  id: LoadoutFieldId;
  label: string;
  options: EquipmentLoadoutFieldOption[];
  value: string;
  valueLabel: string;
}

export interface EquipmentLoadoutModuleModel {
  combatStatePanelModel: ReturnType<typeof buildCombatStatePanelModel> | null;
  encumbranceSkillsTable: CombatStateTableModel | null;
  fields: EquipmentLoadoutFieldModel[];
}

function getItemName(input: {
  displayName?: string | null;
  templateId?: string;
  templateName?: string;
}): string {
  if (!input.templateId) {
    return "None";
  }

  return input.displayName ?? input.templateName ?? "Unknown item";
}

function buildSelectableItemOptions(input: {
  items: Array<{
    conditionState: string;
    displayName?: string | null;
    id: string;
    storageAssignment: {
      carryMode: CarryMode;
      locationId: string;
    };
    templateId: string;
  }>;
  state: EquipmentFeatureState;
}) {
  return input.items
    .filter((item) => item.conditionState !== "broken" && item.conditionState !== "lost")
    .map((item) => ({
      id: item.id,
      label: `${getItemName({
        displayName: item.displayName,
        templateId: item.templateId,
        templateName: getEquipmentTemplateById(input.state, item.templateId)?.name
      })}${getAccessTier(item.storageAssignment.carryMode) === "slow" ? " (Backpack / slow)" : ""}`
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function getLoadoutFieldValueLabel(input: {
  fallbackLabel?: string;
  item?: {
    displayName?: string | null;
    templateId?: string;
  } | null;
  options: EquipmentLoadoutFieldOption[];
  value: string;
}): string {
  if (!input.value) {
    return "None";
  }

  const matchedOption = input.options.find((option) => option.id === input.value);
  if (matchedOption) {
    return matchedOption.label;
  }

  return (
    getItemName({
      displayName: input.item?.displayName,
      templateId: input.item?.templateId,
      templateName: input.fallbackLabel
    }) || "None"
  );
}

function getEncumbranceDependentSkillType(input: {
  groupIds: string[];
  skillGroups: Array<{ id: string; name: string }>;
}): EncumbranceDependentSkillType | null {
  const groupNames = input.groupIds
    .map((groupId) => input.skillGroups.find((group) => group.id === groupId)?.name ?? null)
    .filter((groupName): groupName is string => Boolean(groupName));

  if (groupNames.includes("Combat")) {
    return "combat";
  }

  if (
    groupNames.includes("Stealth") ||
    groupNames.includes("Security") ||
    input.groupIds.some((groupId) => groupId.toLowerCase().includes("covert"))
  ) {
    return "covert";
  }

  if (groupNames.includes("Athletics")) {
    return "physical";
  }

  return null;
}

function getWorkbookSkillBaseTotal(input: {
  adjustedStats: Record<string, number>;
  adjustedXp: number;
  linkedStats: string[];
}): number | null {
  if (input.linkedStats.length === 0) {
    return null;
  }

  const statValues = input.linkedStats
    .map((stat) => input.adjustedStats[stat])
    .filter((value): value is number => typeof value === "number");

  if (statValues.length !== input.linkedStats.length) {
    return null;
  }

  const average = Math.round(statValues.reduce((sum, value) => sum + value, 0) / statValues.length);
  return average + input.adjustedXp;
}

function getWorkbookSkillEncumberedTotal(input: {
  baseTotal: number;
  movementModifier: number | null;
}): number | null {
  if (input.movementModifier == null) {
    return null;
  }

  const adjustment = lookupWorkbookCompositeAdjustment(input.baseTotal, input.movementModifier);
  if (adjustment == null) {
    return null;
  }

  return input.baseTotal - adjustment;
}

function getWorkbookSkillInitiative(input: {
  adjustedXp: number;
  dexterityGm: number | null | undefined;
}): number | null {
  if (input.dexterityGm == null) {
    return null;
  }

  const skillModifier = lookupWorkbookSkillInitiativeModifier(input.adjustedXp);
  if (skillModifier == null) {
    return null;
  }

  return input.dexterityGm + skillModifier;
}

function getRoundedLinkedStatAverage(
  adjustedStats: Record<string, number>,
  linkedStats: string[]
): number | null {
  if (linkedStats.length === 0) {
    return null;
  }

  const values = linkedStats
    .map((stat) => adjustedStats[stat])
    .filter((value): value is number => typeof value === "number");

  if (values.length !== linkedStats.length) {
    return null;
  }

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getWorkbookArmorAdjustedPerception(input: {
  adjustedStats: Record<string, number>;
  armorPerceptionModifier: number | null | undefined;
  perceptionAdjustedXp: number;
}): number | null {
  const intValue = input.adjustedStats.int;
  const powValue = input.adjustedStats.pow;
  const lckValue = input.adjustedStats.lck;
  if (intValue == null || powValue == null || lckValue == null) {
    return null;
  }

  const basePerception = Math.round((intValue + powValue + lckValue) / 3) + input.perceptionAdjustedXp;
  const modifier = input.armorPerceptionModifier ?? 0;
  const adjustment = lookupWorkbookPercentageAdjustment(basePerception, Math.abs(modifier));
  if (adjustment == null) {
    return null;
  }

  return modifier > 0 ? basePerception + adjustment : basePerception - adjustment;
}

function ControlSection(input: {
  children: ReactNode;
  compact?: boolean;
  sticky?: boolean;
  title: string;
}) {
  return (
    <section
      style={{
        background: "#fbfaf5",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: input.compact ? "0.65rem" : "0.9rem",
        padding: input.compact ? "0.85rem" : "1rem",
        position: input.sticky ? "sticky" : "static",
        top: input.sticky ? "1rem" : undefined,
        zIndex: input.sticky ? 10 : undefined
      }}
    >
      <h2 style={{ margin: 0 }}>{input.title}</h2>
      {input.children}
    </section>
  );
}

function EditableField(input: {
  field: EquipmentLoadoutFieldModel;
  onChange: (itemId: string | null) => void;
}) {
  return (
    <label
      style={{
        background: "#f6f5ef",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.25rem",
        padding: "0.75rem 0.85rem"
      }}
    >
      <span>{input.field.label}</span>
      <select
        onChange={(event) =>
          input.onChange(event.target.value.length > 0 ? event.target.value : null)
        }
        value={input.field.value}
      >
        <option value="">None</option>
        {input.field.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {input.field.error ? (
        <span style={{ color: "#8b3a1a", fontSize: "0.8rem" }}>{input.field.error}</span>
      ) : null}
    </label>
  );
}

function ReadonlyField(input: { field: EquipmentLoadoutFieldModel }) {
  return (
    <div
      style={{
        background: "#f6f5ef",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.25rem",
        padding: "0.75rem 0.85rem"
      }}
    >
      <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>{input.field.label}</span>
      <strong style={{ fontWeight: 500 }}>{input.field.valueLabel}</strong>
    </div>
  );
}

function TableSection(input: { table: CombatStateTableModel }) {
  return (
    <ControlSection title={input.table.title}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ borderCollapse: "collapse", minWidth: "100%", width: "100%" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
              {input.table.columns.map((column) => (
                <th key={column} style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {input.table.rows.map((row, rowIndex) => (
              <tr
                key={`${row[0]}-${rowIndex}`}
                style={{
                  borderBottom: rowIndex === input.table.rows.length - 1 ? "none" : "1px solid #e6e6df"
                }}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    style={{ padding: "0.6rem 0.75rem 0.6rem 0", verticalAlign: "top" }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ControlSection>
  );
}

export function buildEquipmentLoadoutModuleModel(input: {
  characterContext: {
    content: CanonicalContent;
    record: {
      build: CharacterBuild;
    };
  } | null;
  characterId: string;
  combatAllocationInputs?: typeof defaultCombatAllocationState;
  errors?: Partial<Record<Exclude<LoadoutFieldId, "throwing">, string | undefined>>;
  state: EquipmentFeatureState | null;
  throwingWeaponItemId?: string | null;
}): EquipmentLoadoutModuleModel {
  if (!input.state || !input.characterContext?.content || !input.characterContext.record) {
    return {
      combatStatePanelModel: null,
      encumbranceSkillsTable: null,
      fields: []
    };
  }

  const combatAllocationInputs = input.combatAllocationInputs ?? defaultCombatAllocationState;
  const sheetSummary = buildCharacterSheetSummary({
    build: input.characterContext.record.build,
    content: input.characterContext.content
  });
  const characterCombatInputs = buildCombatStateCharacterInputs(sheetSummary);
  const loadout = getLoadoutEquipment(input.state, input.characterId);
  const meleeWeaponOptions = buildLoadoutMeleeWeaponOptions({
    characterId: input.characterId,
    state: input.state
  });
  const missileWeaponOptions = buildLoadoutMissileWeaponOptions({
    characterId: input.characterId,
    state: input.state
  });
  const armorOptions = buildSelectableItemOptions({
    items: getCharacterArmorItems(input.state, input.characterId).filter((item) => {
      const location = input.state?.locationsById[item.storageAssignment.locationId];
      return location ? isWithYouLocation(location) : false;
    }),
    state: input.state
  });
  const shieldOptions = buildSelectableItemOptions({
    items: getCharacterShieldItems(input.state, input.characterId).filter((item) => {
      const location = input.state?.locationsById[item.storageAssignment.locationId];
      return location ? isWithYouLocation(location) : false;
    }),
    state: input.state
  });
  const combatSnapshot = deriveCombatStateSnapshot(
    input.state,
    input.characterId,
    characterCombatInputs,
    combatAllocationInputs
  );
  const throwingWeaponOptions = buildLoadoutThrowingWeaponOptions({
    characterId: input.characterId,
    state: input.state
  });
  const wornArmorSummary =
    "armor" in loadout && loadout.armor
      ? (() => {
          const armorTemplate = getEquipmentTemplateById(input.state, loadout.armor.templateId);
          if (armorTemplate?.category !== "armor") {
            return null;
          }

          return buildCharacterArmorSummary({
            characterSize: getWorkbookCharacterSize(input.characterContext.record.build),
            item: loadout.armor,
            template: armorTemplate
          });
        })()
      : null;
  const perceptionSkill = input.characterContext.content.skills.find(
    (skill) => skill.name.toLowerCase() === "perception"
  );
  const perceptionAdjustedXp =
    perceptionSkill
      ? sheetSummary.draftView.skills.find((skill) => skill.skillId === perceptionSkill.id)
          ?.effectiveSkillNumber ?? -3
      : -3;
  const workbookPerceptionValue = getWorkbookArmorAdjustedPerception({
    adjustedStats: sheetSummary.adjustedStats,
    armorPerceptionModifier: wornArmorSummary?.perceptionModifier ?? 0,
    perceptionAdjustedXp
  });

  const baseModel = buildCombatStatePanelModel(
    input.state,
    input.characterId,
    characterCombatInputs,
    combatAllocationInputs,
    input.throwingWeaponItemId || null
  );
  const statsRows: CombatStateDetailRow[] = [
    {
      label: "Hitpoints",
      value: input.characterContext.record.build.profile.rolledStats.health ?? "—"
    },
    {
      label: "GMR",
      value:
        sheetSummary.adjustedStats.pow != null && sheetSummary.adjustedStats.lck != null
          ? sheetSummary.adjustedStats.pow + sheetSummary.adjustedStats.lck - 3
          : "—"
    }
  ];
  const statsTable = buildLoadoutCombatStatsTable({
    adjustedStats: sheetSummary.adjustedStats,
    draftSkills: sheetSummary.draftView.skills,
    skills: input.characterContext.content.skills,
    workbookPerceptionValue
  });
  const combatStatePanelModel = {
    ...baseModel,
    statsRows,
    statsTable
  };

  const movementModifier =
    typeof combatSnapshot.movementModifierSummary === "number"
      ? combatSnapshot.movementModifierSummary
      : null;
  const encumbranceRows = input.characterContext.content.skills
    .map((skillDefinition) => {
      const skillType = getEncumbranceDependentSkillType({
        groupIds: skillDefinition.groupIds,
        skillGroups: input.characterContext!.content.skillGroups
      });
      if (!skillType) {
        return null;
      }

      const skillView = sheetSummary.draftView.skills.find(
        (skill) => skill.skillId === skillDefinition.id
      );
      if (!skillView || skillView.effectiveSkillNumber <= 0) {
        return null;
      }

      const statAverage = getRoundedLinkedStatAverage(
        sheetSummary.adjustedStats,
        skillDefinition.linkedStats
      );
      const baseTotal =
        skillDefinition.name.toLowerCase() === "perception"
          ? workbookPerceptionValue
          : getWorkbookSkillBaseTotal({
              adjustedStats: sheetSummary.adjustedStats,
              adjustedXp: skillView.effectiveSkillNumber,
              linkedStats: skillDefinition.linkedStats
            });
      const encumbered =
        baseTotal == null
          ? null
          : getWorkbookSkillEncumberedTotal({
              baseTotal,
              movementModifier
            });
      const initiative = getWorkbookSkillInitiative({
        adjustedXp: skillView.effectiveSkillNumber,
        dexterityGm: characterCombatInputs.dexterityGm
      });

      return {
        initiative,
        row: [
          skillDefinition.name,
          initiative ?? "—",
          statAverage ?? "—",
          skillView.effectiveSkillNumber,
          baseTotal ?? "—",
          encumbered ?? "—"
        ],
        skillType,
        sortOrder: skillDefinition.sortOrder
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort(
      (left, right) =>
        ENCOMBRANCE_SKILL_TYPE_ORDER.indexOf(left.skillType) -
          ENCOMBRANCE_SKILL_TYPE_ORDER.indexOf(right.skillType) ||
        left.sortOrder - right.sortOrder ||
        String(left.row[0]).localeCompare(String(right.row[0]))
    )
    .map((entry) => entry.row);

  const encumbranceSkillsTable =
    encumbranceRows.length > 0
      ? {
          title: "Encumbrance dependent skills",
          columns: ["Skill", "Initiative", "Stat average", "XP", "Skill level", "Encumbered"],
          rows: encumbranceRows
        }
      : null;

  const fields: EquipmentLoadoutFieldModel[] = [
    {
      error: input.errors?.primary,
      id: "primary",
      label: "Primary weapon",
      options: meleeWeaponOptions,
      value: "primary" in loadout ? loadout.primary?.id ?? "" : "",
      valueLabel: getLoadoutFieldValueLabel({
        fallbackLabel:
          "primary" in loadout && loadout.primary
            ? getEquipmentTemplateById(input.state, loadout.primary.templateId)?.name
            : undefined,
        item: "primary" in loadout ? loadout.primary : undefined,
        options: meleeWeaponOptions,
        value: "primary" in loadout ? loadout.primary?.id ?? "" : ""
      })
    },
    {
      error: input.errors?.shield,
      id: "shield",
      label: "Shield",
      options: shieldOptions,
      value: "shield" in loadout ? loadout.shield?.id ?? "" : "",
      valueLabel: getLoadoutFieldValueLabel({
        fallbackLabel:
          "shield" in loadout && loadout.shield
            ? getEquipmentTemplateById(input.state, loadout.shield.templateId)?.name
            : undefined,
        item: "shield" in loadout ? loadout.shield : undefined,
        options: shieldOptions,
        value: "shield" in loadout ? loadout.shield?.id ?? "" : ""
      })
    },
    {
      error: input.errors?.armor,
      id: "armor",
      label: "Armor",
      options: armorOptions,
      value: "armor" in loadout ? loadout.armor?.id ?? "" : "",
      valueLabel: getLoadoutFieldValueLabel({
        fallbackLabel:
          "armor" in loadout && loadout.armor
            ? getEquipmentTemplateById(input.state, loadout.armor.templateId)?.name
            : undefined,
        item: "armor" in loadout ? loadout.armor : undefined,
        options: armorOptions,
        value: "armor" in loadout ? loadout.armor?.id ?? "" : ""
      })
    },
    {
      error: input.errors?.secondary,
      id: "secondary",
      label: "Second hand weapon",
      options: meleeWeaponOptions,
      value: "secondary" in loadout ? loadout.secondary?.id ?? "" : "",
      valueLabel: getLoadoutFieldValueLabel({
        fallbackLabel:
          "secondary" in loadout && loadout.secondary
            ? getEquipmentTemplateById(input.state, loadout.secondary.templateId)?.name
            : undefined,
        item: "secondary" in loadout ? loadout.secondary : undefined,
        options: meleeWeaponOptions,
        value: "secondary" in loadout ? loadout.secondary?.id ?? "" : ""
      })
    },
    {
      error: input.errors?.missile,
      id: "missile",
      label: "Missile weapon",
      options: missileWeaponOptions,
      value: "missile" in loadout ? loadout.missile?.id ?? "" : "",
      valueLabel: getLoadoutFieldValueLabel({
        fallbackLabel:
          "missile" in loadout && loadout.missile
            ? getEquipmentTemplateById(input.state, loadout.missile.templateId)?.name
            : undefined,
        item: "missile" in loadout ? loadout.missile : undefined,
        options: missileWeaponOptions,
        value: "missile" in loadout ? loadout.missile?.id ?? "" : ""
      })
    },
    {
      id: "throwing",
      label: "Throwing weapon",
      options: throwingWeaponOptions,
      value: input.throwingWeaponItemId ?? "",
      valueLabel: getLoadoutFieldValueLabel({
        fallbackLabel:
          input.throwingWeaponItemId != null && input.throwingWeaponItemId.length > 0
            ? getEquipmentTemplateById(
                input.state,
                input.state.itemsById[input.throwingWeaponItemId]?.templateId ?? ""
              )?.name
            : undefined,
        item:
          input.throwingWeaponItemId != null && input.throwingWeaponItemId.length > 0
            ? input.state.itemsById[input.throwingWeaponItemId]
            : undefined,
        options: throwingWeaponOptions,
        value: input.throwingWeaponItemId ?? ""
      })
    }
  ];

  return {
    combatStatePanelModel,
    encumbranceSkillsTable,
    fields
  };
}

export function EquipmentLoadoutModule(input: {
  mode: EquipmentLoadoutModuleMode;
  model: EquipmentLoadoutModuleModel;
  onFieldChange?: (fieldId: LoadoutFieldId, itemId: string | null) => void;
  stickyControls?: boolean;
}) {
  const showControls = input.model.fields.length > 0;

  return (
    <>
      {showControls ? (
        <ControlSection compact sticky={input.stickyControls} title="Equipment choices">
          <div
            style={{
              display: "grid",
              gap: "0.6rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            {input.model.fields.map((field) =>
              input.mode === "editable" ? (
                <EditableField
                  key={field.id}
                  field={field}
                  onChange={(itemId) => input.onFieldChange?.(field.id, itemId)}
                />
              ) : (
                <ReadonlyField key={field.id} field={field} />
              )
            )}
          </div>
        </ControlSection>
      ) : null}

      {input.model.combatStatePanelModel ? (
        <CombatStatePanel model={input.model.combatStatePanelModel} />
      ) : null}

      {input.model.encumbranceSkillsTable && input.model.encumbranceSkillsTable.rows.length > 0 ? (
        <TableSection table={input.model.encumbranceSkillsTable} />
      ) : null}
    </>
  );
}
