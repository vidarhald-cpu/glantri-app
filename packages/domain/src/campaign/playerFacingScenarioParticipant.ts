import { z } from "zod";

import {
  combatEffectEventSchema,
  combatEffectSchema,
  combatEffectsStateSchema,
  type CombatEffect,
  type CombatEffectEvent,
  type CombatEffectsState,
} from "../encounter/combatEffects";
import { buildPlayerFacing, LEAF, playerFacingObject } from "../encounter/playerFacingSchema";
import { revealableEquipmentState } from "../equipment/itemFacts";
import { armorComponentKey } from "../equipment/itemOverrides";
import { canonicalizeLegacyEquipmentSnapshotItems } from "../equipment/schemas";
import type { ArmorComponentProfile } from "../equipment/types";
import {
  scenarioCombatModifierEntrySchema,
  scenarioParticipantCombatContextSchema,
  scenarioParticipantSchema,
  scenarioParticipantSnapshotSchema,
  scenarioParticipantStateSchema,
  type ScenarioCombatModifierEntry,
  type ScenarioParticipant,
  type ScenarioParticipantCombatContext,
  type ScenarioParticipantState,
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
 *   sanitizer for a snapshot reaching its controlling player, after its legacy items are given the
 *   facts and notes their `specialProperties` became on the canonical item
 *   (`canonicalizeLegacyEquipmentSnapshotItems`). Legacy information the canonical item reveals to
 *   its holder is therefore kept; only what is not revealed is removed. Its import records are
 *   then removed as well (`withoutWorkbookImportProvenance`, #517 ruling E2), and an armor
 *   component a revealed override targets keeps its identity
 *   (`withArmorComponentIdentityOnlyWhereRevealed`).
 *
 * Sub-structures that carry none of that material reuse their canonical field schemas, as the
 * precedent does for the Character build and combat context.
 *
 * The shape is the stored participant's minus those fields, so it still satisfies
 * `scenarioParticipantSchema`, which the active combat mutation response validates its updated
 * participants against. The type is branded so a stored participant is not assignable to it.
 */
/**
 * A combat-context modifier entry and the combat context as a player receives them. Both are built
 * with the Tier 3 construction kit (#517, `playerFacingSchema.ts`) because the round state carries
 * them in declarations: every field is a leaf reused from the canonical schema or a player-facing
 * schema, so a field added to the canonical entry or context reaches no player.
 */
export const playerFacingCombatModifierEntrySchema = playerFacingObject(
  "PlayerFacingCombatModifierEntry",
  scenarioCombatModifierEntrySchema,
  {
    application: LEAF,
    combatWide: LEAF,
    durationRounds: LEAF,
    excludedRollPurposes: LEAF,
    expiresAtRound: LEAF,
    generated: LEAF,
    id: LEAF,
    imported: LEAF,
    notes: LEAF,
    readOnly: LEAF,
    resultGroupId: LEAF,
    resultGroupKind: LEAF,
    persistsAcrossEncounters: LEAF,
    scope: LEAF,
    sourceActionId: LEAF,
    sourceDuration: LEAF,
    sourceEncounterId: LEAF,
    sourceEffectId: LEAF,
    sourceOpportunityId: LEAF,
    sourcePhase: LEAF,
    sourceProcessId: LEAF,
    sourceProposalId: LEAF,
    sourceRoundNumber: LEAF,
    sourceRule: LEAF,
    sourceType: LEAF,
    provisional: LEAF,
    value: LEAF,
  },
);
export type PlayerFacingCombatModifierEntry = z.infer<typeof playerFacingCombatModifierEntrySchema>;

const combatContextShape = scenarioParticipantCombatContextSchema.shape;

const playerFacingCombatModifierBucketsSchema = playerFacingObject(
  "PlayerFacingCombatModifierBuckets",
  combatContextShape.modifierBuckets.removeDefault(),
  {
    general: z.array(playerFacingCombatModifierEntrySchema),
    situationDb: z.array(playerFacingCombatModifierEntrySchema),
    situationInitiative: z.array(playerFacingCombatModifierEntrySchema),
    situationObSkill: z.array(playerFacingCombatModifierEntrySchema),
  },
);

export const playerFacingCombatContextSchema = playerFacingObject(
  "PlayerFacingCombatContext",
  scenarioParticipantCombatContextSchema,
  {
    attackModeId: LEAF,
    incomingAttackSide: LEAF,
    mainHandParryDirection: LEAF,
    modifierBuckets: playerFacingCombatModifierBucketsSchema,
    offHandParryDirection: LEAF,
    parrySource: LEAF,
    selectedOpponentId: LEAF,
    targetLocation: LEAF,
    targetParticipantId: LEAF,
  },
);
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

/** Builds a player combat context from named fields; modifier entries lose their lifecycle. */
export function buildPlayerFacingCombatContext(
  context: ScenarioParticipantCombatContext,
): PlayerFacingCombatContext {
  return buildPlayerFacing(playerFacingCombatContextSchema, context);
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
 * Whether a field holds an import record (`Imported…SourceMetadata`), by name. The fields that hold
 * one today are all named `sourceMetadata` or end in `SourceMetadata`: `sourceMetadata` on weapon
 * templates and attack modes (`ImportedWeaponSourceMetadata`) and on armor templates and component
 * profiles (`ImportedArmorSourceMetadata`), a shield template's `offensiveSourceMetadata` and
 * `defensiveSourceMetadata` (`ImportedShieldSourceMetadata`), and a round-state attack's
 * `weaponModeSourceMetadata`. Tests pin exactly those carriers. A field named otherwise is not
 * matched: no test proves that every future provenance field will be named this way.
 *
 * Import provenance in other forms is handled where it is carried, not here: the missile
 * `weaponDmbRoll` (`ATTACK_RESULT_WORKBOOK_IMPORT_PROVENANCE_FIELDS`) and an armor component's
 * identity (`withArmorComponentIdentityOnlyWhereRevealed`).
 */
function isWorkbookImportProvenanceKey(key: string): boolean {
  return key === "sourceMetadata" || key.endsWith("SourceMetadata");
}

/**
 * A captured equipment snapshot without its import records, which are not player-facing (#517,
 * ruling E2): every field `isWorkbookImportProvenanceKey` names is removed, at any depth. Nothing
 * else is — a mode's `provenance` kind (`imported`, `manual` or `derived`) is kept, as are
 * rules-source citations and authored notes (ruling E2, Decision 3).
 */
export function withoutWorkbookImportProvenance(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(withoutWorkbookImportProvenance);
  }
  if (!value || typeof value !== "object") {
    return value;
  }
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      isWorkbookImportProvenanceKey(key) ? [] : [[key, withoutWorkbookImportProvenance(entry)]],
    ),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * The armor component identities (`componentKey`) the overrides in an equipment snapshot target,
 * counting only overrides revealed to the holder.
 */
function revealedArmorComponentKeys(equipmentState: unknown): ReadonlySet<string> {
  const items = isRecord(equipmentState) ? equipmentState.itemsById : undefined;
  if (!isRecord(items)) return new Set();
  return new Set(
    Object.values(items).flatMap((item) =>
      isRecord(item) && Array.isArray(item.mechanicalOverrides)
        ? item.mechanicalOverrides.flatMap((entry) =>
            isRecord(entry) &&
            entry.kind === "armor" &&
            entry.visibility === "revealed" &&
            typeof entry.componentKey === "string"
              ? [entry.componentKey]
              : [],
          )
        : [],
    ),
  );
}

/**
 * An equipment snapshot in which an armor template's component profile carries its identity
 * (`componentKey`, from `armorComponentKey`) exactly when an override revealed to the holder targets
 * it, and otherwise not at all (#517 F-A, rulings 2026-10-07).
 *
 * `withoutWorkbookImportProvenance` removes a component's `sourceMetadata`, which its identity is
 * derived from, so without this a revealed override would no longer find its component and the
 * effective template would not resolve. The identity is the same string the GM resolves and the
 * override stores: no stored key changes and no second key space exists. It is an opaque identifier
 * the player's override needs, not a source to show the player. Every other component carries
 * none, so the player receives no identity string that its revealed overrides do not already carry.
 */
function withArmorComponentIdentityOnlyWhereRevealed(equipmentState: unknown): unknown {
  const revealed = revealedArmorComponentKeys(equipmentState);
  const visit = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(visit);
    if (!isRecord(value)) return value;
    const record = Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, visit(entry)]),
    );
    if (record.category !== "armor" || !Array.isArray(record.componentProfiles)) return record;
    return {
      ...record,
      componentProfiles: record.componentProfiles.map((component: unknown) => {
        if (!isRecord(component)) return component;
        const identity = armorComponentKey(component as unknown as ArmorComponentProfile);
        const { componentKey: _carriedIdentity, ...profile } = component;
        return revealed.has(identity) ? { ...profile, componentKey: identity } : profile;
      }),
    };
  };
  return visit(equipmentState);
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
      equipmentState: withoutWorkbookImportProvenance(
        withArmorComponentIdentityOnlyWhereRevealed(
          revealableEquipmentState(
            canonicalizeLegacyEquipmentSnapshotItems(participant.snapshot.equipmentState),
          ),
        ),
      ),
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

const NO_COMBAT_EFFECTS = { effects: [], events: [] };

type ModifierBucketKey = keyof ScenarioParticipantCombatContext["modifierBuckets"];

/**
 * The state to store when the player who controls a participant saves its state back through
 * `PUT /scenarios/:scenarioId/participants/:participantId/state` (#502 Tier 1 repair).
 *
 * Players used to receive the stored state, so saving back what they received changed nothing. They
 * now receive the state `buildPlayerFacingScenarioParticipant` builds, which omits what only the GM
 * sees. Saving that back must stay valid and must not erase what it omits:
 *
 * - combat effects stay the GM's to edit. Effects equal to the stored ones (the state players used to
 *   receive) or to their player-facing projection (the state players receive now) keep the stored
 *   effects; any other effects are an edit, and the result is `undefined`, which the route refuses as
 *   it always has;
 * - a submitted modifier entry without `canonicalLifecycle` or `canonicalTransitions` keeps the stored
 *   entry's (same bucket, same id) — the GM correction record the entry a player used to save back
 *   still carried;
 * - `declarationSubmittedByUserId` keeps its stored value when the submission omits it.
 *
 * Everything the player can see is taken from the submission, exactly as before.
 */
export function mergePlayerSubmittedScenarioParticipantState(input: {
  currentState: ScenarioParticipantState;
  submittedState: ScenarioParticipantState;
}): ScenarioParticipantState | undefined {
  const { currentState, submittedState } = input;
  const submittedEffects = JSON.stringify(submittedState.combatEffects ?? NO_COMBAT_EFFECTS);
  const storedEffects = JSON.stringify(currentState.combatEffects ?? NO_COMBAT_EFFECTS);
  const receivedEffects = JSON.stringify(
    currentState.combatEffects
      ? combatEffectsStateSchema.parse(
          buildPlayerFacingCombatEffectsState(currentState.combatEffects),
        )
      : NO_COMBAT_EFFECTS,
  );

  if (submittedEffects !== storedEffects && submittedEffects !== receivedEffects) {
    return undefined;
  }

  const storedBuckets = currentState.combat.combatContext.modifierBuckets;
  const submittedContext = submittedState.combat.combatContext;
  const keepStoredCorrectionRecord =
    (bucket: ModifierBucketKey) =>
    (entry: ScenarioCombatModifierEntry): ScenarioCombatModifierEntry => {
      const stored = storedBuckets[bucket].find((candidate) => candidate.id === entry.id);
      return {
        ...entry,
        ...(entry.canonicalLifecycle === undefined && stored?.canonicalLifecycle !== undefined
          ? { canonicalLifecycle: stored.canonicalLifecycle }
          : {}),
        ...(entry.canonicalTransitions === undefined && stored?.canonicalTransitions !== undefined
          ? { canonicalTransitions: stored.canonicalTransitions }
          : {}),
      };
    };
  const declarationSubmittedByUserId =
    submittedState.combat.declarationSubmittedByUserId ??
    currentState.combat.declarationSubmittedByUserId;

  return {
    ...submittedState,
    combat: {
      ...submittedState.combat,
      combatContext: {
        ...submittedContext,
        modifierBuckets: {
          general: submittedContext.modifierBuckets.general.map(
            keepStoredCorrectionRecord("general"),
          ),
          situationDb: submittedContext.modifierBuckets.situationDb.map(
            keepStoredCorrectionRecord("situationDb"),
          ),
          situationInitiative: submittedContext.modifierBuckets.situationInitiative.map(
            keepStoredCorrectionRecord("situationInitiative"),
          ),
          situationObSkill: submittedContext.modifierBuckets.situationObSkill.map(
            keepStoredCorrectionRecord("situationObSkill"),
          ),
        },
      },
      ...(declarationSubmittedByUserId === undefined ? {} : { declarationSubmittedByUserId }),
    },
    combatEffects: currentState.combatEffects,
  };
}
