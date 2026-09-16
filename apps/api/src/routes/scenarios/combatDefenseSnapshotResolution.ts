import { resolveEffectiveItemTemplate } from "@glantri/domain";
import {
  buildCombatDefenseSnapshotId,
  combatDefenseSnapshotSchema,
  type CombatDefenseSnapshot,
  type ScenarioParticipant,
  type ScenarioParticipantIncomingAttackSide,
} from "@glantri/domain";

import { resolveCanonicalParticipantCalculationContext } from "./combatParticipantCalculationResolution";
import {
  resolveCanonicalParryBase,
  type CanonicalParryBase,
} from "./combatManualCalculationResolution";

export interface CombatDefenseSourceSelectionInput {
  included: boolean;
  itemId: string;
}

export function defaultCombatAttackAwareness(attacker: ScenarioParticipant): boolean {
  const visibility = attacker.visibilityOverrides?.visibility;
  return visibility !== "hidden" && visibility !== "gm_only";
}

export function buildCanonicalCombatDefenseSnapshot(input: {
  attackDirection?: ScenarioParticipantIncomingAttackSide;
  attacker: ScenarioParticipant;
  attackerCombatantId: string;
  attackId: string;
  attackOpportunityId: string;
  aware: boolean;
  defender: ScenarioParticipant;
  defenderCombatantId: string;
  phase: "phase1" | "phase2";
  reviewedAt: string;
  reviewedByUserId?: string;
  roundNumber: number;
  sourceSelections: readonly CombatDefenseSourceSelectionInput[];
}): CombatDefenseSnapshot {
  const context = resolveCanonicalParticipantCalculationContext(input.defender);
  if (context.completeness !== "complete") {
    throw new RangeError("Required defense context is unavailable. Refresh combat.");
  }
  const sourceSelectionByItemId = new Map<string, boolean>();
  for (const selection of input.sourceSelections) {
    if (!selection.itemId || sourceSelectionByItemId.has(selection.itemId)) {
      throw new RangeError("Defense sources changed. Refresh combat before committing review.");
    }
    sourceSelectionByItemId.set(selection.itemId, selection.included);
  }

  const candidates = [
    context.loadout?.activePrimaryWeaponItemId
      ? {
          itemId: context.loadout.activePrimaryWeaponItemId,
          kind: "weapon" as const,
          slot: "mainHand" as const,
          template: context.primaryWeaponTemplate,
        }
      : undefined,
    context.loadout?.readyShieldItemId
      ? {
          itemId: context.loadout.readyShieldItemId,
          kind: "shield" as const,
          slot: "offHand" as const,
          template: context.readyShieldTemplate,
        }
      : context.loadout?.activeSecondaryWeaponItemId
        ? {
            itemId: context.loadout.activeSecondaryWeaponItemId,
            kind: "weapon" as const,
            slot: "offHand" as const,
            template: context.secondaryWeaponTemplate,
          }
        : undefined,
  ].filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));
  const availableIds = new Set(candidates.map((candidate) => candidate.itemId));
  if ([...sourceSelectionByItemId].some(([itemId]) => !availableIds.has(itemId))) {
    throw new RangeError("Defense sources changed. Refresh combat before committing review.");
  }

  const sources = candidates.map((candidate) => {
    const item = context.itemsById.get(candidate.itemId);
    if (
      !item ||
      !candidate.template ||
      item.templateId !== candidate.template.id ||
      !item.revision ||
      item.conditionState !== "intact" ||
      item.storageAssignment?.carryMode !== "equipped"
    ) {
      throw new RangeError("Defense sources changed. Refresh combat before committing review.");
    }
    const explicit = sourceSelectionByItemId.get(candidate.itemId);
    const included = explicit ?? true;
    return {
      decision:
        explicit === undefined ? "default_included" : included ? "gm_included" : "gm_excluded",
      included,
      itemId: item.id,
      itemRevision: item.revision,
      kind: candidate.kind,
      label: candidate.template.name,
      slot: candidate.slot,
      templateId: candidate.template.id,
    } as const;
  });
  const awarenessDefault = defaultCombatAttackAwareness(input.attacker);

  return combatDefenseSnapshotSchema.parse({
    attackDirection: input.attackDirection ?? "front",
    attackerParticipantId: input.attackerCombatantId,
    attackId: input.attackId,
    attackOpportunityId: input.attackOpportunityId,
    aware: input.aware,
    awarenessDefault,
    awarenessOverridden: input.aware !== awarenessDefault,
    defenderParticipantId: input.defenderCombatantId,
    id: buildCombatDefenseSnapshotId(input.attackId),
    ordinaryDodgeAvailable: input.aware,
    phase: input.phase,
    reviewedAt: input.reviewedAt,
    reviewedByUserId: input.reviewedByUserId,
    roundNumber: input.roundNumber,
    schemaVersion: 1,
    sources,
    status: "committed",
  });
}

/**
 * Resolves ordinary Parry from the exact source state committed for one incoming attack. Current
 * equipment is consulted only to prove that the captured Item identities and revisions remain
 * valid; it may not substitute another source or broaden the GM's committed inclusion choices.
 */
export function resolveCanonicalParryBaseForDefenseSnapshot(input: {
  attackId: string;
  attackOpportunityId: string;
  attackerCombatantId: string;
  defender: ScenarioParticipant;
  defenderCombatantId: string;
  phase: "phase1" | "phase2";
  snapshot: CombatDefenseSnapshot;
}): CanonicalParryBase {
  const snapshot = combatDefenseSnapshotSchema.parse(input.snapshot);
  const context = resolveCanonicalParticipantCalculationContext(input.defender);
  if (context.completeness !== "complete") return context;

  const incomplete = (missingFacts: string[]): CanonicalParryBase => ({
    authority: "canonical_scenario_state",
    completeness: "partial",
    missingFacts: [...new Set(missingFacts)].sort(),
    participantId: input.defender.id,
    sourceSnapshotId: context.sourceSnapshotId,
  });
  if (
    snapshot.attackId !== input.attackId ||
    snapshot.attackOpportunityId !== input.attackOpportunityId ||
    snapshot.attackerParticipantId !== input.attackerCombatantId ||
    snapshot.defenderParticipantId !== input.defenderCombatantId ||
    snapshot.phase !== input.phase
  ) {
    return incomplete(["defense_snapshot_identity"]);
  }

  const includedSources = snapshot.sources.filter((source) => source.included);
  if (includedSources.length === 0) return incomplete(["parry_source_selection"]);
  for (const source of includedSources) {
    const item = context.itemsById.get(source.itemId);
    const expectedLoadoutItemId =
      source.slot === "mainHand"
        ? context.loadout?.activePrimaryWeaponItemId
        : source.kind === "shield"
          ? context.loadout?.readyShieldItemId
          : context.loadout?.activeSecondaryWeaponItemId;
    const template = item
      ? resolveEffectiveItemTemplate(item, Object.fromEntries(context.templatesById))
      : undefined;
    if (
      expectedLoadoutItemId !== source.itemId ||
      !item ||
      item.revision !== source.itemRevision ||
      item.templateId !== source.templateId ||
      item.conditionState !== "intact" ||
      item.storageAssignment?.carryMode !== "equipped" ||
      !template ||
      template.category !== source.kind
    ) {
      return incomplete(["defense_snapshot_source"]);
    }
  }

  const usedMainHand = includedSources.some((source) => source.slot === "mainHand");
  const usedOffHand = includedSources.some((source) => source.slot === "offHand");
  const parryBase = resolveCanonicalParryBase({
    participant: input.defender,
    usedMainHand,
    usedOffHand,
  });
  return parryBase.completeness === "complete"
    ? {
        ...parryBase,
        parrySourceLabel: includedSources.map((source) => source.label).join(" + "),
      }
    : parryBase;
}
