import { resolveEffectiveItemTemplate } from "@glantri/domain/equipment";
import {
  applyCombatActionGeneratedModifiers,
  buildReactiveAttackPhase2InitiativeModifierEntry,
  getCombatDeclarationAttackPhases,
  getCombatDistanceParticipantAliases,
  getCombatRoundCommittedModifierReviewPhases,
  getDistanceEdgeBetweenParticipantAliases,
  getSingleAttackDeclaredDistanceForPenalty,
  getWeaponPreferredDistances,
  isDistanceGeneratedObSkillModifier,
  isParryGeneratedPercentageModifier,
  resolveCombatAttackPhaseDefensivePenalties,
  type CombatActionGeneratedDistanceModifierInput,
  type CombatRoundPhaseContexts,
  type CombatRoundState,
  type EncounterSession,
  type MovementIntent,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipant,
  type ScenarioParticipantCombatContext,
  type WeaponTemplate,
} from "@glantri/domain";
import { deriveParryPrimaryActionModifier } from "@glantri/rules-engine";

import type { EquipmentFeatureState } from "@/features/equipment/types";

type PhaseKey = "phase1" | "phase2";

function isWeaponTemplate(value: unknown): value is WeaponTemplate {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    (value as { category?: unknown }).category === "weapon" &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

function isProjectionEquipmentState(value: unknown): value is EquipmentFeatureState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.itemsById === "object" &&
    record.itemsById !== null &&
    typeof record.activeLoadoutByCharacterId === "object" &&
    record.activeLoadoutByCharacterId !== null &&
    typeof record.templates === "object" &&
    record.templates !== null
  );
}

function normalizeWeaponName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : undefined;
}

function getEquipmentStateWeaponTemplates(
  state: EquipmentFeatureState | undefined,
): WeaponTemplate[] {
  return Object.values(state?.templates.templatesById ?? {}).filter(isWeaponTemplate);
}

function getActiveWeaponTemplates(input: {
  participant?: ScenarioParticipant;
  resolvedEquipmentState?: EquipmentFeatureState;
}): WeaponTemplate[] {
  const snapshotEquipmentState = input.participant?.snapshot.equipmentState;
  const equipmentState =
    input.resolvedEquipmentState ??
    (isProjectionEquipmentState(snapshotEquipmentState) ? snapshotEquipmentState : undefined);

  if (!equipmentState) {
    return [];
  }

  const characterId =
    input.participant?.characterId ?? Object.keys(equipmentState.activeLoadoutByCharacterId)[0];
  const loadout = characterId ? equipmentState.activeLoadoutByCharacterId[characterId] : undefined;
  const activeWeaponItemIds = [
    loadout?.activePrimaryWeaponItemId,
    loadout?.activeSecondaryWeaponItemId,
    loadout?.activeMissileWeaponItemId,
  ].filter((itemId): itemId is string => Boolean(itemId));

  return activeWeaponItemIds
    .map((itemId) => {
      const item = equipmentState.itemsById[itemId];
      const template = item
        ? resolveEffectiveItemTemplate(item, equipmentState.templates.templatesById ?? {})
        : undefined;

      return isWeaponTemplate(template) ? template : undefined;
    })
    .filter((template): template is WeaponTemplate => Boolean(template));
}

function findAttackWeaponTemplate(input: {
  participant?: ScenarioParticipant;
  phaseWeaponName?: string;
  resolvedEquipmentState?: EquipmentFeatureState;
}): WeaponTemplate | undefined {
  const weaponName = normalizeWeaponName(input.phaseWeaponName);
  const candidates = [
    ...getActiveWeaponTemplates(input),
    ...getEquipmentStateWeaponTemplates(
      input.resolvedEquipmentState ??
        (isProjectionEquipmentState(input.participant?.snapshot.equipmentState)
          ? input.participant.snapshot.equipmentState
          : undefined),
    ),
  ];

  if (!weaponName) {
    return undefined;
  }

  return (
    candidates.find((template) => normalizeWeaponName(template.name) === weaponName) ??
    candidates.find((template) => {
      const templateName = normalizeWeaponName(template.name);

      return (
        Boolean(templateName) &&
        (weaponName.startsWith(`${templateName} `) || weaponName.startsWith(`${templateName}+`))
      );
    })
  );
}

function participantAliasesInclude(input: {
  id?: string;
  participant: Parameters<typeof getCombatDistanceParticipantAliases>[0];
}): boolean {
  return Boolean(
    input.id && getCombatDistanceParticipantAliases(input.participant).includes(input.id),
  );
}

function findRoundParticipantByAlias(input: {
  id?: string;
  roundState?: CombatRoundState;
}): CombatRoundState["participants"][number] | undefined {
  return input.roundState?.participants.find((participant) =>
    participantAliasesInclude({ id: input.id, participant }),
  );
}

function buildDistanceModifierInput(input: {
  actionId?: string;
  encounterParticipant?: EncounterSession["participants"][number];
  movementIntent?: MovementIntent;
  phase: PhaseKey;
  phaseContexts?: CombatRoundPhaseContexts;
  phaseWeaponName?: string;
  resolvedEquipmentState?: EquipmentFeatureState;
  roundState?: CombatRoundState;
  scenarioParticipant?: ScenarioParticipant;
}): CombatActionGeneratedDistanceModifierInput | undefined {
  const targetParticipantId = input.phaseContexts?.[input.phase]?.targetParticipantId;

  if (!input.roundState || !input.encounterParticipant || !targetParticipantId) {
    return undefined;
  }

  const targetParticipant = findRoundParticipantByAlias({
    id: targetParticipantId,
    roundState: input.roundState,
  }) ?? { participantId: targetParticipantId };
  const distanceEdge = getDistanceEdgeBetweenParticipantAliases({
    participantA: input.encounterParticipant,
    participantB: targetParticipant,
    state: input.roundState.distanceState,
  });
  const weaponTemplate = findAttackWeaponTemplate({
    participant: input.scenarioParticipant,
    phaseWeaponName: input.phaseWeaponName,
    resolvedEquipmentState: input.resolvedEquipmentState,
  });
  const preferredDistances = getWeaponPreferredDistances(weaponTemplate ?? {});

  if (!distanceEdge || preferredDistances.length === 0) {
    return undefined;
  }

  const declaredPenaltyDistance = getSingleAttackDeclaredDistanceForPenalty({
    actionId: input.actionId,
    movementIntent: input.movementIntent,
    phase: input.phase,
    preferredDistances,
    targetParticipantId,
  });

  return {
    actualDistance: declaredPenaltyDistance ?? distanceEdge.distance,
    actualDistanceBasis: declaredPenaltyDistance === undefined ? "current" : "declared_intent",
    phase: input.phase,
    preferredDistances,
    sourceActionId: input.actionId,
    weaponName: weaponTemplate?.name ?? input.phaseWeaponName,
  };
}

function getDistanceModifierPhase(entry: ScenarioCombatModifierEntry): PhaseKey | undefined {
  if (entry.sourcePhase === "phase1" || entry.sourcePhase === "phase2") {
    return entry.sourcePhase;
  }

  if (entry.id === "generated:distance:phase1:ob-skill") {
    return "phase1";
  }

  return entry.id === "generated:distance:phase2:ob-skill" ? "phase2" : undefined;
}

function getCommittedDistanceRowsToPreserve(input: {
  attackPhases: readonly PhaseKey[];
  combatContext: ScenarioParticipantCombatContext;
  dodgeSkillValue?: number;
  distanceModifiers: readonly CombatActionGeneratedDistanceModifierInput[];
  phaseContexts?: CombatRoundPhaseContexts;
  phaseWeaponNames?: Partial<Record<PhaseKey, string | undefined>>;
}): ScenarioCombatModifierEntry[] {
  const recomputedDistancePhases = new Set(
    input.distanceModifiers.map((modifier) => modifier.phase),
  );

  return input.combatContext.modifierBuckets.situationObSkill.filter((entry) => {
    if (!isDistanceGeneratedObSkillModifier(entry)) {
      return false;
    }

    const phase = getDistanceModifierPhase(entry);

    return Boolean(
      phase &&
      input.attackPhases.includes(phase) &&
      input.phaseContexts?.[phase]?.targetParticipantId &&
      !input.phaseWeaponNames?.[phase] &&
      !recomputedDistancePhases.has(phase),
    );
  });
}

function getCommittedParryRowsToPreserve(input: {
  actionId?: string;
  combatContext: ScenarioParticipantCombatContext;
  dodgeSkillValue?: number;
  roundState?: CombatRoundState;
}): ScenarioCombatModifierEntry[] {
  if (input.actionId !== "parry" || input.dodgeSkillValue !== undefined) {
    return [];
  }

  return input.combatContext.modifierBuckets.situationDb.filter(
    (entry) =>
      isParryGeneratedPercentageModifier(entry) &&
      (input.roundState === undefined ||
        entry.sourceRoundNumber === undefined ||
        entry.sourceRoundNumber === input.roundState.roundNumber),
  );
}

export function projectCombatActionGeneratedModifiers(input: {
  actionId?: string;
  combatContext: ScenarioParticipantCombatContext;
  dodgeSkillValue?: number;
  encounterParticipant?: EncounterSession["participants"][number];
  movementIntent?: MovementIntent;
  phaseContexts?: CombatRoundPhaseContexts;
  phaseWeaponNames?: Partial<Record<PhaseKey, string | undefined>>;
  resolvedEquipmentState?: EquipmentFeatureState;
  roundState?: CombatRoundState;
  scenarioParticipant?: ScenarioParticipant;
  secondaryActionId?: string;
}): ScenarioParticipantCombatContext {
  const attackPhases = getCombatDeclarationAttackPhases({
    actionId: input.actionId,
    secondaryActionId: input.secondaryActionId,
  });
  const distanceModifiers = attackPhases
    .map((phase) =>
      buildDistanceModifierInput({
        actionId: input.actionId,
        encounterParticipant: input.encounterParticipant,
        movementIntent: input.movementIntent,
        phase,
        phaseContexts: input.phaseContexts,
        phaseWeaponName: input.phaseWeaponNames?.[phase],
        resolvedEquipmentState: input.resolvedEquipmentState,
        roundState: input.roundState,
        scenarioParticipant: input.scenarioParticipant,
      }),
    )
    .filter((entry): entry is CombatActionGeneratedDistanceModifierInput => entry !== undefined);
  const committedDistanceRowsToPreserve = getCommittedDistanceRowsToPreserve({
    attackPhases,
    combatContext: input.combatContext,
    distanceModifiers,
    phaseContexts: input.phaseContexts,
    phaseWeaponNames: input.phaseWeaponNames,
  });
  const committedParryRowsToPreserve = getCommittedParryRowsToPreserve(input);
  const roundParticipantId =
    input.roundState && input.encounterParticipant
      ? (findRoundParticipantByAlias({
          id: input.encounterParticipant.id,
          roundState: input.roundState,
        })?.participantId ?? input.encounterParticipant.id)
      : undefined;
  const roundParticipant =
    input.roundState && input.encounterParticipant
      ? findRoundParticipantByAlias({
          id: input.encounterParticipant.id,
          roundState: input.roundState,
        })
      : undefined;
  const committedAttackPhaseDefensivePenalties =
    roundParticipant?.declaration !== undefined &&
    roundParticipant.declaration.actionId === input.actionId
      ? (roundParticipant.declaration.attackPhaseDefensivePenalties ??
        (roundParticipant.declaration.attackOpportunities
          ? resolveCombatAttackPhaseDefensivePenalties({
              commitment: "committed",
              opportunities: roundParticipant.declaration.attackOpportunities,
              participantId: roundParticipant.participantId,
              roundNumber: input.roundState?.roundNumber ?? 1,
            })
          : undefined))
      : undefined;
  // Option B of #901 is derived here as well as on the server, because this projection is the
  // fifth caller of the generation pass and the only one the client runs: it is the GM panel's
  // modifier set and the player page's, and the panel submits it verbatim as the modifier-review
  // body whenever there are no local edits. Without the gate the pass drops the GM's reviewed row
  // and rebuilds it at the generator's value, so the panel's own next review commit writes the
  // engine's figure back over the GM's accepted one (#915 QA finding 1). The gate needs nothing a
  // caller does not already supply — `roundState` and `encounterParticipant` are the helper's
  // whole input — so a reviewed phase is kept in both surfaces and in what they submit.
  const committedModifierReviewPhases =
    input.roundState && input.encounterParticipant
      ? getCombatRoundCommittedModifierReviewPhases({
          participantId: input.encounterParticipant.id,
          state: input.roundState,
        })
      : undefined;
  const projectedContext = applyCombatActionGeneratedModifiers({
    actionId: input.actionId,
    attackPhaseDefensivePenalties:
      committedAttackPhaseDefensivePenalties ??
      resolveCombatAttackPhaseDefensivePenalties({
        commitment: "provisional",
        opportunities: attackPhases.map((phase) => ({
          actionId: input.actionId,
          id: `provisional:${input.roundState?.roundNumber ?? 1}:${roundParticipantId ?? "participant"}:${phase}`,
          phase,
          slot: phase === "phase1" ? "attack_1" : "attack_2",
          status: "committed",
          targetParticipantId: input.phaseContexts?.[phase]?.targetParticipantId,
        })),
        participantId: roundParticipantId ?? "provisional-participant",
        roundNumber: input.roundState?.roundNumber ?? 1,
      }),
    combatContext: input.combatContext,
    committedModifierReviewPhases,
    distanceModifiers,
    initiativeModifiers:
      input.roundState && roundParticipantId
        ? [
            buildReactiveAttackPhase2InitiativeModifierEntry({
              actionId: input.actionId,
              participantId: roundParticipantId,
              state: input.roundState,
            }),
          ].filter((entry): entry is ScenarioCombatModifierEntry => Boolean(entry))
        : [],
    parryModifier:
      input.actionId === "parry" && input.dodgeSkillValue !== undefined
        ? deriveParryPrimaryActionModifier(input.dodgeSkillValue)
        : undefined,
    sourceEncounterId: input.roundState?.encounterId,
    sourceRoundNumber: input.roundState?.roundNumber,
  });

  if (committedDistanceRowsToPreserve.length === 0 && committedParryRowsToPreserve.length === 0) {
    return projectedContext;
  }

  const projectedDistanceRowIds = new Set(
    projectedContext.modifierBuckets.situationObSkill
      .filter(isDistanceGeneratedObSkillModifier)
      .map((entry) => entry.id),
  );
  const projectedParryRowIds = new Set(
    projectedContext.modifierBuckets.situationDb
      .filter(isParryGeneratedPercentageModifier)
      .map((entry) => entry.id),
  );

  return {
    ...projectedContext,
    modifierBuckets: {
      ...projectedContext.modifierBuckets,
      situationDb: [
        ...projectedContext.modifierBuckets.situationDb,
        ...committedParryRowsToPreserve.filter((entry) => !projectedParryRowIds.has(entry.id)),
      ],
      situationObSkill: [
        ...projectedContext.modifierBuckets.situationObSkill,
        ...committedDistanceRowsToPreserve.filter(
          (entry) => !projectedDistanceRowIds.has(entry.id),
        ),
      ],
    },
  };
}
