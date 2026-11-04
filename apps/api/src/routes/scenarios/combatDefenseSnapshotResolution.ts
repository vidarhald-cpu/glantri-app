import { resolveEffectiveItemTemplate } from "@glantri/domain";
import {
  buildCombatDefenseSnapshotId,
  combatDefenseSnapshotSchema,
  type CombatDefenseSnapshot,
  type ScenarioParticipant,
  type ScenarioParticipantIncomingAttackSide,
} from "@glantri/domain";

import { canTemplateParry } from "@glantri/rules-engine";

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

/**
 * The GM-facing sentence for a defence the server cannot work out (#694).
 *
 * The single sentence this replaces said *"Refresh combat"* for every cause. After #694 the
 * remaining causes are genuinely different, and only one of them is repaired by reloading
 * anything, so they are reported apart — the same treatment #690 applied at the attack-roll
 * refusal, for the same reason: an instruction to refresh that cannot repair the condition sends
 * a solo GM round a loop with nothing to show for it.
 *
 * Each sentence says what is actually missing, that nothing was recorded, and what would change
 * it — or, where nothing the GM can do would change it, it says that plainly instead of
 * suggesting an action that would not work.
 */
export function getCombatDefenseRefusalMessage(missingFacts: readonly string[]): string {
  if (missingFacts.includes("workbook_adjustment")) {
    // #922. The percentage adjustment used to be unavailable whenever a defender's committed
    // modifier total ran past the last authored row, which is no longer a refusal: that lookup is
    // open-ended. What can still be unavailable is a defence value the rule has no reading of at
    // all — a base defence below zero — and nothing the GM does to the defender's skills or
    // equipment changes it, so this sentence does not ask for either.
    return "This opponent's defence works out to a value this calculation has no reading for, so the attack cannot be resolved. Nothing was recorded. This is not something the opponent's skills or equipment can repair; report it with the opponent's defence figures.";
  }
  if (missingFacts.includes("character_build")) {
    return "This opponent has no characteristics or skills recorded, so its defense cannot be worked out. Nothing was recorded. Give the opponent its characteristics and skills, then resolve this attack again.";
  }
  if (missingFacts.includes("character_equipment_aggregate")) {
    return "This opponent carries no equipment recorded for this scenario, and this defense is worked out from what the defender carries, so it cannot be resolved. Nothing was recorded. An opponent created from a Template carries no scenario equipment, and reloading will not add any.";
  }
  return "This opponent's equipment for this scenario is incomplete or out of date, so its defense sources cannot be read. Nothing was recorded. Update the opponent's scenario equipment from the participant assignment grid on the scenario page, then resolve this attack again.";
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
    throw new RangeError(getCombatDefenseRefusalMessage(context.missingFacts));
  }
  const sourceSelectionByItemId = new Map<string, boolean>();
  for (const selection of input.sourceSelections) {
    if (!selection.itemId || sourceSelectionByItemId.has(selection.itemId)) {
      throw new RangeError("Defense sources changed. Refresh combat before committing review.");
    }
    sourceSelectionByItemId.set(selection.itemId, selection.included);
  }

  // Every wielded slot is validated for equipment staleness below, including slots that cannot
  // parry, so an ineligible source can never hide a changed Item from that guard.
  const wieldedCandidates = [
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
  // Selections are validated against every wielded Item rather than only the parry-eligible ones.
  // A selection naming an Item the defender is not wielding is still stale equipment and refused;
  // a selection naming a wielded Item that cannot parry is simply inert, so a client holding an
  // older source list does not get an unrefreshable refusal out of it.
  const wieldedIds = new Set(wieldedCandidates.map((candidate) => candidate.itemId));
  if ([...sourceSelectionByItemId].some(([itemId]) => !wieldedIds.has(itemId))) {
    throw new RangeError("Defense sources changed. Refresh combat before committing review.");
  }

  const sources = wieldedCandidates.flatMap((candidate) => {
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
    // Parry-source eligibility (#665). A template that authors no Parry modifier cannot be scored
    // by any Parry row, so it is not a Parry source and is never committed as one. Recording it as
    // included is what left the canonical resolver facing a combined row that cannot exist, while
    // the GM's panel — which only offers sources it can score — displayed a main-hand-only score.
    // This decides eligibility, never a value: no Parry is substituted, defaulted or derived.
    if (!canTemplateParry(candidate.template)) return [];
    const explicit = sourceSelectionByItemId.get(candidate.itemId);
    const included = explicit ?? true;
    return [
      {
        decision:
          explicit === undefined ? "default_included" : included ? "gm_included" : "gm_excluded",
        included,
        itemId: item.id,
        itemRevision: item.revision,
        kind: candidate.kind,
        label: candidate.template.name,
        slot: candidate.slot,
        templateId: candidate.template.id,
      } as const,
    ];
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
