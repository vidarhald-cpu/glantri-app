import { z } from "zod";

import { playerFacingCombatContextSchema } from "../campaign/playerFacingScenarioParticipant";
import {
  combatRoundAttackOpportunitySchema,
  combatRoundAttackResultsSchema,
  combatRoundAttackRollResultSchema,
  combatRoundCombatExperienceResultSchema,
  combatRoundDeclarationSchema,
  combatRoundInitiativesSchema,
  combatRoundParticipantStateSchema,
  combatRoundPhaseContextsSchema,
  type CombatRoundDeclaration,
  type CombatRoundParticipantState,
} from "./combatRoundManager";
import {
  playerFacingCombatAttackPhaseDefensivePenaltySchema,
  playerFacingCombatDeclarationIntentSchema,
  playerFacingCombatRoundCombatExperienceDueSchema,
  playerFacingCombatRoundFeintDeclarationSchema,
  playerFacingCombatRoundInitiativeResultSchema,
  playerFacingCombatRoundWeaponDmbFormulaSchema,
  playerFacingMissileWeaponProfileSchema,
  playerFacingMovementIntentSchema,
  playerFacingScenarioParticipantSecondaryActionContextSchema,
} from "./playerFacingCombatRoundStructures";
import {
  buildPlayerFacing,
  LEAF,
  playerFacingObject,
  type PlayerFacingOverrides,
} from "./playerFacingSchema";

/**
 * The player-facing round-state participant and declaration, Forgejo issue #507 (privacy
 * hardening, Tier 2), made whole-path in #517 (Tier 3).
 *
 * The per-viewer projection decides which participants, declarations and attack results the viewer
 * may see; these types decide which fields carry it. Before Tier 2 the projection spread the stored
 * participant and declaration, so every field of either — and any field added to either later, such
 * as the `submittedByUserId` account identity — reached players.
 *
 * Every field is here because a player consumer needs it: the player combat page, the domain
 * functions it runs over the round state it receives (`initializeCombatRoundState` and the helpers
 * it calls), or the schemas both the server and the client parse a player's round state with
 * (`activeCombatRoundStateSchema` for the `active-v1` response, `combatRoundStateSchema` in those
 * domain helpers), which require some fields. Each field names its consumer.
 *
 * Every level is enumerated (Tier 3, `playerFacingSchema.ts`). A field reuses its canonical schema
 * only when that schema holds no object (`LEAF`, checked at compile time); every structure — attack
 * results, attack opportunities, the Combat Experience result, the defensive penalties, the feint,
 * intent, movement intent and secondary-action context, the initiatives and the Combat Experience
 * schedule — is a player-facing schema naming its own fields, checked when the module loads. So
 * these types inherit nothing automatically from the stored participant, its declaration or any
 * structure below them: such a field is carried only if a player-facing schema names it. They make
 * up the player-facing round state (`playerFacingCombatRoundState`) — the `combatRoundState` of a
 * player's encounter response and the `activeCombatState` of a player's `active-v1` response.
 *
 * They do not close the open `facts` record on a round-state command, which is privacy Tier 4's
 * (#528).
 *
 * That is the whole of the claim. Player output built from the same stored structures without
 * these types is not covered by it. The combat history's event fact buckets are open: a
 * declaration event's `involvedOutcome` copies the declaration's movement intent, phase contexts
 * and secondary-action context whole and gives them to the declaring player, a field added to
 * them included. Those buckets are privacy Tier 4's (#528).
 *
 * In these types, attack results and the Combat Experience result never carry `rolledByUserId`,
 * and attack opportunities never carry `cancelledByUserId`. Combat and phase contexts are
 * `playerFacingCombatContextSchema`, so these types carry them without the canonical lifecycle and
 * correction history (R1); the combat history's `involvedOutcome` can still give both to the
 * declaring player (#528).
 *
 * Every player-facing object is branded, so a stored value is not assignable to these types at any
 * level.
 */
/**
 * The attack-result fields that carry workbook import provenance, which is not player-facing
 * gameplay data (control-plane ruling E2, #517):
 *
 * - `weaponModeSourceMetadata`, the attack mode's import record;
 * - `weaponDmbRoll`, the missile DMB roll, whose `provenance` is `"<sheet>:<row>:<formula>"`. The
 *   whole roll is omitted, not only its `provenance`: the stored schema requires `provenance`, and
 *   the server and the client parse a player's round state with it (ruling 2026-10-07). The DMB
 *   value itself stays in `weaponDmb`, which that schema requires to equal the roll's total.
 *
 * The player-facing attack result names neither. Player output that carries an attack result's
 * fields outside that schema removes both with `withoutAttackResultWorkbookImportProvenance`.
 */
export const ATTACK_RESULT_WORKBOOK_IMPORT_PROVENANCE_FIELDS = [
  "weaponDmbRoll",
  "weaponModeSourceMetadata",
] as const;

/**
 * An attack result, or an event fact bucket copied from one, without
 * `ATTACK_RESULT_WORKBOOK_IMPORT_PROVENANCE_FIELDS`: for player output that is not parsed through
 * the player-facing attack result — the combat history's event facts and the roll-attack response.
 */
export function withoutAttackResultWorkbookImportProvenance<Attack extends object>(
  attack: Attack,
): Omit<Attack, (typeof ATTACK_RESULT_WORKBOOK_IMPORT_PROVENANCE_FIELDS)[number]> {
  const {
    weaponDmbRoll: _dmbRollProvenance,
    weaponModeSourceMetadata: _modeProvenance,
    ...playerAttack
  } = attack as Attack & { weaponDmbRoll?: unknown; weaponModeSourceMetadata?: unknown };
  return playerAttack;
}

/**
 * An attack result as a player receives it: everything but the roller's account identity and
 * `ATTACK_RESULT_WORKBOOK_IMPORT_PROVENANCE_FIELDS`; nothing on the player path read either.
 */
export const playerFacingCombatRoundAttackRollResultSchema = playerFacingObject(
  "PlayerFacingCombatRoundAttackRollResult",
  combatRoundAttackRollResultSchema.innerType().innerType(),
  {
    actionId: LEAF,
    attackIndex: LEAF,
    attackModeId: LEAF,
    attackType: LEAF,
    attackOpportunityId: LEAF,
    attackSlot: LEAF,
    attackPhaseDefensivePenalty: playerFacingCombatAttackPhaseDefensivePenaltySchema.optional(),
    attackerParticipantId: LEAF,
    declarationId: LEAF,
    defenderParticipantId: LEAF,
    defenderDb: LEAF,
    defenderParryModifier: LEAF,
    grazing: LEAF,
    hit: LEAF,
    kind: LEAF,
    lookupTotal: LEAF,
    marginOverMissThreshold: LEAF,
    ob: LEAF,
    openEndedD10s: LEAF,
    phase: LEAF,
    roll: LEAF,
    rollD20: LEAF,
    rollTotal: LEAF,
    rolledAt: LEAF,
    tableResult: LEAF,
    weaponArmorClass: LEAF,
    weaponCriticalCode: LEAF,
    weaponDamageClass: LEAF,
    weaponDmb: LEAF,
    weaponDmbFormula: playerFacingCombatRoundWeaponDmbFormulaSchema.nullable().optional(),
    weaponDmbRaw: LEAF,
    weaponModeInitiative: LEAF,
    weaponModeRange: LEAF,
    weaponInstanceId: LEAF,
    weaponName: LEAF,
    weaponSecondaryCriticalCode: LEAF,
    weaponSourceId: LEAF,
    weaponSourceSlot: LEAF,
    weaponTemplateId: LEAF,
  },
);
export type PlayerFacingCombatRoundAttackRollResult = z.infer<
  typeof playerFacingCombatRoundAttackRollResultSchema
>;

/** A Combat Experience result as a player receives it: everything but the roller's account. */
export const playerFacingCombatRoundCombatExperienceResultSchema = playerFacingObject(
  "PlayerFacingCombatRoundCombatExperienceResult",
  combatRoundCombatExperienceResultSchema,
  {
    difficultyShift: LEAF,
    durationRounds: LEAF,
    effectiveTableTotal: LEAF,
    label: LEAF,
    modifierValue: LEAF,
    needsEffectRow: LEAF,
    note: LEAF,
    resultBand: LEAF,
    difficulty: LEAF,
    finalTotal: LEAF,
    noRollRequired: LEAF,
    openEndedD10s: LEAF,
    rolledAt: LEAF,
    rollD20: LEAF,
    rollTotal: LEAF,
    roundNumber: LEAF,
    skillTotal: LEAF,
    skillTotalSource: LEAF,
    skillTotalWarning: LEAF,
    trigger: LEAF,
  },
);
export type PlayerFacingCombatRoundCombatExperienceResult = z.infer<
  typeof playerFacingCombatRoundCombatExperienceResultSchema
>;

/** A declared attack opportunity as a player receives it: everything but who cancelled it. */
export const playerFacingCombatRoundAttackOpportunitySchema = playerFacingObject(
  "PlayerFacingCombatRoundAttackOpportunity",
  combatRoundAttackOpportunitySchema,
  {
    actionId: LEAF,
    attackType: LEAF,
    attackIndex: LEAF,
    attackModeId: LEAF,
    cancelledAt: LEAF,
    declarationId: LEAF,
    id: LEAF,
    itemId: LEAF,
    missileProfile: playerFacingMissileWeaponProfileSchema.optional(),
    origin: LEAF,
    phase: LEAF,
    slot: LEAF,
    sourceKind: LEAF,
    status: LEAF,
    targetParticipantId: LEAF,
    weaponInstanceId: LEAF,
    weaponSourceId: LEAF,
    weaponSourceSlot: LEAF,
    weaponTemplateId: LEAF,
  },
);
export type PlayerFacingCombatRoundAttackOpportunity = z.infer<
  typeof playerFacingCombatRoundAttackOpportunitySchema
>;

const playerFacingCombatRoundPhaseContextsSchema = playerFacingObject(
  "PlayerFacingCombatRoundPhaseContexts",
  combatRoundPhaseContextsSchema,
  {
    phase1: playerFacingCombatContextSchema.optional(),
    phase2: playerFacingCombatContextSchema.optional(),
  },
);

/**
 * The round-state declaration as a player receives it. Consumers are on the player path: the player
 * combat page (`ScenarioPlayerCombatPageContent.tsx`, "the page") and the domain helpers it runs.
 *
 * Not player-facing, and so not here:
 * - `submittedByUserId` — the submitting account's id, which is the GM's when the GM declared for
 *   the participant. Nothing outside the routes that write it reads it; actor identities are not
 *   player-facing (Tier 1, `playerFacingScenarioParticipant`).
 * - `disarm` — players never received it: the per-viewer projection removed it from the viewer's
 *   own declaration and hides another participant's disarm declaration whole; the page's draft read
 *   of it gets `undefined`.
 * - `adjustDistance` — no player consumer: its only reader on a player's state is the server's
 *   `nextTask` derivation (`buildManeuverAdapter`), and no client reads `nextTask`.
 * - `secondaryActions` — no player consumer: it repeats `secondaryActionContext`, which every writer
 *   stores alongside it and the only reader (`getCombatRoundObservationDeclaration`, server
 *   `nextTask` derivation) falls back to.
 */
export const playerFacingCombatRoundDeclarationSchema = playerFacingObject(
  "PlayerFacingCombatRoundDeclaration",
  combatRoundDeclarationSchema,
  {
    /** The page's declaration draft and target validation; `getCombatRoundPhaseAttackCandidates`. */
    actionId: LEAF,
    /** `getCombatRoundOffensiveParryAttemptIdentity` (page → `getPlayerCombatCurrentRollAction`). */
    id: LEAF,
    /** The page's declaration draft (`buildPlayerCombatDeclarationDraft`). */
    additionalActionNotes: LEAF,
    /** The page's attack and missile panels; `getCombatRoundPhaseAttackCandidates`. */
    attackOpportunities: z.array(playerFacingCombatRoundAttackOpportunitySchema).optional(),
    /** `projectCombatActionGeneratedModifiers`, which the page calls. */
    attackPhaseDefensivePenalties: z
      .array(playerFacingCombatAttackPhaseDefensivePenaltySchema)
      .optional(),
    /** The page's declaration draft and stored-declaration validation (`selectedOpponentId`). */
    combatContext: playerFacingCombatContextSchema.optional(),
    /** The page's feint method draft; `synchronizeCombatRoundFeintDeclarationTarget`. */
    feint: playerFacingCombatRoundFeintDeclarationSchema.optional(),
    /** The page's declaration draft (`hasCombatRoundDeclarationAction`). */
    intent: playerFacingCombatDeclarationIntentSchema.optional(),
    /** The page's declaration draft. */
    movementId: LEAF,
    /** The page's declaration draft and target validation; `sanitizeCombatRoundDeclarationTargets`. */
    movementIntent: playerFacingMovementIntentSchema.optional(),
    /** The page's phase contexts draft; `getCombatRoundPhaseAttackBackOutOpportunity`. */
    phaseContexts: playerFacingCombatRoundPhaseContextsSchema.optional(),
    /** Required by the round-state schemas; `getCombatRoundOffensiveParryAttemptIdentity`. */
    roundNumber: LEAF,
    /** The page's declaration draft and target validation. */
    secondaryActionContext: playerFacingScenarioParticipantSecondaryActionContextSchema.optional(),
    /** The page's declaration draft and target validation; `getCombatRoundPhaseAttackCandidates`. */
    secondaryActionId: LEAF,
    /** The page's declaration draft key (`buildPlayerCombatDeclarationDraftKey`). */
    submittedAt: LEAF,
    /** Required by the round-state schemas both the server and the client parse. */
    submittedBy: LEAF,
  },
);
export type PlayerFacingCombatRoundDeclaration = z.infer<
  typeof playerFacingCombatRoundDeclarationSchema
>;

const participantShape = combatRoundParticipantStateSchema.shape;

const playerFacingCombatRoundAttackResultsSchema = playerFacingObject(
  "PlayerFacingCombatRoundAttackResults",
  combatRoundAttackResultsSchema,
  {
    phase1: playerFacingCombatRoundAttackRollResultSchema.optional(),
    phase2: playerFacingCombatRoundAttackRollResultSchema.optional(),
  },
);

const playerFacingCombatRoundInitiativesSchema = playerFacingObject(
  "PlayerFacingCombatRoundInitiatives",
  combatRoundInitiativesSchema,
  {
    phase1: playerFacingCombatRoundInitiativeResultSchema.optional(),
    phase2: playerFacingCombatRoundInitiativeResultSchema.optional(),
  },
);

/**
 * The round-state participant as a player receives it. Every field of the stored participant has a
 * player consumer; it is enumerated so that a field added to the stored participant is not.
 */
export const playerFacingCombatRoundParticipantSchema = playerFacingObject(
  "PlayerFacingCombatRoundParticipant",
  combatRoundParticipantStateSchema,
  {
    /** The page's attack result display. */
    attackResults: playerFacingCombatRoundAttackResultsSchema,
    /** `getCombatRoundAttackResultById` (page); step derivation in `initializeCombatRoundState`. */
    attackResultsByOpportunity: z
      .record(
        participantShape.attackResultsByOpportunity.unwrap().keySchema,
        playerFacingCombatRoundAttackRollResultSchema,
      )
      .optional(),
    /** Target aliases (`getCombatRoundParticipantTargetAliases`); the page's distance lookups. */
    characterId: LEAF,
    /** The page's Combat Experience panel; `isCombatStartExperienceRollRequired`. */
    combatExperience: playerFacingCombatRoundCombatExperienceResultSchema.optional(),
    /** `getCombatRoundCombatExperienceDue` (page → `getCombatRoundRequiredCombatExperienceTrigger`). */
    combatExperienceDue: playerFacingCombatRoundCombatExperienceDueSchema.optional(),
    /** The page's stored declaration; the domain helpers above. */
    declaration: playerFacingCombatRoundDeclarationSchema.optional(),
    /** The page's initiative display; initiative order in `initializeCombatRoundState`. */
    initiatives: playerFacingCombatRoundInitiativesSchema,
    /** Required by the round-state schemas; the page's participant names. */
    label: LEAF,
    /** Required by the round-state schemas; every lookup of a round participant. */
    participantId: LEAF,
    /** Target aliases; the page's participant matching. */
    scenarioParticipantId: LEAF,
    /**
     * The page's declaration step status; phase completion in `initializeCombatRoundState`. A record
     * of enums keyed by step, so it holds no object: reused, and checked as such when the module
     * loads (the compiler cannot tell an enum-keyed record from an object).
     */
    stepStatuses: participantShape.stepStatuses,
  },
);
export type PlayerFacingCombatRoundParticipant = z.infer<
  typeof playerFacingCombatRoundParticipantSchema
>;

/**
 * Per-viewer values for fields of a visible declaration: what the per-viewer projection shows a
 * viewer who does not control the participant instead of its notes, intent, movement intent and —
 * when it observes — the observed target.
 */
export type PlayerFacingCombatRoundDeclarationOverrides = PlayerFacingOverrides<
  typeof playerFacingCombatRoundDeclarationSchema
>;

/**
 * Builds the round-state participant a player receives. The per-viewer projection decides what the
 * viewer may see of this participant — which declaration (`declaration`, `undefined` for none) and
 * which of its fields (`declarationOverrides`), and which attack results — and this function builds
 * every field from the player-facing schemas, which decide what can carry it.
 */
export function buildPlayerFacingCombatRoundParticipant(input: {
  /** The declaration the viewer may see: the participant's own, or `undefined` for none. */
  declaration?: CombatRoundDeclaration;
  /** Fields of that declaration the viewer may not see, set to what the viewer receives instead. */
  declarationOverrides?: PlayerFacingCombatRoundDeclarationOverrides;
  /** The attack results the viewer may see, by opportunity; the participant's own by default. */
  attackResultsByOpportunity?: CombatRoundParticipantState["attackResultsByOpportunity"];
  /** The phase attack results derived from `attackResultsByOpportunity`, when that is given. */
  attackResults?: CombatRoundParticipantState["attackResults"];
  participant: CombatRoundParticipantState;
}): PlayerFacingCombatRoundParticipant {
  const declaration = "declaration" in input ? input.declaration : input.participant.declaration;
  return buildPlayerFacing(playerFacingCombatRoundParticipantSchema, input.participant, {
    attackResults: input.attackResults ?? input.participant.attackResults,
    attackResultsByOpportunity:
      input.attackResultsByOpportunity ?? input.participant.attackResultsByOpportunity,
    declaration:
      declaration &&
      buildPlayerFacing(
        playerFacingCombatRoundDeclarationSchema,
        declaration,
        input.declarationOverrides,
      ),
  });
}
