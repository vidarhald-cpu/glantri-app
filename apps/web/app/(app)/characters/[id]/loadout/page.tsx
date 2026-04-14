"use client";

import { use, useEffect, useMemo, useState, type ReactNode } from "react";
import type { EncounterDefensePosture } from "@glantri/domain";
import { getAccessTier, isWithYouLocation, type CarryMode } from "@glantri/domain/equipment";
import { buildCharacterSheetSummary } from "@glantri/rules-engine";
import {
  defaultCombatAllocationState,
  type CombatAllocationState,
  type CombatParrySource,
} from "../../../../../../../packages/rules-engine/src/combat/combatAllocationState";
import {
  lookupWorkbookPercentageAdjustment,
  lookupWorkbookSkillInitiativeModifier,
} from "../../../../../../../packages/rules-engine/src/combat/workbookCombatMath";

import { CombatStatePanel } from "../../../../../src/features/equipment/components/CombatStatePanel";
import {
  buildCharacterArmorSummary,
  getWorkbookCharacterSize,
} from "../../../../../src/features/equipment/armorSummary";
import {
  buildCombatStatePanelModel,
  type CombatStateDetailRow,
  type CombatStateTableModel,
} from "../../../../../src/features/equipment/combatStatePanel";
import {
  buildCombatStateCharacterInputs,
  deriveCombatStateSnapshot,
} from "../../../../../src/features/equipment/combatStateDerivation";
import { buildLoadoutCombatStatsTable } from "../../../../../src/features/equipment/loadoutCombatStats";
import {
  buildLoadoutMeleeWeaponOptions,
  buildLoadoutMissileWeaponOptions,
  buildLoadoutThrowingWeaponOptions,
  isValidLoadoutThrowingWeaponItem,
} from "../../../../../src/features/equipment/loadoutWeaponOptions";
import {
  getCharacterArmorItems,
  getCharacterShieldItems,
  getEquipmentTemplateById,
  getLoadoutEquipment,
} from "../../../../../src/features/equipment/equipmentSelectors";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";
import { lookupWorkbookCompositeAdjustment } from "../../../../../src/features/equipment/workbookCompositeTable";
import {
  loadCharacterEquipmentState,
  setCharacterActiveMissileWeaponOnServer,
  setCharacterActivePrimaryWeaponOnServer,
  setCharacterActiveSecondaryWeaponOnServer,
  setCharacterReadyShieldOnServer,
  setCharacterWornArmorOnServer,
} from "../../../../../src/lib/api/localServiceClient";
import { loadLocalCharacterContext } from "../../../../../src/lib/characters/loadLocalCharacterContext";

interface CharacterLoadoutPageProps {
  params: Promise<{
    id: string;
  }>;
}

function getCharacterName(name: string | undefined): string {
  return name?.trim() || "Unnamed character";
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

function WeaponControl(input: {
  error?: string;
  label: string;
  onChange: (itemId: string | null) => void;
  options: Array<{ id: string; label: string }>;
  value: string;
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
      <span>{input.label}</span>
      <select
        onChange={(event) =>
          input.onChange(event.target.value.length > 0 ? event.target.value : null)
        }
        value={input.value}
      >
        <option value="">None</option>
        {input.options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
      {input.error ? (
        <span style={{ color: "#8b3a1a", fontSize: "0.8rem" }}>{input.error}</span>
      ) : null}
    </label>
  );
}

function ParryAllocationControl(input: {
  allocationValue: number;
  label: string;
  onAllocationChange: (value: number) => void;
  onSourceChange: (value: string | null) => void;
  options: Array<{ id: string; label: string }>;
  sourceValue: string;
}) {
  return (
    <div
      style={{
        background: "#f6f5ef",
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.55rem",
        padding: "0.75rem 0.85rem"
      }}
    >
      <div>{input.label}</div>
      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>Source</span>
        <select
          onChange={(event) =>
            input.onSourceChange(event.target.value.length > 0 ? event.target.value : null)
          }
          value={input.sourceValue}
        >
          {input.options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label style={{ display: "grid", gap: "0.35rem" }}>
        <span style={{ color: "#5e5a50", fontSize: "0.9rem" }}>Allocated OB</span>
        <input
          onChange={(event) => input.onAllocationChange(Number(event.target.value) || 0)}
          type="number"
          value={input.allocationValue}
        />
      </label>
    </div>
  );
}

const defensePostureOptions: Array<{ label: string; value: EncounterDefensePosture }> = [
  { label: "None", value: "none" },
  { label: "Guard", value: "guard" },
  { label: "Parry", value: "parry" },
  { label: "Shield defense", value: "shield" },
  { label: "Full defense", value: "full-defense" },
];

const combatActionOptions = [
  { label: "None", value: "none" },
  { label: "Attack", value: "attack" },
  { label: "Move", value: "move" },
  { label: "Hold", value: "hold" },
] as const;

function isBowOrTwoHandedTemplate(templateId: string | null, state: EquipmentFeatureState): boolean {
  if (!templateId) {
    return false;
  }

  const template = getEquipmentTemplateById(state, templateId);
  return (
    template?.category === "weapon" &&
    (template.handlingClass === "two_handed" ||
      template.weaponClass === "bow" ||
      template.tags.includes("bow"))
  );
}

function getParrySourceOptions(loadout: ReturnType<typeof getLoadoutEquipment>): Array<{
  label: string;
  value: CombatParrySource;
}> {
  const options: Array<{ label: string; value: CombatParrySource }> = [
    { label: "None", value: "none" },
    { label: "Unarmed", value: "unarmed" },
  ];

  if ("primary" in loadout && loadout.primary) {
    options.push({ label: "Primary", value: "primary" });
  }

  if ("secondary" in loadout && loadout.secondary) {
    options.push({ label: "Secondary", value: "secondary" });
  }

  if ("shield" in loadout && loadout.shield) {
    options.push({ label: "Shield", value: "shield" });
  }

  return options;
}

function buildSelectableItemOptions(input: {
  items: Array<{
    conditionState: string;
    displayName?: string | null;
    id: string;
    storageAssignment: {
      carryMode: CarryMode;
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
        templateName: getEquipmentTemplateById(input.state, item.templateId)?.name,
      })}${getAccessTier(item.storageAssignment.carryMode) === "slow" ? " (Backpack / slow)" : ""}`,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

type EncumbranceDependentSkillType = "combat" | "covert" | "physical";

const ENCOMBRANCE_SKILL_TYPE_ORDER: EncumbranceDependentSkillType[] = [
  "combat",
  "covert",
  "physical",
];

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
  linkedStats: string[];
  adjustedXp: number;
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
  linkedStats: string[],
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

export default function CharacterLoadoutPage({ params }: CharacterLoadoutPageProps) {
  const { id } = use(params);
  const [state, setState] = useState<EquipmentFeatureState | null>(null);
  const [characterContext, setCharacterContext] = useState<
    Awaited<ReturnType<typeof loadLocalCharacterContext>> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string>();
  const [combatAllocationInputs, setCombatAllocationInputs] = useState<CombatAllocationState>(
    defaultCombatAllocationState
  );
  const [combatAction, setCombatAction] = useState<(typeof combatActionOptions)[number]["value"]>("none");
  const [throwingWeaponItemId, setThrowingWeaponItemId] = useState<string>("");
  const [errors, setErrors] = useState<
    Record<"armor" | "primary" | "secondary" | "missile" | "shield", string | undefined>
  >({
    armor: undefined,
    missile: undefined,
    primary: undefined,
    secondary: undefined,
    shield: undefined,
  });

  const sheetSummary = useMemo(() => {
    if (!characterContext?.content || !characterContext.record) {
      return undefined;
    }

    return buildCharacterSheetSummary({
      build: characterContext.record.build,
      content: characterContext.content,
    });
  }, [characterContext]);
  const characterCombatInputs = useMemo(() => {
    if (!sheetSummary) {
      return undefined;
    }

    return buildCombatStateCharacterInputs(sheetSummary);
  }, [sheetSummary]);

  const loadout = useMemo(() => (state ? getLoadoutEquipment(state, id) : {}), [state, id]);
  const meleeWeaponOptions = useMemo(
    () =>
      state
        ? buildLoadoutMeleeWeaponOptions({
            characterId: id,
            state,
          })
        : [],
    [state, id]
  );
  const missileWeaponOptions = useMemo(
    () =>
      state
        ? buildLoadoutMissileWeaponOptions({
            characterId: id,
            state,
          })
        : [],
    [state, id]
  );
  const armorOptions = useMemo(
    () =>
      state
        ? buildSelectableItemOptions({
            items: getCharacterArmorItems(state, id).filter((item) => {
              const location = state.locationsById[item.storageAssignment.locationId];
              return location ? isWithYouLocation(location) : false;
            }),
            state,
          })
        : [],
    [state, id]
  );
  const shieldOptions = useMemo(
    () =>
      state
        ? buildSelectableItemOptions({
            items: getCharacterShieldItems(state, id).filter((item) => {
              const location = state.locationsById[item.storageAssignment.locationId];
              return location ? isWithYouLocation(location) : false;
            }),
            state,
          })
        : [],
    [state, id]
  );
  const combatSnapshot = useMemo(
    () =>
      state
        ? deriveCombatStateSnapshot(state, id, characterCombatInputs, combatAllocationInputs)
        : null,
    [characterCombatInputs, combatAllocationInputs, id, state],
  );
  const parrySourceOptions = useMemo(() => getParrySourceOptions(loadout), [loadout]);
  const throwingWeaponOptions = useMemo(
    () =>
      state
        ? buildLoadoutThrowingWeaponOptions({
            characterId: id,
            state,
          })
        : [],
    [id, state]
  );
  const wornArmorSummary = useMemo(() => {
    if (!state || !characterContext?.record || !("armor" in loadout) || !loadout.armor) {
      return null;
    }

    const armorTemplate = getEquipmentTemplateById(state, loadout.armor.templateId);
    if (armorTemplate?.category !== "armor") {
      return null;
    }

    return buildCharacterArmorSummary({
      characterSize: getWorkbookCharacterSize(characterContext.record.build),
      item: loadout.armor,
      template: armorTemplate,
    });
  }, [characterContext, loadout, state]);
  const workbookPerceptionValue = useMemo(() => {
    if (!sheetSummary) {
      return null;
    }

    const perceptionSkill = characterContext?.content?.skills.find(
      (skill) => skill.name.toLowerCase() === "perception",
    );
    const perceptionAdjustedXp =
      perceptionSkill
        ? sheetSummary.draftView.skills.find((skill) => skill.skillId === perceptionSkill.id)
            ?.effectiveSkillNumber ?? -3
        : -3;

    return getWorkbookArmorAdjustedPerception({
      adjustedStats: sheetSummary.adjustedStats,
      armorPerceptionModifier: wornArmorSummary?.perceptionModifier ?? 0,
      perceptionAdjustedXp,
    });
  }, [characterContext, sheetSummary, wornArmorSummary]);
  const combatStatePanelModel = useMemo(
    () => {
      if (!state) {
        return null;
      }

      const baseModel = buildCombatStatePanelModel(
        state,
        id,
        characterCombatInputs,
        combatAllocationInputs,
        throwingWeaponItemId || null,
      );

      const statsRows: CombatStateDetailRow[] = [
        {
          label: "Hitpoints",
          value: characterContext?.record?.build.profile.rolledStats.health ?? "—",
        },
        {
          label: "GMR",
          value:
            sheetSummary?.adjustedStats.pow != null && sheetSummary?.adjustedStats.lck != null
              ? sheetSummary.adjustedStats.pow + sheetSummary.adjustedStats.lck - 3
              : "—",
        },
      ];
      const statsTable: CombatStateTableModel | undefined =
        sheetSummary && characterContext?.content
          ? buildLoadoutCombatStatsTable({
              adjustedStats: sheetSummary.adjustedStats,
              draftSkills: sheetSummary.draftView.skills,
              skills: characterContext.content.skills,
              workbookPerceptionValue,
            })
          : undefined;
      return {
        ...baseModel,
        statsRows,
        statsTable,
      };
    },
    [
      characterCombatInputs,
      characterContext,
      combatAllocationInputs,
      id,
      sheetSummary,
      state,
      throwingWeaponItemId,
      workbookPerceptionValue,
    ]
  );
  const selectedThrowingWeaponItem = useMemo(
    () => (throwingWeaponItemId && state ? state.itemsById[throwingWeaponItemId] : undefined),
    [state, throwingWeaponItemId],
  );
  const skillsSectionTable = useMemo<CombatStateTableModel | null>(() => {
    if (!sheetSummary || !characterContext?.content || !characterCombatInputs || !combatSnapshot) {
      return null;
    }

    const movementModifier =
      typeof combatSnapshot.movementModifierSummary === "number"
        ? combatSnapshot.movementModifierSummary
        : null;

    const rows = characterContext.content.skills
      .map((skillDefinition) => {
        const skillType = getEncumbranceDependentSkillType({
          groupIds: skillDefinition.groupIds,
          skillGroups: characterContext.content.skillGroups,
        });
        if (!skillType) {
          return null;
        }

        const skillView = sheetSummary.draftView.skills.find(
          (skill) => skill.skillId === skillDefinition.id,
        );
        if (!skillView || skillView.effectiveSkillNumber <= 0) {
          return null;
        }
        const statAverage = getRoundedLinkedStatAverage(
          sheetSummary.adjustedStats,
          skillDefinition.linkedStats,
        );

        const baseTotal =
          skillDefinition.name.toLowerCase() === "perception"
            ? workbookPerceptionValue
            : getWorkbookSkillBaseTotal({
                adjustedStats: sheetSummary.adjustedStats,
                linkedStats: skillDefinition.linkedStats,
                adjustedXp: skillView.effectiveSkillNumber,
              });
        const encumbered =
          baseTotal == null
            ? null
            : getWorkbookSkillEncumberedTotal({
                baseTotal,
                movementModifier,
              });
        const initiative = getWorkbookSkillInitiative({
          adjustedXp: skillView.effectiveSkillNumber,
          dexterityGm: characterCombatInputs.dexterityGm,
        });

        return {
          initiative,
          row: [
            skillDefinition.name,
            initiative ?? "—",
            statAverage ?? "—",
            skillView.effectiveSkillNumber,
            baseTotal ?? "—",
            encumbered ?? "—",
          ],
          skillType,
          sortOrder: skillDefinition.sortOrder,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((left, right) =>
        ENCOMBRANCE_SKILL_TYPE_ORDER.indexOf(left.skillType) -
          ENCOMBRANCE_SKILL_TYPE_ORDER.indexOf(right.skillType) ||
        left.sortOrder - right.sortOrder ||
        String(left.row[0]).localeCompare(String(right.row[0])),
      )
      .map((entry) => entry.row);

    return {
      title: "Encumbrance dependent skills",
      columns: ["Skill", "Initiative", "Stat average", "XP", "Skill level", "Encumbered"],
      rows,
    };
  }, [characterCombatInputs, characterContext, combatSnapshot, sheetSummary, workbookPerceptionValue]);

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadCharacterEquipmentState(id), loadLocalCharacterContext(id)])
      .then(([nextState, nextCharacterContext]) => {
        if (cancelled) {
          return;
        }

        setState(nextState);
        setCharacterContext(nextCharacterContext);
        setPageError(undefined);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        setPageError(error instanceof Error ? error.message : "Unable to load loadout.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    if (!throwingWeaponItemId || !state) {
      return;
    }

    if (
      !isValidLoadoutThrowingWeaponItem({
        item: selectedThrowingWeaponItem,
        state,
      })
    ) {
      setThrowingWeaponItemId("");
    }
  }, [selectedThrowingWeaponItem, state, throwingWeaponItemId]);

  async function applySelection(input: {
    itemId: string | null;
    kind: "armor" | "primary" | "secondary" | "missile" | "shield";
  }) {
    if (!state) {
      return;
    }

    try {
      const currentLoadout = state.activeLoadoutByCharacterId[id];
      const nextSelection = {
        armor: currentLoadout?.wornArmorItemId ?? null,
        shield: currentLoadout?.readyShieldItemId ?? null,
        primary: currentLoadout?.activePrimaryWeaponItemId ?? null,
        secondary: currentLoadout?.activeSecondaryWeaponItemId ?? null,
        missile: currentLoadout?.activeMissileWeaponItemId ?? null,
      };

      nextSelection[input.kind] = input.itemId;

      if (input.kind === "shield" && input.itemId) {
        nextSelection.secondary = null;
      }

      if (input.kind === "secondary" && input.itemId) {
        nextSelection.shield = null;
      }

      const selectedWeaponTemplateId =
        input.kind === "primary" || input.kind === "secondary" || input.kind === "missile"
          ? state.itemsById[input.itemId ?? ""]?.templateId ?? null
          : null;

      if (
        (input.kind === "primary" || input.kind === "secondary") &&
        selectedWeaponTemplateId &&
        isBowOrTwoHandedTemplate(selectedWeaponTemplateId, state)
      ) {
        if (input.kind === "primary") {
          nextSelection.secondary = null;
        }
        if (input.kind === "secondary") {
          nextSelection.primary = null;
        }
        nextSelection.shield = null;
      }

      if (
        input.itemId &&
        (input.kind === "shield" || input.kind === "secondary")
      ) {
        const currentPrimaryTemplateId = state.itemsById[nextSelection.primary ?? ""]?.templateId ?? null;
        if (currentPrimaryTemplateId && isBowOrTwoHandedTemplate(currentPrimaryTemplateId, state)) {
          nextSelection.primary = null;
        }
      }

      const operations: Array<() => Promise<EquipmentFeatureState>> = [];

      const queueOperation = (
        kind: "armor" | "primary" | "secondary" | "missile" | "shield",
        itemId: string | null,
      ) => {
        const currentValue = currentLoadout
          ? kind === "armor"
            ? currentLoadout.wornArmorItemId ?? null
            : kind === "shield"
              ? currentLoadout.readyShieldItemId ?? null
              : kind === "primary"
                ? currentLoadout.activePrimaryWeaponItemId ?? null
                : kind === "secondary"
                  ? currentLoadout.activeSecondaryWeaponItemId ?? null
                  : currentLoadout.activeMissileWeaponItemId ?? null
          : null;

        if (currentValue === itemId) {
          return;
        }

        operations.push(() =>
          kind === "armor"
            ? setCharacterWornArmorOnServer({ characterId: id, itemId })
            : kind === "shield"
              ? setCharacterReadyShieldOnServer({ characterId: id, itemId })
              : kind === "primary"
                ? setCharacterActivePrimaryWeaponOnServer({ characterId: id, itemId })
                : kind === "secondary"
                  ? setCharacterActiveSecondaryWeaponOnServer({ characterId: id, itemId })
                  : setCharacterActiveMissileWeaponOnServer({ characterId: id, itemId }),
        );
      };

      queueOperation("secondary", nextSelection.secondary);
      queueOperation("shield", nextSelection.shield);
      queueOperation("primary", nextSelection.primary);
      queueOperation("armor", nextSelection.armor);
      queueOperation("missile", nextSelection.missile);

      let nextState = state;

      for (const operation of operations) {
        nextState = await operation();
      }

      setState(nextState);
      setErrors((current) => ({
        ...current,
        [input.kind]: undefined,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update loadout.";
      console.warn(message);
      setErrors((current) => ({
        ...current,
        [input.kind]: message,
      }));
    }
  }

  const characterName = getCharacterName(characterContext?.record?.build.name);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 900 }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <h1 style={{ margin: 0 }}>Equip items - {characterName}</h1>
      </div>

      {loading ? (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          Loading loadout...
        </div>
      ) : null}

      {pageError ? (
        <div
          style={{
            background: "#fdf0ea",
            border: "1px solid #e4b9a7",
            borderRadius: 12,
            color: "#8b3a1a",
            padding: "1rem"
          }}
        >
          {pageError}
        </div>
      ) : null}

      {!loading && !pageError ? (
        <ControlSection compact sticky title="Equipment choices">
          <div
            style={{
              display: "grid",
              gap: "0.6rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <WeaponControl
              error={errors.primary}
              label="Primary weapon"
              onChange={(itemId) => void applySelection({ itemId, kind: "primary" })}
              options={meleeWeaponOptions}
              value={"primary" in loadout ? loadout.primary?.id ?? "" : ""}
            />
            <WeaponControl
              error={errors.shield}
              label="Shield"
              onChange={(itemId) => void applySelection({ itemId, kind: "shield" })}
              options={shieldOptions}
              value={"shield" in loadout ? loadout.shield?.id ?? "" : ""}
            />
            <WeaponControl
              error={errors.armor}
              label="Armor"
              onChange={(itemId) => void applySelection({ itemId, kind: "armor" })}
              options={armorOptions}
              value={"armor" in loadout ? loadout.armor?.id ?? "" : ""}
            />
            <WeaponControl
              error={errors.secondary}
              label="Second hand weapon"
              onChange={(itemId) => void applySelection({ itemId, kind: "secondary" })}
              options={meleeWeaponOptions}
              value={"secondary" in loadout ? loadout.secondary?.id ?? "" : ""}
            />
            <WeaponControl
              error={errors.missile}
              label="Missile weapon"
              onChange={(itemId) => void applySelection({ itemId, kind: "missile" })}
              options={missileWeaponOptions}
              value={"missile" in loadout ? loadout.missile?.id ?? "" : ""}
            />
            <WeaponControl
              label="Throwing weapon"
              onChange={(itemId) => setThrowingWeaponItemId(itemId ?? "")}
              options={throwingWeaponOptions}
              value={throwingWeaponItemId}
            />
          </div>
        </ControlSection>
      ) : null}

      {!loading && !pageError ? (
        <ControlSection compact title="Combat actions">
          <div
            style={{
              display: "grid",
              gap: "0.6rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
            }}
          >
            <WeaponControl
              label="Defence posture"
              onChange={(value) =>
                setCombatAllocationInputs((current) => ({
                  ...current,
                  defensePosture: (value ?? "none") as EncounterDefensePosture,
                }))
              }
              options={defensePostureOptions.map((option) => ({
                id: option.value,
                label: option.label,
              }))}
              value={combatAllocationInputs.defensePosture}
            />
            <ParryAllocationControl
              allocationValue={combatAllocationInputs.parry.allocatedOb ?? 0}
              label="Parry allocation"
              onAllocationChange={(value) =>
                setCombatAllocationInputs((current) => ({
                  ...current,
                  parry: {
                    ...current.parry,
                    allocatedOb: value,
                  },
                }))
              }
              onSourceChange={(value) =>
                setCombatAllocationInputs((current) => ({
                  ...current,
                  parry: {
                    ...current.parry,
                    source: (value ?? "none") as CombatParrySource,
                  },
                }))
              }
              options={parrySourceOptions.map((option) => ({
                id: option.value,
                label: option.label,
              }))}
              sourceValue={combatAllocationInputs.parry.source}
            />
            <WeaponControl
              label="Combat action"
              onChange={(value) => setCombatAction((value ?? "none") as (typeof combatActionOptions)[number]["value"])}
              options={combatActionOptions.map((option) => ({
                id: option.value,
                label: option.label,
              }))}
              value={combatAction}
            />
          </div>
        </ControlSection>
      ) : null}

      {!loading && !pageError && combatStatePanelModel ? (
        <CombatStatePanel model={combatStatePanelModel} />
      ) : null}

      {!loading && !pageError && skillsSectionTable && skillsSectionTable.rows.length > 0 ? (
        <ControlSection title="Encumbrance dependent skills">
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: "100%", width: "100%" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                  {skillsSectionTable.columns.map((column) => (
                    <th key={column} style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skillsSectionTable.rows.map((row, rowIndex) => (
                  <tr key={`${row[0]}-${rowIndex}`} style={{ borderBottom: rowIndex === skillsSectionTable.rows.length - 1 ? "none" : "1px solid #e6e6df" }}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`} style={{ padding: "0.6rem 0.75rem 0.6rem 0", verticalAlign: "top" }}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ControlSection>
      ) : null}
    </section>
  );
}
