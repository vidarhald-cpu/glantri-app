import { z } from "zod";

import {
  combatEffectEventSchema,
  combatEffectSchema,
  combatEffectsStateSchema,
  type CombatEffect,
  type CombatEffectEvent,
  type CombatEffectsState,
} from "../encounter/combatEffects";
import { revealableEquipmentState } from "../equipment/itemFacts";
import {
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
  scenarioParticipantSchema,
  scenarioParticipantSnapshotSchema,
  scenarioParticipantStateSchema,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipant,
  type ScenarioParticipantCombatContext,
} from "./scenario";

/**
 * The player-facing Scenario participant, Forgejo issue #502 (privacy hardening, Tier 1).
 *
 * This is the participant a player receives about a participant they control. Every field is
 * enumerated by name below, following `scenarioPlayerVisibleParticipantSchema`, so adding a field to
 * `scenarioParticipantSchema` or to any structure enumerated here changes nothing a player can see.
 *
 * The structures that can carry GM-only or internal material are enumerated one level further
 * down and never carry it:
 *
 * - combat effects and combat-context modifier entries carry no `canonicalLifecycle` or
 *   `canonicalTransitions` (and therefore no `gmOverride` or `privateDiagnostic`). The canonical
 *   transition history is the GM correction record; the GM path keeps reading it from the stored
 *   participant;
 * - combat-effect events carry no `createdByUserId`, and the combat state carries no
 *   `declarationSubmittedByUserId` — actor identities are not player-facing, as every existing
 *   player projection already treats them;
 * - the captured equipment snapshot passes through `revealableEquipmentState`, the established
 *   sanitizer for a snapshot reaching its controlling player.
 *
 * Sub-structures that carry none of that material reuse their canonical field schemas, as the
 * precedent does for the Character build and combat context.
 *
 * The shape is the stored participant's minus those fields, so it still satisfies
 * `scenarioParticipantSchema`, which the active combat mutation response validates its updated
 * participants against. The type is branded so a stored participant is not assignable to it.
 */
const modifierEntryShape = scenarioCombatModifierEntrySchema.shape;

export const playerFacingCombatModifierEntrySchema = z.object({
  application: modifierEntryShape.application,
  combatWide: modifierEntryShape.combatWide,
  durationRounds: modifierEntryShape.durationRounds,
  excludedRollPurposes: modifierEntryShape.excludedRollPurposes,
  expiresAtRound: modifierEntryShape.expiresAtRound,
  generated: modifierEntryShape.generated,
  id: modifierEntryShape.id,
  imported: modifierEntryShape.imported,
  notes: modifierEntryShape.notes,
  readOnly: modifierEntryShape.readOnly,
  resultGroupId: modifierEntryShape.resultGroupId,
  resultGroupKind: modifierEntryShape.resultGroupKind,
  persistsAcrossEncounters: modifierEntryShape.persistsAcrossEncounters,
  scope: modifierEntryShape.scope,
  sourceActionId: modifierEntryShape.sourceActionId,
  sourceDuration: modifierEntryShape.sourceDuration,
  sourceEncounterId: modifierEntryShape.sourceEncounterId,
  sourceEffectId: modifierEntryShape.sourceEffectId,
  sourceOpportunityId: modifierEntryShape.sourceOpportunityId,
  sourcePhase: modifierEntryShape.sourcePhase,
  sourceProcessId: modifierEntryShape.sourceProcessId,
  sourceProposalId: modifierEntryShape.sourceProposalId,
  sourceRoundNumber: modifierEntryShape.sourceRoundNumber,
  sourceRule: modifierEntryShape.sourceRule,
  sourceType: modifierEntryShape.sourceType,
  provisional: modifierEntryShape.provisional,
  value: modifierEntryShape.value,
});
export type PlayerFacingCombatModifierEntry = z.infer<typeof playerFacingCombatModifierEntrySchema>;

const combatContextShape = scenarioParticipantCombatContextSchema.shape;

export const playerFacingCombatContextSchema = z.object({
  attackModeId: combatContextShape.attackModeId,
  incomingAttackSide: combatContextShape.incomingAttackSide,
  mainHandParryDirection: combatContextShape.mainHandParryDirection,
  modifierBuckets: z.object({
    general: z.array(playerFacingCombatModifierEntrySchema),
    situationDb: z.array(playerFacingCombatModifierEntrySchema),
    situationInitiative: z.array(playerFacingCombatModifierEntrySchema),
    situationObSkill: z.array(playerFacingCombatModifierEntrySchema),
  }),
  offHandParryDirection: combatContextShape.offHandParryDirection,
  parrySource: combatContextShape.parrySource,
  selectedOpponentId: combatContextShape.selectedOpponentId,
  targetLocation: combatContextShape.targetLocation,
  targetParticipantId: combatContextShape.targetParticipantId,
});
export type PlayerFacingCombatContext = z.infer<typeof playerFacingCombatContextSchema>;

const combatEffectShape = combatEffectSchema.innerType().shape;

export const playerFacingCombatEffectSchema = z.object({
  checkRequired: combatEffectShape.checkRequired,
  checkSkillOrStat: combatEffectShape.checkSkillOrStat,
  combatWide: combatEffectShape.combatWide,
  criticalRuntime: combatEffectShape.criticalRuntime,
  combatModifierBucket: combatEffectShape.combatModifierBucket,
  createdInInitiativeGroupId: combatEffectShape.createdInInitiativeGroupId,
  createdAt: combatEffectShape.createdAt,
  damage: combatEffectShape.damage,
  description: combatEffectShape.description,
  duration: combatEffectShape.duration,
  excludedRollPurposes: combatEffectShape.excludedRollPurposes,
  effectGroup: combatEffectShape.effectGroup,
  effectiveAfterInitiativeGroupId: combatEffectShape.effectiveAfterInitiativeGroupId,
  expiresAtRound: combatEffectShape.expiresAtRound,
  generalDamage: combatEffectShape.generalDamage,
  id: combatEffectShape.id,
  initiativePhase: combatEffectShape.initiativePhase,
  initiativeValue: combatEffectShape.initiativeValue,
  location: combatEffectShape.location,
  modifierValue: combatEffectShape.modifierValue,
  bleedState: combatEffectShape.bleedState,
  roundNumber: combatEffectShape.roundNumber,
  sourceAttackResultId: combatEffectShape.sourceAttackResultId,
  sourceEventId: combatEffectShape.sourceEventId,
  sourceOpportunityId: combatEffectShape.sourceOpportunityId,
  status: combatEffectShape.status,
  targetParticipantId: combatEffectShape.targetParticipantId,
  type: combatEffectShape.type,
  updatedAt: combatEffectShape.updatedAt,
});
export type PlayerFacingCombatEffect = z.infer<typeof playerFacingCombatEffectSchema>;

const combatEffectEventShape = combatEffectEventSchema.shape;

export const playerFacingCombatEffectEventSchema = z.object({
  createdAt: combatEffectEventShape.createdAt,
  description: combatEffectEventShape.description,
  encounterId: combatEffectEventShape.encounterId,
  id: combatEffectEventShape.id,
  phase: combatEffectEventShape.phase,
  roundNumber: combatEffectEventShape.roundNumber,
  scenarioId: combatEffectEventShape.scenarioId,
  sourceActorId: combatEffectEventShape.sourceActorId,
  sourceLabel: combatEffectEventShape.sourceLabel,
  sourceType: combatEffectEventShape.sourceType,
  targetParticipantId: combatEffectEventShape.targetParticipantId,
});
export type PlayerFacingCombatEffectEvent = z.infer<typeof playerFacingCombatEffectEventSchema>;

export const playerFacingCombatEffectsStateSchema = z.object({
  criticalBleedAccumulator: combatEffectsStateSchema.removeDefault().shape.criticalBleedAccumulator,
  effects: z.array(playerFacingCombatEffectSchema),
  events: z.array(playerFacingCombatEffectEventSchema),
});
export type PlayerFacingCombatEffectsState = z.infer<typeof playerFacingCombatEffectsStateSchema>;

const participantStateShape = scenarioParticipantStateSchema.shape;
const participantCombatShape = participantStateShape.combat.shape;

export const playerFacingScenarioParticipantStateSchema = z.object({
  combat: z.object({
    combatContext: playerFacingCombatContextSchema,
    currentDistanceBand: participantCombatShape.currentDistanceBand,
    declarationSubmittedAt: participantCombatShape.declarationSubmittedAt,
    engaged: participantCombatShape.engaged,
    initiativeRoll: participantCombatShape.initiativeRoll,
    lastDeclaredActionId: participantCombatShape.lastDeclaredActionId,
    lastDeclaredEncounterId: participantCombatShape.lastDeclaredEncounterId,
    lastDeclaredMovementId: participantCombatShape.lastDeclaredMovementId,
    lastDeclaredRoundNumber: participantCombatShape.lastDeclaredRoundNumber,
    lastDeclaredSecondaryActionId: participantCombatShape.lastDeclaredSecondaryActionId,
    lastDeclarationNotes: participantCombatShape.lastDeclarationNotes,
    lastDeclarationIntent: participantCombatShape.lastDeclarationIntent,
    lastMovementIntent: participantCombatShape.lastMovementIntent,
    stance: participantCombatShape.stance,
  }),
  combatEffects: playerFacingCombatEffectsStateSchema.optional(),
  conditions: participantStateShape.conditions,
  equipment: participantStateShape.equipment,
  health: participantStateShape.health,
  modifiers: participantStateShape.modifiers,
  resources: participantStateShape.resources,
  snapshotVersion: participantStateShape.snapshotVersion,
});
export type PlayerFacingScenarioParticipantState = z.infer<
  typeof playerFacingScenarioParticipantStateSchema
>;

const snapshotShape = scenarioParticipantSnapshotSchema.shape;

export const playerFacingScenarioParticipantSnapshotSchema = z.object({
  build: snapshotShape.build,
  displayName: snapshotShape.displayName,
  equipmentProjection: snapshotShape.equipmentProjection,
  entity: snapshotShape.entity,
  equipmentState: snapshotShape.equipmentState,
  retainedCharacterRevision: snapshotShape.retainedCharacterRevision,
  sheetSummary: snapshotShape.sheetSummary,
  sourceUpdatedAt: snapshotShape.sourceUpdatedAt,
});

const participantShape = scenarioParticipantSchema.shape;

export const playerFacingScenarioParticipantSchema = z
  .object({
    characterId: participantShape.characterId,
    controlledByUserId: participantShape.controlledByUserId,
    createdAt: participantShape.createdAt,
    displayOrder: participantShape.displayOrder,
    entityId: participantShape.entityId,
    factionId: participantShape.factionId,
    id: participantShape.id,
    initiativeSlot: participantShape.initiativeSlot,
    isActive: participantShape.isActive,
    joinSource: participantShape.joinSource,
    position: participantShape.position,
    role: participantShape.role,
    roleTag: participantShape.roleTag,
    scenarioId: participantShape.scenarioId,
    snapshot: playerFacingScenarioParticipantSnapshotSchema,
    sourceType: participantShape.sourceType,
    state: playerFacingScenarioParticipantStateSchema,
    tacticalGroupId: participantShape.tacticalGroupId,
    updatedAt: participantShape.updatedAt,
    visibilityOverrides: participantShape.visibilityOverrides,
  })
  .brand<"PlayerFacingScenarioParticipant">();
export type PlayerFacingScenarioParticipant = z.infer<typeof playerFacingScenarioParticipantSchema>;

function buildPlayerFacingCombatModifierEntry(
  entry: ScenarioCombatModifierEntry,
): PlayerFacingCombatModifierEntry {
  return {
    application: entry.application,
    combatWide: entry.combatWide,
    durationRounds: entry.durationRounds,
    excludedRollPurposes: entry.excludedRollPurposes,
    expiresAtRound: entry.expiresAtRound,
    generated: entry.generated,
    id: entry.id,
    imported: entry.imported,
    notes: entry.notes,
    readOnly: entry.readOnly,
    resultGroupId: entry.resultGroupId,
    resultGroupKind: entry.resultGroupKind,
    persistsAcrossEncounters: entry.persistsAcrossEncounters,
    scope: entry.scope,
    sourceActionId: entry.sourceActionId,
    sourceDuration: entry.sourceDuration,
    sourceEncounterId: entry.sourceEncounterId,
    sourceEffectId: entry.sourceEffectId,
    sourceOpportunityId: entry.sourceOpportunityId,
    sourcePhase: entry.sourcePhase,
    sourceProcessId: entry.sourceProcessId,
    sourceProposalId: entry.sourceProposalId,
    sourceRoundNumber: entry.sourceRoundNumber,
    sourceRule: entry.sourceRule,
    sourceType: entry.sourceType,
    provisional: entry.provisional,
    value: entry.value,
  };
}

/** Builds a player combat context from named fields; modifier entries lose their lifecycle. */
export function buildPlayerFacingCombatContext(
  context: ScenarioParticipantCombatContext,
): PlayerFacingCombatContext {
  return playerFacingCombatContextSchema.parse({
    attackModeId: context.attackModeId,
    incomingAttackSide: context.incomingAttackSide,
    mainHandParryDirection: context.mainHandParryDirection,
    modifierBuckets: {
      general: context.modifierBuckets.general.map(buildPlayerFacingCombatModifierEntry),
      situationDb: context.modifierBuckets.situationDb.map(buildPlayerFacingCombatModifierEntry),
      situationInitiative: context.modifierBuckets.situationInitiative.map(
        buildPlayerFacingCombatModifierEntry,
      ),
      situationObSkill: context.modifierBuckets.situationObSkill.map(
        buildPlayerFacingCombatModifierEntry,
      ),
    },
    offHandParryDirection: context.offHandParryDirection,
    parrySource: context.parrySource,
    selectedOpponentId: context.selectedOpponentId,
    targetLocation: context.targetLocation,
    targetParticipantId: context.targetParticipantId,
  });
}

function buildPlayerFacingCombatEffect(effect: CombatEffect): PlayerFacingCombatEffect {
  return {
    checkRequired: effect.checkRequired,
    checkSkillOrStat: effect.checkSkillOrStat,
    combatWide: effect.combatWide,
    criticalRuntime: effect.criticalRuntime,
    combatModifierBucket: effect.combatModifierBucket,
    createdInInitiativeGroupId: effect.createdInInitiativeGroupId,
    createdAt: effect.createdAt,
    damage: effect.damage,
    description: effect.description,
    duration: effect.duration,
    excludedRollPurposes: effect.excludedRollPurposes,
    effectGroup: effect.effectGroup,
    effectiveAfterInitiativeGroupId: effect.effectiveAfterInitiativeGroupId,
    expiresAtRound: effect.expiresAtRound,
    generalDamage: effect.generalDamage,
    id: effect.id,
    initiativePhase: effect.initiativePhase,
    initiativeValue: effect.initiativeValue,
    location: effect.location,
    modifierValue: effect.modifierValue,
    bleedState: effect.bleedState,
    roundNumber: effect.roundNumber,
    sourceAttackResultId: effect.sourceAttackResultId,
    sourceEventId: effect.sourceEventId,
    sourceOpportunityId: effect.sourceOpportunityId,
    status: effect.status,
    targetParticipantId: effect.targetParticipantId,
    type: effect.type,
    updatedAt: effect.updatedAt,
  };
}

function buildPlayerFacingCombatEffectEvent(
  event: CombatEffectEvent,
): PlayerFacingCombatEffectEvent {
  return {
    createdAt: event.createdAt,
    description: event.description,
    encounterId: event.encounterId,
    id: event.id,
    phase: event.phase,
    roundNumber: event.roundNumber,
    scenarioId: event.scenarioId,
    sourceActorId: event.sourceActorId,
    sourceLabel: event.sourceLabel,
    sourceType: event.sourceType,
    targetParticipantId: event.targetParticipantId,
  };
}

function buildPlayerFacingCombatEffectsState(
  state: CombatEffectsState,
): PlayerFacingCombatEffectsState {
  return {
    criticalBleedAccumulator: state.criticalBleedAccumulator,
    effects: state.effects.map(buildPlayerFacingCombatEffect),
    events: state.events.map(buildPlayerFacingCombatEffectEvent),
  };
}

/**
 * The additive projection of a participant for the player who controls it. Callers decide that
 * the viewer controls the participant; this function decides what such a viewer sees.
 */
export function buildPlayerFacingScenarioParticipant(
  participant: ScenarioParticipant,
): PlayerFacingScenarioParticipant {
  const { combat } = participant.state;

  return playerFacingScenarioParticipantSchema.parse({
    characterId: participant.characterId,
    controlledByUserId: participant.controlledByUserId,
    createdAt: participant.createdAt,
    displayOrder: participant.displayOrder,
    entityId: participant.entityId,
    factionId: participant.factionId,
    id: participant.id,
    initiativeSlot: participant.initiativeSlot,
    isActive: participant.isActive,
    joinSource: participant.joinSource,
    position: participant.position,
    role: participant.role,
    roleTag: participant.roleTag,
    scenarioId: participant.scenarioId,
    snapshot: {
      build: participant.snapshot.build,
      displayName: participant.snapshot.displayName,
      equipmentProjection: participant.snapshot.equipmentProjection,
      entity: participant.snapshot.entity,
      equipmentState: revealableEquipmentState(participant.snapshot.equipmentState),
      retainedCharacterRevision: participant.snapshot.retainedCharacterRevision,
      sheetSummary: participant.snapshot.sheetSummary,
      sourceUpdatedAt: participant.snapshot.sourceUpdatedAt,
    },
    sourceType: participant.sourceType,
    state: {
      combat: {
        combatContext: buildPlayerFacingCombatContext(
          scenarioParticipantCombatContextSchema.parse(combat.combatContext ?? {}),
        ),
        currentDistanceBand: combat.currentDistanceBand,
        declarationSubmittedAt: combat.declarationSubmittedAt,
        engaged: combat.engaged,
        initiativeRoll: combat.initiativeRoll,
        lastDeclaredActionId: combat.lastDeclaredActionId,
        lastDeclaredEncounterId: combat.lastDeclaredEncounterId,
        lastDeclaredMovementId: combat.lastDeclaredMovementId,
        lastDeclaredRoundNumber: combat.lastDeclaredRoundNumber,
        lastDeclaredSecondaryActionId: combat.lastDeclaredSecondaryActionId,
        lastDeclarationNotes: combat.lastDeclarationNotes,
        lastDeclarationIntent: combat.lastDeclarationIntent,
        lastMovementIntent: combat.lastMovementIntent,
        stance: combat.stance,
      },
      combatEffects: participant.state.combatEffects
        ? buildPlayerFacingCombatEffectsState(participant.state.combatEffects)
        : undefined,
      conditions: participant.state.conditions,
      equipment: participant.state.equipment,
      health: participant.state.health,
      modifiers: participant.state.modifiers,
      resources: participant.state.resources,
      snapshotVersion: participant.state.snapshotVersion,
    },
    tacticalGroupId: participant.tacticalGroupId,
    updatedAt: participant.updatedAt,
    visibilityOverrides: participant.visibilityOverrides,
  });
}
