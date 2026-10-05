import { z } from "zod";

import {
  buildPlayerFacingCombatContext,
  playerFacingCombatContextSchema,
} from "../campaign/playerFacingScenarioParticipant";
import {
  combatRoundAttackOpportunitySchema,
  combatRoundAttackRollResultSchema,
  combatRoundCombatExperienceResultSchema,
  combatRoundDeclarationSchema,
  combatRoundParticipantStateSchema,
  type CombatRoundAttackOpportunity,
  type CombatRoundAttackRollResult,
  type CombatRoundCombatExperienceResult,
  type CombatRoundDeclaration,
  type CombatRoundParticipantState,
} from "./combatRoundManager";

/**
 * The player-facing round-state participant and declaration, Forgejo issue #507 (privacy
 * hardening, Tier 2).
 *
 * The round state a player receives still comes from the per-viewer projection, which decides
 * which participants, declarations and attack results the viewer may see. That projection spreads
 * the stored participant and declaration, so before Tier 2 every field of either — and any field
 * added to either later, such as the `submittedByUserId` account identity — reached players. These
 * types rebuild both from named fields instead.
 *
 * Every field is here because a player consumer needs it: the player combat page, the domain
 * functions it runs over the round state it receives (`initializeCombatRoundState` and the helpers
 * it calls), or the schemas both the server and the client parse a player's round state with
 * (`activeCombatRoundStateSchema` for the `active-v1` response, `combatRoundStateSchema` in those
 * domain helpers), which require some fields. Each field names its consumer. A field nothing on the
 * player path reads is not here, so a field added to an internal type changes nothing a player sees.
 *
 * Nested structures follow the Tier 1 precedent (`playerFacingScenarioParticipant`): those carrying
 * an actor identity are enumerated one level further down and never carry it — attack results and
 * the Combat Experience result (`rolledByUserId`) and attack opportunities (`cancelledByUserId`);
 * the others reuse their canonical field schemas, which carry no private material. Combat and phase
 * contexts are `playerFacingCombatContextSchema`, without the canonical lifecycle and correction
 * history.
 *
 * Both types are branded, so a stored participant or declaration is not assignable to them.
 */
const attackRollShape = combatRoundAttackRollResultSchema.innerType().innerType().shape;

/** An attack result as a player receives it: everything but the roller's account identity. */
export const playerFacingCombatRoundAttackRollResultSchema = z.object({
  actionId: attackRollShape.actionId,
  attackIndex: attackRollShape.attackIndex,
  attackModeId: attackRollShape.attackModeId,
  attackType: attackRollShape.attackType,
  attackOpportunityId: attackRollShape.attackOpportunityId,
  attackSlot: attackRollShape.attackSlot,
  attackPhaseDefensivePenalty: attackRollShape.attackPhaseDefensivePenalty,
  attackerParticipantId: attackRollShape.attackerParticipantId,
  declarationId: attackRollShape.declarationId,
  defenderParticipantId: attackRollShape.defenderParticipantId,
  defenderDb: attackRollShape.defenderDb,
  defenderParryModifier: attackRollShape.defenderParryModifier,
  grazing: attackRollShape.grazing,
  hit: attackRollShape.hit,
  kind: attackRollShape.kind,
  lookupTotal: attackRollShape.lookupTotal,
  marginOverMissThreshold: attackRollShape.marginOverMissThreshold,
  ob: attackRollShape.ob,
  openEndedD10s: attackRollShape.openEndedD10s,
  phase: attackRollShape.phase,
  roll: attackRollShape.roll,
  rollD20: attackRollShape.rollD20,
  rollTotal: attackRollShape.rollTotal,
  rolledAt: attackRollShape.rolledAt,
  tableResult: attackRollShape.tableResult,
  weaponArmorClass: attackRollShape.weaponArmorClass,
  weaponCriticalCode: attackRollShape.weaponCriticalCode,
  weaponDamageClass: attackRollShape.weaponDamageClass,
  weaponDmb: attackRollShape.weaponDmb,
  weaponDmbRoll: attackRollShape.weaponDmbRoll,
  weaponDmbFormula: attackRollShape.weaponDmbFormula,
  weaponDmbRaw: attackRollShape.weaponDmbRaw,
  weaponModeInitiative: attackRollShape.weaponModeInitiative,
  weaponModeRange: attackRollShape.weaponModeRange,
  weaponModeSourceMetadata: attackRollShape.weaponModeSourceMetadata,
  weaponInstanceId: attackRollShape.weaponInstanceId,
  weaponName: attackRollShape.weaponName,
  weaponSecondaryCriticalCode: attackRollShape.weaponSecondaryCriticalCode,
  weaponSourceId: attackRollShape.weaponSourceId,
  weaponSourceSlot: attackRollShape.weaponSourceSlot,
  weaponTemplateId: attackRollShape.weaponTemplateId,
});
export type PlayerFacingCombatRoundAttackRollResult = z.infer<
  typeof playerFacingCombatRoundAttackRollResultSchema
>;

const combatExperienceShape = combatRoundCombatExperienceResultSchema.shape;

/** A Combat Experience result as a player receives it: everything but the roller's account. */
export const playerFacingCombatRoundCombatExperienceResultSchema = z.object({
  difficultyShift: combatExperienceShape.difficultyShift,
  durationRounds: combatExperienceShape.durationRounds,
  effectiveTableTotal: combatExperienceShape.effectiveTableTotal,
  label: combatExperienceShape.label,
  modifierValue: combatExperienceShape.modifierValue,
  needsEffectRow: combatExperienceShape.needsEffectRow,
  note: combatExperienceShape.note,
  resultBand: combatExperienceShape.resultBand,
  difficulty: combatExperienceShape.difficulty,
  finalTotal: combatExperienceShape.finalTotal,
  noRollRequired: combatExperienceShape.noRollRequired,
  openEndedD10s: combatExperienceShape.openEndedD10s,
  rolledAt: combatExperienceShape.rolledAt,
  rollD20: combatExperienceShape.rollD20,
  rollTotal: combatExperienceShape.rollTotal,
  roundNumber: combatExperienceShape.roundNumber,
  skillTotal: combatExperienceShape.skillTotal,
  skillTotalSource: combatExperienceShape.skillTotalSource,
  skillTotalWarning: combatExperienceShape.skillTotalWarning,
  trigger: combatExperienceShape.trigger,
});
export type PlayerFacingCombatRoundCombatExperienceResult = z.infer<
  typeof playerFacingCombatRoundCombatExperienceResultSchema
>;

const attackOpportunityShape = combatRoundAttackOpportunitySchema.shape;

/** A declared attack opportunity as a player receives it: everything but who cancelled it. */
export const playerFacingCombatRoundAttackOpportunitySchema = z.object({
  actionId: attackOpportunityShape.actionId,
  attackType: attackOpportunityShape.attackType,
  attackIndex: attackOpportunityShape.attackIndex,
  attackModeId: attackOpportunityShape.attackModeId,
  cancelledAt: attackOpportunityShape.cancelledAt,
  declarationId: attackOpportunityShape.declarationId,
  id: attackOpportunityShape.id,
  itemId: attackOpportunityShape.itemId,
  missileProfile: attackOpportunityShape.missileProfile,
  origin: attackOpportunityShape.origin,
  phase: attackOpportunityShape.phase,
  slot: attackOpportunityShape.slot,
  sourceKind: attackOpportunityShape.sourceKind,
  status: attackOpportunityShape.status,
  targetParticipantId: attackOpportunityShape.targetParticipantId,
  weaponInstanceId: attackOpportunityShape.weaponInstanceId,
  weaponSourceId: attackOpportunityShape.weaponSourceId,
  weaponSourceSlot: attackOpportunityShape.weaponSourceSlot,
  weaponTemplateId: attackOpportunityShape.weaponTemplateId,
});
export type PlayerFacingCombatRoundAttackOpportunity = z.infer<
  typeof playerFacingCombatRoundAttackOpportunitySchema
>;

const declarationShape = combatRoundDeclarationSchema.shape;

/**
 * The round-state declaration as a player receives it. Consumers are on the player path: the player
 * combat page (`ScenarioPlayerCombatPageContent.tsx`, "the page") and the domain helpers it runs.
 *
 * Not player-facing, and so not here:
 * - `submittedByUserId` — the submitting account's id, which is the GM's when the GM declared for
 *   the participant. Nothing outside the routes that write it reads it; actor identities are not
 *   player-facing (Tier 1, `playerFacingScenarioParticipant`).
 * - `disarm` — the per-viewer projection removes it from every declaration a player can see
 *   (`sanitizePlayerSafeDisarmDeclaration`, and the whole declaration of another participant who
 *   declared a disarm), so players never receive it; the page's draft read of it gets `undefined`.
 * - `adjustDistance` — no player consumer: its only reader on a player's state is the server's
 *   `nextTask` derivation (`buildManeuverAdapter`), and no client reads `nextTask`.
 * - `secondaryActions` — no player consumer: it repeats `secondaryActionContext`, which every writer
 *   stores alongside it and the only reader (`getCombatRoundObservationDeclaration`, server
 *   `nextTask` derivation) falls back to.
 */
const playerFacingCombatRoundDeclarationShapeSchema = z.object({
  /** The page's declaration draft and target validation; `getCombatRoundPhaseAttackCandidates`. */
  actionId: declarationShape.actionId,
  /** `getCombatRoundOffensiveParryAttemptIdentity` (page → `getPlayerCombatCurrentRollAction`). */
  id: declarationShape.id,
  /** The page's declaration draft (`buildPlayerCombatDeclarationDraft`). */
  additionalActionNotes: declarationShape.additionalActionNotes,
  /** The page's attack and missile panels; `getCombatRoundPhaseAttackCandidates`. */
  attackOpportunities: z.array(playerFacingCombatRoundAttackOpportunitySchema).optional(),
  /** `projectCombatActionGeneratedModifiers`, which the page calls. */
  attackPhaseDefensivePenalties: declarationShape.attackPhaseDefensivePenalties,
  /** The page's declaration draft and stored-declaration validation (`selectedOpponentId`). */
  combatContext: playerFacingCombatContextSchema.optional(),
  /** The page's feint method draft; `synchronizeCombatRoundFeintDeclarationTarget`. */
  feint: declarationShape.feint,
  /** The page's declaration draft (`hasCombatRoundDeclarationAction`). */
  intent: declarationShape.intent,
  /** The page's declaration draft. */
  movementId: declarationShape.movementId,
  /** The page's declaration draft and target validation; `sanitizeCombatRoundDeclarationTargets`. */
  movementIntent: declarationShape.movementIntent,
  /** The page's phase contexts draft; `getCombatRoundPhaseAttackBackOutOpportunity`. */
  phaseContexts: z
    .object({
      phase1: playerFacingCombatContextSchema.optional(),
      phase2: playerFacingCombatContextSchema.optional(),
    })
    .optional(),
  /** Required by the round-state schemas; `getCombatRoundOffensiveParryAttemptIdentity`. */
  roundNumber: declarationShape.roundNumber,
  /** The page's declaration draft and target validation. */
  secondaryActionContext: declarationShape.secondaryActionContext,
  /** The page's declaration draft and target validation; `getCombatRoundPhaseAttackCandidates`. */
  secondaryActionId: declarationShape.secondaryActionId,
  /** The page's declaration draft key (`buildPlayerCombatDeclarationDraftKey`). */
  submittedAt: declarationShape.submittedAt,
  /** Required by the round-state schemas both the server and the client parse. */
  submittedBy: declarationShape.submittedBy,
});
export const playerFacingCombatRoundDeclarationSchema =
  playerFacingCombatRoundDeclarationShapeSchema.brand<"PlayerFacingCombatRoundDeclaration">();
export type PlayerFacingCombatRoundDeclaration = z.infer<
  typeof playerFacingCombatRoundDeclarationSchema
>;

const participantShape = combatRoundParticipantStateSchema.shape;
const initiativesSchema = participantShape.initiatives.removeDefault();
const stepStatusesSchema = participantShape.stepStatuses.removeDefault();

/**
 * The round-state participant as a player receives it. Every field of the stored participant has a
 * player consumer; it is enumerated so that a field added to the stored participant is not.
 */
const playerFacingCombatRoundParticipantShapeSchema = z.object({
  /** The page's attack result display. */
  attackResults: z.object({
    phase1: playerFacingCombatRoundAttackRollResultSchema.optional(),
    phase2: playerFacingCombatRoundAttackRollResultSchema.optional(),
  }),
  /** `getCombatRoundAttackResultById` (page); step derivation in `initializeCombatRoundState`. */
  attackResultsByOpportunity: z
    .record(
      participantShape.attackResultsByOpportunity.unwrap().keySchema,
      playerFacingCombatRoundAttackRollResultSchema,
    )
    .optional(),
  /** Target aliases (`getCombatRoundParticipantTargetAliases`); the page's distance lookups. */
  characterId: participantShape.characterId,
  /** The page's Combat Experience panel; `isCombatStartExperienceRollRequired`. */
  combatExperience: playerFacingCombatRoundCombatExperienceResultSchema.optional(),
  /** `getCombatRoundCombatExperienceDue` (page → `getCombatRoundRequiredCombatExperienceTrigger`). */
  combatExperienceDue: participantShape.combatExperienceDue,
  /** The page's stored declaration; the domain helpers above. */
  declaration: playerFacingCombatRoundDeclarationSchema.optional(),
  /** The page's initiative display; initiative order in `initializeCombatRoundState`. */
  initiatives: initiativesSchema,
  /** Required by the round-state schemas; the page's participant names. */
  label: participantShape.label,
  /** Required by the round-state schemas; every lookup of a round participant. */
  participantId: participantShape.participantId,
  /** Target aliases; the page's participant matching. */
  scenarioParticipantId: participantShape.scenarioParticipantId,
  /** The page's declaration step status; phase completion in `initializeCombatRoundState`. */
  stepStatuses: stepStatusesSchema,
});
export const playerFacingCombatRoundParticipantSchema =
  playerFacingCombatRoundParticipantShapeSchema.brand<"PlayerFacingCombatRoundParticipant">();
export type PlayerFacingCombatRoundParticipant = z.infer<
  typeof playerFacingCombatRoundParticipantSchema
>;

function buildPlayerFacingCombatRoundAttackRollResult(
  result: CombatRoundAttackRollResult,
): PlayerFacingCombatRoundAttackRollResult {
  return playerFacingCombatRoundAttackRollResultSchema.parse({
    actionId: result.actionId,
    attackIndex: result.attackIndex,
    attackModeId: result.attackModeId,
    attackType: result.attackType,
    attackOpportunityId: result.attackOpportunityId,
    attackSlot: result.attackSlot,
    attackPhaseDefensivePenalty: result.attackPhaseDefensivePenalty,
    attackerParticipantId: result.attackerParticipantId,
    declarationId: result.declarationId,
    defenderParticipantId: result.defenderParticipantId,
    defenderDb: result.defenderDb,
    defenderParryModifier: result.defenderParryModifier,
    grazing: result.grazing,
    hit: result.hit,
    kind: result.kind,
    lookupTotal: result.lookupTotal,
    marginOverMissThreshold: result.marginOverMissThreshold,
    ob: result.ob,
    openEndedD10s: result.openEndedD10s,
    phase: result.phase,
    roll: result.roll,
    rollD20: result.rollD20,
    rollTotal: result.rollTotal,
    rolledAt: result.rolledAt,
    tableResult: result.tableResult,
    weaponArmorClass: result.weaponArmorClass,
    weaponCriticalCode: result.weaponCriticalCode,
    weaponDamageClass: result.weaponDamageClass,
    weaponDmb: result.weaponDmb,
    weaponDmbRoll: result.weaponDmbRoll,
    weaponDmbFormula: result.weaponDmbFormula,
    weaponDmbRaw: result.weaponDmbRaw,
    weaponModeInitiative: result.weaponModeInitiative,
    weaponModeRange: result.weaponModeRange,
    weaponModeSourceMetadata: result.weaponModeSourceMetadata,
    weaponInstanceId: result.weaponInstanceId,
    weaponName: result.weaponName,
    weaponSecondaryCriticalCode: result.weaponSecondaryCriticalCode,
    weaponSourceId: result.weaponSourceId,
    weaponSourceSlot: result.weaponSourceSlot,
    weaponTemplateId: result.weaponTemplateId,
  });
}

function buildPlayerFacingCombatRoundCombatExperienceResult(
  result: CombatRoundCombatExperienceResult,
): PlayerFacingCombatRoundCombatExperienceResult {
  return playerFacingCombatRoundCombatExperienceResultSchema.parse({
    difficultyShift: result.difficultyShift,
    durationRounds: result.durationRounds,
    effectiveTableTotal: result.effectiveTableTotal,
    label: result.label,
    modifierValue: result.modifierValue,
    needsEffectRow: result.needsEffectRow,
    note: result.note,
    resultBand: result.resultBand,
    difficulty: result.difficulty,
    finalTotal: result.finalTotal,
    noRollRequired: result.noRollRequired,
    openEndedD10s: result.openEndedD10s,
    rolledAt: result.rolledAt,
    rollD20: result.rollD20,
    rollTotal: result.rollTotal,
    roundNumber: result.roundNumber,
    skillTotal: result.skillTotal,
    skillTotalSource: result.skillTotalSource,
    skillTotalWarning: result.skillTotalWarning,
    trigger: result.trigger,
  });
}

function buildPlayerFacingCombatRoundAttackOpportunity(
  opportunity: CombatRoundAttackOpportunity,
): PlayerFacingCombatRoundAttackOpportunity {
  return playerFacingCombatRoundAttackOpportunitySchema.parse({
    actionId: opportunity.actionId,
    attackType: opportunity.attackType,
    attackIndex: opportunity.attackIndex,
    attackModeId: opportunity.attackModeId,
    cancelledAt: opportunity.cancelledAt,
    declarationId: opportunity.declarationId,
    id: opportunity.id,
    itemId: opportunity.itemId,
    missileProfile: opportunity.missileProfile,
    origin: opportunity.origin,
    phase: opportunity.phase,
    slot: opportunity.slot,
    sourceKind: opportunity.sourceKind,
    status: opportunity.status,
    targetParticipantId: opportunity.targetParticipantId,
    weaponInstanceId: opportunity.weaponInstanceId,
    weaponSourceId: opportunity.weaponSourceId,
    weaponSourceSlot: opportunity.weaponSourceSlot,
    weaponTemplateId: opportunity.weaponTemplateId,
  });
}

function buildPlayerFacingCombatRoundDeclaration(input: {
  declaration: CombatRoundDeclaration;
  keepCombatContextAsR2Residual: boolean;
}): PlayerFacingCombatRoundDeclaration {
  const { declaration } = input;
  const phaseContexts = declaration.phaseContexts;
  const value: z.infer<typeof playerFacingCombatRoundDeclarationShapeSchema> = {
    actionId: declaration.actionId,
    id: declaration.id,
    additionalActionNotes: declaration.additionalActionNotes,
    attackOpportunities: declaration.attackOpportunities?.map(
      buildPlayerFacingCombatRoundAttackOpportunity,
    ),
    attackPhaseDefensivePenalties: declarationShape.attackPhaseDefensivePenalties.parse(
      declaration.attackPhaseDefensivePenalties,
    ),
    // R2 (#502 Tier 1, control-plane rulings 2026-10-04/05): the combat-declaration route returns
    // the viewer's own declaration's combat context as the per-viewer projection produced it —
    // accepted debt, pinned path by path in the route tests, removed by Tier 3. Every other combat
    // context is rebuilt without the lifecycle and correction history.
    combatContext:
      declaration.combatContext && !input.keepCombatContextAsR2Residual
        ? buildPlayerFacingCombatContext(declaration.combatContext)
        : declaration.combatContext,
    feint: declarationShape.feint.parse(declaration.feint),
    intent: declarationShape.intent.parse(declaration.intent),
    movementId: declaration.movementId,
    movementIntent: declarationShape.movementIntent.parse(declaration.movementIntent),
    phaseContexts: phaseContexts && {
      phase1: phaseContexts.phase1 && buildPlayerFacingCombatContext(phaseContexts.phase1),
      phase2: phaseContexts.phase2 && buildPlayerFacingCombatContext(phaseContexts.phase2),
    },
    roundNumber: declaration.roundNumber,
    secondaryActionContext: declarationShape.secondaryActionContext.parse(
      declaration.secondaryActionContext,
    ),
    secondaryActionId: declaration.secondaryActionId,
    submittedAt: declaration.submittedAt,
    submittedBy: declaration.submittedBy,
  };
  return value as PlayerFacingCombatRoundDeclaration;
}

/**
 * Builds the round-state participant a player receives from the one the per-viewer projection
 * produced for them. The projection decides what the viewer may see of this participant; this
 * function decides which fields carry it.
 */
export function buildPlayerFacingCombatRoundParticipant(input: {
  /** R2: set by the combat-declaration route only, for the viewer's own participants. */
  keepDeclarationCombatContextAsR2Residual?: true;
  participant: CombatRoundParticipantState;
}): PlayerFacingCombatRoundParticipant {
  const { participant } = input;
  const attackResultsByOpportunity = participant.attackResultsByOpportunity;
  const value: z.infer<typeof playerFacingCombatRoundParticipantShapeSchema> = {
    attackResults: {
      phase1:
        participant.attackResults.phase1 &&
        buildPlayerFacingCombatRoundAttackRollResult(participant.attackResults.phase1),
      phase2:
        participant.attackResults.phase2 &&
        buildPlayerFacingCombatRoundAttackRollResult(participant.attackResults.phase2),
    },
    attackResultsByOpportunity:
      attackResultsByOpportunity &&
      Object.fromEntries(
        Object.entries(attackResultsByOpportunity).map(([opportunityId, result]) => [
          opportunityId,
          buildPlayerFacingCombatRoundAttackRollResult(result),
        ]),
      ),
    characterId: participant.characterId,
    combatExperience:
      participant.combatExperience &&
      buildPlayerFacingCombatRoundCombatExperienceResult(participant.combatExperience),
    combatExperienceDue: participantShape.combatExperienceDue.parse(
      participant.combatExperienceDue,
    ),
    declaration:
      participant.declaration &&
      buildPlayerFacingCombatRoundDeclaration({
        declaration: participant.declaration,
        keepCombatContextAsR2Residual: input.keepDeclarationCombatContextAsR2Residual === true,
      }),
    initiatives: initiativesSchema.parse(participant.initiatives),
    label: participant.label,
    participantId: participant.participantId,
    scenarioParticipantId: participant.scenarioParticipantId,
    stepStatuses: stepStatusesSchema.parse(participant.stepStatuses),
  };
  return value as PlayerFacingCombatRoundParticipant;
}
