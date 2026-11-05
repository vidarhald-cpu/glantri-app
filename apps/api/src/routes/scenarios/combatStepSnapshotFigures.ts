import {
  buildLiveCombatModifierContributionProjection,
  getDistanceEdgeBetweenParticipantAliases,
  resolveCombatModifierContributions,
  resolveEffectiveItemTemplate,
  type CombatRoundAttackOpportunity,
  type CombatRoundPhase,
  type CombatRoundState,
  type CombatRoundStep,
  type EncounterSession,
  type ScenarioParticipant,
  type WeaponAttackMode,
  type WeaponTemplate,
  type CombatStepSnapshotParticipantFigures,
  type CombatStepSnapshotPhaseFigures,
} from "@glantri/domain";

import { resolveCanonicalScenarioParticipantDefense } from "./combatDefenseResolution";
import {
  resolveCanonicalAttackOffense,
  resolveCanonicalParryBase,
} from "./combatManualCalculationResolution";
import { resolveCanonicalParticipantCalculationContext } from "./combatParticipantCalculationResolution";

/**
 * #951 — the loadout-derived half of a server-derived step snapshot.
 *
 * Everything here is read from the participant's own canonical equipment aggregate through the
 * same adapters live resolution already uses, never from a client presentation payload. A fact
 * the aggregate does not carry is omitted; nothing is defaulted, because a published figure
 * nobody authored is the error class #665's ruling forbade.
 */

function toStat(value: number | undefined): string | undefined {
  return value === undefined || !Number.isFinite(value) ? undefined : String(value);
}

function findPhaseOpportunity(input: {
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
}): CombatRoundAttackOpportunity | undefined {
  const participant = input.state.participants.find(
    (candidate) => candidate.participantId === input.participantId,
  );
  return participant?.declaration?.attackOpportunities?.find(
    (opportunity) => opportunity.phase === input.phase && opportunity.status !== "cancelled",
  );
}

function resolveOpportunityWeapon(input: {
  opportunity: CombatRoundAttackOpportunity;
  participant: ScenarioParticipant;
}): { mode?: WeaponAttackMode; template?: WeaponTemplate } {
  const context = resolveCanonicalParticipantCalculationContext(input.participant);
  if (context.completeness !== "complete" || !input.opportunity.weaponTemplateId) return {};
  const item = input.opportunity.weaponInstanceId
    ? context.itemsById.get(input.opportunity.weaponInstanceId)
    : input.opportunity.weaponSourceId
      ? context.itemsById.get(input.opportunity.weaponSourceId)
      : undefined;
  const resolved = item
    ? resolveEffectiveItemTemplate(item, Object.fromEntries(context.templatesById))
    : context.templatesById.get(input.opportunity.weaponTemplateId);
  const template = resolved && "attackModes" in resolved ? (resolved as WeaponTemplate) : undefined;
  if (!template) return {};
  const modes = template.attackModes ?? [];
  const mode = input.opportunity.attackModeId
    ? modes.find((candidate) => candidate.id === input.opportunity.attackModeId)
    : modes[0];

  return { mode: mode ?? undefined, template };
}

function resolvePhaseModifierResolutions(input: {
  encounterId?: string;
  participant: ScenarioParticipant;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  step: CombatRoundStep;
}) {
  const projection = buildLiveCombatModifierContributionProjection({
    combatContext: input.participant.state.combat.combatContext,
    combatEffects: input.participant.state.combatEffects,
    currentRound: input.state.roundNumber,
    encounterId: input.encounterId,
    ownerParticipantId: input.participant.id,
  });
  const context = {
    encounterId: input.encounterId,
    ownerParticipantId: input.participant.id,
    phase: input.phase,
    roundNumber: input.state.roundNumber,
    step: input.step,
  };

  return {
    dbParry: resolveCombatModifierContributions({
      bucket: "db_parry",
      context,
      contributions: projection.contributions,
    }),
    initiative: resolveCombatModifierContributions({
      bucket: "initiative",
      context,
      contributions: projection.contributions,
    }),
    skillOb: resolveCombatModifierContributions({
      bucket: "skill_ob",
      context,
      contributions: projection.contributions,
    }),
  };
}

function resolveDistanceLabel(input: {
  phase: CombatRoundPhase;
  participantId: string;
  state: CombatRoundState;
}): string | undefined {
  const participant = input.state.participants.find(
    (candidate) => candidate.participantId === input.participantId,
  );
  const targetParticipantId =
    participant?.declaration?.phaseContexts?.[input.phase]?.targetParticipantId;
  if (!targetParticipantId) return undefined;
  const targetRoundParticipant = input.state.participants.find(
    (candidate) => candidate.participantId === targetParticipantId,
  );
  const edge = getDistanceEdgeBetweenParticipantAliases({
    participantA: participant,
    participantB: targetRoundParticipant ?? { id: targetParticipantId },
    state: input.state.distanceState,
  });

  return `Distance: ${edge?.distance ?? "\u2014"}`;
}

function resolvePhaseFigures(input: {
  encounter: EncounterSession;
  participant: ScenarioParticipant;
  participantId: string;
  phase: CombatRoundPhase;
  state: CombatRoundState;
  step: CombatRoundStep;
  targetOptions: { displayName: string; id: string }[];
}): CombatStepSnapshotPhaseFigures {
  const resolutions = resolvePhaseModifierResolutions({
    encounterId: input.encounter.id,
    participant: input.participant,
    phase: input.phase,
    state: input.state,
    step: input.step,
  });
  const flatDbTotal = (
    input.participant.state.combat.combatContext?.modifierBuckets.situationDb ?? []
  )
    .filter((entry) => entry.application === "flat_db")
    .reduce((total, entry) => total + entry.value, 0);
  const defense = resolveCanonicalScenarioParticipantDefense({
    defenderResolution: resolutions.dbParry,
    flatDbResolution: { bucket: "db_parry", rows: [], total: flatDbTotal },
    participant: input.participant,
  });
  const parry = resolveCanonicalParryBase({ participant: input.participant });
  const context = resolveCanonicalParticipantCalculationContext(input.participant);
  const mainHandParryItemLabel =
    context.completeness === "complete"
      ? (context.primaryWeaponTemplate?.name ?? undefined)
      : undefined;
  const offHandParryItemLabel =
    context.completeness === "complete"
      ? (context.readyShieldTemplate?.name ?? context.secondaryWeaponTemplate?.name ?? undefined)
      : undefined;
  const opportunity = findPhaseOpportunity({
    participantId: input.participantId,
    phase: input.phase,
    state: input.state,
  });
  const weapon = opportunity
    ? resolveOpportunityWeapon({ opportunity, participant: input.participant })
    : {};
  const offense = opportunity
    ? resolveCanonicalAttackOffense({
        attackerResolution: resolutions.skillOb,
        opponentResolution: { bucket: "skill_ob", rows: [], total: 0 },
        opportunity,
        participant: input.participant,
      })
    : undefined;
  const attackMode = weapon.mode?.armorModifier ?? undefined;
  const ob = offense?.completeness === "complete" ? toStat(offense.preOpponentOb) : undefined;
  const dmb = toStat(weapon.mode?.dmb ?? undefined);
  const attackSummary =
    weapon.template && (ob || dmb)
      ? {
          attackMode: attackMode ?? "—",
          dmb: dmb ?? "—",
          initiative: toStat((weapon.mode?.initiative ?? 0) + resolutions.initiative.total) ?? "—",
          maxCrits: weapon.mode?.secondCrit ? "2" : "1",
          ob: ob ?? "—",
          weaponName: weapon.template.name,
        }
      : undefined;
  const defenseSummary =
    defense.completeness === "complete"
      ? {
          db: String(defense.effectiveDb),
          dm: String(defense.effectiveDm),
          parry:
            parry.completeness === "complete" ? String(parry.combinedParryScore) : "incomplete",
          sourceName:
            parry.completeness === "complete"
              ? parry.parrySourceLabel
              : (mainHandParryItemLabel ?? "Unarmed"),
        }
      : undefined;

  return {
    attackModeLabel: weapon.mode?.label ?? weapon.mode?.id,
    attackSummary,
    defenseSummary,
    distanceLabel: resolveDistanceLabel({
      participantId: input.participantId,
      phase: input.phase,
      state: input.state,
    }),
    mainHandParryItemLabel,
    offHandParryItemLabel,
    targetOptions: input.targetOptions,
  };
}

/**
 * Builds the per-participant loadout figures provider the domain step-snapshot deriver calls.
 *
 * `scenarioParticipants` is the roster the commit was authorized against, so the figures and the
 * commit are read from one state.
 */
export function buildCombatStepSnapshotFiguresResolver(input: {
  encounter: EncounterSession;
  scenarioParticipants: readonly ScenarioParticipant[];
}): (figuresInput: {
  participantId: string;
  state: CombatRoundState;
  step: CombatRoundStep;
}) => CombatStepSnapshotParticipantFigures | undefined {
  const scenarioParticipantByAlias = new Map<string, ScenarioParticipant>();
  for (const participant of input.scenarioParticipants) {
    scenarioParticipantByAlias.set(participant.id, participant);
    if (participant.characterId) {
      scenarioParticipantByAlias.set(participant.characterId, participant);
    }
  }
  for (const encounterParticipant of input.encounter.participants ?? []) {
    const scenarioParticipant = encounterParticipant.scenarioParticipantId
      ? scenarioParticipantByAlias.get(encounterParticipant.scenarioParticipantId)
      : undefined;
    if (scenarioParticipant) {
      scenarioParticipantByAlias.set(encounterParticipant.id, scenarioParticipant);
    }
  }
  const targetOptions = (input.encounter.participants ?? []).map((participant) => ({
    displayName:
      scenarioParticipantByAlias.get(participant.id)?.snapshot.displayName ?? participant.label,
    id: participant.id,
  }));

  return (figuresInput) => {
    const participant = scenarioParticipantByAlias.get(figuresInput.participantId);
    if (!participant) return undefined;
    const selectableTargets = targetOptions.filter(
      (option) => option.id !== figuresInput.participantId,
    );
    const forPhase = (phase: CombatRoundPhase) =>
      resolvePhaseFigures({
        encounter: input.encounter,
        participant,
        participantId: figuresInput.participantId,
        phase,
        state: figuresInput.state,
        step: figuresInput.step,
        targetOptions: selectableTargets,
      });

    return { phase1: forPhase("phase1"), phase2: forPhase("phase2") };
  };
}

/**
 * The canonical participant sources the domain deriver reads modifier rows from, keyed by the
 * round participant id the snapshot is written under.
 */
export function buildCombatStepSnapshotSources(input: {
  encounter: EncounterSession;
  scenarioParticipants: readonly ScenarioParticipant[];
  state: CombatRoundState;
}): Record<
  string,
  {
    combatContext?: ScenarioParticipant["state"]["combat"]["combatContext"];
    combatEffects?: ScenarioParticipant["state"]["combatEffects"];
    scenarioParticipantId?: string;
  }
> {
  const byAlias = new Map<string, ScenarioParticipant>();
  for (const participant of input.scenarioParticipants) {
    byAlias.set(participant.id, participant);
    if (participant.characterId) byAlias.set(participant.characterId, participant);
  }
  for (const encounterParticipant of input.encounter.participants ?? []) {
    const scenarioParticipant = encounterParticipant.scenarioParticipantId
      ? byAlias.get(encounterParticipant.scenarioParticipantId)
      : undefined;
    if (scenarioParticipant) byAlias.set(encounterParticipant.id, scenarioParticipant);
  }

  return Object.fromEntries(
    input.state.participants.map((roundParticipant) => {
      const participant = byAlias.get(roundParticipant.participantId);
      return [
        roundParticipant.participantId,
        {
          combatContext: participant?.state.combat.combatContext,
          combatEffects: participant?.state.combatEffects,
          scenarioParticipantId: participant?.id,
        },
      ];
    }),
  );
}
