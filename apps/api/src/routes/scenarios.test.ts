import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  advanceCombatRoundStep,
  backOutCombatRoundPhaseAttack,
  buildCombatDefenseSnapshotId,
  buildCombatRoundAttackRollResult,
  buildDamagePersistentLifecycle,
  buildCombatHistorySourceViewFromPersistedSession,
  buildEncounterAccessMetadataViewFromPersistedSession,
  buildCombatRoundDeclaredAttackOpportunities,
  buildCombatProgressionProjection,
  getCombatRoundOpenPerformTaskForParticipant,
  canonicalCombatModifierEffectSchema,
  combatRoundStateSchema,
  combatDefenseSnapshotSchema,
  combatRoundParticipantHasExecutablePhaseAttack,
  combatRoundParticipantHasPhaseAttack,
  combatRoundParticipantWasAttackedInPhase,
  completeRemainingCombatRoundStep,
  commitCombatRoundEndDistanceControl,
  commitCombatRoundEndParticipantReview,
  commitCombatRoundPhaseDamage,
  commitCombatRoundPhaseInitiativeResolution,
  createParticipantSnapshotFromEntity,
  declareCombatGenericAction,
  ensureCombatRoundPhaseResolutionResultsForPhase,
  fingerprintCombatModifierResolution,
  getCombatRoundOutgoingAttackResultForParticipantPhase,
  getCombatRoundAttackResultById,
  getCombatRoundAttackResultId,
  getCurrentExecutableCombatTasks,
  getCombatRoundPhaseAttackCandidates,
  getCanonicalAttackOpportunityIdentity,
  getCombatRoundParticipantPhaseStepStatus,
  initializeCombatRoundState,
  encounterSessionSchema,
  normalizeRoleplayState,
  prepareCombatRoundEndReview,
  projectProcessRestrictionToCanonicalModifierLifecycle,
  projectActiveCombatParticipation,
  projectCombatNpcDeclarationProposal,
  rollCombatRoundCombatExperience,
  rollCombatRoundEndHealthCheck,
  rollCombatRoundEndDistanceControl,
  recordCombatRoundAttackResult,
  recordCombatRoundCriticalRoll,
  recordCombatRoundDeclaration,
  recordCombatRoundDefenseReview,
  recordCombatRoundDamageResult,
  recordCombatRoundHitLocationRoll,
  recordCombatRoundInitiative,
  recordCombatRoundParryResult as recordCanonicalCombatRoundParryResult,
  recordCombatRoundParticipantStepReview,
  resolveEncounterParticipantMembership,
  scenarioParticipantSchema,
  type CombatProgressionBoundaryKind,
  type CombatDefenseSnapshot,
  type CombatRoundState,
  type CombatEffectsState,
  type EncounterSession,
  type ScenarioParticipant,
  getDistanceBetween,
  makeDistancePairKey,
  setDistanceBetween,
  setCombatRoundCombatExperienceDifficulty,
  undoLatestCombatRoundCommand,
} from "@glantri/domain";
import { weaponTemplates } from "@glantri/content/equipment";

const mocks = vi.hoisted(() => {
  class CampaignCharacterAlreadyRosteredError extends Error {
    constructor() {
      super("Character is already rostered in an active Campaign.");
      this.name = "CampaignCharacterAlreadyRosteredError";
    }
  }

  class CampaignCharacterRosterCandidateNotFoundError extends Error {
    constructor() {
      super("Campaign character candidate not found.");
      this.name = "CampaignCharacterRosterCandidateNotFoundError";
    }
  }
  class CampaignNoteConflictError extends Error {
    constructor(readonly currentNote: unknown) {
      super("Campaign note changed. Review the current Note before saving again.");
      this.name = "CampaignNoteConflictError";
    }
  }
  class CampaignNoteNotFoundError extends Error {}
  class CampaignNoteReferenceError extends Error {}

  const adminUser = {
    email: "gm@example.test",
    id: "gm-1",
    roles: ["game_master"],
  };
  const playerUser = {
    email: "player@example.test",
    id: "player-1",
    roles: ["player"],
  };
  const campaignService = {
    addCampaignRosterEntry: vi.fn(),
    createCampaign: vi.fn(),
    createCampaignNpc: vi.fn(),
    activateCampaign: vi.fn(),
    getCampaignById: vi.fn(),
    getReusableEntityById: vi.fn(),
    listCampaignRosterEntries: vi.fn(),
    listCampaignRosterHistoryEntries: vi.fn(),
    listCampaignCharacterRosterCandidates: vi.fn(),
    listCampaignsByCharacterRosterAccess: vi.fn(),
    listCampaignsByGameMaster: vi.fn(),
    listCampaignsByPlayerAccess: vi.fn(),
    listCampaignsByUserAccess: vi.fn(),
    listPlayerCampaignCharacters: vi.fn(),
    removeCampaignRosterEntryBySource: vi.fn(),
  };
  const campaignManagementService = {
    createNote: vi.fn(),
    getOverview: vi.fn(),
    setNoteStatus: vi.fn(),
    updateNote: vi.fn(),
  };
  const characterService = {
    getCharacterById: vi.fn(),
    getOwnedCharacter: vi.fn(),
  };
  const characterEquipmentReadModelService = {
    getCampaignEquipmentState: vi.fn(),
    getCharacterEquipmentState: vi.fn(),
  };
  const combatStateReadService = {
    getCombatHistorySourceById: vi.fn(),
    getEncounterMetadataById: vi.fn(),
    listEncounterAccessMetadataByScenario: vi.fn(),
    listScenarioEncounterManagementProjections: vi.fn(),
  };
  const combatItemInteractionService = {
    commitDisarm: vi.fn(),
    resolveDeclaration: vi.fn(),
    commitDisarmUndo: vi.fn(),
    commitMissileWeaponAttack: vi.fn(),
    commitMissileWeaponAttackUndo: vi.fn(),
    commitThrownWeaponAttack: vi.fn(),
    commitThrownWeaponAttackUndo: vi.fn(),
    getOptions: vi.fn(),
    resolveDisarmDeclaration: vi.fn(),
  };
  const updateEncounter = vi.fn();
  const encounterService = {
    commitCombatParticipantStateMutation: vi.fn(),
    commitCombatParticipantStateMutations: vi.fn(),
    commitCombatModifierReview: vi.fn(),
    commitCombatModifierReviews: vi.fn(),
    createEncounter: vi.fn(),
    getEncounterById: vi.fn(),
    getEncounterSummaryById: vi.fn(),
    listEncounterSummariesByScenario: vi.fn(),
    listEncountersByScenario: vi.fn(),
    updateCombatEncounter: updateEncounter,
    updateEncounter,
    updateScenarioParticipantState: vi.fn(),
  };
  const scenarioService = {
    createScenario: vi.fn(),
    addCharacterParticipant: vi.fn(),
    addEntityParticipant: vi.fn(),
    getScenarioById: vi.fn(),
    listScenariosByCampaignPlayerAccess: vi.fn(),
    listScenariosByCampaignPlayerControl: vi.fn(),
    listScenariosByCampaign: vi.fn(),
    listScenarioEventLogs: vi.fn(),
    listScenarioParticipants: vi.fn(),
    pickUpScenarioAvailableItem: vi.fn(),
    recordScenarioEvent: vi.fn(),
    resolveEquipmentStatuses: vi.fn().mockResolvedValue({}),
    resolveScenarioAvailableObjects: vi.fn(),
    refreshCharacterParticipantEquipmentSnapshot: vi.fn(),
    updateScenario: vi.fn(),
    updateScenarioSessionState: vi.fn(),
    userHasPlayerScenarioAccess: vi.fn(),
  };
  return {
    adminUser,
    CampaignCharacterAlreadyRosteredError,
    CampaignCharacterRosterCandidateNotFoundError,
    CampaignNoteConflictError,
    CampaignNoteNotFoundError,
    CampaignNoteReferenceError,
    campaignManagementService,
    campaignService,
    characterEquipmentReadModelService,
    characterService,
    combatItemInteractionService,
    combatStateReadService,
    encounterService,
    playerUser,
    requireAdminUser: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
    scenarioService,
  };
});

// `CombatItemUnavailableError` and `ScenarioEquipmentStaleError` are the **real** classes. The M7
// declaration tests below drive the genuine `CombatItemInteractionService` rather than a hand-built
// stand-in, so the routes must be able to recognise what it throws with `instanceof`. Nothing else
// is taken from the real module.
vi.mock("@glantri/database", async () => ({
  CombatItemUnavailableError: (await vi.importActual<Record<string, unknown>>("@glantri/database"))
    .CombatItemUnavailableError,
  ArtifactImportService: vi.fn(() => ({})),
  CampaignCharacterAlreadyRosteredError: mocks.CampaignCharacterAlreadyRosteredError,
  CampaignCharacterRosterCandidateNotFoundError:
    mocks.CampaignCharacterRosterCandidateNotFoundError,
  CampaignService: vi.fn(() => mocks.campaignService),
  CampaignManagementService: vi.fn(() => mocks.campaignManagementService),
  CampaignMapService: vi.fn(() => ({})),
  CampaignMapConflictError: class CampaignMapConflictError extends Error {},
  CampaignMapNotFoundError: class CampaignMapNotFoundError extends Error {},
  CampaignMapReferenceError: class CampaignMapReferenceError extends Error {},
  CampaignNoteConflictError: mocks.CampaignNoteConflictError,
  CampaignNoteNotFoundError: mocks.CampaignNoteNotFoundError,
  CampaignNoteReferenceError: mocks.CampaignNoteReferenceError,
  CharacterEquipmentReadModelService: vi.fn(() => mocks.characterEquipmentReadModelService),
  CharacterService: vi.fn(() => mocks.characterService),
  CombatItemInteractionService: vi.fn(() => mocks.combatItemInteractionService),
  CombatStateReadService: vi.fn(() => mocks.combatStateReadService),
  EncounterCombatWriteError: class EncounterCombatWriteError extends Error {
    constructor(
      readonly code: "stale_revision" | "transaction_conflict",
      message: string,
    ) {
      super(message);
      this.name = "EncounterCombatWriteError";
    }
  },
  EncounterWriteError: class EncounterWriteError extends Error {
    constructor(
      readonly code: "stale_revision" | "transaction_conflict",
      message: string,
    ) {
      super(message);
      this.name = "EncounterWriteError";
    }
  },
  EncounterService: vi.fn(() => mocks.encounterService),
  ScenarioSessionWriteError: class ScenarioSessionWriteError extends Error {
    constructor(
      readonly code: "stale_revision" | "transaction_conflict",
      message: string,
    ) {
      super(message);
      this.name = "ScenarioSessionWriteError";
    }
  },
  ScenarioEquipmentStaleError: (await vi.importActual<Record<string, unknown>>("@glantri/database"))
    .ScenarioEquipmentStaleError,
  ScenarioService: vi.fn(() => mocks.scenarioService),
}));

vi.mock("../lib/sessionAuth", () => ({
  requireAdminUser: mocks.requireAdminUser,
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}));

import { scenariosRoutes } from "./scenarios";
import { buildPlayerSafeEncounterForUser } from "./scenarios/encounterRoutes";

function emptyModifierBuckets() {
  return {
    general: [],
    situationDb: [],
    situationInitiative: [],
    situationObSkill: [],
  };
}

function canonicalReviewTestEffect(input: {
  category: "db_parry" | "general_fatigue" | "skill_ob";
  id: string;
  ownerParticipantId: string;
  phase?: "phase1" | "phase2";
  sourceFamily: "combat_experience" | "feint" | "observe_relationship";
  value: number;
}) {
  return canonicalCombatModifierEffectSchema.parse({
    applicability: {
      combatWide: input.phase === undefined,
      encounterId: "encounter-1",
      phase: input.phase,
      rollPurposes: [],
      roundNumber: input.phase ? 1 : undefined,
    },
    createdAt: "2026-07-30T07:58:00.000Z",
    createdRevision: "2026-01-01T00:00:00.000Z",
    createdSequence: 2,
    id: input.id,
    lifecycle: {
      duration: input.phase
        ? {
            expiresAt: "phase_boundary",
            kind: "phase",
            phase: input.phase,
            startPhase: input.phase,
            startRound: 1,
            startSequence: 2,
          }
        : {
            creationRoundCounts: true,
            kind: "rounds",
            remaining: 4,
            startRound: 1,
            startSequence: 2,
            transitionBoundary: "round_end_review",
          },
      state: "active",
    },
    lineage: {},
    missingFacts: [],
    ownerParticipantId: input.ownerParticipantId,
    payload: {
      category: input.category,
      contributionScope: "calculation",
      kind: "numeric",
      unit: "percentage",
      value: input.value,
    },
    provenanceCompleteness: "complete",
    publicLabel: input.sourceFamily === "combat_experience" ? "Combat Experience" : "Feint",
    schemaVersion: 1,
    sourceFamily: input.sourceFamily,
    sourceReferences: {
      ...(input.sourceFamily === "observe_relationship"
        ? { relationshipId: "observe:participant-2:participant-1" }
        : {}),
      rowId: input.id,
    },
    version: 1,
    visibility: { audience: "involved", sourceIdentity: "public" },
  });
}

function combatHistorySource(encounter: EncounterSession) {
  return buildCombatHistorySourceViewFromPersistedSession({
    metadata: {
      campaignId: encounter.campaignId,
      createdAt: encounter.createdAt,
      encounterId: encounter.id,
      revision: encounter.updatedAt,
      scenarioId: encounter.scenarioId,
      status: encounter.status,
      title: encounter.title,
    },
    sessionJson: encounter,
  });
}

function encounterMetadata(encounter: EncounterSession) {
  return {
    campaignId: encounter.campaignId,
    createdAt: encounter.createdAt,
    encounterId: encounter.id,
    revision: encounter.updatedAt,
    scenarioId: encounter.scenarioId,
    status: encounter.status,
    title: encounter.title,
    updatedAt: encounter.updatedAt,
    viewVersion: 1 as const,
  };
}

const attackParryDbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:attack-parry:phase1:db-parry",
  notes: "single attack",
  scope: "until",
  sourceActionId: "attack_parry",
  sourcePhase: "phase1",
  sourceRule: "attack-parry-db-parry-phase1",
  value: -4,
};
const attackParryDbParryModifier = expect.objectContaining({
  generated: true,
  sourceActionId: "attack_parry",
  sourcePhase: "phase1",
  value: -4,
});
const parryAttackDbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:parry-attack:phase2:db-parry",
  notes: "reactive attack",
  scope: "until",
  sourceActionId: "parry_attack",
  sourcePhase: "phase2",
  sourceRule: "parry-attack-db-parry-phase2",
  value: -4,
};
const parryAttackDbParryModifier = expect.objectContaining({
  generated: true,
  sourceActionId: "parry_attack",
  sourcePhase: "phase2",
  value: -4,
});
const doubleAttackPhase1ObSkillModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase1:ob-skill",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase1",
  sourceRule: "double-attack-ob-skill-phase1",
  value: -1,
};
const doubleAttackPhase2ObSkillModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase2:ob-skill",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase2",
  sourceRule: "double-attack-ob-skill-phase2",
  value: -1,
};
const doubleAttackPhase1DbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase1:db-parry",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase1",
  sourceRule: "double-attack-db-parry-phase1",
  value: -4,
};
const doubleAttackPhase2DbParryModifierEntry = {
  durationRounds: 1,
  generated: true,
  id: "generated:double-attack:phase2:db-parry",
  notes: "double attack",
  scope: "until",
  sourceActionId: "double_attack",
  sourcePhase: "phase2",
  sourceRule: "double-attack-db-parry-phase2",
  value: -4,
};
const adjustRangePhase1DbParryModifierEntry = {
  application: "percentage" as const,
  durationRounds: 1,
  generated: true,
  id: "generated:adjust-range-attack:phase1:db-parry",
  notes: "adjust range",
  scope: "until",
  sourceActionId: "adjust_range_attack",
  sourcePhase: "phase1",
  sourceRule: "adjust-range-phase1-db-parry",
  value: -2,
};
const doubleAttackPhase1ObSkillModifier = expect.objectContaining(
  doubleAttackPhase1ObSkillModifierEntry,
);
const doubleAttackPhase2ObSkillModifier = expect.objectContaining(
  doubleAttackPhase2ObSkillModifierEntry,
);
const doubleAttackPhase1DbParryModifier = expect.objectContaining({
  generated: true,
  sourceActionId: "double_attack",
  sourcePhase: "phase1",
  value: -4,
});
const doubleAttackPhase2DbParryModifier = expect.objectContaining({
  generated: true,
  sourceActionId: "double_attack",
  sourcePhase: "phase2",
  value: -4,
});
const adjustRangePhase1DbParryModifier = expect.objectContaining(
  adjustRangePhase1DbParryModifierEntry,
);
const adjustRangePhase2AttackPenalty = expect.objectContaining({
  application: "percentage",
  generated: true,
  sourceActionId: "adjust_range_attack",
  sourcePhase: "phase2",
  sourceRule: "attack-phase-defensive-penalty:ordinary_committed_attack",
  value: -4,
});

async function buildScenarioTestApp() {
  const app = Fastify({
    logger: false,
  });
  app.addHook("preValidation", async (request) => {
    if (request.method !== "POST" || !request.url.includes("/combat")) return;
    const body = request.body;
    const record =
      body && typeof body === "object" && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : {};
    if (body !== record) {
      (request as { body: unknown }).body = record;
    }
    if (request.url.endsWith("/combat-declaration")) {
      record.expectedParticipantRevision ??= "2026-07-30T08:00:00.000Z";
    }
    // Route tests exercise browser-like requests. Older fixtures predate canonical attack-source
    // serialization, so supply the same explicit unarmed source a declaration editor would send.
    // Tests for missing lineage can still pass an explicit empty phaseAttackSources object.
    if (
      request.url.endsWith("/combat-declaration") &&
      record.phaseAttackSources === undefined &&
      typeof record.actionId === "string"
    ) {
      const phaseAttackSources: Record<string, unknown> = {};
      if (record.actionId === "attack_parry" || record.actionId === "double_attack") {
        phaseAttackSources.phase1 = makeUnarmedAttackSourceRef({
          opportunitySlot: "attack_1",
          templateId: "virtual-weapon-template-punch",
        });
      }
      if (
        record.actionId === "parry_attack" ||
        record.actionId === "double_attack" ||
        record.actionId === "feint_attack" ||
        record.actionId === "adjust_range_attack"
      ) {
        phaseAttackSources.phase2 = makeUnarmedAttackSourceRef({
          opportunitySlot: "attack_2",
          templateId: "virtual-weapon-template-kick",
        });
      }
      record.phaseAttackSources = phaseAttackSources;
    }
    const commandBySuffix = new Map<string, readonly string[]>([
      [
        "/combat-declaration",
        ["declare_action", "review_modifiers_phase1", "review_modifiers_phase2"],
      ],
      ["/combat-initiative", ["roll_initiative_phase1", "roll_initiative_phase2"]],
      ["/combat-round/combat-experience-difficulty", ["set_combat_experience_difficulty"]],
      ["/combat-round/roll-combat-experience", ["roll_combat_experience"]],
      ["/combat-round/double-attack-phase2-decision", ["decide_double_attack_phase2"]],
      ["/combat-round/respond-adjust-distance", ["respond_adjust_distance"]],
      ["/combat-round/review-adjust-distance", ["review_adjust_distance_roll_adjustment"]],
      ["/combat-round/roll-adjust-distance", ["roll_adjust_distance"]],
      ["/combat-round/commit-adjust-distance", ["commit_adjust_distance"]],
      ["/combat-round/review-break-off", ["review_break_off"]],
      ["/combat-round/roll-break-off", ["roll_break_off"]],
      ["/combat-round/commit-break-off", ["commit_break_off"]],
      ["/combat-round/roll-disarm", ["roll_disarm"]],
      ["/combat-round/commit-disarm", ["commit_disarm"]],
      ["/combat-round/roll-feint", ["roll_feint"]],
      ["/combat-round/commit-feint", ["commit_feint_result"]],
      ["/combat-round/roll-distance-control", ["roll_round_end_distance_control"]],
      ["/combat-round/roll-current-distance-control", ["roll_round_end_distance_control"]],
      ["/combat-round/roll-continued-contact-maintenance", ["roll_continued_contact_maintenance"]],
      ["/combat-round/commit-distance-control", ["commit_round_end_distance_control"]],
      ["/combat-round/commit-participant-review", ["commit_round_end_participant_review"]],
      ["/combat-round/roll-health-check", ["roll_round_end_health_check"]],
      ["/combat-round/back-out-phase-attack", ["submit_phase_initiative_choice"]],
      ["/combat-round/continue-phase-attack", ["submit_phase_initiative_choice"]],
      ["/combat-round/prepare-round-end-review", ["prepare_round_end_review"]],
      ["/combat-round/commit-phase-initiative-resolution", ["commit_phase_initiative_resolution"]],
      ["/combat-round/roll-attack", ["roll_attack"]],
      ["/combat-round/roll-parry", ["roll_parry"]],
    ]);
    const entry = [...commandBySuffix].find(([suffix]) => request.url.endsWith(suffix));
    if (!entry) return;

    const encounterImplementation = mocks.encounterService.getEncounterById.getMockImplementation();
    const encounter = encounterImplementation
      ? ((await encounterImplementation(request.url.split("/encounters/")[1]?.split("/")[0])) as
          | EncounterSession
          | undefined)
      : undefined;
    if (!encounter) return;
    const participantImplementation =
      mocks.scenarioService.listScenarioParticipants.getMockImplementation();
    const scenarioParticipants = participantImplementation
      ? ((await participantImplementation(encounter.scenarioId)) as Array<Record<string, unknown>>)
      : [];
    const membership = resolveEncounterParticipantMembership({
      encounter,
      scenarioParticipants: scenarioParticipants as Parameters<
        typeof resolveEncounterParticipantMembership
      >[0]["scenarioParticipants"],
    });
    const projectedEncounter = { ...encounter, participants: membership.participants };
    const state = initializeCombatRoundState({ encounter: projectedEncounter });
    const tasks = buildCombatProgressionProjection(state)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.executionGroups)
      .flatMap((group) => group.tasks)
      .filter((task) => entry[1].includes(task.expectedCommand));
    const requestedParticipantId =
      typeof record.scenarioParticipantId === "string" ? record.scenarioParticipantId : undefined;
    const requestedScenarioParticipant = scenarioParticipants.find(
      (participant) => participant.id === requestedParticipantId,
    );
    record.expectedParticipantRevision ??= requestedScenarioParticipant?.updatedAt;
    const canonicalParticipantId = projectedEncounter.participants.find(
      (participant) =>
        participant.id === requestedParticipantId ||
        participant.scenarioParticipantId === requestedParticipantId ||
        participant.characterId === requestedParticipantId,
    )?.id;
    const selected =
      tasks.find(
        (task) =>
          (!canonicalParticipantId ||
            (task.owner?.kind === "combatant" &&
              task.owner.participantId === canonicalParticipantId) ||
            task.identity.participantId === canonicalParticipantId) &&
          (typeof record.proposalId !== "string" ||
            task.identity.proposalId === record.proposalId) &&
          (typeof record.distanceProposalId !== "string" ||
            task.identity.proposalId === record.distanceProposalId) &&
          (typeof record.phase !== "string" || task.identity.phase === record.phase),
      ) ?? tasks[0];
    if (!selected) {
      if (entry[1].includes("roll_attack") && canonicalParticipantId) {
        const phase = record.phase === "phase2" ? "phase2" : "phase1";
        const declaration = state.participants.find(
          (participant) => participant.participantId === canonicalParticipantId,
        )?.declaration;
        const opportunity =
          declaration?.attackOpportunities?.find((candidate) => candidate.phase === phase) ??
          getCombatRoundPhaseAttackCandidates({ phase, state }).find(
            (candidate) => candidate.participantId === canonicalParticipantId,
          );
        const identity = opportunity
          ? getCanonicalAttackOpportunityIdentity({
              actionId: declaration?.actionId,
              attackerParticipantId: canonicalParticipantId,
              opportunity,
              roundNumber: state.roundNumber,
            })
          : undefined;
        if (identity) {
          record.actionId ??= identity.actionId;
          record.attackIndex ??= identity.attackIndex;
          record.attackModeId ??= identity.attackModeId;
          record.declarationId ??= identity.declarationId;
          record.opportunityId ??= identity.opportunityId;
          record.weaponInstanceId ??= identity.weaponInstanceId;
          record.weaponSourceId ??= identity.weaponSourceId;
          record.weaponSourceSlot ??= identity.weaponSourceSlot;
          record.weaponTemplateId ??= identity.weaponTemplateId;
        }
      }
      record.executionGroupId ??= `test:missing:${entry[1][0]}:group`;
      record.expectedRevision ??= encounter.updatedAt;
      record.taskId ??= `test:missing:${entry[1][0]}:task`;
      if (entry[1].includes("roll_attack") || entry[1].includes("decide_double_attack_phase2")) {
        record.opportunityId ??= "test:missing:opportunity";
      }
      if (request.url.endsWith("/combat-round/roll-current-distance-control")) {
        record.opponentParticipantId ??= "test:missing:opponent";
        record.pairId ??= "test:missing:pair";
        record.participantId ??= "test:missing:participant";
        record.proposalId ??= "test:missing:proposal";
      }
      return;
    }

    record.executionGroupId ??= selected.executionGroupId;
    record.expectedRevision ??= encounter.updatedAt;
    record.taskId ??= selected.id;
    record.actionId ??= selected.identity.actionId;
    record.attackIndex ??= selected.identity.attackIndex;
    record.attackModeId ??= selected.identity.attackModeId;
    record.declarationId ??= selected.identity.declarationId;
    record.opportunityId ??= selected.identity.opportunityId;
    record.attackResultId ??= selected.identity.attackResultId;
    record.contestId ??= selected.identity.contestId;
    record.continuedContactId ??= selected.identity.continuedContactId;
    record.opponentParticipantId ??= selected.identity.opponentParticipantId;
    record.pairId ??= selected.identity.pairId;
    record.participantId ??=
      selected.owner?.kind === "combatant"
        ? selected.owner.participantId
        : selected.identity.participantId;
    record.attackerParticipantId ??=
      selected.identity.attackerParticipantId ??
      (selected.kind === "parry" ? selected.identity.opponentParticipantId : undefined);
    record.defenderParticipantId ??=
      selected.identity.defenderParticipantId ??
      (selected.kind === "parry" ? record.participantId : undefined);
    record.phase ??= selected.identity.phase;
    record.proposalId ??= selected.identity.proposalId;
    record.processId ??= selected.processId;
    record.rollPurpose ??= selected.identity.rollPurpose;
    record.stageId ??= selected.stageId;
    record.weaponInstanceId ??= selected.identity.weaponInstanceId;
    record.weaponSourceId ??= selected.identity.weaponSourceId;
    record.weaponSourceSlot ??= selected.identity.weaponSourceSlot;
    record.weaponTemplateId ??= selected.identity.weaponTemplateId;
  });
  await app.register(scenariosRoutes);
  return app;
}

function testCombatPhaseContext(targetParticipantId: string) {
  return {
    modifierBuckets: {
      general: [],
      situationDb: [],
      situationInitiative: [],
      situationObSkill: [],
    },
    targetParticipantId,
  };
}

function makeTwoCombatEncounterParticipants() {
  return [
    makeCombatEncounter().participants[0],
    {
      ...makeCombatEncounter().participants[0],
      id: "encounter-participant-2",
      label: "City guard",
      scenarioParticipantId: "participant-2",
    },
  ];
}

function makeEncounterCombatParticipant(input: {
  id: string;
  label: string;
  order: number;
  scenarioParticipantId: string;
}) {
  return {
    ...makeCombatEncounter().participants[0],
    id: input.id,
    label: input.label,
    order: input.order,
    scenarioParticipantId: input.scenarioParticipantId,
  };
}

function makeFourCombatEncounterParticipants() {
  return [
    makeEncounterCombatParticipant({
      id: "encounter-participant-1",
      label: "The Gladiator",
      order: 0,
      scenarioParticipantId: "participant-1",
    }),
    makeEncounterCombatParticipant({
      id: "encounter-participant-2",
      label: "City guard",
      order: 1,
      scenarioParticipantId: "participant-2",
    }),
    makeEncounterCombatParticipant({
      id: "encounter-participant-3",
      label: "North archer",
      order: 2,
      scenarioParticipantId: "participant-3",
    }),
    makeEncounterCombatParticipant({
      id: "encounter-participant-4",
      label: "South archer",
      order: 3,
      scenarioParticipantId: "participant-4",
    }),
  ];
}

function addPrivateDamageReviewToResolution(input: {
  attackResultId: string;
  state: CombatRoundState;
}): CombatRoundState {
  return {
    ...input.state,
    phaseResolutionResults: input.state.phaseResolutionResults.map((result) =>
      result.attackResultId === input.attackResultId && result.damageResult
        ? {
            ...result,
            damageResult: {
              ...result.damageResult,
              review: {
                ...(result.damageResult.review ?? {}),
                additionalEffects: result.damageResult.review?.additionalEffects ?? [],
                notes: "secret-gm-review",
                operationalConsequences: result.damageResult.review?.operationalConsequences ?? [],
                reviewedAt: "2026-01-01T00:05:30.000Z",
                reviewedByUserId: "gm-1",
                totalDamageOverride: result.damageResult.totalDamage + 1,
              },
            },
          }
        : result,
    ),
  };
}

function commitTestDefenseReview(input: {
  attackResult: Parameters<typeof recordCanonicalCombatRoundParryResult>[0]["attackResult"];
  sources?: CombatDefenseSnapshot["sources"];
  state: CombatRoundState;
}): CombatRoundState {
  const canonicalAttack = getCombatRoundOutgoingAttackResultForParticipantPhase({
    participantId: input.attackResult.attackerParticipantId,
    phase: input.attackResult.phase,
    state: input.state,
  });
  if (!canonicalAttack?.attackOpportunityId) {
    throw new Error("Test attack requires a canonical attack opportunity.");
  }
  const attackResultId = getCombatRoundAttackResultId({
    result: canonicalAttack,
    roundNumber: input.state.roundNumber,
  });
  return recordCombatRoundDefenseReview({
    command: { createdAt: canonicalAttack.rolledAt, createdByUserId: "gm-1" },
    snapshot: combatDefenseSnapshotSchema.parse({
      attackDirection: "front",
      attackerParticipantId: canonicalAttack.attackerParticipantId,
      attackId: attackResultId,
      attackOpportunityId: canonicalAttack.attackOpportunityId,
      aware: true,
      awarenessDefault: true,
      awarenessOverridden: false,
      defenderParticipantId: canonicalAttack.defenderParticipantId,
      id: buildCombatDefenseSnapshotId(attackResultId),
      ordinaryDodgeAvailable: true,
      phase: canonicalAttack.phase,
      reviewedAt: canonicalAttack.rolledAt,
      reviewedByUserId: "gm-1",
      roundNumber: input.state.roundNumber,
      schemaVersion: 1,
      sources: input.sources ?? [],
      status: "committed",
    }),
    state: input.state,
  });
}

function recordCombatRoundParryResult(
  input: Parameters<typeof recordCanonicalCombatRoundParryResult>[0],
) {
  const attackResultId = getCombatRoundAttackResultId({
    result: input.attackResult,
    roundNumber: input.state.roundNumber,
  });
  const state = input.state.phaseResolutionResults.find(
    (resolution) => resolution.attackResultId === attackResultId,
  )?.defenseSnapshotId
    ? input.state
    : commitTestDefenseReview({ attackResult: input.attackResult, state: input.state });
  return recordCanonicalCombatRoundParryResult({ ...input, state });
}

function makeCriticalRollMutationFixture(options: { c1?: boolean } = {}) {
  const encounterParticipants = makeTwoCombatEncounterParticipants();
  const combatEncounter = makeCombatEncounter({
    participants: encounterParticipants,
  }) as EncounterSession;
  const attackHit = buildCombatRoundAttackRollResult({
    actionId: "attack_parry",
    attackOpportunityId: "test-opportunity:critical-fixture",
    attackerParticipantId: "encounter-participant-1",
    defenderDb: 10,
    defenderParticipantId: "encounter-participant-2",
    ob: 10,
    phase: "phase1",
    rollD20: 14,
    rollTotal: 14,
    rolledAt: "2026-01-01T00:03:00.000Z",
    weaponCriticalCode: options.c1 ? "FS" : undefined,
    weaponDamageClass: options.c1 ? "edged" : undefined,
    weaponName: "Broad sword",
  });
  const afterAttack = recordCombatRoundAttackResult({
    command: {
      createdAt: attackHit.rolledAt,
      createdByUserId: "gm-1",
    },
    participantId: "encounter-participant-1",
    result: attackHit,
    state: initializeCombatRoundState({ encounter: combatEncounter }),
    submittedBy: "gm",
  });
  const afterParry = recordCombatRoundParryResult({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:04:00.000Z",
      createdByUserId: "gm-1",
    },
    parryResolution: {
      combinedParryScore: 9,
      modifierAdjustment: 0,
      openEndedD10s: [],
      resultLabel: "Parry failed",
      rollD20: 8,
      rollTotal: 8,
      status: "resolved",
      success: false,
      targetNumber: 21,
      total: 17,
    },
    state: afterAttack,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:00.000Z",
  });
  const afterLocation = recordCombatRoundHitLocationRoll({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:04:30.000Z",
      createdByUserId: "gm-1",
    },
    hitLocationRolls: [12],
    rolledByParticipantId: "encounter-participant-1",
    state: afterParry,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:30.000Z",
  });
  const afterDamage = recordCombatRoundDamageResult({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:05:00.000Z",
      createdByUserId: "gm-1",
    },
    defenderDm: 0,
    dmb: 8,
    state: afterLocation,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:05:00.000Z",
  });
  const attackResultId = getCombatRoundAttackResultId({ result: attackHit, roundNumber: 1 });

  return {
    attackResultId,
    encounterParticipants,
    scenarioParticipants: [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
    ],
    state: addPrivateDamageReviewToResolution({
      attackResultId,
      state: afterDamage,
    }),
    stateAfterLocation: afterLocation,
  };
}

function makeGrazeDamageMutationFixture() {
  const encounterParticipants = makeTwoCombatEncounterParticipants();
  const combatEncounter = makeCombatEncounter({
    participants: encounterParticipants,
  }) as EncounterSession;
  const attackGraze = buildCombatRoundAttackRollResult({
    actionId: "attack_parry",
    attackOpportunityId: "test-opportunity:graze-fixture",
    attackerParticipantId: "encounter-participant-1",
    defenderDb: 0,
    defenderParticipantId: "encounter-participant-2",
    ob: 0,
    phase: "phase1",
    rollD20: 11,
    rollTotal: 11,
    rolledAt: "2026-01-01T00:03:00.000Z",
    weaponName: "Broad sword",
  });
  const afterAttack = recordCombatRoundAttackResult({
    command: { createdAt: attackGraze.rolledAt, createdByUserId: "player-1" },
    participantId: "encounter-participant-1",
    result: attackGraze,
    state: initializeCombatRoundState({ encounter: combatEncounter }),
    submittedBy: "player",
  });
  const afterParry = recordCombatRoundParryResult({
    attackResult: attackGraze,
    command: { createdAt: "2026-01-01T00:04:00.000Z", createdByUserId: "other-player" },
    parryResolution: {
      combinedParryScore: 1,
      modifierAdjustment: 0,
      openEndedD10s: [],
      resultLabel: "Parry failed",
      rollD20: 1,
      rollTotal: 1,
      status: "resolved",
      success: false,
      targetNumber: 21,
      total: 1,
    },
    state: afterAttack,
    submittedBy: "player",
    updatedAt: "2026-01-01T00:04:00.000Z",
  });
  const afterLocation = recordCombatRoundHitLocationRoll({
    attackResult: attackGraze,
    command: { createdAt: "2026-01-01T00:04:30.000Z", createdByUserId: "player-1" },
    hitLocationRolls: [12],
    rolledByParticipantId: "encounter-participant-1",
    state: afterParry,
    submittedBy: "player",
    updatedAt: "2026-01-01T00:04:30.000Z",
  });

  return {
    attackGraze,
    encounterParticipants,
    scenarioParticipants: [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
    ],
    stateAfterLocation: afterLocation,
  };
}

function buildDownstreamTaskPayload(
  state: CombatRoundState,
  expectedCommand: "commit_phase_damage" | "resolve_damage" | "roll_critical" | "roll_hit_location",
) {
  const task = buildCombatProgressionProjection(state)
    .boundary.processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
    .find((candidate) => candidate.expectedCommand === expectedCommand);
  if (!task) throw new Error(`Expected ${expectedCommand} progression task.`);
  return {
    attackResultId: task.identity.attackResultId,
    attackerParticipantId: task.identity.attackerParticipantId,
    commandType: expectedCommand,
    criticalResultId: task.identity.criticalResultId,
    damageRollExpression: task.identity.damageRollExpression,
    damageReviewId: task.identity.damageReviewId,
    defenderParticipantId: task.identity.defenderParticipantId,
    executionGroupId: task.executionGroupId,
    expectedRevision: "2026-01-01T00:00:00.000Z",
    hitLocationResultId: task.identity.hitLocationResultId,
    opportunityId: task.identity.opportunityId,
    phase: task.identity.phase,
    taskId: task.id,
  };
}

function buildBoundaryTaskPayload(
  state: CombatRoundState,
  expectedRevision: string,
  targetBoundary: CombatProgressionBoundaryKind,
) {
  const task = buildCombatProgressionProjection(state)
    .boundary.processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
    .find(
      (candidate) =>
        candidate.kind === "gm_advance_boundary" &&
        candidate.transition?.targetBoundary === targetBoundary,
    );
  if (!task) throw new Error(`Expected boundary task targeting ${targetBoundary}.`);
  if (
    task.expectedCommand !== "advance_combat_boundary" &&
    task.expectedCommand !== "complete_round"
  ) {
    throw new Error("Expected a canonical boundary command.");
  }
  return {
    commandType: task.expectedCommand,
    executionGroupId: task.executionGroupId,
    expectedRevision,
    taskId: task.id,
  };
}

function makeCombatReadProjectionFixture() {
  const encounterParticipants = makeFourCombatEncounterParticipants();
  const combatEncounter = makeCombatEncounter({
    participants: encounterParticipants,
  }) as EncounterSession;
  const attackHit = buildCombatRoundAttackRollResult({
    actionId: "attack_parry",
    attackOpportunityId: "test-opportunity:read-projection",
    attackerParticipantId: "encounter-participant-1",
    defenderDb: 10,
    defenderParticipantId: "encounter-participant-2",
    ob: 10,
    phase: "phase1",
    rollD20: 14,
    rollTotal: 14,
    rolledAt: "2026-01-01T00:03:00.000Z",
    weaponName: "Broad sword",
  });
  const afterAttack = recordCombatRoundAttackResult({
    command: {
      createdAt: attackHit.rolledAt,
      createdByUserId: "gm-1",
    },
    participantId: "encounter-participant-1",
    result: attackHit,
    state: initializeCombatRoundState({ encounter: combatEncounter }),
    submittedBy: "gm",
  });
  const afterParry = recordCombatRoundParryResult({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:04:00.000Z",
      createdByUserId: "gm-1",
    },
    parryResolution: {
      combinedParryScore: 9,
      modifierAdjustment: 0,
      openEndedD10s: [],
      resultLabel: "Parry failed",
      rollD20: 8,
      rollTotal: 8,
      status: "resolved",
      success: false,
      targetNumber: 21,
      total: 17,
    },
    state: afterAttack,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:00.000Z",
  });
  const afterLocation = recordCombatRoundHitLocationRoll({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:04:30.000Z",
      createdByUserId: "gm-1",
    },
    hitLocationRolls: [12],
    rolledByParticipantId: "encounter-participant-1",
    state: afterParry,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:04:30.000Z",
  });
  const afterDamage = recordCombatRoundDamageResult({
    attackResult: attackHit,
    command: {
      createdAt: "2026-01-01T00:05:00.000Z",
      createdByUserId: "gm-1",
    },
    defenderDm: 0,
    dmb: 8,
    state: afterLocation,
    submittedBy: "gm",
    updatedAt: "2026-01-01T00:05:00.000Z",
  });
  const attackResultId = getCombatRoundAttackResultId({ result: attackHit, roundNumber: 1 });

  return {
    attackResultId,
    encounterParticipants,
    scenarioParticipants: [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "uninvolved-player",
        id: "participant-3",
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "fourth-player",
        id: "participant-4",
      }),
    ],
    state: addPrivateDamageReviewToResolution({
      attackResultId,
      state: afterDamage,
    }),
  };
}

function makeOpenPhase1AttackRoundState(
  input: {
    distance?: number;
    modifierEntries?: Array<Record<string, unknown>>;
    snapshotOb?: string;
    snapshotWeaponName?: string;
  } = {},
) {
  const stepStatuses = {
    initiative_phase_1: "submitted",
    initiative_phase_2: "pending",
    phase_1_actions: "submitted",
    phase_2_actions: "pending",
    review_action_modifiers: "complete",
    review_phase_2_actions: "pending",
    review_phase_2_damage: "pending",
    review_phase_2_modifiers: "pending",
    round_summary: "pending",
    select_actions: "submitted",
  };
  const modifierEntries = input.modifierEntries ?? [];
  const modifierTotal = modifierEntries.reduce(
    (sum, entry) => sum + (typeof entry.value === "number" ? entry.value : 0),
    0,
  );

  return {
    ...(input.distance === undefined
      ? {}
      : {
          distanceState: setDistanceBetween({
            distance: input.distance,
            participantAId: "encounter-participant-1",
            participantBId: "encounter-participant-2",
            source: "gm_set",
          }),
        }),
    commands: [
      {
        afterCursor: {
          participantId: "encounter-participant-1",
          roundNumber: 1,
          step: "i1",
        },
        beforeCursor: {
          participantId: "encounter-participant-1",
          roundNumber: 1,
          step: "i1",
        },
        createdAt: "2026-01-01T00:01:30.000Z",
        facts: {},
        id: "command-i1",
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "i1",
        type: "roll_initiative_phase1",
      },
    ],
    currentCursor: {
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "A1",
    },
    currentStep: "phase_1_actions",
    participants: [
      {
        attackResults: {},
        declaration: {
          actionId: "attack_parry",
          attackOpportunities: buildCombatRoundDeclaredAttackOpportunities({
            actionId: "attack_parry",
            participantId: "encounter-participant-1",
            phaseContexts: {
              phase1: testCombatPhaseContext("encounter-participant-2"),
            },
            roundNumber: 1,
            sources: {
              phase1: {
                attackModeId: "mode-1",
                sourceKind: "unarmed",
                weaponSourceId: "unarmed:virtual-weapon-template-punch",
                weaponSourceSlot: "virtual",
                weaponTemplateId: "virtual-weapon-template-punch",
              },
            },
          }),
          phaseContexts: {
            phase1: {
              targetParticipantId: "participant-2",
            },
          },
          roundNumber: 1,
          submittedAt: "2026-01-01T00:01:00.000Z",
          submittedBy: "player",
        },
        initiatives: {
          phase1: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [6],
            rollTotal: 6,
            total: 6,
          },
        },
        label: "The Gladiator",
        participantId: "encounter-participant-1",
        stepStatuses,
      },
      {
        attackResults: {},
        initiatives: {
          phase1: {
            baseInitiative: 0,
            modifierAdjustment: 0,
            rolls: [4],
            rollTotal: 4,
            total: 4,
          },
        },
        label: "City guard",
        participantId: "encounter-participant-2",
        stepStatuses,
      },
    ],
    phaseResolutionCursor: {
      participantId: "encounter-participant-1",
      phase: "phase1",
      substep: "attack",
    },
    phaseResolutionResults: [],
    phaseResolutionStatuses: {},
    roundNumber: 1,
    stepSnapshots: [
      {
        attackSummary: {
          attackMode: "C",
          dmb: "8",
          initiative: "3",
          maxCrits: "FS",
          ob: input.snapshotOb ?? "10",
          weaponName: input.snapshotWeaponName ?? "Long sword",
        },
        committedAt: "2026-01-01T00:02:00.000Z",
        id: "snapshot-attack",
        ...(modifierEntries.length > 0
          ? {
              modifierSummary: {
                dbRaw: 0,
                generalFatigueRaw: 0,
                initiativeRaw: 0,
                obSkillRaw: modifierTotal,
                rows: [
                  {
                    bucketKey: "situation_ob_skill",
                    entries: modifierEntries,
                    label: "Skill/OB",
                    total: modifierTotal,
                  },
                ],
              },
            }
          : {}),
        participantId: "encounter-participant-1",
        participantLabel: "The Gladiator",
        phase: "phase1",
        roundNumber: 1,
        step: "phase_1_actions",
      },
      {
        committedAt: "2026-01-01T00:02:00.000Z",
        defenseSummary: {
          db: "11",
          dm: "0",
          parry: "9",
          sourceName: "Sword / shield",
        },
        id: "snapshot-defense",
        participantId: "encounter-participant-2",
        participantLabel: "City guard",
        phase: "phase1",
        roundNumber: 1,
        step: "phase_1_actions",
      },
    ],
  };
}

function makeCombatScenarioParticipant(overrides: Record<string, unknown> = {}) {
  return {
    controlledByUserId: "player-1",
    id: "participant-1",
    isActive: true,
    role: "player_character",
    scenarioId: "scenario-1",
    snapshot: {
      displayName: "The Gladiator",
    },
    sourceType: "character",
    updatedAt: "2026-07-30T08:00:00.000Z",
    state: {
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
      },
      conditions: [],
      equipment: {},
      health: {},
      modifiers: [],
      resources: {},
    },
    ...overrides,
  };
}

function makeCanonicalAttackModifierParticipantState() {
  return {
    ...makeCombatScenarioParticipant().state,
    combat: {
      combatContext: {
        modifierBuckets: {
          general: [{ id: "general-not-ob", scope: "until", value: 99 }],
          situationDb: [],
          situationInitiative: [],
          situationObSkill: [
            {
              id: "import:character_effect:skill-ob:skill_ob",
              imported: true,
              readOnly: true,
              scope: "until",
              sourceEffectId: "skill-ob",
              sourceType: "character_effect",
              value: 2,
            },
            {
              generated: true,
              id: "generated-phase1-ob",
              scope: "until",
              sourcePhase: "phase1",
              value: -1,
            },
            { id: "manual-ob", scope: "until", value: 1 },
            {
              generated: true,
              id: "other-phase-ob",
              scope: "until",
              sourcePhase: "phase2",
              value: 99,
            },
          ],
        },
      },
    },
  };
}

function makePostAdjustDistanceAttackFixture() {
  const distanceSkillObEntry = {
    durationRounds: 1,
    generated: true,
    id: "generated:distance:phase1:ob-skill",
    notes: "short distance",
    scope: "until",
    sourceActionId: "attack_parry",
    sourceEncounterId: "encounter-1",
    sourcePhase: "phase1",
    sourceRoundNumber: 1,
    sourceRule: "distance-ob-skill-phase1",
    value: -2,
  };
  const adjustDistanceDbEntry = {
    ...adjustRangePhase1DbParryModifierEntry,
    expiresAtRound: 1,
    sourceEncounterId: "encounter-1",
    sourceRoundNumber: 1,
  };
  const roundState = combatRoundStateSchema.parse(
    makeOpenPhase1AttackRoundState({
      distance: 2,
      modifierEntries: [distanceSkillObEntry],
      snapshotOb: "8",
    }),
  );
  roundState.participants[1].declaration = {
    actionId: "adjust_range_attack",
    adjustDistance: {
      currentDistance: 3,
      requestedDistance: 2,
      targetParticipantId: "encounter-participant-1",
    },
    attackOpportunities: [
      {
        id: "adjust-distance-phase2-attack",
        origin: "adjust_range_attack",
        phase: "phase2",
        slot: "attack_2",
        status: "committed",
        targetParticipantId: "encounter-participant-1",
      },
    ],
    phaseContexts: {
      phase2: {
        modifierBuckets: emptyModifierBuckets(),
        targetParticipantId: "encounter-participant-1",
      },
    },
    roundNumber: 1,
    submittedAt: "2026-01-01T00:01:00.000Z",
    submittedBy: "player",
  };

  return {
    distanceSkillObEntry,
    encounter: {
      combatRoundState: roundState,
      participants: makeTwoCombatEncounterParticipants(),
    },
    participants: [
      makeCombatScenarioParticipant({
        id: "participant-1",
        state: {
          ...makeCombatScenarioParticipant().state,
          combat: {
            combatContext: {
              modifierBuckets: {
                ...emptyModifierBuckets(),
                situationObSkill: [distanceSkillObEntry],
              },
            },
          },
        },
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
        state: {
          ...makeCombatScenarioParticipant().state,
          combat: {
            combatContext: {
              modifierBuckets: {
                ...emptyModifierBuckets(),
                situationDb: [adjustDistanceDbEntry],
              },
            },
          },
        },
      }),
    ],
  };
}

function makeWeaponEquipmentState(input: {
  characterId?: string;
  name: string;
  range: string;
  templateId?: string;
}) {
  const characterId = input.characterId ?? "character-1";
  const canonicalTemplate = weaponTemplates.find((template) => template.name === input.name);
  const templateId =
    input.templateId ??
    canonicalTemplate?.id ??
    `template-${input.name.toLowerCase().replace(/\s+/g, "-")}`;
  const itemId = `item-${templateId}`;

  return {
    activeLoadoutByCharacterId: {
      [characterId]: {
        activePrimaryWeaponItemId: itemId,
      },
    },
    itemsById: {
      [itemId]: {
        id: itemId,
        templateId,
      },
    },
    locationsById: {},
    templates: {
      templatesById: {
        [templateId]: canonicalTemplate ?? {
          category: "weapon",
          id: templateId,
          name: input.name,
          range: input.range,
        },
      },
    },
  };
}

function makeServerWeaponEquipmentState(input: {
  characterId?: string;
  name: string;
  range: string;
  templateId?: string;
}) {
  const webState = makeWeaponEquipmentState(input);

  return {
    activeLoadoutByCharacterId: webState.activeLoadoutByCharacterId,
    itemsById: webState.itemsById,
    locationsById: webState.locationsById,
    templatesById: webState.templates.templatesById,
  };
}

function makeMovementBurdenEquipmentState(input: { characterId: string; load?: number }) {
  const locationId = `location-${input.characterId}-person`;
  const templateId = `template-${input.characterId}-load`;
  const itemId = `item-${input.characterId}-load`;
  return {
    activeLoadoutByCharacterId: {
      [input.characterId]: {
        activeAmmoItemIds: [],
        characterId: input.characterId,
        id: `loadout-${input.characterId}`,
        isActive: true,
        name: "Combat",
        quickAccessItemIds: [],
      },
    },
    itemsById: {
      [itemId]: {
        category: "gear",
        characterId: input.characterId,
        conditionState: "intact",
        id: itemId,
        isStackable: false,
        material: "steel",
        quality: "standard",
        quantity: 1,
        revision: "2026-07-30T07:59:00.000Z",
        specificityType: "generic",
        storageAssignment: { carryMode: "on_person", locationId },
        templateId,
      },
    },
    locationsById: {
      [locationId]: {
        availabilityClass: "with_you",
        characterId: input.characterId,
        id: locationId,
        isAccessibleInEncounter: true,
        isMobile: true,
        name: "On person",
        type: "person_system",
      },
    },
    templatesById: {
      [templateId]: {
        baseEncumbrance: input.load ?? 10,
        baseValue: null,
        category: "gear",
        defaultMaterial: "steel",
        id: templateId,
        name: "Combat load",
        specificityTypeDefault: "generic",
        tags: [],
      },
    },
  };
}

function makeCanonicalWeaponDefenseEquipmentState(input: {
  characterId: string;
  templateId: string;
}) {
  const state = makeMovementBurdenEquipmentState({ characterId: input.characterId });
  const template = weaponTemplates.find((candidate) => candidate.id === input.templateId);
  if (!template) throw new Error(`Missing weapon fixture ${input.templateId}.`);
  const itemId = `item-${input.templateId}`;
  const locationId = `location-${input.characterId}-equipped`;
  const templatesById = { ...state.templatesById, [template.id]: template };

  return {
    ...state,
    activeLoadoutByCharacterId: {
      [input.characterId]: {
        ...state.activeLoadoutByCharacterId[input.characterId],
        activePrimaryWeaponItemId: itemId,
      },
    },
    itemsById: {
      ...state.itemsById,
      [itemId]: {
        acquiredFrom: null,
        category: "weapon",
        characterId: input.characterId,
        conditionState: "intact",
        displayName: null,
        id: itemId,
        isFavorite: false,
        isStackable: false,
        material: "steel",
        quality: "standard",
        quantity: 1,
        revision: "2026-07-30T07:59:00.000Z",
        specificityType: "generic",
        storageAssignment: { carryMode: "equipped", locationId },
        templateId: template.id,
      },
    },
    locationsById: {
      ...state.locationsById,
      [locationId]: {
        availabilityClass: "with_you",
        characterId: input.characterId,
        id: locationId,
        isAccessibleInEncounter: true,
        isMobile: true,
        name: "Equipped",
        type: "equipped_system",
      },
    },
    templates: { templatesById },
    templatesById,
  };
}

function makeCanonicalCombatCalculationSnapshot(input: {
  characterId: string;
  displayName: string;
}) {
  const primary = weaponTemplates.find((candidate) => candidate.name === "Long sword");
  const secondary = weaponTemplates.find((candidate) => candidate.name === "Dagger");
  if (!primary || !secondary) throw new Error("Missing canonical combat calculation fixtures.");
  const state = makeCanonicalWeaponDefenseEquipmentState({
    characterId: input.characterId,
    templateId: primary.id,
  });
  const secondaryItemId = `item-${input.characterId}-${secondary.id}`;
  const secondaryLocationId = `location-${input.characterId}-secondary`;
  const build = makeDodgeCharacterBuild(input.characterId, input.displayName);
  return {
    build: {
      ...build,
      progression: {
        ...build.progression,
        skills: [
          ...build.progression.skills,
          {
            category: "secondary",
            categoryId: "combat",
            groupId: "basic_melee_training",
            secondaryRanks: 8,
            skillId: "parry",
          },
        ],
      },
    },
    displayName: input.displayName,
    equipmentState: {
      ...state,
      activeLoadoutByCharacterId: {
        [input.characterId]: {
          ...state.activeLoadoutByCharacterId[input.characterId],
          activeSecondaryWeaponItemId: secondaryItemId,
        },
      },
      itemsById: {
        ...state.itemsById,
        [secondaryItemId]: {
          acquiredFrom: null,
          category: "weapon",
          characterId: input.characterId,
          conditionState: "intact",
          displayName: null,
          id: secondaryItemId,
          isFavorite: false,
          isStackable: false,
          material: "steel",
          quality: "standard",
          quantity: 1,
          revision: "2026-07-30T07:59:00.000Z",
          specificityType: "generic",
          storageAssignment: { carryMode: "equipped", locationId: secondaryLocationId },
          templateId: secondary.id,
        },
      },
      locationsById: {
        ...state.locationsById,
        [secondaryLocationId]: {
          availabilityClass: "with_you",
          characterId: input.characterId,
          id: secondaryLocationId,
          isAccessibleInEncounter: true,
          isMobile: true,
          name: "Secondary",
          type: "equipped_system",
        },
      },
      templates: {
        templatesById: { ...state.templatesById, [secondary.id]: secondary },
      },
      templatesById: { ...state.templatesById, [secondary.id]: secondary },
    },
    sourceUpdatedAt: "2026-07-30T07:59:00.000Z",
  };
}

function makeCombatScenarioParticipantWithWeapon(
  overrides: Record<string, unknown> & { weaponName?: string; weaponRange?: string } = {},
) {
  const characterId = (overrides.characterId as string | undefined) ?? "character-1";
  const weaponName = overrides.weaponName ?? "Long sword";
  const template = weaponTemplates.find((candidate) => candidate.name === weaponName);
  if (!template) throw new Error(`Missing weapon fixture ${weaponName}.`);

  return makeCombatScenarioParticipant({
    ...overrides,
    characterId,
    snapshot: {
      build: makeDodgeCharacterBuild(characterId, "The Gladiator"),
      displayName: "The Gladiator",
      equipmentState: makeCanonicalWeaponDefenseEquipmentState({
        characterId,
        templateId: template.id,
      }),
      sourceUpdatedAt: "2026-07-30T07:59:00.000Z",
      ...((overrides.snapshot as Record<string, unknown> | undefined) ?? {}),
    },
  });
}

function makeDoubleAttackWeaponParticipant(templateId = "weapon-template-dagger") {
  const template = weaponTemplates.find((candidate) => candidate.id === templateId);
  if (!template) throw new Error(`Missing weapon fixture ${templateId}.`);
  const itemId = `item-${templateId}`;

  return makeCombatScenarioParticipant({
    characterId: "character-1",
    snapshot: {
      displayName: "The Gladiator",
      equipmentState: {
        activeLoadoutByCharacterId: {
          "character-1": { activePrimaryWeaponItemId: itemId },
        },
        itemsById: {
          [itemId]: { id: itemId, templateId },
          [`unready-${itemId}`]: { id: `unready-${itemId}`, templateId },
        },
        locationsById: {},
        templatesById: { [templateId]: template },
      },
    },
  });
}

function makeDoubleAttackTwoWeaponParticipant() {
  const templateIds = ["weapon-template-fencing-sword", "weapon-template-main-gauche"] as const;
  const templates = Object.fromEntries(
    templateIds.map((templateId) => {
      const template = weaponTemplates.find((candidate) => candidate.id === templateId);
      if (!template) throw new Error(`Missing weapon fixture ${templateId}.`);
      return [templateId, template];
    }),
  );

  return makeCombatScenarioParticipant({
    characterId: "character-1",
    snapshot: {
      displayName: "The Gladiator",
      equipmentState: {
        activeLoadoutByCharacterId: {
          "character-1": {
            activePrimaryWeaponItemId: "scenario-fencing-sword",
            activeSecondaryWeaponItemId: "scenario-main-gauche",
          },
        },
        itemsById: {
          "scenario-fencing-sword": {
            id: "scenario-fencing-sword",
            templateId: templateIds[0],
          },
          "scenario-main-gauche": {
            id: "scenario-main-gauche",
            templateId: templateIds[1],
          },
        },
        locationsById: {},
        templatesById: templates,
      },
    },
  });
}

function makeWeaponAttackSourceRef(input: {
  attackModeId?: string;
  itemId: string;
  opportunitySlot: "attack_1" | "attack_2";
  slot?: "primary" | "secondary" | "throwing" | "other";
  templateId: string;
}) {
  return {
    attackModeId: input.attackModeId ?? "mode-1",
    opportunitySlot: input.opportunitySlot,
    scenarioItemId: input.itemId,
    slot: input.slot ?? "primary",
    sourceKind: "weapon",
    templateId: input.templateId,
  } as const;
}

function makeUnarmedAttackSourceRef(input: {
  opportunitySlot: "attack_1" | "attack_2";
  templateId: string;
}) {
  return {
    attackModeId: "mode-1",
    opportunitySlot: input.opportunitySlot,
    slot: "virtual",
    sourceKind: "unarmed",
    templateId: input.templateId,
  } as const;
}

function makeCombatExperienceCharacterBuild(overrides: Record<string, unknown> = {}) {
  return {
    equipment: {
      items: [],
    },
    id: "character-1",
    name: "The Gladiator",
    profile: {
      distractionLevel: 3,
      id: "profile-1",
      label: "The Gladiator",
      rolledStats: {
        cha: 10,
        com: 10,
        con: 10,
        dex: 10,
        health: 10,
        int: 10,
        lck: 10,
        pow: 10,
        siz: 10,
        str: 10,
        will: 10,
      },
      societyLevel: 0,
    },
    progression: {
      chargenMode: "standard",
      educationPoints: 0,
      flexiblePointFactor: 1,
      level: 1,
      primaryPoolSpent: 0,
      primaryPoolTotal: 60,
      secondaryPoolSpent: 11,
      secondaryPoolTotal: 20,
      skillGroups: [],
      skills: [
        {
          category: "secondary",
          categoryId: "military",
          groupId: "veteran_soldiering",
          secondaryRanks: 11,
          skillId: "combat_experience",
        },
      ],
      specializations: [],
    },
    progressionState: {
      availablePoints: 0,
      checks: [],
      history: [],
      pendingAttempts: [],
    },
    statModifiers: {},
    ...overrides,
  };
}

function makeDodgeCharacterBuild(id: string, name: string) {
  const base = makeCombatExperienceCharacterBuild({ id, name });
  return {
    ...base,
    profile: { ...base.profile, id: `profile-${id}`, label: name },
    progression: {
      ...base.progression,
      skills: [
        ...base.progression.skills,
        {
          category: "secondary",
          categoryId: "combat",
          groupId: "basic_melee_training",
          secondaryRanks: 8,
          skillId: "dodge",
        },
      ],
    },
  };
}

function makeCombatEncounter(overrides: Record<string, unknown> = {}) {
  return {
    actionLog: [],
    campaignId: "campaign-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    currentRound: 1,
    currentTurnIndex: 0,
    declarationsLocked: false,
    id: "encounter-1",
    kind: "combat",
    participants: [
      {
        declaration: {
          actionType: "none",
          defenseFocus: "none",
          defensePosture: "none",
          targetLocation: "any",
        },
        facing: "north",
        id: "encounter-participant-1",
        initiative: 0,
        label: "The Gladiator",
        order: 0,
        orientation: "neutral",
        participantType: "scenario",
        position: { x: 0, y: 0, zone: "center" },
        scenarioParticipantId: "participant-1",
      },
    ],
    scenarioId: "scenario-1",
    status: "active",
    title: "A doubtful success",
    turnOrderMode: "manual",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function withResolvedCombatStartExperience(encounter: Record<string, unknown>) {
  const state = initializeCombatRoundState({ encounter: encounter as EncounterSession });

  if (state.roundNumber !== 1) {
    return encounter;
  }

  return {
    ...encounter,
    combatRoundState: {
      ...state,
      participants: state.participants.map((participant) =>
        participant.combatExperience
          ? participant
          : {
              ...participant,
              combatExperience: {
                difficulty: 26,
                difficultyShift: 5,
                durationRounds: 0,
                effectiveTableTotal: 21,
                finalTotal: 26,
                label: "Active",
                modifierValue: 0,
                needsEffectRow: false,
                noRollRequired: true,
                note: "combat exp active",
                openEndedD10s: [],
                resultBand: "active",
                rolledAt: "2026-01-01T00:00:30.000Z",
                roundNumber: state.roundNumber,
                skillTotal: 26,
                trigger: "combat_start",
              },
            },
      ),
    },
  };
}

function makeCombatEncounterWithResolvedCombatExperience(
  overrides: Record<string, unknown> = {},
): EncounterSession {
  return withResolvedCombatStartExperience(makeCombatEncounter(overrides)) as EncounterSession;
}

function makeStepAutomationFixture(input: {
  playerControlledLast?: boolean;
  startStep:
    | "initiative_phase_1"
    | "initiative_phase_2"
    | "review_action_modifiers"
    | "review_phase_2_modifiers";
}) {
  const encounterParticipants = makeFourCombatEncounterParticipants();
  const encounter = makeCombatEncounterWithResolvedCombatExperience({
    participants: encounterParticipants,
  });
  let state = combatRoundStateSchema.parse(encounter.combatRoundState);
  const phase =
    input.startStep === "initiative_phase_2" || input.startStep === "review_phase_2_modifiers"
      ? "phase2"
      : "phase1";
  const actionId = phase === "phase1" ? "attack_parry" : "parry_attack";
  for (const [index, participant] of encounterParticipants.entries()) {
    const target = encounterParticipants[(index + 1) % encounterParticipants.length]!;
    const attackOpportunities = buildCombatRoundDeclaredAttackOpportunities({
      actionId,
      participantId: participant.id,
      phaseContexts: { [phase]: testCombatPhaseContext(target.id) },
      roundNumber: state.roundNumber,
      sources: {
        [phase]: {
          attackModeId: "mode-1",
          sourceKind: "unarmed",
          weaponSourceId:
            phase === "phase1"
              ? "unarmed:virtual-weapon-template-punch"
              : "unarmed:virtual-weapon-template-kick",
          weaponSourceSlot: "virtual",
          weaponTemplateId:
            phase === "phase1" ? "virtual-weapon-template-punch" : "virtual-weapon-template-kick",
        },
      },
    });
    state = recordCombatRoundDeclaration({
      command: {
        createdAt: `2026-08-07T10:00:0${index}.000Z`,
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId,
        attackOpportunities,
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        id: `declaration:${participant.id}`,
        phaseContexts: { [phase]: testCombatPhaseContext(target.id) },
        roundNumber: state.roundNumber,
        submittedAt: `2026-08-07T10:00:0${index}.000Z`,
      },
      participantId: participant.id,
      state,
      submittedBy: "gm",
    });
  }
  for (let guard = 0; guard < 20 && state.currentStep !== "review_action_modifiers"; guard += 1) {
    state = advanceCombatRoundStep(state);
  }
  if (phase === "phase2") {
    state = completeRemainingCombatRoundStep({
      command: { createdAt: "2026-08-07T10:01:00.000Z", createdByUserId: "gm-1" },
      phase: "phase1",
      state,
    }).state;
    for (
      let guard = 0;
      guard < 20 && state.currentStep !== "review_phase_2_modifiers";
      guard += 1
    ) {
      state = advanceCombatRoundStep(state);
    }
  }
  if (input.startStep === "initiative_phase_1" || input.startStep === "initiative_phase_2") {
    state = completeRemainingCombatRoundStep({
      command: { createdAt: "2026-08-07T10:01:30.000Z", createdByUserId: "gm-1" },
      phase,
      state,
    }).state;
    const initiativeStep = phase === "phase1" ? "initiative_phase_1" : "initiative_phase_2";
    for (let guard = 0; guard < 20 && state.currentStep !== initiativeStep; guard += 1) {
      state = advanceCombatRoundStep(state);
    }
  }
  const acceptedEncounter = encounterSessionSchema.parse({
    ...encounter,
    combatRoundState: state,
    currentRound: state.roundNumber,
    updatedAt: "2026-08-07T10:02:00.000Z",
  });
  const participants = encounterParticipants.map((participant, index) => {
    const characterId = `character-${index + 1}`;
    return makeCombatScenarioParticipant({
      characterId,
      controlledByUserId:
        input.playerControlledLast && index === encounterParticipants.length - 1
          ? "player-4"
          : undefined,
      id: participant.scenarioParticipantId,
      role:
        input.playerControlledLast && index === encounterParticipants.length - 1
          ? "player_character"
          : "npc",
      snapshot: {
        build: makeDodgeCharacterBuild(characterId, participant.label),
        displayName: participant.label,
        sourceUpdatedAt: "2026-08-07T09:00:00.000Z",
      },
      state: {
        ...makeCombatScenarioParticipant().state,
        combatEffects: { effects: [], events: [] },
      },
    }) as unknown as ScenarioParticipant;
  });
  return { encounter: acceptedEncounter, participants };
}

function makeDeclarationAutomationFixture(input: {
  attackParticipantIndex?: number;
  inactiveTargetForParticipantIndex?: number;
  manuallyDeclaredCount?: number;
  playerControlledIndex?: number;
}) {
  const encounterParticipants = makeFourCombatEncounterParticipants();
  const roundOneEncounter = makeCombatEncounterWithResolvedCombatExperience({
    participants: encounterParticipants,
  });
  let roundOne = combatRoundStateSchema.parse(roundOneEncounter.combatRoundState);
  for (const [index, participant] of encounterParticipants.entries()) {
    const target = encounterParticipants[(index + 1) % encounterParticipants.length]!;
    const actionId =
      input.inactiveTargetForParticipantIndex === index || input.attackParticipantIndex === index
        ? "attack_parry"
        : "parry";
    const phaseContexts =
      actionId === "attack_parry" ? { phase1: testCombatPhaseContext(target.id) } : undefined;
    const attackOpportunities =
      actionId === "attack_parry"
        ? buildCombatRoundDeclaredAttackOpportunities({
            actionId,
            participantId: participant.id,
            phaseContexts,
            roundNumber: 1,
            sources: {
              phase1: {
                attackModeId: "mode-1",
                sourceKind: "unarmed",
                weaponSourceId: "unarmed:virtual-weapon-template-punch",
                weaponSourceSlot: "virtual",
                weaponTemplateId: "virtual-weapon-template-punch",
              },
            },
          })
        : undefined;
    roundOne = recordCombatRoundDeclaration({
      command: {
        commandId: `round-1-declaration-${index + 1}`,
        createdAt: `2026-08-07T09:00:0${index}.000Z`,
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId,
        attackOpportunities,
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        id: `round:1:participant:${participant.id}:declaration`,
        phaseContexts,
        roundNumber: 1,
        submittedAt: `2026-08-07T09:00:0${index}.000Z`,
      },
      participantId: participant.id,
      state: { ...roundOne, currentStep: "review_action_modifiers" },
      submittedBy: "gm",
    });
  }
  const cleanRoundTwo = initializeCombatRoundState({
    encounter: {
      ...roundOneEncounter,
      combatRoundState: undefined,
      currentRound: 2,
    },
  });
  let roundTwo = combatRoundStateSchema.parse({
    ...cleanRoundTwo,
    roundNumber: 2,
    rounds: [{ ...roundOne, currentStep: "round_summary", roundNumber: 1 }],
  });
  for (let index = 0; index < (input.manuallyDeclaredCount ?? 0); index += 1) {
    const participant = encounterParticipants[index]!;
    roundTwo = recordCombatRoundDeclaration({
      command: {
        commandId: `round-2-manual-declaration-${index + 1}`,
        createdAt: `2026-08-07T10:00:0${index}.000Z`,
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "parry",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        id: `round:2:participant:${participant.id}:declaration`,
        roundNumber: 2,
        submittedAt: `2026-08-07T10:00:0${index}.000Z`,
      },
      participantId: participant.id,
      state: roundTwo,
      submittedBy: "gm",
    });
  }
  const encounter = encounterSessionSchema.parse({
    ...roundOneEncounter,
    combatRoundState: roundTwo,
    currentRound: 2,
    updatedAt: "2026-08-07T10:02:00.000Z",
  });
  const inactiveTargetIndex =
    input.inactiveTargetForParticipantIndex === undefined
      ? undefined
      : (input.inactiveTargetForParticipantIndex + 1) % encounterParticipants.length;
  const participants = encounterParticipants.map((participant, index) => {
    const characterId = `character-${index + 1}`;
    return makeCombatScenarioParticipant({
      characterId,
      controlledByUserId: input.playerControlledIndex === index ? `player-${index + 1}` : undefined,
      id: participant.scenarioParticipantId,
      isActive: inactiveTargetIndex !== index,
      role: input.playerControlledIndex === index ? "player_character" : "npc",
      snapshot: {
        build: makeDodgeCharacterBuild(characterId, participant.label),
        displayName: participant.label,
        sourceUpdatedAt: "2026-08-07T09:00:00.000Z",
      },
      state: {
        ...makeCombatScenarioParticipant().state,
        combatEffects: { effects: [], events: [] },
      },
    }) as unknown as ScenarioParticipant;
  });
  return { encounter, participants };
}

function makeCombatExperienceAutomationFixture(input: {
  difficultyFixed?: boolean;
  participantCount?: number;
  playerControlledIndex?: number;
  warningIndex?: number;
}) {
  const participantCount = input.participantCount ?? 4;
  const encounterParticipants = Array.from({ length: participantCount }, (_, index) =>
    makeEncounterCombatParticipant({
      id: `encounter-participant-${index + 1}`,
      label: `NPC ${index + 1}`,
      order: index,
      scenarioParticipantId: `participant-${index + 1}`,
    }),
  );
  const baseEncounter = encounterSessionSchema.parse(
    makeCombatEncounter({ participants: encounterParticipants }),
  );
  const initial = initializeCombatRoundState({ encounter: baseEncounter });
  const state = input.difficultyFixed
    ? setCombatRoundCombatExperienceDifficulty({ difficulty: 26, state: initial })
    : initial;
  const encounter = encounterSessionSchema.parse({
    ...baseEncounter,
    combatRoundState: state,
    updatedAt: "2026-08-08T10:00:00.000Z",
  });
  const participants = encounterParticipants.map(
    (participant, index) =>
      makeCombatScenarioParticipant({
        controlledByUserId:
          input.playerControlledIndex === index ? `player-${index + 1}` : undefined,
        id: participant.scenarioParticipantId,
        role: input.playerControlledIndex === index ? "player_character" : "npc",
        snapshot: {
          displayName: participant.label,
          sheetSummary: {
            skills: [
              input.warningIndex === index
                ? { effectiveSkillNumber: 11, skillId: "combat_experience" }
                : { skillId: "combat_experience", totalSkill: 11 },
            ],
          },
        },
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: { effects: [], events: [] },
        },
      }) as unknown as ScenarioParticipant,
  );
  return { encounter, participants };
}

function makeHealthAutomationFixture(input: {
  effectDecisionIndex?: number;
  participantCount?: number;
  playerControlledIndex?: number;
  legacyIndex?: number;
}) {
  const participantCount = input.participantCount ?? 5;
  const encounterParticipants = Array.from({ length: participantCount }, (_, index) =>
    makeEncounterCombatParticipant({
      id: `encounter-participant-${index + 1}`,
      label: `NPC ${index + 1}`,
      order: index,
      scenarioParticipantId: `participant-${index + 1}`,
    }),
  );
  const baseEncounter = makeCombatEncounter({
    currentRound: 10,
    participants: encounterParticipants,
  }) as EncounterSession;
  const baseState = initializeCombatRoundState({ encounter: baseEncounter });
  const effectsByParticipant = Object.fromEntries(
    encounterParticipants.map((participant, index) => {
      const effectId = `bleed-${index + 1}`;
      const effect = {
        ...(input.legacyIndex === index
          ? {}
          : {
              canonicalLifecycle: buildDamagePersistentLifecycle({
                context: {
                  commandId: `damage-command-${index + 1}`,
                  createdAt: "2026-08-09T09:00:00.000Z",
                  createdRevision: "revision-created",
                  createdSequence: index + 1,
                  encounterId: baseEncounter.id,
                  eventId: `bleed-event-${index + 1}`,
                  ownerParticipantId: participant.scenarioParticipantId,
                  roundNumber: 1,
                },
                effectId,
                isStunned: false,
                label: "Bleed",
                modifierValue: 2,
                status: "active",
                type: "bleed",
              }),
            }),
        createdAt: "2026-08-09T09:00:00.000Z",
        effectGroup: "bleed" as const,
        id: effectId,
        modifierValue: 2,
        roundNumber: 1,
        sourceEventId: `bleed-event-${index + 1}`,
        status: "active" as const,
        targetParticipantId: participant.scenarioParticipantId,
        type: "bleed" as const,
        updatedAt: "2026-08-09T09:00:00.000Z",
      };
      const decisionEffectId = `decision-effect-${index + 1}`;
      const decisionEffect =
        input.effectDecisionIndex === index
          ? {
              canonicalLifecycle: buildDamagePersistentLifecycle({
                context: {
                  commandId: `decision-command-${index + 1}`,
                  createdAt: "2026-08-09T09:00:00.000Z",
                  createdRevision: "revision-created",
                  createdSequence: participantCount + index + 1,
                  encounterId: baseEncounter.id,
                  eventId: `decision-event-${index + 1}`,
                  ownerParticipantId: participant.scenarioParticipantId,
                  roundNumber: 9,
                },
                durationRounds: 2,
                effectId: decisionEffectId,
                isStunned: false,
                label: "Temporary penalty",
                modifierValue: -1,
                status: "active",
                type: "general_modifier",
              }),
              createdAt: "2026-08-09T09:00:00.000Z",
              duration: "2 rounds",
              effectGroup: "general" as const,
              id: decisionEffectId,
              modifierValue: -1,
              roundNumber: 9,
              sourceEventId: `decision-event-${index + 1}`,
              status: "active" as const,
              targetParticipantId: participant.scenarioParticipantId,
              type: "general_modifier" as const,
              updatedAt: "2026-08-09T09:00:00.000Z",
            }
          : undefined;
      return [
        participant.id,
        {
          effects: [effect, ...(decisionEffect ? [decisionEffect] : [])],
          events: [
            {
              createdAt: "2026-08-09T09:00:00.000Z",
              description: "Bleeding wound",
              id: `bleed-event-${index + 1}`,
              sourceLabel: "Bleeding wound",
              sourceType: "manual" as const,
              targetParticipantId: participant.scenarioParticipantId,
            },
            ...(decisionEffect
              ? [
                  {
                    createdAt: "2026-08-09T09:00:00.000Z",
                    description: "Temporary penalty",
                    id: `decision-event-${index + 1}`,
                    sourceLabel: "Temporary penalty",
                    sourceType: "manual" as const,
                    targetParticipantId: participant.scenarioParticipantId,
                  },
                ]
              : []),
          ],
        },
      ];
    }),
  ) as Record<string, CombatEffectsState>;
  const reviewed = prepareCombatRoundEndReview({
    participantInputs: Object.fromEntries(
      encounterParticipants.map((participant) => [
        participant.id,
        { combatEffects: effectsByParticipant[participant.id], healthStat: 6 },
      ]),
    ),
    state: {
      ...baseState,
      currentCursor: {
        participantId: encounterParticipants[0]!.id,
        roundNumber: 10,
        step: "SU",
      },
      currentStep: "round_summary",
      selectedParticipantId: encounterParticipants[0]!.id,
      selectedStep: "round_summary",
    },
  });
  const encounter = encounterSessionSchema.parse({
    ...baseEncounter,
    combatRoundState: reviewed,
    currentRound: reviewed.roundNumber,
    updatedAt: "2026-08-09T10:00:00.000Z",
  });
  const participants = encounterParticipants.map(
    (participant, index) =>
      makeCombatScenarioParticipant({
        controlledByUserId:
          input.playerControlledIndex === index ? `player-${index + 1}` : undefined,
        id: participant.scenarioParticipantId,
        role: input.playerControlledIndex === index ? "player_character" : "npc",
        snapshot: { displayName: participant.label },
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: effectsByParticipant[participant.id],
        },
      }) as unknown as ScenarioParticipant,
  );
  return { encounter, participants };
}

function makeObservationAutomationFixture(input: {
  inactiveParticipantIndex?: number;
  missingProfileIndex?: number;
  observerCount?: number;
  participantCount?: number;
  playerControlledIndex?: number;
}) {
  const participantCount = input.participantCount ?? 4;
  const observerCount = input.observerCount ?? participantCount;
  const encounterParticipants = Array.from({ length: participantCount }, (_, index) =>
    makeEncounterCombatParticipant({
      id: `encounter-participant-${index + 1}`,
      label: `NPC ${index + 1}`,
      order: index,
      scenarioParticipantId: `participant-${index + 1}`,
    }),
  );
  const baseEncounter = encounterSessionSchema.parse(
    makeCombatEncounter({ currentRound: 3, participants: encounterParticipants }),
  );
  const initial = initializeCombatRoundState({ encounter: baseEncounter });
  const state = combatRoundStateSchema.parse({
    ...initial,
    currentCursor: {
      participantId: encounterParticipants[0]?.id,
      roundNumber: 3,
      step: "SU",
    },
    currentStep: "round_summary",
    observationRelationships: encounterParticipants
      .slice(0, observerCount)
      .map((observer, index) => {
        const target = encounterParticipants[(index + 1) % participantCount]!;
        return {
          bestBonus: index === 0 ? 1 : 0,
          completedAttempts: 0,
          id: `observation:${observer.id}:${target.id}`,
          observerParticipantId: observer.id,
          roundsTowardNextAttempt: 2,
          targetParticipantId: target.id,
        };
      }),
    participants: initial.participants.map((participant, index) => {
      const target = encounterParticipants[(index + 1) % participantCount]!;
      return {
        ...participant,
        declaration:
          index < observerCount
            ? {
                actionId: "parry",
                id: `declaration:${participant.participantId}`,
                roundNumber: 3,
                secondaryActions: [{ action: "observe_opponent", targetParticipantId: target.id }],
                secondaryActionContext: {
                  action: "observe_opponent",
                  targetParticipantId: target.id,
                },
                secondaryActionId: "observe_opponent",
                submittedAt: "2026-08-10T09:00:00.000Z",
                submittedBy: "gm",
              }
            : {
                actionId: "parry",
                id: `declaration:${participant.participantId}`,
                roundNumber: 3,
                submittedAt: "2026-08-10T09:00:00.000Z",
                submittedBy: "gm",
              },
      };
    }),
    roundEndReview: {
      participantReviews: Object.fromEntries(
        encounterParticipants.map((participant) => [
          participant.id,
          { participantId: participant.id, status: "complete" },
        ]),
      ),
      roundNumber: 3,
    },
    selectedParticipantId: encounterParticipants[0]?.id,
    selectedStep: "round_summary",
  });
  const encounter = encounterSessionSchema.parse({
    ...baseEncounter,
    combatRoundState: state,
    currentRound: 3,
    updatedAt: "2026-08-10T10:00:00.000Z",
  });
  const participants = encounterParticipants.map((participant, index) => {
    const characterId = `character-${index + 1}`;
    return makeCombatScenarioParticipant({
      characterId,
      controlledByUserId: input.playerControlledIndex === index ? `player-${index + 1}` : undefined,
      id: participant.scenarioParticipantId,
      isActive: input.inactiveParticipantIndex !== index,
      role: input.playerControlledIndex === index ? "player_character" : "npc",
      snapshot: {
        ...(input.missingProfileIndex === index
          ? {}
          : { build: makeDodgeCharacterBuild(characterId, participant.label) }),
        displayName: participant.label,
        sourceUpdatedAt: "2026-08-10T09:00:00.000Z",
      },
      state: {
        ...makeCombatScenarioParticipant().state,
        combat: {
          combatContext: {
            modifierBuckets: {
              ...emptyModifierBuckets(),
              general:
                input.missingProfileIndex === index
                  ? [{ id: `ambiguous-observe-${index + 1}`, scope: "until", value: 999 }]
                  : [],
            },
          },
        },
        combatEffects: { effects: [], events: [] },
      },
    }) as unknown as ScenarioParticipant;
  });
  return { encounter, participants };
}

function observationRollRequest(input: {
  encounter: EncounterSession;
  participants: readonly ScenarioParticipant[];
}) {
  const state = combatRoundStateSchema.parse(input.encounter.combatRoundState);
  const task = getCurrentExecutableCombatTasks(
    buildCombatProgressionProjection(state, {
      participation: projectActiveCombatParticipation({
        encounterRevision: input.encounter.updatedAt,
        scenarioParticipants: input.participants,
        state,
      }),
    }),
  )[0]!;
  const roundParticipant = state.participants.find(
    (participant) => participant.participantId === task.identity.participantId,
  );
  return {
    executionGroupId: task.executionGroupId,
    expectedRevision: input.encounter.updatedAt,
    observationAttemptId: task.identity.observationAttemptId,
    opponentParticipantId: task.identity.opponentParticipantId,
    processId: task.processId,
    relationshipId: task.identity.relationshipId,
    scenarioParticipantId: roundParticipant?.scenarioParticipantId,
    stageId: task.stageId,
    taskId: task.id,
  };
}

function stepAutomationRequest(input: {
  encounter: EncounterSession;
  operationFamily: "accept_remaining" | "roll_remaining";
  participants: readonly ScenarioParticipant[];
  runId: string;
}) {
  const state = combatRoundStateSchema.parse(input.encounter.combatRoundState);
  const participation = projectActiveCombatParticipation({
    encounterRevision: input.encounter.updatedAt,
    scenarioParticipants: input.participants,
    state,
  });
  const task = getCurrentExecutableCombatTasks(
    buildCombatProgressionProjection(state, { participation }),
  ).find((candidate) => {
    if (candidate.kind !== "submit_declaration") return true;
    const participantId =
      candidate.owner?.kind === "combatant"
        ? candidate.owner.participantId
        : candidate.identity.participantId;
    return !state.participants.find((participant) => participant.participantId === participantId)
      ?.declaration;
  });
  if (!task) throw new Error("Expected a current step-automation task.");
  return {
    encounterId: input.encounter.id,
    expectedExecutionGroupId: task.executionGroupId,
    expectedProcessId: task.processId,
    expectedRevision: input.encounter.updatedAt,
    expectedRound: state.roundNumber,
    expectedStep: state.currentStep,
    expectedTaskId: task.id,
    operationFamily: input.operationFamily,
    runId: input.runId,
    schemaVersion: 1,
  } as const;
}

function withCanonicalTestAttackLineage(input: Record<string, unknown>) {
  const encounter = encounterSessionSchema.parse(input);
  const round = encounter.combatRoundState;
  if (!round) return encounter;

  return encounterSessionSchema.parse({
    ...encounter,
    combatRoundState: {
      ...round,
      participants: round.participants.map((participant) => {
        const declaration = participant.declaration;
        if (!declaration?.actionId) return participant;
        const generated = buildCombatRoundDeclaredAttackOpportunities({
          actionId: declaration.actionId,
          participantId: participant.participantId,
          phaseContexts: declaration.phaseContexts,
          roundNumber: round.roundNumber,
          sources: {
            phase1: {
              attackModeId: "mode-1",
              sourceKind: "unarmed",
              weaponSourceId: "unarmed:virtual-weapon-template-punch",
              weaponSourceSlot: "virtual",
              weaponTemplateId: "virtual-weapon-template-punch",
            },
            phase2: {
              attackModeId: "mode-1",
              sourceKind: "unarmed",
              weaponSourceId: "unarmed:virtual-weapon-template-kick",
              weaponSourceSlot: "virtual",
              weaponTemplateId: "virtual-weapon-template-kick",
            },
          },
        });
        const opportunities =
          declaration.attackOpportunities?.map((opportunity) => {
            const canonical = generated.find(
              (candidate) =>
                candidate.phase === opportunity.phase && candidate.slot === opportunity.slot,
            );
            return canonical ? { ...canonical, ...opportunity } : opportunity;
          }) ?? generated;
        const attackResults = { ...participant.attackResults };
        const attackResultsByOpportunity: NonNullable<
          typeof participant.attackResultsByOpportunity
        > = {};
        for (const phase of ["phase1", "phase2"] as const) {
          const result = attackResults[phase];
          const opportunity = opportunities.find((candidate) => candidate.phase === phase);
          if (!result || !opportunity) continue;
          const identity = getCanonicalAttackOpportunityIdentity({
            actionId: declaration.actionId,
            attackerParticipantId: participant.participantId,
            opportunity,
            roundNumber: round.roundNumber,
          });
          if (!identity) continue;
          const canonicalResult = {
            ...result,
            attackIndex: identity.attackIndex,
            attackModeId: identity.attackModeId,
            attackOpportunityId: identity.opportunityId,
            attackSlot: opportunity.slot,
            declarationId: identity.declarationId,
            weaponInstanceId: identity.weaponInstanceId,
            weaponSourceId: identity.weaponSourceId,
            weaponSourceSlot: identity.weaponSourceSlot,
            weaponTemplateId: identity.weaponTemplateId,
          };
          attackResults[phase] = canonicalResult;
          attackResultsByOpportunity[identity.opportunityId] = canonicalResult;
        }
        return {
          ...participant,
          attackResults,
          attackResultsByOpportunity,
          declaration: { ...declaration, attackOpportunities: opportunities },
        };
      }),
    },
  });
}

function setupCombatDeclarationRoute(
  input: {
    combatExperienceDifficulty?: number;
    combatExperienceResolved?: boolean;
    combatExperienceWindowOpen?: boolean;
    encounter?: Record<string, unknown>;
    participant?: Record<string, unknown>;
    participants?: Array<Record<string, unknown>>;
    user?: typeof mocks.playerUser | typeof mocks.adminUser;
  } = {},
) {
  const baseEncounter = withCanonicalTestAttackLineage(makeCombatEncounter(input.encounter));
  const unresolvedEncounter =
    input.combatExperienceResolved === false && input.combatExperienceWindowOpen
      ? {
          ...baseEncounter,
          combatRoundState: setCombatRoundCombatExperienceDifficulty({
            difficulty: input.combatExperienceDifficulty ?? 26,
            state: initializeCombatRoundState({ encounter: baseEncounter as EncounterSession }),
          }),
        }
      : baseEncounter;
  const encounter =
    input.combatExperienceResolved === false
      ? unresolvedEncounter
      : withResolvedCombatStartExperience(baseEncounter);
  const participant = makeCombatScenarioParticipant(
    input.participant,
  ) as unknown as ScenarioParticipant;
  let participants: ScenarioParticipant[] = input.participants
    ? input.participants.map(
        (entry) => makeCombatScenarioParticipant(entry) as unknown as ScenarioParticipant,
      )
    : [participant];
  const calculationStep = (encounter.combatRoundState as CombatRoundState | undefined)?.currentStep;
  if (
    calculationStep === "initiative_phase_1" ||
    calculationStep === "initiative_phase_2" ||
    calculationStep === "phase_1_actions" ||
    calculationStep === "phase_2_actions"
  ) {
    participants = participants.map((entry) => {
      const snapshot = entry.snapshot as Record<string, unknown>;
      if (snapshot.build && snapshot.equipmentState) return entry;
      const characterId = entry.characterId ?? `character-${entry.id}`;
      const canonicalSnapshot = makeCanonicalCombatCalculationSnapshot({
        characterId,
        displayName: entry.snapshot.displayName,
      });
      return makeCombatScenarioParticipant({
        ...entry,
        characterId,
        snapshot: {
          ...entry.snapshot,
          build: snapshot.build ?? canonicalSnapshot.build,
          equipmentState: snapshot.equipmentState ?? canonicalSnapshot.equipmentState,
          sourceUpdatedAt: snapshot.sourceUpdatedAt ?? canonicalSnapshot.sourceUpdatedAt,
        },
      }) as unknown as ScenarioParticipant;
    });
  }

  if (input.user) {
    mocks.requireAuthenticatedUser.mockResolvedValue(input.user);
  }

  mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
  mocks.encounterService.updateScenarioParticipantState.mockImplementation(
    async (update: { state: unknown }) => ({
      ...participant,
      state: update.state,
    }),
  );
  mocks.encounterService.updateEncounter.mockImplementation(
    async (update: { session: unknown }) => update.session,
  );
  mocks.encounterService.commitCombatModifierReview.mockImplementation(
    async (update: {
      participant: Record<string, unknown>;
      scenarioId: string;
      session: unknown;
      state: unknown;
    }) => {
      const encounter = await mocks.encounterService.updateEncounter({ session: update.session });
      return {
        encounter,
        participant: { ...update.participant, state: update.state },
      };
    },
  );
  mocks.encounterService.commitCombatParticipantStateMutation.mockImplementation(
    async (update: {
      participant: Record<string, unknown>;
      scenarioId: string;
      session: unknown;
      state: unknown;
    }) => {
      const encounter = await mocks.encounterService.updateEncounter({ session: update.session });
      const participant = await mocks.encounterService.updateScenarioParticipantState({
        participantId: update.participant.id,
        scenarioId: update.scenarioId,
        state: update.state,
      });
      return { encounter, participant };
    },
  );
  mocks.encounterService.commitCombatParticipantStateMutations.mockImplementation(
    async (update: {
      participants: Array<{ participant: Record<string, unknown>; state: unknown }>;
      scenarioId: string;
      session: unknown;
    }) => {
      const encounter = await mocks.encounterService.updateEncounter({ session: update.session });
      const participants = await Promise.all(
        update.participants.map(({ participant, state }) =>
          mocks.encounterService.updateScenarioParticipantState({
            participantId: participant.id,
            scenarioId: update.scenarioId,
            state,
          }),
        ),
      );
      return { encounter, participants };
    },
  );
  mocks.encounterService.commitCombatModifierReviews.mockImplementation(
    async (update: {
      participants: Array<{ participant: Record<string, unknown>; state: unknown }>;
      session: unknown;
    }) => ({
      encounter: await mocks.encounterService.updateEncounter({ session: update.session }),
      participants: update.participants.map(({ participant, state }) => ({
        ...participant,
        state,
      })),
    }),
  );
  mocks.scenarioService.getScenarioById.mockResolvedValue({
    campaignId: "campaign-1",
    id: "scenario-1",
    kind: "combat",
    name: "Bridge Ambush",
    status: "live",
  });
  mocks.campaignService.getCampaignById.mockResolvedValue({
    gmUserId: "gm-1",
    id: "campaign-1",
    name: "Border Trouble",
    status: "active",
  });
  mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
  mocks.scenarioService.listScenarioParticipants.mockResolvedValue(participants);

  return { encounter, participant, participants };
}

function setupMutableCombatRouteState<Participant extends { id: string; state: unknown }>(input: {
  encounter: EncounterSession;
  participants: Participant[];
  user?: typeof mocks.playerUser | typeof mocks.adminUser;
}) {
  let currentEncounter = input.encounter;
  let currentParticipants = input.participants;

  mocks.requireAuthenticatedUser.mockResolvedValue(input.user ?? mocks.adminUser);
  mocks.requireAdminUser.mockResolvedValue(input.user ?? mocks.adminUser);
  mocks.encounterService.getEncounterById.mockImplementation(async () => currentEncounter);
  mocks.encounterService.updateEncounter.mockImplementation(
    async (update: { session: EncounterSession }) => {
      currentEncounter = update.session;
      return currentEncounter;
    },
  );
  mocks.encounterService.updateScenarioParticipantState.mockImplementation(
    async (update: { participantId: string; state: unknown }) => {
      const updatedParticipant = {
        ...currentParticipants.find((participant) => participant.id === update.participantId),
        state: update.state,
      } as Participant;
      currentParticipants = currentParticipants.map((participant) =>
        participant.id === update.participantId ? updatedParticipant : participant,
      );

      return updatedParticipant;
    },
  );
  mocks.encounterService.commitCombatParticipantStateMutation.mockImplementation(
    async (update: {
      participant: Participant;
      scenarioId: string;
      session: EncounterSession;
      state: unknown;
    }) => {
      const encounter = await mocks.encounterService.updateEncounter({ session: update.session });
      const updatedParticipant = await mocks.encounterService.updateScenarioParticipantState({
        participantId: update.participant.id,
        scenarioId: update.scenarioId,
        state: update.state,
      });
      return { encounter, participant: updatedParticipant };
    },
  );
  mocks.encounterService.commitCombatParticipantStateMutations.mockImplementation(
    async (update: {
      participants: Array<{ participant: Participant; state: unknown }>;
      scenarioId: string;
      session: EncounterSession;
    }) => {
      const encounter = await mocks.encounterService.updateEncounter({ session: update.session });
      const updatedParticipants = await Promise.all(
        update.participants.map(({ participant, state }) =>
          mocks.encounterService.updateScenarioParticipantState({
            participantId: participant.id,
            scenarioId: update.scenarioId,
            state,
          }),
        ),
      );
      return { encounter, participants: updatedParticipants };
    },
  );
  mocks.scenarioService.getScenarioById.mockResolvedValue({
    campaignId: "campaign-1",
    id: "scenario-1",
    kind: "combat",
    name: "Bridge Ambush",
    status: "live",
  });
  mocks.campaignService.getCampaignById.mockResolvedValue({
    gmUserId: "gm-1",
    id: "campaign-1",
    name: "Border Trouble",
    status: "active",
  });
  mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
  mocks.scenarioService.listScenarioParticipants.mockImplementation(
    async () => currentParticipants,
  );

  return {
    get encounter() {
      return currentEncounter;
    },
    get participants() {
      return currentParticipants;
    },
  };
}

function makeDistanceControlReviewFixture(): {
  encounter: EncounterSession;
  participants: Array<ReturnType<typeof makeCombatScenarioParticipant>>;
  proposalId: string;
} {
  const encounterParticipants = makeTwoCombatEncounterParticipants();
  const baseEncounter = makeCombatEncounter({
    participants: encounterParticipants,
  }) as EncounterSession;
  const resolvedEncounter = withResolvedCombatStartExperience(baseEncounter) as EncounterSession;
  const baseState =
    resolvedEncounter.combatRoundState ?? initializeCombatRoundState({ encounter: baseEncounter });
  const distanceState = setDistanceBetween({
    distance: 3,
    participantAId: "encounter-participant-1",
    participantBId: "encounter-participant-2",
    source: "gm_set",
    state: baseState.distanceState,
  });
  const gladiatorDeclared = recordCombatRoundDeclaration({
    declaration: {
      movementIntent: {
        distancePreferences: [
          {
            desiredDistance: 3,
            source: "player_declared",
            targetParticipantId: "participant-2",
          },
        ],
        mode: "set_distance_preferences",
      },
      roundNumber: baseState.roundNumber,
    },
    participantId: "encounter-participant-1",
    state: { ...baseState, distanceState },
    submittedBy: "player",
  });
  const scyrianDeclared = recordCombatRoundDeclaration({
    declaration: {
      movementIntent: {
        distancePreferences: [
          {
            desiredDistance: 2,
            source: "player_declared",
            targetParticipantId: "participant-1",
          },
        ],
        mode: "set_distance_preferences",
      },
      roundNumber: baseState.roundNumber,
    },
    participantId: "encounter-participant-2",
    state: gladiatorDeclared,
    submittedBy: "player",
  });
  const reviewed = prepareCombatRoundEndReview({
    participantInputs: {
      "encounter-participant-1": {
        distanceControl: {
          calculationReadiness: { completeness: "complete", reasons: [], schemaVersion: 1 },
          dodgeSkillTotal: 8,
          generalFatigueModifier: -1,
        },
      },
      "encounter-participant-2": {
        distanceControl: {
          calculationReadiness: { completeness: "complete", reasons: [], schemaVersion: 1 },
          dodgeSkillTotal: 4,
          generalFatigueModifier: 0,
        },
      },
    },
    state: {
      ...scyrianDeclared,
      currentCursor: {
        participantId: "encounter-participant-1",
        roundNumber: baseState.roundNumber,
        step: "SU",
      },
      currentStep: "round_summary",
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    },
  });
  const proposalId = reviewed.roundEndReview?.proposedDistances[0]?.id;

  if (!proposalId) {
    throw new Error("Distance control fixture did not create a proposal.");
  }

  return {
    encounter: {
      ...resolvedEncounter,
      combatRoundState: reviewed,
      currentRound: reviewed.roundNumber,
    },
    participants: [
      makeCombatScenarioParticipant({
        controlledByUserId: "player-1",
        id: "participant-1",
        snapshot: {
          build: makeDodgeCharacterBuild("character-1", "The Gladiator"),
          displayName: "The Gladiator",
          equipmentState: makeMovementBurdenEquipmentState({ characterId: "character-1" }),
        },
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
        snapshot: {
          build: makeDodgeCharacterBuild("character-2", "Scyrian cavalry guy"),
          displayName: "Scyrian cavalry guy",
          equipmentState: makeMovementBurdenEquipmentState({ characterId: "character-2" }),
        },
      }),
    ],
    proposalId,
  };
}

function makeContinuedContactDistanceChoiceFixture(): {
  encounter: EncounterSession;
  participants: Array<ReturnType<typeof makeCombatScenarioParticipant>>;
  proposalId: string;
} {
  const encounterParticipants = makeTwoCombatEncounterParticipants();
  const baseEncounter = makeCombatEncounter({
    participants: encounterParticipants,
  }) as EncounterSession;
  const resolvedEncounter = withResolvedCombatStartExperience(baseEncounter) as EncounterSession;
  const baseState =
    resolvedEncounter.combatRoundState ?? initializeCombatRoundState({ encounter: baseEncounter });
  const reviewed = prepareCombatRoundEndReview({
    state: {
      ...baseState,
      continuedContacts: [
        {
          affectedParticipantId: "encounter-participant-2",
          brawlingContestResultId: "contest-result-1",
          controllerParticipantId: "encounter-participant-1",
          establishedPhase: "phase1",
          establishedRound: baseState.roundNumber,
          id: "continued-contact-1",
          sourceActionId: "offensive_parry",
          sourceAttackResultId: "attack-result-1",
          sourceDeclarationId: "declaration-1",
          sourceOpportunityId: "opportunity-1",
          sourceParryResultId: "parry-result-1",
          status: "active",
        },
      ],
      currentCursor: {
        participantId: "encounter-participant-1",
        roundNumber: baseState.roundNumber,
        step: "SU",
      },
      currentStep: "round_summary",
      distanceState: setDistanceBetween({
        distance: 4,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
        source: "gm_set",
        state: baseState.distanceState,
      }),
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    },
  });
  const proposalId = reviewed.roundEndReview?.proposedDistances[0]?.id;
  if (!proposalId) throw new Error("Continued Contact fixture did not create a proposal.");
  return {
    encounter: {
      ...resolvedEncounter,
      combatRoundState: reviewed,
      currentRound: reviewed.roundNumber,
    },
    participants: [
      makeCombatScenarioParticipant({ controlledByUserId: "player-1", id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
        snapshot: { displayName: "Scyrian cavalry guy" },
      }),
    ],
    proposalId,
  };
}

function makeContinuedContactMaintenanceFixture(): {
  conditionId: string;
  contactId: string;
  contestId: string;
  encounter: EncounterSession;
  participants: ScenarioParticipant[];
} {
  const encounterParticipants = makeTwoCombatEncounterParticipants();
  const baseEncounter = makeCombatEncounter({
    currentRound: 3,
    participants: encounterParticipants,
  }) as EncounterSession;
  const baseState = initializeCombatRoundState({ encounter: baseEncounter });
  const contactId = "continued-contact-maintenance-1";
  const conditionId = "continued-contact-maintenance-1:unbalanced";
  const contactLifecycle = projectProcessRestrictionToCanonicalModifierLifecycle({
    context: {
      createdAt: "2026-01-01T00:00:00.000Z",
      createdRevision: baseEncounter.updatedAt,
      createdSequence: 1,
      encounterId: baseEncounter.id,
    },
    duration: {
      conditionId: contactId,
      conditionKind: "contact_ended",
      kind: "until_condition",
      startPhase: "phase1",
      startRound: 2,
      startSequence: 1,
    },
    effectId: contactId,
    effectKind: "continued_contact",
    opponentParticipantId: "encounter-participant-2",
    ownerParticipantId: "encounter-participant-1",
    processId: contactId,
    publicLabel: "Continued Contact",
  }).effect;
  const withDeclarations = {
    ...baseState,
    continuedContacts: [
      {
        affectedParticipantId: "encounter-participant-2",
        brawlingContestResultId: "opening-contest-result-1",
        canonicalLifecycle: contactLifecycle,
        controllerParticipantId: "encounter-participant-1",
        establishedPhase: "phase1" as const,
        establishedRound: 2,
        id: contactId,
        sourceActionId: "offensive_parry",
        sourceAttackResultId: "attack-result-1",
        sourceDeclarationId: "declaration-1",
        sourceOpportunityId: "opportunity-1",
        sourceParryResultId: "parry-result-1",
        status: "active" as const,
      },
    ],
    currentCursor: {
      participantId: "encounter-participant-1",
      roundNumber: 3,
      step: "SU" as const,
    },
    currentStep: "round_summary" as const,
    participants: baseState.participants.map((participant, index) => ({
      ...participant,
      declaration: {
        actionId: "attack_parry" as const,
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: index === 0 ? 1 : 3,
              source: "player_declared" as const,
              targetParticipantId:
                index === 0 ? "encounter-participant-2" : "encounter-participant-1",
            },
          ],
          mode: "set_distance_preferences" as const,
        },
        roundNumber: 3,
        submittedBy: "player" as const,
      },
    })),
    unbalancedConditions: [
      {
        affectedParticipantId: "encounter-participant-2",
        establishedRound: 2,
        id: conditionId,
        modifierValue: -2,
        sourceActionId: "offensive_parry",
        sourceContinuedContactId: contactId,
        status: "active" as const,
      },
    ],
  };
  const reviewed = prepareCombatRoundEndReview({
    state: combatRoundStateSchema.parse(withDeclarations),
  });
  const contest = reviewed.roundEndReview?.continuedContactMaintenanceContests[0];
  if (!contest) throw new Error("Continued Contact fixture did not create maintenance.");

  const unbalancedEffect = {
    combatModifierBucket: "general" as const,
    combatWide: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    damage: 0,
    description: "Unbalanced from Offensive Parry continued contact.",
    duration: "Until continued contact ends",
    effectGroup: "general" as const,
    excludedRollPurposes: ["escape_continued_contact"],
    generalDamage: 0,
    id: conditionId,
    canonicalLifecycle: projectProcessRestrictionToCanonicalModifierLifecycle({
      context: {
        createdAt: "2026-01-01T00:00:00.000Z",
        createdRevision: baseEncounter.updatedAt,
        createdSequence: 1,
        encounterId: baseEncounter.id,
      },
      duration: {
        conditionId: contactId,
        conditionKind: "contact_ended",
        kind: "until_condition",
        startPhase: "phase1",
        startRound: 2,
        startSequence: 1,
      },
      effectId: conditionId,
      effectKind: "unbalanced",
      opponentParticipantId: "participant-1",
      ownerParticipantId: "participant-2",
      processId: contactId,
      publicLabel: "Unbalanced",
    }).effect,
    modifierValue: -2,
    roundNumber: 2,
    sourceEventId: `${conditionId}:effect-event`,
    status: "active" as const,
    targetParticipantId: "participant-2",
    type: "general_modifier" as const,
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  const participant = (input: {
    controlledByUserId: string;
    displayName: string;
    id: string;
    skill: number;
    state?: Record<string, unknown>;
  }) =>
    makeCombatScenarioParticipant({
      controlledByUserId: input.controlledByUserId,
      id: input.id,
      snapshot: {
        displayName: input.displayName,
        sheetSummary: {
          draftView: {
            skills: [
              {
                effectiveSkillNumber: input.skill,
                name: "Brawling",
                skillId: "brawling",
                totalSkill: input.skill,
              },
            ],
          },
        },
      },
      ...(input.state ? { state: input.state } : {}),
    }) as unknown as ScenarioParticipant;
  const baseAffectedState = makeCombatScenarioParticipant().state;
  return {
    conditionId,
    contactId,
    contestId: contest.id,
    encounter: {
      ...baseEncounter,
      combatRoundState: reviewed,
      currentRound: reviewed.roundNumber,
    },
    participants: [
      participant({
        controlledByUserId: "player-1",
        displayName: "The Gladiator",
        id: "participant-1",
        skill: 18,
      }),
      participant({
        controlledByUserId: "other-player",
        displayName: "Scyrian cavalry guy",
        id: "participant-2",
        skill: 100,
        state: {
          ...baseAffectedState,
          combatEffects: {
            effects: [unbalancedEffect],
            events: [],
          },
        },
      }),
    ],
  };
}

function rollDistanceControlFixtureBothSides(input: {
  encounter: EncounterSession;
  proposalId: string;
}): CombatRoundState {
  const result = (rollInput: {
    baseSkill: number;
    dieResult: number;
    opponentParticipantId: string;
    participantId: string;
    rolledAt: string;
    rolledBy: "gm_proxy" | "player";
  }) => ({
    dodgeSkillTotal: rollInput.baseSkill,
    finalTotal: rollInput.baseSkill + rollInput.dieResult,
    generalFatigueModifier: 0,
    openEndedD10s: [],
    rolledAt: rollInput.rolledAt,
    rolledAtRound: 1,
    rolledBy: rollInput.rolledBy,
    rollD20: rollInput.dieResult,
    rollTotal: rollInput.dieResult,
    skillContestCalculation: {
      baseSkill: rollInput.baseSkill,
      calculationId: `round-end-distance:${rollInput.participantId}`,
      completeness: "partial" as const,
      contestType: "round_end_adjust_distance" as const,
      derivedIntegerAdjustment: 0,
      finalResult: rollInput.baseSkill + rollInput.dieResult,
      governingStat: { id: "dex", label: "Dexterity", value: rollInput.baseSkill },
      missingContributionPoints: ["movement_mm", "encumbrance"] as (
        | "encumbrance"
        | "movement_mm"
      )[],
      openEndedDie: {
        openEndedD10s: [],
        rollD20: rollInput.dieResult,
        rollTotal: rollInput.dieResult,
      },
      opponentParticipantId: rollInput.opponentParticipantId,
      participantId: rollInput.participantId,
      percentageContributions: [],
      preDieTotal: rollInput.baseSkill,
      role: "contestant" as const,
      skill: { id: "dodge", label: "Dodge", totalXp: 0 },
      totalPercentageAdjustment: 0,
      visibility: "roller_and_gm" as const,
    },
  });
  const firstRoll = rollCombatRoundEndDistanceControl({
    command: {
      createdAt: "2026-01-01T00:11:00.000Z",
      createdByUserId: "player-1",
    },
    distanceProposalId: input.proposalId,
    participantId: "encounter-participant-1",
    result: result({
      baseSkill: 7,
      dieResult: 10,
      opponentParticipantId: "encounter-participant-2",
      participantId: "encounter-participant-1",
      rolledAt: "2026-01-01T00:11:00.000Z",
      rolledBy: "player",
    }),
    state:
      input.encounter.combatRoundState ??
      initializeCombatRoundState({ encounter: input.encounter }),
  });
  const secondRoll = rollCombatRoundEndDistanceControl({
    command: {
      createdAt: "2026-01-01T00:11:30.000Z",
      createdByUserId: "gm-1",
    },
    distanceProposalId: input.proposalId,
    participantId: "encounter-participant-2",
    result: result({
      baseSkill: 4,
      dieResult: 12,
      opponentParticipantId: "encounter-participant-1",
      participantId: "encounter-participant-2",
      rolledAt: "2026-01-01T00:11:30.000Z",
      rolledBy: "gm_proxy",
    }),
    state: firstRoll.state,
  });

  return secondRoll.state;
}

function commitDistanceControlFixture(input: {
  proposalId: string;
  state: CombatRoundState;
}): CombatRoundState {
  return commitCombatRoundEndDistanceControl({
    command: {
      createdAt: "2026-01-01T00:12:00.000Z",
      createdByUserId: "gm-1",
    },
    distanceProposalId: input.proposalId,
    state: input.state,
  }).state;
}

function makeHealthCheckReviewFixture(): {
  encounter: EncounterSession;
  healthRollId: string;
  participants: Array<ReturnType<typeof makeCombatScenarioParticipant>>;
} {
  const encounterParticipants = makeTwoCombatEncounterParticipants();
  const baseEncounter = makeCombatEncounter({
    currentRound: 10,
    participants: encounterParticipants,
  }) as EncounterSession;
  const baseState = initializeCombatRoundState({ encounter: baseEncounter });
  const combatEffects: CombatEffectsState = {
    effects: [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        damage: 0,
        effectGroup: "bleed",
        generalDamage: 0,
        id: "player-bleed",
        modifierValue: 2,
        roundNumber: 1,
        sourceEventId: "bleed-event",
        status: "active",
        targetParticipantId: "participant-1",
        type: "bleed",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    events: [
      {
        createdAt: "2026-01-01T00:00:00.000Z",
        description: "Bleeding wound",
        id: "bleed-event",
        sourceLabel: "Bleeding wound",
        sourceType: "manual",
        targetParticipantId: "participant-1",
      },
    ],
  };
  const reviewed = prepareCombatRoundEndReview({
    participantInputs: {
      "encounter-participant-1": {
        combatEffects,
        healthStat: 6,
      },
    },
    state: {
      ...baseState,
      currentCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 10,
        step: "SU",
      },
      currentStep: "round_summary",
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    },
  });
  const healthRollId =
    reviewed.roundEndReview?.participantReviews["encounter-participant-1"]?.proposedHealthRolls[0]
      ?.id;

  if (!healthRollId) {
    throw new Error("Health check fixture did not create a pending health roll.");
  }

  return {
    encounter: {
      ...baseEncounter,
      combatRoundState: reviewed,
      currentRound: reviewed.roundNumber,
    },
    healthRollId,
    participants: [
      makeCombatScenarioParticipant({
        controlledByUserId: "player-1",
        id: "participant-1",
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects,
        },
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
        snapshot: {
          displayName: "Scyrian cavalry guy",
        },
      }),
    ],
  };
}

function preparePhaseCombatExperienceBackOutRouteFixture(
  input: {
    gladiatorInitiative?: number;
    guardInitiative?: number;
  } = {},
): {
  encounter: EncounterSession;
  participants: Array<ReturnType<typeof makeCombatScenarioParticipant>>;
  roundState: CombatRoundState;
} {
  const encounterParticipants = [
    makeCombatEncounter().participants[0],
    {
      ...makeCombatEncounter().participants[0],
      id: "encounter-participant-2",
      label: "City guard",
      scenarioParticipantId: "participant-2",
    },
  ];
  const visibility = {
    "participant-1": { "participant-2": true },
    "participant-2": { "participant-1": true },
  };
  const baseEncounter = makeCombatEncounter({
    currentRound: 2,
    participants: encounterParticipants,
    roleplayState: {
      visibility,
    },
  }) as EncounterSession;
  const withGladiatorDeclaration = recordCombatRoundDeclaration({
    declaration: {
      actionId: "double_attack",
      phaseContexts: {
        phase1: testCombatPhaseContext("participant-2"),
        phase2: testCombatPhaseContext("participant-2"),
      },
      roundNumber: 2,
    },
    participantId: "encounter-participant-1",
    state: initializeCombatRoundState({ encounter: baseEncounter }),
    submittedBy: "gm",
  });
  const withDeclarations = recordCombatRoundDeclaration({
    declaration: {
      actionId: "double_attack",
      phaseContexts: {
        phase1: testCombatPhaseContext("participant-1"),
        phase2: testCombatPhaseContext("participant-1"),
      },
      roundNumber: 2,
    },
    participantId: "encounter-participant-2",
    state: withGladiatorDeclaration,
    submittedBy: "gm",
  });
  const phase1Initiative = advanceCombatRoundStep(advanceCombatRoundStep(withDeclarations));
  const afterGladiatorInitiative = recordCombatRoundInitiative({
    command: {
      createdAt: "2026-01-01T00:02:00.000Z",
      createdByUserId: "gm-1",
    },
    initiative: {
      baseInitiative: 0,
      modifierAdjustment: 0,
      rolls: [Math.min(6, input.gladiatorInitiative ?? 5)],
      rollTotal: input.gladiatorInitiative ?? 5,
      total: input.gladiatorInitiative ?? 5,
    },
    participantId: "encounter-participant-1",
    phase: "phase1",
    state: phase1Initiative,
    submittedBy: "gm",
    visibility,
  });
  const initiativeInputsRecorded = recordCombatRoundInitiative({
    command: {
      createdAt: "2026-01-01T00:02:30.000Z",
      createdByUserId: "gm-1",
    },
    initiative: {
      baseInitiative: 0,
      modifierAdjustment: 0,
      rolls: [Math.min(6, input.guardInitiative ?? 5)],
      rollTotal: input.guardInitiative ?? 5,
      total: input.guardInitiative ?? 5,
    },
    participantId: "encounter-participant-2",
    phase: "phase1",
    state: afterGladiatorInitiative,
    submittedBy: "gm",
    visibility,
  });
  const roundState = commitCombatRoundPhaseInitiativeResolution({
    command: {
      createdAt: "2026-01-01T00:02:45.000Z",
      createdByUserId: "gm-1",
    },
    phase: "phase1",
    state: initiativeInputsRecorded,
    visibility,
  }).state;
  const participants = [
    makeCombatScenarioParticipant({
      id: "participant-1",
      state: {
        ...makeCombatScenarioParticipant().state,
        combat: {
          combatContext: {
            modifierBuckets: {
              general: [],
              situationDb: [
                doubleAttackPhase1DbParryModifierEntry,
                doubleAttackPhase2DbParryModifierEntry,
              ],
              situationInitiative: [],
              situationObSkill: [
                doubleAttackPhase1ObSkillModifierEntry,
                doubleAttackPhase2ObSkillModifierEntry,
              ],
            },
          },
        },
      },
    }),
    makeCombatScenarioParticipant({
      controlledByUserId: "other-player",
      id: "participant-2",
      snapshot: {
        displayName: "City guard",
        sheetSummary: {
          draftView: {
            skills: [
              {
                effectiveSkillNumber: 7,
                linkedStatAverage: 19,
                name: "Combat Experience",
                skillId: "combat_experience",
                totalSkill: 26,
              },
            ],
          },
        },
      },
    }),
  ];

  return {
    encounter: {
      ...baseEncounter,
      combatRoundState: roundState,
      currentRound: roundState.roundNumber,
    },
    participants,
    roundState,
  };
}

describe("scenarios route contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.campaignService.listCampaignsByUserAccess.mockResolvedValue([{ id: "campaign-1" }]);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.encounterService.commitCombatModifierReview.mockImplementation(
      async (update: {
        participant: Record<string, unknown>;
        session: unknown;
        state: unknown;
      }) => ({
        encounter: await mocks.encounterService.updateEncounter({ session: update.session }),
        participant: { ...update.participant, state: update.state },
      }),
    );
    mocks.encounterService.commitCombatModifierReviews.mockImplementation(
      async (update: {
        participants: Array<{ participant: Record<string, unknown>; state: unknown }>;
        session: unknown;
      }) => ({
        encounter: await mocks.encounterService.updateEncounter({ session: update.session }),
        participants: update.participants.map(({ participant, state }) => ({
          ...participant,
          state,
        })),
      }),
    );
    mocks.requireAdminUser.mockResolvedValue(mocks.adminUser);
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
    mocks.combatStateReadService.getEncounterMetadataById.mockImplementation(
      async (encounterId: string) => {
        const encounter = await mocks.encounterService.getEncounterSummaryById(encounterId);
        return encounter ? encounterMetadata(encounter as EncounterSession) : null;
      },
    );
    mocks.combatStateReadService.getCombatHistorySourceById.mockImplementation(
      async (encounterId: string) => {
        const encounter = await mocks.encounterService.getEncounterById(encounterId);
        return encounter ? combatHistorySource(encounter as EncounterSession) : null;
      },
    );
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.combatStateReadService.listEncounterAccessMetadataByScenario.mockImplementation(
      async (scenarioId: string) => {
        const encounters = await mocks.encounterService.listEncountersByScenario(scenarioId);
        return (encounters as EncounterSession[]).map((encounter) =>
          buildEncounterAccessMetadataViewFromPersistedSession({
            metadata: {
              campaignId: encounter.campaignId,
              createdAt: encounter.createdAt,
              encounterId: encounter.id,
              revision: encounter.updatedAt,
              scenarioId: encounter.scenarioId,
              status: encounter.status,
              title: encounter.title,
            },
            sessionJson: encounter,
          }),
        );
      },
    );
  });

  /**
   * A1b (Forgejo issue #311) closed this channel's `declare` operation, which was the only way an
   * arbitrary client-chosen action id could enter canonical state. The player-safe projection of
   * this route's mutation response and its idempotency are unchanged, and are re-proved here
   * through the one operation a player still reaches, `roll`, on an action that already exists.
   * The player reference selector is retired with `declare`: a player no longer supplies a
   * reference on this route at all.
   */
  it("keeps the player-safe projection and idempotency of a canonical generic Combat action", async () => {
    const encounterParticipants = [
      makeEncounterCombatParticipant({
        id: "encounter-participant-1",
        label: "The Gladiator",
        order: 0,
        scenarioParticipantId: "participant-1",
      }),
      makeEncounterCombatParticipant({
        id: "encounter-participant-2",
        label: "Visible guard",
        order: 1,
        scenarioParticipantId: "participant-2",
      }),
      makeEncounterCombatParticipant({
        id: "encounter-participant-hidden",
        label: "Hidden spy",
        order: 2,
        scenarioParticipantId: "participant-hidden",
      }),
    ];
    const encounter = makeCombatEncounter({
      participants: encounterParticipants,
      roleplayState: {
        visibility: {
          "encounter-participant-1": { "encounter-participant-2": true },
        },
      },
    }) as EncounterSession;
    const unsafeRoundState = initializeCombatRoundState({ encounter });
    encounter.combatRoundState = combatRoundStateSchema.parse({
      ...unsafeRoundState,
      activeParticipantId: "encounter-participant-hidden",
      currentCursor: {
        participantId: "encounter-participant-hidden",
        roundNumber: 1,
        step: "DE",
      },
      phaseResolutionCursor: {
        participantId: "encounter-participant-hidden",
        phase: "phase1",
        substep: "attack",
      },
      phaseResolutionStatuses: {
        "encounter-participant-1": { phase1: { substep: "pending" } },
        "encounter-participant-hidden": { phase1: { substep: "attack" } },
      },
      roundEndReview: {
        participantReviews: {
          "encounter-participant-1": { participantId: "encounter-participant-1" },
          "encounter-participant-hidden": {
            participantId: "encounter-participant-hidden",
            warnings: ["Hidden spy"],
          },
        },
        roundNumber: 1,
      },
      selectedParticipantId: "encounter-participant-hidden",
    });
    const participants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
        snapshot: { displayName: "Visible guard" },
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-hidden",
        snapshot: { displayName: "Hidden spy" },
      }),
    ] as unknown as ScenarioParticipant[];
    encounter.combatRoundState = combatRoundStateSchema.parse({
      ...encounter.combatRoundState,
      genericActions: [
        {
          createdAt: "2026-09-18T08:00:00.000Z",
          duration: { kind: "round" },
          id: "generic-action-1",
          intent: "Bar the gate.",
          lastUpdatedAt: "2026-09-18T08:00:00.000Z",
          ownerParticipantId: "encounter-participant-1",
          progress: { completedRounds: 0 },
          rollRequest: {
            basis: { baseValue: 14, kind: "stat", statId: "dex", statLabel: "Dexterity" },
            difficulty: 26,
          },
          status: "active",
        },
      ],
    });
    setupCombatDeclarationRoute({ encounter, participants, user: mocks.playerUser });
    setupMutableCombatRouteState({ encounter, participants, user: mocks.playerUser });
    const app = await buildScenarioTestApp();
    const requestBody = {
      actionId: "generic-action-1",
      expectedRevision: encounter.updatedAt,
      operation: "roll",
    };

    const declared = await app.inject({
      method: "POST",
      payload: requestBody,
      url: "/encounters/encounter-1/combat-round/generic-actions",
    });
    const retried = await app.inject({
      method: "POST",
      payload: requestBody,
      url: "/encounters/encounter-1/combat-round/generic-actions",
    });
    const hiddenReference = await app.inject({
      method: "POST",
      payload: {
        actionId: "generic-action-hidden-ref",
        duration: { kind: "round" },
        expectedRevision: retried.json().encounter.updatedAt,
        intent: "Watch the spy.",
        operation: "declare",
        participantId: "encounter-participant-1",
        referenceKind: "participant",
        referenceParticipantId: "encounter-participant-hidden",
      },
      url: "/encounters/encounter-1/combat-round/generic-actions",
    });
    await app.close();

    expect(declared.statusCode, JSON.stringify(declared.json())).toBe(200);
    expect(declared.json().encounter.combatRoundState.genericActions).toMatchObject([
      {
        id: "generic-action-1",
        intent: "Bar the gate.",
        status: "active",
      },
    ]);
    expect(declared.json().encounter.combatRoundState.genericActions[0].rollResult).toBeDefined();
    expect(
      declared
        .json()
        .encounter.combatRoundState.participants.map(
          (participant: { participantId: string }) => participant.participantId,
        ),
    ).toEqual(["encounter-participant-1", "encounter-participant-2"]);
    expect(declared.json().encounter.combatRoundState).toMatchObject({
      phaseResolutionStatuses: {
        "encounter-participant-1": { phase1: { substep: "pending" } },
      },
      roundEndReview: {
        participantReviews: {
          "encounter-participant-1": expect.objectContaining({
            participantId: "encounter-participant-1",
          }),
        },
      },
    });
    expect(declared.json().encounter.combatRoundState).not.toHaveProperty("activeParticipantId");
    expect(declared.json().encounter.combatRoundState).not.toHaveProperty("currentCursor");
    expect(declared.json().encounter.combatRoundState).not.toHaveProperty("phaseResolutionCursor");
    expect(declared.json().encounter.combatRoundState).not.toHaveProperty("selectedParticipantId");
    expect(Object.keys(declared.json().encounter.combatRoundState.phaseResolutionStatuses)).toEqual(
      ["encounter-participant-1"],
    );
    expect(
      Object.keys(declared.json().encounter.combatRoundState.roundEndReview.participantReviews),
    ).toEqual(["encounter-participant-1"]);
    expect(JSON.stringify(declared.json().encounter)).not.toContain("Hidden spy");
    expect(JSON.stringify(declared.json().encounter)).not.toContain("encounter-participant-hidden");
    expect(retried.statusCode).toBe(200);
    expect(retried.json().encounter.combatRoundState.genericActions).toHaveLength(1);
    expect(mocks.encounterService.updateCombatEncounter).toHaveBeenCalledTimes(1);
    // The second creation path is closed: the request never reaches reference resolution, and it
    // still leaks nothing about the hidden participant it named.
    expect(hiddenReference.statusCode).toBe(400);
    expect(hiddenReference.json()).toEqual({
      code: "declaration_route_required",
      error: "Declare this Combat Task in the Combat declaration.",
    });
    expect(mocks.encounterService.updateCombatEncounter).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(hiddenReference.json())).not.toContain("Hidden spy");
    expect(JSON.stringify(hiddenReference.json())).not.toContain("encounter-participant-hidden");
  });

  it("preserves visible Combat cursor and selection identities in the player projection", async () => {
    const encounterParticipants = [
      makeEncounterCombatParticipant({
        id: "encounter-participant-1",
        label: "The Gladiator",
        order: 0,
        scenarioParticipantId: "participant-1",
      }),
      makeEncounterCombatParticipant({
        id: "encounter-participant-2",
        label: "Visible guard",
        order: 1,
        scenarioParticipantId: "participant-2",
      }),
    ];
    const encounter = makeCombatEncounter({
      participants: encounterParticipants,
      roleplayState: {
        visibility: {
          "encounter-participant-1": { "encounter-participant-2": true },
        },
      },
    }) as EncounterSession;
    const roundState = initializeCombatRoundState({ encounter });
    encounter.combatRoundState = combatRoundStateSchema.parse({
      ...roundState,
      activeParticipantId: "encounter-participant-2",
      currentCursor: {
        participantId: "encounter-participant-2",
        roundNumber: 1,
        step: "DE",
      },
      phaseResolutionStatuses: {
        "encounter-participant-2": { phase1: { substep: "attack" } },
      },
      selectedParticipantId: "encounter-participant-2",
    });
    setupCombatDeclarationRoute({
      encounter,
      participants: [
        makeCombatScenarioParticipant({ id: "participant-1" }),
        makeCombatScenarioParticipant({
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: { displayName: "Visible guard" },
        }),
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.combatRoundState).toMatchObject({
      activeParticipantId: "encounter-participant-2",
      currentCursor: {
        participantId: "encounter-participant-2",
        roundNumber: 1,
        step: "DE",
      },
      phaseResolutionStatuses: {
        "encounter-participant-2": { phase1: { substep: "attack" } },
      },
      selectedParticipantId: "encounter-participant-2",
    });
  });

  it("lets the GM authoritatively review generic action rolls and typed references", async () => {
    const baseEncounter = makeCombatEncounter() as EncounterSession;
    const roundState = initializeCombatRoundState({ encounter: baseEncounter });
    const genericActions = declareCombatGenericAction({
      action: {
        createdAt: "2026-08-14T18:00:00.000Z",
        duration: { kind: "round" },
        id: "generic-review-1",
        intent: "Survey the gatehouse.",
        ownerParticipantId: "encounter-participant-1",
        preset: "look_around",
        rollRequest: {
          basis: {
            avgStats: 14,
            baseValue: 21,
            derivedXp: 0,
            groupXp: 0,
            kind: "skill",
            skillId: "perception",
            skillLabel: "Perception",
            skillXp: 0,
            unknownSkillPenalty: 0,
          },
          difficulty: 26,
        },
      },
      actions: [],
    });
    const encounter = {
      ...baseEncounter,
      combatRoundState: { ...roundState, genericActions },
    } as EncounterSession;
    const participant = makeCombatScenarioParticipant({
      snapshot: createParticipantSnapshotFromEntity({
        entity: {
          kind: "npc",
          name: "The Gladiator",
          snapshot: {
            generatedHumanoidNpc: {
              stats: { base: { dex: 12 }, final: { dex: 14 } },
            },
          },
        },
      }).snapshot,
    });
    setupCombatDeclarationRoute({ encounter, participants: [participant], user: mocks.adminUser });
    setupMutableCombatRouteState({
      encounter,
      participants: [participant],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const statReview = await app.inject({
      method: "POST",
      payload: {
        actionId: "generic-review-1",
        difficulty: 31,
        duration: { kind: "rounds", rounds: 3 },
        environmentDescription: "The gatehouse roofline",
        expectedRevision: encounter.updatedAt,
        operation: "review",
        referenceKind: "environment",
        rollKind: "stat",
        statId: "dex",
      },
      url: "/encounters/encounter-1/combat-round/generic-actions",
    });
    const noRollReview = await app.inject({
      method: "POST",
      payload: {
        actionId: "generic-review-1",
        duration: { kind: "gm_decided" },
        expectedRevision: statReview.json().encounter.updatedAt,
        operation: "review",
        referenceKind: "none",
        rollKind: "none",
      },
      url: "/encounters/encounter-1/combat-round/generic-actions",
    });
    const skillReview = await app.inject({
      method: "POST",
      payload: {
        actionId: "generic-review-1",
        difficulty: 22,
        duration: { kind: "phase", phase: "phase2" },
        expectedRevision: noRollReview.json().encounter.updatedAt,
        operation: "review",
        referenceKind: "participant",
        referenceParticipantId: "encounter-participant-1",
        rollKind: "skill",
        skillId: "perception",
      },
      url: "/encounters/encounter-1/combat-round/generic-actions",
    });
    await app.close();

    expect(statReview.statusCode, JSON.stringify(statReview.json())).toBe(200);
    expect(statReview.json().encounter.combatRoundState.genericActions[0]).toMatchObject({
      duration: { kind: "rounds", rounds: 3 },
      reference: { description: "The gatehouse roofline", kind: "environment" },
      rollRequest: { basis: { baseValue: 14, kind: "stat", statId: "dex" }, difficulty: 31 },
      status: "reviewed",
    });
    expect(noRollReview.statusCode, JSON.stringify(noRollReview.json())).toBe(200);
    expect(noRollReview.json().encounter.combatRoundState.genericActions[0]).toMatchObject({
      duration: { kind: "gm_decided" },
      status: "reviewed",
    });
    expect(
      noRollReview.json().encounter.combatRoundState.genericActions[0].rollRequest,
    ).toBeUndefined();
    expect(
      noRollReview.json().encounter.combatRoundState.genericActions[0].reference,
    ).toBeUndefined();
    expect(skillReview.statusCode, JSON.stringify(skillReview.json())).toBe(200);
    expect(skillReview.json().encounter.combatRoundState.genericActions[0]).toMatchObject({
      duration: { kind: "phase", phase: "phase2" },
      reference: {
        kind: "participant",
        label: "The Gladiator",
        participantId: "encounter-participant-1",
      },
      rollRequest: {
        basis: { kind: "skill", skillId: "perception" },
        difficulty: 22,
      },
      status: "reviewed",
    });
  });

  it("interrupts fragile missile preparation once when a reviewed generic action becomes substantial", async () => {
    const baseEncounter = makeCombatEncounter() as EncounterSession;
    const roundState = initializeCombatRoundState({ encounter: baseEncounter });
    const genericActions = declareCombatGenericAction({
      action: {
        createdAt: "2026-08-18T10:00:00.000Z",
        duration: { kind: "round" },
        id: "generic-substantial-1",
        intent: "Force the barred gate.",
        ownerParticipantId: "encounter-participant-1",
      },
      actions: [],
    });
    const encounter = {
      ...baseEncounter,
      combatRoundState: combatRoundStateSchema.parse({
        ...roundState,
        genericActions,
        missileReadiness: [
          {
            aimCompletedRounds: 1,
            aimLevel: 1,
            aimRequiredRounds: 2,
            ammoFamily: "arrow",
            ammoItemId: "arrows",
            ammoItemRevision: "ammo-revision-1",
            baseCompletedRounds: 1,
            baseRequiredRounds: 1,
            family: "long_bow",
            gmPreparationAdjustment: 0,
            id: "missile-readiness:encounter-participant-1:bow",
            participantId: "encounter-participant-1",
            profile: {
              ammoFamily: "arrow",
              canRemainReady: false,
              family: "long_bow",
              fullNormalCycleRounds: 2,
              preparationModel: "continuous_fragile",
              rapidShotAllowed: true,
              standardPreparationRounds: 1,
            },
            rapidShot: false,
            status: "preparing",
            targetParticipantId: "encounter-participant-2",
            updatedAt: "2026-08-18T10:00:00.000Z",
            weaponItemId: "bow",
            weaponTemplateId: "weapon-template-long-bow",
          },
        ],
      }),
    } as EncounterSession;
    const participant = makeCombatScenarioParticipant();
    setupCombatDeclarationRoute({ encounter, participants: [participant], user: mocks.adminUser });
    setupMutableCombatRouteState({ encounter, participants: [participant], user: mocks.adminUser });
    const app = await buildScenarioTestApp();

    const reviewed = await app.inject({
      method: "POST",
      payload: {
        actionId: "generic-substantial-1",
        duration: { kind: "round" },
        expectedRevision: encounter.updatedAt,
        operation: "review",
        referenceKind: "none",
        rollKind: "none",
      },
      url: "/encounters/encounter-1/combat-round/generic-actions",
    });
    expect(reviewed.statusCode, JSON.stringify(reviewed.json())).toBe(200);
    expect(reviewed.json().encounter.combatRoundState.missileReadiness[0].status).toBe("preparing");
    expect(reviewed.json().encounter.combatRoundState.commands).toHaveLength(0);

    const activated = await app.inject({
      method: "POST",
      payload: {
        actionId: "generic-substantial-1",
        expectedRevision: reviewed.json().encounter.updatedAt,
        operation: "activate",
      },
      url: "/encounters/encounter-1/combat-round/generic-actions",
    });
    expect(activated.statusCode, JSON.stringify(activated.json())).toBe(200);
    expect(activated.json().encounter.combatRoundState.missileReadiness[0]).toMatchObject({
      aimCompletedRounds: 0,
      baseCompletedRounds: 0,
      status: "idle",
    });
    expect(activated.json().encounter.combatRoundState.commands).toHaveLength(1);
    expect(activated.json().encounter.combatRoundState.commands[0].type).toBe(
      "interrupt_missile_readiness",
    );

    const cancelled = await app.inject({
      method: "POST",
      payload: {
        actionId: "generic-substantial-1",
        expectedRevision: activated.json().encounter.updatedAt,
        operation: "cancel",
      },
      url: "/encounters/encounter-1/combat-round/generic-actions",
    });
    await app.close();
    expect(cancelled.statusCode, JSON.stringify(cancelled.json())).toBe(200);
    expect(cancelled.json().encounter.combatRoundState.commands).toHaveLength(1);
  });

  it("lists campaigns for the authenticated game master", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    mocks.campaignService.listCampaignsByGameMaster.mockResolvedValue([campaign]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json()).toEqual({
      campaigns: [campaign],
    });
    expect(mocks.campaignService.listCampaignsByGameMaster).toHaveBeenCalledWith("gm-1");
  });

  it("keeps Campaign workspace authorization denial distinct from operational failure", async () => {
    mocks.requireAdminUser.mockImplementationOnce(async (_request, reply) => {
      await reply.code(403).send({ error: "Admin or GM role required." });
      return null;
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/campaign-1/scenarios",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Admin or GM role required." });
    expect(mocks.campaignService.getCampaignById).not.toHaveBeenCalled();
    expect(mocks.scenarioService.listScenariosByCampaign).not.toHaveBeenCalled();
  });

  it("keeps a hidden Campaign privacy-safe instead of classifying it as a load failure", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "other-gm",
      id: "campaign-1",
      name: "Private Campaign",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/campaign-1/scenarios",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Campaign not found." });
    expect(mocks.scenarioService.listScenariosByCampaign).not.toHaveBeenCalled();
  });

  it("returns a sanitized 500 when the owning GM Campaign Scenario query fails", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.scenarioService.listScenariosByCampaign.mockRejectedValue(
      new Error(
        "Invalid `prisma.scenario.findMany()` invocation in /srv/glantri/packages/database/src/repositories/scenarioRepository.ts: Value 'paused' not found in enum ScenarioStatus",
      ),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/campaign-1/scenarios",
    });

    await app.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      code: "CAMPAIGN_LOAD_FAILED",
      error: "Unable to load campaign data. Please try again.",
    });
    const clientPayload = JSON.stringify(response.json()).toLowerCase();
    for (const diagnostic of ["prisma", "/srv/", "findmany", "scenariostatus", "paused"]) {
      expect(clientPayload).not.toContain(diagnostic);
    }
  });

  it("lists player-accessible campaigns through the player-safe projection", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      description: "A player briefing.",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: { allowPlayerSelfJoin: false, defaultVisibility: "hidden" },
      slug: "border-trouble",
      status: "active",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    const scenario = {
      campaignId: "campaign-1",
      createdAt: "2026-05-09T12:00:00.000Z",
      description: "Hold the bridge.",
      id: "scenario-live",
      kind: "mixed",
      mapAssetId: "private-map",
      name: "Live Scene",
      status: "live",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    mocks.campaignService.listCampaignsByUserAccess.mockResolvedValue([campaign]);
    mocks.scenarioService.listScenariosByCampaignPlayerControl.mockResolvedValue([scenario]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/accessible",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accessibleCampaigns: [
        {
          campaign: {
            description: "A player briefing.",
            id: "campaign-1",
            name: "Border Trouble",
          },
          scenarios: [
            {
              campaignId: "campaign-1",
              description: "Hold the bridge.",
              id: "scenario-live",
              name: "Live Scene",
              status: "live",
            },
          ],
        },
      ],
    });
    expect(response.json().accessibleCampaigns[0].campaign).toEqual({
      description: "A player briefing.",
      id: "campaign-1",
      name: "Border Trouble",
    });
    expect(JSON.stringify(response.json())).not.toContain("gm-1");
    expect(JSON.stringify(response.json())).not.toContain("private-map");
    expect(JSON.stringify(response.json())).not.toContain("allowPlayerSelfJoin");
    expect(mocks.campaignService.listCampaignsByUserAccess).toHaveBeenCalledWith("player-1");
    expect(mocks.scenarioService.listScenariosByCampaignPlayerControl).toHaveBeenCalledWith(
      "campaign-1",
      "player-1",
    );
  });

  it("builds one private-safe Campaign Home record with a truthful combat resume target", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      description: "A player briefing.",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: { allowPlayerSelfJoin: false, defaultVisibility: "hidden" },
      slug: "border-trouble",
      status: "active",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    const scenario = {
      campaignId: "campaign-1",
      createdAt: "2026-05-09T12:00:00.000Z",
      description: "Hold the bridge.",
      id: "scenario-1",
      kind: "mixed",
      mapAssetId: "private-map",
      name: "The Bridge",
      status: "live",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    const participant = makeCombatScenarioParticipant({
      characterId: "character-1",
      controlledByUserId: "player-1",
      snapshot: { displayName: "Ari" },
    });
    mocks.campaignService.listCampaignsByUserAccess.mockResolvedValue([campaign]);
    mocks.campaignService.listPlayerCampaignCharacters.mockResolvedValue([
      { id: "character-1", name: "Ari" },
    ]);
    mocks.scenarioService.listScenariosByCampaignPlayerAccess.mockResolvedValue([scenario]);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([participant]);
    mocks.encounterService.listEncountersByScenario.mockResolvedValue([
      makeCombatEncounter({ description: "GM-only setup" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({ method: "GET", url: "/campaigns/player-home" });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json()).toEqual({
      campaigns: [
        {
          campaign: {
            description: "A player briefing.",
            id: "campaign-1",
            name: "Border Trouble",
          },
          characters: [{ id: "character-1", name: "Ari" }],
          resume: {
            encounterId: "encounter-1",
            scenarioId: "scenario-1",
            tab: "player-combat",
          },
          scenarios: [
            {
              characters: [{ id: "character-1", name: "Ari" }],
              encounter: {
                id: "encounter-1",
                status: "active",
                title: "A doubtful success",
              },
              scenario: {
                campaignId: "campaign-1",
                description: "Hold the bridge.",
                id: "scenario-1",
                name: "The Bridge",
                status: "live",
              },
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(response.json())).not.toContain("GM-only setup");
    expect(JSON.stringify(response.json())).not.toContain("private-map");
    expect(JSON.stringify(response.json())).not.toContain("participants");
  });

  it("keeps an owned Campaign but withholds a live Scenario delegated to another player", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      description: "Campaign-level briefing.",
      gmUserId: "gm-1",
      id: "campaign-delegated",
      name: "Delegated Campaign",
      settings: { allowPlayerSelfJoin: false, defaultVisibility: "hidden" },
      slug: "delegated-campaign",
      status: "active",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    const delegatedScenario = {
      campaignId: campaign.id,
      createdAt: "2026-05-09T12:00:00.000Z",
      description: "Private to delegated controller",
      id: "scenario-delegated-private",
      kind: "roleplay",
      name: "Delegated Private Scenario",
      status: "live",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    mocks.campaignService.listCampaignsByUserAccess.mockResolvedValue([campaign]);
    mocks.campaignService.listPlayerCampaignCharacters.mockResolvedValue([
      { id: "character-owned", name: "Ari" },
    ]);
    mocks.scenarioService.listScenariosByCampaignPlayerAccess.mockResolvedValue([
      delegatedScenario,
    ]);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({
        characterId: "character-owned",
        controlledByUserId: "player-2",
        snapshot: { displayName: "Ari" },
      }),
    ]);
    mocks.encounterService.listEncountersByScenario.mockResolvedValue([]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({ method: "GET", url: "/campaigns/player-home" });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json()).toEqual({
      campaigns: [
        {
          campaign: {
            description: "Campaign-level briefing.",
            id: "campaign-delegated",
            name: "Delegated Campaign",
          },
          characters: [],
          resume: { tab: "campaign" },
          scenarios: [],
        },
      ],
    });
    expect(JSON.stringify(response.json())).not.toContain("scenario-delegated-private");
    expect(JSON.stringify(response.json())).not.toContain("Delegated Private Scenario");
    expect(JSON.stringify(response.json())).not.toContain("Private to delegated controller");
  });

  it("keeps draft Campaigns out of player home discovery", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      description: "A draft campaign.",
      gmUserId: "gm-1",
      id: "campaign-draft",
      name: "Draft Trouble",
      settings: { allowPlayerSelfJoin: false, defaultVisibility: "hidden" },
      slug: "draft-trouble",
      status: "draft",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    mocks.campaignService.listCampaignsByUserAccess.mockResolvedValue([campaign]);
    mocks.campaignService.listPlayerCampaignCharacters.mockResolvedValue([]);
    mocks.scenarioService.listScenariosByCampaignPlayerAccess.mockResolvedValue([]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/player-home",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json()).toEqual({
      campaigns: [],
    });
    expect(mocks.scenarioService.listScenariosByCampaignPlayerAccess).not.toHaveBeenCalled();
  });

  it("keeps an active roster Campaign directly accessible with no live Scenario", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      description: "A quiet campaign.",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: { allowPlayerSelfJoin: false, defaultVisibility: "hidden" },
      slug: "border-trouble",
      status: "active",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    mocks.campaignService.listCampaignsByUserAccess.mockResolvedValue([campaign]);
    mocks.scenarioService.listScenariosByCampaignPlayerControl.mockResolvedValue([]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/accessible/campaign-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      accessibleCampaign: {
        campaign: {
          description: "A quiet campaign.",
          id: "campaign-1",
          name: "Border Trouble",
        },
        scenarios: [],
      },
    });
  });

  it("keeps an inaccessible player Campaign privacy-safe", async () => {
    mocks.campaignService.listCampaignsByUserAccess.mockResolvedValue([]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/accessible/campaign-hidden",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Campaign not found." });
    expect(mocks.scenarioService.listScenariosByCampaignPlayerControl).not.toHaveBeenCalled();
  });

  it("sanitizes an operational player Campaign access query failure", async () => {
    mocks.campaignService.listCampaignsByUserAccess.mockRejectedValue(
      new Error(
        "Invalid `prisma.campaign.findMany()` invocation at /srv/glantri/scenarioRepository.ts: database enum mismatch",
      ),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/accessible/campaign-1",
    });

    await app.close();

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      code: "CAMPAIGN_LOAD_FAILED",
      error: "Unable to load campaign data. Please try again.",
    });
    const clientPayload = JSON.stringify(response.json()).toLowerCase();
    for (const diagnostic of ["prisma", "/srv/", "findmany", "enum", "scenariorepository"]) {
      expect(clientPayload).not.toContain(diagnostic);
    }
  });

  it("activates a draft Campaign through the campaign activation endpoint", async () => {
    const campaign = {
      createdAt: "2026-05-09T12:00:00.000Z",
      description: "Campaign prelaunch.",
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: { allowPlayerSelfJoin: false, defaultVisibility: "hidden" },
      slug: "border-trouble",
      status: "active",
      updatedAt: "2026-05-09T12:00:00.000Z",
    };
    mocks.campaignService.activateCampaign.mockResolvedValue(campaign);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/campaigns/campaign-1/activate",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ campaign });
    expect(mocks.campaignService.activateCampaign).toHaveBeenCalledWith({
      actorIsAdmin: false,
      actorUserId: "gm-1",
      campaignId: "campaign-1",
    });
  });

  it("does not let an unrelated admin activate another GM's draft Campaign", async () => {
    mocks.campaignService.activateCampaign.mockRejectedValue(new Error("Campaign not found."));
    mocks.requireAdminUser.mockResolvedValue({
      ...mocks.adminUser,
      id: "admin-1",
      roles: ["admin"],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/campaigns/campaign-1/activate",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Campaign not found." });
    expect(mocks.campaignService.activateCampaign).toHaveBeenCalledWith({
      actorIsAdmin: true,
      actorUserId: "admin-1",
      campaignId: "campaign-1",
    });
  });

  it("returns the private Campaign workspace only to its owning GM", async () => {
    const overview = {
      campaign: { gmUserId: "gm-1", id: "campaign-1", name: "Border Trouble" },
      currentContexts: [],
      notes: [{ content: "Secret plan", id: "note-1" }],
      npcs: [],
      recentActivity: [],
      references: [],
      roster: [],
    };
    mocks.campaignService.getCampaignById.mockResolvedValue(overview.campaign);
    mocks.campaignManagementService.getOverview.mockResolvedValue(overview);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/campaign-1/workspace-overview",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ overview });
    expect(mocks.campaignManagementService.getOverview).toHaveBeenCalledWith("campaign-1");
  });

  it("returns a non-disclosing not-found response to an unrelated admin", async () => {
    mocks.requireAdminUser.mockResolvedValue({
      email: "admin@example.test",
      id: "admin-1",
      roles: ["admin"],
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-owner",
      id: "campaign-1",
      name: "Private Campaign",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/campaign-1/workspace-overview",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Campaign not found." });
    expect(JSON.stringify(response.json())).not.toContain("Private Campaign");
    expect(mocks.campaignManagementService.getOverview).not.toHaveBeenCalled();
  });

  it("creates a private Campaign note with a validated typed reference", async () => {
    const campaign = { gmUserId: "gm-1", id: "campaign-1", name: "Border Trouble" };
    const reference = { id: "scenario-1", label: "Bridge Ambush", type: "scenario" };
    const note = {
      campaignId: campaign.id,
      content: "Question the sentry",
      id: "note-1",
      reference,
    };
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.campaignManagementService.createNote.mockResolvedValue(note);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: { content: note.content, reference },
      url: "/campaigns/campaign-1/notes",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ note });
    expect(mocks.campaignManagementService.createNote).toHaveBeenCalledWith({
      actorUserId: "gm-1",
      campaignId: "campaign-1",
      content: note.content,
      reference,
    });
  });

  it("submits the exact expected revision when editing a private Campaign note", async () => {
    const campaign = { gmUserId: "gm-1", id: "campaign-1", name: "Border Trouble" };
    const note = {
      campaignId: campaign.id,
      content: "Accepted edit",
      id: "note-1",
      updatedAt: "2026-09-17T09:00:00.000Z",
    };
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.campaignManagementService.updateNote.mockResolvedValue(note);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PUT",
      payload: {
        content: note.content,
        expectedRevision: "2026-09-17T08:00:00.000Z",
        reference: null,
      },
      url: "/campaigns/campaign-1/notes/note-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ note });
    expect(mocks.campaignManagementService.updateNote).toHaveBeenCalledWith({
      actorUserId: "gm-1",
      campaignId: "campaign-1",
      content: note.content,
      expectedRevision: "2026-09-17T08:00:00.000Z",
      noteId: "note-1",
      reference: null,
    });
  });

  it("returns the current private Note on a stale revision conflict", async () => {
    const campaign = { gmUserId: "gm-1", id: "campaign-1", name: "Border Trouble" };
    const currentNote = {
      campaignId: campaign.id,
      content: "Accepted edit from A",
      id: "note-1",
      updatedAt: "2026-09-17T09:00:00.000Z",
    };
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.campaignManagementService.updateNote.mockRejectedValue(
      new mocks.CampaignNoteConflictError(currentNote),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PUT",
      payload: {
        content: "Stale edit from B",
        expectedRevision: "2026-09-17T08:00:00.000Z",
        reference: null,
      },
      url: "/campaigns/campaign-1/notes/note-1",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "campaign_note_revision_conflict",
      currentNote,
      error: "Campaign note changed. Review the current Note before saving again.",
    });
  });

  it("returns a safe validation error for a foreign Campaign note reference", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
    });
    mocks.campaignManagementService.createNote.mockRejectedValue(
      new mocks.CampaignNoteReferenceError(
        "Campaign note reference is not available in this Campaign.",
      ),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        content: "Private",
        reference: { id: "foreign-scenario", label: "Foreign", type: "scenario" },
      },
      url: "/campaigns/campaign-1/notes",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Campaign note reference is not available in this Campaign.",
    });
    expect(JSON.stringify(response.json())).not.toContain("foreign-scenario");
  });

  it("prevents draft activation when campaign is no longer draft", async () => {
    mocks.campaignService.activateCampaign.mockRejectedValue(
      new Error("Campaign can only be activated from draft status."),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/campaigns/campaign-1/activate",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Campaign can only be activated from draft status.",
    });
    expect(mocks.campaignService.activateCampaign).toHaveBeenCalledWith({
      actorIsAdmin: false,
      actorUserId: "gm-1",
      campaignId: "campaign-1",
    });
  });

  it("returns a validation error for stale activation conflicts", async () => {
    mocks.campaignService.activateCampaign.mockRejectedValue(
      new Error("Campaign activation is stale and must be retried."),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/campaigns/campaign-1/activate",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Campaign activation is stale and must be retried.",
    });
  });

  it("returns authorization failure for non-admin users changing campaign status", async () => {
    mocks.requireAdminUser.mockImplementation(async (_request, reply) => {
      await reply.code(403).send({ error: "Admin or GM role required." });
      return null;
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/campaigns/campaign-1/activate",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Admin or GM role required." });
    expect(mocks.campaignService.activateCampaign).not.toHaveBeenCalled();
  });

  it("returns a validation error instead of calling the service for invalid campaign creation", async () => {
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        status: "active",
      },
      url: "/campaigns",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "name is required.",
    });
    expect(mocks.campaignService.createCampaign).not.toHaveBeenCalled();
  });

  it("creates a scenario under a campaign owned by the game master", async () => {
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "draft",
    };
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.createScenario.mockResolvedValue(scenario);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        kind: "combat",
        name: "Bridge Ambush",
        status: "draft",
      },
      url: "/campaigns/campaign-1/scenarios",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      scenario,
    });
    expect(mocks.scenarioService.createScenario).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      continuesFromScenarioId: undefined,
      description: undefined,
      kind: "combat",
      mapAssetId: undefined,
      name: "Bridge Ambush",
      status: "draft",
    });
  });

  it("creates one concrete generated NPC and campaign roster link", async () => {
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const snapshot = {
      actorClass: "generated_npc",
      build: makeDodgeCharacterBuild("generated-npc-1", "Captain Harl"),
      equipmentState: {
        activeLoadoutByCharacterId: {},
        itemsById: {},
        locationsById: {},
        templatesById: {},
      },
      generatedHumanoidNpc: {
        actorId: "generated-npc-1",
        sourceTemplateId: "template-guard",
      },
      sheetSummary: { draftView: { skills: [] } },
    };
    const result = {
      entity: {
        gmUserId: "gm-1",
        id: "entity-1",
        kind: "npc",
        name: "Captain Harl",
        snapshot: { ...snapshot, actorClass: "campaign_npc", campaignId: "campaign-1" },
      },
      rosterEntry: {
        campaignId: "campaign-1",
        category: "npc",
        id: "roster-1",
        sourceId: "entity-1",
        sourceType: "reusableEntity",
      },
    };
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.campaignService.createCampaignNpc.mockResolvedValue(result);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        description: "A reusable watch officer.",
        kind: "npc",
        name: "Captain Harl",
        snapshot,
      },
      url: "/campaigns/campaign-1/npcs",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json()).toEqual(result);
    expect(mocks.campaignService.createCampaignNpc).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      createdByUserId: "gm-1",
      description: "A reusable watch officer.",
      gmUserId: "gm-1",
      kind: "npc",
      name: "Captain Harl",
      notes: undefined,
      snapshot,
    });
  });

  it("does not create a concrete NPC outside the game master's campaign", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "other-gm",
      id: "campaign-1",
      name: "Other campaign",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: { kind: "npc", name: "Captain Harl", snapshot: {} },
      url: "/campaigns/campaign-1/npcs",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(mocks.campaignService.createCampaignNpc).not.toHaveBeenCalled();
  });

  it("adds an owned reusable NPC to its campaign roster with actor authorization context", async () => {
    const rosterEntry = {
      campaignId: "campaign-1",
      category: "npc",
      id: "roster-1",
      labelSnapshot: "Private NPC",
      sourceId: "entity-1",
      sourceType: "reusableEntity",
    };
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.addCampaignRosterEntry.mockResolvedValue(rosterEntry);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        category: "npc",
        sourceId: "entity-1",
        sourceType: "reusableEntity",
      },
      url: "/campaigns/campaign-1/roster",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json()).toEqual({ rosterEntry });
    expect(mocks.campaignService.addCampaignRosterEntry).toHaveBeenCalledWith({
      actorIsAdmin: false,
      actorUserId: "gm-1",
      campaignId: "campaign-1",
      category: "npc",
      createdByUserId: "gm-1",
      notes: undefined,
      sourceId: "entity-1",
      sourceType: "reusableEntity",
    });
  });

  it("does not disclose a foreign or cross-campaign reusable NPC through the roster API", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.addCampaignRosterEntry.mockRejectedValue(
      new Error("Reusable entity not found."),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        category: "npc",
        sourceId: "foreign-private-entity",
        sourceType: "reusableEntity",
      },
      url: "/campaigns/campaign-1/roster",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Reusable entity not found." });
    expect(JSON.stringify(response.json())).not.toContain("Private NPC");
  });

  it("lists only the safe Campaign-scoped Character candidate projection for the owning GM", async () => {
    const characters = [
      {
        alreadyRostered: false,
        currentElsewhere: false,
        id: "character-1",
        membershipState: "none",
        name: "Ari",
        ownerLabel: "You",
      },
      {
        alreadyRostered: true,
        currentElsewhere: false,
        id: "character-2",
        membershipState: "current",
        name: "Bryn",
        ownerLabel: "Player Two",
      },
    ];
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.listCampaignCharacterRosterCandidates.mockResolvedValue(characters);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/campaign-1/roster-candidates/characters",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json()).toEqual({ characters });
    expect(Object.keys(response.json().characters[0]).sort()).toEqual([
      "alreadyRostered",
      "currentElsewhere",
      "id",
      "membershipState",
      "name",
      "ownerLabel",
    ]);
    expect(JSON.stringify(response.json())).not.toContain("email");
    expect(JSON.stringify(response.json())).not.toContain("build");
    expect(JSON.stringify(response.json())).not.toContain("ownerId");
    expect(mocks.campaignService.listCampaignCharacterRosterCandidates).toHaveBeenCalledWith({
      actorUserId: "gm-1",
      campaignId: "campaign-1",
    });
  });

  it("does not expose Campaign Character candidates to a non-owning GM", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "other-gm",
      id: "campaign-1",
      name: "Private Campaign",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/campaigns/campaign-1/roster-candidates/characters",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Campaign not found." });
    expect(mocks.campaignService.listCampaignCharacterRosterCandidates).not.toHaveBeenCalled();
  });

  it.each([
    { error: "Authentication required.", label: "anonymous", status: 401 },
    { error: "Admin or GM role required.", label: "player", status: 403 },
  ])(
    "returns a safe $status response for a $label candidate request",
    async ({ error, status }) => {
      mocks.requireAdminUser.mockImplementationOnce(async (_request, reply) => {
        await reply.code(status).send({ error });
        return null;
      });
      const app = await buildScenarioTestApp();

      const response = await app.inject({
        method: "GET",
        url: "/campaigns/campaign-1/roster-candidates/characters",
      });

      await app.close();

      expect(response.statusCode).toBe(status);
      expect(response.json()).toEqual({ error });
      expect(mocks.campaignService.getCampaignById).not.toHaveBeenCalled();
      expect(mocks.campaignService.listCampaignCharacterRosterCandidates).not.toHaveBeenCalled();
    },
  );

  it("returns one non-disclosing error for an ineligible Character roster id", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.addCampaignRosterEntry.mockRejectedValue(
      new mocks.CampaignCharacterRosterCandidateNotFoundError(),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        category: "pc",
        sourceId: "local-draft-or-forged",
        sourceType: "character",
      },
      url: "/campaigns/campaign-1/roster",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: "Campaign character candidate not found.",
    });
    expect(JSON.stringify(response.json())).not.toContain("local-draft-or-forged");
  });

  it("does not expose database diagnostics when adding a Campaign roster entry fails", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.addCampaignRosterEntry.mockRejectedValue(
      new Error(
        "Invalid `prisma.campaignRosterEntry.create()` invocation in /srv/glantri/packages/database/src/repositories/scenarioRepository.ts: Unique constraint failed on the fields: (`campaignId`,`sourceType`,`sourceId`)",
      ),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        category: "pc",
        sourceId: "character-1",
        sourceType: "character",
      },
      url: "/campaigns/campaign-1/roster",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Unable to add campaign roster entry." });
    const clientPayload = JSON.stringify(response.json());
    for (const internalDiagnostic of [
      "prisma",
      "/srv/",
      "CampaignRosterEntry",
      "campaignId",
      "sourceType",
      "sourceId",
      "Unique constraint",
      "scenarioRepository",
    ]) {
      expect(clientPayload.toLowerCase()).not.toContain(internalDiagnostic.toLowerCase());
    }
  });

  it("does not let an unrelated admin link a private Campaign NPC", async () => {
    const adminUser = {
      email: "admin@example.test",
      id: "admin-1",
      roles: ["admin"],
    };
    mocks.requireAdminUser.mockResolvedValue(adminUser);
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-owner",
      id: "campaign-1",
      name: "Owner Campaign",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        category: "npc",
        sourceId: "entity-1",
        sourceType: "reusableEntity",
      },
      url: "/campaigns/campaign-1/roster",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Campaign not found." });
    expect(mocks.campaignService.addCampaignRosterEntry).not.toHaveBeenCalled();
  });

  it("lists live roster-eligible scenarios for a character without campaign self-join", async () => {
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    mocks.campaignService.listCampaignsByCharacterRosterAccess.mockResolvedValue([campaign]);
    mocks.scenarioService.listScenariosByCampaign.mockResolvedValue([
      {
        campaignId: "campaign-1",
        id: "scenario-live",
        kind: "mixed",
        name: "Live Scene",
        status: "live",
      },
      {
        campaignId: "campaign-1",
        id: "scenario-draft",
        kind: "mixed",
        name: "Draft Scene",
        status: "draft",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/joinable?characterId=character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      joinableScenarios: [
        {
          campaignId: "campaign-1",
          campaignName: "Border Trouble",
          kind: "mixed",
          scenarioId: "scenario-live",
          scenarioName: "Live Scene",
          status: "live",
        },
      ],
    });
    expect(mocks.campaignService.listCampaignsByCharacterRosterAccess).toHaveBeenCalledWith(
      "character-1",
    );
  });

  it("removes a campaign character roster membership by source identity", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: true });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: true, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId: "character-1",
      sourceType: "character",
    });
  });

  it("accepts UUID character source ids on the source-key removal route", async () => {
    const sourceId = "23831e49-9060-493d-9eaf-65667c210ce5";
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: true });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: `/campaigns/campaign-1/roster-membership/character/${sourceId}`,
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: true, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId,
      sourceType: "character",
    });
  });

  it("removes a campaign template roster membership by source identity", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: true });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/template/template-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: true, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId: "template-1",
      sourceType: "template",
    });
  });

  it("rejects roster membership removal outside the game master's campaign", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "other-gm",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({
      code: "CAMPAIGN_NOT_FOUND",
      error: "Campaign not found.",
      route: "source-key",
    });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).not.toHaveBeenCalled();
  });

  it("keeps query-based roster membership removal as a compatibility no-op path", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource
      .mockResolvedValueOnce({ removed: true })
      .mockResolvedValueOnce({ removed: false });
    const app = await buildScenarioTestApp();

    const firstResponse = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership?sourceType=character&sourceId=character-1",
    });
    const secondResponse = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership?sourceType=character&sourceId=character-1",
    });

    await app.close();

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    expect(firstResponse.json()).toEqual({ ok: true, removed: true, route: "source-query" });
    expect(secondResponse.json()).toEqual({ ok: true, removed: false, route: "source-query" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledTimes(2);
  });

  it("treats missing source-key roster membership removal as successful and idempotent", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockResolvedValue({ removed: false });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/missing-character",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, removed: false, route: "source-key" });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      sourceId: "missing-character",
      sourceType: "character",
    });
  });

  it("returns source-key diagnostics when roster membership removal fails", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.campaignService.removeCampaignRosterEntryBySource.mockRejectedValue(
      new Error("Synthetic delete failure"),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/character/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "CAMPAIGN_ROSTER_REMOVE_FAILED",
      details: {
        campaignId: "campaign-1",
        causeMessage: "Synthetic delete failure",
        causeName: "Error",
        route: "source-key",
        sourceId: "character-1",
        sourceType: "character",
      },
      error: "Synthetic delete failure",
      route: "source-key",
    });
  });

  it("returns a useful validation error for invalid roster source types", async () => {
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "DELETE",
      url: "/campaigns/campaign-1/roster-membership/pc/character-1",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      code: "INVALID_ROSTER_SOURCE_TYPE",
      error: "Invalid roster source type. Expected character, reusableEntity, or template.",
      route: "source-key",
    });
    expect(mocks.campaignService.removeCampaignRosterEntryBySource).not.toHaveBeenCalled();
  });

  it("allows a player-owned roster character to join a live scenario", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "mixed",
      name: "Live Scene",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: {
        allowPlayerSelfJoin: false,
      },
      status: "active",
    };
    const participant = {
      characterId: "character-1",
      controlledByUserId: "player-1",
      id: "participant-1",
      scenarioId: "scenario-1",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.characterService.getOwnedCharacter.mockResolvedValue({
      id: "character-1",
      ownerId: "player-1",
    });
    mocks.campaignService.listCampaignRosterEntries.mockResolvedValue([
      {
        campaignId: "campaign-1",
        id: "roster-1",
        sourceId: "character-1",
        sourceType: "character",
      },
    ]);
    mocks.scenarioService.addCharacterParticipant.mockResolvedValue(participant);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        characterId: "character-1",
        controlledByUserId: "player-1",
        joinSource: "player_joined",
        role: "player_character",
      },
      url: "/scenarios/scenario-1/participants/character",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ participant });
    expect(mocks.scenarioService.addCharacterParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        characterId: "character-1",
        joinSource: "player_joined",
        scenarioId: "scenario-1",
      }),
    );
  });

  it("rejects player scenario join when the character is not in the campaign roster", async () => {
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "mixed",
      name: "Live Scene",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: {
        allowPlayerSelfJoin: false,
      },
      status: "active",
    });
    mocks.characterService.getOwnedCharacter.mockResolvedValue({
      id: "character-1",
      ownerId: "player-1",
    });
    mocks.campaignService.listCampaignRosterEntries.mockResolvedValue([]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        characterId: "character-1",
        joinSource: "player_joined",
        role: "player_character",
      },
      url: "/scenarios/scenario-1/participants/character",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: "This character is not currently assigned to a campaign.",
    });
    expect(mocks.scenarioService.addCharacterParticipant).not.toHaveBeenCalled();
  });

  it.each([
    { id: "gm-1", roles: ["game_master"] },
    { id: "admin-1", roles: ["admin"] },
  ])("rejects unauthorized or out-of-roster Scenario admission for $roles", async (user) => {
    mocks.requireAuthenticatedUser.mockResolvedValue({
      email: `${user.id}@example.test`,
      ...user,
    });
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "mixed",
      name: "Live Scene",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      settings: { allowPlayerSelfJoin: false },
      status: "active",
    });
    mocks.campaignService.listCampaignRosterEntries.mockResolvedValue([]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        characterId: "out-of-roster-or-forged",
        joinSource: "gm_added",
      },
      url: "/scenarios/scenario-1/participants/character",
    });

    await app.close();

    if (user.roles.includes("admin")) {
      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Scenario not found." });
    } else {
      expect(response.statusCode).toBe(403);
      expect(response.json()).toEqual({
        error: "This character is not currently assigned to a campaign.",
      });
    }
    expect(mocks.scenarioService.addCharacterParticipant).not.toHaveBeenCalled();
  });

  it.each(["draft", "prepared"])(
    "hides %s Scenario workspace access from players even with ownership",
    async (status) => {
      mocks.scenarioService.getScenarioById.mockResolvedValue({
        campaignId: "campaign-1",
        id: "scenario-1",
        kind: "mixed",
        name: "Early Scenario",
        status,
      });
      mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
      mocks.campaignService.getCampaignById.mockResolvedValue({
        gmUserId: "gm-1",
        id: "campaign-1",
        name: "Border Trouble",
        status: "active",
      });
      const app = await buildScenarioTestApp();

      const response = await app.inject({
        method: "POST",
        payload: {
          characterId: "character-1",
          joinSource: "player_joined",
          role: "player_character",
        },
        url: "/scenarios/scenario-1/participants/character",
      });

      await app.close();

      expect(response.statusCode).toBe(404);
      expect(response.json()).toEqual({ error: "Scenario not found." });
      expect(mocks.scenarioService.addCharacterParticipant).not.toHaveBeenCalled();
    },
  );

  it("lets the scenario GM explicitly reconcile a character participant equipment projection", async () => {
    const participant = { characterId: "character-1", id: "participant-1" };
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.refreshCharacterParticipantEquipmentSnapshot.mockResolvedValue(
      participant,
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/scenarios/scenario-1/participants/participant-1/reconcile-character-equipment",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ participant });
    expect(mocks.scenarioService.refreshCharacterParticipantEquipmentSnapshot).toHaveBeenCalledWith(
      { participantId: "participant-1", scenarioId: "scenario-1" },
    );
  });

  it("lists encounters for a player with scenario workspace access", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const encounter = encounterSessionSchema.parse({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-1",
      participantMembershipMode: "explicit",
      participants: [
        {
          id: "encounter-player",
          label: "Player",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.encounterService.listEncountersByScenario.mockResolvedValue([encounter]);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Player" },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/encounters",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      encounters: [expect.objectContaining({ id: "encounter-1", title: "Courtyard" })],
    });
    expect(mocks.scenarioService.userHasPlayerScenarioAccess).toHaveBeenCalledWith({
      scenarioId: "scenario-1",
      userId: "player-1",
    });
    expect(mocks.encounterService.listEncountersByScenario).toHaveBeenCalledWith("scenario-1");
  });

  it("returns the bounded scenario encounter-management projection for the GM", async () => {
    const projection = {
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      description: "Hold the courtyard.",
      id: "encounter-1",
      kind: "combat",
      participantCount: 1,
      participantMembershipMode: "explicit",
      participantMemberships: [{ id: "encounter-player", scenarioParticipantId: "participant-1" }],
      scenarioId: "scenario-1",
      status: "active",
      timelineLabel: "Dawn",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:05:00.000Z",
    };
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.combatStateReadService.listScenarioEncounterManagementProjections.mockResolvedValue([
      projection,
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/encounters",
    });

    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ encounters: [projection] });
    expect(response.body).not.toContain("combatRoundState");
    expect(response.body).not.toContain("roleplayState");
    expect(response.body).not.toContain("commands");
    expect(response.body).not.toContain("snapshots");
    expect(
      mocks.combatStateReadService.listScenarioEncounterManagementProjections,
    ).toHaveBeenCalledWith("scenario-1");
    expect(mocks.encounterService.listEncountersByScenario).not.toHaveBeenCalled();
  });

  it.each([
    ["Scenario", "/scenarios/scenario-1", "Scenario not found."],
    ["Scenario projection", "/scenarios/scenario-1/player-projection", "Scenario not found."],
    ["Scenario encounters", "/scenarios/scenario-1/encounters", "Scenario not found."],
    ["Encounter", "/encounters/encounter-1", "Encounter not found."],
    ["Combat history", "/encounters/encounter-1/combat-history", "Encounter not found."],
  ])("fails closed for delegated-owner %s direct reads", async (_label, url, error) => {
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      description: "Private to delegated controller",
      id: "scenario-1",
      name: "Delegated Private Scenario",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(false);
    mocks.encounterService.getEncounterById.mockResolvedValue({
      createdAt: "2026-08-13T12:00:00.000Z",
      description: "Controller-only moment",
      id: "encounter-1",
      scenarioId: "scenario-1",
      status: "active",
      title: "Delegated Private Encounter",
      updatedAt: "2026-08-13T12:00:00.000Z",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({ method: "GET", url });

    await app.close();
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error });
    expect(response.body).not.toContain("Delegated Private Scenario");
    expect(response.body).not.toContain("Private to delegated controller");
    expect(response.body).not.toContain("Delegated Private Encounter");
    expect(response.body).not.toContain("Controller-only moment");
  });

  it("requires Campaign-home access for player Scenario direct reads", async () => {
    const scenario = {
      campaignId: "campaign-1",
      description: "Private to untrusted player",
      id: "scenario-1",
      name: "Hidden Campaign-linked Scenario",
      status: "live",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.campaignService.listCampaignsByUserAccess.mockResolvedValue([]);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);

    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Scenario not found." });
    expect(response.body).not.toContain("Hidden Campaign-linked Scenario");
    expect(response.body).not.toContain("Private to untrusted player");
    expect(mocks.campaignService.listCampaignsByUserAccess).toHaveBeenCalledWith("player-1");
    expect(mocks.scenarioService.userHasPlayerScenarioAccess).toHaveBeenCalledWith({
      scenarioId: "scenario-1",
      userId: "player-1",
    });
  });

  it("returns conflict response for stale direct Scenario updates", async () => {
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      createdAt: "2026-04-21T00:00:00.000Z",
      id: "scenario-1",
      name: "Stale target",
      status: "draft",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.updateScenario.mockRejectedValue({
      code: "stale_revision",
      message: "Scenario changed before this update could be saved.",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PUT",
      url: "/scenarios/scenario-1",
      payload: {
        expectedRevision: "stale-revision",
        status: "live",
      },
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "stale_revision",
      error: "Scenario changed before this update could be saved.",
    });
  });

  it("returns a bounded metadata-only encounter summary list for the GM workspace", async () => {
    const summaries = Array.from({ length: 50 }, (_, index) => ({
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: `encounter-${index}`,
      scenarioId: "scenario-1",
      status: index === 0 ? "active" : "draft",
      title: `Encounter ${index}`,
      updatedAt: `2026-01-01T00:${String(index).padStart(2, "0")}:00.000Z`,
    }));
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.encounterService.listEncounterSummariesByScenario.mockResolvedValue(summaries);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/encounter-summaries",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ encounters: summaries });
    expect(response.body.length).toBeLessThan(20_000);
    expect(response.body).not.toContain("combatRoundState");
    expect(response.body).not.toContain("commands");
    expect(response.body).not.toContain("snapshots");
    expect(mocks.encounterService.listEncounterSummariesByScenario).toHaveBeenCalledTimes(1);
    expect(mocks.encounterService.listEncountersByScenario).not.toHaveBeenCalled();
  });

  it("keeps player summary access and assignment explicit without exposing participants", async () => {
    const encounter = encounterSessionSchema.parse({
      actionLog: [],
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "combat",
      participantMembershipMode: "explicit",
      participants: [
        {
          id: "encounter-player",
          label: "The Gladiator",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.encounterService.getEncounterById.mockResolvedValue(
      encounterSessionSchema.parse({
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "encounter-1",
        participantMembershipMode: "explicit",
        participants: [
          {
            id: "encounter-player",
            label: "Player",
            participantType: "scenario",
            scenarioParticipantId: "participant-1",
          },
        ],
        scenarioId: "scenario-1",
        status: "active",
        title: "Courtyard",
        updatedAt: "2026-01-01T00:05:00.000Z",
      }),
    );
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Player" },
        sourceType: "character",
      },
    ]);
    mocks.encounterService.listEncountersByScenario.mockResolvedValue([encounter]);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "The Gladiator" },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/encounter-summaries",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounters).toEqual([
      expect.objectContaining({
        id: "encounter-1",
        viewerAssigned: true,
      }),
    ]);
    expect(response.body).not.toContain("participants");
    expect(response.body).not.toContain("combatRoundState");
    expect(mocks.combatStateReadService.listEncounterAccessMetadataByScenario).toHaveBeenCalledWith(
      "scenario-1",
    );
  });

  it.each(["completed", "archived"] as const)(
    "reopens an entitled %s Encounter through player-safe direct and summary reads",
    async (status) => {
      const encounter = encounterSessionSchema.parse(
        makeCombatEncounter({
          description: "The party secured the eastern gate.",
          gmPrivateClosingNote: "The rival escaped unseen.",
          playerOutcome: "The gate is safe for now.",
          status,
        }),
      );
      const participant = makeCombatScenarioParticipant({
        controlledByUserId: "player-1",
        id: "participant-1",
      });
      mocks.scenarioService.getScenarioById.mockResolvedValue({
        campaignId: "campaign-1",
        id: "scenario-1",
        status,
      });
      mocks.campaignService.getCampaignById.mockResolvedValue({
        gmUserId: "gm-1",
        id: "campaign-1",
      });
      mocks.scenarioService.listScenarioParticipants.mockResolvedValue([participant]);
      mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
      mocks.encounterService.listEncountersByScenario.mockResolvedValue([encounter]);
      const app = await buildScenarioTestApp();

      const directResponse = await app.inject({
        method: "GET",
        url: "/encounters/encounter-1",
      });
      const summaryResponse = await app.inject({
        method: "GET",
        url: "/scenarios/scenario-1/encounter-summaries",
      });

      await app.close();

      expect(directResponse.statusCode, directResponse.body).toBe(200);
      expect(directResponse.json().encounter).toEqual(
        expect.objectContaining({
          id: "encounter-1",
          playerOutcome: "The gate is safe for now.",
          status,
        }),
      );
      expect(directResponse.body).not.toContain("The rival escaped unseen.");
      expect(directResponse.body).not.toContain("gmPrivateClosingNote");
      expect(summaryResponse.statusCode, summaryResponse.body).toBe(200);
      expect(summaryResponse.json().encounters).toEqual([
        expect.objectContaining({
          id: "encounter-1",
          status,
          viewerAssigned: true,
        }),
      ]);
      expect(summaryResponse.body).not.toContain("participants");
    },
  );

  it("fails an archived Encounter direct link closed when the player is not assigned", async () => {
    const encounter = encounterSessionSchema.parse(
      makeCombatEncounter({
        gmPrivateClosingNote: "Protected note.",
        participants: [
          {
            id: "encounter-other-player",
            label: "Other player",
            participantType: "scenario",
            scenarioParticipantId: "participant-other",
          },
        ],
        playerOutcome: "Protected outcome.",
        status: "archived",
      }),
    );
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      status: "archived",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({
        controlledByUserId: "player-1",
        id: "participant-1",
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "player-2",
        id: "participant-other",
      }),
    ]);
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    const app = await buildScenarioTestApp();

    const response = await app.inject({ method: "GET", url: "/encounters/encounter-1" });

    await app.close();
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Encounter not found." });
    expect(response.body).not.toContain("Protected note");
    expect(response.body).not.toContain("Protected outcome");
  });

  it("keeps hidden participants equivalent to nonexistent participants before and after close and reconnect", async () => {
    const encounterA = encounterSessionSchema.parse({
      createdAt: "2026-08-22T10:00:00.000Z",
      id: "encounter-a",
      kind: "roleplay",
      participantMembershipMode: "explicit",
      participants: [
        {
          id: "encounter-participant-a",
          label: "Player A",
          participantType: "scenario",
          scenarioParticipantId: "participant-a",
        },
      ],
      scenarioId: "scenario-1",
      status: "active",
      title: "Library",
      updatedAt: "2026-08-22T10:01:00.000Z",
    });
    const encounterB = encounterSessionSchema.parse({
      ...encounterA,
      id: "encounter-b",
      participants: [
        {
          id: "encounter-participant-b",
          label: "Player B",
          participantType: "scenario",
          scenarioParticipantId: "participant-b",
        },
      ],
      title: "Secret Courtyard",
    });
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      createdAt: "2026-08-22T09:00:00.000Z",
      description: "Find the Lost Seal.",
      id: "scenario-1",
      kind: "mixed",
      liveState: {
        combatStatus: "not_started",
        phase: 1,
        roundNumber: 1,
        session: {
          appliedRequestIds: ["private-request"],
          availableObjects: [],
          gmPrivateNotes: "The steward has the seal.",
          version: 1,
        },
      },
      name: "Lost Seal",
      status: "live",
      updatedAt: "2026-08-22T10:02:00.000Z",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-a",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Player A" },
        sourceType: "character",
      },
      {
        controlledByUserId: "player-b",
        id: "participant-b",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Player B" },
        sourceType: "character",
        visibilityOverrides: { visibility: "gm_only" },
      },
      {
        controlledByUserId: "hidden-player",
        id: "participant-hidden",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Hidden Steward" },
        sourceType: "character",
        visibilityOverrides: { visibility: "hidden" },
      },
    ]);
    mocks.scenarioService.resolveEquipmentStatuses.mockResolvedValue({
      "participant-a": {
        canReconcile: false,
        message:
          "The Character’s current equipment changed since this Scenario was prepared. Update it before play continues.",
        status: "stale",
      },
    });
    mocks.encounterService.listEncountersByScenario.mockResolvedValue([encounterA, encounterB]);
    const initialEventLogs = [
      {
        createdAt: "2026-08-22T10:01:30.000Z",
        eventType: "encounter_skill_outcome",
        id: "event-a",
        payload: { audienceParticipantIds: ["participant-a"], hiddenTotal: 99 },
        scenarioId: "scenario-1",
        summary: "Player A found a clue.",
      },
      {
        createdAt: "2026-08-22T10:01:40.000Z",
        eventType: "encounter_skill_outcome",
        id: "event-b",
        payload: { audienceParticipantIds: ["participant-a"] },
        scenarioId: "scenario-1",
        summary: "Player B learned the culprit.",
      },
      {
        createdAt: "2026-08-22T10:01:50.000Z",
        eventType: "participant_added",
        id: "event-hidden",
        participantId: "participant-hidden",
        scenarioId: "scenario-1",
        summary: "Added Hidden Steward to the scenario.",
      },
    ];
    mocks.scenarioService.listScenarioEventLogs.mockResolvedValue(initialEventLogs);
    mocks.scenarioService.resolveScenarioAvailableObjects.mockResolvedValue([]);
    const app = await buildScenarioTestApp();

    const directScenarioResponse = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1",
    });
    const responseBeforeClose = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/session",
    });

    mocks.encounterService.listEncountersByScenario.mockResolvedValue([
      encounterA,
      { ...encounterB, status: "completed", updatedAt: "2026-08-22T10:03:00.000Z" },
    ]);
    mocks.scenarioService.listScenarioEventLogs.mockResolvedValue([
      ...initialEventLogs,
      {
        createdAt: "2026-08-22T10:03:00.000Z",
        eventType: "encounter_closed",
        id: "event-b-closed",
        payload: { audienceParticipantIds: ["participant-a"] },
        scenarioId: "scenario-1",
        summary: "Player B left the closed Courtyard encounter.",
      },
    ]);
    const responseAfterClose = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/session",
    });
    const responseAfterReconnect = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/session",
    });

    await app.close();
    expect(directScenarioResponse.statusCode, directScenarioResponse.body).toBe(200);
    for (const privateKey of [
      "session",
      "appliedRequestIds",
      "availableObjects",
      "gmPrivateNotes",
      "version",
    ]) {
      expect(directScenarioResponse.body).not.toContain(`"${privateKey}"`);
    }

    expect(responseBeforeClose.statusCode, responseBeforeClose.body).toBe(200);
    expect(responseBeforeClose.json().session.encounters).toEqual([
      expect.objectContaining({ id: "encounter-a", title: "Library" }),
    ]);
    expect(responseBeforeClose.json().session.history).toEqual([
      expect.objectContaining({ id: "event-a", summary: "Player A found a clue." }),
    ]);
    expect(responseBeforeClose.json().session.participants).toContainEqual(
      expect.objectContaining({
        equipment: expect.objectContaining({ canReconcile: false, status: "stale" }),
        id: "participant-a",
      }),
    );
    expect(responseBeforeClose.body).not.toContain("fingerprint");
    expect(responseBeforeClose.body).not.toContain("aggregateRevision");
    for (const response of [responseBeforeClose, responseAfterClose, responseAfterReconnect]) {
      expect(response.statusCode, response.body).toBe(200);
      const payload = response.json().session;
      for (const participantId of [
        "participant-b",
        "participant-hidden",
        "nonexistent-participant",
      ]) {
        expect(
          payload.participants.find((entry: { id: string }) => entry.id === participantId),
        ).toBe(undefined);
      }
      for (const hidden of [
        "Secret Courtyard",
        "participant-b",
        "participant-hidden",
        "Player B",
        "Hidden Steward",
        "nonexistent-participant",
        "Nonexistent Participant",
        "steward",
        "private-request",
        "hiddenTotal",
        "privateNote",
        "culprit",
      ]) {
        expect(response.body).not.toContain(hidden);
      }
    }
  });

  it("publishes only player-safe Combat outcomes in the Activity payload, per viewer", async () => {
    // combat-panel-contract.md 12.7/12.13 and Player Play V1 9.2. Every assertion below is on the
    // API response payload, never on rendered DOM: the #271 precedent requires the selection and
    // the identity resolution to happen on the server.
    const encounter = encounterSessionSchema.parse({
      createdAt: "2026-09-24T10:00:00.000Z",
      id: "encounter-a",
      kind: "combat",
      participantMembershipMode: "explicit",
      participants: [
        {
          id: "encounter-participant-a",
          label: "Player A",
          participantType: "scenario",
          scenarioParticipantId: "participant-a",
        },
        {
          id: "encounter-participant-c",
          label: "Rival",
          participantType: "scenario",
          scenarioParticipantId: "participant-c",
        },
      ],
      scenarioId: "scenario-1",
      status: "active",
      title: "Library",
      updatedAt: "2026-09-24T10:01:00.000Z",
    });
    const activityFacts = (overrides: Record<string, unknown>) => ({
      identities: [
        {
          hiddenIdentityFallback: "unseen_attacker",
          participantId: "participant-c",
          role: "attacker",
        },
        {
          hiddenIdentityFallback: "unseen_target",
          participantId: "participant-a",
          role: "defender",
        },
      ],
      outcomeScope: "perceived",
      publicOutcome: {},
      status: "recorded",
      ...overrides,
    });
    const eventLogs = [
      {
        createdAt: "2026-09-24T10:02:00.000Z",
        eventType: "encounter_combat_outcome",
        id: "event-declaration",
        payload: { encounterId: "encounter-a", eventKind: "declaration" },
        scenarioId: "scenario-1",
        summary: "Combat: declaration.",
      },
      {
        createdAt: "2026-09-24T10:02:10.000Z",
        eventType: "encounter_combat_outcome",
        id: "event-round-boundary",
        payload: { encounterId: "encounter-a", eventKind: "round_boundary" },
        scenarioId: "scenario-1",
        summary: "Combat: round boundary.",
      },
      {
        createdAt: "2026-09-24T10:02:20.000Z",
        eventType: "encounter_combat_outcome",
        id: "event-feint-roll",
        payload: { encounterId: "encounter-a", eventKind: "feint_roll" },
        scenarioId: "scenario-1",
        summary: "Combat: feint roll.",
      },
      {
        createdAt: "2026-09-24T10:02:30.000Z",
        eventType: "encounter_combat_outcome",
        id: "event-attack",
        payload: {
          activityFacts: activityFacts({
            eventType: "attack",
            publicOutcome: { hit: true },
            summaryFacts: { kind: "attack_resolved", outcome: "hit", weaponName: "Longsword" },
          }),
          encounterId: "encounter-a",
          eventKind: "attack",
        },
        scenarioId: "scenario-1",
        summary: "Combat: attack.",
      },
      {
        createdAt: "2026-09-24T10:02:35.000Z",
        eventType: "encounter_combat_outcome",
        id: "event-gm-only",
        payload: {
          activityFacts: activityFacts({
            eventType: "critical",
            outcomeScope: "gm_only",
            publicOutcome: {},
          }),
          audienceParticipantIds: ["participant-a", "participant-c"],
          encounterId: "encounter-a",
          eventKind: "critical",
        },
        scenarioId: "scenario-1",
        summary: "Combat: critical.",
      },
      {
        createdAt: "2026-09-24T10:02:40.000Z",
        eventType: "encounter_combat_outcome",
        id: "event-task",
        payload: {
          audienceParticipantIds: ["participant-a"],
          encounterId: "encounter-a",
          eventKind: "task_resolved",
          gmAuthoredSummary: true,
        },
        scenarioId: "scenario-1",
        summary: "Player A forced the library door open.",
      },
    ];
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      createdAt: "2026-09-24T09:00:00.000Z",
      description: "Find the Lost Seal.",
      id: "scenario-1",
      kind: "mixed",
      name: "Lost Seal",
      status: "live",
      updatedAt: "2026-09-24T10:02:00.000Z",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-a",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Player A" },
        sourceType: "character",
      },
      {
        controlledByUserId: "player-c",
        id: "participant-c",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Rival" },
        sourceType: "character",
      },
    ]);
    mocks.scenarioService.listScenarioEventLogs.mockResolvedValue(eventLogs);
    mocks.scenarioService.resolveScenarioAvailableObjects.mockResolvedValue([]);
    mocks.scenarioService.resolveEquipmentStatuses.mockResolvedValue({});
    mocks.encounterService.listEncountersByScenario.mockResolvedValue([encounter]);
    const app = await buildScenarioTestApp();

    const defenderResponse = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/session",
    });
    mocks.requireAuthenticatedUser.mockResolvedValue({ ...mocks.playerUser, id: "player-c" });
    const attackerResponse = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/session",
    });
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    const gmResponse = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/session",
    });
    await app.close();

    expect(defenderResponse.statusCode, defenderResponse.body).toBe(200);
    const defenderHistory = defenderResponse.json().session.history as Array<{
      eventKind: string;
      id: string;
      summary: string;
    }>;

    // Negative payload assertions: suppressed bookkeeping never reaches the player payload.
    for (const suppressed of ["declaration", "round_boundary", "feint_roll"]) {
      expect(defenderHistory.some((entry) => entry.eventKind === suppressed)).toBe(false);
      expect(defenderResponse.body).not.toContain(`"${suppressed}"`);
    }
    // A gm_only outcome reaches no player, even though `critical` is on the publish list.
    expect(defenderHistory.map((entry) => entry.id)).toEqual(["event-attack", "event-task"]);

    // Recap sufficiency: a resolved Perform Task reaches the entitled player with its GM-authored
    // player-safe text, unchanged.
    expect(defenderHistory.find((entry) => entry.id === "event-task")?.summary).toBe(
      "Player A forced the library door open.",
    );

    // Per-viewer identity from the same stored facts, with no stored rendered string as authority.
    const attackerHistory = attackerResponse.json().session.history as Array<{
      id: string;
      summary: string;
    }>;
    const gmHistory = gmResponse.json().session.history as Array<{ id: string; summary: string }>;
    const defenderSentence = defenderHistory.find((entry) => entry.id === "event-attack")?.summary;
    const attackerSentence = attackerHistory.find((entry) => entry.id === "event-attack")?.summary;
    const gmSentence = gmHistory.find((entry) => entry.id === "event-attack")?.summary;
    expect(defenderSentence).toBe("Rival attacked you with Longsword. The attack hit.");
    expect(attackerSentence).toBe("You attacked Player A with Longsword. The attack hit.");
    expect(gmSentence).toBe("Rival attacked Player A with Longsword. The attack hit.");
    expect(defenderSentence).not.toBe(attackerSentence);
    expect(defenderSentence).not.toBe(gmSentence);
    // The mechanically derived stored string is never the player-facing sentence.
    expect(defenderSentence).not.toBe("Combat: attack.");

    // The GM's audit history keeps every legacy and bookkeeping row: suppression is player-safe
    // narrowing, not deletion (12.19).
    expect(gmHistory.map((entry) => entry.id)).toEqual([
      "event-declaration",
      "event-round-boundary",
      "event-feint-roll",
      "event-attack",
      "event-gm-only",
      "event-task",
    ]);

    // A non-entitled viewer receives no row at all for an outcome whose audience excludes them.
    expect(attackerHistory.some((entry) => entry.id === "event-task")).toBe(false);
    expect(attackerResponse.body).not.toContain("forced the library door open");
  });

  it("projects player Combat participants with viewer-aware hidden and GM-only privacy", async () => {
    const scenario = {
      campaignId: "campaign-1",
      description: "Recover the Lost Seal.",
      id: "scenario-1",
      kind: "mixed",
      name: "Lost Seal",
      status: "live",
    };
    const controlledState = {
      ...makeCombatScenarioParticipant().state,
      health: {
        bleeding: 0,
        currentHp: 10,
        dead: false,
        maxHp: 10,
        unconscious: false,
        wounds: 0,
      },
    };
    const participants = [
      makeCombatScenarioParticipant({
        id: "participant-a",
        snapshot: { displayName: "Player A" },
        state: controlledState,
        visibilityOverrides: { visibility: "hidden" },
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "visible-player",
        id: "participant-visible",
        snapshot: { displayName: "Visible Ally" },
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "hidden-player",
        id: "participant-hidden",
        snapshot: { displayName: "Hidden Steward" },
        visibilityOverrides: { visibility: "hidden" },
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "player-b",
        id: "participant-gm-only",
        snapshot: { displayName: "GM Only Witness" },
        state: controlledState,
        visibilityOverrides: { visibility: "gm_only" },
      }),
    ];
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(participants);
    const app = await buildScenarioTestApp();

    const playerResponse = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/player-projection",
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(participants.slice(0, 2));
    const nonexistentEquivalent = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/player-projection",
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(participants);
    mocks.requireAuthenticatedUser.mockResolvedValue({ ...mocks.playerUser, id: "player-b" });
    const controllingPlayerResponse = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/player-projection",
    });
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    const gmResponse = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/player-projection",
    });

    await app.close();
    expect(playerResponse.statusCode, playerResponse.body).toBe(200);
    expect(playerResponse.json()).toEqual(nonexistentEquivalent.json());
    expect(
      playerResponse
        .json()
        .projection.visibleParticipants.map(
          (participant: { displayName: string }) => participant.displayName,
        ),
    ).toEqual(["Player A", "Visible Ally"]);
    for (const hiddenIdentity of [
      "participant-hidden",
      "Hidden Steward",
      "participant-gm-only",
      "GM Only Witness",
    ]) {
      expect(playerResponse.body).not.toContain(hiddenIdentity);
    }
    expect(controllingPlayerResponse.statusCode, controllingPlayerResponse.body).toBe(200);
    expect(controllingPlayerResponse.body).toContain("participant-gm-only");
    expect(controllingPlayerResponse.body).toContain("GM Only Witness");
    expect(controllingPlayerResponse.body).not.toContain("participant-hidden");
    expect(gmResponse.statusCode, gmResponse.body).toBe(200);
    expect(
      gmResponse
        .json()
        .projection.visibleParticipants.map(
          (participant: { displayName: string }) => participant.displayName,
        ),
    ).toEqual(["Player A", "Visible Ally", "Hidden Steward", "GM Only Witness"]);
  });

  it("allows completed Scenario projection read-only access for players", async () => {
    const scenario = {
      campaignId: "campaign-1",
      description: "Recovered the relic after play.",
      id: "scenario-1",
      kind: "mixed",
      name: "Completed Chapter",
      status: "completed",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/player-projection",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().projection.scenario.status).toBe("completed");
  });

  it("blocks completed-scenario session editing as read-only", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "mixed",
      name: "Completed Chapter",
      status: "completed",
    };
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.scenarioService.updateScenarioSessionState.mockResolvedValue(scenario);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PATCH",
      url: "/scenarios/scenario-1/session",
      payload: {
        availableObjects: [],
        expectedRevision: "rev-1",
        gmPrivateNotes: "No edits.",
      },
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Scenario is not editable in its current status." });
    expect(mocks.scenarioService.updateScenarioSessionState).not.toHaveBeenCalled();
  });

  it("returns a compact canonical active-encounter revision", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    mocks.encounterService.getEncounterSummaryById.mockResolvedValue({
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-1",
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/revision",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      encounter: {
        encounterId: "encounter-1",
        revision: "2026-01-01T00:05:00.000Z",
        status: "active",
        updatedAt: "2026-01-01T00:05:00.000Z",
      },
    });
    expect(response.body.length).toBeLessThan(200);
    expect(mocks.combatStateReadService.getEncounterMetadataById).toHaveBeenCalledWith(
      "encounter-1",
    );
    expect(mocks.encounterService.getEncounterById).not.toHaveBeenCalled();
  });

  it("allows an authorized player to read only compact encounter revision metadata", async () => {
    mocks.encounterService.getEncounterSummaryById.mockResolvedValue({
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-1",
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.encounterService.getEncounterById.mockResolvedValue(
      encounterSessionSchema.parse({
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "encounter-1",
        participantMembershipMode: "explicit",
        participants: [
          {
            id: "encounter-player",
            label: "Player",
            participantType: "scenario",
            scenarioParticipantId: "participant-1",
          },
        ],
        scenarioId: "scenario-1",
        status: "active",
        title: "Courtyard",
        updatedAt: "2026-01-01T00:05:00.000Z",
      }),
    );
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Player" },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/revision",
    });

    await app.close();
    expect(response.statusCode).toBe(200);
    expect(response.body).not.toContain("combatRoundState");
    expect(response.body).not.toContain("participants");
    expect(response.body).not.toContain("commands");
  });

  it("rejects encounter revision access when the player cannot access the scenario", async () => {
    mocks.encounterService.getEncounterSummaryById.mockResolvedValue({
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-1",
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(false);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/revision",
    });

    await app.close();
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Encounter not found." });
  });

  it("returns not found for a missing encounter revision", async () => {
    mocks.encounterService.getEncounterSummaryById.mockResolvedValue(null);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/missing/revision",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Encounter not found." });
  });

  it("returns player-safe roleplay visibility for a player's encounter", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "mixed",
      name: "A slightly less new hope",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const encounter = {
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "The Gladiator",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
        {
          id: "scenario-participant-2",
          label: "City guard",
          participantType: "scenario",
          scenarioParticipantId: "participant-2",
        },
        {
          id: "scenario-participant-3",
          label: "Hidden spy",
          participantType: "scenario",
          scenarioParticipantId: "participant-3",
        },
      ],
      roleplayState: {
        actionLog: [],
        gmMessage: "The courtyard is tense.",
        participantDescriptions: {
          "scenario-participant-2": {
            detailedDescription: "Visible guard detail.",
            name: "City guard",
            shortDescription: "Armored guard",
          },
          "scenario-participant-3": {
            detailedDescription: "Hidden spy detail.",
            name: "Hidden spy",
            shortDescription: "Quiet figure",
          },
        },
        pendingSkillRolls: [],
        visibility: {
          "scenario-participant-1": {
            "scenario-participant-2": true,
          },
        },
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "A doubtful success",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "The Gladiator" },
        sourceType: "character",
      },
      {
        id: "participant-2",
        isActive: true,
        role: "npc",
        scenarioId: "scenario-1",
        snapshot: { displayName: "City guard" },
        sourceType: "entity",
      },
      {
        id: "participant-3",
        isActive: true,
        role: "npc",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Hidden spy" },
        sourceType: "entity",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.roleplayState).toMatchObject({
      participantDescriptions: {
        "scenario-participant-2": {
          detailedDescription: "Visible guard detail.",
          name: "City guard",
          shortDescription: "Armored guard",
        },
      },
      visibility: {
        "scenario-participant-1": {
          "scenario-participant-2": true,
        },
      },
    });
    expect(JSON.stringify(response.json())).not.toContain("Hidden spy detail");
  });

  it("serializes owner, GM, public peer, and observer Skill-roll perspectives", async () => {
    const encounter = encounterSessionSchema.parse({
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-1",
      kind: "roleplay",
      participantMembershipMode: "explicit",
      participants: [
        {
          id: "encounter-owner",
          label: "Owner hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-owner",
        },
        {
          id: "encounter-other",
          label: "Other hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-other",
        },
        {
          id: "encounter-observer",
          label: "Observer hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-observer",
        },
      ],
      roleplayState: {
        actionLog: [
          {
            calculationText: "owner-private-calculation",
            createdAt: "2026-01-01T00:02:00.000Z",
            dieResult: 18,
            id: "owner-public-result",
            numericSubtotal: 42,
            otherMod: 9,
            participantId: "encounter-owner",
            pendingRollId: "owner-private-pending",
            rollD20: 18,
            rollSetId: "private-current-stack",
            skillId: "perception",
            skillLabel: "Perception",
            skillValue: 15,
            summary: "Owner hero rolled Perception.",
            type: "gm_skill_roll",
          },
          {
            createdAt: "2026-01-01T00:01:00.000Z",
            id: "owner-private-assignment",
            participantId: "encounter-owner",
            pendingRollId: "owner-private-pending",
            rollSetId: "private-current-stack",
            skillId: "perception",
            skillLabel: "Perception",
            summary: "Assigned Perception roll.",
            type: "skill_roll_assigned",
          },
          {
            calculationText: "silent-private-calculation",
            createdAt: "2026-01-01T00:00:30.000Z",
            dieResult: 20,
            id: "owner-silent-result",
            numericSubtotal: 99,
            participantId: "encounter-owner",
            rollSetId: "private-current-stack",
            silent: true,
            skillId: "stealth",
            skillLabel: "Stealth",
            summary: "Owner hero silently rolled Stealth.",
            type: "gm_skill_roll",
          },
        ],
        currentRankedRollStackId: "private-current-stack",
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "owner-private-pending",
            otherMod: 9,
            participantId: "encounter-owner",
            rollSetId: "private-current-stack",
            skillId: "perception",
            skillLabel: "Perception",
            skillValue: 15,
          },
        ],
        visibility: {
          "encounter-other": { "encounter-owner": true },
        },
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:03:00.000Z",
    });
    const scenarioParticipants = [
      {
        controlledByUserId: "player-owner",
        id: "participant-owner",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Owner hero" },
        sourceType: "character",
      },
      {
        controlledByUserId: "player-other",
        id: "participant-other",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Other hero" },
        sourceType: "character",
      },
      {
        controlledByUserId: "player-observer",
        id: "participant-observer",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Observer hero" },
        sourceType: "character",
      },
    ];
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      status: "active",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    let activeUser = { email: "owner@example.test", id: "player-owner", roles: ["player"] };
    mocks.requireAuthenticatedUser.mockImplementation(async () => activeUser);
    const app = await buildScenarioTestApp();

    const loadAs = async (user: typeof activeUser) => {
      activeUser = user;
      return app.inject({ method: "GET", url: "/encounters/encounter-1" });
    };
    const ownerResponse = await loadAs(activeUser);
    const otherResponse = await loadAs({
      email: "other@example.test",
      id: "player-other",
      roles: ["player"],
    });
    const observerResponse = await loadAs({
      email: "observer@example.test",
      id: "player-observer",
      roles: ["player"],
    });
    const gmResponse = await loadAs({
      email: "gm@example.test",
      id: "gm-1",
      roles: ["game_master"],
    });

    await app.close();

    const ownerState = ownerResponse.json().encounter.roleplayState;
    const otherState = otherResponse.json().encounter.roleplayState;
    const observerState = observerResponse.json().encounter.roleplayState;
    const gmState = gmResponse.json().encounter.roleplayState;
    expect(
      [ownerResponse, otherResponse, observerResponse, gmResponse].map(
        (response) => response.statusCode,
      ),
    ).toEqual([200, 200, 200, 200]);
    expect(ownerState.pendingSkillRolls[0]).toMatchObject({
      id: "owner-private-pending",
      otherMod: 9,
      skillValue: 15,
    });
    expect(
      ownerState.actionLog.find((entry: { id: string }) => entry.id === "owner-public-result"),
    ).toMatchObject({
      calculationText: "owner-private-calculation",
      dieResult: 18,
      pendingRollId: "owner-private-pending",
    });
    expect(JSON.stringify(ownerState)).not.toContain("silent-private-calculation");

    expect(otherState.pendingSkillRolls).toEqual([]);
    expect(otherState.actionLog).toHaveLength(1);
    expect(otherState.actionLog[0]).toMatchObject({
      id: "owner-public-result",
      numericSubtotal: 42,
      participantId: "encounter-owner",
      skillLabel: "Perception",
      summary: "Public Skill result.",
    });
    expect(otherState.actionLog[0]).not.toHaveProperty("calculationText");
    expect(otherState.actionLog[0]).not.toHaveProperty("dieResult");
    expect(otherState.actionLog[0]).not.toHaveProperty("otherMod");
    expect(otherState.actionLog[0]).not.toHaveProperty("pendingRollId");
    expect(otherState.actionLog[0]).not.toHaveProperty("skillValue");
    expect(otherState.currentRankedRollStackId).toBe("player-safe-public-ranked-roll-stack");
    expect(JSON.stringify(otherState)).not.toContain("private-current-stack");
    expect(JSON.stringify(otherState)).not.toContain("owner-private-pending");

    expect(observerState.pendingSkillRolls).toEqual([]);
    expect(observerState.actionLog).toEqual([]);
    expect(observerState.currentRankedRollStackId).toBe("player-safe-empty-ranked-roll-stack");
    expect(JSON.stringify(observerState)).not.toContain("owner-public-result");
    expect(JSON.stringify(observerState)).not.toContain("private-current-stack");
    expect(JSON.stringify(observerState)).not.toContain("owner-private-pending");

    expect(gmState.pendingSkillRolls[0].id).toBe("owner-private-pending");
    expect(gmState.currentRankedRollStackId).toBe("private-current-stack");
    expect(
      gmState.actionLog.find((entry: { id: string }) => entry.id === "owner-public-result"),
    ).toMatchObject({
      calculationText: "owner-private-calculation",
      dieResult: 18,
      pendingRollId: "owner-private-pending",
    });
    expect(JSON.stringify(gmState)).toContain("silent-private-calculation");
  });

  it("returns projected combat history without raw events or hidden participant ids", async () => {
    const encounterParticipants = [
      {
        id: "encounter-participant-1",
        label: "Player hero",
        participantType: "scenario",
        scenarioParticipantId: "participant-1",
      },
      {
        id: "encounter-participant-2",
        label: "Visible guard",
        participantType: "scenario",
        scenarioParticipantId: "participant-2",
      },
      {
        id: "encounter-participant-hidden",
        label: "Hidden spy",
        participantType: "scenario",
        scenarioParticipantId: "participant-hidden",
      },
    ];
    const canonicalEvent = {
      completeness: "complete",
      encounterId: "encounter-1",
      facts: {
        gmReview: { privateNote: "secret override" },
        involvedOutcome: { outcome: "hit" },
        publicOutcome: {},
        resultPresentation: {
          conciseOutcome: { label: "Attack resolved" },
          privateDiagnostics: [
            {
              factKeys: ["privateNote"],
              id: "event-attack:diagnostic",
              label: "GM adjudication",
              source: "gm_review",
            },
          ],
          publicCombatNote: "The blow drives the defender toward the gate.",
        },
        rollerPrivate: { rollD20: 18, total: 22 },
      },
      id: "event-attack",
      missingFacts: [],
      occurredAt: "2026-01-01T00:01:00.000Z",
      rollerParticipantId: "encounter-participant-hidden",
      roundNumber: 1,
      schemaVersion: 1,
      sequence: 0,
      source: { kind: "canonical", sourceIds: [] },
      status: "recorded",
      step: "phase_1_actions",
      type: "attack",
      visibility: {
        identityRefs: [
          {
            hiddenIdentityFallback: "unseen_attacker",
            participantId: "encounter-participant-hidden",
            role: "attacker",
          },
          { participantId: "encounter-participant-1", role: "defender" },
        ],
        involvedParticipantIds: ["encounter-participant-hidden", "encounter-participant-1"],
        outcomeScope: "perceived",
        rollerParticipantId: "encounter-participant-hidden",
      },
    };
    const encounter = makeCombatEncounter({
      combatRoundState: {
        encounterId: "encounter-1",
        events: [canonicalEvent],
        roundNumber: 1,
      },
      participants: encounterParticipants,
      roleplayState: {
        visibility: {
          "encounter-participant-1": {
            "encounter-participant-2": true,
          },
        },
      },
    });
    setupCombatDeclarationRoute({
      encounter,
      participants: [
        { controlledByUserId: "player-1", id: "participant-1" },
        { controlledByUserId: "other-player", id: "participant-2" },
        { controlledByUserId: "other-player", id: "participant-hidden" },
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    const encounterResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().history.sourceEncounterId).toBe("encounter-1");
    expect(response.json().history.sourceUpdatedAt).toBe(encounter.updatedAt);
    expect(mocks.combatStateReadService.getCombatHistorySourceById).toHaveBeenCalledWith(
      "encounter-1",
    );
    expect(response.json().history.progression).toMatchObject({
      boundary: { roundNumber: 1 },
      roundNumber: 1,
    });
    const progressionStages = response
      .json()
      .history.progression.processes.flatMap(
        (process: { stages: Array<{ executionGroups: unknown[] }> }) => process.stages,
      );
    expect(progressionStages.length).toBeGreaterThan(0);
    expect(
      progressionStages.every((stage: { executionGroups: unknown[] }) =>
        Array.isArray(stage.executionGroups),
      ),
    ).toBe(true);
    expect(response.json().history.rows).toEqual([
      { displayName: "Player hero", participantId: "encounter-participant-1" },
      { displayName: "Visible guard", participantId: "encounter-participant-2" },
    ]);
    expect(response.json().history.activeRound.events[0]).toMatchObject({
      facts: { involvedOutcome: { outcome: "hit" }, publicOutcome: {} },
      identities: expect.arrayContaining([
        { displayName: "an unseen attacker", role: "attacker", visibility: "unseen" },
      ]),
      resultEnvelope: {
        privateDiagnostics: [],
        publicCombatNote: "The blow drives the defender toward the gate.",
      },
    });
    const serialized = JSON.stringify(response.json());
    expect(serialized).not.toContain("secret override");
    expect(serialized).not.toContain("rollD20");
    expect(serialized).not.toContain("encounter-participant-hidden");
    expect(serialized).not.toContain("diagnostics");
    expect(response.json()).not.toHaveProperty("encounter");
    expect(encounterResponse.json().encounter.combatRoundState).toMatchObject({
      events: [],
      rounds: [],
      stepSnapshots: [],
    });
    expect(JSON.stringify(encounterResponse.json())).not.toContain("secret override");
  });

  it("returns the full projected fact groups to a GM combat-history reader", async () => {
    const encounter = makeCombatEncounter({
      combatRoundState: {
        encounterId: "encounter-1",
        events: [
          {
            completeness: "complete",
            encounterId: "encounter-1",
            facts: {
              gmReview: { privateNote: "GM fact" },
              involvedOutcome: { outcome: "hit" },
              publicOutcome: {},
              rollerPrivate: { rollD20: 18 },
            },
            id: "event-gm",
            missingFacts: [],
            occurredAt: "2026-01-01T00:01:00.000Z",
            rollerParticipantId: "encounter-participant-1",
            roundNumber: 1,
            schemaVersion: 1,
            sequence: 0,
            source: { kind: "canonical", sourceIds: [] },
            status: "recorded",
            step: "initiative_phase_1",
            type: "initiative",
            visibility: {
              identityRefs: [{ participantId: "encounter-participant-1", role: "roller" }],
              involvedParticipantIds: ["encounter-participant-1"],
              outcomeScope: "involved",
              rollerParticipantId: "encounter-participant-1",
            },
          },
        ],
        roundNumber: 1,
      },
    });
    setupCombatDeclarationRoute({ encounter, user: mocks.adminUser });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().history.activeRound.events[0].facts).toMatchObject({
      gmReview: { privateNote: "GM fact" },
      privateCalculation: { rollD20: 18 },
    });
    expect(response.json().history.progression).toBeDefined();
    expect(JSON.stringify(response.json().history.progression)).not.toContain("diagnostics");
  });

  it("projects an active typed Critical consequence only to its affected Player and the GM", async () => {
    const criticalRuntime = {
      bleed: {
        allowedControlStates: ["active", "partial", "staunched_zero", "resolved"] as const,
        controlState: "active" as const,
        currentRate: { denominator: 3, numerator: 1 },
        firstTickRound: 2,
        kind: "external" as const,
        rate: { denominator: 3, numerator: 1 },
        sourceEffectKey: "pointed_weapons|arm|09|02",
        sourceRate: "1/3",
      },
      criticalKey: "pointed_weapons|arm|09",
      fixtureVersion: "c1-2026-08-28",
      kind: "bleed" as const,
    };
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const encounter = makeCombatEncounter({
      combatRoundState: {
        encounterId: "encounter-1",
        participants: encounterParticipants.map((participant) => ({
          label: participant.label,
          participantId: participant.id,
        })),
        roundNumber: 2,
      },
      currentRound: 2,
      participants: encounterParticipants,
    });
    const firstBase = makeCombatScenarioParticipant({ id: "participant-1" });
    const secondBase = makeCombatScenarioParticipant({
      controlledByUserId: "other-player",
      id: "participant-2",
      snapshot: { displayName: "City guard" },
    });
    setupCombatDeclarationRoute({
      encounter,
      participants: [
        {
          ...firstBase,
          state: {
            ...firstBase.state,
            combatEffects: {
              effects: [
                {
                  criticalRuntime,
                  createdAt: "2026-08-24T08:00:00.000Z",
                  effectGroup: "bleed",
                  id: "private-critical-effect",
                  roundNumber: 1,
                  sourceEventId: "private-critical-event",
                  status: "active",
                  targetParticipantId: "participant-1",
                  type: "bleed",
                  updatedAt: "2026-08-24T08:00:00.000Z",
                },
                {
                  criticalRuntime: {
                    ...criticalRuntime,
                    bleed: { ...criticalRuntime.bleed, controlState: "resolved" as const },
                  },
                  createdAt: "2026-08-24T08:00:00.000Z",
                  effectGroup: "bleed",
                  id: "resolved-private-critical-effect",
                  roundNumber: 1,
                  sourceEventId: "resolved-private-critical-event",
                  status: "resolved",
                  targetParticipantId: "participant-1",
                  type: "bleed",
                  updatedAt: "2026-08-24T08:01:00.000Z",
                },
              ],
              events: [],
            },
          },
        },
        secondBase,
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const [gmResponse, affectedResponse, otherResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/encounters/encounter-1/combat-history" }),
      app.inject({
        method: "GET",
        url: "/encounters/encounter-1/combat-history?perspectiveParticipantId=participant-1",
      }),
      app.inject({
        method: "GET",
        url: "/encounters/encounter-1/combat-history?perspectiveParticipantId=participant-2",
      }),
    ]);
    await app.close();

    const expected = {
      detail: "active",
      durationLabel: "Until resolved",
      summary: "Bleed 1/3 HP per round",
    };
    expect(gmResponse.statusCode, gmResponse.body).toBe(200);
    expect(affectedResponse.statusCode, affectedResponse.body).toBe(200);
    expect(otherResponse.statusCode, otherResponse.body).toBe(200);
    expect(gmResponse.json().history.currentConsequences).toEqual([expected]);
    expect(affectedResponse.json().history.currentConsequences).toEqual([expected]);
    expect(otherResponse.json().history.currentConsequences).toEqual([]);
    [gmResponse, affectedResponse, otherResponse].forEach((response) => {
      const consequencePayload = JSON.stringify(response.json().history.currentConsequences);
      [
        "encounter-participant-1",
        "participant-1",
        "pointed_weapons",
        "private-critical-command",
        "private-critical-event",
        "private-critical-effect",
        "resolved-private-critical-effect",
      ].forEach((secret) => expect(consequencePayload).not.toContain(secret));
    });
  });

  it("keeps opponent declaration content private during DE while preserving safe completion", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const baseState =
      baseEncounter.combatRoundState ?? initializeCombatRoundState({ encounter: baseEncounter });
    const ownDeclared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        additionalActionNotes: "Own private plan",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
        },
        roundNumber: 1,
      },
      participantId: "encounter-participant-1",
      state: baseState,
      submittedBy: "player",
    });
    const bothDeclared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        additionalActionNotes: "Opponent private plan",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-1",
          },
        },
        roundNumber: 1,
      },
      participantId: "encounter-participant-2",
      state: ownDeclared,
      submittedBy: "player",
    });
    const encounter = {
      ...baseEncounter,
      combatRoundState: bothDeclared,
    };
    setupCombatDeclarationRoute({
      encounter,
      participants: [
        { controlledByUserId: "player-1", id: "participant-1" },
        { controlledByUserId: "other-player", id: "participant-2" },
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const historyResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    const encounterResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });
    await app.close();

    expect(historyResponse.statusCode).toBe(200);
    const history = historyResponse.json().history;
    expect(history.combatLog.events).toContainEqual(
      expect.objectContaining({
        category: "declaration",
        summary: expect.stringContaining("you declared Single Attack"),
      }),
    );
    expect(history.combatLog.events).not.toContainEqual(
      expect.objectContaining({
        category: "declaration",
        actor: expect.objectContaining({ participantId: "encounter-participant-2" }),
      }),
    );
    const declarationTasks = history.progression.processes
      .flatMap((process: { stages: Array<{ executionGroups: Array<{ tasks: unknown[] }> }> }) =>
        process.stages.flatMap((stage) => stage.executionGroups.flatMap((group) => group.tasks)),
      )
      .filter((task: { kind?: string }) => task.kind === "submit_declaration");
    expect(declarationTasks).toEqual([]);

    const safeParticipants = encounterResponse.json().encounter.combatRoundState.participants;
    expect(
      safeParticipants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.declaration,
    ).toMatchObject({ actionId: "attack_parry" });
    expect(
      safeParticipants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-2",
      )?.declaration,
    ).toBeUndefined();
    expect(JSON.stringify(historyResponse.json())).not.toContain("Opponent private plan");
    expect(JSON.stringify(encounterResponse.json())).not.toContain("Opponent private plan");
  });

  it("lets a GM request the selected participant's player-safe history perspective", async () => {
    const participants = [
      {
        id: "encounter-participant-1",
        label: "The Gladiator",
        participantType: "scenario",
        scenarioParticipantId: "participant-1",
      },
      {
        id: "encounter-participant-2",
        label: "Other player",
        participantType: "scenario",
        scenarioParticipantId: "participant-2",
      },
    ];
    const encounter = makeCombatEncounter({
      combatRoundState: {
        encounterId: "encounter-1",
        events: [
          {
            completeness: "complete",
            encounterId: "encounter-1",
            facts: {
              gmReview: { privateNote: "GM only" },
              involvedOutcome: { hit: true },
              publicOutcome: {},
              rollerPrivate: { rollD20: 19, total: 23 },
            },
            id: "other-player-attack",
            missingFacts: [],
            occurredAt: "2026-01-01T00:01:00.000Z",
            rollerParticipantId: "encounter-participant-2",
            roundNumber: 1,
            schemaVersion: 1,
            sequence: 0,
            source: { kind: "canonical", sourceIds: [] },
            status: "recorded",
            step: "phase_1_actions",
            type: "attack",
            visibility: {
              identityRefs: [
                { participantId: "encounter-participant-2", role: "attacker" },
                { participantId: "encounter-participant-1", role: "defender" },
              ],
              involvedParticipantIds: ["encounter-participant-2", "encounter-participant-1"],
              outcomeScope: "involved",
              rollerParticipantId: "encounter-participant-2",
            },
          },
        ],
        roundNumber: 1,
      },
      participants,
      roleplayState: {
        visibility: {
          "encounter-participant-1": { "encounter-participant-2": true },
        },
      },
    });
    setupCombatDeclarationRoute({
      encounter,
      participants: [
        { controlledByUserId: "player-1", id: "participant-1" },
        { controlledByUserId: "other-player", id: "participant-2" },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history?perspectiveParticipantId=participant-1",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().history.activeRound.events[0].facts).toEqual({
      involvedOutcome: { hit: true },
      publicOutcome: {},
    });
    expect(JSON.stringify(response.json())).not.toContain("GM only");
    expect(JSON.stringify(response.json())).not.toContain("rollD20");
    expect(response.json().history.progression).toBeDefined();
    expect(response.json().history.combatLog).toMatchObject({
      encounterId: "encounter-1",
      sourceRevision: encounter.updatedAt,
    });
    expect(response.json().history.combatLog.events).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: "round", state: "final" })]),
    );
    const progressionTasks = response
      .json()
      .history.progression.processes.flatMap((process: { stages: Array<{ tasks: unknown[] }> }) =>
        process.stages.flatMap((stage) => stage.tasks),
      );
    expect(progressionTasks).not.toContainEqual(
      expect.objectContaining({ owner: expect.objectContaining({ kind: "gm" }) }),
    );
  });

  it("adds an owned campaign-roster NPC to a scenario as the same reusable entity", async () => {
    const entity = {
      gmUserId: "gm-1",
      id: "entity-1",
      kind: "npc",
      name: "Captain Harl",
      snapshot: {
        actorClass: "campaign_npc",
        campaignId: "campaign-1",
      },
    };
    const participant = {
      controlledByUserId: "gm-1",
      entityId: entity.id,
      id: "participant-1",
      role: "npc",
      scenarioId: "scenario-1",
      snapshot: { displayName: entity.name },
      sourceType: "entity",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      status: "draft",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.campaignService.getReusableEntityById.mockResolvedValue(entity);
    mocks.campaignService.listCampaignRosterEntries.mockResolvedValue([
      {
        campaignId: "campaign-1",
        category: "npc",
        sourceId: entity.id,
        sourceType: "reusableEntity",
      },
    ]);
    mocks.scenarioService.addEntityParticipant.mockResolvedValue(participant);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: { entityId: entity.id, role: "npc" },
      url: "/scenarios/scenario-1/participants/entity",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json()).toEqual({ participant });
    expect(mocks.scenarioService.addEntityParticipant).toHaveBeenCalledWith(
      expect.objectContaining({
        controlledByUserId: "gm-1",
        entityId: entity.id,
        expectedGmUserId: "gm-1",
        role: "npc",
        scenarioId: "scenario-1",
      }),
    );
  });

  it("does not add another game master's reusable NPC to a scenario", async () => {
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      status: "draft",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
    });
    mocks.campaignService.getReusableEntityById.mockResolvedValue({
      gmUserId: "other-gm",
      id: "entity-foreign",
      kind: "npc",
      name: "Foreign NPC",
      snapshot: { actorClass: "campaign_npc", campaignId: "campaign-1" },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: { entityId: "entity-foreign", role: "npc" },
      url: "/scenarios/scenario-1/participants/entity",
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Reusable entity not found." });
    expect(mocks.scenarioService.addEntityParticipant).not.toHaveBeenCalled();
  });

  it("filters scenario participants for player workspace access", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const controlledParticipant = {
      controlledByUserId: "player-1",
      id: "participant-1",
      isActive: true,
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: {
        displayName: "Player hero",
      },
      sourceType: "character",
    };
    const otherParticipant = {
      controlledByUserId: "other-player",
      id: "participant-2",
      isActive: true,
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: {
        displayName: "Other hero",
      },
      sourceType: "character",
    };
    const inactiveControlledParticipant = {
      controlledByUserId: "player-1",
      id: "participant-3",
      isActive: false,
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: {
        displayName: "Inactive hero",
      },
      sourceType: "character",
    };
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      controlledParticipant,
      otherParticipant,
      inactiveControlledParticipant,
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/scenarios/scenario-1/participants",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      participants: [
        {
          displayName: "Player hero",
          id: "participant-1",
          isActive: true,
          isControlledByPlayer: false,
          role: "player_character",
          sourceType: "character",
        },
      ],
    });
  });

  it("creates an encounter under the path-authorized scenario and campaign", async () => {
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const bodySession = {
      campaignId: "campaign-evil",
      combatRoundState: {
        currentCursor: {
          roundNumber: 2,
          step: "A1",
        },
        currentStep: "phase_1_actions",
        participants: [],
        roundNumber: 2,
      },
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 2,
      id: "encounter-1",
      scenarioId: "scenario-evil",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const encounter = encounterSessionSchema.parse({
      ...bodySession,
      campaignId: "campaign-1",
      participants: [],
      scenarioId: "scenario-1",
      status: "draft",
    });
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.encounterService.createEncounter.mockResolvedValue(encounter);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        session: bodySession,
      },
      url: "/scenarios/scenario-1/encounters",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.createEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      createdByUserId: "gm-1",
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        campaignId: "campaign-evil",
        combatRoundState: undefined,
        currentRound: 1,
        id: "encounter-1",
        scenarioId: "scenario-evil",
        status: "draft",
      }),
    });
  });

  it("updates the path-authorized encounter instead of trusting body ids", async () => {
    const existingEncounter = {
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-1",
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    const bodySession = {
      campaignId: "campaign-evil",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-evil",
      scenarioId: "scenario-evil",
      title: "Renamed courtyard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.encounterService.updateEncounter.mockResolvedValue({
      ...bodySession,
      campaignId: "campaign-1",
      id: "encounter-1",
      participants: [],
      scenarioId: "scenario-1",
      status: "active",
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PUT",
      payload: {
        session: bodySession,
      },
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      expectedRevision: "2026-01-01T00:00:00.000Z",
      objectiveEvent: undefined,
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        campaignId: "campaign-evil",
        id: "encounter-evil",
        scenarioId: "scenario-evil",
      }),
    });
  });

  it("allows GM visibility updates after mixed legacy and fresh Item materialization", async () => {
    const existingEncounter = {
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "encounter-1",
      itemReferences: [
        { itemId: "item-legacy", visibility: "gm_only" as const },
        { itemId: "item-dropped", visibility: "players" as const },
      ],
      itemReferencesVersion: 1 as const,
      scenarioId: "scenario-1",
      status: "active" as const,
      title: "Courtyard",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const bodySession = {
      ...existingEncounter,
      itemReferences: [
        { itemId: "item-legacy", visibility: "gm_only" as const },
        { itemId: "item-dropped", visibility: "gm_only" as const },
      ],
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      liveState: {
        session: {
          availableObjects: [
            {
              addedAt: "2026-01-01T00:00:00.000Z",
              id: "combat-item:encounter-1:item-dropped",
              sourceId: "item-dropped",
              sourceKind: "campaign_item",
              visibility: "players",
            },
            {
              addedAt: "2026-01-01T00:00:00.000Z",
              id: "combat-item:encounter-1:item-legacy",
              sourceId: "item-legacy",
              sourceKind: "campaign_item",
              visibility: "gm_only",
            },
          ],
        },
      },
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.characterEquipmentReadModelService.getCampaignEquipmentState.mockResolvedValue({
      itemsById: {
        "item-legacy": {
          holderCharacterId: null,
          id: "item-legacy",
          revision: "2026-01-01T00:00:00.500Z",
          templateId: "weapon-template-dagger",
        },
        "item-dropped": {
          holderCharacterId: null,
          id: "item-dropped",
          revision: "2026-01-01T00:00:01.000Z",
          templateId: "weapon-template-dagger",
        },
      },
      templatesById: {},
    });
    mocks.encounterService.updateEncounter.mockImplementation(
      async (update: { session: EncounterSession }) => update.session,
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PUT",
      payload: { session: bodySession },
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      expectedRevision: existingEncounter.updatedAt,
      objectiveEvent: {
        actorUserId: "gm-1",
        eventType: "encounter_updated",
        summary: "Updated Encounter Items for Courtyard.",
      },
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        itemReferences: [
          { itemId: "item-legacy", visibility: "gm_only" },
          { itemId: "item-dropped", visibility: "gm_only" },
        ],
        itemReferencesVersion: 1,
      }),
    });
  });

  it("updates encounter status through a narrow payload without requiring full encounter state", async () => {
    const existingEncounter = makeCombatEncounterWithResolvedCombatExperience({
      status: "active",
      title: "Courtyard",
    });
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.encounterService.updateEncounter.mockImplementation(
      async (update: { session: EncounterSession }) => update.session,
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PATCH",
      payload: {
        expectedRevision: existingEncounter.updatedAt,
        status: "paused",
      },
      url: "/encounters/encounter-1/status",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.status).toBe("paused");
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      expectedRevision: existingEncounter.updatedAt,
      objectiveEvent: {
        actorUserId: "gm-1",
        eventType: "encounter_paused",
        summary: "Paused encounter Courtyard.",
      },
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        combatRoundState: existingEncounter.combatRoundState,
        status: "paused",
      }),
    });
    expect(mocks.scenarioService.recordScenarioEvent).not.toHaveBeenCalled();
  });

  it("archives an encounter through the narrow status payload", async () => {
    const existingEncounter = makeCombatEncounterWithResolvedCombatExperience({
      status: "paused",
      title: "Courtyard",
    });
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.encounterService.updateEncounter.mockImplementation(
      async (update: { session: EncounterSession }) => update.session,
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PATCH",
      payload: {
        expectedRevision: existingEncounter.updatedAt,
        status: "archived",
      },
      url: "/encounters/encounter-1/status",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.status).toBe("archived");
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      expectedRevision: existingEncounter.updatedAt,
      objectiveEvent: {
        actorUserId: "gm-1",
        eventType: "encounter_archived",
        summary: "Archived encounter Courtyard.",
      },
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        combatRoundState: existingEncounter.combatRoundState,
        status: "archived",
      }),
    });
  });

  it("updates encounter participants through a narrow payload while preserving server combat state", async () => {
    const existingEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participantMembershipMode: "explicit",
      status: "active",
      title: "Courtyard",
    });
    const participants = [
      {
        id: "scenario-participant-2",
        initiative: 0,
        label: "Scyrian cavalry guy",
        order: 1,
        participantType: "scenario",
        scenarioParticipantId: "participant-2",
      },
    ];
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.encounterService.updateEncounter.mockImplementation(
      async (update: { session: EncounterSession }) => update.session,
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PATCH",
      payload: {
        expectedRevision: existingEncounter.updatedAt,
        participantMembershipMode: "explicit",
        participants,
      },
      url: "/encounters/encounter-1/participants",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.participants).toHaveLength(1);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      expectedRevision: existingEncounter.updatedAt,
      objectiveEvent: {
        actorUserId: "gm-1",
        eventType: "encounter_participants_updated",
        summary: "Updated encounter Courtyard participants.",
      },
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        combatRoundState: existingEncounter.combatRoundState,
        participantMembershipMode: "explicit",
        participants: expect.arrayContaining([
          expect.objectContaining({
            id: "scenario-participant-2",
            scenarioParticipantId: "participant-2",
          }),
        ]),
      }),
    });
  });

  it("removes encounter participants through the narrow participants payload", async () => {
    const existingParticipant = {
      id: "scenario-participant-2",
      initiative: 0,
      label: "Scyrian cavalry guy",
      order: 1,
      participantType: "scenario",
      scenarioParticipantId: "participant-2",
    };
    const existingEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participantMembershipMode: "explicit",
      participants: [existingParticipant],
      status: "active",
      title: "Courtyard",
    });
    mocks.encounterService.getEncounterById.mockResolvedValue(existingEncounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.encounterService.updateEncounter.mockImplementation(
      async (update: { session: EncounterSession }) => update.session,
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "PATCH",
      payload: {
        expectedRevision: existingEncounter.updatedAt,
        participantMembershipMode: "explicit",
        participants: [],
      },
      url: "/encounters/encounter-1/participants",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.participants).toEqual([]);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith({
      campaignId: "campaign-1",
      encounterId: "encounter-1",
      expectedRevision: existingEncounter.updatedAt,
      objectiveEvent: {
        actorUserId: "gm-1",
        eventType: "encounter_participants_updated",
        summary: "Updated encounter Courtyard participants.",
      },
      scenarioId: "scenario-1",
      session: expect.objectContaining({
        combatRoundState: existingEncounter.combatRoundState,
        participantMembershipMode: "explicit",
        participants: [],
      }),
    });
  });

  it("allows a player to submit their own non-silent assigned roleplay roll", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            difficulty: "medium",
            id: "roll-1",
            mode: "difficulty",
            otherMod: 0,
            participantId: "scenario-participant-1",
            rollSetId: "roll-set-1",
            silent: false,
            skillId: "perception",
            skillLabel: "Perception",
            skillValue: 10,
            useDbMod: false,
            useGenMod: false,
            useObSkillMod: false,
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const scenario = {
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    };
    const campaign = {
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.encounterService.updateEncounter.mockImplementation(
      async (input: { session: unknown }) => input.session,
    );
    mocks.scenarioService.getScenarioById.mockResolvedValue(scenario);
    mocks.campaignService.getCampaignById.mockResolvedValue(campaign);
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.roleplayState.actionLog[0]).toMatchObject({
      pendingRollId: "roll-1",
      participantId: "scenario-participant-1",
      rollD20: 12,
      silent: false,
      skillId: "perception",
      type: "gm_skill_roll",
    });
  });

  it("assigns a canonical Stat check from a real persisted entity snapshot and rejects stale assignment", async () => {
    const encounter = encounterSessionSchema.parse({
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "encounter-player-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {},
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const scenarioParticipant = scenarioParticipantSchema.parse({
      controlledByUserId: "player-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      id: "participant-1",
      isActive: true,
      joinSource: "gm_added",
      role: "player_character",
      scenarioId: "scenario-1",
      snapshot: createParticipantSnapshotFromEntity({
        entity: {
          kind: "npc",
          name: "Player hero",
          snapshot: {
            generatedHumanoidNpc: {
              stats: {
                base: { dex: 12, pow: 22 },
                final: { dex: 14, pow: 26 },
              },
            },
          },
        },
      }).snapshot,
      sourceType: "entity",
      state: {
        combat: { combatContext: { modifierBuckets: emptyModifierBuckets() } },
        conditions: [],
        equipment: {},
        health: {},
        modifiers: [],
        resources: {},
      },
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.encounterService.updateEncounter.mockImplementation(
      async (input: { session: EncounterSession }) => input.session,
    );
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      status: "active",
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([scenarioParticipant]);
    const app = await buildScenarioTestApp();

    const assigned = await app.inject({
      method: "POST",
      payload: {
        difficulty: "medium",
        expectedRevision: encounter.updatedAt,
        participantId: "encounter-player-1",
        statId: "dex",
      },
      url: "/encounters/encounter-1/roleplay/stat-checks",
    });
    const stale = await app.inject({
      method: "POST",
      payload: {
        difficulty: "hard",
        expectedRevision: "stale-revision",
        participantId: "encounter-player-1",
        statId: "dex",
      },
      url: "/encounters/encounter-1/roleplay/stat-checks",
    });

    await app.close();

    expect(assigned.statusCode).toBe(200);
    expect(assigned.json().encounter.roleplayState.pendingStatChecks[0]).toMatchObject({
      difficulty: "medium",
      participantId: "encounter-player-1",
      statId: "dex",
      statLabel: "Dex",
      statValue: 14,
    });
    expect(assigned.json().encounter.roleplayState.actionLog[0]).toMatchObject({
      statId: "dex",
      type: "stat_check_assigned",
    });
    expect(stale.statusCode).toBe(409);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledTimes(1);
  });

  it("resolves an assigned Stat check once and returns only the player's Stat payload", async () => {
    let persistedEncounter = encounterSessionSchema.parse({
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participantMembershipMode: "explicit",
      participants: [
        {
          id: "encounter-player-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
        {
          id: "encounter-player-2",
          label: "Other hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-2",
        },
      ],
      roleplayState: {
        pendingStatChecks: [
          {
            assignedAt: "2026-01-01T00:02:00.000Z",
            difficulty: "medium",
            id: "stat-check-own",
            participantId: "encounter-player-1",
            statId: "dex",
            statLabel: "Dex",
            statValue: 14,
          },
          {
            assignedAt: "2026-01-01T00:03:00.000Z",
            difficulty: "medium",
            id: "stat-check-auto",
            participantId: "encounter-player-1",
            statId: "pow",
            statLabel: "Pow",
            statValue: 26,
          },
          {
            assignedAt: "2026-01-01T00:01:00.000Z",
            difficulty: "hard",
            id: "stat-check-other",
            participantId: "encounter-player-2",
            statId: "will",
            statLabel: "Will",
            statValue: 19,
          },
          {
            assignedAt: "2026-01-01T00:04:00.000Z",
            difficulty: "medium",
            id: "stat-check-race",
            participantId: "encounter-player-1",
            statId: "dex",
            statLabel: "Dex",
            statValue: 14,
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });
    const scenarioParticipants = [
      scenarioParticipantSchema.parse({
        controlledByUserId: "player-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "participant-1",
        isActive: true,
        joinSource: "gm_added",
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Player hero" },
        sourceType: "character",
        state: {
          combat: { combatContext: { modifierBuckets: emptyModifierBuckets() } },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
      scenarioParticipantSchema.parse({
        controlledByUserId: "player-2",
        createdAt: "2026-01-01T00:00:00.000Z",
        id: "participant-2",
        isActive: true,
        joinSource: "gm_added",
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: { displayName: "Other hero" },
        sourceType: "character",
        state: {
          combat: { combatContext: { modifierBuckets: emptyModifierBuckets() } },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
        updatedAt: "2026-01-01T00:00:00.000Z",
      }),
    ];
    const { EncounterWriteError } = await import("@glantri/database");
    let releaseRacingWrites!: () => void;
    const racingWritesReady = new Promise<void>((resolve) => {
      releaseRacingWrites = resolve;
    });
    let racingWriteAttempts = 0;
    let persistedRevision = 0;
    mocks.encounterService.getEncounterById.mockImplementation(async () => persistedEncounter);
    mocks.encounterService.updateEncounter.mockImplementation(
      async (input: { expectedRevision?: string; session: EncounterSession }) => {
        const resolvesRacingCheck = normalizeRoleplayState(input.session).actionLog.some(
          (entry) =>
            entry.type === "stat_check_result" && entry.pendingRollId === "stat-check-race",
        );
        if (resolvesRacingCheck) {
          racingWriteAttempts += 1;
          if (racingWriteAttempts === 2) {
            releaseRacingWrites();
          } else {
            await racingWritesReady;
          }
        }
        if (input.expectedRevision && input.expectedRevision !== persistedEncounter.updatedAt) {
          throw new EncounterWriteError(
            "transaction_conflict",
            "Prisma transaction failed at /private/internal/repository.ts.",
          );
        }
        persistedRevision += 1;
        persistedEncounter = encounterSessionSchema.parse({
          ...input.session,
          updatedAt: `2026-01-01T00:00:0${persistedRevision}.000Z`,
        });
        return persistedEncounter;
      },
    );
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      status: "active",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    const app = await buildScenarioTestApp();

    const first = await app.inject({
      method: "POST",
      payload: {
        expectedRevision: persistedEncounter.updatedAt,
        pendingRollId: "stat-check-own",
        roll: { openEndedD10s: [], rollD20: 9 },
      },
      url: "/encounters/encounter-1/player-roll",
    });
    const automatic = await app.inject({
      method: "POST",
      payload: {
        acceptAutomaticSuccess: true,
        expectedRevision: persistedEncounter.updatedAt,
        pendingRollId: "stat-check-auto",
      },
      url: "/encounters/encounter-1/player-roll",
    });
    const second = await app.inject({
      method: "POST",
      payload: {
        expectedRevision: persistedEncounter.updatedAt,
        pendingRollId: "stat-check-own",
        roll: { openEndedD10s: [], rollD20: 9 },
      },
      url: "/encounters/encounter-1/player-roll",
    });
    const concurrentRevision = persistedEncounter.updatedAt;
    const concurrent = await Promise.all(
      [4, 19].map((rollD20) =>
        app.inject({
          method: "POST",
          payload: {
            expectedRevision: concurrentRevision,
            pendingRollId: "stat-check-race",
            roll: { openEndedD10s: [], rollD20 },
          },
          url: "/encounters/encounter-1/player-roll",
        }),
      ),
    );

    await app.close();

    expect(first.statusCode).toBe(200);
    expect(first.json().encounter.roleplayState.pendingStatChecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "stat-check-own", statLabel: "Dex" }),
        expect.objectContaining({ id: "stat-check-auto", statLabel: "Pow" }),
      ]),
    );
    expect(first.json().encounter.roleplayState.actionLog[0]).toMatchObject({
      achievedSuccessLevelLabel: "Medium",
      numericSubtotal: 23,
      pendingRollId: "stat-check-own",
      success: true,
      type: "stat_check_result",
    });
    expect(automatic.statusCode).toBe(200);
    expect(automatic.json().encounter.roleplayState.actionLog[0]).toMatchObject({
      autoSuccess: true,
      pendingRollId: "stat-check-auto",
      statId: "pow",
      success: true,
      type: "stat_check_result",
    });
    expect(automatic.json().encounter.roleplayState.actionLog[0].rollD20).toBeUndefined();
    expect(JSON.stringify(first.json())).not.toContain("stat-check-other");
    expect(JSON.stringify(first.json())).not.toContain('"statLabel":"Will"');
    expect(second.statusCode).toBe(200);
    expect(second.json().idempotent).toBe(true);
    expect(concurrent.map((response) => response.statusCode).sort()).toEqual([200, 409]);
    const accepted = concurrent.find((response) => response.statusCode === 200)!;
    const rejected = concurrent.find((response) => response.statusCode === 409)!;
    const acceptedRaceResult = accepted
      .json()
      .encounter.roleplayState.actionLog.find(
        (entry: { pendingRollId?: string }) => entry.pendingRollId === "stat-check-race",
      );
    const durableRaceResult = normalizeRoleplayState(persistedEncounter).actionLog.find(
      (entry) => entry.pendingRollId === "stat-check-race",
    );
    expect([4, 19]).toContain(acceptedRaceResult.rollD20);
    expect(durableRaceResult?.rollD20).toBe(acceptedRaceResult.rollD20);
    expect(rejected.json()).toMatchObject({
      code: "stale_revision",
      error: "This Stat check changed before the result was accepted. Refresh and review it.",
    });
    expect(rejected.body).not.toContain("Prisma");
    expect(rejected.body).not.toContain("/private/");
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledTimes(4);
  });

  it("allows a GM to submit a selected participant's player-facing assigned roleplay roll", async () => {
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    const encounter = {
      actionLog: [],
      campaignId: "campaign-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Absent hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            difficulty: "medium",
            id: "roll-1",
            mode: "difficulty",
            otherMod: 0,
            participantId: "scenario-participant-1",
            rollSetId: "roll-set-1",
            silent: false,
            skillId: "perception",
            skillLabel: "Perception",
            skillValue: 10,
            useDbMod: false,
            useGenMod: false,
            useObSkillMod: false,
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.encounterService.updateEncounter.mockImplementation(
      async (input: { session: unknown }) => input.session,
    );
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "other-player",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Absent hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.roleplayState.actionLog[0]).toMatchObject({
      pendingRollId: "roll-1",
      participantId: "scenario-participant-1",
      rollD20: 12,
      silent: false,
      skillId: "perception",
      type: "gm_skill_roll",
    });
  });

  it("preserves roll set and actor side when a player submits an assigned opposed roll", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "roll-1",
            mode: "opposed",
            otherMod: 0,
            opponentParticipantId: "scenario-participant-2",
            opponentSkillId: "brawling",
            opponentSkillLabel: "Brawling",
            participantId: "scenario-participant-1",
            rollSetId: "roll-set-1",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
            skillValue: 24,
            useDbMod: false,
            useGenMod: false,
            useObSkillMod: false,
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.encounterService.updateEncounter.mockImplementation(
      async (input: { session: unknown }) => input.session,
    );
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      kind: "combat",
      name: "Bridge Ambush",
      status: "live",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
      status: "active",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 26,
          openEndedD10s: [6],
          rollD20: 20,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.roleplayState.actionLog[0]).toMatchObject({
      mode: "opposed",
      pendingRollId: "roll-1",
      rollSetId: "roll-set-1",
      side: "actor",
      participantId: "scenario-participant-1",
      skillId: "dodge",
      numericSubtotal: 50,
    });
  });

  it("rejects player roleplay rolls for other-participant assignments", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-other-participant",
          label: "Other hero",
          participantType: "scenario",
          scenarioParticipantId: "other-participant",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "roll-1",
            participantId: "scenario-other-participant",
            silent: false,
            skillId: "perception",
            skillLabel: "Perception",
          },
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "silent-roll",
            participantId: "scenario-other-participant",
            silent: true,
            skillId: "stealth",
            skillLabel: "Stealth",
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      name: "Bridge Ambush",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
      {
        controlledByUserId: "other-player",
        id: "other-participant",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Other hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("allows a player to declare combat action for their assigned participant during DE", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [
              {
                durationRounds: 2,
                id: "gm-initiative-mod",
                notes: "Quick start",
                scope: "until",
                value: 1,
              },
            ],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase1: {
            mainHandParryDirection: "left",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
          phase2: {
            offHandParryDirection: "right_forward",
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "attack_parry",
            lastDeclaredEncounterId: "encounter-1",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [attackParryDbParryModifier],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "submitted",
    );
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "attack_parry",
      attackPhaseDefensivePenalties: [expect.objectContaining({ penalty: -4, phase: "phase1" })],
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [attackParryDbParryModifier],
        }),
      }),
      movementId: "hold",
      phaseContexts: {
        phase1: expect.objectContaining({
          mainHandParryDirection: "left",
        }),
        phase2: expect.objectContaining({
          offHandParryDirection: "right_forward",
        }),
      },
      roundNumber: 1,
      submittedBy: "player",
      submittedByUserId: "player-1",
    });
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(1);
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "DE",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "DE",
      },
      createdByUserId: "player-1",
      participantId: "encounter-participant-1",
      type: "declare_action",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
  });

  it("rejects unavailable declaration processes before generic attack routing", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    for (const actionId of ["counterattack", "other"]) {
      const response = await app.inject({
        method: "POST",
        payload: {
          actionId,
          combatContext: { modifierBuckets: emptyModifierBuckets() },
          phaseContexts: {
            phase1: {
              modifierBuckets: emptyModifierBuckets(),
              targetParticipantId: "encounter-target-1",
            },
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: `Combat action is not yet available: ${actionId}.`,
      });
    }

    await app.close();

    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("uses Scenario participant visibility when resolving a player Disarm declaration", async () => {
    const actingParticipant = makeCombatScenarioParticipant({
      characterId: "character-1",
      controlledByUserId: "player-1",
      id: "participant-1",
    });
    const hiddenParticipant = makeCombatScenarioParticipant({
      characterId: "character-hidden",
      controlledByUserId: "player-hidden",
      id: "participant-hidden",
      visibilityOverrides: { visibility: "gm_only" },
    });
    setupCombatDeclarationRoute({
      encounter: {
        roleplayState: {
          visibility: {
            "encounter-participant-1": {
              "encounter-participant-1": true,
              "encounter-target-hidden": true,
            },
          },
        },
        participants: [
          {
            characterId: "character-1",
            id: "encounter-participant-1",
            initiative: 0,
            label: "The Gladiator",
            order: 0,
            participantType: "scenario",
            scenarioParticipantId: "participant-1",
          },
          {
            characterId: "character-hidden",
            id: "encounter-target-hidden",
            initiative: 0,
            label: "Hidden target",
            order: 1,
            participantType: "scenario",
            scenarioParticipantId: "participant-hidden",
          },
        ],
      },
      participant: actingParticipant,
      participants: [actingParticipant, hiddenParticipant],
      user: mocks.playerUser,
    });
    mocks.combatItemInteractionService.resolveDisarmDeclaration.mockRejectedValue(
      new Error("Unavailable"),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "disarm",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        disarm: {
          actingItemId: "item-main-gauche",
          actingItemRevision: "2026-08-17T10:00:00.000Z",
          method: "proactive",
          phase: "phase1",
          targetItemId: "item-hidden-sword",
          targetItemRevision: "2026-08-17T10:00:00.000Z",
          targetParticipantId: "encounter-target-hidden",
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.body).not.toContain("Hidden target");
    expect(response.body).not.toContain("item-hidden-sword");
    const declarationRequest =
      mocks.combatItemInteractionService.resolveDisarmDeclaration.mock.calls[0]?.[0];
    expect(declarationRequest.viewer.kind).toBe("player");
    expect(declarationRequest.viewer.visibleParticipantIds.has("encounter-participant-1")).toBe(
      true,
    );
    expect(declarationRequest.viewer.visibleParticipantIds.has("encounter-target-hidden")).toBe(
      false,
    );
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects unsupported secondary actions before they can affect execution", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "parry",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        scenarioParticipantId: "participant-1",
        secondaryActionId: "counterattack",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Combat secondary action is not yet available: counterattack.",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it.each([
    ["player", mocks.playerUser],
    ["GM proxy", mocks.adminUser],
  ] as const)(
    "rejects a forged incompatible primary-secondary pair for %s through the shared authority",
    async (_viewer, user) => {
      setupCombatDeclarationRoute({ user });
      const app = await buildScenarioTestApp();
      const response = await app.inject({
        method: "POST",
        payload: {
          actionId: "attack_parry",
          combatContext: { modifierBuckets: emptyModifierBuckets() },
          scenarioParticipantId: "participant-1",
          secondaryActionContext: {
            action: "observe_opponent",
            targetParticipantId: "encounter-target-1",
          },
          secondaryActionId: "observe_opponent",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });
      await app.close();

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "observe_opponent is not compatible with the selected primary action.",
      });
      expect(response.body).not.toContain("encounter-target-1");
      expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
      expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["player", mocks.playerUser],
    ["GM proxy", mocks.adminUser],
  ] as const)(
    "rejects a forged internal-only primary-secondary pair for %s without mutation",
    async (_viewer, user) => {
      setupCombatDeclarationRoute({ user });
      const app = await buildScenarioTestApp();
      const response = await app.inject({
        method: "POST",
        payload: {
          actionId: "move_only",
          combatContext: { modifierBuckets: emptyModifierBuckets() },
          scenarioParticipantId: "participant-1",
          secondaryActionContext: {
            action: "observe_opponent",
            targetParticipantId: "encounter-target-1",
          },
          secondaryActionId: "observe_opponent",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });
      await app.close();

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error: "observe_opponent is not compatible with the selected primary action.",
      });
      expect(response.body).not.toContain("encounter-target-1");
      expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
      expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
      expect(mocks.scenarioService.recordScenarioEvent).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["player", mocks.playerUser],
    ["GM proxy", mocks.adminUser],
  ] as const)(
    "rejects an unavailable relative target for %s without restoring declaration-time feasibility gating",
    async (_viewer, user) => {
      setupCombatDeclarationRoute({ user });
      const app = await buildScenarioTestApp();
      const response = await app.inject({
        method: "POST",
        payload: {
          actionId: "adjust_range_attack",
          combatContext: { modifierBuckets: emptyModifierBuckets() },
          movementIntent: {
            distancePreferences: [
              {
                desiredDistance: 1,
                operation: "close",
                source: "player_declared",
                targetParticipantId: "hidden-opponent",
              },
            ],
            mode: "set_distance_preferences",
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });
      await app.close();

      expect(response.statusCode).toBe(400);
      expect(response.json()).toEqual({
        error:
          _viewer === "player"
            ? "Distance preference target is unavailable."
            : "Distance preference target is not part of this combat round.",
      });
      expect(response.body).not.toContain("hidden-opponent");
      expect(mocks.encounterService.commitCombatParticipantStateMutation).not.toHaveBeenCalled();
      expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
      expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
      expect(mocks.scenarioService.recordScenarioEvent).not.toHaveBeenCalled();
    },
  );

  it("rejects a forged secondary-only declaration before it can persist", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        scenarioParticipantId: "participant-1",
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: "encounter-target-1",
        },
        secondaryActionId: "observe_opponent",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "observe_opponent requires a compatible primary action.",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("keeps final DE and M1 mutation revisions authoritative through reads and immediate advances", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounter({
      currentRound: 2,
      participants: encounterParticipants,
    }) as EncounterSession;
    const firstDeclaration = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-07-21T10:00:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: { roundNumber: 2 },
      participantId: "encounter-participant-1",
      state: initializeCombatRoundState({ encounter: baseEncounter }),
      submittedBy: "gm",
    });
    const participants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
        snapshot: { displayName: "City guard" },
      }),
    ];
    const mutable = setupMutableCombatRouteState({
      encounter: {
        ...baseEncounter,
        combatRoundState: firstDeclaration,
      },
      participants,
      user: mocks.adminUser,
    });
    const persistEncounter =
      mocks.encounterService.updateEncounter.getMockImplementation() as (update: {
        session: EncounterSession;
      }) => Promise<EncounterSession>;
    const persistedRevisions = [
      "2026-07-21T10:00:01.000Z",
      "2026-07-21T10:00:02.000Z",
      "2026-07-21T10:00:03.000Z",
      "2026-07-21T10:00:04.000Z",
      "2026-07-21T10:00:05.000Z",
    ];
    let persistedRevisionIndex = 0;
    mocks.encounterService.updateEncounter.mockImplementation(
      async (update: { session: EncounterSession }) => {
        const persisted = encounterSessionSchema.parse(
          JSON.parse(
            JSON.stringify({
              ...update.session,
              updatedAt: persistedRevisions[persistedRevisionIndex++],
            }),
          ),
        );
        await persistEncounter({ session: persisted });
        return persisted;
      },
    );
    const app = await buildScenarioTestApp();

    const declarationResponse = await app.inject({
      method: "POST",
      payload: {
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    const declarationEncounter = declarationResponse.json().encounter as EncounterSession;
    const mutationRevision = declarationEncounter.updatedAt;
    const finalPersistedRevision = mutable.encounter.updatedAt;
    const rematerializedState = initializeCombatRoundState({
      encounter: declarationEncounter,
    });
    const [refreshResponse, historyResponse, overlappingRefreshResponse] = await Promise.all([
      app.inject({
        method: "GET",
        url: "/encounters/encounter-1",
      }),
      app.inject({
        method: "GET",
        url: "/encounters/encounter-1/combat-history",
      }),
      app.inject({
        method: "GET",
        url: "/encounters/encounter-1",
      }),
    ]);
    const boundaryTask = buildCombatProgressionProjection(rematerializedState)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.kind === "gm_advance_boundary");
    const boundaryResponse = await app.inject({
      method: "POST",
      payload: {
        ...buildBoundaryTaskPayload(
          rematerializedState,
          mutationRevision,
          "phase1_modifier_review",
        ),
        expectedBoundary: "declaration",
        targetBoundary: "phase1_modifier_review",
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });
    const firstReviewResponse = await app.inject({
      method: "POST",
      payload: {
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    const finalReviewResponse = await app.inject({
      method: "POST",
      payload: {
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    const finalReviewEncounter = finalReviewResponse.json().encounter as EncounterSession;
    const finalReviewRevision = finalReviewEncounter.updatedAt;
    const reviewRefreshResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });
    const reviewBoundaryTask = buildCombatProgressionProjection(
      initializeCombatRoundState({ encounter: finalReviewEncounter }),
    )
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.kind === "gm_advance_boundary");
    const initiativeBoundaryResponse = await app.inject({
      method: "POST",
      payload: {
        ...buildBoundaryTaskPayload(
          initializeCombatRoundState({ encounter: finalReviewEncounter }),
          finalReviewRevision,
          "phase1_initiative",
        ),
        expectedBoundary: "phase1_modifier_review",
        targetBoundary: "phase1_initiative",
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });

    await app.close();

    expect(declarationResponse.statusCode, JSON.stringify(declarationResponse.json())).toBe(200);
    expect(mutationRevision).toBe("2026-07-21T10:00:01.000Z");
    expect(finalPersistedRevision).toBe(mutationRevision);
    expect(rematerializedState).toEqual(declarationEncounter.combatRoundState);
    expect(Object.hasOwn(rematerializedState, "activeParticipantId")).toBe(true);
    expect(Object.hasOwn(declarationEncounter.combatRoundState ?? {}, "activeParticipantId")).toBe(
      false,
    );
    expect(JSON.stringify(rematerializedState)).not.toBe(
      JSON.stringify(declarationEncounter.combatRoundState),
    );
    expect(refreshResponse.statusCode).toBe(200);
    expect(refreshResponse.json().encounter.updatedAt).toBe(mutationRevision);
    expect(historyResponse.statusCode).toBe(200);
    expect(historyResponse.json().history.sourceUpdatedAt).toBe(mutationRevision);
    expect(overlappingRefreshResponse.statusCode).toBe(200);
    expect(overlappingRefreshResponse.json().encounter.updatedAt).toBe(mutationRevision);
    expect(boundaryTask).toMatchObject({
      kind: "gm_advance_boundary",
      transition: {
        currentBoundary: "declaration",
        targetBoundary: "phase1_modifier_review",
      },
    });
    expect(boundaryResponse.statusCode, JSON.stringify(boundaryResponse.json())).toBe(200);
    expect(boundaryResponse.json().encounter.updatedAt).toBe("2026-07-21T10:00:02.000Z");
    expect(firstReviewResponse.statusCode, JSON.stringify(firstReviewResponse.json())).toBe(200);
    expect(finalReviewResponse.statusCode, JSON.stringify(finalReviewResponse.json())).toBe(200);
    expect(finalReviewRevision).toBe("2026-07-21T10:00:04.000Z");
    expect(mutable.encounter.updatedAt).toBe("2026-07-21T10:00:05.000Z");
    expect(reviewRefreshResponse.statusCode).toBe(200);
    expect(reviewRefreshResponse.json().encounter.updatedAt).toBe(finalReviewRevision);
    expect(reviewBoundaryTask).toMatchObject({
      kind: "gm_advance_boundary",
      transition: {
        currentBoundary: "phase1_modifier_review",
        targetBoundary: "phase1_initiative",
      },
    });
    expect(
      initiativeBoundaryResponse.statusCode,
      JSON.stringify(initiativeBoundaryResponse.json()),
    ).toBe(200);
    expect(initiativeBoundaryResponse.json().encounter.updatedAt).toBe("2026-07-21T10:00:05.000Z");
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledTimes(5);
  });

  it("accepts a player combat mutation through the canonical legacy participant alias", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        participantMembershipMode: "explicit",
        participants: [
          {
            ...makeCombatEncounter().participants[0],
            id: "scenario-participant-1",
            scenarioParticipantId: undefined,
          },
        ],
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        movementId: "hold",
        phaseContexts: {
          phase1: {
            modifierBuckets: emptyModifierBuckets(),
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          combatRoundState: expect.objectContaining({
            participants: [
              expect.objectContaining({
                participantId: "scenario-participant-1",
                stepStatuses: expect.objectContaining({ select_actions: "submitted" }),
              }),
            ],
          }),
        }),
      }),
    );
  });

  it("returns the same effective fallback roster used by player access and combat history", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: undefined,
        participantMembershipMode: undefined,
        participants: [],
      },
    });
    const app = await buildScenarioTestApp();

    const [encounterResponse, historyResponse] = await Promise.all([
      app.inject({ method: "GET", url: "/encounters/encounter-1" }),
      app.inject({ method: "GET", url: "/encounters/encounter-1/combat-history" }),
    ]);
    await app.close();

    expect(encounterResponse.statusCode).toBe(200);
    expect(historyResponse.statusCode).toBe(200);
    expect(encounterResponse.json().encounter.participants).toEqual([
      expect.objectContaining({
        id: "scenario-fallback-participant-1",
        scenarioParticipantId: "participant-1",
      }),
    ]);
    expect(historyResponse.json().history.rows).toEqual([
      expect.objectContaining({ participantId: "scenario-fallback-participant-1" }),
    ]);
    expect(mocks.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("accepts the projected fallback encounter alias for the controlling player", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: undefined,
        currentRound: 2,
        participantMembershipMode: undefined,
        participants: [],
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        movementId: "hold",
        phaseContexts: {
          phase1: {
            modifierBuckets: emptyModifierBuckets(),
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "scenario-fallback-participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
        .participants[0],
    ).toMatchObject({
      participantId: "scenario-fallback-participant-1",
      stepStatuses: { select_actions: "submitted" },
    });
  });

  it("lets a GM recommit the canonical declaration during DE without duplicate phase attacks", async () => {
    const encounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: makeTwoCombatEncounterParticipants(),
    });
    const participants = [
      makeCombatScenarioParticipant(),
      makeCombatScenarioParticipant({
        controlledByUserId: "player-2",
        id: "participant-2",
        snapshot: { displayName: "City guard" },
      }),
    ];
    const mutable = setupMutableCombatRouteState({
      encounter,
      participants,
      user: mocks.adminUser,
    });
    const combatContext = makeCombatScenarioParticipant().state.combat.combatContext;
    const app = await buildScenarioTestApp();
    const submit = (input: {
      actionId: "attack_parry" | "parry_attack";
      additionalActionNotes: string;
      phase: "phase1" | "phase2";
    }) =>
      app.inject({
        method: "POST",
        payload: {
          actionId: input.actionId,
          additionalActionNotes: input.additionalActionNotes,
          combatContext,
          movementId: "hold",
          phaseContexts: {
            [input.phase]: testCombatPhaseContext("participant-2"),
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });

    const first = await submit({
      actionId: "attack_parry",
      additionalActionNotes: "First draft",
      phase: "phase1",
    });
    const corrected = await submit({
      actionId: "parry_attack",
      additionalActionNotes: "Corrected draft",
      phase: "phase2",
    });

    await app.close();

    expect(first.statusCode, JSON.stringify(first.json())).toBe(200);
    expect(corrected.statusCode, JSON.stringify(corrected.json())).toBe(200);
    const state = mutable.encounter.combatRoundState!;
    const declaration = state.participants.find(
      (participant) => participant.participantId === "encounter-participant-1",
    )?.declaration;
    expect(state.currentStep).toBe("select_actions");
    expect(declaration).toMatchObject({
      actionId: "parry_attack",
      additionalActionNotes: "Corrected draft",
      submittedBy: "gm",
    });
    expect(state.commands.filter((command) => command.type === "declare_action")).toHaveLength(2);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "encounter-participant-1",
        phase: "phase1",
        state,
      }),
    ).toBe(false);
    expect(
      combatRoundParticipantHasPhaseAttack({
        participantId: "encounter-participant-1",
        phase: "phase2",
        state,
      }),
    ).toBe(true);
  });

  it("keeps a valid player declaration single-submit while GM progression remains at DE", async () => {
    const encounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: makeTwoCombatEncounterParticipants(),
    });
    const participants = [
      makeCombatScenarioParticipant(),
      makeCombatScenarioParticipant({
        controlledByUserId: "player-2",
        id: "participant-2",
        snapshot: { displayName: "City guard" },
      }),
    ];
    setupMutableCombatRouteState({ encounter, participants, user: mocks.playerUser });
    const combatContext = makeCombatScenarioParticipant().state.combat.combatContext;
    const app = await buildScenarioTestApp();
    const payload = {
      actionId: "attack_parry",
      combatContext,
      movementId: "hold",
      phaseContexts: {
        phase1: testCombatPhaseContext("participant-2"),
      },
      scenarioParticipantId: "participant-1",
    };

    const first = await app.inject({
      method: "POST",
      payload,
      url: "/encounters/encounter-1/combat-declaration",
    });
    const retry = await app.inject({
      method: "POST",
      payload: { ...payload, additionalActionNotes: "Player retry" },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(first.statusCode, JSON.stringify(first.json())).toBe(200);
    expect(retry.statusCode, JSON.stringify(retry.json())).toBe(409);
    expect(retry.json()).toMatchObject({ error: "Declaration is closed for this round." });
  });

  it("persists player-declared distance movement intent from the combat declaration route", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();

    setupCombatDeclarationRoute({
      encounter: {
        participants: encounterParticipants,
      },
      participants: [
        makeCombatScenarioParticipantWithWeapon({
          id: "participant-1",
          weaponName: "Broad sword",
          weaponRange: "2.0",
        }),
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "step",
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 3,
              source: "gm_proxy",
              targetParticipantId: "participant-2",
            },
          ],
          mode: "set_distance_preferences",
        },
        phaseContexts: {
          phase1: testCombatPhaseContext("participant-2"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;

    expect(updateStateCall.state.combat.lastMovementIntent).toEqual({
      distancePreferences: [
        {
          desiredDistance: 3,
          source: "player_declared",
          targetParticipantId: "participant-2",
        },
      ],
      mode: "set_distance_preferences",
    });
    expect(updatedEncounter.combatRoundState.participants[0].declaration.movementIntent).toEqual({
      distancePreferences: [
        {
          desiredDistance: 3,
          source: "player_declared",
          targetParticipantId: "participant-2",
        },
      ],
      mode: "set_distance_preferences",
    });
  });

  it.each([
    {
      actionId: "perform_task",
      expectedError: "Describe the task the character intends to perform.",
      label: "Perform Task without intent",
    },
    {
      actionId: "perform_task",
      expectedError: "Describe the task the character intends to perform.",
      intent: { primaryAction: { actionId: "perform_task" }, relativePositions: [] },
      label: "Perform Task without a description",
    },
    {
      actionId: "pass",
      expectedError: "Choose how the character speaks and enter the short utterance.",
      label: "Talk / Shout without intent",
      secondaryActionId: "talk_shout",
    },
    {
      actionId: "pass",
      expectedError: "Choose how the character speaks and enter the short utterance.",
      intent: {
        primaryAction: { actionId: "pass" },
        relativePositions: [],
        secondaryAction: { actionId: "talk_shout", utteranceType: "speak" },
      },
      label: "Talk / Shout without an utterance",
      secondaryActionId: "talk_shout",
    },
    {
      actionId: "pass",
      expectedError: "Describe the intended equipment change.",
      label: "Equip / Unequip without intent",
      secondaryActionId: "equip_unequip",
    },
    {
      actionId: "pass",
      expectedError: "Describe the intended equipment change.",
      intent: {
        primaryAction: { actionId: "pass" },
        relativePositions: [],
        secondaryAction: { actionId: "equip_unequip" },
      },
      label: "Equip / Unequip without a description",
      secondaryActionId: "equip_unequip",
    },
    {
      actionId: "pass",
      expectedError: "Describe the Small Action the character intends to attempt.",
      label: "Small Action without intent",
      secondaryActionId: "small_action",
    },
    {
      actionId: "pass",
      expectedError: "Describe the Small Action the character intends to attempt.",
      intent: {
        primaryAction: { actionId: "pass" },
        relativePositions: [],
        secondaryAction: { actionId: "small_action" },
      },
      label: "Small Action without a description",
      secondaryActionId: "small_action",
    },
  ])("rejects $label at the direct declaration API boundary", async (testCase) => {
    setupCombatDeclarationRoute({
      encounter: { participants: makeTwoCombatEncounterParticipants() },
      participants: [
        makeCombatScenarioParticipant({ id: "participant-1" }),
        makeCombatScenarioParticipant({
          controlledByUserId: "other-player",
          id: "participant-2",
        }),
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: testCase.actionId,
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        ...(testCase.intent ? { intent: testCase.intent } : {}),
        movementId: "hold",
        scenarioParticipantId: "participant-1",
        secondaryActionId: testCase.secondaryActionId,
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(400);
    expect(response.json()).toMatchObject({ error: testCase.expectedError });
    expect(mocks.encounterService.commitCombatParticipantStateMutation).not.toHaveBeenCalled();
  });

  it("persists the complete declaration intent and materializes player tasks for GM adjudication", async () => {
    setupCombatDeclarationRoute({
      encounter: { participants: makeTwoCombatEncounterParticipants() },
      participants: [
        makeCombatScenarioParticipant({ id: "participant-1" }),
        makeCombatScenarioParticipant({
          controlledByUserId: "other-player",
          id: "participant-2",
        }),
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "perform_task",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        intent: {
          facing: "backward_left",
          movementDirection: "forward_right",
          primaryAction: {
            actionId: "perform_task",
            description: "Bar the gate.",
          },
          relativePositions: [
            {
              desiredDistance: 2,
              intendedSpeed: "carefully",
              kind: "adjust_distance",
              targetParticipantId: "participant-2",
            },
            { formation: "Shield line around Mira", kind: "hold_formation" },
          ],
          secondaryAction: {
            actionId: "small_action",
            description: "Kick the loose torch aside.",
          },
        },
        movementId: "step",
        scenarioParticipantId: "participant-1",
        secondaryActionId: "small_action",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const declaration = updatedEncounter.combatRoundState.participants[0].declaration;
    expect(declaration.intent).toEqual({
      facing: "backward_left",
      movementDirection: "forward_right",
      primaryAction: {
        actionId: "perform_task",
        description: "Bar the gate.",
        taskId: "round:1:participant:encounter-participant-1:declaration:perform_task",
      },
      relativePositions: [
        {
          desiredDistance: 2,
          intendedSpeed: "carefully",
          kind: "adjust_distance",
          targetParticipantId: "encounter-participant-2",
        },
        { formation: "Shield line around Mira", kind: "hold_formation" },
      ],
      secondaryAction: {
        actionId: "small_action",
        description: "Kick the loose torch aside.",
        taskId: "round:1:participant:encounter-participant-1:declaration:small_action",
      },
    });
    expect(updatedEncounter.combatRoundState.genericActions).toMatchObject([
      {
        declarationKind: "perform_task",
        duration: { kind: "gm_decided" },
        intent: "Bar the gate.",
        ownerParticipantId: "encounter-participant-1",
        status: "declared",
      },
      {
        declarationKind: "small_action",
        duration: { kind: "gm_decided" },
        intent: "Kick the loose torch aside.",
        ownerParticipantId: "encounter-participant-1",
        status: "declared",
      },
    ]);
    expect(
      updatedEncounter.combatRoundState.genericActions.every(
        (action: { rollRequest?: unknown }) => action.rollRequest === undefined,
      ),
    ).toBe(true);
    expect(
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state.combat
        .lastDeclarationIntent,
    ).toEqual(declaration.intent);
  });

  // M7 — Forgejo issue #323. A secondary `small_action` that names an Item must reach the
  // canonical Combat action through the existing Item interaction authority, and must not open a
  // second Item-action channel. Every test below drives the **real**
  // `CombatItemInteractionService` over real canonical Item records, so the
  // `expectedItemRevision` guard, the operation/recipient rules and `CombatItemUnavailableError`
  // are the production ones rather than a fixture's idea of them.
  describe("M7 — Item identity on a Small Action declaration", () => {
    const ITEM_REVISION = "2026-08-16T09:29:00.000Z";

    async function useRealItemInteractionAuthority() {
      const database =
        await vi.importActual<typeof import("@glantri/database")>("@glantri/database");
      const domain = await vi.importActual<typeof import("@glantri/domain")>("@glantri/domain");
      const item = domain.CanonicalEquipmentItemSchema.parse({
        campaignContextId: "campaign-1",
        category: "weapon",
        characterId: "character-1",
        conditionState: "intact",
        displayName: "Silver dagger",
        holderCharacterId: "character-1",
        id: "item-1",
        isEquipped: false,
        isStackable: false,
        material: "steel",
        quality: "standard",
        quantity: 1,
        revision: ITEM_REVISION,
        specificityType: "specific",
        storageAssignment: { carryMode: "on_person", locationId: "character-1:loc-person" },
        templateId: "weapon-template-dagger",
      });
      const service = new database.CombatItemInteractionService(
        {
          getCombatItemInteractionRecords: vi.fn(async () => [
            { availableInEncounter: true, hidden: false, item },
          ]),
        } as never,
        {
          encounter: { findUnique: vi.fn(async () => ({ scenarioId: "scenario-1" })) },
          scenarioParticipant: { findMany: vi.fn(async () => []) },
        } as never,
      );
      mocks.combatItemInteractionService.resolveDeclaration.mockImplementation(
        async (input: Parameters<typeof service.resolveDeclaration>[0]) =>
          service.resolveDeclaration(input),
      );
      return service;
    }

    function setupItemDeclarationRoute(encounterOverrides: Record<string, unknown> = {}) {
      const participants = makeTwoCombatEncounterParticipants().map((participant, index) => ({
        ...participant,
        characterId: `character-${index + 1}`,
      }));
      setupCombatDeclarationRoute({
        encounter: { participants, ...encounterOverrides },
        participants: [
          makeCombatScenarioParticipant({ characterId: "character-1", id: "participant-1" }),
          makeCombatScenarioParticipant({
            characterId: "character-2",
            controlledByUserId: "other-player",
            id: "participant-2",
          }),
        ],
      });
    }

    function declarationPayload(
      item?: Record<string, unknown>,
      overrides: { secondaryActionId?: string } = {},
    ) {
      return {
        actionId: "pass",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        intent: {
          primaryAction: { actionId: "pass" },
          relativePositions: [],
          secondaryAction: {
            actionId: overrides.secondaryActionId ?? "small_action",
            description: "Drop the dagger and back away.",
            ...(item ? { item } : {}),
          },
        },
        movementId: "hold",
        scenarioParticipantId: "participant-1",
        secondaryActionId: overrides.secondaryActionId ?? "small_action",
      };
    }

    it("materializes the declared Item through the Item authority under a server-owned action id", async () => {
      setupItemDeclarationRoute();
      await useRealItemInteractionAuthority();
      const app = await buildScenarioTestApp();

      const response = await app.inject({
        method: "POST",
        payload: declarationPayload({
          expectedItemRevision: ITEM_REVISION,
          itemId: "item-1",
          operation: "drop",
        }),
        url: "/encounters/encounter-1/combat-declaration",
      });
      await app.close();

      expect(response.statusCode, JSON.stringify(response.json())).toBe(200);

      // Delegation, not duplication: the declaration asked the authority to resolve the Item and
      // copied what it returned.
      expect(mocks.combatItemInteractionService.resolveDeclaration).toHaveBeenCalledTimes(1);
      expect(
        mocks.combatItemInteractionService.resolveDeclaration.mock.calls[0]?.[0],
      ).toMatchObject({
        campaignId: "campaign-1",
        encounterId: "encounter-1",
        expectedItemRevision: ITEM_REVISION,
        itemId: "item-1",
        operation: "drop",
        ownerParticipantId: "encounter-participant-1",
      });

      const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
      const itemAction = updatedEncounter.combatRoundState.genericActions.find(
        (action: { declarationKind?: string }) => action.declarationKind === "small_action",
      );

      // **Id ownership.** The action id is the canonical server-derived declaration id. The
      // client supplied no action id at all, so the `combatItemInteractionRoutes` shape — a fully
      // client-supplied `actionId` — is not inherited by this path.
      expect(itemAction.id).toBe(
        "round:1:participant:encounter-participant-1:declaration:small_action",
      );
      expect(JSON.stringify(response.json())).not.toContain('actionId":"item');

      // **Privacy projection.** `preset: "item_interaction"` is what
      // `canViewCurrentItemOutcome` gates player visibility of the resolved outcome on, and what
      // `declareCombatGenericAction` pairs with `itemInteraction`.
      expect(itemAction.preset).toBe("item_interaction");
      expect(itemAction.itemInteraction).toEqual({
        itemId: "item-1",
        itemLabel: "Silver dagger",
        itemRevision: ITEM_REVISION,
        operation: "drop",
        recipientParticipantId: undefined,
        stateAtDeclaration: "held",
        visibleToParticipantIds: ["encounter-participant-1"],
      });
      expect(itemAction.reference).toEqual({
        itemId: "item-1",
        kind: "item",
        label: "Silver dagger",
        ownerParticipantId: "encounter-participant-1",
      });
      expect(itemAction.declarationKind).toBe("small_action");
      expect(itemAction.status).toBe("declared");

      // The Item identity survives on the persisted declaration itself, which is the gap #323
      // names: a `small_action` previously materialized with no Item identity at all.
      const declaration = updatedEncounter.combatRoundState.participants[0].declaration;
      expect(declaration.intent.secondaryAction).toEqual({
        actionId: "small_action",
        description: "Drop the dagger and back away.",
        item: {
          expectedItemRevision: ITEM_REVISION,
          itemId: "item-1",
          operation: "drop",
        },
        taskId: "round:1:participant:encounter-participant-1:declaration:small_action",
      });
    });

    it("rejects a stale Item revision through the authority's own guard and persists nothing", async () => {
      setupItemDeclarationRoute();
      await useRealItemInteractionAuthority();
      const app = await buildScenarioTestApp();

      const response = await app.inject({
        method: "POST",
        payload: declarationPayload({
          expectedItemRevision: "2026-08-16T08:00:00.000Z",
          itemId: "item-1",
          operation: "drop",
        }),
        url: "/encounters/encounter-1/combat-declaration",
      });
      await app.close();

      expect(response.statusCode, JSON.stringify(response.json())).toBe(409);
      expect(response.json()).toMatchObject({ code: "declaration_item_unavailable" });
      expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
      expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    });

    it("refuses an unavailable Item identically to a stale one", async () => {
      setupItemDeclarationRoute();
      await useRealItemInteractionAuthority();
      const app = await buildScenarioTestApp();

      const responses = [];
      for (const item of [
        { expectedItemRevision: ITEM_REVISION, itemId: "item-nonexistent", operation: "drop" },
        { expectedItemRevision: ITEM_REVISION, itemId: "item-1", operation: "pickup" },
        {
          expectedItemRevision: ITEM_REVISION,
          itemId: "item-1",
          operation: "drop",
          recipientParticipantId: "encounter-participant-2",
        },
      ]) {
        responses.push(
          await app.inject({
            method: "POST",
            payload: declarationPayload(item),
            url: "/encounters/encounter-1/combat-declaration",
          }),
        );
      }
      await app.close();

      for (const response of responses) {
        expect(response.statusCode, JSON.stringify(response.json())).toBe(409);
        expect(response.json()).toMatchObject({
          code: "declaration_item_unavailable",
          error: "The selected Item is no longer available. Refresh and select again.",
        });
      }
      expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    });

    // Scope boundary, Product Owner ruling of 2026-09-25: `equip_unequip` is explicitly deferred
    // and materializes no generic action, so it must not acquire Item identity by any route.
    it("refuses Item identity on equip_unequip and never consults the Item authority", async () => {
      setupItemDeclarationRoute();
      await useRealItemInteractionAuthority();
      const app = await buildScenarioTestApp();

      const response = await app.inject({
        method: "POST",
        payload: {
          ...declarationPayload(
            { expectedItemRevision: ITEM_REVISION, itemId: "item-1", operation: "drop" },
            { secondaryActionId: "equip_unequip" },
          ),
        },
        url: "/encounters/encounter-1/combat-declaration",
      });
      await app.close();

      expect(response.statusCode, JSON.stringify(response.json())).toBe(400);
      expect(response.json()).toMatchObject({
        error: "Only a Small Action can name a canonical Item to interact with.",
      });
      expect(mocks.combatItemInteractionService.resolveDeclaration).not.toHaveBeenCalled();
      expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    });

    it("refuses to adopt a live Small Action whose Item identity differs from the declared one", async () => {
      const participants = makeTwoCombatEncounterParticipants().map((participant, index) => ({
        ...participant,
        characterId: `character-${index + 1}`,
      }));
      const encounter = makeCombatEncounterWithResolvedCombatExperience({
        participants,
      }) as EncounterSession;
      const canonicalTaskId =
        "round:1:participant:encounter-participant-1:declaration:small_action";
      encounter.combatRoundState = {
        ...initializeCombatRoundState({ encounter }),
        genericActions: declareCombatGenericAction({
          action: {
            createdAt: "2026-01-01T00:00:00.000Z",
            createdByUserId: "player-1",
            declarationKind: "small_action",
            duration: { kind: "gm_decided" },
            id: canonicalTaskId,
            intent: "Kick the torch aside.",
            ownerParticipantId: "encounter-participant-1",
          },
          actions: [],
        }),
      } as CombatRoundState;
      setupCombatDeclarationRoute({
        encounter,
        participants: [
          makeCombatScenarioParticipant({ characterId: "character-1", id: "participant-1" }),
          makeCombatScenarioParticipant({
            characterId: "character-2",
            controlledByUserId: "other-player",
            id: "participant-2",
          }),
        ],
      });
      await useRealItemInteractionAuthority();
      const app = await buildScenarioTestApp();

      const response = await app.inject({
        method: "POST",
        payload: declarationPayload({
          expectedItemRevision: ITEM_REVISION,
          itemId: "item-1",
          operation: "drop",
        }),
        url: "/encounters/encounter-1/combat-declaration",
      });
      await app.close();

      expect(response.statusCode, JSON.stringify(response.json())).toBe(400);
      expect(response.json()).toMatchObject({
        error:
          "This character's live Small Action names a different canonical Item interaction. Resolve or cancel it before declaring this one.",
      });
      expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    });
  });

  it("continues the participant's nonterminal Combat Task with the same ID across rounds", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const encounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const persistentTaskId = "round:1:participant:encounter-participant-1:declaration:perform_task";
    encounter.currentRound = 2;
    encounter.combatRoundState = combatRoundStateSchema.parse({
      ...initializeCombatRoundState({ encounter }),
      genericActions: declareCombatGenericAction({
        action: {
          createdAt: "2026-09-18T08:00:00.000Z",
          declarationKind: "perform_task",
          duration: { kind: "gm_decided" },
          id: persistentTaskId,
          intent: "Bar the gate.",
          ownerParticipantId: "encounter-participant-1",
        },
        actions: [],
      }),
      roundNumber: 2,
    });
    const owner = makeCombatScenarioParticipant({
      id: "participant-1",
    }) as unknown as ScenarioParticipant;
    owner.state = {
      ...owner.state,
      combat: {
        ...owner.state.combat,
        lastDeclarationIntent: {
          primaryAction: {
            actionId: "perform_task",
            description: "Bar the gate.",
            taskId: persistentTaskId,
          },
          relativePositions: [],
        },
      },
    };
    setupCombatDeclarationRoute({
      encounter,
      participants: [
        owner,
        makeCombatScenarioParticipant({
          controlledByUserId: "other-player",
          id: "participant-2",
        }),
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "perform_task",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        intent: {
          primaryAction: {
            actionId: "perform_task",
            description: "Bar the gate and brace it with the cart.",
          },
          relativePositions: [],
        },
        movementId: "hold",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.genericActions).toHaveLength(1);
    expect(updatedEncounter.combatRoundState.genericActions[0]).toMatchObject({
      id: persistentTaskId,
      intent: "Bar the gate and brace it with the cart.",
      status: "declared",
    });
    expect(updatedEncounter.combatRoundState.participants[0].declaration.intent).toMatchObject({
      primaryAction: { taskId: persistentTaskId },
    });
  });

  /**
   * Product Owner ruling of 2026-09-22 on Forgejo issue #287: a participant may have at most one
   * live Perform Task at a time, and a second one is refused until the existing task is completed,
   * cancelled or resolved. This is refusal at creation only. It is not the enforcement point —
   * `getCombatRoundOpenPerformTaskForParticipant` remains the single chokepoint that stops already
   * persisted two-live-task state from granting two primary actions.
   */
  function setupSecondPerformTaskDeclaration(input: { status: string }) {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const encounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const earlierTaskId = "round:1:participant:encounter-participant-1:declaration:perform_task";
    encounter.currentRound = 2;
    encounter.combatRoundState = combatRoundStateSchema.parse({
      ...initializeCombatRoundState({ encounter }),
      genericActions: [
        {
          createdAt: "2026-09-18T08:00:00.000Z",
          declarationKind: "perform_task",
          duration: { kind: "gm_decided" },
          id: earlierTaskId,
          intent: "Bar the gate.",
          lastUpdatedAt: "2026-09-18T08:00:00.000Z",
          ownerParticipantId: "encounter-participant-1",
          progress: { completedRounds: 0 },
          status: input.status,
          ...(input.status === "completed"
            ? {
                resolution: {
                  resolvedAt: "2026-09-18T08:05:00.000Z",
                  text: "The gate is barred.",
                  visibleToParticipantIds: [],
                },
              }
            : {}),
        },
      ],
      roundNumber: 2,
    });
    setupCombatDeclarationRoute({
      encounter,
      participants: [
        makeCombatScenarioParticipant({ id: "participant-1" }),
        makeCombatScenarioParticipant({
          controlledByUserId: "other-player",
          id: "participant-2",
        }),
      ],
    });
    return { earlierTaskId };
  }

  async function declareSecondPerformTask() {
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "perform_task",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        intent: {
          primaryAction: {
            actionId: "perform_task",
            description: "Haul the cart across the gate.",
          },
          relativePositions: [],
        },
        movementId: "hold",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();
    return response;
  }

  it("refuses a second Perform Task while the participant already holds a live one", async () => {
    for (const status of ["declared", "reviewed", "active"]) {
      vi.clearAllMocks();
      setupSecondPerformTaskDeclaration({ status });
      const response = await declareSecondPerformTask();
      expect(response.statusCode, JSON.stringify(response.json())).toBe(400);
      expect(response.json().error).toMatch(/already has a Combat Task in progress/);
      expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    }
  });

  it("accepts the next Perform Task once the earlier one is completed, cancelled or interrupted", async () => {
    for (const status of ["completed", "cancelled", "interrupted"]) {
      vi.clearAllMocks();
      const prepared = setupSecondPerformTaskDeclaration({ status });
      const response = await declareSecondPerformTask();
      expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
      const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
      const tasks = updatedEncounter.combatRoundState.genericActions;
      expect(tasks).toHaveLength(2);
      expect(tasks[0]).toMatchObject({ id: prepared.earlierTaskId, status });
      expect(tasks[1]).toMatchObject({
        id: "round:2:participant:encounter-participant-1:declaration:perform_task",
        intent: "Haul the cart across the gate.",
        status: "declared",
      });
    }
  });

  /**
   * A1b route convergence — Forgejo issue #311.
   *
   * The parallel generic-action route stops being a second way to create and drive a Perform Task,
   * and Combat Task identity becomes server-owned. Both halves matter: a caller could mint an
   * arbitrary action id through `POST .../generic-actions` with `operation: "declare"`, then name
   * that action as its Perform Task in the declaration intent's `taskId`. The declaration adopted
   * it, which skipped the one-live-task refusal — the adopted action reads as the participant's
   * existing task rather than a second one — and produced a task the canonical projection never
   * sees, because an action created outside declaration carries no `declarationKind`.
   */
  function setupA1bTaskIdentityFixture(
    input: { liveTaskStatus?: string; squatCanonicalTaskId?: boolean } = {},
  ) {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const encounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const earlierTaskId = "round:1:participant:encounter-participant-1:declaration:perform_task";
    const canonicalTaskId = "round:2:participant:encounter-participant-1:declaration:perform_task";
    encounter.currentRound = 2;
    encounter.combatRoundState = combatRoundStateSchema.parse({
      ...initializeCombatRoundState({ encounter }),
      genericActions: [
        // An action minted outside declaration. It carries no `declarationKind`, exactly like one
        // the parallel route used to create from a client-chosen id.
        {
          createdAt: "2026-09-18T07:00:00.000Z",
          duration: { kind: "round" },
          id: "client-minted-action-1",
          intent: "Anything at all.",
          lastUpdatedAt: "2026-09-18T07:00:00.000Z",
          ownerParticipantId: "encounter-participant-1",
          progress: { completedRounds: 0 },
          status: "declared",
        },
        ...(input.liveTaskStatus
          ? [
              {
                createdAt: "2026-09-18T08:00:00.000Z",
                declarationKind: "perform_task",
                duration: { kind: "gm_decided" },
                id: earlierTaskId,
                intent: "Bar the gate.",
                lastUpdatedAt: "2026-09-18T08:00:00.000Z",
                ownerParticipantId: "encounter-participant-1",
                progress: { completedRounds: 0 },
                status: input.liveTaskStatus,
              },
            ]
          : []),
        // The live collision vector: a Combat action created outside declaration — the canonical
        // Item-interaction route mints one from a fully client-supplied action id — sitting on the
        // id this round's declaration will derive for its own Perform Task.
        ...(input.squatCanonicalTaskId
          ? [
              {
                createdAt: "2026-09-18T07:30:00.000Z",
                duration: { kind: "round" },
                id: canonicalTaskId,
                intent: "An action created outside declaration.",
                lastUpdatedAt: "2026-09-18T07:30:00.000Z",
                ownerParticipantId: "encounter-participant-1",
                progress: { completedRounds: 0 },
                status: "declared",
              },
            ]
          : []),
      ],
      roundNumber: 2,
    });
    const participants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ controlledByUserId: "other-player", id: "participant-2" }),
    ];
    setupCombatDeclarationRoute({ encounter, participants });
    setupMutableCombatRouteState({
      encounter,
      participants: participants as unknown as ScenarioParticipant[],
    });
    return { canonicalTaskId, earlierTaskId, encounter, participants };
  }

  async function declarePerformTask(input: { description: string; taskId?: string }) {
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "perform_task",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        intent: {
          primaryAction: {
            actionId: "perform_task",
            description: input.description,
            ...(input.taskId ? { taskId: input.taskId } : {}),
          },
          relativePositions: [],
        },
        movementId: "hold",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();
    return response;
  }

  /**
   * A1b invariant hardening — Forgejo issue #311.
   *
   * The canonical declaration task id is fully derivable, so a Combat action created outside
   * declaration can occupy it first — `combatItemInteractionRoutes` still mints actions from a
   * fully client-supplied id, and those carry no `declarationKind`.
   * `declareCombatGenericAction` returns its input unchanged on an id that is already taken, so
   * materialization used to answer 200 having created nothing: the canonical projection never saw
   * a task, the one-live-task refusal had nothing to count, and the persisted intent named an
   * action that is not this task — which then wedged every later Perform Task declaration by that
   * participant on the carry-forward `declarationKind` check. The id is refused instead, before
   * anything is persisted.
   */
  it("refuses a declaration whose canonical Combat Task id is held by an action created outside declaration", async () => {
    const fixture = setupA1bTaskIdentityFixture({ squatCanonicalTaskId: true });

    const refused = await declarePerformTask({ description: "Haul the cart across the gate." });

    expect(refused.statusCode, JSON.stringify(refused.json())).toBe(400);
    expect(refused.json().error).toMatch(
      /Combat Task identity for this character is already held by another Combat action/,
    );
    // Nothing is persisted, so the participant cannot be wedged: no declaration intent naming a
    // non-task is written, and the occupying action is left exactly as it was.
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(
      fixture.encounter.combatRoundState!.genericActions.find(
        (action) => action.id === fixture.canonicalTaskId,
      ),
    ).toMatchObject({ intent: "An action created outside declaration.", status: "declared" });

    // The refusal repeats identically rather than escalating, and it is recoverable in this same
    // round: once the occupying action leaves canonical state the identical declaration succeeds
    // and mints the canonical Combat Task.
    const refusedAgain = await declarePerformTask({
      description: "Haul the cart across the gate.",
    });
    expect(refusedAgain.statusCode, JSON.stringify(refusedAgain.json())).toBe(400);
    expect(refusedAgain.json().error).toBe(refused.json().error);

    fixture.encounter.combatRoundState = combatRoundStateSchema.parse({
      ...fixture.encounter.combatRoundState,
      genericActions: fixture.encounter.combatRoundState!.genericActions.filter(
        (action) => action.id !== fixture.canonicalTaskId,
      ),
    });

    const accepted = await declarePerformTask({ description: "Haul the cart across the gate." });

    expect(accepted.statusCode, JSON.stringify(accepted.json())).toBe(200);
    const acceptedState =
      mocks.encounterService.updateEncounter.mock.calls.at(-1)?.[0]?.session.combatRoundState;
    expect(acceptedState.genericActions).toMatchObject([
      { id: "client-minted-action-1" },
      {
        declarationKind: "perform_task",
        id: fixture.canonicalTaskId,
        intent: "Haul the cart across the gate.",
        status: "declared",
      },
    ]);
    expect(
      getCombatRoundOpenPerformTaskForParticipant({
        participantId: "encounter-participant-1",
        phase: "phase1",
        state: acceptedState,
      }),
    ).toMatchObject({ id: fixture.canonicalTaskId });
  });

  it("refuses a declaration whose canonical Combat Task id is held by another participant's task", async () => {
    const fixture = setupA1bTaskIdentityFixture();
    fixture.encounter.combatRoundState = combatRoundStateSchema.parse({
      ...fixture.encounter.combatRoundState,
      genericActions: [
        ...fixture.encounter.combatRoundState!.genericActions,
        {
          createdAt: "2026-09-18T07:30:00.000Z",
          declarationKind: "perform_task",
          duration: { kind: "gm_decided" },
          id: fixture.canonicalTaskId,
          intent: "Somebody else's task.",
          lastUpdatedAt: "2026-09-18T07:30:00.000Z",
          ownerParticipantId: "encounter-participant-2",
          progress: { completedRounds: 0 },
          status: "declared",
        },
      ],
    });

    const response = await declarePerformTask({ description: "Haul the cart across the gate." });

    expect(response.statusCode, JSON.stringify(response.json())).toBe(400);
    expect(response.json().error).toMatch(
      /Combat Task identity for this character is already held by another Combat action/,
    );
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  /**
   * The one case where the canonical id is legitimately occupied at mint time: this participant's
   * own live declaration-owned Task of this kind, reached without carry-forward because the
   * persisted intent names a different primary action. That is this same task, so the declaration
   * updates its intent exactly as carry-forward would, instead of being silently dropped.
   */
  it("updates this participant's own live task already holding the canonical Combat Task id", async () => {
    const fixture = setupA1bTaskIdentityFixture();
    fixture.encounter.combatRoundState = combatRoundStateSchema.parse({
      ...fixture.encounter.combatRoundState,
      genericActions: [
        ...fixture.encounter.combatRoundState!.genericActions,
        {
          createdAt: "2026-09-18T07:30:00.000Z",
          declarationKind: "perform_task",
          duration: { kind: "gm_decided" },
          id: fixture.canonicalTaskId,
          intent: "Bar the gate.",
          lastUpdatedAt: "2026-09-18T07:30:00.000Z",
          ownerParticipantId: "encounter-participant-1",
          progress: { completedRounds: 0 },
          status: "declared",
        },
      ],
    });

    const response = await declarePerformTask({ description: "Haul the cart across the gate." });

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const tasks =
      mocks.encounterService.updateEncounter.mock.calls.at(-1)?.[0]?.session.combatRoundState
        .genericActions;
    expect(tasks).toHaveLength(2);
    expect(tasks[1]).toMatchObject({
      declarationKind: "perform_task",
      id: fixture.canonicalTaskId,
      intent: "Haul the cart across the gate.",
      status: "declared",
    });
  });

  it("refuses a client-supplied Combat Task id that would adopt an action created outside declaration", async () => {
    setupA1bTaskIdentityFixture({ liveTaskStatus: "declared" });

    const response = await declarePerformTask({
      description: "Haul the cart across the gate.",
      taskId: "client-minted-action-1",
    });

    expect(response.statusCode, JSON.stringify(response.json())).toBe(400);
    expect(response.json().error).toMatch(/already has a Combat Task in progress/);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("mints the server Combat Task id and ignores the client-supplied one", async () => {
    setupA1bTaskIdentityFixture();

    const response = await declarePerformTask({
      description: "Haul the cart across the gate.",
      taskId: "client-minted-action-1",
    });

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const tasks = updatedEncounter.combatRoundState.genericActions;
    expect(tasks).toHaveLength(2);
    // The named action is untouched: it is neither adopted nor given a `declarationKind`.
    expect(tasks[0]).toMatchObject({
      id: "client-minted-action-1",
      intent: "Anything at all.",
      status: "declared",
    });
    expect(tasks[0].declarationKind).toBeUndefined();
    expect(tasks[1]).toMatchObject({
      declarationKind: "perform_task",
      id: "round:2:participant:encounter-participant-1:declaration:perform_task",
      intent: "Haul the cart across the gate.",
      status: "declared",
    });
    expect(updatedEncounter.combatRoundState.participants[0].declaration.intent).toMatchObject({
      primaryAction: {
        taskId: "round:2:participant:encounter-participant-1:declaration:perform_task",
      },
    });
  });

  /**
   * The `declarationKind` legacy-projection gap, established rather than assumed. An action with
   * no `declarationKind` is invisible to `getCombatRoundOpenPerformTaskForParticipant`, so it can
   * never be projected or driven as a Perform Task, and it never blocks a declaration. It cannot
   * be reached by carry-forward either: the carried id comes only from the server's own persisted
   * declaration intent, and the carried action must match the declared kind exactly.
   */
  it("never treats an action without declarationKind as a Perform Task", async () => {
    const fixture = setupA1bTaskIdentityFixture();
    expect(
      getCombatRoundOpenPerformTaskForParticipant({
        participantId: "encounter-participant-1",
        phase: "phase1",
        state: fixture.encounter.combatRoundState!,
      }),
    ).toBeUndefined();

    const response = await declarePerformTask({ description: "Bar the gate." });

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const tasks =
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
        .genericActions;
    expect(tasks.map((task: { id: string }) => task.id)).toEqual([
      "client-minted-action-1",
      "round:2:participant:encounter-participant-1:declaration:perform_task",
    ]);
  });

  it("refuses to create a Combat action from a client-supplied id on the parallel route", async () => {
    setupA1bTaskIdentityFixture();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "client-minted-action-2",
        duration: { kind: "round" },
        expectedRevision: "2026-07-30T08:00:00.000Z",
        intent: "Mint an action of my own.",
        operation: "declare",
        participantId: "encounter-participant-1",
      },
      url: "/encounters/encounter-1/combat-round/generic-actions",
    });
    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(400);
    expect(response.json()).toEqual({
      code: "declaration_route_required",
      error: "Declare this Combat Task in the Combat declaration.",
    });
    expect(mocks.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
  });

  it.each(["review", "activate", "roll", "resolve", "interrupt", "cancel"] as const)(
    "refuses to %s a declaration-materialized Perform Task through the parallel route",
    async (operation) => {
      vi.clearAllMocks();
      const fixture = setupA1bTaskIdentityFixture({ liveTaskStatus: "active" });
      const app = await buildScenarioTestApp();

      const response = await app.inject({
        method: "POST",
        payload: {
          actionId: fixture.earlierTaskId,
          expectedRevision: fixture.encounter.updatedAt,
          operation,
          visibleToParticipantIds: [],
        },
        url: "/encounters/encounter-1/combat-round/generic-actions",
      });
      await app.close();

      expect(response.statusCode, JSON.stringify(response.json())).toBe(409);
      expect(response.json()).toEqual({
        code: "task_route_converged",
        error: "Drive this Combat Task from Current action at the actor's action opportunity.",
      });
      expect(mocks.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
    },
  );

  /**
   * Rule decision 0007 ruling 3's declaration-surface escape, proved as a full round trip: the
   * declaration is blocked, the GM cancels the live task at the declaration boundary, and the next
   * declaration succeeds with a freshly minted task id.
   */
  it("lets the GM cancel a live Combat Task from the declaration boundary and then declare a new one", async () => {
    const fixture = setupA1bTaskIdentityFixture({ liveTaskStatus: "declared" });

    const blocked = await declarePerformTask({ description: "Haul the cart across the gate." });
    expect(blocked.statusCode, JSON.stringify(blocked.json())).toBe(400);
    expect(blocked.json().error).toMatch(/already has a Combat Task in progress/);

    const membership = resolveEncounterParticipantMembership({
      encounter: fixture.encounter,
      scenarioParticipants: fixture.participants as unknown as Parameters<
        typeof resolveEncounterParticipantMembership
      >[0]["scenarioParticipants"],
    });
    const declarationTask = buildCombatProgressionProjection(
      initializeCombatRoundState({
        encounter: { ...fixture.encounter, participants: membership.participants },
      }),
    )
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.executionGroups)
      .flatMap((group) => group.tasks)
      .find(
        (task) =>
          task.expectedCommand === "declare_action" &&
          (task.identity.participantId === "encounter-participant-1" ||
            (task.owner?.kind === "combatant" &&
              task.owner.participantId === "encounter-participant-1")),
      );
    expect(
      declarationTask,
      "the declaration boundary projects a declare_action task",
    ).toBeDefined();

    const cancelApp = await buildScenarioTestApp();
    const cancelled = await cancelApp.inject({
      method: "POST",
      payload: {
        actionId: fixture.earlierTaskId,
        boundary: "declaration",
        executionGroupId: declarationTask!.executionGroupId,
        expectedRevision: fixture.encounter.updatedAt,
        finishKind: "cancel",
        processId: declarationTask!.processId,
        scenarioParticipantId: "participant-1",
        stageId: declarationTask!.stageId,
        taskId: declarationTask!.id,
        visibleToParticipantIds: [],
      },
      url: "/encounters/encounter-1/combat-round/finish-combat-task",
    });
    await cancelApp.close();

    expect(cancelled.statusCode, JSON.stringify(cancelled.json())).toBe(200);
    const cancelledState = cancelled.json().encounter.combatRoundState;
    expect(
      cancelledState.genericActions.find(
        (action: { id: string }) => action.id === fixture.earlierTaskId,
      ),
    ).toMatchObject({ status: "cancelled" });
    expect(cancelled.json().command).toMatchObject({ type: "cancel_combat_task" });
    // The escape spends no primary action and moves no cursor.
    expect(cancelledState.phaseResolutionStatuses["encounter-participant-1"]).toBeUndefined();
    expect(cancelledState.currentStep).toBe(fixture.encounter.combatRoundState!.currentStep);

    const declared = await declarePerformTask({ description: "Haul the cart across the gate." });
    expect(declared.statusCode, JSON.stringify(declared.json())).toBe(200);
    const declaredTasks =
      mocks.encounterService.updateEncounter.mock.calls.at(-1)?.[0]?.session.combatRoundState
        .genericActions;
    expect(
      declaredTasks.find((task: { id: string }) => task.id === fixture.earlierTaskId),
    ).toMatchObject({ status: "cancelled" });
    expect(
      declaredTasks.find(
        (task: { id: string }) =>
          task.id === "round:2:participant:encounter-participant-1:declaration:perform_task",
      ),
    ).toMatchObject({
      declarationKind: "perform_task",
      intent: "Haul the cart across the gate.",
      status: "declared",
    });
  });

  async function cancelPerformTaskAtDeclarationBoundary(input: { actionId: string }) {
    const currentEncounter = (await mocks.encounterService.getEncounterById()) as EncounterSession;
    const declarationTask = buildCombatProgressionProjection(currentEncounter.combatRoundState!)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.executionGroups)
      .flatMap((group) => group.tasks)
      .find(
        (task) =>
          task.expectedCommand === "declare_action" &&
          (task.identity.participantId === "encounter-participant-1" ||
            (task.owner?.kind === "combatant" &&
              task.owner.participantId === "encounter-participant-1")),
      );
    expect(
      declarationTask,
      "the declaration boundary projects a declare_action task",
    ).toBeDefined();
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: input.actionId,
        boundary: "declaration",
        executionGroupId: declarationTask!.executionGroupId,
        expectedRevision: currentEncounter.updatedAt,
        finishKind: "cancel",
        processId: declarationTask!.processId,
        scenarioParticipantId: "participant-1",
        stageId: declarationTask!.stageId,
        taskId: declarationTask!.id,
        visibleToParticipantIds: [],
      },
      url: "/encounters/encounter-1/combat-round/finish-combat-task",
    });
    await app.close();
    return response;
  }

  /**
   * A1b in-round escape hatch — Forgejo issue #311.
   *
   * Rule decision 0007 ruling 3 requires a declaration-surface cancellation *"since the current
   * hard block otherwise leaves no verified declaration-surface escape"*. The cancel worked across
   * rounds but not inside one: the canonical id
   * `round:<N>:participant:<pid>:declaration:perform_task` is minted once per round per participant
   * per kind, so after cancelling the live Task in round N the **terminal** task still held that id.
   * Re-declaring in round N derived the same taken id and fell through to
   * `declareCombatGenericAction`, which returns its input unchanged on a taken id — the declaration
   * answered **200 with no live task**. The submitter saw their typed intent accepted and had
   * nothing at their opportunity, and the escape the ruling ordered was unavailable in the one
   * round it is needed.
   *
   * The replacement is minted under a distinct server-owned id derived from the canonical one. The
   * primary opportunity is spent by neither the cancel nor the replacement.
   */
  it("lets a participant cancel this round's canonical Combat Task and declare a replacement in the same round", async () => {
    const fixture = setupA1bTaskIdentityFixture();
    const baselineState = fixture.encounter.combatRoundState!;

    const firstDeclaration = await declarePerformTask({ description: "Bar the gate." });
    expect(firstDeclaration.statusCode, JSON.stringify(firstDeclaration.json())).toBe(200);
    const declaredState =
      mocks.encounterService.updateEncounter.mock.calls.at(-1)?.[0]?.session.combatRoundState;
    expect(
      getCombatRoundOpenPerformTaskForParticipant({
        participantId: "encounter-participant-1",
        phase: "phase1",
        state: declaredState,
      }),
    ).toMatchObject({ id: fixture.canonicalTaskId, intent: "Bar the gate." });

    const cancelled = await cancelPerformTaskAtDeclarationBoundary({
      actionId: fixture.canonicalTaskId,
    });
    expect(cancelled.statusCode, JSON.stringify(cancelled.json())).toBe(200);
    const cancelledState = cancelled.json().encounter.combatRoundState;
    expect(
      cancelledState.genericActions.find(
        (action: { id: string }) => action.id === fixture.canonicalTaskId,
      ),
    ).toMatchObject({ status: "cancelled" });
    expect(
      getCombatRoundOpenPerformTaskForParticipant({
        participantId: "encounter-participant-1",
        phase: "phase1",
        state: cancelledState,
      }),
      "the cancelled task is no longer projected",
    ).toBeUndefined();

    const replacement = await declarePerformTask({
      description: "Haul the cart across the gate.",
    });
    expect(replacement.statusCode, JSON.stringify(replacement.json())).toBe(200);
    const replacementState =
      mocks.encounterService.updateEncounter.mock.calls.at(-1)?.[0]?.session.combatRoundState;
    const live = getCombatRoundOpenPerformTaskForParticipant({
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: replacementState,
    });
    expect(
      live,
      "the replacement declaration produces a live, canonically projected Perform Task",
    ).toMatchObject({
      declarationKind: "perform_task",
      intent: "Haul the cart across the gate.",
      ownerParticipantId: "encounter-participant-1",
      status: "declared",
    });
    expect(live!.id).not.toBe(fixture.canonicalTaskId);
    expect(live!.id.startsWith(`${fixture.canonicalTaskId}:`)).toBe(true);

    // Exactly one live Perform Task: the replacement never doubles the primary action.
    expect(
      replacementState.genericActions.filter(
        (action: { declarationKind?: string; ownerParticipantId: string; status: string }) =>
          action.declarationKind === "perform_task" &&
          action.ownerParticipantId === "encounter-participant-1" &&
          !["cancelled", "completed", "interrupted"].includes(action.status),
      ),
    ).toHaveLength(1);

    // The persisted intent addresses the replacement id, so cross-round carry-forward resolves it.
    const persistedIntent =
      mocks.encounterService.updateScenarioParticipantState.mock.calls.at(-1)?.[0]?.state.combat
        .lastDeclarationIntent;
    expect(persistedIntent.primaryAction.taskId).toBe(live!.id);

    // The primary opportunity is consumed by neither the cancel nor the replacement.
    for (const state of [declaredState, cancelledState, replacementState]) {
      expect(state.phaseResolutionStatuses["encounter-participant-1"]?.phase1).toBeUndefined();
      expect(state.phaseResolutionStatuses["encounter-participant-1"]?.phase2).toBeUndefined();
      expect(state.phaseResolutionCursor).toEqual(baselineState.phaseResolutionCursor);
      expect(state.currentStep).toBe(baselineState.currentStep);
      expect(
        state.participants.find(
          (participant: { participantId: string }) =>
            participant.participantId === "encounter-participant-1",
        ).stepStatuses.phase_1_actions,
      ).toEqual(
        baselineState.participants.find(
          (participant) => participant.participantId === "encounter-participant-1",
        )!.stepStatuses.phase_1_actions,
      );
    }
    // The cancel itself is cursor-neutral: it changes the task and nothing else.
    expect(cancelledState.currentCursor).toEqual(declaredState.currentCursor);
    expect(cancelledState.selectedStep).toBe(declaredState.selectedStep);
    expect(cancelledState.selectedParticipantId).toBe(declaredState.selectedParticipantId);
  });

  /**
   * The in-round replacement mint sits **behind** the one-live-task refusal, so it can never be
   * used to obtain two live primary actions: a terminal occupant of the canonical id does not
   * excuse a different live Perform Task the participant still holds.
   */
  it("still refuses a replacement declaration while another live Combat Task is held", async () => {
    const fixture = setupA1bTaskIdentityFixture({ liveTaskStatus: "declared" });
    fixture.encounter.combatRoundState = combatRoundStateSchema.parse({
      ...fixture.encounter.combatRoundState,
      genericActions: [
        ...fixture.encounter.combatRoundState!.genericActions,
        {
          createdAt: "2026-09-18T07:30:00.000Z",
          declarationKind: "perform_task",
          duration: { kind: "gm_decided" },
          id: fixture.canonicalTaskId,
          intent: "Already cancelled.",
          lastUpdatedAt: "2026-09-18T07:30:00.000Z",
          ownerParticipantId: "encounter-participant-1",
          progress: { completedRounds: 0 },
          status: "cancelled",
        },
      ],
    });

    const response = await declarePerformTask({ description: "Haul the cart across the gate." });

    expect(response.statusCode, JSON.stringify(response.json())).toBe(400);
    expect(response.json().error).toMatch(/already has a Combat Task in progress/);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  /**
   * The collision hardening is unchanged by the in-round replacement: an occupant of the canonical
   * id that is not this participant's own declaration-owned action **of this kind** is still
   * refused with zero persistence, terminal or not.
   */
  it.each([
    ["a wrong-declarationKind occupant", { declarationKind: "small_action" as const }],
    ["a wrong-owner occupant", { ownerParticipantId: "encounter-participant-2" }],
  ])(
    "refuses %s of the canonical Combat Task id even when it is terminal",
    async (_label, overrides) => {
      const fixture = setupA1bTaskIdentityFixture();
      fixture.encounter.combatRoundState = combatRoundStateSchema.parse({
        ...fixture.encounter.combatRoundState,
        genericActions: [
          ...fixture.encounter.combatRoundState!.genericActions,
          {
            createdAt: "2026-09-18T07:30:00.000Z",
            declarationKind: "perform_task",
            duration: { kind: "gm_decided" },
            id: fixture.canonicalTaskId,
            intent: "Not this participant's Task of this kind.",
            lastUpdatedAt: "2026-09-18T07:30:00.000Z",
            ownerParticipantId: "encounter-participant-1",
            progress: { completedRounds: 0 },
            status: "cancelled",
            ...overrides,
          },
        ],
      });

      const response = await declarePerformTask({ description: "Haul the cart across the gate." });

      expect(response.statusCode, JSON.stringify(response.json())).toBe(400);
      expect(response.json().error).toMatch(
        /Combat Task identity for this character is already held by another Combat action/,
      );
      expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
      expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["close", 1],
    ["open", 3],
  ] as const)(
    "lets Move only declare visible participant-relative %s through pair-distance intent",
    async (operation, desiredDistance) => {
      const encounterParticipants = makeTwoCombatEncounterParticipants();
      const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
        participants: encounterParticipants,
      }) as EncounterSession;
      const baseRoundState = initializeCombatRoundState({ encounter: baseEncounter });
      const roundState = {
        ...baseRoundState,
        distanceState: setDistanceBetween({
          distance: 2,
          participantAId: "encounter-participant-1",
          participantBId: "encounter-participant-2",
          source: "gm_set",
          state: baseRoundState.distanceState,
        }),
      };
      setupCombatDeclarationRoute({
        encounter: { combatRoundState: roundState, participants: encounterParticipants },
        participants: [
          makeCombatScenarioParticipant({ id: "participant-1" }),
          makeCombatScenarioParticipant({
            controlledByUserId: "other-player",
            id: "participant-2",
          }),
        ],
      });
      const app = await buildScenarioTestApp();

      const response = await app.inject({
        method: "POST",
        payload: {
          actionId: "move_only",
          combatContext: { modifierBuckets: emptyModifierBuckets() },
          movementIntent: {
            distancePreferences: [
              {
                desiredDistance,
                operation,
                source: "player_declared",
                targetParticipantId: "participant-2",
              },
            ],
            mode: "set_distance_preferences",
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });
      await app.close();

      expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
      const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
      expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
        actionId: "move_only",
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance,
              operation,
              source: "player_declared",
              targetParticipantId: "participant-2",
            },
          ],
          mode: "set_distance_preferences",
        },
      });
      expect(
        getDistanceBetween(
          updatedEncounter.combatRoundState.distanceState,
          "encounter-participant-1",
          "encounter-participant-2",
        ),
      ).toBe(2);
    },
  );

  it("creates a reviewed-action seam for environmental movement without changing pair distance", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const baseRoundState = initializeCombatRoundState({ encounter: baseEncounter });
    const roundState = {
      ...baseRoundState,
      distanceState: setDistanceBetween({
        distance: 2,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
        source: "gm_set",
        state: baseRoundState.distanceState,
      }),
    };
    setupCombatDeclarationRoute({
      encounter: { combatRoundState: roundState, participants: encounterParticipants },
      participants: [
        makeCombatScenarioParticipant({ id: "participant-1" }),
        makeCombatScenarioParticipant({
          controlledByUserId: "other-player",
          id: "participant-2",
        }),
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "move_only",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        movementIntent: {
          environmentalMovement: {
            destination: { description: "doorway", kind: "description" },
            duration: { kind: "rounds", rounds: 3 },
            pace: "walk",
          },
          mode: "move_in_environment",
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "move_only",
      movementIntent: {
        distancePreferences: [],
        environmentalMovement: {
          actionId:
            "round:1:participant:encounter-participant-1:declaration:environmental-movement",
          destination: { description: "doorway", kind: "description" },
          duration: { kind: "rounds", rounds: 3 },
          pace: "walk",
        },
        mode: "move_in_environment",
      },
    });
    expect(updatedEncounter.combatRoundState.genericActions).toMatchObject([
      {
        duration: { kind: "rounds", rounds: 3 },
        intent: "Walk to doorway.",
        ownerParticipantId: "encounter-participant-1",
        preset: "environmental_movement",
        reference: { description: "doorway", kind: "environment" },
        status: "declared",
      },
    ]);
    expect(
      getDistanceBetween(
        updatedEncounter.combatRoundState.distanceState,
        "encounter-participant-1",
        "encounter-participant-2",
      ),
    ).toBe(2);
  });

  it("makes hidden and nonexistent relative-movement targets indistinguishable without mutation", async () => {
    const encounterParticipants = [
      makeEncounterCombatParticipant({
        id: "encounter-participant-1",
        label: "The Gladiator",
        order: 0,
        scenarioParticipantId: "participant-1",
      }),
      makeEncounterCombatParticipant({
        id: "encounter-participant-visible",
        label: "Visible guard",
        order: 1,
        scenarioParticipantId: "participant-visible",
      }),
      makeEncounterCombatParticipant({
        id: "encounter-participant-hidden",
        label: "Hidden spy",
        order: 2,
        scenarioParticipantId: "participant-hidden",
      }),
    ];
    const encounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
      roleplayState: {
        visibility: {
          "encounter-participant-1": { "encounter-participant-visible": true },
        },
      },
    }) as EncounterSession;
    setupCombatDeclarationRoute({
      encounter,
      participants: [
        makeCombatScenarioParticipant({ id: "participant-1" }),
        makeCombatScenarioParticipant({
          controlledByUserId: "other-player",
          id: "participant-visible",
        }),
        makeCombatScenarioParticipant({
          controlledByUserId: "other-player",
          id: "participant-hidden",
        }),
      ],
    });
    const genericActionsBefore = structuredClone(encounter.combatRoundState?.genericActions ?? []);
    const app = await buildScenarioTestApp();
    const responses = [];
    for (const targetParticipantId of [
      "encounter-participant-hidden",
      "participant-does-not-exist",
    ]) {
      responses.push(
        await app.inject({
          method: "POST",
          payload: {
            actionId: "move_only",
            combatContext: { modifierBuckets: emptyModifierBuckets() },
            movementIntent: {
              distancePreferences: [
                {
                  desiredDistance: 1,
                  source: "player_declared",
                  targetParticipantId,
                },
              ],
              mode: "set_distance_preferences",
            },
            scenarioParticipantId: "participant-1",
          },
          url: "/encounters/encounter-1/combat-declaration",
        }),
      );
    }
    await app.close();

    expect(responses).toHaveLength(2);
    for (const response of responses) {
      expect(response.statusCode).toBe(400);
      expect(response.body).toBe('{"error":"Distance preference target is unavailable."}');
      expect(response.body).not.toContain("Hidden spy");
      expect(response.body).not.toContain("encounter-participant-hidden");
      expect(response.body).not.toContain("participant-does-not-exist");
    }
    expect(responses[0]?.statusCode).toBe(responses[1]?.statusCode);
    expect(responses[0]?.body).toBe(responses[1]?.body);
    expect(mocks.encounterService.commitCombatParticipantStateMutation).not.toHaveBeenCalled();
    expect(mocks.encounterService.commitCombatParticipantStateMutations).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.scenarioService.recordScenarioEvent).not.toHaveBeenCalled();
    expect(encounter.combatRoundState?.genericActions ?? []).toEqual(genericActionsBefore);
  });

  it("generates a declaration-time distance Skill/OB row for an out-of-range attack", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const roundState = {
      ...initializeCombatRoundState({ encounter: baseEncounter }),
      distanceState: setDistanceBetween({
        distance: 3,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
        source: "gm_set",
      }),
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        participants: encounterParticipants,
      },
      participants: [
        makeCombatScenarioParticipantWithWeapon({
          id: "participant-1",
          weaponName: "Broad sword",
          weaponRange: "2.0",
        }),
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
        },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId: "item-weapon-template-broad-sword",
            opportunitySlot: "attack_1",
            templateId: "weapon-template-broad-sword",
          }),
        },
        phaseWeaponNames: {
          phase1: "Broad sword",
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const distanceRows =
      updateStateCall.state.combat.combatContext.modifierBuckets.situationObSkill;
    const dbRows = updateStateCall.state.combat.combatContext.modifierBuckets.situationDb;
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;

    expect(dbRows).toEqual([attackParryDbParryModifier]);
    expect(distanceRows).toEqual([
      expect.objectContaining({
        generated: true,
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining("distance: Broad sword preferred 2"),
        sourcePhase: "phase1",
        sourceRule: "distance-ob-skill-phase1",
        value: -2,
      }),
    ]);
    expect(
      updatedEncounter.combatRoundState.participants[0].declaration.combatContext.modifierBuckets
        .situationObSkill,
    ).toEqual([expect.objectContaining({ id: "generated:distance:phase1:ob-skill", value: -2 })]);
  });

  it("uses Single attack declared farther distance for the declaration-time Skill/OB row", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const roundState = {
      ...initializeCombatRoundState({ encounter: baseEncounter }),
      distanceState: setDistanceBetween({
        distance: 2,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
        source: "gm_set",
      }),
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        participants: encounterParticipants,
      },
      participants: [
        makeCombatScenarioParticipantWithWeapon({
          id: "participant-1",
          weaponName: "Broad sword",
          weaponRange: "2.0",
        }),
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementIntent: {
          distancePreferences: [
            {
              desiredDistance: 4,
              source: "player_declared",
              targetParticipantId: "participant-2",
            },
          ],
          mode: "set_distance_preferences",
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
        },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId: "item-weapon-template-broad-sword",
            opportunitySlot: "attack_1",
            templateId: "weapon-template-broad-sword",
          }),
        },
        phaseWeaponNames: {
          phase1: "Broad sword",
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const distanceRows =
      updateStateCall.state.combat.combatContext.modifierBuckets.situationObSkill;

    expect(distanceRows).toEqual([
      expect.objectContaining({
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining("declared 4"),
        value: -4,
      }),
    ]);
  });

  it("generates Scyrian's Broad sword distance row when the browser submits a scenario target id", async () => {
    const encounterParticipants = [
      {
        ...makeCombatEncounter().participants[0],
        characterId: "character-gladiator",
        id: "gladiator",
        label: "The Gladiator",
        scenarioParticipantId: "scenario-gladiator",
      },
      {
        ...makeCombatEncounter().participants[0],
        characterId: "character-scyrian",
        id: "scyrian",
        label: "Scyrian cavalry guy",
        scenarioParticipantId: "scenario-scyrian",
      },
    ];
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const roundState = {
      ...initializeCombatRoundState({ encounter: baseEncounter }),
      distanceState: setDistanceBetween({
        distance: 3,
        participantAId: "gladiator",
        participantBId: "scyrian",
        source: "gm_set",
      }),
    };
    const scyrianParticipant = makeCombatScenarioParticipant({
      characterId: "character-scyrian",
      controlledByUserId: "other-player",
      id: "scenario-scyrian",
      role: "non_player_character",
      snapshot: {
        displayName: "Scyrian cavalry guy",
        equipmentState: makeServerWeaponEquipmentState({
          characterId: "character-scyrian",
          name: "Broad sword",
          range: "2.0",
        }),
      },
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        participants: encounterParticipants,
      },
      participant: scyrianParticipant,
      participants: [
        makeCombatScenarioParticipant({
          characterId: "character-gladiator",
          id: "scenario-gladiator",
          snapshot: {
            displayName: "The Gladiator",
          },
        }),
        scyrianParticipant,
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "scenario-gladiator",
          },
        },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId: "item-weapon-template-broad-sword",
            opportunitySlot: "attack_1",
            templateId: "weapon-template-broad-sword",
          }),
        },
        phaseWeaponNames: {
          phase1: "Broad sword",
        },
        scenarioParticipantId: "scenario-scyrian",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const persistedCombatContext = updateStateCall.state.combat.combatContext;
    const persistedDeclaration = updatedEncounter.combatRoundState.participants[1].declaration;

    expect(updateStateCall).toMatchObject({
      participantId: "scenario-scyrian",
    });
    expect(persistedDeclaration.phaseContexts.phase1.targetParticipantId).toBe(
      "scenario-gladiator",
    );
    expect(persistedCombatContext.modifierBuckets.situationDb).toEqual([
      attackParryDbParryModifier,
    ]);
    expect(persistedCombatContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        generated: true,
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining(
          "distance: Broad sword preferred 2 · actual 3 · nearest 2 · Skill/OB -2",
        ),
        sourcePhase: "phase1",
        sourceRule: "distance-ob-skill-phase1",
        value: -2,
      }),
    ]);
    expect(persistedDeclaration.combatContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({ id: "generated:distance:phase1:ob-skill", value: -2 }),
    ]);
  });

  it("materializes default distance before declaration so no matrix save is required", async () => {
    const encounterParticipants = [
      {
        ...makeCombatEncounter().participants[0],
        characterId: "character-gladiator",
        id: "gladiator",
        label: "The Gladiator",
        scenarioParticipantId: "scenario-gladiator",
      },
      {
        ...makeCombatEncounter().participants[0],
        characterId: "character-scyrian",
        id: "scyrian",
        label: "Scyrian cavalry guy",
        scenarioParticipantId: "scenario-scyrian",
      },
    ];
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const scyrianParticipant = makeCombatScenarioParticipant({
      characterId: "character-scyrian",
      controlledByUserId: "other-player",
      id: "scenario-scyrian",
      role: "non_player_character",
      snapshot: {
        displayName: "Scyrian cavalry guy",
        equipmentState: makeServerWeaponEquipmentState({
          characterId: "character-scyrian",
          name: "Broad sword",
          range: "2.0",
        }),
      },
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: baseEncounter.combatRoundState,
        participants: encounterParticipants,
      },
      participant: scyrianParticipant,
      participants: [
        makeCombatScenarioParticipant({
          characterId: "character-gladiator",
          id: "scenario-gladiator",
          snapshot: {
            displayName: "The Gladiator",
            equipmentState: makeServerWeaponEquipmentState({
              characterId: "character-gladiator",
              name: "Long sword",
              range: "3.0",
            }),
          },
        }),
        scyrianParticipant,
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "scenario-gladiator",
          },
        },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId: "item-weapon-template-broad-sword",
            opportunitySlot: "attack_1",
            templateId: "weapon-template-broad-sword",
          }),
        },
        phaseWeaponNames: {
          phase1: "Broad sword",
        },
        scenarioParticipantId: "scenario-scyrian",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const pairKey = makeDistancePairKey("gladiator", "scyrian");
    const materializedEdge = updatedEncounter.combatRoundState.distanceState.edges[pairKey];

    expect(materializedEdge).toMatchObject({
      distance: 3,
      source: "default_weapon_reach",
    });
    expect(materializedEdge.notes).toBeUndefined();
    expect(
      getDistanceBetween(updatedEncounter.combatRoundState.distanceState, "gladiator", "scyrian"),
    ).toBe(3);
    expect(updateStateCall.state.combat.combatContext.modifierBuckets.situationDb).toEqual([
      attackParryDbParryModifier,
    ]);
    expect(updateStateCall.state.combat.combatContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        generated: true,
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining(
          "distance: Broad sword preferred 2 · actual 3 · nearest 2 · Skill/OB -2",
        ),
        value: -2,
      }),
    ]);
    expect(
      updatedEncounter.combatRoundState.participants[1].declaration.combatContext.modifierBuckets
        .situationObSkill,
    ).toEqual([expect.objectContaining({ id: "generated:distance:phase1:ob-skill", value: -2 })]);
  });

  it("allows a player to complete an incomplete submitted combat declaration during DE", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "select_actions",
          participants: [
            {
              attackResults: {},
              declaration: {
                actionId: "attack_parry",
                movementId: "hold",
                roundNumber: 1,
                submittedAt: "2026-01-01T00:01:00.000Z",
                submittedBy: "player",
                submittedByUserId: "player-1",
              },
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "attack_parry",
      phaseContexts: {
        phase1: expect.objectContaining({
          targetParticipantId: "encounter-target-1",
        }),
      },
      submittedBy: "player",
    });
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "submitted",
    );
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      createdByUserId: "player-1",
      participantId: "encounter-participant-1",
      type: "declare_action",
    });
  });

  it("records a GM declare_action command during DE", async () => {
    setupCombatDeclarationRoute({
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(1);
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "DE",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        roundNumber: 1,
        step: "DE",
      },
      createdByUserId: "gm-1",
      participantId: "encounter-participant-1",
      type: "declare_action",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
  });

  it("allows a GM to roll combat-start Combat Experience and creates a General modifier row", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 10,
                  linkedStatAverage: 0,
                  skillId: "combat_experience",
                  totalSkill: 10,
                },
              ],
            },
          },
        },
      },
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 26,
      difficultyShift: 5,
      durationRounds: 4,
      effectiveTableTotal: 10,
      finalTotal: 15,
      modifierValue: -2,
      resultBand: "passive",
      rollD20: 5,
      skillTotal: 10,
      trigger: "combat_start",
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].combatExperience).toMatchObject({
      durationRounds: 4,
      effectiveTableTotal: 10,
      modifierValue: -2,
      resultBand: "passive",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        difficulty: 26,
        difficultyShift: 5,
        effectiveTableTotal: 10,
        modifierValue: -2,
        skillTotal: 10,
      }),
      participantId: "encounter-participant-1",
      type: "roll_combat_experience",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combatEffects: expect.objectContaining({
            effects: [
              expect.objectContaining({
                description: "combat exp passive",
                duration: "4 rounds",
                effectGroup: "general",
                modifierValue: -2,
                type: "general_modifier",
              }),
            ],
          }),
        }),
      }),
    );
  });

  it("applies a GM-set Combat Experience difficulty to the outcome", async () => {
    setupCombatDeclarationRoute({
      combatExperienceDifficulty: 36,
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 19,
                  linkedStatAverage: 0,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                  totalSkill: 19,
                },
              ],
            },
          },
        },
      },
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.36);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 36,
      difficultyShift: 15,
      durationRounds: 2,
      effectiveTableTotal: 12,
      finalTotal: 27,
      modifierValue: -2,
      resultBand: "active_penalty",
      rollD20: 8,
      rollTotal: 8,
      skillTotal: 19,
      trigger: "combat_start",
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        difficulty: 36,
        difficultyShift: 15,
        effectiveTableTotal: 12,
        finalTotal: 27,
        modifierValue: -2,
        resultBand: "active_penalty",
      }),
      participantId: "encounter-participant-1",
      type: "roll_combat_experience",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combatEffects: expect.objectContaining({
            effects: [
              expect.objectContaining({
                description: "combat exp active -2",
                duration: "2 rounds",
                effectGroup: "general",
                modifierValue: -2,
                type: "general_modifier",
              }),
            ],
          }),
        }),
      }),
    );
  });

  it("lets a player roll their own combat-start Combat Experience using the displayed total", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 7,
                  linkedStatAverage: 14,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                  totalSkill: 21,
                },
              ],
            },
          },
        },
      },
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 26,
      effectiveTableTotal: 21,
      finalTotal: 26,
      rollD20: 5,
      skillTotal: 21,
      skillTotalSource: "participant.snapshot.sheetSummary.draftView.skills.totalSkill",
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      createdByUserId: "player-1",
      participantId: "encounter-participant-1",
      type: "roll_combat_experience",
    });
  });

  it("rejects player Combat Experience rolls before the GM opens CE rolls", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 10,
                  linkedStatAverage: 0,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                  totalSkill: 10,
                },
              ],
            },
          },
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(409);
    expect(response.json()).toMatchObject({
      error: "Combat Experience rolls are not open. Set Combat Experience difficulty first.",
    });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("rejects player Combat Experience rolls for another participant", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      encounter: {
        participants: encounterParticipants,
      },
      participants: [
        makeCombatScenarioParticipant({ id: "participant-1" }),
        makeCombatScenarioParticipant({
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: {
            displayName: "City guard",
            sheetSummary: {
              draftView: {
                skills: [
                  {
                    effectiveSkillNumber: 10,
                    linkedStatAverage: 0,
                    skillId: "combat_experience",
                    totalSkill: 10,
                  },
                ],
              },
            },
          },
        }),
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("lets a player roll their own round-end distance-control requirement", async () => {
    const fixture = makeDistanceControlReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        distanceProposalId: fixture.proposalId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-distance-control",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const proposal = updatedEncounter.combatRoundState.roundEndReview.proposedDistances[0];
    expect(proposal).toMatchObject({
      status: "pending_rolls",
      winnerParticipantId: undefined,
    });
    expect(proposal.participantA).toMatchObject({
      result: expect.objectContaining({
        finalTotal: 21,
        rolledBy: "player",
        rolledByUserId: "player-1",
        skillContestCalculation: expect.objectContaining({
          baseSkill: 18,
          governingStat: expect.objectContaining({ value: 10 }),
          skill: expect.objectContaining({ totalXp: 8 }),
          movementBurden: expect.objectContaining({
            completeness: "complete",
            finalMovementModifier: 1,
          }),
          percentageContributions: [
            expect.objectContaining({ category: "movement_mm", value: -1 }),
          ],
        }),
      }),
      status: "rolled",
    });
    expect(proposal.participantB).toMatchObject({
      status: "pending",
    });
    expect(proposal.participantB.result).toBeUndefined();
    const responseProposal =
      response.json().encounter.combatRoundState.roundEndReview.proposedDistances[0];
    expect(responseProposal.participantA).toMatchObject({
      desiredDistance: 3,
      result: expect.objectContaining({
        finalTotal: 21,
        rolledBy: "player",
      }),
      status: "rolled",
    });
    expect(responseProposal.participantB).toMatchObject({
      participantId: "encounter-participant-2",
      status: "pending",
    });
    expect(responseProposal.participantB.desiredDistance).toBeUndefined();
    expect(responseProposal.participantB.result).toBeUndefined();
    expect(response.json().command.facts.nextProposal.participantB.desiredDistance).toBeUndefined();
  });

  it("rejects player round-end distance-control rolls for another participant", async () => {
    const fixture = makeDistanceControlReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        distanceProposalId: fixture.proposalId,
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/roll-distance-control",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("lets a GM proxy each round-end distance-control side and computes the proposal after both rolls", async () => {
    const fixture = makeDistanceControlReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const firstResponse = await app.inject({
      method: "POST",
      payload: {
        distanceProposalId: fixture.proposalId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-distance-control",
    });
    const firstUpdatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]
      ?.session as EncounterSession;
    mocks.encounterService.getEncounterById.mockResolvedValue(firstUpdatedEncounter);
    randomSpy.mockReturnValue(0.1);
    const secondResponse = await app.inject({
      method: "POST",
      payload: {
        distanceProposalId: fixture.proposalId,
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/roll-distance-control",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(firstResponse.statusCode).toBe(200);
    expect(secondResponse.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[1]?.[0]?.session;
    const proposal = updatedEncounter.combatRoundState.roundEndReview.proposedDistances[0];
    expect(proposal).toMatchObject({
      outcome: "participant_a_wins",
      proposedDistance: 3,
      status: "rolled",
      winnerParticipantId: "encounter-participant-1",
    });
    expect(proposal.participantA.result).toMatchObject({
      rolledBy: "gm_proxy",
      rolledByUserId: "gm-1",
      skillContestCalculation: expect.objectContaining({
        movementBurden: expect.objectContaining({ finalMovementModifier: 1 }),
        percentageContributions: [expect.objectContaining({ category: "movement_mm", value: -1 })],
      }),
    });
    expect(proposal.participantB.result).toMatchObject({
      rolledBy: "gm_proxy",
      rolledByUserId: "gm-1",
      skillContestCalculation: expect.objectContaining({
        movementBurden: expect.objectContaining({ finalMovementModifier: 1 }),
        percentageContributions: [expect.objectContaining({ category: "movement_mm", value: -1 })],
      }),
    });
  });

  it("rolls contiguous GM distance checks once and stops at manual distance review", async () => {
    const prepared = makeDistanceControlReviewFixture();
    const participants = prepared.participants.map((participant) =>
      scenarioParticipantSchema.parse({
        ...participant,
        controlledByUserId: undefined,
        createdAt: participant.updatedAt,
        joinSource: "gm_added",
      }),
    );
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants,
      user: mocks.adminUser,
    });
    const payload = stepAutomationRequest({
      encounter: prepared.encounter,
      operationFamily: "roll_remaining",
      participants,
      runId: "distance-roll-complete-run",
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();
    try {
      const response = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().workflow).toMatchObject({
        identity: { startProcessFamily: "ordinary_distance_roll" },
        processedCount: 2,
        stepComplete: true,
        stopReason: "distance_review_required",
      });
      const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
      expect(
        state.commands.filter((command) => command.type === "roll_round_end_distance_control"),
      ).toHaveLength(2);
      expect(state.roundEndReview?.proposedDistances[0]).toMatchObject({ status: "rolled" });
      expect(state.roundEndReview?.proposedDistances[0]?.appliedDistance).toBeUndefined();
      expect(state.distanceState.edges).toEqual(
        combatRoundStateSchema.parse(prepared.encounter.combatRoundState).distanceState.edges,
      );

      const commandCount = state.commands.length;
      const retry = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(retry.statusCode, retry.body).toBe(200);
      expect(retry.json().workflow).toMatchObject({
        alreadyAccepted: true,
        processedCount: 2,
        stopReason: "distance_review_required",
      });
      expect(
        combatRoundStateSchema.parse(fixture.encounter.combatRoundState).commands,
      ).toHaveLength(commandCount);
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("stops before a compatibility-fallback distance calculation without rolling", async () => {
    const prepared = makeDistanceControlReviewFixture();
    const state = combatRoundStateSchema.parse(prepared.encounter.combatRoundState);
    const proposal = state.roundEndReview!.proposedDistances[0]!;
    const fallbackState = combatRoundStateSchema.parse({
      ...state,
      roundEndReview: {
        ...state.roundEndReview,
        proposedDistances: [
          {
            ...proposal,
            currentDistanceSource: "compatibility_fallback",
            warnings: ["Current distance was unavailable; using 2 for this review."],
          },
        ],
      },
    });
    const encounter = { ...prepared.encounter, combatRoundState: fallbackState };
    const participants = prepared.participants.map((participant) =>
      scenarioParticipantSchema.parse({
        ...participant,
        controlledByUserId: undefined,
        createdAt: participant.updatedAt,
        joinSource: "gm_added",
      }),
    );
    const fixture = setupMutableCombatRouteState({
      encounter,
      participants,
      user: mocks.adminUser,
    });
    const payload = stepAutomationRequest({
      encounter,
      operationFamily: "roll_remaining",
      participants,
      runId: "distance-fallback-blocked-run",
    });
    const app = await buildScenarioTestApp();
    try {
      const response = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().workflow).toMatchObject({
        processedCount: 0,
        stepComplete: false,
        stopReason: "distance_calculation_review_required",
      });
      expect(
        combatRoundStateSchema
          .parse(fixture.encounter.combatRoundState)
          .commands.filter((command) => command.type === "roll_round_end_distance_control"),
      ).toHaveLength(0);
    } finally {
      await app.close();
    }
  });

  it("authorizes the projected GM distance commit through the round-end command route", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const rolledState = rollDistanceControlFixtureBothSides({
      encounter: fixture.encounter,
      proposalId: fixture.proposalId,
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: rolledState,
        currentRound: rolledState.roundNumber,
      },
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: { distanceProposalId: fixture.proposalId },
      url: "/encounters/encounter-1/combat-round/commit-distance-control",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("commandEnvelope");
    expect(
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
        .roundEndReview.proposedDistances[0],
    ).toMatchObject({ status: "committed" });
  });

  it("lets the Continued Contact controller choose engagement distance without an opposing roll", async () => {
    const fixture = makeContinuedContactDistanceChoiceFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        chosenDistance: 2,
        distanceProposalId: fixture.proposalId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/commit-distance-control",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      participant: { id: "participant-1" },
    });
    expect(response.json()).not.toHaveProperty("commandEnvelope");
    const updatedState =
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState;
    expect(updatedState.roundEndReview.proposedDistances[0]).toMatchObject({
      appliedDistance: 2,
      chosenDistance: 2,
      controlMode: "continued_contact",
      controllerParticipantId: "encounter-participant-1",
      reason: "continued_contact",
      status: "committed",
    });
    expect(updatedState.roundEndReview.proposedDistances[0].participantA.result).toBeUndefined();
    expect(updatedState.roundEndReview.proposedDistances[0].participantB.result).toBeUndefined();
    expect(
      getDistanceBetween(
        updatedState.distanceState,
        "encounter-participant-1",
        "encounter-participant-2",
      ),
    ).toBe(2);
  });

  it("rejects a Continued Contact engagement-distance choice from the affected opponent", async () => {
    const fixture = makeContinuedContactDistanceChoiceFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        chosenDistance: 2,
        distanceProposalId: fixture.proposalId,
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/commit-distance-control",
    });
    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("lets the GM proxy both Continued Contact maintenance rolls and expires Unbalanced on escape", async () => {
    const fixture = makeContinuedContactMaintenanceFixture();
    const mutable = setupMutableCombatRouteState({
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const controllerResponse = await app.inject({
      method: "POST",
      payload: {
        contestId: fixture.contestId,
        opponentParticipantId: "encounter-participant-2",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-continued-contact-maintenance",
    });
    const affectedResponse = await app.inject({
      method: "POST",
      payload: {
        contestId: fixture.contestId,
        opponentParticipantId: "encounter-participant-1",
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/roll-continued-contact-maintenance",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(controllerResponse.statusCode, JSON.stringify(controllerResponse.json())).toBe(200);
    expect(affectedResponse.statusCode, JSON.stringify(affectedResponse.json())).toBe(200);
    const contest =
      mutable.encounter.combatRoundState?.roundEndReview?.continuedContactMaintenanceContests[0];
    expect(contest).toMatchObject({
      controllerRoll: expect.objectContaining({
        rollPurpose: "escape_continued_contact",
        rolledByUserId: "gm-1",
      }),
      affectedRoll: expect.objectContaining({
        generalModifier: 0,
        rollPurpose: "escape_continued_contact",
        rolledByUserId: "gm-1",
      }),
      outcome: "escaped",
      status: "resolved",
    });
    expect(mutable.encounter.combatRoundState?.continuedContacts[0]?.status).toBe("ended");
    expect(mutable.encounter.combatRoundState?.unbalancedConditions[0]?.status).toBe("ended");
    const affectedState = mutable.participants[1]?.state as unknown as {
      combatEffects: CombatEffectsState;
    };
    expect(
      affectedState.combatEffects.effects.find((effect) => effect.id === fixture.conditionId),
    ).toMatchObject({ status: "expired" });
    expect(mutable.encounter.combatRoundState?.roundEndReview?.proposedDistances[0]).toMatchObject({
      controlMode: "ordinary",
      requiresContest: true,
    });
  });

  it("returns a player-safe partial Continued Contact maintenance contest after the owner's roll", async () => {
    const fixture = makeContinuedContactMaintenanceFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        contestId: fixture.contestId,
        opponentParticipantId: "encounter-participant-2",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-continued-contact-maintenance",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const responseContest =
      response.json().encounter.combatRoundState.roundEndReview
        .continuedContactMaintenanceContests[0];
    expect(responseContest).toMatchObject({
      controllerRoll: expect.objectContaining({
        participantId: "encounter-participant-1",
        rollPurpose: "escape_continued_contact",
      }),
      controllerRollRecorded: true,
      affectedRollRecorded: false,
      status: "awaiting_rolls",
    });
    expect(responseContest.affectedRoll).toBeUndefined();
  });

  it("lets each player-owned side execute its exact Continued Contact maintenance task", async () => {
    const prepared = makeContinuedContactMaintenanceFixture();
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.playerUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();
    try {
      const controller = await app.inject({
        method: "POST",
        payload: {
          contestId: prepared.contestId,
          opponentParticipantId: "encounter-participant-2",
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-round/roll-continued-contact-maintenance",
      });
      expect(controller.statusCode, controller.body).toBe(200);
      mocks.requireAuthenticatedUser.mockResolvedValue({
        ...mocks.playerUser,
        id: "other-player",
      });
      const affected = await app.inject({
        method: "POST",
        payload: {
          contestId: prepared.contestId,
          opponentParticipantId: "encounter-participant-1",
          scenarioParticipantId: "participant-2",
        },
        url: "/encounters/encounter-1/combat-round/roll-continued-contact-maintenance",
      });
      expect(affected.statusCode, affected.body).toBe(200);
      expect(
        combatRoundStateSchema.parse(fixture.encounter.combatRoundState).roundEndReview
          ?.continuedContactMaintenanceContests[0],
      ).toMatchObject({ affectedRollRecorded: true, controllerRollRecorded: true });
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("rolls contiguous GM Continued Contact sides, fences distance, and retries idempotently", async () => {
    const prepared = makeContinuedContactMaintenanceFixture();
    const participants = prepared.participants.map((participant) => ({
      ...participant,
      controlledByUserId: undefined,
    }));
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants,
      user: mocks.adminUser,
    });
    const payload = stepAutomationRequest({
      encounter: prepared.encounter,
      operationFamily: "roll_remaining",
      participants,
      runId: "continued-contact-complete-run",
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();
    try {
      const response = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().workflow).toMatchObject({
        identity: { startProcessFamily: "continued_contact" },
        processedCount: 2,
        stepComplete: true,
        stopReason: "distance_decision_required",
      });
      const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
      expect(
        state.commands.filter((command) => command.type === "roll_continued_contact_maintenance"),
      ).toHaveLength(2);
      expect(state.roundEndReview?.proposedDistances[0]?.status).toBe("pending_rolls");
      const effect = fixture.participants[1]!.state.combatEffects?.effects.find(
        (candidate) => candidate.id === prepared.conditionId,
      );
      expect(effect).toMatchObject({
        canonicalLifecycle: { lifecycle: { state: "resolved" }, version: 2 },
        status: "expired",
      });
      const finalCommand = state.commands.at(-1)!;
      expect(finalCommand.facts.continuedContactEffectTransition).toMatchObject({
        nextEffect: { status: "expired" },
        previousEffect: { status: "active" },
        scenarioParticipantId: "participant-2",
      });

      const commandCount = state.commands.length;
      const retry = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(retry.statusCode, retry.body).toBe(200);
      expect(retry.json().workflow).toMatchObject({
        alreadyAccepted: true,
        processedCount: 2,
        stopReason: "distance_decision_required",
      });
      expect(
        combatRoundStateSchema.parse(fixture.encounter.combatRoundState).commands,
      ).toHaveLength(commandCount);

      const clear = await app.inject({
        method: "POST",
        url: "/encounters/encounter-1/combat-round/clear-current-step",
      });
      expect(clear.statusCode, clear.body).toBe(200);
      const restored = clear
        .json()
        .participants.find((participant: ScenarioParticipant) => participant.id === "participant-2")
        .state.combatEffects.effects.find(
          (candidate: { id: string }) => candidate.id === prepared.conditionId,
        );
      expect(restored).toEqual(
        (finalCommand.facts.continuedContactEffectTransition as { previousEffect: unknown })
          .previousEffect,
      );
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("automates a GM controller and stops before the player-owned escape roll", async () => {
    const prepared = makeContinuedContactMaintenanceFixture();
    const participants = prepared.participants.map((participant, index) => ({
      ...participant,
      controlledByUserId: index === 0 ? undefined : "other-player",
    }));
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();
    try {
      const response = await app.inject({
        method: "POST",
        payload: stepAutomationRequest({
          encounter: prepared.encounter,
          operationFamily: "roll_remaining",
          participants,
          runId: "continued-contact-player-boundary-run",
        }),
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().workflow).toMatchObject({
        processedCount: 1,
        stepComplete: false,
        stopParticipantId: "encounter-participant-2",
        stopReason: "player_action_required",
      });
      const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
      expect(state.roundEndReview?.continuedContactMaintenanceContests[0]).toMatchObject({
        affectedRollRecorded: false,
        controllerRollRecorded: true,
      });
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("keeps encounter and mirrored effect unchanged when atomic escape persistence fails", async () => {
    const prepared = makeContinuedContactMaintenanceFixture();
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();
    try {
      const controller = await app.inject({
        method: "POST",
        payload: {
          contestId: prepared.contestId,
          opponentParticipantId: "encounter-participant-2",
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-round/roll-continued-contact-maintenance",
      });
      expect(controller.statusCode).toBe(200);
      mocks.encounterService.commitCombatParticipantStateMutation.mockRejectedValueOnce(
        new Error("transaction failed"),
      );
      const affected = await app.inject({
        method: "POST",
        payload: {
          contestId: prepared.contestId,
          opponentParticipantId: "encounter-participant-1",
          scenarioParticipantId: "participant-2",
        },
        url: "/encounters/encounter-1/combat-round/roll-continued-contact-maintenance",
      });
      expect(affected.statusCode).toBe(400);
      const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
      expect(state.roundEndReview?.continuedContactMaintenanceContests[0]).toMatchObject({
        affectedRollRecorded: false,
        controllerRollRecorded: true,
      });
      expect(state.continuedContacts[0]?.status).toBe("active");
      expect(
        fixture.participants[1]!.state.combatEffects?.effects.find(
          (candidate) => candidate.id === prepared.conditionId,
        ),
      ).toMatchObject({ status: "active" });
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("returns the incremented revision and Start next round task after the final SU review", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const readyState = commitDistanceControlFixture({
      proposalId: fixture.proposalId,
      state: rollDistanceControlFixtureBothSides({
        encounter: fixture.encounter,
        proposalId: fixture.proposalId,
      }),
    });
    const firstReview = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:13:00.000Z", createdByUserId: "gm-1" },
      encounterId: fixture.encounter.id,
      participantId: "encounter-participant-1",
      scenarioId: fixture.encounter.scenarioId,
      scenarioParticipantId: "participant-1",
      state: readyState,
    }).state;
    setupMutableCombatRouteState({
      encounter: {
        ...fixture.encounter,
        combatRoundState: firstReview,
        currentRound: firstReview.roundNumber,
      },
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        expectedParticipantRevision: fixture.participants[1]!.updatedAt,
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/commit-participant-review",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ participant: { id: "participant-2" } });
    expect(response.json().encounter.updatedAt).not.toBe(fixture.encounter.updatedAt);
    expect(
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
        .roundEndReview.participantReviews["encounter-participant-2"],
    ).toMatchObject({ status: "complete" });
    const projection = buildCombatProgressionProjection(
      response.json().encounter.combatRoundState as CombatRoundState,
    );
    expect(
      projection.boundary.processes
        .flatMap((process) => process.stages)
        .flatMap((stage) => stage.tasks),
    ).toContainEqual(
      expect.objectContaining({
        kind: "gm_advance_boundary",
        state: "executable",
        transition: expect.objectContaining({
          currentBoundary: "round_boundary",
          targetBoundary: "declaration",
        }),
      }),
    );
  });

  it("accepts the projected round boundary before applying non-threshold observation progress", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const readyState = commitDistanceControlFixture({
      proposalId: fixture.proposalId,
      state: rollDistanceControlFixtureBothSides({
        encounter: fixture.encounter,
        proposalId: fixture.proposalId,
      }),
    });
    const firstReview = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:13:00.000Z", createdByUserId: "gm-1" },
      encounterId: fixture.encounter.id,
      participantId: "encounter-participant-1",
      scenarioId: fixture.encounter.scenarioId,
      scenarioParticipantId: "participant-1",
      state: readyState,
    }).state;
    const completedReview = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:14:00.000Z", createdByUserId: "gm-1" },
      encounterId: fixture.encounter.id,
      participantId: "encounter-participant-2",
      scenarioId: fixture.encounter.scenarioId,
      scenarioParticipantId: "participant-2",
      state: firstReview,
    }).state;
    const completedState = combatRoundStateSchema.parse({
      ...completedReview,
      observationRelationships: [
        {
          bestBonus: 0,
          completedAttempts: 0,
          id: "observation:encounter-participant-2:encounter-participant-1",
          observerParticipantId: "encounter-participant-2",
          roundsTowardNextAttempt: 1,
          targetParticipantId: "encounter-participant-1",
        },
      ],
      participants: completedReview.participants.map((participant) =>
        participant.participantId === "encounter-participant-2"
          ? {
              ...participant,
              declaration: {
                actionId: "parry",
                roundNumber: completedReview.roundNumber,
                secondaryActions: [
                  {
                    action: "observe_opponent",
                    targetParticipantId: "encounter-participant-1",
                  },
                ],
                secondaryActionContext: {
                  action: "observe_opponent",
                  targetParticipantId: "encounter-participant-1",
                },
                secondaryActionId: "observe_opponent",
                submittedBy: "gm",
              },
            }
          : participant,
      ),
    });
    const lifecycle = setupMutableCombatRouteState({
      encounter: {
        ...fixture.encounter,
        combatRoundState: completedState,
        currentRound: completedState.roundNumber,
      },
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const descriptor = {
      ...buildBoundaryTaskPayload(completedState, lifecycle.encounter.updatedAt, "declaration"),
      expectedBoundary: "round_boundary" as const,
      stepSnapshots: [],
      targetBoundary: "declaration" as const,
    };
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: descriptor,
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json().encounter.combatRoundState).toMatchObject({
      observationRelationships: [
        expect.objectContaining({
          id: "observation:encounter-participant-2:encounter-participant-1",
          roundsTowardNextAttempt: 2,
        }),
      ],
      roundNumber: completedState.roundNumber + 1,
    });
    expect(response.json().encounter.combatRoundState.rounds[0]).toMatchObject({
      observationRelationships: [
        expect.objectContaining({
          id: "observation:encounter-participant-2:encounter-participant-1",
          roundsTowardNextAttempt: 2,
        }),
      ],
      roundNumber: completedState.roundNumber,
    });
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledTimes(1);
  });

  it("reloads an applied contested distance and starts the next round exactly once", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const rolledState = rollDistanceControlFixtureBothSides({
      encounter: fixture.encounter,
      proposalId: fixture.proposalId,
    });
    const appliedState = commitDistanceControlFixture({
      proposalId: fixture.proposalId,
      state: rolledState,
    });
    const firstReview = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:13:00.000Z", createdByUserId: "gm-1" },
      encounterId: fixture.encounter.id,
      participantId: "encounter-participant-1",
      scenarioId: fixture.encounter.scenarioId,
      scenarioParticipantId: "participant-1",
      state: appliedState,
    }).state;
    const completedState = commitCombatRoundEndParticipantReview({
      command: { createdAt: "2026-01-01T00:14:00.000Z", createdByUserId: "gm-1" },
      encounterId: fixture.encounter.id,
      participantId: "encounter-participant-2",
      scenarioId: fixture.encounter.scenarioId,
      scenarioParticipantId: "participant-2",
      state: firstReview,
    }).state;
    const persistedState = {
      ...JSON.parse(JSON.stringify(completedState)),
      currentCursor: { roundNumber: completedState.roundNumber, step: "SU" },
      roundEndReview: {
        ...completedState.roundEndReview,
        proposedDistances: completedState.roundEndReview?.proposedDistances.map((proposal) => ({
          ...proposal,
          // Browser reproduction: apply/event facts persisted, but this lifecycle field was stale.
          appliedDistance: undefined,
          status: "rolled",
        })),
      },
      selectedParticipantId: "encounter-participant-2",
      selectedStep: "select_actions",
    } as CombatRoundState;
    const participantWithExpiredFeint = {
      ...fixture.participants[0],
      state: {
        ...fixture.participants[0].state,
        combat: {
          combatContext: {
            modifierBuckets: {
              general: [
                { id: "imported", imported: true, sourceType: "character_effect", value: 1 },
              ],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [
                {
                  durationRounds: 1,
                  expiresAtRound: completedState.roundNumber,
                  generated: true,
                  id: "generated:feint:old:ob",
                  sourcePhase: "phase2",
                  sourceRule: `feint:combat-feint:round:${completedState.roundNumber}:old:phase2:ob-skill`,
                  sourceType: "feint",
                  value: -2,
                },
              ],
            },
          },
        },
      },
    } as unknown as ReturnType<typeof makeCombatScenarioParticipant>;
    const lifecycle = setupMutableCombatRouteState({
      encounter: {
        ...fixture.encounter,
        combatRoundState: persistedState,
        currentRound: persistedState.roundNumber,
      },
      participants: [participantWithExpiredFeint, fixture.participants[1]],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        ...buildBoundaryTaskPayload(completedState, lifecycle.encounter.updatedAt, "declaration"),
        expectedBoundary: "round_boundary",
        stepSnapshots: [],
        targetBoundary: "declaration",
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const nextState = response.json().encounter.combatRoundState as CombatRoundState;
    expect(nextState.roundNumber).toBe(completedState.roundNumber + 1);
    expect(nextState.rounds).toHaveLength(1);
    expect(nextState.rounds[0]?.roundNumber).toBe(completedState.roundNumber);
    expect(
      getDistanceBetween(
        nextState.distanceState,
        "encounter-participant-1",
        "encounter-participant-2",
      ),
    ).toBe(3);
    expect(lifecycle.encounter.combatRoundState?.roundNumber).toBe(completedState.roundNumber + 1);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledTimes(1);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                general: [expect.objectContaining({ id: "imported" })],
                situationObSkill: [],
              }),
            }),
          }),
        }),
      }),
    );
  });

  it("rejects starting the next round while a resolved distance still awaits apply", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const rolledState = rollDistanceControlFixtureBothSides({
      encounter: fixture.encounter,
      proposalId: fixture.proposalId,
    });
    const lifecycle = setupMutableCombatRouteState({
      encounter: {
        ...fixture.encounter,
        combatRoundState: rolledState,
        currentRound: rolledState.roundNumber,
      },
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        commandType: "complete_round",
        executionGroupId: "blocked:round-boundary:group",
        expectedBoundary: "round_boundary",
        expectedRevision: lifecycle.encounter.updatedAt,
        stepSnapshots: [],
        taskId: "blocked:round-boundary:task",
        targetBoundary: "declaration",
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe(
      "Distance control for The Gladiator ↔ City guard must be applied before starting the next round.",
    );
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("lets a GM roll the canonical current distance-control task through a narrow route", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const staleInspectionState = {
      ...fixture.encounter.combatRoundState,
      selectedParticipantId: "encounter-participant-2",
      selectedStep: "select_actions",
    } as CombatRoundState;
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: staleInspectionState,
      },
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/roll-current-distance-control",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(Object.keys(payload).sort()).toEqual(["commandEnvelope", "encounter"]);
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    const updatedState = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session
      .combatRoundState as CombatRoundState;
    const proposal = updatedState.roundEndReview?.proposedDistances[0];
    expect(proposal?.participantA).toMatchObject({
      result: expect.objectContaining({
        rolledBy: "gm_proxy",
        rolledByUserId: "gm-1",
      }),
      status: "rolled",
    });
    expect(proposal?.participantB.status).toBe("pending");
    expect(updatedState.commands.at(-1)).toMatchObject({
      participantId: "encounter-participant-1",
      type: "roll_round_end_distance_control",
    });
  });

  it("rejects players from the canonical GM distance-control route", async () => {
    const fixture = makeDistanceControlReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/roll-current-distance-control",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("returns player-safe pending distance-control proposals with own details only", async () => {
    const fixture = makeDistanceControlReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const proposal = response.json().encounter.combatRoundState.roundEndReview.proposedDistances[0];
    const opponentRoundParticipant = response
      .json()
      .encounter.combatRoundState.participants.find(
        (participant: { participantId?: string }) =>
          participant.participantId === "encounter-participant-2",
      );

    expect(proposal).toMatchObject({
      currentDistance: 3,
      outcome: "contest_pending",
      status: "pending_rolls",
    });
    expect(proposal.participantA).toMatchObject({
      desiredDistance: 3,
      dodgeSkillTotal: 8,
      generalFatigueModifier: -1,
      status: "pending",
    });
    expect(proposal.participantB).toMatchObject({
      participantId: "encounter-participant-2",
      status: "pending",
    });
    expect(proposal.participantB.desiredDistance).toBeUndefined();
    expect(proposal.participantB.result).toBeUndefined();
    expect(proposal.proposedDistance).toBeUndefined();
    expect(proposal.winnerParticipantId).toBeUndefined();
    expect(opponentRoundParticipant?.declaration?.movementIntent).toBeUndefined();
  });

  it("hides opponent roll details and proposed outcome before distance-control commit", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const rolledState = rollDistanceControlFixtureBothSides({
      encounter: fixture.encounter,
      proposalId: fixture.proposalId,
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: rolledState,
        currentRound: rolledState.roundNumber,
      },
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const proposal = response.json().encounter.combatRoundState.roundEndReview.proposedDistances[0];

    expect(proposal).toMatchObject({
      outcome: "contest_pending",
      status: "rolled",
    });
    expect(proposal.participantA.result).toMatchObject({
      finalTotal: 17,
      rollD20: 10,
      rollTotal: 10,
    });
    expect(proposal.participantB).toMatchObject({
      participantId: "encounter-participant-2",
      status: "rolled",
    });
    expect(proposal.participantB.desiredDistance).toBeUndefined();
    expect(proposal.participantB.result).toBeUndefined();
    expect(proposal.proposedDistance).toBeUndefined();
    expect(proposal.winnerParticipantId).toBeUndefined();
  });

  it("keeps GM distance-control live state fully visible", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const rolledState = rollDistanceControlFixtureBothSides({
      encounter: fixture.encounter,
      proposalId: fixture.proposalId,
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: rolledState,
        currentRound: rolledState.roundNumber,
      },
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const proposal = response.json().encounter.combatRoundState.roundEndReview.proposedDistances[0];

    expect(proposal).toMatchObject({
      outcome: "participant_a_wins",
      proposedDistance: 3,
      status: "rolled",
      winnerParticipantId: "encounter-participant-1",
    });
    expect(proposal.participantB).toMatchObject({
      desiredDistance: 2,
      result: expect.objectContaining({
        finalTotal: 16,
        rollD20: 12,
        rollTotal: 12,
      }),
    });
  });

  it("returns public committed distance outcome in player-safe live state", async () => {
    const fixture = makeDistanceControlReviewFixture();
    const rolledState = rollDistanceControlFixtureBothSides({
      encounter: fixture.encounter,
      proposalId: fixture.proposalId,
    });
    const committedState = commitDistanceControlFixture({
      proposalId: fixture.proposalId,
      state: rolledState,
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: committedState,
        currentRound: committedState.roundNumber,
      },
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const proposal = response.json().encounter.combatRoundState.roundEndReview.proposedDistances[0];

    expect(proposal).toMatchObject({
      appliedDistance: 3,
      proposedDistance: 3,
      status: "committed",
    });
    expect(proposal.participantB).toMatchObject({
      participantId: "encounter-participant-2",
      status: "rolled",
    });
    expect(proposal.participantB.desiredDistance).toBeUndefined();
    expect(proposal.participantB.result).toBeUndefined();
  });

  it("lets a player roll their own round-end health check", async () => {
    const fixture = makeHealthCheckReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        difficulty: 999,
        expectedParticipantRevision: fixture.participants[0]!.updatedAt,
        healthRollId: fixture.healthRollId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-health-check",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const healthRoll =
      updatedEncounter.combatRoundState.roundEndReview.participantReviews["encounter-participant-1"]
        .proposedHealthRolls[0];
    const updatedParticipantState =
      mocks.encounterService.commitCombatParticipantStateMutation.mock.calls[0]?.[0]?.state;

    expect(healthRoll).toMatchObject({
      result: expect.objectContaining({
        difficulty: 21,
        rolledBy: "player",
        rolledByUserId: "player-1",
        success: true,
      }),
      status: "rolled",
    });
    expect(
      updatedEncounter.combatRoundState.roundEndReview.participantReviews["encounter-participant-1"]
        .status,
    ).toBe("review_ready");
    expect(updatedParticipantState.combatEffects.effects[0]).toMatchObject({
      id: "player-bleed",
      modifierValue: 1,
    });
  });

  it("rejects an SU Health roll when participant effect state is stale", async () => {
    const fixture = makeHealthCheckReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        expectedParticipantRevision: "stale-participant-revision",
        healthRollId: fixture.healthRollId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-health-check",
    });

    await app.close();
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ code: "stale_revision" });
    expect(mocks.encounterService.commitCombatParticipantStateMutation).not.toHaveBeenCalled();
  });

  it("rejects player round-end health checks for another participant", async () => {
    const fixture = makeHealthCheckReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        expectedParticipantRevision: fixture.participants[0]!.updatedAt,
        healthRollId: fixture.healthRollId,
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/roll-health-check",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("lets a GM proxy a pending round-end health check", async () => {
    const fixture = makeHealthCheckReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        expectedParticipantRevision: fixture.participants[0]!.updatedAt,
        healthRollId: fixture.healthRollId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-health-check",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const command = updatedEncounter.combatRoundState.commands.at(-1);
    const healthRoll =
      updatedEncounter.combatRoundState.roundEndReview.participantReviews["encounter-participant-1"]
        .proposedHealthRolls[0];

    expect(command).toMatchObject({
      facts: expect.objectContaining({
        rolledBy: "gm_proxy",
      }),
      type: "roll_round_end_health_check",
    });
    expect(healthRoll.result).toMatchObject({
      rolledBy: "gm_proxy",
      rolledByUserId: "gm-1",
    });
  });

  it("restores pending round-end health check state when the GM clears the health roll", async () => {
    const fixture = makeHealthCheckReviewFixture();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const app = await buildScenarioTestApp();

    const rollResponse = await app.inject({
      method: "POST",
      payload: {
        expectedParticipantRevision: fixture.participants[0]!.updatedAt,
        healthRollId: fixture.healthRollId,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-health-check",
    });
    const rolledEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]
      ?.session as EncounterSession;
    mocks.encounterService.getEncounterById.mockResolvedValue(rolledEncounter);
    const clearResponse = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(rollResponse.statusCode).toBe(200);
    expect(clearResponse.statusCode).toBe(200);
    const clearedEncounter = mocks.encounterService.updateEncounter.mock.calls[1]?.[0]?.session;
    const restoredReview =
      clearedEncounter.combatRoundState.roundEndReview.participantReviews[
        "encounter-participant-1"
      ];

    expect(restoredReview.status).toBe("health_roll_pending");
    expect(restoredReview.proposedHealthRolls[0]).toMatchObject({
      result: undefined,
      status: "pending",
    });
  });

  it("lets a player confirm no-roll Combat Experience when displayed skill total meets difficulty", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 7,
                  linkedStatAverage: 19,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                  totalSkill: 26,
                },
              ],
            },
          },
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 26,
      effectiveTableTotal: 21,
      finalTotal: 26,
      modifierValue: 0,
      noRollRequired: true,
      skillTotal: 26,
      skillTotalSource: "participant.snapshot.sheetSummary.draftView.skills.totalSkill",
    });
    expect(response.json().combatExperience.rollD20).toBeUndefined();
    expect(response.json().combatExperience.rollTotal).toBeUndefined();
    expect(
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state.combatEffects
        .effects,
    ).toEqual([]);
  });

  it("uses the shared GM Combat Experience difficulty for player rolls", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const roundState = setCombatRoundCombatExperienceDifficulty({
      difficulty: 36,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        combatRoundState: roundState,
      },
      participant: {
        snapshot: {
          displayName: "The Gladiator",
          sheetSummary: {
            draftView: {
              skills: [
                {
                  effectiveSkillNumber: 7,
                  linkedStatAverage: 19,
                  name: "Combat Experience",
                  skillId: "combat_experience",
                  totalSkill: 26,
                },
              ],
            },
          },
        },
      },
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 36,
      effectiveTableTotal: 16,
      finalTotal: 31,
      noRollRequired: false,
      rollD20: 5,
      skillTotal: 26,
    });
  });

  it("lets a player submit back-out for their own phase initiative choice", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/back-out-phase-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;
    expect(updatedParticipantState.combat.combatContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "generated:double-attack:phase1:db-parry",
        value: -2,
      }),
      doubleAttackPhase2DbParryModifier,
    ]);
    expect(updatedParticipantState.combat.combatContext.modifierBuckets.situationObSkill).toEqual([
      doubleAttackPhase1ObSkillModifier,
      doubleAttackPhase2ObSkillModifier,
    ]);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        choice: "back_out",
        reason: "Backed out while attacked",
        skippedAttack: true,
        softenedModifierIds: ["generated:double-attack:phase1:db-parry"],
        source: "phase_initiative_resolution",
      }),
      participantId: "encounter-participant-1",
      phase: "phase1",
      step: "A1",
      type: "submit_phase_initiative_choice",
    });
    expect(
      updatedEncounter.combatRoundState.commands.some(
        (command: { type: string }) => command.type === "roll_combat_experience",
      ),
    ).toBe(false);
    expect(updatedEncounter.combatRoundState.participants[0]?.stepStatuses.phase_1_actions).toBe(
      "skipped",
    );
  });

  it("binds a phase Combat Experience roll to its projected action opportunity", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();
    const task = buildCombatProgressionProjection(fixture.roundState)
      .boundary.processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find(
        (candidate) =>
          candidate.kind === "combat_experience" &&
          candidate.owner?.kind === "combatant" &&
          candidate.owner.participantId === "encounter-participant-1",
      );
    expect(task?.identity.opportunityId).toBeTruthy();

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        executionGroupId: task?.executionGroupId,
        opportunityId: task?.identity.opportunityId,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
        taskId: task?.id,
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });
    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({ opportunityId: task?.identity.opportunityId }),
      phase: "phase1",
      step: "A1",
      type: "roll_combat_experience",
    });
  });

  it("lets a higher-initiative player submit back-out without required CE", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture({
      gladiatorInitiative: 9,
      guardInitiative: 4,
    });

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/back-out-phase-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;
    expect(updatedParticipantState.combat.combatContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "generated:double-attack:phase1:db-parry",
        value: -2,
      }),
      doubleAttackPhase2DbParryModifier,
    ]);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        backOutAvailableReason: "attacked_while_attacking",
        ceWasRequired: false,
        choice: "back_out",
        initiativeComparison: [
          expect.objectContaining({
            attackerParticipantId: "encounter-participant-2",
            initiativeDifference: 5,
            reason: "higher_initiative",
          }),
        ],
        skippedAttack: true,
      }),
      participantId: "encounter-participant-1",
      phase: "phase1",
      step: "A1",
      type: "submit_phase_initiative_choice",
    });
    expect(
      updatedEncounter.combatRoundState.commands.some(
        (command: { type: string }) => command.type === "roll_combat_experience",
      ),
    ).toBe(false);
    expect(updatedEncounter.combatRoundState.participants[0]?.combatExperience).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[0]?.stepStatuses.phase_1_actions).toBe(
      "skipped",
    );
  });

  it("rejects phase initiative commit while projected initiative rolls are pending", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentCursor: {
            participantId: "encounter-participant-1",
            roundNumber: 1,
            step: "i1",
          },
          currentStep: "initiative_phase_1",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: { phase: "phase1" },
      url: "/encounters/encounter-1/combat-round/commit-phase-initiative-resolution",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Phase initiative must be complete before resolution can be committed.",
    });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("applies a submitted phase back-out after initiative has already been committed", () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();
    const backedOut = backOutCombatRoundPhaseAttack({
      combatContext: fixture.participants[0]?.state.combat.combatContext,
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "player-1",
      },
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.roundState,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility: fixture.encounter.roleplayState?.visibility,
    });

    expect(backedOut.combatContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        id: "generated:double-attack:phase1:db-parry",
        value: -2,
      }),
      doubleAttackPhase2DbParryModifier,
    ]);
    expect(backedOut.combatContext.modifierBuckets.situationObSkill).toEqual([
      doubleAttackPhase1ObSkillModifier,
      doubleAttackPhase2ObSkillModifier,
    ]);
    expect(backedOut.command).toMatchObject({
      facts: expect.objectContaining({ choice: "back_out", skippedAttack: true }),
      phase: "phase1",
      step: "A1",
      type: "submit_phase_initiative_choice",
    });
    expect(backedOut.state.participants[0]?.stepStatuses.phase_1_actions).toBe("skipped");
  });

  it("returns a canonical command envelope opening Reactive A2 after i2 commit", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "Scyrian cavalry guy",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      currentRound: 5,
      participants: encounterParticipants,
    });
    const baseState = initializeCombatRoundState({ encounter: combatEncounter });
    const withDeclarations = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testCombatPhaseContext("participant-1"),
        },
        roundNumber: baseState.roundNumber,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "parry_attack",
          phaseContexts: {
            phase2: testCombatPhaseContext("participant-2"),
          },
          roundNumber: baseState.roundNumber,
        },
        participantId: "encounter-participant-1",
        state: baseState,
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const withGladiatorM1Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      state: withDeclarations,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const withScyrianM1Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:01:10.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-2",
      state: withGladiatorM1Reviewed,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const atI1 = advanceCombatRoundStep(withScyrianM1Reviewed);
    const withGladiatorI1 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: atI1,
      submittedBy: "gm",
    });
    const atI1Review = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:10.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 7,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: withGladiatorI1,
      submittedBy: "gm",
    });
    const atA1 = commitCombatRoundPhaseInitiativeResolution({
      command: {
        createdAt: "2026-01-01T00:02:20.000Z",
        createdByUserId: "gm-1",
      },
      phase: "phase1",
      state: atI1Review,
    }).state;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-2",
      defenderDb: 13,
      defenderParticipantId: "encounter-participant-1",
      ob: 10,
      phase: "phase1",
      rollD20: 5,
      rollTotal: 5,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterA1 = recordCombatRoundAttackResult({
      command: {
        createdAt: attackResult.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-2",
      result: attackResult,
      state: atA1,
      submittedBy: "gm",
    });
    const withGladiatorM2Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:03:30.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      state: afterA1,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const withScyrianM2Reviewed = recordCombatRoundParticipantStepReview({
      command: {
        createdAt: "2026-01-01T00:03:40.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-2",
      state: withGladiatorM2Reviewed,
      step: "review_phase_2_modifiers",
      submittedBy: "gm",
    });
    const atI2 = advanceCombatRoundStep(withScyrianM2Reviewed);
    const withScyrianI2 = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 5,
      participantId: "encounter-participant-2",
      phase: "phase2",
      state: atI2,
      submittedBy: "gm",
    });
    const afterI2Rolls = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:04:10.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 8,
      participantId: "encounter-participant-1",
      phase: "phase2",
      state: withScyrianI2,
      submittedBy: "gm",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: afterI2Rolls,
        currentRound: afterI2Rolls.roundNumber,
        participants: encounterParticipants,
      },
      participants: [
        {
          id: "participant-1",
          snapshot: { displayName: "The Gladiator" },
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: { displayName: "Scyrian cavalry guy" },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        phase: "phase2",
      },
      url: "/encounters/encounter-1/combat-round/commit-phase-initiative-resolution",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    const updatedEncounter = payload.encounter;

    expect(payload.commandEnvelope).toMatchObject({
      currentTask: {
        cursorStep: "A2",
        participantId: "encounter-participant-1",
        step: "phase_2_actions",
      },
      latestResult: {
        kind: "phase_initiative_commit",
        phase: "phase2",
      },
    });
    expect(payload.commandEnvelope).not.toHaveProperty("commands");
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(payload).not.toHaveProperty("command");
    expect(response.body.length).toBeLessThan(250_000);
    expect(updatedEncounter).toMatchObject({
      id: "encounter-1",
      combatRoundState: expect.objectContaining({
        currentStep: "phase_2_actions",
      }),
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toMatchObject({
      participantId: "encounter-participant-1",
      step: "A2",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("phase_2_actions");
    expect(
      combatRoundParticipantWasAttackedInPhase({
        participantId: "encounter-participant-1",
        phase: "phase1",
        state: updatedEncounter.combatRoundState,
      }),
    ).toBe(true);
    expect(
      combatRoundParticipantHasExecutablePhaseAttack({
        participantId: "encounter-participant-1",
        phase: "phase2",
        state: updatedEncounter.combatRoundState,
      }),
    ).toBe(true);
  });

  it("advances the current combat round step through a narrow command route", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const baseState = initializeCombatRoundState({ encounter: baseEncounter });
    const reviewState: CombatRoundState = {
      ...baseState,
      currentCursor: {
        participantId: "encounter-participant-1",
        roundNumber: baseState.roundNumber,
        step: "M1",
      },
      currentStep: "review_action_modifiers",
      participants: baseState.participants.map((participant) => ({
        ...participant,
        stepStatuses: {
          ...participant.stepStatuses,
          review_action_modifiers: "gmEdited",
          select_actions: "submitted",
        },
      })),
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "review_action_modifiers",
    };
    const stepSnapshot = {
      committedAt: "2026-01-01T00:02:00.000Z",
      id: "1:encounter-participant-1:review_action_modifiers",
      modifierSummary: {
        dbRaw: 0,
        generalFatigueRaw: 0,
        initiativeRaw: 0,
        obSkillRaw: 0,
        rows: [],
      },
      participantId: "encounter-participant-1",
      participantLabel: "The Gladiator",
      roundNumber: reviewState.roundNumber,
      step: "review_action_modifiers",
    };
    const boundaryTask = buildCombatProgressionProjection(reviewState)
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((task) => task.kind === "gm_advance_boundary");

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        combatRoundState: reviewState,
        currentRound: reviewState.roundNumber,
        participants: encounterParticipants,
      },
      participants: [
        {
          id: "participant-1",
          snapshot: { displayName: "The Gladiator" },
        },
        {
          id: "participant-2",
          snapshot: { displayName: "City guard" },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const wrongTargetResponse = await app.inject({
      method: "POST",
      payload: {
        commandType: boundaryTask?.expectedCommand,
        executionGroupId: boundaryTask?.executionGroupId,
        expectedBoundary: "phase1_modifier_review",
        expectedRevision: "2026-01-01T00:00:00.000Z",
        stepSnapshots: [stepSnapshot],
        taskId: boundaryTask?.id,
        targetBoundary: "phase2_modifier_review",
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });
    const wrongTaskResponse = await app.inject({
      method: "POST",
      payload: {
        commandType: boundaryTask?.expectedCommand,
        executionGroupId: boundaryTask?.executionGroupId,
        expectedBoundary: "phase1_modifier_review",
        expectedRevision: "2026-01-01T00:00:00.000Z",
        targetBoundary: "phase1_initiative",
        taskId: "stale:boundary-task",
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });
    const wrongGroupResponse = await app.inject({
      method: "POST",
      payload: {
        commandType: boundaryTask?.expectedCommand,
        executionGroupId: "stale:boundary-group",
        expectedBoundary: "phase1_modifier_review",
        expectedRevision: "2026-01-01T00:00:00.000Z",
        targetBoundary: "phase1_initiative",
        taskId: boundaryTask?.id,
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });
    const missingGroupResponse = await app.inject({
      method: "POST",
      payload: {
        commandType: boundaryTask?.expectedCommand,
        expectedBoundary: "phase1_modifier_review",
        expectedRevision: "2026-01-01T00:00:00.000Z",
        targetBoundary: "phase1_initiative",
        taskId: boundaryTask?.id,
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });
    const missingTaskResponse = await app.inject({
      method: "POST",
      payload: {
        commandType: boundaryTask?.expectedCommand,
        executionGroupId: boundaryTask?.executionGroupId,
        expectedBoundary: "phase1_modifier_review",
        expectedRevision: "2026-01-01T00:00:00.000Z",
        targetBoundary: "phase1_initiative",
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });
    const wrongCommandResponse = await app.inject({
      method: "POST",
      payload: {
        commandType: "complete_round",
        executionGroupId: boundaryTask?.executionGroupId,
        expectedBoundary: "phase1_modifier_review",
        expectedRevision: "2026-01-01T00:00:00.000Z",
        targetBoundary: "phase1_initiative",
        taskId: boundaryTask?.id,
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
    const playerResponse = await app.inject({
      method: "POST",
      payload: {
        commandType: boundaryTask?.expectedCommand,
        executionGroupId: boundaryTask?.executionGroupId,
        expectedBoundary: "phase1_modifier_review",
        expectedRevision: "2026-01-01T00:00:00.000Z",
        targetBoundary: "phase1_initiative",
        taskId: boundaryTask?.id,
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    const response = await app.inject({
      method: "POST",
      payload: {
        commandType: boundaryTask?.expectedCommand,
        executionGroupId: boundaryTask?.executionGroupId,
        expectedBoundary: "phase1_modifier_review",
        expectedRevision: "2026-01-01T00:00:00.000Z",
        stepSnapshots: [stepSnapshot],
        taskId: boundaryTask?.id,
        targetBoundary: "phase1_initiative",
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });
    mocks.encounterService.getEncounterById.mockResolvedValue(response.json().encounter);
    const staleResponse = await app.inject({
      method: "POST",
      payload: {
        commandType: boundaryTask?.expectedCommand,
        executionGroupId: boundaryTask?.executionGroupId,
        expectedBoundary: "phase1_modifier_review",
        expectedRevision: "2026-01-01T00:00:00.000Z",
        targetBoundary: "phase1_initiative",
        taskId: boundaryTask?.id,
      },
      url: "/encounters/encounter-1/combat-round/advance-current-step",
    });

    await app.close();

    expect(wrongTargetResponse.statusCode).toBe(400);
    expect(wrongTargetResponse.json().code).toBe("boundary_mismatch");
    expect(wrongTaskResponse.statusCode).toBe(400);
    expect(wrongTaskResponse.json().code).toBe("task_mismatch");
    expect(wrongGroupResponse.statusCode).toBe(400);
    expect(wrongGroupResponse.json().code).toBe("execution_group_mismatch");
    expect(missingGroupResponse.statusCode).toBe(400);
    expect(missingGroupResponse.json().code).toBe("identity_mismatch");
    expect(missingTaskResponse.statusCode).toBe(400);
    expect(missingTaskResponse.json().code).toBe("identity_mismatch");
    expect(wrongCommandResponse.statusCode).toBe(400);
    expect(wrongCommandResponse.json().code).toBe("task_mismatch");
    expect(playerResponse.statusCode).toBe(403);
    expect(playerResponse.json().code).toBe("unauthorized_actor");
    expect(response.statusCode).toBe(200);
    expect(staleResponse.statusCode).toBe(409);
    expect(staleResponse.json().code).toBe("stale_revision");
    const payload = response.json();
    const updatedEncounter = payload.encounter;

    expect(payload).toHaveProperty("encounter");
    expect(payload.commandEnvelope).toMatchObject({
      currentStep: "initiative_phase_1",
      currentTask: {
        cursorStep: "i1",
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      warnings: [],
    });
    expect(payload.commandEnvelope).not.toHaveProperty("commands");
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(updatedEncounter.combatRoundState).toMatchObject({
      currentStep: "initiative_phase_1",
      stepSnapshots: expect.arrayContaining([expect.objectContaining(stepSnapshot)]),
    });
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          combatRoundState: expect.objectContaining({
            currentStep: "initiative_phase_1",
          }),
        }),
      }),
    );
  });

  it("binds the second declaration to the accepted revision's exact deterministic task", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const baseState = initializeCombatRoundState({ encounter: baseEncounter });
    const firstPhaseContexts = {
      phase1: testCombatPhaseContext("encounter-participant-2"),
    };
    const firstDeclared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        attackOpportunities: buildCombatRoundDeclaredAttackOpportunities({
          actionId: "attack_parry",
          participantId: "encounter-participant-1",
          phaseContexts: firstPhaseContexts,
          roundNumber: baseState.roundNumber,
          sources: {
            phase1: makeUnarmedAttackSourceRef({
              opportunitySlot: "attack_1",
              templateId: "virtual-weapon-template-punch",
            }),
          },
        }),
        phaseContexts: firstPhaseContexts,
        roundNumber: baseState.roundNumber,
      },
      participantId: "encounter-participant-1",
      state: baseState,
      submittedBy: "gm",
    });
    const encounter = encounterSessionSchema.parse({
      ...baseEncounter,
      combatRoundState: firstDeclared,
      currentRound: firstDeclared.roundNumber,
    });
    const participants = [
      scenarioParticipantSchema.parse({
        ...makeCombatScenarioParticipant(),
        createdAt: "2026-07-30T08:00:00.000Z",
        joinSource: "gm_added",
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: { effects: [], events: [] },
        },
      }),
      scenarioParticipantSchema.parse({
        ...makeCombatScenarioParticipant({
          controlledByUserId: undefined,
          id: "participant-2",
          role: "npc",
          snapshot: { displayName: "City guard" },
        }),
        createdAt: "2026-07-30T08:00:00.000Z",
        joinSource: "gm_added",
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: { effects: [], events: [] },
        },
      }),
    ];
    const mutable = setupMutableCombatRouteState({ encounter, participants });
    const app = await buildScenarioTestApp();

    const declaration = await app.inject({
      headers: { "x-glantri-combat-response": "active-v1" },
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: makeCombatScenarioParticipant().state.combat.combatContext,
        phaseContexts: {
          phase1: testCombatPhaseContext("encounter-participant-1"),
        },
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    const descriptor = declaration.json().deterministicAdvance;
    const acceptedRevision = declaration.json().revision;
    const acceptedPersistedRevision = mutable.encounter.updatedAt;
    const advance = await app.inject({
      method: "POST",
      payload: descriptor,
      url: "/encounters/encounter-1/combat-round/advance-deterministic",
    });
    await app.close();

    expect(declaration.statusCode, JSON.stringify(declaration.json())).toBe(200);
    expect(descriptor, JSON.stringify(declaration.json())).toEqual({
      executionGroupId:
        "round:1:boundary:declaration:process:declaration:stage:boundary:execution-group:0:gm_advance_boundary:gm",
      expectedRevision: acceptedRevision,
      taskId:
        "round:1:boundary:declaration:process:declaration:stage:boundary:task:gm_advance_boundary:gm",
    });
    expect(declaration.json().nextTask).toMatchObject({
      executionGroupId: descriptor.executionGroupId,
      taskId: descriptor.taskId,
    });
    expect(acceptedPersistedRevision).toBe(acceptedRevision);
    expect(advance.statusCode, JSON.stringify(advance.json())).toBe(200);
    expect(advance.json().executedTaskIds[0]).toBe(descriptor.taskId);
    expect(advance.json().stopReason).not.toBe("invalid_deterministic_task");
  });

  it("consumes a bounded deterministic suffix after explicit M1 checkpoints without skipped initiative records", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const baseState = initializeCombatRoundState({ encounter: baseEncounter });
    const heroDeclared = recordCombatRoundDeclaration({
      declaration: { actionId: "move_only", roundNumber: baseState.roundNumber },
      participantId: "encounter-participant-1",
      state: baseState,
      submittedBy: "gm",
    });
    const bothDeclared = recordCombatRoundDeclaration({
      declaration: { actionId: "move_only", roundNumber: baseState.roundNumber },
      participantId: "encounter-participant-2",
      state: heroDeclared,
      submittedBy: "gm",
    });
    const m1State = advanceCombatRoundStep(bothDeclared);
    const heroReviewed = recordCombatRoundParticipantStepReview({
      command: { createdAt: "2026-07-30T08:01:00.000Z", createdByUserId: "gm-1" },
      participantId: "encounter-participant-1",
      state: m1State,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const reviewedM1 = recordCombatRoundParticipantStepReview({
      command: { createdAt: "2026-07-30T08:01:10.000Z", createdByUserId: "gm-1" },
      participantId: "encounter-participant-2",
      state: heroReviewed,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    const encounter = encounterSessionSchema.parse({
      ...baseEncounter,
      combatRoundState: reviewedM1,
      currentRound: reviewedM1.roundNumber,
    });
    const participants = [
      scenarioParticipantSchema.parse({
        ...makeCombatScenarioParticipant(),
        createdAt: "2026-07-30T08:00:00.000Z",
        joinSource: "gm_added",
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: { effects: [], events: [] },
        },
      }),
      scenarioParticipantSchema.parse({
        ...makeCombatScenarioParticipant({
          controlledByUserId: undefined,
          id: "participant-2",
          role: "npc",
          snapshot: { displayName: "City guard" },
        }),
        createdAt: "2026-07-30T08:00:00.000Z",
        joinSource: "gm_added",
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: { effects: [], events: [] },
        },
      }),
    ];
    const mutable = setupMutableCombatRouteState({ encounter, participants });
    const participation = projectActiveCombatParticipation({
      encounterRevision: encounter.updatedAt,
      scenarioParticipants: participants,
      state: reviewedM1,
    });
    const task = buildCombatProgressionProjection(reviewedM1, { participation })
      .boundary.processes.flatMap((process) => process.stages)
      .flatMap((stage) => stage.tasks)
      .find((candidate) => candidate.kind === "gm_advance_boundary");
    expect(task?.participation).toMatchObject({
      completeness: "complete",
      status: "required",
      workClass: "deterministic_transition",
    });
    const app = await buildScenarioTestApp();

    const wrongTask = await app.inject({
      method: "POST",
      payload: {
        executionGroupId: "round:1:replacement:group",
        expectedRevision: encounter.updatedAt,
        taskId: "round:1:replacement:task",
      },
      url: "/encounters/encounter-1/combat-round/advance-deterministic",
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        executionGroupId: task?.executionGroupId,
        expectedRevision: encounter.updatedAt,
        taskId: task?.id,
      },
      url: "/encounters/encounter-1/combat-round/advance-deterministic",
    });
    const commandCountAfterAcceptance = mutable.encounter.combatRoundState?.commands.length ?? 0;
    const acceptedRevision = mutable.encounter.updatedAt;
    const retry = await app.inject({
      method: "POST",
      payload: {
        executionGroupId: task?.executionGroupId,
        expectedRevision: encounter.updatedAt,
        taskId: task?.id,
      },
      url: "/encounters/encounter-1/combat-round/advance-deterministic",
    });
    await app.close();

    expect(wrongTask.statusCode, JSON.stringify(wrongTask.json())).toBe(409);
    expect(wrongTask.json()).toEqual({
      actualTask: {
        executionGroupId: task?.executionGroupId,
        kind: task?.kind,
        taskId: task?.id,
      },
      code: "task_mismatch",
      error: "The deterministic combat task changed before it could advance.",
      expectedTask: {
        executionGroupId: "round:1:replacement:group",
        taskId: "round:1:replacement:task",
      },
      revision: encounter.updatedAt,
    });
    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json().executedTaskIds.length).toBeGreaterThan(1);
    expect(retry.statusCode, JSON.stringify(retry.json())).toBe(200);
    expect(retry.json()).toMatchObject({
      executedTaskIds: [],
      stopReason: "already_accepted",
    });
    expect(mutable.encounter.updatedAt).toBe(acceptedRevision);
    expect(mutable.encounter.combatRoundState?.commands.length).toBe(commandCountAfterAcceptance);
    expect(mutable.encounter.combatRoundState?.currentStep).not.toBe("review_action_modifiers");
    expect(
      mutable.encounter.combatRoundState?.commands.some(
        (command) =>
          command.type === "complete_remaining_step" ||
          command.facts.resolutionType === "bulk_skipped",
      ),
    ).toBe(false);
    expect(
      mutable.encounter.combatRoundState?.participants.every(
        (participant) =>
          participant.initiatives.phase1 === undefined &&
          participant.initiatives.phase2 === undefined,
      ),
    ).toBe(true);
  });

  it("prepares round-end review from persisted state without a request payload", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const baseState = initializeCombatRoundState({ encounter: baseEncounter });
    const summaryState: CombatRoundState = {
      ...baseState,
      currentCursor: {
        participantId: "encounter-participant-1",
        roundNumber: baseState.roundNumber,
        step: "SU",
      },
      currentStep: "round_summary",
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    };
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        combatRoundState: summaryState,
        currentRound: summaryState.roundNumber,
        participants: encounterParticipants,
      },
      participants: [
        { id: "participant-1", snapshot: { displayName: "The Gladiator" } },
        { id: "participant-2", snapshot: { displayName: "City guard" } },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/prepare-round-end-review",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.combatRoundState.roundEndReview).toMatchObject({
      roundNumber: summaryState.roundNumber,
    });
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledWith(
      expect.objectContaining({
        session: expect.objectContaining({
          combatRoundState: expect.objectContaining({
            roundEndReview: expect.objectContaining({ roundNumber: summaryState.roundNumber }),
          }),
        }),
      }),
    );
  });

  it.each([
    "feint-feasibility",
    "skip-current-action",
    "advance-current-phase-resolution",
    "complete-current-phase-resolution",
  ])("does not expose the obsolete %s mutation route", async (operation) => {
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {},
      url: `/encounters/encounter-1/combat-round/${operation}`,
    });

    await app.close();

    expect(response.statusCode).toBe(404);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects player phase attack back-out for another participant", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: fixture.encounter,
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        phase: "phase1",
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/back-out-phase-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
  });

  it("hides other participants' pending phase initiative choices from player encounter state", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();
    const ownChoice = backOutCombatRoundPhaseAttack({
      combatContext: fixture.participants[0]?.state.combat.combatContext,
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "player-1",
      },
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.roundState,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility: fixture.encounter.roleplayState?.visibility,
    });
    const otherChoiceState = combatRoundStateSchema.parse({
      ...ownChoice.state,
      commands: [
        ...ownChoice.state.commands,
        {
          ...ownChoice.command,
          createdAt: "2026-01-01T00:03:30.000Z",
          createdByUserId: "other-player",
          id: `${ownChoice.command.id}:other`,
          participantId: "encounter-participant-2",
        },
      ],
    });

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: otherChoiceState,
      },
      participants: fixture.participants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const phaseChoiceCommands = response
      .json()
      .encounter.combatRoundState.commands.filter(
        (command: { type: string }) => command.type === "submit_phase_initiative_choice",
      );
    expect(
      phaseChoiceCommands.map((command: { participantId: string }) => command.participantId),
    ).toEqual(["encounter-participant-1"]);
  });

  it("keeps all pending phase initiative choices in GM encounter state", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();
    const ownChoice = backOutCombatRoundPhaseAttack({
      combatContext: fixture.participants[0]?.state.combat.combatContext,
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "player-1",
      },
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.roundState,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility: fixture.encounter.roleplayState?.visibility,
    });
    const otherChoiceState = combatRoundStateSchema.parse({
      ...ownChoice.state,
      commands: [
        ...ownChoice.state.commands,
        {
          ...ownChoice.command,
          createdAt: "2026-01-01T00:03:30.000Z",
          createdByUserId: "other-player",
          id: `${ownChoice.command.id}:other`,
          participantId: "encounter-participant-2",
        },
      ],
    });

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: otherChoiceState,
      },
      participants: fixture.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const phaseChoiceCommands = response
      .json()
      .encounter.combatRoundState.commands.filter(
        (command: { type: string }) => command.type === "submit_phase_initiative_choice",
      );
    expect(
      phaseChoiceCommands.map((command: { participantId: string }) => command.participantId),
    ).toEqual(["encounter-participant-1", "encounter-participant-2"]);
  });

  it("clears a phase back-out and restores the generated DB/Parry modifier", async () => {
    const fixture = preparePhaseCombatExperienceBackOutRouteFixture();
    const backedOut = backOutCombatRoundPhaseAttack({
      combatContext: fixture.participants[0]?.state.combat.combatContext,
      command: {
        createdAt: "2026-01-01T00:03:00.000Z",
        createdByUserId: "player-1",
      },
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.roundState,
      updatedAt: "2026-01-01T00:03:00.000Z",
      visibility: fixture.encounter.roleplayState?.visibility,
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...fixture.encounter,
        combatRoundState: backedOut.state,
      },
      participants: [
        {
          ...fixture.participants[0],
          state: {
            ...fixture.participants[0]?.state,
            combat: {
              ...fixture.participants[0]?.state.combat,
              combatContext: backedOut.combatContext,
            },
          },
        },
        fixture.participants[1]!,
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      },
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;
    expect(updatedParticipantState.combat.combatContext.modifierBuckets.situationDb).toEqual([
      doubleAttackPhase1DbParryModifier,
      doubleAttackPhase2DbParryModifier,
    ]);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("phase_1_actions");
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 2,
      step: "A1",
    });
    expect(updatedEncounter.combatRoundState.phaseResolutionCursor).toBeUndefined();
  });

  it("stores GM-edited Combat Experience difficulty on the active round", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      headers: { "x-glantri-combat-response": "active-v1" },
      method: "POST",
      payload: {
        difficulty: 36,
      },
      url: "/encounters/encounter-1/combat-round/combat-experience-difficulty",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      encounterId: "encounter-1",
      mutationPresentation: {
        difficulty: 36,
        windowOpen: true,
      },
      version: 1,
    });
    expect(response.json()).not.toHaveProperty("encounter");
    expect(response.json()).not.toHaveProperty("archivedRounds");
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledTimes(1);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.combatExperienceDifficulty).toBe(36);
  });

  it("returns a typed action conflict without exposing persistence details", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      user: mocks.adminUser,
    });
    const { EncounterCombatWriteError } = await import("@glantri/database");
    mocks.encounterService.updateCombatEncounter.mockRejectedValueOnce(
      new EncounterCombatWriteError(
        "transaction_conflict",
        "Internal Prisma P2034 detail should not be returned.",
      ),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      headers: { "x-glantri-combat-response": "active-v1" },
      method: "POST",
      payload: {
        difficulty: 36,
      },
      url: "/encounters/encounter-1/combat-round/combat-experience-difficulty",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "transaction_conflict",
      error: "Combat state changed while saving. Refresh and try again.",
    });
    expect(response.body).not.toContain("Prisma");
    expect(response.body).not.toContain("updateMany");
  });

  it("preserves stale-revision semantics after persistence detects a newer revision", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      user: mocks.adminUser,
    });
    const { EncounterCombatWriteError } = await import("@glantri/database");
    mocks.encounterService.updateCombatEncounter.mockRejectedValueOnce(
      new EncounterCombatWriteError(
        "stale_revision",
        "Encounter revision changed before combat state could be saved.",
      ),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        difficulty: 36,
      },
      url: "/encounters/encounter-1/combat-round/combat-experience-difficulty",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "stale_revision",
      error: "Combat state changed before this task could be completed.",
    });
  });

  it("lets the GM set a shared pairwise combat distance", async () => {
    const baseEncounter = makeCombatEncounter();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        participants: [
          baseEncounter.participants[0],
          {
            ...baseEncounter.participants[0],
            id: "encounter-participant-2",
            label: "City guard",
            scenarioParticipantId: "participant-2",
          },
        ],
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        distance: 4,
        participantAId: "encounter-participant-2",
        participantBId: "encounter-participant-1",
      },
      url: "/encounters/encounter-1/combat-round/pair-distance",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().edge).toMatchObject({
      distance: 4,
      participantAId: "encounter-participant-1",
      participantBId: "encounter-participant-2",
      source: "gm_set",
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.distanceState.edges).toMatchObject({
      "encounter-participant-1::encounter-participant-2": expect.objectContaining({
        distance: 4,
      }),
    });
  });

  it("recomputes visible declaration distance modifiers after a GM distance edit", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    }) as EncounterSession;
    const roundState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        attackOpportunities: buildCombatRoundDeclaredAttackOpportunities({
          actionId: "attack_parry",
          participantId: "encounter-participant-1",
          phaseContexts: {
            phase1: testCombatPhaseContext("participant-2"),
          },
          roundNumber: 1,
          sources: {
            phase1: {
              attackModeId: "mode-1",
              itemId: "item-weapon-template-broad-sword",
              sourceKind: "weapon",
              weaponInstanceId: "item-weapon-template-broad-sword",
              weaponSourceSlot: "primary",
              weaponTemplateId: "weapon-template-broad-sword",
            },
          },
        }),
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
        },
        roundNumber: 1,
      },
      participantId: "encounter-participant-1",
      state: initializeCombatRoundState({ encounter: baseEncounter }),
      submittedBy: "player",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        participants: encounterParticipants,
      },
      participants: [
        makeCombatScenarioParticipantWithWeapon({
          id: "participant-1",
          weaponName: "Broad sword",
          weaponRange: "2.0",
        }),
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        distance: 3,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
      },
      url: "/encounters/encounter-1/combat-round/pair-distance",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;

    expect(updateStateCall.state.combat.combatContext.modifierBuckets.situationObSkill).toEqual([
      expect.objectContaining({
        id: "generated:distance:phase1:ob-skill",
        notes: expect.stringContaining("distance: Broad sword preferred 2"),
        value: -2,
      }),
    ]);
    expect(
      updatedEncounter.combatRoundState.participants[0].declaration.combatContext.modifierBuckets
        .situationObSkill,
    ).toEqual([expect.objectContaining({ id: "generated:distance:phase1:ob-skill", value: -2 })]);
    expect(response.json().participants).toHaveLength(1);
  });

  it("returns player-safe visible pair distances without unrelated hidden pairs", async () => {
    const baseEncounter = makeCombatEncounter();
    const combatEncounter = makeCombatEncounter({
      participants: [
        baseEncounter.participants[0],
        {
          ...baseEncounter.participants[0],
          id: "encounter-participant-2",
          label: "Scyrian cavalry guy",
          scenarioParticipantId: "participant-2",
        },
        {
          ...baseEncounter.participants[0],
          id: "encounter-participant-3",
          label: "Hidden scout",
          scenarioParticipantId: "participant-3",
        },
      ],
      roleplayState: {
        actionLog: [],
        participantDescriptions: {},
        pendingSkillRolls: [],
        visibility: {
          "encounter-participant-1": {
            "encounter-participant-2": true,
          },
        },
      },
    }) as EncounterSession;
    const roundState = initializeCombatRoundState({ encounter: combatEncounter });
    const visibleDistanceState = setDistanceBetween({
      distance: 3,
      participantAId: "encounter-participant-1",
      participantBId: "encounter-participant-2",
      source: "gm_set",
      state: roundState.distanceState,
    });
    const distanceState = setDistanceBetween({
      distance: 4,
      participantAId: "encounter-participant-1",
      participantBId: "encounter-participant-3",
      source: "gm_set",
      state: visibleDistanceState,
    });

    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        ...combatEncounter,
        combatRoundState: {
          ...roundState,
          distanceState,
        },
      },
      participants: [
        makeCombatScenarioParticipant({
          id: "participant-1",
          snapshot: { displayName: "The Gladiator" },
        }),
        makeCombatScenarioParticipant({
          controlledByUserId: undefined,
          id: "participant-2",
          role: "npc",
          snapshot: { displayName: "Scyrian cavalry guy" },
          sourceType: "entity",
        }),
        makeCombatScenarioParticipant({
          controlledByUserId: undefined,
          id: "participant-3",
          role: "npc",
          snapshot: { displayName: "Hidden scout" },
          sourceType: "entity",
        }),
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().encounter.combatRoundState.distanceState.edges).toMatchObject({
      "encounter-participant-1::encounter-participant-2": expect.objectContaining({
        distance: 3,
      }),
    });
    expect(
      response.json().encounter.combatRoundState.distanceState.edges[
        "encounter-participant-1::encounter-participant-3"
      ],
    ).toBeUndefined();
  });

  it("returns materialized default pair distances from active server equipment without a GM save", async () => {
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: [
        {
          ...makeCombatEncounter().participants[0],
          characterId: "character-gladiator",
          id: "gladiator",
          label: "The Gladiator",
          scenarioParticipantId: "scenario-gladiator",
        },
        {
          ...makeCombatEncounter().participants[0],
          characterId: "character-scyrian",
          id: "scyrian",
          label: "Scyrian cavalry guy",
          scenarioParticipantId: "scenario-scyrian",
        },
      ],
    }) as EncounterSession;

    setupCombatDeclarationRoute({
      encounter: combatEncounter,
      participants: [
        makeCombatScenarioParticipant({
          characterId: "character-gladiator",
          id: "scenario-gladiator",
          snapshot: {
            displayName: "The Gladiator",
            equipmentState: makeServerWeaponEquipmentState({
              characterId: "character-gladiator",
              name: "Long sword",
              range: "3.0",
            }),
          },
        }),
        makeCombatScenarioParticipant({
          characterId: "character-scyrian",
          controlledByUserId: undefined,
          id: "scenario-scyrian",
          role: "npc",
          snapshot: {
            displayName: "Scyrian cavalry guy",
            equipmentState: makeServerWeaponEquipmentState({
              characterId: "character-scyrian",
              name: "Broad sword",
              range: "2.0",
            }),
          },
          sourceType: "entity",
        }),
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const distanceState = response.json().encounter.combatRoundState.distanceState;
    const edge = distanceState.edges[makeDistancePairKey("gladiator", "scyrian")];

    expect(edge).toMatchObject({
      distance: 3,
      source: "default_weapon_reach",
    });
    expect(edge.notes).toBeUndefined();
    expect(getDistanceBetween(distanceState, "gladiator", "scyrian")).toBe(3);
  });

  it("returns player-safe materialized default pair distances without a GM save", async () => {
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: [
        {
          ...makeCombatEncounter().participants[0],
          characterId: "character-gladiator",
          id: "gladiator",
          label: "The Gladiator",
          scenarioParticipantId: "scenario-gladiator",
        },
        {
          ...makeCombatEncounter().participants[0],
          characterId: "character-scyrian",
          id: "scyrian",
          label: "Scyrian cavalry guy",
          scenarioParticipantId: "scenario-scyrian",
        },
      ],
      roleplayState: {
        actionLog: [],
        participantDescriptions: {},
        pendingSkillRolls: [],
        visibility: {
          gladiator: {
            scyrian: true,
          },
        },
      },
    }) as EncounterSession;

    setupCombatDeclarationRoute({
      encounter: combatEncounter,
      participants: [
        makeCombatScenarioParticipant({
          characterId: "character-gladiator",
          controlledByUserId: "player-1",
          id: "scenario-gladiator",
          snapshot: {
            displayName: "The Gladiator",
            equipmentState: makeServerWeaponEquipmentState({
              characterId: "character-gladiator",
              name: "Long sword",
              range: "3.0",
            }),
          },
        }),
        makeCombatScenarioParticipant({
          characterId: "character-scyrian",
          controlledByUserId: undefined,
          id: "scenario-scyrian",
          role: "npc",
          snapshot: {
            displayName: "Scyrian cavalry guy",
            equipmentState: makeServerWeaponEquipmentState({
              characterId: "character-scyrian",
              name: "Broad sword",
              range: "2.0",
            }),
          },
          sourceType: "entity",
        }),
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const safeDistanceState = response.json().encounter.combatRoundState.distanceState;

    expect(getDistanceBetween(safeDistanceState, "gladiator", "scyrian")).toBe(3);
    expect(safeDistanceState.edges[makeDistancePairKey("gladiator", "scyrian")]).toMatchObject({
      distance: 3,
      source: "default_weapon_reach",
    });
  });

  it("rejects player attempts to set pairwise combat distance", async () => {
    const baseEncounter = makeCombatEncounter();
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        participants: [
          baseEncounter.participants[0],
          {
            ...baseEncounter.participants[0],
            id: "encounter-participant-2",
            label: "City guard",
            scenarioParticipantId: "participant-2",
          },
        ],
      },
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        distance: 4,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
      },
      url: "/encounters/encounter-1/combat-round/pair-distance",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects GM Combat Experience difficulty changes after a CE result exists", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const openedRoundState = setCombatRoundCombatExperienceDifficulty({
      difficulty: 26,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
    });
    const rolled = rollCombatRoundCombatExperience({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      skillTotal: 26,
      state: openedRoundState,
    });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        combatRoundState: rolled.state,
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        difficulty: 36,
      },
      url: "/encounters/encounter-1/combat-round/combat-experience-difficulty",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error:
        "Combat Experience difficulty cannot be changed after rolls have been recorded. Clear Combat Experience results first.",
    });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("uses the live character sheet displayed Combat Experience total when the participant snapshot omits skill data", async () => {
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      combatExperienceWindowOpen: true,
      participant: {
        characterId: "character-1",
        snapshot: {
          displayName: "The Gladiator",
        },
      },
      user: mocks.adminUser,
    });
    mocks.characterService.getCharacterById.mockResolvedValue({
      build: makeCombatExperienceCharacterBuild(),
      id: "character-1",
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-combat-experience",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.characterService.getCharacterById).toHaveBeenCalledWith("character-1");
    expect(response.json().combatExperience).toMatchObject({
      difficulty: 26,
      difficultyShift: 5,
      durationRounds: 0,
      effectiveTableTotal: 21,
      finalTotal: 26,
      modifierValue: 0,
      noRollRequired: false,
      resultBand: "active",
      rollD20: 5,
      rollTotal: 5,
      skillTotal: 21,
      skillTotalSource: "participant.sheetSummary.draftView.skills.totalSkill",
      trigger: "combat_start",
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        difficulty: 26,
        difficultyShift: 5,
        effectiveTableTotal: 21,
        finalTotal: 26,
        rollTotal: 5,
        skillTotal: 21,
        skillTotalSource: "participant.sheetSummary.draftView.skills.totalSkill",
      }),
      participantId: "encounter-participant-1",
      type: "roll_combat_experience",
    });
    expect(
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state.combatEffects
        .effects,
    ).toEqual([]);
  });

  it("rejects attack declarations without the required phase target", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Select a target for Phase 1.",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects Offensive Parry declarations without a prepared opponent", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "offensive_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Select an opponent to counter with Offensive Parry.",
    });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("canonicalizes and persists the selected Offensive Parry opponent", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    setupCombatDeclarationRoute({
      encounter: { participants: encounterParticipants },
      participants: [
        { id: "participant-1" },
        { controlledByUserId: "other-player", id: "participant-2" },
      ],
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "offensive_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
          selectedOpponentId: "participant-2",
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();

    expect(response.statusCode).toBe(200);
    const savedRoundState =
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState;
    expect(
      savedRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.declaration,
    ).toMatchObject({
      actionId: "offensive_parry",
      combatContext: { selectedOpponentId: "encounter-participant-2" },
    });
    expect(
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state.combat
        .combatContext.selectedOpponentId,
    ).toBe("encounter-participant-2");
  });

  it("keeps an exact Observe opponent identity ahead of a colliding legacy actor alias", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants().map((participant, index) =>
      index === 0 ? { ...participant, characterId: "encounter-participant-2" } : participant,
    ) as unknown as EncounterSession["participants"];
    setupCombatDeclarationRoute({
      encounter: { participants: encounterParticipants },
      participant: {
        characterId: "encounter-participant-2",
        snapshot: {
          build: makeDodgeCharacterBuild("character-actor", "Scyrian cavalry guy"),
          displayName: "Scyrian cavalry guy",
        },
      },
      participants: [
        {
          characterId: "encounter-participant-2",
          id: "participant-1",
          snapshot: {
            build: makeDodgeCharacterBuild("character-actor", "Scyrian cavalry guy"),
            displayName: "Scyrian cavalry guy",
          },
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: { displayName: "The Gladiator" },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "parry",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        scenarioParticipantId: "participant-1",
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: "encounter-participant-2",
        },
        secondaryActionId: "observe_opponent",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode, response.body).toBe(200);
    const savedRoundState =
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState;
    expect(
      savedRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.declaration,
    ).toMatchObject({
      actionId: "parry",
      secondaryActionContext: {
        action: "observe_opponent",
        targetParticipantId: "encounter-participant-2",
      },
      secondaryActionId: "observe_opponent",
    });
  });

  it("accepts the persisted Gladiator and Scyrian mutual-target Observe declaration", async () => {
    const gladiatorCombatantId = "scenario-cmp6v9wpm000fzgisztx5bho0";
    const scyrianCombatantId = "scenario-cmp6vb3gw000lzgisw3s2cojw";
    const gladiatorScenarioParticipantId = "cmp6v9wpm000fzgisztx5bho0";
    const scyrianScenarioParticipantId = "cmp6vb3gw000lzgisw3s2cojw";
    const encounterParticipants = [
      makeEncounterCombatParticipant({
        id: gladiatorCombatantId,
        label: "The Gladiator",
        order: 0,
        scenarioParticipantId: gladiatorScenarioParticipantId,
      }),
      makeEncounterCombatParticipant({
        id: scyrianCombatantId,
        label: "Scyrian cavalry guy",
        order: 1,
        scenarioParticipantId: scyrianScenarioParticipantId,
      }),
    ];
    const baseEncounter = makeCombatEncounter({
      currentRound: 3,
      participants: encounterParticipants,
    }) as EncounterSession;
    const initialState = initializeCombatRoundState({ encounter: baseEncounter });
    const gladiatorDeclared = recordCombatRoundDeclaration({
      declaration: {
        actionId: "feint_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseContexts: {
          phase1: {
            modifierBuckets: emptyModifierBuckets(),
            targetParticipantId: scyrianCombatantId,
          },
          phase2: {
            modifierBuckets: emptyModifierBuckets(),
            targetParticipantId: scyrianCombatantId,
          },
        },
        roundNumber: 3,
      },
      participantId: gladiatorCombatantId,
      state: initialState,
      submittedBy: "gm",
    });
    const observationRelationships = [
      {
        bestBonus: 0,
        completedAttempts: 0,
        id: `observation:${scyrianCombatantId}:${gladiatorCombatantId}`,
        observerParticipantId: scyrianCombatantId,
        roundsTowardNextAttempt: 2,
        targetParticipantId: gladiatorCombatantId,
      },
    ];
    const roundState = combatRoundStateSchema.parse({
      ...gladiatorDeclared,
      currentCursor: {
        participantId: scyrianCombatantId,
        roundNumber: 3,
        step: "DE",
      },
      distanceState: setDistanceBetween({
        distance: 3,
        participantAId: gladiatorCombatantId,
        participantBId: scyrianCombatantId,
        source: "gm_set",
        state: gladiatorDeclared.distanceState,
      }),
      observationRelationships,
      selectedParticipantId: scyrianCombatantId,
      selectedStep: "select_actions",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        currentRound: 3,
        participants: encounterParticipants,
      },
      participants: [
        {
          characterId: "23831e49-9060-493d-9eaf-65667c210ce5",
          controlledByUserId: "other-player",
          id: gladiatorScenarioParticipantId,
          snapshot: { displayName: "The Gladiator" },
        },
        {
          characterId: "ef0e0c82-09e9-43b2-a942-2d12264096ef",
          id: scyrianScenarioParticipantId,
          snapshot: {
            build: makeDodgeCharacterBuild(
              "ef0e0c82-09e9-43b2-a942-2d12264096ef",
              "Scyrian cavalry guy",
            ),
            displayName: "Scyrian cavalry guy",
          },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "parry",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        scenarioParticipantId: scyrianScenarioParticipantId,
        secondaryActionContext: {
          action: "observe_opponent",
          targetParticipantId: gladiatorCombatantId,
        },
        secondaryActionId: "observe_opponent",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode, response.body).toBe(200);
    const savedRoundState =
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState;
    expect(
      savedRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === gladiatorCombatantId,
      )?.declaration,
    ).toMatchObject({
      actionId: "feint_attack",
      phaseContexts: {
        phase1: { targetParticipantId: scyrianCombatantId },
        phase2: { targetParticipantId: scyrianCombatantId },
      },
    });
    expect(
      savedRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === scyrianCombatantId,
      )?.declaration,
    ).toMatchObject({
      actionId: "parry",
      secondaryActionContext: {
        action: "observe_opponent",
        targetParticipantId: gladiatorCombatantId,
      },
      secondaryActionId: "observe_opponent",
    });
    expect(savedRoundState.observationRelationships).toEqual(observationRelationships);
    expect(
      savedRoundState.observationRelationships.some(
        (relationship: { observerParticipantId: string; targetParticipantId: string }) =>
          relationship.observerParticipantId === gladiatorCombatantId &&
          relationship.targetParticipantId === scyrianCombatantId,
      ),
    ).toBe(false);
    expect(
      getDistanceBetween(savedRoundState.distanceState, gladiatorCombatantId, scyrianCombatantId),
    ).toBe(3);
    const reloadedRoundState = combatRoundStateSchema.parse(
      JSON.parse(JSON.stringify(savedRoundState)),
    );
    expect(
      reloadedRoundState.participants.find(
        (participant) => participant.participantId === scyrianCombatantId,
      )?.declaration?.secondaryActionContext,
    ).toEqual({
      action: "observe_opponent",
      targetParticipantId: gladiatorCombatantId,
    });
  });

  it("rejects GM Double Attack declarations unless both attack phases have targets", async () => {
    setupCombatDeclarationRoute({ user: mocks.adminUser });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        phaseAttackSources: {
          phase1: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_1",
            templateId: "virtual-weapon-template-punch",
          }),
          phase2: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_2",
            templateId: "virtual-weapon-template-kick",
          }),
        },
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Select a target for Phase 2.",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("normalizes the browser scenario-participant Feint target into the encounter command identity", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    setupCombatDeclarationRoute({
      encounter: { participants: encounterParticipants },
      participants: [
        { id: "participant-1" },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: {
            displayName: "City guard",
            sheetSummary: {
              adjustedStats: { dex: 9, int: 12 },
              draftView: {
                skills: [
                  {
                    effectiveSkillNumber: 6,
                    name: "Brawling",
                    skillId: "brawling",
                    totalSkill: 18,
                  },
                ],
              },
            },
          },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "feint_attack",
        additionalActionNotes: "A quick change of footing.",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        feint: {
          attackerSkillId: "dodge",
          method: "movement",
          targetParticipantId: "participant-2",
        },
        phaseAttackSources: {
          phase2: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_2",
            templateId: "virtual-weapon-template-punch",
          }),
        },
        phaseContexts: {
          phase1: testCombatPhaseContext("participant-2"),
          phase2: testCombatPhaseContext("stale-participant"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const declaration = updatedEncounter.combatRoundState.participants[0].declaration;
    expect(declaration).toMatchObject({
      actionId: "feint_attack",
      attackPhaseDefensivePenalties: [expect.objectContaining({ penalty: -4, phase: "phase2" })],
      attackOpportunities: [
        expect.objectContaining({
          origin: "feint_attack",
          phase: "phase2",
          slot: "attack_2",
          targetParticipantId: "encounter-participant-2",
        }),
      ],
      feint: {
        attackerSkillId: "dodge",
        defenderSkillId: "brawling",
        method: "movement",
        targetParticipantId: "encounter-participant-2",
      },
      phaseContexts: {
        phase1: expect.objectContaining({
          targetParticipantId: "encounter-participant-2",
        }),
        phase2: expect.objectContaining({
          targetParticipantId: "encounter-participant-2",
        }),
      },
    });
    expect(declaration.combatContext.modifierBuckets.situationDb).toEqual([
      expect.objectContaining({
        sourceActionId: "feint_attack",
        sourcePhase: "phase2",
        sourceRule: "attack-phase-defensive-penalty:ordinary_committed_attack",
        value: -4,
      }),
    ]);
    expect(updatedEncounter.combatRoundState.feintProposals).toEqual([
      expect.objectContaining({
        attackerParticipantId: "encounter-participant-1",
        defenderParticipantId: "encounter-participant-2",
        method: "movement",
        status: "awaiting_action_turn",
      }),
    ]);
  });

  it("derives a weapon Feint skill from the committed source instead of client input", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const weaponParticipant = makeDoubleAttackWeaponParticipant("weapon-template-dagger");
    const weaponTemplate = weaponTemplates.find(
      (candidate) => candidate.id === "weapon-template-dagger",
    );
    if (!weaponTemplate) throw new Error("Missing dagger fixture.");
    const modeId = weaponTemplate.attackModes?.[0]?.id;
    if (!modeId) throw new Error("Missing fencing sword mode fixture.");
    setupCombatDeclarationRoute({
      encounter: { participants: encounterParticipants },
      participants: [
        {
          ...weaponParticipant,
          snapshot: {
            ...weaponParticipant.snapshot,
            sheetSummary: {
              adjustedStats: { dex: 12, int: 9 },
              draftView: {
                skills: [
                  {
                    effectiveSkillNumber: 8,
                    name: weaponTemplate.weaponSkill,
                    skillId: "one_handed_edged",
                    totalSkill: 24,
                  },
                ],
              },
            },
          },
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: {
            displayName: "City guard",
            sheetSummary: {
              adjustedStats: { dex: 9, int: 12 },
              draftView: {
                skills: [
                  {
                    effectiveSkillNumber: 6,
                    name: "Brawling",
                    skillId: "brawling",
                    totalSkill: 18,
                  },
                ],
              },
            },
          },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const itemId = "item-weapon-template-dagger";
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "feint_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        feint: {
          attackerSkillId: "unrelated-client-skill",
          method: "weapon",
          targetParticipantId: "participant-2",
        },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            attackModeId: modeId,
            itemId,
            opportunitySlot: "attack_1",
            templateId: weaponTemplate.id,
          }),
          phase2: makeWeaponAttackSourceRef({
            attackModeId: modeId,
            itemId,
            opportunitySlot: "attack_2",
            templateId: weaponTemplate.id,
          }),
        },
        phaseContexts: {
          phase1: testCombatPhaseContext("participant-2"),
          phase2: testCombatPhaseContext("participant-2"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const declaration =
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
        .participants[0].declaration;
    expect(declaration.feint).toMatchObject({
      attackerSkillId: "one_handed_edged",
      attackerSkillLabel: weaponTemplate.weaponSkill,
      method: "weapon",
    });
    expect(declaration.phaseContexts.phase1.targetParticipantId).toBe("encounter-participant-2");
    expect(declaration.phaseContexts.phase2.targetParticipantId).toBe("encounter-participant-2");
    expect(declaration.attackOpportunities[0].targetParticipantId).toBe("encounter-participant-2");
    expect(declaration.feint.attackerSkillId).not.toBe("unrelated-client-skill");
  });

  it("rejects a genuinely missing Feint target with the player-facing target error", async () => {
    setupCombatDeclarationRoute({ user: mocks.adminUser });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "feint_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        feint: {
          attackerSkillId: "dodge",
          method: "movement",
        },
        phaseContexts: {
          phase1: testCombatPhaseContext("encounter-participant-2"),
          phase2: testCombatPhaseContext("encounter-participant-2"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Select a target for the Feint." });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects Adjust Range - Attack without a Phase 2 target", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "adjust_range_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: "Select an opponent for Adjust Distance-Attack.",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("normalizes one Adjust Distance target and persists the A1 proposal plus A2 attack", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    setupCombatDeclarationRoute({
      encounter: { participants: encounterParticipants },
      participants: [{ id: "participant-1" }, { id: "participant-2" }],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "adjust_range_attack",
        adjustDistance: {
          requestedDistance: 1,
          targetParticipantId: "participant-2",
        },
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseAttackSources: {
          phase2: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_2",
            templateId: "virtual-weapon-template-punch",
          }),
        },
        phaseContexts: {
          phase1: testCombatPhaseContext("participant-2"),
          phase2: testCombatPhaseContext("participant-2"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const roundState =
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState;
    expect(roundState.participants[0].declaration).toMatchObject({
      actionId: "adjust_range_attack",
      adjustDistance: {
        requestedDistance: 1,
        targetParticipantId: "encounter-participant-2",
      },
      attackOpportunities: [
        expect.objectContaining({
          origin: "adjust_range_attack",
          phase: "phase2",
          targetParticipantId: "encounter-participant-2",
        }),
      ],
      phaseContexts: {
        phase1: expect.objectContaining({ targetParticipantId: "encounter-participant-2" }),
        phase2: expect.objectContaining({ targetParticipantId: "encounter-participant-2" }),
      },
    });
    expect(roundState.adjustDistanceProposals).toEqual([
      expect.objectContaining({
        attackerParticipantId: "encounter-participant-1",
        defenderParticipantId: "encounter-participant-2",
        requestedDistance: 1,
        status: "awaiting_action_turn",
      }),
    ]);
  });

  it("creates the phase 2 DB/Parry modifier when a player declares Reactive attack", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "parry_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "parry_attack",
            lastDeclaredEncounterId: "encounter-1",
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [parryAttackDbParryModifier],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "parry_attack",
      attackPhaseDefensivePenalties: [expect.objectContaining({ penalty: -4, phase: "phase2" })],
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [parryAttackDbParryModifier],
        }),
      }),
      roundNumber: 1,
      submittedBy: "player",
    });
  });

  it("creates phase 1 and phase 2 Skill/OB and DB/Parry modifiers when a player declares Double Attack", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        phaseAttackSources: {
          phase1: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_1",
            templateId: "virtual-weapon-template-punch",
          }),
          phase2: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_2",
            templateId: "virtual-weapon-template-kick",
          }),
        },
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "double_attack",
            lastDeclaredEncounterId: "encounter-1",
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [doubleAttackPhase1DbParryModifier, doubleAttackPhase2DbParryModifier],
                situationObSkill: [
                  doubleAttackPhase1ObSkillModifier,
                  doubleAttackPhase2ObSkillModifier,
                ],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "double_attack",
      attackPhaseDefensivePenalties: [
        expect.objectContaining({ attackIndex: 1, penalty: -4, phase: "phase1" }),
        expect.objectContaining({ attackIndex: 2, penalty: -4, phase: "phase2" }),
      ],
      attackOpportunities: [
        expect.objectContaining({ attackModeId: "mode-1", phase: "phase1", slot: "attack_1" }),
        expect.objectContaining({ attackModeId: "mode-1", phase: "phase2", slot: "attack_2" }),
      ],
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [doubleAttackPhase1DbParryModifier, doubleAttackPhase2DbParryModifier],
          situationObSkill: [doubleAttackPhase1ObSkillModifier, doubleAttackPhase2ObSkillModifier],
        }),
      }),
      roundNumber: 1,
      phaseContexts: {
        phase1: expect.objectContaining({ attackModeId: "mode-1" }),
        phase2: expect.objectContaining({ attackModeId: "mode-1" }),
      },
      submittedBy: "player",
    });
  });

  it("persists the selected eligible mode for both same-source Double Attack opportunities", async () => {
    setupCombatDeclarationRoute({ participant: makeDoubleAttackWeaponParticipant() });
    const app = await buildScenarioTestApp();
    const itemId = "item-weapon-template-dagger";

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId,
            opportunitySlot: "attack_1",
            templateId: "weapon-template-dagger",
          }),
          phase2: makeWeaponAttackSourceRef({
            itemId,
            opportunitySlot: "attack_2",
            templateId: "weapon-template-dagger",
          }),
        },
        phaseContexts: {
          phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();
    expect(response.statusCode).toBe(200);
    const declaration =
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
        .participants[0].declaration;
    expect(declaration.phaseContexts).toMatchObject({
      phase1: { attackModeId: "mode-1" },
      phase2: { attackModeId: "mode-1" },
    });
    expect(declaration.attackOpportunities).toEqual([
      expect.objectContaining({ attackModeId: "mode-1", itemId, slot: "attack_1" }),
      expect.objectContaining({ attackModeId: "mode-1", itemId, slot: "attack_2" }),
    ]);
  });

  it.each([
    ["GM", mocks.adminUser],
    ["Player", mocks.playerUser],
  ] as const)(
    "accepts Broad sword's canonical Thrust mode for a same-source Double Attack submitted by %s",
    async (_viewer, user) => {
      setupCombatDeclarationRoute({
        participant: makeDoubleAttackWeaponParticipant("weapon-template-broad-sword"),
        user,
      });
      const app = await buildScenarioTestApp();
      const itemId = "item-weapon-template-broad-sword";

      const response = await app.inject({
        method: "POST",
        payload: {
          actionId: "double_attack",
          combatContext: { modifierBuckets: emptyModifierBuckets() },
          phaseAttackSources: {
            phase1: makeWeaponAttackSourceRef({
              attackModeId: "mode-2",
              itemId,
              opportunitySlot: "attack_1",
              templateId: "weapon-template-broad-sword",
            }),
            phase2: makeWeaponAttackSourceRef({
              attackModeId: "mode-2",
              itemId,
              opportunitySlot: "attack_2",
              templateId: "weapon-template-broad-sword",
            }),
          },
          phaseContexts: {
            phase1: {
              attackModeId: "mode-2",
              modifierBuckets: emptyModifierBuckets(),
              targetParticipantId: "target-1",
            },
            phase2: {
              attackModeId: "mode-2",
              modifierBuckets: emptyModifierBuckets(),
              targetParticipantId: "target-1",
            },
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });

      await app.close();
      expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
      const reloadedRoundState = combatRoundStateSchema.parse(
        mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState,
      );
      const declaration = reloadedRoundState.participants[0].declaration;
      if (!declaration) {
        throw new Error("Expected the Double Attack declaration to persist.");
      }
      expect(declaration.phaseContexts).toMatchObject({
        phase1: { attackModeId: "mode-2" },
        phase2: { attackModeId: "mode-2" },
      });
      expect(declaration.attackOpportunities).toEqual([
        expect.objectContaining({ attackModeId: "mode-2", itemId, slot: "attack_1" }),
        expect.objectContaining({ attackModeId: "mode-2", itemId, slot: "attack_2" }),
      ]);
    },
  );

  it("allows a different first mode when the same weapon's second opportunity uses eligible Thrust", async () => {
    setupCombatDeclarationRoute({
      participant: makeDoubleAttackWeaponParticipant("weapon-template-broad-sword"),
    });
    const app = await buildScenarioTestApp();
    const itemId = "item-weapon-template-broad-sword";

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            attackModeId: "mode-1",
            itemId,
            opportunitySlot: "attack_1",
            templateId: "weapon-template-broad-sword",
          }),
          phase2: makeWeaponAttackSourceRef({
            attackModeId: "mode-2",
            itemId,
            opportunitySlot: "attack_2",
            templateId: "weapon-template-broad-sword",
          }),
        },
        phaseContexts: {
          phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();
    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(
      mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
        .participants[0].declaration.attackOpportunities,
    ).toEqual([
      expect.objectContaining({ attackModeId: "mode-1", slot: "attack_1" }),
      expect.objectContaining({ attackModeId: "mode-2", slot: "attack_2" }),
    ]);
  });

  it("identifies an ineligible selected same-weapon mode precisely", async () => {
    setupCombatDeclarationRoute({
      participant: makeDoubleAttackWeaponParticipant("weapon-template-broad-sword"),
    });
    const app = await buildScenarioTestApp();
    const itemId = "item-weapon-template-broad-sword";

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            attackModeId: "mode-2",
            itemId,
            opportunitySlot: "attack_1",
            templateId: "weapon-template-broad-sword",
          }),
          phase2: makeWeaponAttackSourceRef({
            attackModeId: "mode-1",
            itemId,
            opportunitySlot: "attack_2",
            templateId: "weapon-template-broad-sword",
          }),
        },
        phaseContexts: {
          phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error:
        "The selected Phase 2 attack mode for Broad sword is not eligible for same-weapon Double Attack.",
    });
  });

  it("rejects a same-source Double Attack weapon with no eligible second profile", async () => {
    setupCombatDeclarationRoute({
      participant: makeDoubleAttackWeaponParticipant("weapon-template-mace"),
    });
    const app = await buildScenarioTestApp();
    const itemId = "item-weapon-template-mace";

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId,
            opportunitySlot: "attack_1",
            templateId: "weapon-template-mace",
          }),
          phase2: makeWeaponAttackSourceRef({
            itemId,
            opportunitySlot: "attack_2",
            templateId: "weapon-template-mace",
          }),
        },
        phaseContexts: {
          phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error:
        "The selected Phase 2 attack mode for Mace is not eligible for same-weapon Double Attack.",
    });
  });

  it.each([
    ["distinct committed weapons", "scenario-main-gauche", "secondary"],
    ["the same committed repeated-thrust weapon", "scenario-fencing-sword", "primary"],
  ] as const)(
    "accepts browser-equivalent scenario source references for %s",
    async (_label, phase2ItemId, phase2Slot) => {
      setupCombatDeclarationRoute({ participant: makeDoubleAttackTwoWeaponParticipant() });
      const app = await buildScenarioTestApp();
      const phase2TemplateId =
        phase2ItemId === "scenario-fencing-sword"
          ? "weapon-template-fencing-sword"
          : "weapon-template-main-gauche";

      const response = await app.inject({
        method: "POST",
        payload: {
          actionId: "double_attack",
          combatContext: { modifierBuckets: emptyModifierBuckets() },
          phaseAttackSources: {
            phase1: makeWeaponAttackSourceRef({
              itemId: "scenario-fencing-sword",
              opportunitySlot: "attack_1",
              slot: "primary",
              templateId: "weapon-template-fencing-sword",
            }),
            phase2: makeWeaponAttackSourceRef({
              attackModeId: phase2ItemId === "scenario-main-gauche" ? "mode-2" : "mode-1",
              itemId: phase2ItemId,
              opportunitySlot: "attack_2",
              slot: phase2Slot,
              templateId: phase2TemplateId,
            }),
          },
          phaseContexts: {
            phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
            phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });

      await app.close();
      expect(response.statusCode).toBe(200);
      expect(
        mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
          .participants[0].declaration.attackOpportunities,
      ).toEqual([
        expect.objectContaining({ itemId: "scenario-fencing-sword", slot: "attack_1" }),
        expect.objectContaining({ itemId: phase2ItemId, slot: "attack_2" }),
      ]);
    },
  );

  it("rejects an external or template ID submitted in place of a scenario item ID", async () => {
    setupCombatDeclarationRoute({ participant: makeDoubleAttackTwoWeaponParticipant() });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId: "weapon-template-fencing-sword",
            opportunitySlot: "attack_1",
            templateId: "weapon-template-fencing-sword",
          }),
          phase2: makeWeaponAttackSourceRef({
            itemId: "scenario-main-gauche",
            opportunitySlot: "attack_2",
            slot: "secondary",
            templateId: "weapon-template-main-gauche",
          }),
        },
        phaseContexts: {
          phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "The selected Phase 1 weapon source is missing.",
    });
  });

  it.each([
    ["1-h Javelin", "weapon-template-1-h-javelin"],
    ["Rapier", "weapon-template-rapier"],
  ])(
    "accepts the committed ready %s source for both Double Attack phases",
    async (_label, templateId) => {
      setupCombatDeclarationRoute({ participant: makeDoubleAttackWeaponParticipant(templateId) });
      const app = await buildScenarioTestApp();
      const itemId = `item-${templateId}`;

      const response = await app.inject({
        method: "POST",
        payload: {
          actionId: "double_attack",
          combatContext: { modifierBuckets: emptyModifierBuckets() },
          phaseAttackSources: {
            phase1: makeWeaponAttackSourceRef({
              itemId,
              opportunitySlot: "attack_1",
              templateId,
            }),
            phase2: makeWeaponAttackSourceRef({
              itemId,
              opportunitySlot: "attack_2",
              templateId,
            }),
          },
          phaseContexts: {
            phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
            phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });

      await app.close();
      expect(response.statusCode).toBe(200);
      expect(
        mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session.combatRoundState
          .participants[0].declaration.attackOpportunities,
      ).toEqual([
        expect.objectContaining({ attackModeId: "mode-1", itemId, slot: "attack_1" }),
        expect.objectContaining({ attackModeId: "mode-1", itemId, slot: "attack_2" }),
      ]);
    },
  );

  it("distinguishes a missing Double Attack source from an unready equipped item", async () => {
    setupCombatDeclarationRoute({ participant: makeDoubleAttackWeaponParticipant() });
    const missingSourceApp = await buildScenarioTestApp();
    const basePayload = {
      actionId: "double_attack",
      combatContext: { modifierBuckets: emptyModifierBuckets() },
      phaseContexts: {
        phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
        phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
      },
      scenarioParticipantId: "participant-1",
    };
    const missingSource = await missingSourceApp.inject({
      method: "POST",
      payload: {
        ...basePayload,
        phaseAttackSources: {
          phase2: makeWeaponAttackSourceRef({
            itemId: "item-weapon-template-dagger",
            opportunitySlot: "attack_2",
            templateId: "weapon-template-dagger",
          }),
        },
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await missingSourceApp.close();

    setupCombatDeclarationRoute({ participant: makeDoubleAttackWeaponParticipant() });
    const missingPhase2App = await buildScenarioTestApp();
    const missingPhase2Source = await missingPhase2App.inject({
      method: "POST",
      payload: {
        ...basePayload,
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId: "item-weapon-template-dagger",
            opportunitySlot: "attack_1",
            templateId: "weapon-template-dagger",
          }),
        },
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await missingPhase2App.close();

    setupCombatDeclarationRoute({ participant: makeDoubleAttackWeaponParticipant() });
    const unreadySourceApp = await buildScenarioTestApp();
    const unreadySource = await unreadySourceApp.inject({
      method: "POST",
      payload: {
        ...basePayload,
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId: "unready-item-weapon-template-dagger",
            opportunitySlot: "attack_1",
            templateId: "weapon-template-dagger",
          }),
          phase2: makeWeaponAttackSourceRef({
            itemId: "unready-item-weapon-template-dagger",
            opportunitySlot: "attack_2",
            templateId: "weapon-template-dagger",
          }),
        },
      },
      url: "/encounters/encounter-1/combat-declaration",
    });
    await unreadySourceApp.close();

    expect(missingSource.json()).toEqual({
      error: "Double Attack is missing its Phase 1 attack source.",
    });
    expect(missingPhase2Source.json()).toEqual({
      error: "Double Attack is missing its Phase 2 attack source.",
    });
    expect(unreadySource.json()).toEqual({
      error: "The selected Phase 1 weapon is not ready.",
    });
  });

  it("distinguishes an invalid Double Attack mode from source readiness", async () => {
    setupCombatDeclarationRoute({ participant: makeDoubleAttackWeaponParticipant() });
    const app = await buildScenarioTestApp();
    const itemId = "item-weapon-template-dagger";

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "double_attack",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId,
            opportunitySlot: "attack_1",
            templateId: "weapon-template-dagger",
          }),
          phase2: {
            ...makeWeaponAttackSourceRef({
              itemId,
              opportunitySlot: "attack_2",
              templateId: "weapon-template-dagger",
            }),
            attackModeId: "missing-mode",
          },
        },
        phaseContexts: {
          phase1: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
          phase2: { modifierBuckets: emptyModifierBuckets(), targetParticipantId: "target-1" },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({
      error: "Dagger does not have the selected Phase 2 attack mode.",
    });
  });

  it("keeps the closer Phase 1 risk separate from the ordinary Phase 2 attack penalty", async () => {
    setupCombatDeclarationRoute({
      encounter: { participants: makeTwoCombatEncounterParticipants() },
      participants: [{ id: "participant-1" }, { id: "participant-2" }],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "adjust_range_attack",
        adjustDistance: {
          requestedDistance: 1,
          targetParticipantId: "participant-2",
        },
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        movementId: "hold",
        phaseAttackSources: {
          phase2: makeUnarmedAttackSourceRef({
            opportunitySlot: "attack_2",
            templateId: "virtual-weapon-template-punch",
          }),
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: "adjust_range_attack",
            lastDeclaredEncounterId: "encounter-1",
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [adjustRangePhase2AttackPenalty, adjustRangePhase1DbParryModifier],
              }),
            }),
          }),
        }),
      }),
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "adjust_range_attack",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [adjustRangePhase2AttackPenalty, adjustRangePhase1DbParryModifier],
        }),
      }),
      phaseContexts: {
        phase1: expect.any(Object),
        phase2: expect.objectContaining({
          targetParticipantId: "encounter-participant-2",
        }),
      },
      roundNumber: 1,
      submittedBy: "player",
    });
  });

  it("preserves existing combat modifier buckets when a player declares", async () => {
    setupCombatDeclarationRoute({
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [
                  {
                    id: "gm-db-mod",
                    notes: "GM cover",
                    scope: "until",
                    value: 2,
                  },
                ],
                situationInitiative: [
                  {
                    durationRounds: 2,
                    id: "gm-initiative-mod",
                    notes: "Ready",
                    scope: "until",
                    value: 1,
                  },
                ],
                situationObSkill: [
                  {
                    id: "gm-ob-mod",
                    notes: "GM footing",
                    scope: "until",
                    value: -1,
                  },
                ],
              },
            },
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [
              {
                id: "player-db-mod",
                notes: "Player should not write this",
                scope: "until",
                value: 99,
              },
            ],
            situationInitiative: [
              {
                id: "player-initiative-mod",
                notes: "Player should not write this",
                scope: "until",
                value: 99,
              },
            ],
            situationObSkill: [
              {
                id: "player-ob-mod",
                notes: "Player should not write this",
                scope: "until",
                value: 99,
              },
            ],
          },
          selectedOpponentId: "guard",
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        state: expect.objectContaining({
          combat: expect.objectContaining({
            combatContext: expect.objectContaining({
              modifierBuckets: {
                general: [],
                situationDb: [
                  {
                    id: "gm-db-mod",
                    notes: "GM cover",
                    scope: "until",
                    value: 2,
                  },
                  attackParryDbParryModifier,
                ],
                situationInitiative: [
                  {
                    durationRounds: 2,
                    id: "gm-initiative-mod",
                    notes: "Ready",
                    scope: "until",
                    value: 1,
                  },
                ],
                situationObSkill: [
                  {
                    id: "gm-ob-mod",
                    notes: "GM footing",
                    scope: "until",
                    value: -1,
                  },
                ],
              },
              selectedOpponentId: "guard",
            }),
          }),
        }),
      }),
    );
  });

  it("commits an M1 review for another player's existing declaration", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              declaration: {
                actionId: "attack_parry",
                combatContext: {
                  modifierBuckets: {
                    ...emptyModifierBuckets(),
                    situationDb: [attackParryDbParryModifierEntry],
                  },
                },
                roundNumber: 1,
                submittedAt: "2026-07-30T07:59:00.000Z",
                submittedBy: "player",
              },
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "locked",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        additionalActionNotes: "Review accepted by the GM.",
        expectedParticipantRevision: "2026-07-30T08:00:00.000Z",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [attackParryDbParryModifierEntry],
            situationInitiative: [
              {
                durationRounds: 2,
                id: "gm-initiative-mod",
                notes: "Quick start",
                scope: "until",
                value: 1,
              },
            ],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        reviewStepSnapshot: {
          committedAt: "2026-07-30T08:00:01.000Z",
          defenseSummary: {
            db: "11",
            dm: "0",
            parry: "9",
            sourceName: "Sword / shield",
          },
          id: "snapshot:m1:encounter-participant-1",
          participantId: "encounter-participant-1",
          participantLabel: "The Gladiator",
          phase: "phase1",
          roundNumber: 1,
          step: "review_action_modifiers",
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("review_action_modifiers");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "gmEdited",
    );
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "attack_parry",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [attackParryDbParryModifier],
          situationInitiative: [
            {
              durationRounds: 2,
              id: "gm-initiative-mod",
              notes: "Quick start",
              scope: "until",
              value: 1,
            },
          ],
        }),
      }),
      roundNumber: 1,
      submittedBy: "gm",
      submittedByUserId: "gm-1",
    });
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_action_modifiers,
    ).toBe("gmEdited");
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        step: "M1",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        step: "M1",
      },
      type: "review_modifiers_phase1",
    });
    expect(updatedEncounter.combatRoundState.commands[0].facts.modifierReview).toMatchObject({
      changes: [
        expect.objectContaining({
          kind: "added",
          publicLabel: "Quick start",
        }),
      ],
      input: expect.objectContaining({
        participantId: "participant-1",
        phase: "M1",
        publicNote: "Review accepted by the GM.",
      }),
      reviewState: "committed",
    });
    expect(mocks.encounterService.commitCombatModifierReview).toHaveBeenCalledTimes(1);
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
    expect(updatedEncounter.combatRoundState.stepSnapshots).toContainEqual(
      expect.objectContaining({
        id: "snapshot:m1:encounter-participant-1",
        participantId: "encounter-participant-1",
        step: "review_action_modifiers",
      }),
    );
  });

  it("rejects an M1 review when the participant modifier revision is stale", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              declaration: {
                actionId: "parry",
                combatContext: { modifierBuckets: emptyModifierBuckets() },
                roundNumber: 1,
                submittedAt: "2026-07-30T07:59:00.000Z",
                submittedBy: "player",
              },
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "parry",
        combatContext: { modifierBuckets: emptyModifierBuckets() },
        expectedParticipantRevision: "stale-participant-revision",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      code: "stale_revision",
      error: "Participant modifier state changed while the review was open.",
    });
    expect(mocks.encounterService.commitCombatModifierReview).not.toHaveBeenCalled();
  });

  it("allows a GM to declare Reactive attack for another player's participant after DE", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "locked",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "parry_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
        phaseContexts: {
          phase2: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "encounter-target-1",
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toMatchObject({
      actionId: "parry_attack",
      combatContext: expect.objectContaining({
        modifierBuckets: expect.objectContaining({
          situationDb: [parryAttackDbParryModifier],
        }),
      }),
      roundNumber: 1,
      submittedBy: "gm",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            combatContext: expect.objectContaining({
              modifierBuckets: expect.objectContaining({
                situationDb: [parryAttackDbParryModifier],
              }),
            }),
            lastDeclaredActionId: "parry_attack",
            lastDeclaredEncounterId: "encounter-1",
          }),
        }),
      }),
    );
  });

  it("reviews canonical phase 2 modifiers without reconstructing a stale Phase 1 weapon", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_phase_2_modifiers",
          participants: [
            {
              declaration: {
                actionId: "parry_attack",
                combatContext: {
                  modifierBuckets: {
                    general: [],
                    situationDb: [parryAttackDbParryModifierEntry],
                    situationInitiative: [],
                    situationObSkill: [],
                  },
                },
                phaseContexts: {
                  phase2: testCombatPhaseContext("encounter-target-1"),
                },
                roundNumber: 1,
                submittedBy: "gm",
              },
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "submitted",
                initiative_phase_2: "pending",
                phase_1_actions: "complete",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "complete",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        // The inspector can still hold an unrelated draft. The canonical review task and
        // persisted declaration, not this draft, identify what is being reviewed.
        actionId: "feint_attack",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [
              {
                generated: true,
                id: "generated:parry-attack:phase2:initiative",
                notes: "GM reviewed reactive attack",
                scope: "until",
                sourceActionId: "parry_attack",
                sourcePhase: "phase2",
                sourceRule: "parry-attack-phase2-initiative",
                value: 5,
              },
            ],
            situationObSkill: [],
          },
        },
        phaseAttackSources: {
          phase1: makeWeaponAttackSourceRef({
            itemId: "missing-phase-1-item",
            opportunitySlot: "attack_1",
            templateId: "missing-phase-1-template",
          }),
        },
        phaseContexts: {
          phase2: testCombatPhaseContext("encounter-target-1"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_phase_2_modifiers,
    ).toBe("gmEdited");
    expect(updatedEncounter.combatRoundState.participants[0].declaration.actionId).toBe(
      "parry_attack",
    );
    expect(
      updatedEncounter.combatRoundState.participants[0].declaration.combatContext.modifierBuckets
        .situationInitiative,
    ).toEqual([
      expect.objectContaining({
        id: "generated:parry-attack:phase2:initiative",
        notes: "GM reviewed reactive attack",
        value: 5,
      }),
    ]);
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        step: "M2",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        step: "M2",
      },
      type: "review_modifiers_phase2",
    });
  });

  it("commits a fresh M2 review from participant-owned effects without mutating contextual rows", async () => {
    const combatExperience = canonicalReviewTestEffect({
      category: "general_fatigue",
      id: "combat-experience-effect",
      ownerParticipantId: "participant-1",
      sourceFamily: "combat_experience",
      value: -2,
    });
    const foreignFeint = canonicalReviewTestEffect({
      category: "db_parry",
      id: "feint-attacker-legacy-owner",
      ownerParticipantId: "encounter-participant-1",
      phase: "phase1",
      sourceFamily: "feint",
      value: -4,
    });
    const initiatorFeint = canonicalReviewTestEffect({
      category: "db_parry",
      id: "feint-initiator-owned",
      ownerParticipantId: "participant-1",
      phase: "phase1",
      sourceFamily: "feint",
      value: -4,
    });
    const defenderFeint = canonicalReviewTestEffect({
      category: "skill_ob",
      id: "feint-defender-context",
      ownerParticipantId: "participant-2",
      phase: "phase2",
      sourceFamily: "feint",
      value: 2,
    });
    const observeContext = canonicalReviewTestEffect({
      category: "skill_ob",
      id: "observe-relationship-context",
      ownerParticipantId: "participant-2",
      phase: "phase2",
      sourceFamily: "observe_relationship",
      value: 3,
    });
    const attackPenalty = {
      application: "percentage" as const,
      durationRounds: 1,
      generated: true,
      id: "generated:phase2-attack:db-parry",
      notes: "committed weapon attack: DB/Parry -4% in phase2",
      scope: "until" as const,
      sourceActionId: "feint_attack",
      sourceOpportunityId: "phase2-opportunity",
      sourcePhase: "phase2" as const,
      sourceRule: "attack-phase-defensive-penalty:ordinary_committed_attack",
      value: -4,
    };
    const contextualEntry = (lifecycle: ReturnType<typeof canonicalReviewTestEffect>) => ({
      application: "percentage" as const,
      canonicalLifecycle: lifecycle,
      generated: true,
      id: lifecycle.id,
      notes: lifecycle.publicLabel,
      scope: "until" as const,
      sourcePhase: lifecycle.applicability.phase,
      value: lifecycle.payload.kind === "numeric" ? lifecycle.payload.value : 0,
    });
    const reviewContext = {
      modifierBuckets: {
        general: [],
        situationDb: [
          attackPenalty,
          contextualEntry(initiatorFeint),
          contextualEntry(foreignFeint),
        ],
        situationInitiative: [],
        situationObSkill: [contextualEntry(defenderFeint), contextualEntry(observeContext)],
      },
    };
    const baseParticipantState = makeCombatScenarioParticipant().state;
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_phase_2_modifiers",
          participants: [
            {
              declaration: {
                actionId: "feint_attack",
                combatContext: reviewContext,
                phaseContexts: {
                  phase1: testCombatPhaseContext("encounter-participant-2"),
                  phase2: testCombatPhaseContext("encounter-participant-2"),
                },
                roundNumber: 1,
                submittedAt: "2026-07-30T07:59:00.000Z",
                submittedBy: "gm",
              },
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "submitted",
                initiative_phase_2: "pending",
                phase_1_actions: "complete",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "complete",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        state: {
          ...baseParticipantState,
          combatEffects: {
            effects: [
              {
                canonicalLifecycle: combatExperience,
                combatWide: true,
                combatModifierBucket: "general",
                createdAt: "2026-07-30T07:58:00.000Z",
                damage: 0,
                description: "Combat Experience",
                duration: "4 rounds",
                effectGroup: "general",
                generalDamage: 0,
                id: combatExperience.id,
                modifierValue: -2,
                sourceEventId: "combat-experience-event",
                status: "active",
                targetParticipantId: "participant-1",
                type: "general_modifier",
                updatedAt: "2026-07-30T07:58:00.000Z",
              },
            ],
            events: [],
          },
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "feint_attack",
        combatContext: reviewContext,
        phaseContexts: {
          phase1: testCombatPhaseContext("encounter-participant-2"),
          phase2: testCombatPhaseContext("encounter-participant-2"),
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const transaction = updatedEncounter.combatRoundState.commands[0].facts.modifierReview;
    expect(
      transaction.input.inputEffects.map((effect: { id: string }) => effect.id).sort(),
    ).toEqual([
      "combat-experience-effect",
      "feint-initiator-owned",
      "generated:phase2-attack:db-parry",
    ]);
    expect(transaction.changes).toEqual([]);
    expect(
      updatedEncounter.combatRoundState.participants[0].declaration.combatContext.modifierBuckets
        .situationDb,
    ).toEqual(expect.arrayContaining([expect.objectContaining({ id: foreignFeint.id })]));
    expect(
      updatedEncounter.combatRoundState.participants[0].declaration.combatContext.modifierBuckets
        .situationObSkill,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: defenderFeint.id }),
        expect.objectContaining({ id: observeContext.id }),
      ]),
    );
  });

  it("keeps Reactive attack executable through the browser/API persisted lifecycle", async () => {
    const encounterParticipants = [
      makeEncounterCombatParticipant({
        id: "encounter-participant-1",
        label: "The Gladiator",
        order: 0,
        scenarioParticipantId: "participant-1",
      }),
      makeEncounterCombatParticipant({
        id: "encounter-participant-2",
        label: "Scyrian cavalry guy",
        order: 1,
        scenarioParticipantId: "participant-2",
      }),
    ];
    const baseEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const baseRoundState =
      baseEncounter.combatRoundState ?? initializeCombatRoundState({ encounter: baseEncounter });
    const combatRoundState = {
      ...baseRoundState,
      distanceState: setDistanceBetween({
        distance: 2,
        participantAId: "encounter-participant-1",
        participantBId: "encounter-participant-2",
        source: "gm_set",
        state: baseRoundState.distanceState,
      }),
    };
    const fixture = setupMutableCombatRouteState({
      encounter: {
        ...baseEncounter,
        combatRoundState,
        currentRound: combatRoundState.roundNumber,
      },
      participants: [
        makeCombatScenarioParticipantWithWeapon({
          characterId: "character-1",
          id: "participant-1",
          snapshot: {
            build: makeDodgeCharacterBuild("character-1", "The Gladiator"),
            displayName: "The Gladiator",
            equipmentState: makeCanonicalWeaponDefenseEquipmentState({
              characterId: "character-1",
              templateId: "weapon-template-longsword",
            }),
            sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
          },
          weaponName: "Long sword",
          weaponRange: "3.0",
        }),
        makeCombatScenarioParticipantWithWeapon({
          characterId: "character-2",
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: {
            build: makeDodgeCharacterBuild("character-2", "Scyrian cavalry guy"),
            displayName: "Scyrian cavalry guy",
            equipmentState: makeCanonicalWeaponDefenseEquipmentState({
              characterId: "character-2",
              templateId: "weapon-template-broad-sword",
            }),
            sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
          },
          weaponName: "Broad sword",
          weaponRange: "2.0",
        }),
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const emptyCombatContext = {
      modifierBuckets: {
        general: [],
        situationDb: [],
        situationInitiative: [],
        situationObSkill: [],
      },
    };
    const roundState = () => fixture.encounter.combatRoundState as CombatRoundState;
    const participantState = (participantId: string) =>
      roundState().participants.find((participant) => participant.participantId === participantId);
    const commitCurrentStepViaBrowserPut = async () => {
      const startingStep = roundState().currentStep;

      for (let index = 0; index <= encounterParticipants.length; index += 1) {
        const current = roundState();
        const committedAt = `2026-01-01T00:10:0${index}.000Z`;
        const stateForCommit =
          current.currentStep === "review_phase_2_modifiers"
            ? ensureCombatRoundPhaseResolutionResultsForPhase({
                phase: "phase1",
                state: current,
                updatedAt: committedAt,
              })
            : current;
        const nextState = advanceCombatRoundStep(stateForCommit, {
          command: {
            createdAt: committedAt,
            participantId:
              stateForCommit.currentCursor?.participantId ??
              stateForCommit.selectedParticipantId ??
              "encounter-participant-1",
          },
          stepSnapshots: [],
        });
        const response = await app.inject({
          method: "PUT",
          payload: {
            session: {
              ...fixture.encounter,
              combatRoundState: nextState,
              currentRound: nextState.roundNumber,
            },
          },
          url: "/encounters/encounter-1",
        });

        expect(response.statusCode).toBe(200);

        if (roundState().currentStep !== startingStep) {
          return;
        }
      }
    };
    const rollInitiative = async (scenarioParticipantId: string, initiativeBase = 0) => {
      const response = await app.inject({
        method: "POST",
        payload: {
          initiativeBase,
          scenarioParticipantId,
        },
        url: "/encounters/encounter-1/combat-initiative",
      });

      expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    };
    const commitPhaseInitiative = async (phase: "phase1" | "phase2") => {
      const response = await app.inject({
        method: "POST",
        payload: { phase },
        url: "/encounters/encounter-1/combat-round/commit-phase-initiative-resolution",
      });

      expect(response.statusCode).toBe(200);
    };

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    try {
      const gladiatorDeclarationResponse = await app.inject({
        method: "POST",
        payload: {
          actionId: "parry_attack",
          combatContext: emptyCombatContext,
          movementId: "set_preferred_distance",
          movementIntent: {
            distancePreferences: [
              {
                desiredDistance: 3,
                source: "gm_proxy",
                targetParticipantId: "participant-2",
              },
            ],
            mode: "set_distance_preferences",
          },
          phaseContexts: {
            phase2: testCombatPhaseContext("participant-2"),
          },
          phaseAttackSources: {
            phase2: makeWeaponAttackSourceRef({
              itemId: "item-weapon-template-longsword",
              opportunitySlot: "attack_2",
              templateId: "weapon-template-longsword",
            }),
          },
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });
      const scyrianDeclarationResponse = await app.inject({
        method: "POST",
        payload: {
          actionId: "attack_parry",
          combatContext: emptyCombatContext,
          movementId: "hold",
          phaseContexts: {
            phase1: testCombatPhaseContext("participant-1"),
          },
          phaseAttackSources: {
            phase1: makeWeaponAttackSourceRef({
              itemId: "item-weapon-template-broad-sword",
              opportunitySlot: "attack_1",
              templateId: "weapon-template-broad-sword",
            }),
          },
          scenarioParticipantId: "participant-2",
        },
        url: "/encounters/encounter-1/combat-declaration",
      });

      expect(
        gladiatorDeclarationResponse.statusCode,
        JSON.stringify(gladiatorDeclarationResponse.json()),
      ).toBe(200);
      expect(
        scyrianDeclarationResponse.statusCode,
        JSON.stringify(scyrianDeclarationResponse.json()),
      ).toBe(200);
      expect(participantState("encounter-participant-1")?.declaration).toMatchObject({
        actionId: "parry_attack",
        phaseContexts: {
          phase2: {
            targetParticipantId: "participant-2",
          },
        },
      });
      expect(participantState("encounter-participant-2")?.declaration).toMatchObject({
        actionId: "attack_parry",
        phaseContexts: {
          phase1: {
            targetParticipantId: "participant-1",
          },
        },
      });
      expect(
        participantState("encounter-participant-1")?.declaration?.combatContext?.modifierBuckets
          .situationDb,
      ).toEqual([parryAttackDbParryModifier]);
      expect(
        participantState("encounter-participant-1")?.declaration?.combatContext?.modifierBuckets
          .situationInitiative,
      ).toEqual([
        expect.objectContaining({
          id: "generated:parry-attack:phase2:initiative",
          sourceRule: "parry-attack-phase2-initiative",
          value: 6,
        }),
      ]);
      await commitCurrentStepViaBrowserPut();
      expect(roundState().currentStep).toBe("review_action_modifiers");
      await commitCurrentStepViaBrowserPut();
      expect(roundState().currentStep).toBe("initiative_phase_1");
      expect(
        participantState("encounter-participant-1")?.declaration?.phaseContexts?.phase2,
      ).toMatchObject({
        targetParticipantId: "participant-2",
      });

      await rollInitiative("participant-1");
      await rollInitiative("participant-2");
      expect(roundState().currentStep).toBe("initiative_phase_1");

      await commitPhaseInitiative("phase1");
      expect(roundState().currentStep).toBe("phase_1_actions");
      expect(roundState().currentCursor).toMatchObject({
        participantId: "encounter-participant-2",
        step: "A1",
      });
      expect(
        getCombatRoundParticipantPhaseStepStatus({
          participantId: "encounter-participant-1",
          state: roundState(),
          step: "phase_1_actions",
        }),
      ).toBe("skipped");

      const attackResponse = await app.inject({
        method: "POST",
        payload: {
          defenderScenarioParticipantId: "participant-1",
          ob: 0,
          obSkillRaw: 0,
          phase: "phase1",
          scenarioParticipantId: "participant-2",
          weaponName: "Broad sword",
        },
        url: "/encounters/encounter-1/combat-round/roll-attack",
      });

      expect(attackResponse.statusCode).toBe(200);
      expect(
        getCombatRoundOutgoingAttackResultForParticipantPhase({
          participantId: "encounter-participant-2",
          phase: "phase1",
          state: roundState(),
        }),
      ).toMatchObject({
        attackerParticipantId: "encounter-participant-2",
        defenderParticipantId: "encounter-participant-1",
        hit: false,
      });
      expect(
        getCombatRoundParticipantPhaseStepStatus({
          participantId: "encounter-participant-2",
          state: roundState(),
          step: "phase_1_actions",
        }),
      ).toBe("gmEdited");
      expect(roundState().commands.at(-1)).toMatchObject({
        participantId: "encounter-participant-2",
        type: "roll_attack",
      });
      expect(
        combatRoundParticipantWasAttackedInPhase({
          participantId: "encounter-participant-1",
          phase: "phase1",
          state: roundState(),
        }),
      ).toBe(true);
      expect(
        participantState("encounter-participant-1")?.declaration?.combatContext?.modifierBuckets
          .situationInitiative,
      ).toEqual([
        expect.objectContaining({
          id: "generated:parry-attack:phase2:initiative",
          notes: "reactive attack: phase 1 attack missed; no parry needed",
          value: 6,
        }),
      ]);

      const incomingAttack = getCombatRoundOutgoingAttackResultForParticipantPhase({
        participantId: "encounter-participant-2",
        phase: "phase1",
        state: roundState(),
      });
      if (!incomingAttack) throw new Error("Reactive attack fixture did not record its trigger.");
      const afterDefenseReview = commitTestDefenseReview({
        attackResult: incomingAttack,
        state: roundState(),
      });
      await mocks.encounterService.updateEncounter({
        session: {
          ...fixture.encounter,
          combatRoundState: afterDefenseReview,
          currentRound: afterDefenseReview.roundNumber,
        },
      });
      expect(roundState().currentStep).toBe("phase_1_actions");
      const phase2ReviewResponse = await app.inject({
        method: "POST",
        payload: {
          ...buildBoundaryTaskPayload(
            roundState(),
            fixture.encounter.updatedAt,
            "phase2_modifier_review",
          ),
          expectedBoundary: "phase1_resolution",
          stepSnapshots: [],
          targetBoundary: "phase2_modifier_review",
        },
        url: "/encounters/encounter-1/combat-round/advance-current-step",
      });
      expect(phase2ReviewResponse.statusCode, JSON.stringify(phase2ReviewResponse.json())).toBe(
        200,
      );
      expect(roundState().currentStep).toBe("review_phase_2_modifiers");
      for (const [scenarioParticipantId, roundParticipantId] of [
        ["participant-1", "encounter-participant-1"],
        ["participant-2", "encounter-participant-2"],
      ] as const) {
        const declaration = participantState(roundParticipantId)?.declaration;
        const reviewResponse = await app.inject({
          method: "POST",
          payload: {
            actionId: declaration?.actionId,
            combatContext: declaration?.combatContext ?? emptyCombatContext,
            movementId: declaration?.movementId,
            movementIntent: declaration?.movementIntent,
            phaseContexts: declaration?.phaseContexts,
            scenarioParticipantId,
            secondaryActionId: declaration?.secondaryActionId,
          },
          url: "/encounters/encounter-1/combat-declaration",
        });

        expect(reviewResponse.statusCode, JSON.stringify(reviewResponse.json())).toBe(200);
        expect(
          getCombatRoundOutgoingAttackResultForParticipantPhase({
            participantId: "encounter-participant-2",
            phase: "phase1",
            state: roundState(),
          }),
        ).toMatchObject({ hit: false });
      }

      await commitCurrentStepViaBrowserPut();
      expect(roundState().currentStep).toBe("initiative_phase_2");
      expect(
        participantState("encounter-participant-1")?.declaration?.phaseContexts?.phase2,
      ).toMatchObject({
        targetParticipantId: "participant-2",
      });
      expect(
        combatRoundParticipantHasExecutablePhaseAttack({
          participantId: "encounter-participant-1",
          phase: "phase2",
          state: roundState(),
        }),
      ).toBe(true);

      await rollInitiative("participant-1", 6);
      await rollInitiative("participant-2");
      expect(roundState().currentStep).toBe("initiative_phase_2");

      await commitPhaseInitiative("phase2");
      expect(roundState().currentStep).toBe("phase_2_actions");
      expect(roundState().currentCursor).toMatchObject({
        participantId: "encounter-participant-1",
        step: "A2",
      });
      expect(roundState().roundEndReview).toBeUndefined();
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("rejects a player combat declaration after DE has advanced", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "locked",
              },
            },
          ],
          roundNumber: 1,
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationObSkill: [],
          },
        },
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-declaration",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("allows a player to roll phase 1 initiative for their assigned participant", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "initiative_phase_1",
          participants: [
            {
              declaration: {
                actionId: "attack_parry",
                roundNumber: 1,
                submittedAt: "2026-01-01T00:00:30.000Z",
                submittedBy: "player",
              },
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [{ id: "general-not-initiative", scope: "until", value: -99 }],
                situationDb: [],
                situationInitiative: [
                  {
                    id: "import:character_effect:initiative-penalty:initiative",
                    imported: true,
                    readOnly: true,
                    scope: "until",
                    sourceEffectId: "initiative-penalty",
                    sourceType: "character_effect",
                    value: -1,
                  },
                ],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: "attack_parry",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        initiativeBase: 3,
        initiativeModifierAdjustment: -1,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-initiative",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json().initiative.total).toBeGreaterThanOrEqual(0);
    expect(response.json().initiative.rolls.length).toBeGreaterThanOrEqual(1);
    expect(response.json().initiative.baseInitiative).toBe(0);
    expect(response.json().initiative.modifierAdjustment).toBe(-1);
    expect(response.json().initiative.total).toBe(
      response.json().initiative.baseInitiative +
        response.json().initiative.modifierAdjustment +
        response.json().initiative.rollTotal,
    );
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toMatchObject({
      rolls: response.json().initiative.rolls,
      total: response.json().initiative.total,
    });
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.initiative_phase_1).toBe(
      "submitted",
    );
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        step: "i1",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        step: "i1",
      },
      participantId: "encounter-participant-1",
      type: "roll_initiative_phase1",
    });
    expect(updatedEncounter.combatRoundState.events[0].facts.rollerPrivate).toMatchObject({
      baseInitiative: 0,
      modifierAdjustment: -1,
      total: response.json().initiative.total,
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
  });

  it("allows a GM to roll initiative for another player's participant", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "initiative_phase_2",
          participants: [
            {
              declaration: {
                actionId: "parry_attack",
                roundNumber: 1,
                submittedAt: "2026-01-01T00:00:30.000Z",
                submittedBy: "player",
              },
              initiatives: { phase1: { rolls: [6, 6], total: 12 } },
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "submitted",
                initiative_phase_2: "pending",
                phase_1_actions: "complete",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "complete",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "complete",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [{ id: "general-not-initiative", scope: "until", value: -99 }],
                situationDb: [],
                situationInitiative: [
                  {
                    id: "import:character_effect:initiative-bonus:initiative",
                    imported: true,
                    readOnly: true,
                    scope: "until",
                    sourceEffectId: "initiative-bonus",
                    sourceType: "character_effect",
                    value: 2,
                  },
                  {
                    generated: true,
                    id: "generated-phase2",
                    scope: "until",
                    sourcePhase: "phase2",
                    value: 3,
                  },
                  { id: "manual-initiative", scope: "until", value: 1 },
                  {
                    generated: true,
                    id: "generated-phase1",
                    scope: "until",
                    sourcePhase: "phase1",
                    value: 99,
                  },
                ],
                situationObSkill: [],
              },
            },
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        initiativeBase: 10,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-initiative",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().initiative).toMatchObject({
      baseInitiative: 0,
      modifierAdjustment: 6,
    });
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase2).toMatchObject({
      rolls: response.json().initiative.rolls,
      total: response.json().initiative.total,
    });
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.initiative_phase_2).toBe(
      "gmEdited",
    );
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      afterCursor: {
        participantId: "encounter-participant-1",
        step: "i2",
      },
      beforeCursor: {
        participantId: "encounter-participant-1",
        step: "i2",
      },
      type: "roll_initiative_phase2",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual(
      updatedEncounter.combatRoundState.commands[0].afterCursor,
    );
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_2");
  });

  it("rejects player initiative rolls for another participant", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "initiative_phase_1",
          participants: [
            {
              initiatives: {},
              label: "Other hero",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        controlledByUserId: "other-player",
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-initiative",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("runs a contiguous GM initiative prefix once and stops before player initiative", async () => {
    const prepared = makeStepAutomationFixture({
      playerControlledLast: true,
      startStep: "initiative_phase_1",
    });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const payload = stepAutomationRequest({
      encounter: prepared.encounter,
      operationFamily: "roll_remaining",
      participants: prepared.participants,
      runId: "initiative-prefix-run",
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    try {
      const response = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().workflow).toMatchObject({
        processedCount: 3,
        stepComplete: false,
        stopParticipantId: "encounter-participant-4",
        stopReason: "player_action_required",
      });
      const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
      expect(
        state.participants.slice(0, 3).map((participant) => participant.initiatives.phase1),
      ).toEqual([expect.any(Object), expect.any(Object), expect.any(Object)]);
      expect(state.participants[3]?.initiatives.phase1).toBeUndefined();
      expect(
        state.commands.filter((command) => command.facts.stepAutomation !== undefined),
      ).toHaveLength(3);
      expect(state.commands.some((command) => command.type === "complete_remaining_step")).toBe(
        true,
      );
      expect(
        state.participants.slice(0, 3).every((participant) => {
          const initiative = participant.initiatives.phase1;
          return (
            !initiative ||
            !("resolutionType" in initiative) ||
            initiative.resolutionType !== "bulk_skipped"
          );
        }),
      ).toBe(true);

      const commandCount = state.commands.length;
      const retry = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(retry.statusCode, retry.body).toBe(200);
      expect(retry.json().workflow).toMatchObject({ alreadyAccepted: true, processedCount: 3 });
      expect(
        combatRoundStateSchema.parse(fixture.encounter.combatRoundState).commands,
      ).toHaveLength(commandCount);
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("finishes GM-only initiative structurally and stops before A1", async () => {
    const prepared = makeStepAutomationFixture({ startStep: "initiative_phase_1" });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    try {
      const response = await app.inject({
        method: "POST",
        payload: stepAutomationRequest({
          encounter: prepared.encounter,
          operationFamily: "roll_remaining",
          participants: prepared.participants,
          runId: "initiative-complete-run",
        }),
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().workflow).toMatchObject({
        processedCount: 4,
        stepComplete: true,
        stopReason: "end_of_step",
      });
      const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
      expect(state.currentStep).toBe("phase_1_actions");
      expect(
        state.commands.some((command) => command.type === "commit_phase_initiative_resolution"),
      ).toBe(true);
      expect(state.commands.some((command) => command.type === "roll_attack")).toBe(false);
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("rolls ten remaining GM Combat Experience checks and stops before declarations", async () => {
    const prepared = makeCombatExperienceAutomationFixture({
      difficultyFixed: true,
      participantCount: 10,
    });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const payload = stepAutomationRequest({
      encounter: prepared.encounter,
      operationFamily: "roll_remaining",
      participants: prepared.participants,
      runId: "combat-experience-complete-run",
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    try {
      const response = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().workflow).toMatchObject({
        processedCount: 10,
        stepComplete: true,
        stopReason: "end_of_step",
      });
      expect(response.json().workflow.finalTask).toMatchObject({ kind: "submit_declaration" });
      const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
      expect(state.currentStep).toBe("select_actions");
      expect(state.participants.every((participant) => participant.combatExperience)).toBe(true);
      expect(state.participants.every((participant) => !participant.declaration)).toBe(true);
      expect(
        state.commands.filter((command) => command.type === "roll_combat_experience"),
      ).toHaveLength(10);
      expect(
        state.commands.filter((command) => command.facts.stepAutomation !== undefined),
      ).toHaveLength(10);

      const manual = rollCombatRoundCombatExperience({
        combatContext: prepared.participants[0]?.state.combat.combatContext,
        combatEffects: prepared.participants[0]?.state.combatEffects,
        command: {
          commandId: "manual-parity",
          createdAt: "2026-08-08T10:00:01.000Z",
          createdByUserId: "gm-1",
        },
        createdRevision: prepared.encounter.updatedAt,
        encounterId: prepared.encounter.id,
        participantId: "encounter-participant-1",
        rng: () => 0.5,
        scenarioId: "scenario-1",
        scenarioParticipantId: "participant-1",
        skillTotal: 11,
        skillTotalSource: "participant.snapshot.sheetSummary.draftView.skills.totalSkill",
        state: combatRoundStateSchema.parse(prepared.encounter.combatRoundState),
        trigger: "combat_start",
      });
      expect(state.participants[0]?.combatExperience).toMatchObject({
        ...manual.result,
        rolledAt: expect.any(String),
        rolledByUserId: mocks.adminUser.id,
      });
      const firstSavedParticipant = response
        .json()
        .participants.find(
          (participant: ScenarioParticipant) => participant.id === "participant-1",
        );
      expect(firstSavedParticipant.state.combatEffects.effects).toEqual([
        expect.objectContaining({
          duration: `${manual.result.durationRounds} ${
            manual.result.durationRounds === 1 ? "round" : "rounds"
          }`,
          modifierValue: manual.result.modifierValue,
          status: "active",
        }),
      ]);

      const commandCount = state.commands.length;
      const retry = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(retry.statusCode, retry.body).toBe(200);
      expect(retry.json().workflow).toMatchObject({
        alreadyAccepted: true,
        processedCount: 10,
      });
      expect(
        combatRoundStateSchema.parse(fixture.encounter.combatRoundState).commands,
      ).toHaveLength(commandCount);
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("rolls the contiguous GM Combat Experience prefix and stops before a player roll", async () => {
    const prepared = makeCombatExperienceAutomationFixture({
      difficultyFixed: true,
      playerControlledIndex: 3,
    });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    try {
      const response = await app.inject({
        method: "POST",
        payload: stepAutomationRequest({
          encounter: prepared.encounter,
          operationFamily: "roll_remaining",
          participants: prepared.participants,
          runId: "combat-experience-player-boundary-run",
        }),
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().workflow).toMatchObject({
        processedCount: 3,
        stepComplete: false,
        stopParticipantId: "encounter-participant-4",
        stopReason: "player_action_required",
      });
      const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
      expect(
        state.participants.slice(0, 3).every((participant) => participant.combatExperience),
      ).toBe(true);
      expect(state.participants[3]?.combatExperience).toBeUndefined();
      expect(
        state.commands.filter((command) => command.type === "roll_combat_experience"),
      ).toHaveLength(3);
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("stops before incomplete Combat Experience facts without mutating that participant", async () => {
    const prepared = makeCombatExperienceAutomationFixture({
      difficultyFixed: true,
      warningIndex: 1,
    });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);

    try {
      const response = await app.inject({
        method: "POST",
        payload: stepAutomationRequest({
          encounter: prepared.encounter,
          operationFamily: "roll_remaining",
          participants: prepared.participants,
          runId: "combat-experience-incomplete-run",
        }),
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });

      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().workflow).toMatchObject({
        processedCount: 1,
        stopParticipantId: "encounter-participant-2",
        stopReason: "combat_experience_review_required",
      });
      const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
      expect(state.participants[0]?.combatExperience).toBeDefined();
      expect(state.participants[1]?.combatExperience).toBeUndefined();
      expect(state.participants[2]?.combatExperience).toBeUndefined();
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("does not run Combat Experience automation before the GM fixes difficulty", async () => {
    const prepared = makeCombatExperienceAutomationFixture({});
    setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: prepared.encounter,
        operationFamily: "roll_remaining",
        participants: prepared.participants,
        runId: "combat-experience-difficulty-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    await app.close();

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().workflow).toMatchObject({
      processedCount: 0,
      stopReason: "gm_decision_required",
    });
  });

  it("rolls remaining canonical GM Health checks and stops before other SU work", async () => {
    const prepared = makeHealthAutomationFixture({ participantCount: 5 });
    const initialState = combatRoundStateSchema.parse(prepared.encounter.combatRoundState);
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const payload = stepAutomationRequest({
      encounter: prepared.encounter,
      operationFamily: "roll_remaining",
      participants: prepared.participants,
      runId: "health-complete-run",
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const app = await buildScenarioTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().workflow).toMatchObject({
        identity: { startProcessFamily: "health_bleed" },
        processedCount: 5,
        stepComplete: true,
        stopReason: "end_of_step",
      });
      expect(response.json().workflow.finalTask).not.toMatchObject({ kind: "health_review" });
      const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
      expect(
        state.commands.filter((command) => command.type === "roll_round_end_health_check"),
      ).toHaveLength(5);
      expect(
        state.commands.filter((command) => command.type === "commit_round_end_participant_review"),
      ).toHaveLength(5);
      expect(
        state.commands.filter((command) => command.facts.stepAutomation !== undefined),
      ).toHaveLength(10);
      expect(state.events.filter((event) => event.type === "health_check")).toHaveLength(5);
      expect(state.events.map((event) => String(event.type))).not.toContain("step_automation");

      const firstParticipant = prepared.participants[0]!;
      const firstRollId =
        initialState.roundEndReview?.participantReviews["encounter-participant-1"]
          ?.proposedHealthRolls[0]?.id;
      const manual = rollCombatRoundEndHealthCheck({
        combatEffects: firstParticipant.state.combatEffects,
        command: {
          commandId: "manual-health-parity",
          createdAt: "2026-08-09T10:00:01.000Z",
          createdByUserId: "gm-1",
        },
        createdRevision: prepared.encounter.updatedAt,
        healthRollId: firstRollId,
        participantId: "encounter-participant-1",
        rng: () => 0.9,
        rolledBy: "gm_proxy",
        state: initialState,
      });
      const automatedFirst = state.commands.find(
        (command) => command.type === "roll_round_end_health_check",
      );
      expect(automatedFirst?.facts).toMatchObject({
        difficulty: manual.command.facts.difficulty,
        finalTotal: manual.command.facts.finalTotal,
        healthStat: manual.command.facts.healthStat,
        nextBleedRate: manual.command.facts.nextBleedRate,
        previousBleedRate: manual.command.facts.previousBleedRate,
        rollD20: manual.command.facts.rollD20,
        rollTotal: manual.command.facts.rollTotal,
        success: manual.command.facts.success,
      });

      const commandCount = state.commands.length;
      const retry = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(retry.statusCode, retry.body).toBe(200);
      expect(retry.json().workflow).toMatchObject({
        alreadyAccepted: true,
        processedCount: 5,
      });
      expect(
        combatRoundStateSchema.parse(fixture.encounter.combatRoundState).commands,
      ).toHaveLength(commandCount);
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }
  });

  it("stops contiguous Health automation before player-owned and legacy-incomplete work", async () => {
    const playerPrepared = makeHealthAutomationFixture({ playerControlledIndex: 3 });
    const playerFixture = setupMutableCombatRouteState({
      encounter: playerPrepared.encounter,
      participants: playerPrepared.participants,
      user: mocks.adminUser,
    });
    const playerApp = await buildScenarioTestApp();
    const playerResponse = await playerApp.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: playerPrepared.encounter,
        operationFamily: "roll_remaining",
        participants: playerPrepared.participants,
        runId: "health-player-boundary-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    expect(playerResponse.statusCode, playerResponse.body).toBe(200);
    expect(playerResponse.json().workflow).toMatchObject({
      processedCount: 3,
      stepComplete: false,
      stopParticipantId: "encounter-participant-4",
      stopReason: "player_action_required",
    });
    expect(
      combatRoundStateSchema
        .parse(playerFixture.encounter.combatRoundState)
        .commands.filter((command) => command.type === "roll_round_end_health_check"),
    ).toHaveLength(3);
    await playerApp.close();

    vi.clearAllMocks();
    const legacyPrepared = makeHealthAutomationFixture({ legacyIndex: 1 });
    const legacyFixture = setupMutableCombatRouteState({
      encounter: legacyPrepared.encounter,
      participants: legacyPrepared.participants,
      user: mocks.adminUser,
    });
    const legacyApp = await buildScenarioTestApp();
    const legacyResponse = await legacyApp.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: legacyPrepared.encounter,
        operationFamily: "roll_remaining",
        participants: legacyPrepared.participants,
        runId: "health-legacy-boundary-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    expect(legacyResponse.statusCode, legacyResponse.body).toBe(200);
    expect(legacyResponse.json().workflow).toMatchObject({
      processedCount: 1,
      stopParticipantId: "encounter-participant-2",
      stopReason: "incomplete_legacy_state",
    });
    expect(
      combatRoundStateSchema
        .parse(legacyFixture.encounter.combatRoundState)
        .commands.filter((command) => command.type === "roll_round_end_health_check"),
    ).toHaveLength(1);
    await legacyApp.close();

    vi.clearAllMocks();
    const decisionPrepared = makeHealthAutomationFixture({ effectDecisionIndex: 0 });
    const decisionFixture = setupMutableCombatRouteState({
      encounter: decisionPrepared.encounter,
      participants: decisionPrepared.participants,
      user: mocks.adminUser,
    });
    const decisionApp = await buildScenarioTestApp();
    const decisionResponse = await decisionApp.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: decisionPrepared.encounter,
        operationFamily: "roll_remaining",
        participants: decisionPrepared.participants,
        runId: "health-effect-review-boundary-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    expect(decisionResponse.statusCode, decisionResponse.body).toBe(200);
    expect(decisionResponse.json().workflow).toMatchObject({
      processedCount: 1,
      stopParticipantId: "encounter-participant-1",
      stopReason: "effect_review_required",
    });
    const decisionState = combatRoundStateSchema.parse(decisionFixture.encounter.combatRoundState);
    expect(
      decisionState.commands.filter((command) => command.type === "roll_round_end_health_check"),
    ).toHaveLength(1);
    expect(
      decisionState.commands.filter(
        (command) => command.type === "commit_round_end_participant_review",
      ),
    ).toHaveLength(0);
    await decisionApp.close();
  });

  it("rolls remaining exact GM Observe contests, preserves parity, and retries idempotently", async () => {
    const prepared = makeObservationAutomationFixture({ participantCount: 4 });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const payload = stepAutomationRequest({
      encounter: prepared.encounter,
      operationFamily: "roll_remaining",
      participants: prepared.participants,
      runId: "observation-complete-run",
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.9);
    const app = await buildScenarioTestApp();

    try {
      const response = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(response.statusCode, response.body).toBe(200);
      expect(response.json().workflow).toMatchObject({
        identity: { startProcessFamily: "observation" },
        processedCount: 4,
        stepComplete: true,
        stopReason: "end_of_step",
      });
      expect(response.json().workflow.finalTask).not.toMatchObject({ kind: "observation_roll" });
      const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
      expect(state.commands.filter((command) => command.type === "roll_observation")).toHaveLength(
        4,
      );
      expect(
        state.commands.filter((command) => command.facts.stepAutomation !== undefined),
      ).toHaveLength(4);
      expect(state.observationAttempts).toHaveLength(4);
      expect(state.observationRelationships[0]).toMatchObject({
        bestBonus: 1,
        completedAttempts: 1,
        observerParticipantId: "encounter-participant-1",
        targetParticipantId: "encounter-participant-2",
      });
      expect(state.events.map((event) => String(event.type))).not.toContain("step_automation");
      const undone = undoLatestCombatRoundCommand({ state });
      expect(undone?.observationAttempts).toHaveLength(3);
      expect(undone?.observationRelationships.at(-1)).toMatchObject({
        completedAttempts: 0,
        observerParticipantId: "encounter-participant-4",
        roundsTowardNextAttempt: 2,
        targetParticipantId: "encounter-participant-1",
      });

      const commandCount = state.commands.length;
      const retry = await app.inject({
        method: "POST",
        payload,
        url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
      });
      expect(retry.statusCode, retry.body).toBe(200);
      expect(retry.json().workflow).toMatchObject({
        alreadyAccepted: true,
        processedCount: 4,
      });
      expect(
        combatRoundStateSchema.parse(fixture.encounter.combatRoundState).commands,
      ).toHaveLength(commandCount);
    } finally {
      randomSpy.mockRestore();
      await app.close();
    }

    vi.clearAllMocks();
    const manualPrepared = makeObservationAutomationFixture({
      observerCount: 1,
      participantCount: 2,
    });
    setupMutableCombatRouteState({
      encounter: manualPrepared.encounter,
      participants: manualPrepared.participants,
      user: mocks.adminUser,
    });
    const manualRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0.4);
    const manualApp = await buildScenarioTestApp();
    const manualResponse = await manualApp.inject({
      method: "POST",
      payload: observationRollRequest(manualPrepared),
      url: "/encounters/encounter-1/combat-round/roll-observation",
    });
    expect(manualResponse.statusCode, manualResponse.body).toBe(200);
    const manualAttempt = manualResponse.json().attempt;
    manualRandomSpy.mockRestore();
    await manualApp.close();

    vi.clearAllMocks();
    const automatedPrepared = makeObservationAutomationFixture({
      observerCount: 1,
      participantCount: 2,
    });
    const automatedFixture = setupMutableCombatRouteState({
      encounter: automatedPrepared.encounter,
      participants: automatedPrepared.participants,
      user: mocks.adminUser,
    });
    const automatedRandomSpy = vi.spyOn(Math, "random").mockReturnValue(0.4);
    const automatedApp = await buildScenarioTestApp();
    const automatedResponse = await automatedApp.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: automatedPrepared.encounter,
        operationFamily: "roll_remaining",
        participants: automatedPrepared.participants,
        runId: "observation-parity-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    expect(automatedResponse.statusCode, automatedResponse.body).toBe(200);
    const automatedAttempt = combatRoundStateSchema.parse(
      automatedFixture.encounter.combatRoundState,
    ).observationAttempts[0];
    expect(automatedAttempt).toMatchObject({
      bestBonusAfter: manualAttempt.bestBonusAfter,
      candidateBonus: manualAttempt.candidateBonus,
      difference: manualAttempt.difference,
      observerRoll: manualAttempt.observerRoll,
      targetRoll: manualAttempt.targetRoll,
    });
    automatedRandomSpy.mockRestore();
    await automatedApp.close();
  });

  it("stops contiguous Observe automation at a player observer without blocking a player target", async () => {
    const prepared = makeObservationAutomationFixture({
      participantCount: 3,
      playerControlledIndex: 2,
    });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: prepared.encounter,
        operationFamily: "roll_remaining",
        participants: prepared.participants,
        runId: "observation-player-boundary-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().workflow).toMatchObject({
      processedCount: 2,
      stepComplete: false,
      stopParticipantId: "encounter-participant-3",
      stopReason: "player_action_required",
    });
    const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
    expect(state.observationAttempts).toHaveLength(2);
    expect(state.observationAttempts[1]).toMatchObject({
      id: "observation:encounter-participant-2:encounter-participant-3:attempt:1",
    });
    expect(
      state.commands.filter(
        (command) =>
          command.type === "roll_observation" &&
          command.participantId === "encounter-participant-3",
      ),
    ).toHaveLength(0);
    await app.close();
  });

  it("stops Observe automation before invalid targets or incomplete relationship profiles", async () => {
    const ambiguousPrepared = makeObservationAutomationFixture({
      missingProfileIndex: 2,
      participantCount: 3,
    });
    const ambiguousFixture = setupMutableCombatRouteState({
      encounter: ambiguousPrepared.encounter,
      participants: ambiguousPrepared.participants,
      user: mocks.adminUser,
    });
    const ambiguousApp = await buildScenarioTestApp();
    const ambiguousResponse = await ambiguousApp.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: ambiguousPrepared.encounter,
        operationFamily: "roll_remaining",
        participants: ambiguousPrepared.participants,
        runId: "observation-review-boundary-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    expect(ambiguousResponse.statusCode, ambiguousResponse.body).toBe(200);
    expect(ambiguousResponse.json().workflow).toMatchObject({
      processedCount: 1,
      stopParticipantId: "encounter-participant-2",
      stopReason: "observation_review_required",
    });
    expect(
      combatRoundStateSchema.parse(ambiguousFixture.encounter.combatRoundState).observationAttempts,
    ).toHaveLength(1);
    await ambiguousApp.close();

    vi.clearAllMocks();
    const invalidTargetPrepared = makeObservationAutomationFixture({
      inactiveParticipantIndex: 1,
      observerCount: 1,
      participantCount: 2,
    });
    const invalidTargetFixture = setupMutableCombatRouteState({
      encounter: invalidTargetPrepared.encounter,
      participants: invalidTargetPrepared.participants,
      user: mocks.adminUser,
    });
    const invalidTargetApp = await buildScenarioTestApp();
    const invalidTargetResponse = await invalidTargetApp.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: invalidTargetPrepared.encounter,
        operationFamily: "roll_remaining",
        participants: invalidTargetPrepared.participants,
        runId: "observation-invalid-target-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    expect(invalidTargetResponse.statusCode, invalidTargetResponse.body).toBe(200);
    expect(invalidTargetResponse.json().workflow).toMatchObject({
      processedCount: 0,
      stopReason: "target_invalid",
    });
    expect(
      combatRoundStateSchema.parse(invalidTargetFixture.encounter.combatRoundState)
        .observationAttempts,
    ).toHaveLength(0);
    await invalidTargetApp.close();
  });

  it("accepts straightforward M1 reviews only after an explicit GM workflow request", async () => {
    const prepared = makeStepAutomationFixture({ startStep: "review_action_modifiers" });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: prepared.encounter,
        operationFamily: "accept_remaining",
        participants: prepared.participants,
        runId: "m1-complete-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });

    await app.close();
    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().workflow).toMatchObject({
      processedCount: 4,
      stepComplete: true,
      stopReason: "end_of_step",
    });
    const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
    expect(state.currentStep).toBe("initiative_phase_1");
    expect(
      state.participants.every((participant) => participant.initiatives.phase1 === undefined),
    ).toBe(true);
    expect(state.commands.some((command) => command.type === "roll_initiative_phase1")).toBe(false);
  });

  it("accepts straightforward M2 reviews and exposes i2 without rolling it", async () => {
    const prepared = makeStepAutomationFixture({ startStep: "review_phase_2_modifiers" });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: prepared.encounter,
        operationFamily: "accept_remaining",
        participants: prepared.participants,
        runId: "m2-complete-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    await app.close();

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().workflow).toMatchObject({
      processedCount: 4,
      stepComplete: true,
      stopReason: "end_of_step",
    });
    const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
    expect(state.currentStep).toBe("initiative_phase_2");
    expect(
      state.participants.every((participant) => participant.initiatives.phase2 === undefined),
    ).toBe(true);
    expect(state.commands.some((command) => command.type === "roll_initiative_phase2")).toBe(false);
  });

  it("accepts remaining prior-round NPC declarations in DE and stops before M1", async () => {
    const prepared = makeDeclarationAutomationFixture({ manuallyDeclaredCount: 1 });
    const preparedState = combatRoundStateSchema.parse(prepared.encounter.combatRoundState);
    expect(
      projectCombatNpcDeclarationProposal({
        encounterId: prepared.encounter.id,
        encounterRevision: prepared.encounter.updatedAt,
        participantId: "encounter-participant-2",
        proposalSequence: 0,
        state: preparedState,
      }),
    ).toMatchObject({ validation: { status: "complete" } });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const payload = stepAutomationRequest({
      encounter: prepared.encounter,
      operationFamily: "accept_remaining",
      participants: prepared.participants,
      runId: "declaration-complete-run",
    });

    const response = await app.inject({
      method: "POST",
      payload,
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().workflow).toMatchObject({
      processedCount: 3,
      stepComplete: true,
      stopReason: "end_of_step",
    });
    const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
    expect(state.currentStep).toBe("review_action_modifiers");
    expect(state.participants.every((participant) => participant.declaration)).toBe(true);
    expect(
      state.commands.filter(
        (command) =>
          command.roundNumber === 2 &&
          command.type === "declare_action" &&
          command.facts.declarationProposal !== undefined,
      ),
    ).toHaveLength(3);
    expect(
      state.commands.filter(
        (command) => command.roundNumber === 2 && command.type === "declare_action",
      ),
    ).toHaveLength(4);
    expect(state.commands.some((command) => command.type === "review_modifiers_phase1")).toBe(
      false,
    );

    const commandCount = state.commands.length;
    const retry = await app.inject({
      method: "POST",
      payload,
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    expect(retry.statusCode, retry.body).toBe(200);
    expect(retry.json().workflow).toMatchObject({ alreadyAccepted: true, processedCount: 3 });
    expect(combatRoundStateSchema.parse(fixture.encounter.combatRoundState).commands).toHaveLength(
      commandCount,
    );
    await app.close();
  });

  it("stops before a carry-forward whose previous target is no longer valid", async () => {
    const prepared = makeDeclarationAutomationFixture({ inactiveTargetForParticipantIndex: 1 });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: prepared.encounter,
        operationFamily: "accept_remaining",
        participants: prepared.participants,
        runId: "declaration-invalid-target-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    await app.close();

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().workflow).toMatchObject({
      processedCount: 1,
      stepComplete: false,
      stopParticipantId: "encounter-participant-2",
      stopReason: "target_invalid",
    });
    expect(response.json().declarationProposal).toMatchObject({
      participantId: "encounter-participant-2",
      validation: { reasons: ["target_invalid"], status: "invalid" },
    });
    const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
    expect(state.participants[0]?.declaration).toBeDefined();
    expect(state.participants[1]?.declaration).toBeUndefined();
    expect(state.participants[2]?.declaration).toBeUndefined();
  });

  it("stops the contiguous declaration run before player-owned work", async () => {
    const prepared = makeDeclarationAutomationFixture({ playerControlledIndex: 2 });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: prepared.encounter,
        operationFamily: "accept_remaining",
        participants: prepared.participants,
        runId: "declaration-player-boundary-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    await app.close();

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().workflow).toMatchObject({
      processedCount: 2,
      stepComplete: false,
      stopParticipantId: "encounter-participant-3",
      stopReason: "player_action_required",
    });
    const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
    expect(state.participants.slice(0, 2).every((participant) => participant.declaration)).toBe(
      true,
    );
    expect(state.participants[2]?.declaration).toBeUndefined();
    expect(state.participants[3]?.declaration).toBeUndefined();
  });

  it("commits an accepted attack proposal through the ordinary declaration lineage", async () => {
    const prepared = makeDeclarationAutomationFixture({
      attackParticipantIndex: 0,
      playerControlledIndex: 1,
    });
    const fixture = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: prepared.encounter,
        operationFamily: "accept_remaining",
        participants: prepared.participants,
        runId: "declaration-attack-parity-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    await app.close();

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json().workflow).toMatchObject({
      processedCount: 1,
      stopReason: "player_action_required",
    });
    const state = combatRoundStateSchema.parse(fixture.encounter.combatRoundState);
    const declaration = state.participants[0]?.declaration;
    expect(declaration).toMatchObject({
      actionId: "attack_parry",
      roundNumber: 2,
      submittedBy: "gm",
    });
    expect(declaration?.attackOpportunities).toEqual([
      expect.objectContaining({
        attackModeId: "mode-1",
        origin: "declared",
        phase: "phase1",
        status: "committed",
        targetParticipantId: "encounter-participant-2",
        weaponTemplateId: "virtual-weapon-template-punch",
      }),
    ]);
    const declarationCommand = state.commands.find(
      (command) => command.roundNumber === 2 && command.type === "declare_action",
    );
    expect(declarationCommand?.facts.declarationProposal).toMatchObject({
      kind: "proposal_acceptance",
      sourceCommandId: "round-1-declaration-1",
      sourceRoundNumber: 1,
    });
  });

  it("keeps the GM workflow endpoint private from player surfaces", async () => {
    const prepared = makeStepAutomationFixture({ startStep: "review_action_modifiers" });
    setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: stepAutomationRequest({
        encounter: prepared.encounter,
        operationFamily: "accept_remaining",
        participants: prepared.participants,
        runId: "player-forbidden-run",
      }),
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
  });

  it("rejects stale starts and genuinely replaced workflow tasks before mutation", async () => {
    const prepared = makeStepAutomationFixture({ startStep: "review_action_modifiers" });
    setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const valid = stepAutomationRequest({
      encounter: prepared.encounter,
      operationFamily: "accept_remaining",
      participants: prepared.participants,
      runId: "stale-or-replaced-run",
    });
    const stale = await app.inject({
      method: "POST",
      payload: { ...valid, expectedRevision: "2026-08-07T09:59:00.000Z" },
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    const replaced = await app.inject({
      method: "POST",
      payload: { ...valid, expectedTaskId: "replaced-task" },
      url: "/encounters/encounter-1/combat-round/run-gm-step-workflow",
    });
    await app.close();

    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ code: "stale_revision" });
    expect(replaced.statusCode).toBe(409);
    expect(replaced.json()).toMatchObject({ code: "task_changed" });
    expect(mocks.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
  });

  it("allows the current attacking player to roll the open phase 1 attack once", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const stepStatuses = {
      initiative_phase_1: "submitted",
      initiative_phase_2: "pending",
      phase_1_actions: "submitted",
      phase_2_actions: "pending",
      review_action_modifiers: "complete",
      review_phase_2_actions: "pending",
      review_phase_2_damage: "pending",
      review_phase_2_modifiers: "pending",
      round_summary: "pending",
      select_actions: "submitted",
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          commands: [
            {
              afterCursor: {
                participantId: "encounter-participant-1",
                roundNumber: 1,
                step: "i1",
              },
              beforeCursor: {
                participantId: "encounter-participant-1",
                roundNumber: 1,
                step: "i1",
              },
              createdAt: "2026-01-01T00:01:30.000Z",
              facts: {},
              id: "command-i1",
              participantId: "encounter-participant-1",
              roundNumber: 1,
              step: "i1",
              type: "roll_initiative_phase1",
            },
          ],
          currentCursor: {
            participantId: "encounter-participant-1",
            roundNumber: 1,
            step: "A1",
          },
          currentStep: "phase_1_actions",
          participants: [
            {
              attackResults: {},
              declaration: {
                actionId: "attack_parry",
                phaseContexts: {
                  phase1: {
                    targetParticipantId: "participant-2",
                  },
                },
                roundNumber: 1,
                submittedAt: "2026-01-01T00:01:00.000Z",
                submittedBy: "player",
              },
              initiatives: {
                phase1: {
                  baseInitiative: 0,
                  modifierAdjustment: 0,
                  rolls: [6],
                  rollTotal: 6,
                  total: 6,
                },
              },
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses,
            },
            {
              attackResults: {},
              initiatives: {
                phase1: {
                  baseInitiative: 0,
                  modifierAdjustment: 0,
                  rolls: [4],
                  rollTotal: 4,
                  total: 4,
                },
              },
              label: "City guard",
              participantId: "encounter-participant-2",
              stepStatuses,
            },
          ],
          phaseResolutionCursor: {
            participantId: "encounter-participant-1",
            phase: "phase1",
            substep: "attack",
          },
          phaseResolutionResults: [],
          phaseResolutionStatuses: {},
          roundNumber: 1,
          stepSnapshots: [
            {
              attackSummary: {
                attackMode: "C",
                dmb: "8",
                initiative: "3",
                maxCrits: "FS",
                ob: "10",
                weaponName: "Long sword",
              },
              committedAt: "2026-01-01T00:02:00.000Z",
              id: "snapshot-attack",
              participantId: "encounter-participant-1",
              participantLabel: "The Gladiator",
              phase: "phase1",
              roundNumber: 1,
              step: "phase_1_actions",
            },
            {
              committedAt: "2026-01-01T00:02:00.000Z",
              defenseSummary: {
                db: "11",
                dm: "0",
                parry: "9",
                sourceName: "Sword / shield",
              },
              id: "snapshot-defense",
              participantId: "encounter-participant-2",
              participantLabel: "City guard",
              phase: "phase1",
              roundNumber: 1,
              step: "phase_1_actions",
            },
          ],
        },
        participants: encounterParticipants,
      },
      participants: [
        { id: "participant-1" },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        attackIndex: 1,
        attackModeId: "mode-1",
        declarationId: "round:1:participant:encounter-participant-1:declaration",
        defenderScenarioParticipantId: "participant-2",
        ob: 10,
        obSkillRaw: 0,
        opportunityId: "round:1:participant:encounter-participant-1:phase1:attack_1",
        phase: "phase1",
        scenarioParticipantId: "participant-1",
        weaponSourceId: "unarmed:virtual-weapon-template-punch",
        weaponSourceSlot: "virtual",
        weaponTemplateId: "virtual-weapon-template-punch",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const attackResult = updatedEncounter.combatRoundState.participants[0].attackResults.phase1;
    expect(attackResult).toMatchObject({
      actionId: "attack_parry",
      attackIndex: 1,
      attackModeId: "mode-1",
      attackOpportunityId: "round:1:participant:encounter-participant-1:phase1:attack_1",
      attackerParticipantId: "encounter-participant-1",
      declarationId: "round:1:participant:encounter-participant-1:declaration",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 1,
      phase: "phase1",
      weaponSourceId: "unarmed:virtual-weapon-template-punch",
      weaponSourceSlot: "virtual",
      weaponTemplateId: "virtual-weapon-template-punch",
      weaponName: "Punch",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: {
        attackIndex: 1,
        attackModeId: "mode-1",
        attackOpportunityId: "round:1:participant:encounter-participant-1:phase1:attack_1",
        attackResultId: "1:opportunity:round:1:participant:encounter-participant-1:phase1:attack_1",
        obSkillRaw: 0,
        weaponSourceId: "unarmed:virtual-weapon-template-punch",
      },
      participantId: "encounter-participant-1",
      type: "roll_attack",
    });
    expect(
      updatedEncounter.combatRoundState.commands.at(-1)?.facts.distanceModifier,
    ).toBeUndefined();
    expect(updatedEncounter.combatRoundState.events.at(-1)?.facts.involvedOutcome).toMatchObject({
      attackIndex: 1,
      attackModeId: "mode-1",
      attackOpportunityId: "round:1:participant:encounter-participant-1:phase1:attack_1",
      weaponSourceId: "unarmed:virtual-weapon-template-punch",
    });
    expect(payload.command).toMatchObject({
      facts: expect.objectContaining({
        attackResultId: "1:opportunity:round:1:participant:encounter-participant-1:phase1:attack_1",
      }),
      type: "roll_attack",
    });
    expect(payload.commandEnvelope).toMatchObject({
      latestEvent: expect.objectContaining({
        resultId: "1:opportunity:round:1:participant:encounter-participant-1:phase1:attack_1",
        shortTitle: "Attack rolled",
      }),
      latestResult: {
        attackResultId: "1:opportunity:round:1:participant:encounter-participant-1:phase1:attack_1",
        attackerParticipantId: "encounter-participant-1",
        defenderParticipantId: "encounter-participant-2",
        kind: "attack",
        phase: "phase1",
      },
    });
    expect(payload.commandEnvelope).not.toHaveProperty("commands");
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(payload.encounter).toMatchObject({
      id: "encounter-1",
      combatRoundState: expect.objectContaining({
        currentStep: expect.any(String),
      }),
    });
    expect(payload.encounter.combatRoundState.participants[0].attackResults.phase1).toMatchObject({
      attackIndex: 1,
      attackModeId: "mode-1",
      attackOpportunityId: "round:1:participant:encounter-participant-1:phase1:attack_1",
      attackerParticipantId: "encounter-participant-1",
      defenderParticipantId: "encounter-participant-2",
      phase: "phase1",
      weaponSourceId: "unarmed:virtual-weapon-template-punch",
    });
  });

  it.each([
    ["attack mode", { attackModeId: "wrong-mode" }],
    ["attack index", { attackIndex: 2 }],
    ["weapon source", { weaponSourceId: "unarmed:virtual-weapon-template-kick" }],
  ])("rejects a live attack with a mismatched canonical %s identity", async (_label, mismatch) => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState(),
        participants: makeTwoCombatEncounterParticipants(),
      },
      participants: [
        { id: "participant-1" },
        { controlledByUserId: "other-player", id: "participant-2" },
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 10,
        obSkillRaw: 0,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
        ...mismatch,
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json().code).toBe("identity_mismatch");
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("gives hidden, nonexistent, wrong-target, and stale missile probes one zero-write response", async () => {
    const bow = weaponTemplates.find((candidate) => candidate.id === "weapon-template-bow");
    if (!bow?.missileProfile) throw new Error("Missing Short bow missile fixture.");
    const weaponItemId = "item-weapon-template-bow";
    const source = {
      attackModeId: "mode-1",
      itemId: weaponItemId,
      sourceKind: "weapon" as const,
      weaponInstanceId: weaponItemId,
      weaponSourceId: `weapon:${weaponItemId}`,
      weaponSourceSlot: "primary" as const,
      weaponTemplateId: bow.id,
    };
    const baseState = makeOpenPhase1AttackRoundState({ snapshotWeaponName: bow.name });
    const combatRoundState = {
      ...baseState,
      missileReadiness: [
        {
          aimCompletedRounds: 0,
          aimLevel: 0,
          aimRequiredRounds: 0,
          ammoFamily: bow.missileProfile.ammoFamily,
          ammoItemId: "arrow-stack-1",
          ammoItemRevision: "2026-01-01T00:00:00.000Z",
          baseCompletedRounds: 1,
          baseRequiredRounds: 1,
          family: bow.missileProfile.family,
          gmPreparationAdjustment: 0,
          id: `missile-readiness:encounter-participant-1:${weaponItemId}`,
          lastProgressRound: 1,
          participantId: "encounter-participant-1",
          phase: "phase1" as const,
          profile: bow.missileProfile,
          rapidShot: false,
          status: "ready" as const,
          targetParticipantId: "encounter-participant-2",
          updatedAt: "2026-01-01T00:02:00.000Z",
          weaponItemId,
          weaponTemplateId: bow.id,
        },
      ],
      participants: baseState.participants.map((participant, index) =>
        index === 0
          ? {
              ...participant,
              declaration: {
                ...participant.declaration,
                attackOpportunities: buildCombatRoundDeclaredAttackOpportunities({
                  actionId: "attack_parry",
                  participantId: "encounter-participant-1",
                  phaseContexts: {
                    phase1: testCombatPhaseContext("encounter-participant-2"),
                  },
                  roundNumber: 1,
                  sources: { phase1: source },
                }),
              },
            }
          : participant,
      ),
    };
    const encounterParticipants = makeFourCombatEncounterParticipants();
    const participants = [
      makeCombatScenarioParticipantWithWeapon({
        characterId: "character-1",
        id: "participant-1",
        weaponName: bow.name,
      }),
      makeCombatScenarioParticipant({ controlledByUserId: "target-player", id: "participant-2" }),
      makeCombatScenarioParticipant({ controlledByUserId: "hidden-player", id: "participant-3" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "uninvolved-player",
        id: "participant-4",
      }),
    ];
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState,
        participantVisibility: {
          "encounter-participant-1": {
            "encounter-participant-1": true,
            "encounter-participant-2": true,
            "encounter-participant-4": true,
          },
          "encounter-participant-2": {
            "encounter-participant-1": true,
            "encounter-participant-2": true,
          },
          "encounter-participant-3": { "encounter-participant-3": true },
          "encounter-participant-4": {
            "encounter-participant-1": true,
            "encounter-participant-2": true,
            "encounter-participant-4": true,
          },
        },
        participants: encounterParticipants,
      },
      participants,
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();
    const basePayload = {
      defenderParticipantId: "encounter-participant-2",
      phase: "phase1",
      scenarioParticipantId: "participant-1",
    };
    const probes = [
      { defenderParticipantId: "encounter-participant-3" },
      { defenderParticipantId: "missing-participant" },
      { defenderParticipantId: "encounter-participant-4" },
      { opportunityId: "stale-missile-opportunity" },
    ];
    const beforeState = JSON.stringify(combatRoundState);
    const responses = [];
    for (const probe of probes) {
      responses.push(
        await app.inject({
          method: "POST",
          payload: { ...basePayload, ...probe },
          url: "/encounters/encounter-1/combat-round/roll-attack",
        }),
      );
    }
    await app.close();

    expect(responses.map((response) => [response.statusCode, response.json()])).toEqual(
      probes.map(() => [
        409,
        {
          code: "task_mismatch",
          error: "Attack task is unavailable. Refresh combat before rolling.",
        },
      ]),
    );
    expect(JSON.stringify(combatRoundState)).toBe(beforeState);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
    expect(mocks.scenarioService.recordScenarioEvent).not.toHaveBeenCalled();
    expect(mocks.combatItemInteractionService.commitMissileWeaponAttack).not.toHaveBeenCalled();
  });

  it("accepts a narrow live attack request without a client Skill/OB total", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState(),
        participants: makeTwoCombatEncounterParticipants(),
      },
      participants: [
        { id: "participant-1" },
        { controlledByUserId: "other-player", id: "participant-2" },
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(
      updatedEncounter.combatRoundState.commands.at(-1)?.facts.attackerCalculation,
    ).toMatchObject({ authority: "canonical_scenario_state", effectiveOb: 1 });
  });

  it("commits the exact canonical Item only when an explicit thrown-mode attack is rolled", async () => {
    const baseState = makeOpenPhase1AttackRoundState({ snapshotWeaponName: "Dagger" });
    const itemId = "item-character-1-weapon-template-dagger";
    const source = {
      attackModeId: "mode-3",
      itemId,
      sourceKind: "weapon" as const,
      weaponInstanceId: itemId,
      weaponSourceId: `weapon:${itemId}`,
      weaponSourceSlot: "throwing" as const,
      weaponTemplateId: "weapon-template-dagger",
    };
    const combatRoundState = {
      ...baseState,
      participants: baseState.participants.map((participant, index) =>
        index === 0
          ? {
              ...participant,
              declaration: {
                ...participant.declaration,
                attackOpportunities: buildCombatRoundDeclaredAttackOpportunities({
                  actionId: "attack_parry",
                  participantId: "encounter-participant-1",
                  phaseContexts: {
                    phase1: testCombatPhaseContext("encounter-participant-2"),
                  },
                  roundNumber: 1,
                  sources: { phase1: source },
                }),
              },
            }
          : participant,
      ),
    };
    const attackerSnapshot = makeCanonicalCombatCalculationSnapshot({
      characterId: "character-1",
      displayName: "The Gladiator",
    });
    attackerSnapshot.build.progression.skills.push({
      category: "secondary",
      categoryId: "combat",
      groupId: "basic_missile_training",
      secondaryRanks: 8,
      skillId: "throwing",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState,
        participants: makeTwoCombatEncounterParticipants(),
      },
      participants: [
        {
          characterId: "character-1",
          id: "participant-1",
          snapshot: attackerSnapshot,
        },
        { controlledByUserId: "other-player", id: "participant-2" },
      ],
      user: mocks.playerUser,
    });
    mocks.combatItemInteractionService.commitThrownWeaponAttack.mockImplementation(
      async (input: { session: EncounterSession }) => ({ encounter: input.session }),
    );
    const app = await buildScenarioTestApp();

    expect(mocks.combatItemInteractionService.commitThrownWeaponAttack).not.toHaveBeenCalled();
    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        attackIndex: 1,
        attackModeId: "mode-3",
        declarationId: "round:1:participant:encounter-participant-1:declaration",
        defenderScenarioParticipantId: "participant-2",
        opportunityId: "round:1:participant:encounter-participant-1:phase1:attack_1",
        phase: "phase1",
        scenarioParticipantId: "participant-1",
        weaponSourceId: `weapon:${itemId}`,
        weaponSourceSlot: "throwing",
        weaponTemplateId: "weapon-template-dagger",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });
    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(mocks.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
    expect(mocks.combatItemInteractionService.commitThrownWeaponAttack).toHaveBeenCalledWith(
      expect.objectContaining({
        campaignId: "campaign-1",
        encounterId: "encounter-1",
        itemId,
        ownerCharacterId: "character-1",
        templateId: "weapon-template-dagger",
      }),
    );
    const committedInput = mocks.combatItemInteractionService.commitThrownWeaponAttack.mock
      .calls[0]?.[0] as { commandId: string; session: EncounterSession };
    expect(committedInput.commandId).toBeTruthy();
    expect(committedInput.session.combatRoundState?.commands.at(-1)).toMatchObject({
      id: committedInput.commandId,
      facts: expect.objectContaining({
        attackModeId: "mode-3",
        weaponSourceId: `weapon:${itemId}`,
      }),
      type: "roll_attack",
    });
  });

  it.each([
    ["player", mocks.playerUser],
    ["GM proxy", mocks.adminUser],
  ])("uses canonical Skill/OB for a %s attack", async (_label, user) => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const attackerState = makeCanonicalAttackModifierParticipantState();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState({ snapshotOb: "10" }),
        participants: encounterParticipants,
      },
      participants: [
        { id: "participant-1", state: attackerState },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
      user,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        attackerModifierFingerprint: "falsified-client-signature",
        defenderScenarioParticipantId: "participant-2",
        ob: 14,
        obSkillRaw: 2,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toMatchObject({
      ob: 3,
      phase: "phase1",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: {
        obSkillRaw: 2,
      },
      type: "roll_attack",
    });
    expect(updatedEncounter.combatRoundState.events.at(-1)?.facts.rollerPrivate).toMatchObject({
      ob: 3,
    });
  });

  it("applies an established Observe Opponent bonus once to the matching attack", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const roundState = {
      ...makeOpenPhase1AttackRoundState({ snapshotOb: "10" }),
      observationRelationships: [
        {
          bestBonus: 3,
          completedAttempts: 1,
          id: "observation:encounter-participant-1:encounter-participant-2",
          observerParticipantId: "encounter-participant-1",
          roundsTowardNextAttempt: 0,
          targetParticipantId: "encounter-participant-2",
        },
      ],
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        participants: encounterParticipants,
      },
      participants: [
        {
          id: "participant-1",
          snapshot: { displayName: "The Gladiator" },
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: { displayName: "Scyrian cavalry guy" },
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 10,
        obSkillRaw: 3,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toMatchObject({
      ob: 4,
      phase: "phase1",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: {
        obBeforeOpponentSpecificModifier: 1,
        obSkillRaw: 3,
        opponentSpecificObPercentageAdjustment: 3,
        opponentSpecificObRaw: 3,
        opponentSpecificObModifierRows: [
          {
            label: "Observe Opponent · Scyrian cavalry guy",
            value: 3,
          },
        ],
      },
      type: "roll_attack",
    });
    expect(updatedEncounter.combatRoundState.events.at(-1)?.facts.rollerPrivate).toMatchObject({
      ob: 4,
      obBeforeOpponentSpecificModifier: 1,
      opponentSpecificObModifierRows: [
        {
          label: "Observe Opponent · Scyrian cavalry guy",
          value: 3,
        },
      ],
    });
  });

  it("ignores a falsified submitted Skill/OB total", async () => {
    const attackerState = makeCanonicalAttackModifierParticipantState();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState(),
        participants: makeTwoCombatEncounterParticipants(),
      },
      participants: [
        { id: "participant-1", state: attackerState },
        { controlledByUserId: "other-player", id: "participant-2" },
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 14,
        obSkillRaw: 1,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1.ob).toBe(3);
  });

  it("uses the existing generated distance Skill/OB row for the current player phase 1 attack", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const distanceModifierEntry = {
      durationRounds: 1,
      generated: true,
      id: "generated:distance:phase1:ob-skill",
      notes: "distance: Long sword preferred 3 · actual 5 · nearest 3 · Skill/OB -4",
      scope: "until",
      sourceActionId: "attack_parry",
      sourcePhase: "phase1",
      sourceRule: "distance-ob-skill-phase1",
      value: -4,
    };
    const participantState = {
      ...makeCombatScenarioParticipant().state,
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [distanceModifierEntry],
          },
        },
      },
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState({
          distance: 5,
          modifierEntries: [distanceModifierEntry],
          snapshotOb: "6",
        }),
        participants: encounterParticipants,
      },
      participants: [
        { id: "participant-1", state: participantState },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 6,
        obSkillRaw: -4,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const attackResult = updatedEncounter.combatRoundState.participants[0].attackResults.phase1;

    expect(attackResult).toMatchObject({
      ob: -3,
      phase: "phase1",
      weaponName: "Punch",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: {
        distanceModifier: {
          createdCombatModifierIds: [],
          modifierId: "generated:distance:phase1:ob-skill",
          notes: "distance: Long sword preferred 3 · actual 5 · nearest 3 · Skill/OB -4",
          preferredDistances: [],
          value: -4,
        },
      },
      type: "roll_attack",
    });
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("applies a persisted generated distance row when the attack snapshot OB is stale", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const distanceModifierEntry = {
      durationRounds: 1,
      generated: true,
      id: "generated:distance:phase1:ob-skill",
      notes: "distance: Broad sword preferred 2 · actual 3 · nearest 2 · Skill/OB -2",
      scope: "until",
      sourceActionId: "attack_parry",
      sourcePhase: "phase1",
      sourceRule: "distance-ob-skill-phase1",
      value: -2,
    };
    const participantState = {
      ...makeCombatScenarioParticipant().state,
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [distanceModifierEntry],
          },
        },
      },
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState({
          distance: 3,
          snapshotOb: "12",
          snapshotWeaponName: "Broad sword",
        }),
        participants: encounterParticipants,
      },
      participant: {
        id: "participant-1",
        state: participantState,
      },
      participants: [
        {
          id: "participant-1",
          state: participantState,
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 10,
        obSkillRaw: -2,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const attackResult = updatedEncounter.combatRoundState.participants[0].attackResults.phase1;

    expect(attackResult).toMatchObject({
      ob: -1,
      phase: "phase1",
      weaponName: "Punch",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)?.facts.distanceModifier).toMatchObject(
      {
        modifierId: "generated:distance:phase1:ob-skill",
        notes: "distance: Broad sword preferred 2 · actual 3 · nearest 2 · Skill/OB -2",
        value: -2,
      },
    );
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("replays a legacy Offensive Parry flat DB record without reclassifying its unit", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const defenderState = {
      ...makeCombatScenarioParticipant({ id: "participant-2" }).state,
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [
              {
                application: "flat_db",
                durationRounds: 1,
                expiresAtRound: 1,
                generated: true,
                id: "generated:offensive-parry:round:flat-db",
                notes: "offensive parry: DB -2 for the declared round",
                scope: "until",
                sourceActionId: "offensive_parry",
                sourceRoundNumber: 1,
                sourceRule: "offensive-parry-round-db",
                value: -2,
              },
            ],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
      },
    };
    const roundState = makeOpenPhase1AttackRoundState();
    const defenderSnapshot = roundState.stepSnapshots[1];
    if (!defenderSnapshot?.defenseSummary) {
      throw new Error("Expected the defender snapshot fixture.");
    }
    defenderSnapshot.defenseSummary.db = "15";

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        participants: encounterParticipants,
      },
      participants: [
        makeCombatScenarioParticipant({ id: "participant-1" }),
        {
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: {
            build: {},
            displayName: "Scyrian cavalry guy",
            equipmentState: {},
          },
          state: defenderState,
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 10,
        obSkillRaw: 0,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toMatchObject({
      defenderDb: 13,
      ob: 1,
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: { defenderFlatDbAdjustment: -2 },
      type: "roll_attack",
    });
  });

  it("binds a post-Adjust Distance player attack to current canonical modifier contributions", async () => {
    const fixture = makePostAdjustDistanceAttackFixture();
    const { encounter } = setupCombatDeclarationRoute({
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const historyResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    expect(historyResponse.statusCode, JSON.stringify(historyResponse.json())).toBe(200);
    const validation = historyResponse.json().history.currentAttackModifierValidation;
    expect(validation).toMatchObject({
      actionId: "attack_parry",
      attackContextAvailability: "complete",
      attackerModifierFingerprint: "v1:82d757a9",
      attackerParticipantId: "encounter-participant-1",
      defenderParticipantId: "encounter-participant-2",
      encounterId: "encounter-1",
      expectedRevision: encounter.updatedAt,
      obSkillRaw: -2,
      pairKey: "participant-1::participant-2",
      phase: "phase1",
      taskId: expect.any(String),
    });
    expect(validation).not.toHaveProperty("defenderDb");
    expect(validation).not.toHaveProperty("defenderInventory");
    const reloadResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    expect(reloadResponse.json().history.currentAttackModifierValidation).toEqual(validation);
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    const gmProxyResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history?perspectiveParticipantId=encounter-participant-1",
    });
    expect(gmProxyResponse.json().history.currentAttackModifierValidation).toEqual(validation);
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);

    const attackResponse = await app.inject({
      method: "POST",
      payload: {
        attackerModifierFingerprint: validation.attackerModifierFingerprint,
        defenderScenarioParticipantId: "participant-2",
        expectedRevision: validation.expectedRevision,
        modifierValidationTaskId: validation.taskId,
        ob: 8,
        obSkillRaw: validation.obSkillRaw,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(attackResponse.statusCode, JSON.stringify(attackResponse.json())).toBe(200);
    expect(
      mocks.encounterService.updateEncounter.mock.calls
        .at(-1)?.[0]
        ?.session.combatRoundState.commands.at(-1),
    ).toMatchObject({
      facts: { obSkillRaw: -2 },
      participantId: "encounter-participant-1",
      type: "roll_attack",
    });
  });

  it("uses server-composed canonical defense instead of the live presentation snapshot", async () => {
    const fixture = makePostAdjustDistanceAttackFixture();
    const misleadingState = combatRoundStateSchema.parse({
      ...fixture.encounter.combatRoundState,
      stepSnapshots: fixture.encounter.combatRoundState.stepSnapshots.map((snapshot) =>
        snapshot.participantId === "encounter-participant-2" && snapshot.defenseSummary
          ? {
              ...snapshot,
              defenseSummary: { ...snapshot.defenseSummary, db: "999", dm: "99" },
            }
          : snapshot,
      ),
    });
    const defender = {
      ...fixture.participants[1],
      characterId: "character-2",
      snapshot: {
        ...fixture.participants[1]?.snapshot,
        build: makeDodgeCharacterBuild("character-2", "Scyrian cavalry guy"),
        displayName: "Scyrian cavalry guy",
        equipmentState: makeMovementBurdenEquipmentState({ characterId: "character-2" }),
        sourceUpdatedAt: "2026-08-07T09:00:00.000Z",
      },
    };
    setupCombatDeclarationRoute({
      encounter: { ...fixture.encounter, combatRoundState: misleadingState },
      participants: [fixture.participants[0], defender],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();
    const historyResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    const validation = historyResponse.json().history.currentAttackModifierValidation;

    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const attackResponse = await app.inject({
      method: "POST",
      payload: {
        attackerModifierFingerprint: validation.attackerModifierFingerprint,
        defenderScenarioParticipantId: "participant-2",
        expectedRevision: validation.expectedRevision,
        modifierValidationTaskId: validation.taskId,
        ob: 8,
        obSkillRaw: validation.obSkillRaw,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });
    randomSpy.mockRestore();
    await app.close();

    expect(attackResponse.statusCode, JSON.stringify(attackResponse.json())).toBe(200);
    const updatedState = mocks.encounterService.updateEncounter.mock.calls.at(-1)?.[0]?.session
      .combatRoundState as CombatRoundState;
    const command = updatedState.commands.at(-1);
    const defenderCalculation = command?.facts.defenderCalculation as
      | Record<string, unknown>
      | undefined;
    const attackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: updatedState,
    });

    expect(command).toMatchObject({
      facts: {
        defenderCalculation: {
          authority: "canonical_scenario_state",
          completeness: "complete",
          dynamicRawPercentage: adjustRangePhase1DbParryModifierEntry.value,
          participantId: "participant-2",
          schemaVersion: 1,
        },
      },
      type: "roll_attack",
    });
    expect(defenderCalculation?.["effectiveDb"]).not.toBe(999);
    expect(attackResult?.defenderDb).toBe(defenderCalculation?.["effectiveDb"]);
    expect(JSON.stringify(attackResponse.json())).not.toContain("defenderCalculation");
    expect(JSON.stringify(attackResponse.json())).not.toContain("sourceSnapshotId");
  });

  it("uses the same private defender calculation for GM and player attack authority", async () => {
    const execute = async (user: typeof mocks.playerUser) => {
      const fixture = makePostAdjustDistanceAttackFixture();
      const defender = {
        ...fixture.participants[1],
        characterId: "character-2",
        snapshot: {
          ...fixture.participants[1]?.snapshot,
          build: makeDodgeCharacterBuild("character-2", "Scyrian cavalry guy"),
          displayName: "Scyrian cavalry guy",
          equipmentState: makeMovementBurdenEquipmentState({ characterId: "character-2" }),
          sourceUpdatedAt: "2026-08-07T09:00:00.000Z",
        },
      };
      setupCombatDeclarationRoute({
        encounter: fixture.encounter,
        participants: [fixture.participants[0], defender],
        user,
      });
      const app = await buildScenarioTestApp();
      const historyResponse = await app.inject({
        method: "GET",
        url: "/encounters/encounter-1/combat-history",
      });
      const validation = historyResponse.json().history.currentAttackModifierValidation;
      const response = await app.inject({
        method: "POST",
        payload: {
          attackerModifierFingerprint: validation.attackerModifierFingerprint,
          defenderScenarioParticipantId: "participant-2",
          expectedRevision: validation.expectedRevision,
          modifierValidationTaskId: validation.taskId,
          ob: 8,
          obSkillRaw: validation.obSkillRaw,
          phase: "phase1",
          scenarioParticipantId: "participant-1",
        },
        url: "/encounters/encounter-1/combat-round/roll-attack",
      });
      expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
      const calculation = mocks.encounterService.updateEncounter.mock.calls
        .at(-1)?.[0]
        ?.session.combatRoundState.commands.at(-1)?.facts.defenderCalculation;
      await app.close();
      return calculation;
    };
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const playerCalculation = await execute(mocks.playerUser);
    const gmCalculation = await execute(mocks.adminUser);
    randomSpy.mockRestore();

    expect(gmCalculation).toEqual(playerCalculation);
    expect(gmCalculation).toMatchObject({
      authority: "canonical_scenario_state",
      effectiveDb: expect.any(Number),
    });
  });

  it("ignores legacy client defender totals and resolves private defense server-side", async () => {
    const fixture = makePostAdjustDistanceAttackFixture();
    setupCombatDeclarationRoute({
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderDbParryRaw: 0,
        defenderScenarioParticipantId: "participant-2",
        ob: 8,
        obSkillRaw: -2,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledTimes(1);
  });

  it("keeps a complete player A1 attack available without a presentation checkpoint", async () => {
    const roundState = {
      ...makeOpenPhase1AttackRoundState(),
      stepSnapshots: [],
    };
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: roundState,
        participants: makeTwoCombatEncounterParticipants(),
      },
      participants: [
        makeCombatScenarioParticipant({ id: "participant-1" }),
        makeCombatScenarioParticipant({
          controlledByUserId: "other-player",
          id: "participant-2",
        }),
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const historyResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    const validation = historyResponse.json().history.currentAttackModifierValidation;
    const projectedAttackTask = historyResponse
      .json()
      .history.progression.processes.flatMap(
        (process: { stages: Array<{ tasks: Array<Record<string, unknown>> }> }) =>
          process.stages.flatMap((stage) => stage.tasks),
      )
      .find((task: { kind?: string }) => task.kind === "attack");
    expect(projectedAttackTask).toMatchObject({
      identity: {
        attackIndex: 1,
        attackerParticipantId: "encounter-participant-1",
        defenderParticipantId: "encounter-participant-2",
        initiativeGroupId: "round:1:phase:phase1:initiative:6",
        initiativeValue: 6,
        opportunityId: "round:1:participant:encounter-participant-1:phase1:attack_1",
      },
      kind: "attack",
      owner: { participantId: "encounter-participant-1" },
    });
    expect(validation).toMatchObject({
      attackContextAvailability: "complete",
      attackerParticipantId: "encounter-participant-1",
      defenderParticipantId: "encounter-participant-2",
      effectCutoffInitiativeGroupId: projectedAttackTask.identity.initiativeGroupId,
      expectedRevision: expect.any(String),
      initiativeGroupId: projectedAttackTask.identity.initiativeGroupId,
      initiativeValue: projectedAttackTask.identity.initiativeValue,
      opportunityId: projectedAttackTask.identity.opportunityId,
      taskId: expect.any(String),
    });

    mocks.requireAuthenticatedUser.mockResolvedValue({
      ...mocks.playerUser,
      email: "other-player@example.test",
      id: "other-player",
    });
    const waitingPlayerHistoryResponse = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1/combat-history",
    });
    expect(
      waitingPlayerHistoryResponse.statusCode,
      JSON.stringify(waitingPlayerHistoryResponse.json()),
    ).toBe(200);
    const waitingPlayerHistory = waitingPlayerHistoryResponse.json().history;
    const waitingPlayerAttackTask = waitingPlayerHistory.progression.processes
      .flatMap((process: { stages: Array<{ tasks: Array<Record<string, unknown>> }> }) =>
        process.stages.flatMap((stage) => stage.tasks),
      )
      .find((task: { kind?: string }) => task.kind === "attack");
    expect(waitingPlayerHistory.currentAttackModifierValidation).toBeUndefined();
    expect(waitingPlayerAttackTask).toMatchObject({
      actorAccess: { combatant: false },
      identity: {
        attackerParticipantId: "encounter-participant-1",
        defenderParticipantId: "encounter-participant-2",
        phase: "phase1",
      },
      kind: "attack",
      owner: { participantId: "encounter-participant-1" },
    });
    expect(waitingPlayerAttackTask.id).not.toBe(projectedAttackTask.id);
    expect(waitingPlayerAttackTask.identity.executionGroupId).not.toBe(
      projectedAttackTask.identity.executionGroupId,
    );
    expect(waitingPlayerAttackTask.identity).not.toHaveProperty("attackIndex");
    expect(waitingPlayerAttackTask.identity).not.toHaveProperty("attackModeId");
    expect(waitingPlayerAttackTask.identity).not.toHaveProperty("initiativeGroupId");
    expect(waitingPlayerAttackTask.identity).not.toHaveProperty("initiativeValue");
    expect(waitingPlayerAttackTask.identity).not.toHaveProperty("opportunityId");
    expect(JSON.stringify(waitingPlayerAttackTask)).not.toContain(projectedAttackTask.id);
    expect(JSON.stringify(waitingPlayerAttackTask)).not.toContain(
      projectedAttackTask.identity.opportunityId,
    );
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);

    const beforeCommandCount = roundState.commands.length;
    const randomSpy = vi.spyOn(Math, "random").mockReturnValueOnce(0.95).mockReturnValue(0.5);
    const attackResponse = await app.inject({
      method: "POST",
      payload: {
        attackerModifierFingerprint: validation.attackerModifierFingerprint,
        defenderScenarioParticipantId: "participant-2",
        effectCutoffInitiativeGroupId: validation.effectCutoffInitiativeGroupId,
        executionGroupId: projectedAttackTask.executionGroupId,
        expectedRevision: validation.expectedRevision,
        initiativeGroupId: validation.initiativeGroupId,
        initiativeValue: validation.initiativeValue,
        modifierValidationTaskId: validation.taskId,
        ob: 10,
        obSkillRaw: validation.obSkillRaw,
        opportunityId: projectedAttackTask.identity.opportunityId,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
        taskId: projectedAttackTask.id,
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });
    randomSpy.mockRestore();

    await app.close();

    expect(attackResponse.statusCode).toBe(200);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledTimes(1);
    const updatedState = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session
      .combatRoundState as CombatRoundState;
    expect(updatedState.commands).toHaveLength(beforeCommandCount + 1);
    expect(updatedState.commands.at(-1)).toMatchObject({
      participantId: "encounter-participant-1",
      type: "roll_attack",
    });
    expect(updatedState.participants[0]?.attackResults.phase1).toBeDefined();
    expect(updatedState.currentCursor).toMatchObject({
      participantId: "encounter-participant-2",
      step: "P1",
    });
  });

  it("ignores legacy client defender fingerprints and resolves the contribution set server-side", async () => {
    const fixture = makePostAdjustDistanceAttackFixture();
    setupCombatDeclarationRoute({
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderDbParryRaw: -2,
        defenderModifierFingerprint: "v1:stale",
        defenderScenarioParticipantId: "participant-2",
        ob: 8,
        obSkillRaw: -2,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledTimes(1);
  });

  it("rejects a modifier descriptor from an older encounter revision", async () => {
    const fixture = makePostAdjustDistanceAttackFixture();
    setupCombatDeclarationRoute({
      encounter: fixture.encounter,
      participants: fixture.participants,
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderDbParryRaw: -2,
        defenderScenarioParticipantId: "participant-2",
        expectedRevision: "2025-12-31T23:59:59.000Z",
        ob: 8,
        obSkillRaw: -2,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      code: "stale_revision",
      error: "Combat state changed after this attack was displayed. Refresh combat before rolling.",
    });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("does not replace or duplicate generated distance rows in the attack route", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const staleDistanceModifier = {
      durationRounds: 1,
      generated: true,
      id: "generated:distance:phase1:ob-skill",
      scope: "until",
      sourceActionId: "attack_parry",
      sourcePhase: "phase1",
      sourceRule: "distance-ob-skill-phase1",
      value: -2,
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState({
          distance: 5,
          modifierEntries: [staleDistanceModifier],
          snapshotOb: "8",
        }),
        participants: encounterParticipants,
      },
      participant: {
        id: "participant-1",
        state: {
          ...makeCombatScenarioParticipant().state,
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [],
                situationInitiative: [],
                situationObSkill: [staleDistanceModifier],
              },
            },
          },
        },
      },
      participants: [
        {
          id: "participant-1",
          state: {
            ...makeCombatScenarioParticipant().state,
            combat: {
              combatContext: {
                modifierBuckets: {
                  general: [],
                  situationDb: [],
                  situationInitiative: [],
                  situationObSkill: [staleDistanceModifier],
                },
              },
            },
          },
        },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 8,
        obSkillRaw: -2,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const attackResult = updatedEncounter.combatRoundState.participants[0].attackResults.phase1;

    expect(attackResult.ob).toBe(-1);
    expect(updatedEncounter.combatRoundState.commands.at(-1)?.facts.distanceModifier).toMatchObject(
      {
        createdCombatModifierIds: [],
        modifierId: "generated:distance:phase1:ob-skill",
        value: -2,
      },
    );
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("resolves the canonical encounter target when rolling an open Feint phase 2 attack", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const stepStatuses = {
      initiative_phase_1: "submitted",
      initiative_phase_2: "submitted",
      phase_1_actions: "complete",
      phase_2_actions: "submitted",
      review_action_modifiers: "complete",
      review_phase_2_actions: "complete",
      review_phase_2_damage: "pending",
      review_phase_2_modifiers: "complete",
      round_summary: "pending",
      select_actions: "submitted",
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          commands: [
            {
              afterCursor: {
                participantId: "encounter-participant-1",
                roundNumber: 1,
                step: "i2",
              },
              beforeCursor: {
                participantId: "encounter-participant-1",
                roundNumber: 1,
                step: "i2",
              },
              createdAt: "2026-01-01T00:01:30.000Z",
              facts: {},
              id: "command-i2",
              participantId: "encounter-participant-1",
              roundNumber: 1,
              step: "i2",
              type: "roll_initiative_phase2",
            },
          ],
          currentCursor: {
            participantId: "encounter-participant-1",
            roundNumber: 1,
            step: "A2",
          },
          currentStep: "phase_2_actions",
          feintProposals: [
            {
              attackerParticipantId: "encounter-participant-1",
              attackerSkillId: "dodge",
              attackerSkillLabel: "Dodge",
              defenderParticipantId: "encounter-participant-2",
              defenderSkillId: "one-handed-edged",
              defenderSkillLabel: "1-h edged",
              feasibility: "possible",
              id: "feint-proposal-a2",
              method: "movement",
              pairId: "encounter-participant-1::encounter-participant-2",
              phase1OpportunityId: "feint-a1",
              phase2AttackOpportunityId: "feint-a2",
              review: {
                proposedAttackerDbParryModifier: 0,
                proposedDefenderObDbModifier: 0,
              },
              roundNumber: 1,
              status: "committed",
            },
          ],
          participants: [
            {
              attackResults: {},
              declaration: {
                actionId: "feint_attack",
                attackOpportunities: [
                  {
                    id: "feint-a2",
                    origin: "feint_attack",
                    phase: "phase2",
                    slot: "attack_2",
                    status: "committed",
                    targetParticipantId: "encounter-participant-2",
                  },
                ],
                feint: {
                  attackerSkillId: "dodge",
                  attackerSkillLabel: "Dodge",
                  defenderSkillId: "one-handed-edged",
                  defenderSkillLabel: "1-h edged",
                  method: "movement",
                  targetParticipantId: "encounter-participant-2",
                },
                phaseContexts: {
                  phase1: {},
                  phase2: {},
                },
                roundNumber: 1,
                submittedAt: "2026-01-01T00:01:00.000Z",
                submittedBy: "player",
              },
              initiatives: {
                phase2: {
                  baseInitiative: 0,
                  modifierAdjustment: 0,
                  rolls: [6],
                  rollTotal: 6,
                  total: 6,
                },
              },
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses,
            },
            {
              attackResults: {
                phase1: {
                  actionId: "attack_parry",
                  attackerParticipantId: "encounter-participant-2",
                  defenderDb: 10,
                  defenderParryModifier: 0,
                  defenderParticipantId: "encounter-participant-1",
                  grazing: false,
                  hit: false,
                  kind: "attackRoll",
                  lookupTotal: 8,
                  marginOverMissThreshold: -2,
                  ob: 10,
                  openEndedD10s: [],
                  phase: "phase1",
                  rollD20: 8,
                  rollTotal: 8,
                  rolledAt: "2026-01-01T00:01:00.000Z",
                  tableResult: "Miss",
                  weaponName: "Long sword",
                },
              },
              initiatives: {
                phase2: {
                  baseInitiative: 0,
                  modifierAdjustment: 0,
                  rolls: [4],
                  rollTotal: 4,
                  total: 4,
                },
              },
              label: "City guard",
              participantId: "encounter-participant-2",
              stepStatuses,
            },
          ],
          phaseResolutionCursor: {
            participantId: "encounter-participant-1",
            phase: "phase2",
            substep: "attack",
          },
          phaseResolutionResults: [],
          phaseResolutionStatuses: {},
          roundNumber: 1,
          stepSnapshots: [
            {
              attackSummary: {
                attackMode: "P",
                dmb: "6",
                initiative: "3",
                maxCrits: "EP",
                ob: "9",
                weaponName: "Long sword",
              },
              committedAt: "2026-01-01T00:02:00.000Z",
              id: "snapshot-attack-phase-2",
              participantId: "encounter-participant-1",
              participantLabel: "The Gladiator",
              phase: "phase2",
              roundNumber: 1,
              step: "phase_2_actions",
            },
            {
              committedAt: "2026-01-01T00:02:00.000Z",
              defenseSummary: {
                db: "11",
                dm: "0",
                parry: "9",
                sourceName: "Sword / shield",
              },
              id: "snapshot-defense-phase-2",
              modifierSummary: {
                dbRaw: -2,
                generalFatigueRaw: 0,
                initiativeRaw: 0,
                obSkillRaw: 0,
                rows: [],
              },
              participantId: "encounter-participant-2",
              participantLabel: "City guard",
              phase: "phase2",
              roundNumber: 1,
              step: "phase_2_actions",
            },
          ],
        },
        participants: encounterParticipants,
      },
      participants: [
        { id: "participant-1" },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
          state: {
            ...makeCombatScenarioParticipant().state,
            combat: {
              combatContext: {
                modifierBuckets: {
                  general: [{ id: "general-not-defense", scope: "until", value: 99 }],
                  situationDb: [
                    {
                      id: "import:character_effect:defense-2:db_parry",
                      imported: true,
                      readOnly: true,
                      scope: "until",
                      sourceEffectId: "defense-2",
                      sourceType: "character_effect",
                      value: -2,
                    },
                  ],
                  situationInitiative: [],
                  situationObSkill: [],
                },
              },
            },
          },
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        defenderParticipantId: "encounter-participant-2",
        ob: 9,
        obSkillRaw: 0,
        phase: "phase2",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    const attackResult = updatedEncounter.combatRoundState.participants[0].attackResults.phase2;
    expect(attackResult).toMatchObject({
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 8,
      defenderParticipantId: "encounter-participant-2",
      ob: 0,
      phase: "phase2",
      weaponName: "Kick",
    });
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: {
        attackResultId: "1:opportunity:feint-a2",
      },
      participantId: "encounter-participant-1",
      type: "roll_attack",
    });
  });

  it("rejects duplicate player attack rolls for the same current phase action", async () => {
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 11,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentCursor: {
            participantId: "encounter-participant-1",
            roundNumber: 1,
            step: "A1",
          },
          currentStep: "phase_1_actions",
          participants: [
            {
              attackResults: {
                phase1: attackResult,
              },
              declaration: {
                actionId: "attack_parry",
                phaseContexts: {
                  phase1: {
                    targetParticipantId: "participant-2",
                  },
                },
                roundNumber: 1,
                submittedAt: "2026-01-01T00:01:00.000Z",
                submittedBy: "player",
              },
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                phase_1_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
        participants: [
          makeCombatEncounter().participants[0],
          {
            ...makeCombatEncounter().participants[0],
            id: "encounter-participant-2",
            label: "City guard",
            scenarioParticipantId: "participant-2",
          },
        ],
      },
      participants: [
        { id: "participant-1" },
        {
          controlledByUserId: "other-player",
          id: "participant-2",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        actionId: "attack_parry",
        attackIndex: 1,
        attackModeId: "mode-1",
        declarationId: "round:1:participant:encounter-participant-1:declaration",
        defenderScenarioParticipantId: "participant-2",
        ob: 10,
        obSkillRaw: 0,
        opportunityId: "round:1:participant:encounter-participant-1:phase1:attack_1",
        phase: "phase1",
        scenarioParticipantId: "participant-1",
        weaponSourceId: "unarmed:virtual-weapon-template-punch",
        weaponSourceSlot: "virtual",
        weaponTemplateId: "virtual-weapon-template-punch",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(409);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("commits authoritative GM awareness and weapon-source choices for the exact attack", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attack = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackOpportunityId: "test-opportunity:defense-review-endpoint",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 100,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: { createdAt: attack.rolledAt, createdByUserId: "gm-1" },
      participantId: "encounter-participant-1",
      result: attack,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const attackerSnapshot = makeCanonicalCombatCalculationSnapshot({
      characterId: "character-participant-1",
      displayName: "The Gladiator",
    });
    const defenderSnapshot = makeCanonicalCombatCalculationSnapshot({
      characterId: "character-participant-2",
      displayName: "City guard",
    });
    const loadout =
      defenderSnapshot.equipmentState.activeLoadoutByCharacterId["character-participant-2"]!;
    const primaryItemId = loadout.activePrimaryWeaponItemId!;
    const secondaryItemId = loadout.activeSecondaryWeaponItemId!;
    const attackId = getCombatRoundAttackResultId({ result: attack, roundNumber: 1 });
    const defenseReviewTask = buildCombatProgressionProjection(afterAttack)
      .boundary.processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((task) => task.kind === "defense_review");
    if (!defenseReviewTask) throw new Error("Expected canonical defense-review task.");

    setupCombatDeclarationRoute({
      encounter: { combatRoundState: afterAttack, participants: encounterParticipants },
      participants: [
        {
          characterId: "character-participant-1",
          id: "participant-1",
          snapshot: attackerSnapshot,
        },
        {
          characterId: "character-participant-2",
          controlledByUserId: "other-player",
          id: "participant-2",
          snapshot: defenderSnapshot,
        },
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        attackId,
        attackerParticipantId: "encounter-participant-1",
        aware: false,
        defenderParticipantId: "encounter-participant-2",
        executionGroupId: defenseReviewTask.executionGroupId,
        expectedRevision: combatEncounter.updatedAt,
        phase: "phase1",
        sourceSelections: [
          { included: true, itemId: primaryItemId },
          { included: false, itemId: secondaryItemId },
        ],
        taskId: defenseReviewTask.id,
      },
      url: "/encounters/encounter-1/combat-round/commit-defense-review",
    });
    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(attack.hit).toBe(false);
    expect(response.json().defenseSnapshot).toMatchObject({
      attackId,
      attackOpportunityId: "test-opportunity:defense-review-endpoint",
      aware: false,
      awarenessDefault: true,
      awarenessOverridden: true,
      ordinaryDodgeAvailable: false,
      eventSequence: expect.any(Number),
      sources: [
        { decision: "gm_included", included: true, itemId: primaryItemId },
        { decision: "gm_excluded", included: false, itemId: secondaryItemId },
      ],
    });
    expect(mocks.encounterService.updateEncounter).toHaveBeenCalledTimes(1);
    const savedState = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session
      .combatRoundState as CombatRoundState;
    expect(savedState.defenseSnapshots).toHaveLength(1);
    expect(
      getCombatRoundAttackResultById({ attackResultId: attackId, state: savedState }),
    ).toMatchObject({
      defenderDb: 0,
      hit: true,
      ob: 10,
      rollD20: 14,
      rollTotal: 14,
    });
    expect(savedState.phaseResolutionResults[0]).toMatchObject({
      attackResultId: attackId,
      defenseSnapshotId: `defense-snapshot:${attackId}`,
    });
    expect(
      defenderSnapshot.equipmentState.activeLoadoutByCharacterId["character-participant-2"],
    ).toEqual(loadout);
  });

  it("makes hidden, nonexistent, and forged defense-review probes privacy-equivalent and zero-write", async () => {
    setupCombatDeclarationRoute({
      participants: [
        {
          id: "participant-1",
          visibilityOverrides: { visibility: "hidden" },
        },
        { controlledByUserId: "other-player", id: "participant-2" },
      ],
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();
    const common = {
      aware: false,
      defenderParticipantId: "encounter-participant-2",
      expectedRevision: "2026-01-01T00:00:00.000Z",
      phase: "phase1",
      sourceSelections: [],
    };
    const probes = [
      {
        ...common,
        attackId: "hidden-real-looking-attack",
        attackerParticipantId: "encounter-participant-1",
      },
      {
        ...common,
        attackId: "nonexistent-attack",
        attackerParticipantId: "nonexistent-attacker",
      },
      {
        ...common,
        attackId: "forged-attack",
        attackerParticipantId: "forged-attacker",
        sourceSelections: [{ included: true, itemId: "forged-defense-source" }],
      },
    ];
    const responses = [];
    for (const payload of probes) {
      responses.push(
        await app.inject({
          method: "POST",
          payload,
          url: "/encounters/encounter-1/combat-round/commit-defense-review",
        }),
      );
    }
    await app.close();

    expect(responses.map((response) => response.statusCode)).toEqual([404, 404, 404]);
    expect(responses.map((response) => response.json())).toEqual([
      { error: "Encounter not found." },
      { error: "Encounter not found." },
      { error: "Encounter not found." },
    ]);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("uses canonical Parry values for the current defending player's roll", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackOpportunityId: "test-opportunity:canonical-parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const defenderSnapshot = makeCanonicalCombatCalculationSnapshot({
      characterId: "character-participant-2",
      displayName: "City guard",
    });
    const defenderLoadout =
      defenderSnapshot.equipmentState.activeLoadoutByCharacterId["character-participant-2"]!;
    const primaryItem =
      defenderSnapshot.equipmentState.itemsById[defenderLoadout.activePrimaryWeaponItemId!]!;
    const secondaryItem =
      defenderSnapshot.equipmentState.itemsById[defenderLoadout.activeSecondaryWeaponItemId!]!;
    const afterDefenseReview = commitTestDefenseReview({
      attackResult: attackHit,
      sources: [
        {
          decision: "default_included",
          included: true,
          itemId: primaryItem.id,
          itemRevision: primaryItem.revision!,
          kind: "weapon",
          label: "Long sword",
          slot: "mainHand",
          templateId: primaryItem.templateId,
        },
        {
          decision: "gm_excluded",
          included: false,
          itemId: secondaryItem.id,
          itemRevision: secondaryItem.revision!,
          kind: "weapon",
          label: "Dagger",
          slot: "offHand",
          templateId: secondaryItem.templateId,
        },
      ],
      state: afterAttack,
    });
    const afterAttackWithStaleInspection: CombatRoundState = {
      ...afterDefenseReview,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1",
    };
    const projectedParryTask = buildCombatProgressionProjection(afterDefenseReview)
      .boundary.processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((task) => task.kind === "parry");
    expect(projectedParryTask).toBeDefined();
    const canonicalParryAttackResultId = getCombatRoundAttackResultId({
      result: attackHit,
      roundNumber: afterDefenseReview.roundNumber,
    });
    const canonicalDefenderState = {
      ...makeCombatScenarioParticipant().state,
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [
              { id: "general-not-defense", scope: "until", value: 99 },
              {
                combatWide: true,
                id: "unbalanced-combat-wide",
                scope: "until",
                value: -2,
              },
            ],
            situationDb: [
              {
                id: "import:character_effect:defense-1:db_parry",
                imported: true,
                readOnly: true,
                scope: "until",
                sourceEffectId: "defense-1",
                sourceType: "character_effect",
                value: -2,
              },
              {
                generated: true,
                id: "generated-defense",
                scope: "until",
                sourcePhase: "phase1",
                value: -1,
              },
              { id: "manual-defense", scope: "until", value: 1 },
            ],
            situationInitiative: [],
            situationObSkill: [],
          },
        },
      },
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: afterAttackWithStaleInspection,
        participants: encounterParticipants,
      },
      participant: {
        id: "participant-2",
        state: canonicalDefenderState,
      },
      participants: [
        {
          characterId: "character-participant-1",
          controlledByUserId: "other-player",
          id: "participant-1",
          snapshot: makeCanonicalCombatCalculationSnapshot({
            characterId: "character-participant-1",
            displayName: "The Gladiator",
          }),
        },
        {
          characterId: "character-participant-2",
          controlledByUserId: "player-1",
          id: "participant-2",
          snapshot: defenderSnapshot,
          state: canonicalDefenderState,
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const parryPayload = {
      attackResultModifier: 999,
      attackResultId: canonicalParryAttackResultId,
      attackerParticipantId: "encounter-participant-1",
      commandType: "roll_parry",
      defenderModifierFingerprint: fingerprintCombatModifierResolution({
        rows: [
          { id: "generated-defense", label: "generated-defense", value: -1 },
          {
            id: "import:character_effect:defense-1:db_parry",
            label: "imported-defense",
            value: -2,
          },
          { id: "manual-defense", label: "manual-defense", value: 1 },
          { id: "unbalanced-combat-wide", label: "unbalanced", value: -2 },
        ],
        total: -4,
      }),
      declarationId: projectedParryTask?.identity.declarationId,
      defenderParticipantId: "encounter-participant-2",
      executionGroupId: projectedParryTask?.executionGroupId,
      expectedRevision: combatEncounter.updatedAt,
      modifierValidationTaskId: projectedParryTask?.id,
      opportunityId: projectedParryTask?.identity.opportunityId,
      mainHandParryScore: 999,
      offHandParryScore: 999,
      parryBase: 999,
      parryPurpose: projectedParryTask?.identity.parryPurpose,
      parrySourceId: projectedParryTask?.identity.parrySourceId,
      parrySourceLabel: "Falsified client source",
      phase: "phase1",
      processId: projectedParryTask?.processId,
      scenarioParticipantId: "participant-2",
      stageId: projectedParryTask?.stageId,
      taskId: projectedParryTask?.id,
      usedMainHand: true,
      usedOffHand: true,
    };
    const missingRawResponse = await app.inject({
      method: "POST",
      payload: parryPayload,
      url: "/encounters/encounter-1/combat-round/roll-parry",
    });
    const staleRawResponse = await app.inject({
      method: "POST",
      payload: { ...parryPayload, dbParryRaw: -3 },
      url: "/encounters/encounter-1/combat-round/roll-parry",
    });
    const staleTaskResponse = await app.inject({
      method: "POST",
      payload: { ...parryPayload, dbParryRaw: -4, taskId: "stale-parry-task" },
      url: "/encounters/encounter-1/combat-round/roll-parry",
    });
    const staleRevisionResponse = await app.inject({
      method: "POST",
      payload: {
        ...parryPayload,
        dbParryRaw: -4,
        expectedRevision: "2025-12-31T23:59:59.000Z",
      },
      url: "/encounters/encounter-1/combat-round/roll-parry",
    });

    const response = await app.inject({
      method: "POST",
      payload: {
        ...parryPayload,
        dbParryRaw: -4,
      },
      url: "/encounters/encounter-1/combat-round/roll-parry",
    });

    await app.close();

    expect(missingRawResponse.statusCode, JSON.stringify(missingRawResponse.json())).toBe(200);
    expect(staleRawResponse.statusCode, JSON.stringify(staleRawResponse.json())).toBe(200);
    expect(staleTaskResponse.statusCode).toBe(409);
    expect(staleRevisionResponse.statusCode).toBe(409);
    expect(staleRevisionResponse.json()).toMatchObject({ code: "stale_revision" });
    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const payload = response.json();
    expect(payload.commandEnvelope).toMatchObject({
      latestResult: {
        attackResultId: canonicalParryAttackResultId,
        defenderParticipantId: "encounter-participant-2",
        kind: "parry",
        phase: "phase1",
      },
      warnings: [],
    });
    expect(payload.commandEnvelope).not.toHaveProperty("commands");
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        attackResultId: canonicalParryAttackResultId,
        defenderParticipantId: "encounter-participant-2",
      }),
      participantId: "encounter-participant-2",
      type: "roll_parry",
    });
    expect(
      updatedEncounter.combatRoundState.phaseResolutionResults[0]?.parryResolution,
    ).toMatchObject({
      combinedParryScore: 5,
      modifierBreakdown: [{ label: "DB/Parry", value: -4 }],
      parrySourceLabel: "Long sword",
      status: "resolved",
    });
  });

  it("commits the canonical current damage review through a narrow GM route", async () => {
    const fixture = makeCriticalRollMutationFixture({ c1: true });
    const attackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.state,
    });

    expect(attackResult).toBeDefined();
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult: attackResult!,
      command: {
        createdAt: "2026-01-01T00:05:45.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [6, 7],
      rolledByParticipantId: "encounter-participant-1",
      state: fixture.state,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:45.000Z",
    });
    const stateWithStaleInspection: CombatRoundState = {
      ...afterCritical,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithStaleInspection,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        ...buildDownstreamTaskPayload(stateWithStaleInspection, "commit_phase_damage"),
        review: {
          additionalEffects: [],
          notes: "Reviewed by GM",
          operationalConsequences: [],
        },
      },
      url: "/encounters/encounter-1/combat-round/commit-phase-damage",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(Object.keys(payload).sort()).toEqual(["commandEnvelope", "encounter"]);
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(payload.commandEnvelope.currentCursor).not.toEqual(
      expect.objectContaining({ step: "round_summary" }),
    );
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-2",
        state: expect.objectContaining({
          combatEffects: expect.objectContaining({
            effects: expect.arrayContaining([
              expect.objectContaining({ targetParticipantId: "participant-2" }),
            ]),
          }),
        }),
      }),
    );
    const persistedEffects =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state.combatEffects
        .effects;
    expect(persistedEffects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          criticalRuntime: expect.objectContaining({
            criticalKey: "sharp|chest|09",
            kind: "stun",
            stun: expect.objectContaining({ modifier: null }),
          }),
        }),
        expect.objectContaining({
          criticalRuntime: expect.objectContaining({
            bleed: expect.objectContaining({
              firstTickRound: 2,
              kind: "internal",
              rate: { denominator: 2, numerator: 1 },
            }),
            criticalKey: "sharp|chest|09",
            kind: "bleed",
          }),
        }),
        expect.objectContaining({
          criticalRuntime: expect.objectContaining({
            criticalKey: "sharp|chest|09",
            condition: expect.objectContaining({ code: "unconscious" }),
            kind: "condition",
          }),
        }),
        expect.objectContaining({
          criticalRuntime: expect.objectContaining({
            criticalKey: "sharp|chest|09",
            kind: "treatment_read_state",
            treatment: expect.objectContaining({
              gmManaged: true,
              stages: [],
            }),
          }),
        }),
      ]),
    );
    const savedState = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session
      .combatRoundState as CombatRoundState;
    expect(savedState.commands.at(-1)).toMatchObject({
      participantId: "encounter-participant-2",
      type: "commit_phase_damage",
    });
  });

  it("resolves canonical phase damage without consulting inspector selection", async () => {
    const fixture = makeCriticalRollMutationFixture();
    const stateWithCanonicalSnapshots: CombatRoundState = {
      ...fixture.stateAfterLocation,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
      stepSnapshots: [
        {
          attackSummary: {
            attackMode: "C",
            dmb: "8",
            initiative: "3",
            maxCrits: "FS",
            ob: "10",
            weaponName: "Broad sword",
          },
          committedAt: "2026-01-01T00:02:00.000Z",
          id: "snapshot-resolve-damage-attacker",
          participantId: "encounter-participant-1",
          participantLabel: "The Gladiator",
          phase: "phase1",
          roundNumber: fixture.stateAfterLocation.roundNumber,
          step: "phase_1_actions",
        },
        {
          committedAt: "2026-01-01T00:02:00.000Z",
          defenseSummary: {
            db: "11",
            dm: "0",
            parry: "9",
            sourceName: "Sword / shield",
          },
          id: "snapshot-resolve-damage-defender",
          participantId: "encounter-participant-2",
          participantLabel: "City guard",
          phase: "phase1",
          roundNumber: fixture.stateAfterLocation.roundNumber,
          step: "phase_1_actions",
        },
      ],
    };
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithCanonicalSnapshots,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        ...buildDownstreamTaskPayload(stateWithCanonicalSnapshots, "resolve_damage"),
        commandType: "resolve_damage",
      },
      url: "/encounters/encounter-1/combat-round/resolve-phase-damage",
    });
    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const savedState = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session
      .combatRoundState as CombatRoundState;
    expect(savedState.phaseResolutionResults[0]?.damageResult).toMatchObject({
      attackResultId: fixture.attackResultId,
      defenderDm: 0,
      dmb: 8,
    });
    expect(savedState.commands.at(-1)).toMatchObject({ type: "resolve_damage" });
  });

  it.each([
    ["attacking player", mocks.playerUser, "participant-1"],
    ["GM proxy", mocks.adminUser, undefined],
  ] as const)(
    "lets the %s roll graze damage before the ordinary GM review",
    async (_viewer, user, scenarioParticipantId) => {
      const fixture = makeGrazeDamageMutationFixture();
      const stateWithCanonicalSnapshots: CombatRoundState = {
        ...fixture.stateAfterLocation,
        stepSnapshots: [
          {
            attackSummary: {
              attackMode: "C",
              dmb: "8",
              initiative: "3",
              maxCrits: "FS",
              ob: "10",
              weaponName: "Broad sword",
            },
            committedAt: "2026-01-01T00:02:00.000Z",
            id: "snapshot-graze-attacker",
            participantId: "encounter-participant-1",
            participantLabel: "The Gladiator",
            phase: "phase1",
            roundNumber: fixture.stateAfterLocation.roundNumber,
            step: "phase_1_actions",
          },
          {
            committedAt: "2026-01-01T00:02:00.000Z",
            defenseSummary: {
              db: "11",
              dm: "0",
              parry: "9",
              sourceName: "Sword / shield",
            },
            id: "snapshot-graze-defender",
            participantId: "encounter-participant-2",
            participantLabel: "City guard",
            phase: "phase1",
            roundNumber: fixture.stateAfterLocation.roundNumber,
            step: "phase_1_actions",
          },
        ],
      };
      setupCombatDeclarationRoute({
        encounter: {
          combatRoundState: stateWithCanonicalSnapshots,
          participants: fixture.encounterParticipants,
        },
        participants: fixture.scenarioParticipants,
        user,
      });
      const app = await buildScenarioTestApp();
      const taskPayload = buildDownstreamTaskPayload(stateWithCanonicalSnapshots, "resolve_damage");
      const response = await app.inject({
        method: "POST",
        payload: {
          ...taskPayload,
          scenarioParticipantId,
        },
        url: "/encounters/encounter-1/combat-round/resolve-phase-damage",
      });
      await app.close();

      expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
      const savedState = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session
        .combatRoundState as CombatRoundState;
      expect(savedState.phaseResolutionResults[0]?.damageResult).toMatchObject({
        attackResultId: taskPayload.attackResultId,
        damageRoll: {
          diceExpression: "1d7",
          rawGrazingDamage: expect.any(Number),
        },
        grazing: true,
      });
      expect(savedState.commands.at(-1)).toMatchObject({
        createdByUserId: user.id,
        type: "resolve_damage",
      });
      expect(
        buildCombatProgressionProjection(savedState)
          .boundary.processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
          .find((task) => task.kind === "damage_review"),
      ).toMatchObject({ allowedActors: ["gm"], expectedCommand: "commit_phase_damage" });

      setupCombatDeclarationRoute({
        encounter: {
          combatRoundState: stateWithCanonicalSnapshots,
          participants: fixture.encounterParticipants,
        },
        participants: fixture.scenarioParticipants,
        user,
      });
      const staleApp = await buildScenarioTestApp();
      const staleResponse = await staleApp.inject({
        method: "POST",
        payload: {
          ...taskPayload,
          damageRollExpression: "1d6",
          scenarioParticipantId,
        },
        url: "/encounters/encounter-1/combat-round/resolve-phase-damage",
      });
      await staleApp.close();
      expect(staleResponse.statusCode).toBe(409);
      expect(staleResponse.json()).toEqual({ error: "The graze damage roll context is stale." });

      if (_viewer === "attacking player") {
        setupCombatDeclarationRoute({
          encounter: {
            combatRoundState: stateWithCanonicalSnapshots,
            participants: fixture.encounterParticipants,
          },
          participants: fixture.scenarioParticipants,
          user: { ...mocks.playerUser, id: "other-player" },
        });
        const defenderApp = await buildScenarioTestApp();
        const defenderResponse = await defenderApp.inject({
          method: "POST",
          payload: {
            ...taskPayload,
            scenarioParticipantId: "participant-2",
          },
          url: "/encounters/encounter-1/combat-round/resolve-phase-damage",
        });
        await defenderApp.close();
        expect(defenderResponse.statusCode).toBe(403);
        expect(defenderResponse.json()).toEqual({
          error: "Only the attacking participant can roll graze damage.",
        });
      }
    },
  );

  it("saves the canonical current damage review without committing effects", async () => {
    const fixture = makeCriticalRollMutationFixture();
    const attackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.state,
    });
    if (!attackResult) throw new Error("Expected attack result.");
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult,
      command: { createdAt: "2026-01-01T00:05:45.000Z", createdByUserId: "gm-1" },
      criticalDice: [4, 5],
      rolledByParticipantId: "encounter-participant-1",
      state: fixture.state,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:45.000Z",
    });
    const stateWithStaleInspection: CombatRoundState = {
      ...afterCritical,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary",
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithStaleInspection,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        ...buildDownstreamTaskPayload(stateWithStaleInspection, "commit_phase_damage"),
        review: {
          additionalEffects: [],
          notes: "Saved current review",
          operationalConsequences: [],
          totalDamageOverride: 7,
        },
      },
      url: "/encounters/encounter-1/combat-round/save-damage-review",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const payload = response.json();
    expect(Object.keys(payload).sort()).toEqual(["commandEnvelope", "encounter"]);
    expect(payload.commandEnvelope).not.toHaveProperty("state");
    expect(payload.commandEnvelope.currentCursor).toMatchObject({
      participantId: "encounter-participant-2",
      step: "D1",
    });
    const savedState = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session
      .combatRoundState as CombatRoundState;
    const savedResolution = savedState.phaseResolutionResults.find(
      (result) => result.attackResultId === fixture.attackResultId,
    );
    expect(savedResolution?.damageResult?.review).toMatchObject({
      notes: "Saved current review",
      reviewedByUserId: "gm-1",
      totalDamageOverride: 7,
    });
    expect(savedResolution?.damageProposal.status).toBe("drafted");
    expect(savedState.commands.some((command) => command.type === "commit_phase_damage")).toBe(
      false,
    );
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("rebuilds a five-key Critical review from server canon and rejects an omitted identity", async () => {
    const fixture = makeCriticalRollMutationFixture({ c1: true });
    const attackResult = getCombatRoundOutgoingAttackResultForParticipantPhase({
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: fixture.state,
    });
    if (!attackResult) throw new Error("Expected attack result.");
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult,
      command: { createdAt: "2026-01-01T00:05:45.000Z", createdByUserId: "gm-1" },
      criticalDice: [4, 4],
      rolledByParticipantId: "encounter-participant-1",
      state: fixture.state,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:45.000Z",
    });
    const damageReview = afterCritical.phaseResolutionResults.find(
      (result) => result.attackResultId === fixture.attackResultId,
    )?.damageResult?.review;
    expect(damageReview?.criticalEffectProposal?.critKey).toBe("sharp|chest|04");

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: afterCritical,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const missingIdentityResponse = await app.inject({
      method: "POST",
      payload: {
        ...buildDownstreamTaskPayload(afterCritical, "commit_phase_damage"),
        review: { additionalEffects: [], operationalConsequences: [] },
      },
      url: "/encounters/encounter-1/combat-round/save-damage-review",
    });
    const response = await app.inject({
      method: "POST",
      payload: {
        ...buildDownstreamTaskPayload(afterCritical, "commit_phase_damage"),
        review: {
          ...damageReview,
          criticalEffectProposal: {
            ...damageReview?.criticalEffectProposal,
            adjudication: {
              criticalKey: "sharp|chest|04",
              narrativeOverride: "The accepted instance prose is shorter.",
              reason: "The target was already braced.",
              suppressedEffectKeys: ["sharp|chest|04|02"],
            },
          },
        },
      },
      url: "/encounters/encounter-1/combat-round/save-damage-review",
    });

    await app.close();

    expect(missingIdentityResponse.statusCode).toBe(400);
    expect(missingIdentityResponse.json()).toEqual({ error: "Critical review identity is stale." });
    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const savedState = mocks.encounterService.updateEncounter.mock.calls.at(-1)?.[0]?.session
      .combatRoundState as CombatRoundState;
    const savedReview = savedState.phaseResolutionResults.find(
      (result) => result.attackResultId === fixture.attackResultId,
    )?.damageResult?.review;
    expect(savedReview?.criticalEffectProposal).toMatchObject({
      adjudication: {
        criticalKey: "sharp|chest|04",
        narrativeOverride: "The accepted instance prose is shorter.",
        reason: "The target was already braced.",
        suppressedEffectKeys: ["sharp|chest|04|02"],
      },
      bodyText: "The accepted instance prose is shorter.",
      canonicalReview: {
        criticalKey: "sharp|chest|04",
        fixtureVersion: "c1-five-key-post-393-2026-09-06",
        title: "Pectoral slash disables attacks",
      },
      critKey: "sharp|chest|04",
      title: "Pectoral slash disables attacks",
    });
    expect(
      savedReview?.additionalEffects.find(
        (effect) => effect.sourceEffectKey === "sharp|chest|04|02",
      ),
    ).toMatchObject({ accepted: false });
  });

  it("persists a GM-only exact Critical Bleed transition with an involved history event", async () => {
    const fixture = makeCriticalRollMutationFixture({ c1: true });
    const target = {
      ...fixture.scenarioParticipants[1]!,
      state: {
        ...fixture.scenarioParticipants[1]!.state,
        combatEffects: {
          effects: [
            {
              createdAt: "2026-01-01T00:05:45.000Z",
              criticalRuntime: {
                bleed: {
                  allowedControlStates: ["active", "partial", "staunched_zero", "resolved"],
                  controlState: "active",
                  currentRate: { denominator: 2, numerator: 1 },
                  firstTickRound: 2,
                  kind: "external",
                  rate: { denominator: 2, numerator: 1 },
                  sourceEffectKey: "blunt|arm|12|03",
                  sourceRate: "1 HP / 2 rounds",
                },
                criticalKey: "blunt|arm|12",
                fixtureVersion: "c1-five-key-post-393-2026-09-06",
                kind: "bleed",
              },
              damage: 0,
              description: "Bleed 1/2 HP per round.",
              effectGroup: "bleed",
              generalDamage: 0,
              id: "critical-bleed",
              sourceEventId: "critical-event",
              status: "active",
              targetParticipantId: "participant-2",
              type: "bleed",
              updatedAt: "2026-01-01T00:05:45.000Z",
            },
          ],
          events: [],
        },
      },
    };
    const setup = setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
      participants: [fixture.scenarioParticipants[0]!, target],
      user: mocks.adminUser,
    });
    setupMutableCombatRouteState({
      encounter: setup.encounter as EncounterSession,
      participants: setup.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: {
        effectId: "critical-bleed",
        expectedRevision: setup.encounter.updatedAt,
        nextState: "partial",
        partialRate: { denominator: 4, numerator: 1 },
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/transition-critical-bleed",
    });

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    expect(response.json().participant.state.combatEffects.effects[0]).toMatchObject({
      criticalRuntime: {
        bleed: {
          controlState: "partial",
          currentRate: { denominator: 4, numerator: 1 },
        },
      },
      description: "Bleed 1/4 HP per round · controlled.",
    });
    const savedRoundState = response.json().encounter.combatRoundState as CombatRoundState;
    expect(savedRoundState.commands.at(-1)).toMatchObject({
      createdByUserId: "gm-1",
      participantId: "encounter-participant-2",
      type: "transition_critical_bleed",
      facts: {
        actorUserId: "gm-1",
        scenarioParticipantId: "participant-2",
        targetParticipantId: "encounter-participant-2",
      },
    });
    expect(savedRoundState.events.at(-1)).toMatchObject({
      commandId: savedRoundState.commands.at(-1)?.id,
      facts: {
        gmReview: { actorUserId: "gm-1" },
        involvedOutcome: {
          bleedKind: "external",
          currentRate: { denominator: 4, numerator: 1 },
          nextState: "partial",
          previousState: "active",
        },
      },
      targetParticipantId: "encounter-participant-2",
      type: "effect_review",
      visibility: { outcomeScope: "involved" },
    });
    expect(savedRoundState.events.at(-1)).not.toHaveProperty("actorParticipantId");

    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
    const playerReload = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });
    expect(playerReload.statusCode, JSON.stringify(playerReload.json())).toBe(200);
    expect(playerReload.json().encounter.combatRoundState.commands).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "transition_critical_bleed" })]),
    );
    expect(JSON.stringify(playerReload.json())).not.toContain('"gmReview"');
    expect(JSON.stringify(playerReload.json())).not.toContain('"previousEffect"');
    expect(JSON.stringify(playerReload.json())).not.toContain('"nextEffect"');

    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    const clearResponse = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(clearResponse.statusCode, JSON.stringify(clearResponse.json())).toBe(200);
    expect(clearResponse.json().encounter.combatRoundState.commands).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "transition_critical_bleed" })]),
    );
    expect(clearResponse.json().encounter.combatRoundState.events).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ commandId: savedRoundState.commands.at(-1)?.id }),
      ]),
    );
    expect(clearResponse.json().participants[0].state.combatEffects.effects[0]).toMatchObject({
      criticalRuntime: {
        bleed: {
          controlState: "active",
          currentRate: { denominator: 2, numerator: 1 },
        },
      },
      description: "Bleed 1/2 HP per round.",
    });
    expect(clearResponse.json().participants[0].state.combatEffects.events).toHaveLength(0);
  });

  it("rejects player use of the GM damage review save route", async () => {
    setupCombatDeclarationRoute({ user: mocks.playerUser });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: { review: {} },
      url: "/encounters/encounter-1/combat-round/save-damage-review",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("rejects player use of the GM phase damage commit route", async () => {
    setupCombatDeclarationRoute({ user: mocks.playerUser });
    const app = await buildScenarioTestApp();
    const response = await app.inject({
      method: "POST",
      payload: { review: {} },
      url: "/encounters/encounter-1/combat-round/commit-phase-damage",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("allows the attacking player to roll hit location for a pending D1 result", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackOpportunityId: "test-opportunity:player-location",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const scenarioParticipants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: afterParry,
        participants: encounterParticipants,
      },
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    const app = await buildScenarioTestApp();
    const taskPayload = buildDownstreamTaskPayload(afterParry, "roll_hit_location");
    const staleResponse = await app.inject({
      method: "POST",
      payload: {
        ...taskPayload,
        executionGroupId: "stale-execution-group",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-hit-location",
    });
    expect(staleResponse.statusCode).toBe(409);
    expect(staleResponse.json()).toMatchObject({ code: "execution_group_mismatch" });
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();

    const response = await app.inject({
      method: "POST",
      payload: {
        ...taskPayload,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-hit-location",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        rolledByParticipantId: "encounter-participant-1",
        rollPrivilege: "attacker",
      }),
      participantId: "encounter-participant-2",
      type: "roll_hit_location",
    });
    expect(
      updatedEncounter.combatRoundState.phaseResolutionResults[0]?.hitLocationRoll.status,
    ).toBe("rolled");
  });

  it("drafts damage from player hit-location roll when combat snapshots are available", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackOpportunityId: "test-opportunity:damage-draft",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const scenarioParticipants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        characterId: "guard-character",
        controlledByUserId: "other-player",
        id: "participant-2",
        snapshot: {
          displayName: "City guard",
          equipmentState: {
            activeLoadoutByCharacterId: {
              "guard-character": {
                wornArmorItemId: "armor-item-test-coverage",
              },
            },
            itemsById: {
              "armor-item-test-coverage": {
                id: "armor-item-test-coverage",
                templateId: "armor-template-test-coverage",
              },
            },
            locationsById: {},
            templates: {
              templatesById: {
                "armor-template-test-coverage": {
                  category: "armor",
                  criticalModifierByArea: {
                    abdomen: 1,
                    backArm: 1,
                    backFoot: 1,
                    backThigh: 1,
                    chest: 1,
                    frontArm: 1,
                    frontFoot: 1,
                    frontThigh: 1,
                    head: 1,
                  },
                  id: "armor-template-test-coverage",
                  locationTypes: {
                    abdomen: "B",
                    backArm: "B",
                    backFoot: "B",
                    backThigh: "B",
                    chest: "B",
                    frontArm: "B",
                    frontFoot: "B",
                    frontThigh: "B",
                    head: "B",
                  },
                  locationValues: {
                    abdomen: 3,
                    backArm: 3,
                    backFoot: 3,
                    backThigh: 3,
                    chest: 3,
                    frontArm: 3,
                    frontFoot: 3,
                    frontThigh: 3,
                    head: 3,
                  },
                  name: "Test coverage armor",
                },
              },
            },
          },
        },
      }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...afterParry,
          stepSnapshots: [
            {
              attackSummary: {
                attackMode: "C",
                dmb: "8",
                initiative: "3",
                maxCrits: "FS",
                ob: "10",
                weaponName: "Broad sword",
              },
              committedAt: "2026-01-01T00:02:00.000Z",
              id: "snapshot-attack-damage",
              participantId: "encounter-participant-1",
              participantLabel: "The Gladiator",
              phase: "phase1",
              roundNumber: afterParry.roundNumber,
              step: "phase_1_actions",
            },
            {
              committedAt: "2026-01-01T00:02:00.000Z",
              defenseSummary: {
                db: "11",
                dm: "0",
                parry: "9",
                sourceName: "Sword / shield",
              },
              id: "snapshot-defense-damage",
              participantId: "encounter-participant-2",
              participantLabel: "City guard",
              phase: "phase1",
              roundNumber: afterParry.roundNumber,
              step: "phase_1_actions",
            },
          ],
        },
        participants: encounterParticipants,
      },
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        ...buildDownstreamTaskPayload(afterParry, "roll_hit_location"),
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-hit-location",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(
      updatedEncounter.combatRoundState.commands
        .slice(-2)
        .map((command: { type: string }) => command.type),
    ).toEqual(["roll_hit_location", "resolve_damage"]);
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageProposal.status).toBe(
      "drafted",
    );
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageResult).toMatchObject(
      {
        armorClass: "B",
        armorCoverageLabel: "3B",
        armorValue: 3,
        defenderDm: 0,
        dmb: 8,
        weaponArmorClass: "C",
      },
    );
    expect(
      updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageResult.armorWarnings,
    ).toEqual([]);
    expect(
      updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageResult.armorModifierSource,
    ).toMatchObject({
      armorClass: "B",
      status: "applied",
      weaponArmorClass: "C",
    });
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.criticalRoll.status).toBe(
      "pending",
    );
  });

  it("allows the attacking player to roll critical for their critical damage proposal", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackOpportunityId: "test-opportunity:player-critical",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordCombatRoundHitLocationRoll({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [12],
      rolledByParticipantId: "encounter-participant-1",
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:30.000Z",
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const scenarioParticipants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: afterDamage,
        participants: encounterParticipants,
      },
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    const app = await buildScenarioTestApp();
    const taskPayload = buildDownstreamTaskPayload(afterDamage, "roll_critical");
    const staleResponse = await app.inject({
      method: "POST",
      payload: {
        ...taskPayload,
        criticalResultId: "stale-critical-result",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-critical",
    });
    expect(staleResponse.statusCode).toBe(409);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();

    const response = await app.inject({
      method: "POST",
      payload: {
        ...taskPayload,
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-critical",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      facts: expect.objectContaining({
        rolledByParticipantId: "encounter-participant-1",
        rollPrivilege: "attacker",
      }),
      participantId: "encounter-participant-2",
      type: "roll_critical",
    });
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.criticalRoll.status).toBe(
      "rolled",
    );
  });

  it("returns player-safe combat roll mutation responses without unrelated phase results or attack rolls", async () => {
    const encounterParticipants = makeFourCombatEncounterParticipants();
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const relevantAttack = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackOpportunityId: "test-opportunity:relevant-private-result",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterRelevantAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: relevantAttack.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: relevantAttack,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const relevantDefenderSnapshot = makeCanonicalCombatCalculationSnapshot({
      characterId: "character-participant-2",
      displayName: "City guard",
    });
    const relevantDefenderEquipment = relevantDefenderSnapshot.equipmentState;
    const relevantDefenderLoadout =
      relevantDefenderEquipment.activeLoadoutByCharacterId["character-participant-2"]!;
    const relevantDefenseSources = [
      { itemId: relevantDefenderLoadout.activePrimaryWeaponItemId!, slot: "mainHand" as const },
      { itemId: relevantDefenderLoadout.activeSecondaryWeaponItemId!, slot: "offHand" as const },
    ].map(({ itemId, slot }) => {
      const item = relevantDefenderEquipment.itemsById[itemId]!;
      const template = relevantDefenderEquipment.templatesById[item.templateId]!;
      return {
        decision: "default_included" as const,
        included: true,
        itemId,
        itemRevision: item.revision,
        kind: "weapon" as const,
        label: template.name,
        slot,
        templateId: template.id,
      };
    });
    const afterRelevantDefenseReview = commitTestDefenseReview({
      attackResult: relevantAttack,
      sources: relevantDefenseSources,
      state: afterRelevantAttack,
    });
    const afterRelevantAttackWithPrivateThrownUndo = {
      ...afterRelevantDefenseReview,
      commands: afterRelevantDefenseReview.commands.map((command) =>
        command.type === "roll_attack"
          ? {
              ...command,
              facts: {
                ...command.facts,
                thrownWeaponUndo: {
                  actionId: command.id,
                  itemAfterRevision: "private-item-revision",
                  itemBefore: { id: "private-thrown-item" },
                  version: 1,
                },
              },
            }
          : command,
      ),
    };
    const unrelatedAttack = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackOpportunityId: "test-opportunity:unrelated-private-result",
      attackerParticipantId: "encounter-participant-3",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-4",
      ob: 10,
      phase: "phase1",
      rollD20: 14,
      rollTotal: 14,
      rolledAt: "2026-01-01T00:03:30.000Z",
      weaponName: "Short sword",
    });
    const afterUnrelatedAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: unrelatedAttack.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-3",
      result: unrelatedAttack,
      state: afterRelevantAttackWithPrivateThrownUndo,
      submittedBy: "gm",
    });
    const afterUnrelatedParry = recordCombatRoundParryResult({
      attackResult: unrelatedAttack,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterUnrelatedAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterUnrelatedLocation = recordCombatRoundHitLocationRoll({
      attackResult: unrelatedAttack,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [12],
      rolledByParticipantId: "encounter-participant-3",
      state: afterUnrelatedParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:30.000Z",
    });
    const afterUnrelatedDamage = recordCombatRoundDamageResult({
      attackResult: unrelatedAttack,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterUnrelatedLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const stateWithPrivateUnrelatedReview = addPrivateDamageReviewToResolution({
      attackResultId: "1:phase1:encounter-participant-3:encounter-participant-4",
      state: afterUnrelatedDamage,
    });
    const combatRoundState = {
      ...stateWithPrivateUnrelatedReview,
      currentCursor: afterRelevantDefenseReview.currentCursor,
      currentStep: afterRelevantDefenseReview.currentStep,
      phaseResolutionCursor: afterRelevantDefenseReview.phaseResolutionCursor,
      selectedParticipantId: afterRelevantDefenseReview.selectedParticipantId,
      selectedStep: afterRelevantDefenseReview.selectedStep,
    };
    const projectedParryTask = buildCombatProgressionProjection(combatRoundState)
      .boundary.processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((task) => task.kind === "parry");
    expect(projectedParryTask).toBeDefined();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState,
        participants: encounterParticipants,
      },
      participant: {
        id: "participant-2",
      },
      participants: [
        {
          controlledByUserId: "other-player",
          id: "participant-1",
        },
        {
          characterId: "character-participant-2",
          controlledByUserId: "player-1",
          id: "participant-2",
          snapshot: relevantDefenderSnapshot,
        },
        {
          controlledByUserId: "other-player",
          id: "participant-3",
        },
        {
          controlledByUserId: "other-player",
          id: "participant-4",
        },
      ],
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        attackResultModifier: relevantAttack.defenderParryModifier,
        attackResultId: getCombatRoundAttackResultId({
          result: relevantAttack,
          roundNumber: combatRoundState.roundNumber,
        }),
        attackerParticipantId: "encounter-participant-1",
        commandType: "roll_parry",
        dbParryRaw: 0,
        defenderModifierFingerprint: fingerprintCombatModifierResolution({
          rows: [],
          total: 0,
        }),
        declarationId: projectedParryTask?.identity.declarationId,
        defenderParticipantId: "encounter-participant-2",
        executionGroupId: projectedParryTask?.executionGroupId,
        expectedRevision: combatEncounter.updatedAt,
        modifierValidationTaskId: projectedParryTask?.id,
        opportunityId: projectedParryTask?.identity.opportunityId,
        parryBase: 13,
        parryPurpose: projectedParryTask?.identity.parryPurpose,
        parrySourceId: projectedParryTask?.identity.parrySourceId,
        parrySourceLabel: "Sword / shield",
        phase: "phase1",
        processId: projectedParryTask?.processId,
        scenarioParticipantId: "participant-2",
        stageId: projectedParryTask?.stageId,
        taskId: projectedParryTask?.id,
        usedMainHand: true,
        usedOffHand: true,
      },
      url: "/encounters/encounter-1/combat-round/roll-parry",
    });

    await app.close();

    expect(response.statusCode, JSON.stringify(response.json())).toBe(200);
    const responseRoundState = response.json().encounter.combatRoundState;
    expect(responseRoundState.phaseResolutionResults).toHaveLength(1);
    expect(responseRoundState.phaseResolutionResults[0]).toMatchObject({
      attackerParticipantId: "encounter-participant-1",
      defenderParticipantId: "encounter-participant-2",
    });
    expect(JSON.stringify(responseRoundState.phaseResolutionResults)).not.toContain(
      "encounter-participant-3",
    );
    expect(JSON.stringify(responseRoundState.phaseResolutionResults)).not.toContain(
      "secret-gm-review",
    );
    expect(JSON.stringify(responseRoundState)).not.toContain("private-thrown-item");
    expect(JSON.stringify(responseRoundState)).not.toContain("private-item-revision");
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-3",
      )?.attackResults,
    ).toEqual({});
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-3",
      )?.attackResultsByOpportunity,
    ).toEqual({});
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-4",
      )?.attackResults,
    ).toEqual({});
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-4",
      )?.attackResultsByOpportunity,
    ).toEqual({});
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.attackResults.phase1,
    ).toMatchObject({
      defenderParticipantId: "encounter-participant-2",
    });
  });

  it("strips damage review details from player critical roll mutation responses", async () => {
    const fixture = makeCriticalRollMutationFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(fixture.scenarioParticipants);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        ...buildDownstreamTaskPayload(fixture.state, "roll_critical"),
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-critical",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseResolution = response.json().encounter.combatRoundState.phaseResolutionResults[0];
    expect(responseResolution.criticalRoll.status).toBe("rolled");
    expect(responseResolution.damageResult.review).toBeUndefined();
    expect(JSON.stringify(responseResolution)).not.toContain("secret-gm-review");
  });

  it("keeps GM combat roll mutation responses fully detailed", async () => {
    const fixture = makeCriticalRollMutationFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(fixture.scenarioParticipants);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        ...buildDownstreamTaskPayload(fixture.state, "roll_critical"),
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-critical",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseResolution = response.json().encounter.combatRoundState.phaseResolutionResults[0];
    expect(responseResolution.criticalRoll.status).toBe("rolled");
    expect(responseResolution.damageResult.review).toMatchObject({
      notes: "secret-gm-review",
      reviewedByUserId: "gm-1",
    });
  });

  it("returns involved current-round combat result facts to the attacker on encounter read", async () => {
    const fixture = makeCombatReadProjectionFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseRoundState = response.json().encounter.combatRoundState;
    const responseResolution = responseRoundState.phaseResolutionResults[0];
    expect(responseRoundState.phaseResolutionResults).toHaveLength(1);
    expect(responseResolution).toMatchObject({
      attackerParticipantId: "encounter-participant-1",
      defenderParticipantId: "encounter-participant-2",
      hitLocationRoll: {
        status: "rolled",
      },
    });
    expect(responseResolution.damageResult).toMatchObject({
      attackResultId: fixture.attackResultId,
      defenderParticipantId: "encounter-participant-2",
      hitLocationRolls: [12],
      totalDamage: expect.any(Number),
    });
    expect(responseResolution.damageResult.review).toBeUndefined();
    expect(JSON.stringify(responseRoundState)).not.toContain("secret-gm-review");
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.attackResults.phase1,
    ).toMatchObject({
      defenderParticipantId: "encounter-participant-2",
      rollD20: 14,
    });
  });

  it("returns involved current-round combat result facts to the defender on encounter read", async () => {
    const fixture = makeCombatReadProjectionFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: {
        ...mocks.playerUser,
        id: "other-player",
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseRoundState = response.json().encounter.combatRoundState;
    expect(responseRoundState.phaseResolutionResults).toHaveLength(1);
    expect(responseRoundState.phaseResolutionResults[0]).toMatchObject({
      attackerParticipantId: "encounter-participant-1",
      defenderParticipantId: "encounter-participant-2",
      parryResolution: {
        status: "resolved",
      },
    });
    expect(responseRoundState.phaseResolutionResults[0].damageResult.review).toBeUndefined();
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.attackResults.phase1,
    ).toMatchObject({
      defenderParticipantId: "encounter-participant-2",
      rollD20: 14,
    });
  });

  it("omits unrelated current-round combat result details for an uninvolved player on encounter read", async () => {
    const fixture = makeCombatReadProjectionFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: {
        ...mocks.playerUser,
        id: "uninvolved-player",
      },
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseRoundState = response.json().encounter.combatRoundState;
    expect(responseRoundState.phaseResolutionResults).toEqual([]);
    expect(JSON.stringify(responseRoundState)).not.toContain("secret-gm-review");
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.attackResults,
    ).toEqual({});
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.attackResultsByOpportunity,
    ).toEqual({});
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-2",
      )?.attackResults,
    ).toEqual({});
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-2",
      )?.attackResultsByOpportunity,
    ).toEqual({});
  });

  it("keeps GM encounter read responses fully detailed", async () => {
    const fixture = makeCombatReadProjectionFixture();

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: fixture.state,
        participants: fixture.encounterParticipants,
      },
      participants: fixture.scenarioParticipants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const responseRoundState = response.json().encounter.combatRoundState;
    expect(responseRoundState.phaseResolutionResults).toHaveLength(1);
    expect(responseRoundState.phaseResolutionResults[0].damageResult.review).toMatchObject({
      notes: "secret-gm-review",
      reviewedByUserId: "gm-1",
    });
    expect(
      responseRoundState.participants.find(
        (participant: { participantId: string }) =>
          participant.participantId === "encounter-participant-1",
      )?.attackResults.phase1,
    ).toMatchObject({
      defenderParticipantId: "encounter-participant-2",
      rollD20: 14,
    });
  });

  it("clears DE declarations and participant action selections for GM correction", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "select_actions",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "pending",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              selectedOpponentId: "guard",
              modifierBuckets: {
                general: [],
                situationDb: [
                  attackParryDbParryModifierEntry,
                  parryAttackDbParryModifierEntry,
                  doubleAttackPhase1DbParryModifierEntry,
                  doubleAttackPhase2DbParryModifierEntry,
                ],
                situationInitiative: [],
                situationObSkill: [
                  doubleAttackPhase1ObSkillModifierEntry,
                  doubleAttackPhase2ObSkillModifierEntry,
                ],
              },
            },
            lastDeclaredActionId: "parry_attack",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "pending",
    );
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: undefined,
            lastDeclaredEncounterId: undefined,
            lastDeclaredMovementId: undefined,
            lastDeclaredRoundNumber: undefined,
          }),
        }),
      }),
    );
  });

  it("keeps declaration-time distance Skill/OB modifiers when undoing a phase attack", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const distanceModifierEntry = {
      durationRounds: 1,
      generated: true,
      id: "generated:distance:phase1:ob-skill",
      notes: "Long sword preferred 3 · actual 5 · nearest 3 · Skill/OB -4",
      scope: "until",
      sourceActionId: "attack_parry",
      sourcePhase: "phase1",
      sourceRule: "distance-ob-skill-phase1",
      value: -4,
    };
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 6,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Long sword",
    });
    const stateWithAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackResult.rolledAt,
        facts: {
          distanceModifier: {
            createdCombatModifierIds: [],
            modifierId: "generated:distance:phase1:ob-skill",
            notes: "distance: Long sword preferred 3 · actual 5 · nearest 3 · Skill/OB -4",
            preferredDistances: [],
            value: -4,
          },
        },
      },
      participantId: "encounter-participant-1",
      result: attackResult,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    const participantState = {
      ...makeCombatScenarioParticipant().state,
      combat: {
        combatContext: {
          modifierBuckets: {
            general: [],
            situationDb: [],
            situationInitiative: [],
            situationObSkill: [distanceModifierEntry],
          },
        },
      },
    };

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...stateWithAttack,
          currentStep: "initiative_phase_1",
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "phase_1_actions",
        },
        participants: encounterParticipants,
      },
      participant: {
        id: "participant-1",
        state: participantState,
      },
      participants: [
        {
          id: "participant-1",
          state: participantState,
        },
        makeCombatScenarioParticipant({ id: "participant-2" }),
      ],
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updateStateCall =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0];
    expect(updateStateCall.state.combat.combatContext.modifierBuckets.situationObSkill).toEqual([
      distanceModifierEntry,
    ]);
  });

  it("clears a command-backed DE cell by restoring the command before cursor", async () => {
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience();
    const stateWithCommand = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-1",
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithCommand,
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              selectedOpponentId: "guard",
              modifierBuckets: {
                general: [],
                situationDb: [attackParryDbParryModifierEntry],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: "attack_parry",
            lastDeclaredEncounterId: "encounter-1",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "select_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toBeUndefined();
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalled();
  });

  it("clears a combat-start Combat Experience roll and removes only its created effect row", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const baseState = setCombatRoundCombatExperienceDifficulty({
      difficulty: 26,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
    });
    const existingEffect = {
      createdAt: "2026-01-01T00:00:00.000Z",
      damage: 0,
      description: "Existing modifier",
      effectGroup: "general" as const,
      generalDamage: 0,
      id: "existing-modifier",
      modifierValue: -1,
      sourceEventId: "existing-event",
      status: "active" as const,
      targetParticipantId: "participant-1",
      type: "general_modifier" as const,
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const rolled = rollCombatRoundCombatExperience({
      combatEffects: {
        effects: [existingEffect],
        events: [
          {
            createdAt: "2026-01-01T00:00:00.000Z",
            description: "Existing modifier",
            id: "existing-event",
            sourceLabel: "Manual",
            sourceType: "manual",
            targetParticipantId: "participant-1",
          },
        ],
      },
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      rng: () => 0.2,
      scenarioParticipantId: "participant-1",
      skillTotal: 10,
      state: baseState,
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: rolled.state,
      },
      participant: {
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: rolled.combatEffects,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "select_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.participants[0].combatExperience).toBeUndefined();

    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;
    expect(updatedParticipantState.combatEffects.effects).toEqual([
      expect.objectContaining({
        id: "existing-modifier",
      }),
    ]);
    expect(
      updatedParticipantState.combatEffects.effects.some(
        (effect: { description?: string }) => effect.description === "combat exp active -2",
      ),
    ).toBe(false);
  });

  it("repairs unsupported A1 persisted state even when Clear has nothing to undo", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const baseState = initializeCombatRoundState({ encounter: combatEncounter });
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        combatRoundState: {
          ...baseState,
          commands: [],
          currentCursor: {
            participantId: "encounter-participant-1",
            roundNumber: baseState.roundNumber,
            step: "A1",
          },
          currentStep: "phase_1_actions",
          participants: baseState.participants.map((participant) => ({
            ...participant,
            stepStatuses: {
              ...participant.stepStatuses,
              phase_1_actions: "gmEdited",
            },
          })),
          phaseResolutionCursor: undefined,
          phaseResolutionResults: [],
          phaseResolutionStatuses: {},
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "phase_1_actions",
          stepSnapshots: [],
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: baseState.roundNumber,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_actions).toBe(
      "pending",
    );
    expect(updatedEncounter.combatRoundState.phaseResolutionCursor).toBeUndefined();
    expect(updatedEncounter.combatRoundState.phaseResolutionResults).toEqual([]);
  });

  it("projects repaired state without writing when loading a stale out-of-encounter target A1", async () => {
    const combatEncounter = makeCombatEncounter({
      participants: [
        {
          declaration: {
            actionType: "none",
            defenseFocus: "none",
            defensePosture: "none",
            targetLocation: "any",
          },
          facing: "north",
          id: "encounter-participant-1",
          initiative: 0,
          label: "The Gladiator",
          order: 0,
          orientation: "neutral",
          participantType: "scenario",
          position: { x: 0, y: 0, zone: "center" },
          scenarioParticipantId: "participant-1",
        },
        {
          declaration: {
            actionType: "none",
            defenseFocus: "none",
            defensePosture: "none",
            targetLocation: "any",
          },
          facing: "north",
          id: "encounter-participant-2",
          initiative: 0,
          label: "Lankhmarian veteran thief",
          order: 1,
          orientation: "neutral",
          participantType: "scenario",
          position: { x: 0, y: 0, zone: "center" },
          scenarioParticipantId: "participant-2",
        },
      ],
    }) as EncounterSession;
    const baseState = initializeCombatRoundState({ encounter: combatEncounter });
    const staleRoundState = {
      ...baseState,
      currentCursor: {
        participantId: "encounter-participant-2",
        roundNumber: baseState.roundNumber,
        step: "A1" as const,
      },
      currentStep: "phase_1_actions" as const,
      participants: baseState.participants.map((participant) =>
        participant.participantId === "encounter-participant-2"
          ? {
              ...participant,
              declaration: {
                actionId: "attack_parry",
                phaseContexts: {
                  phase1: {
                    modifierBuckets: {
                      general: [],
                      situationDb: [],
                      situationInitiative: [],
                      situationObSkill: [],
                    },
                    targetParticipantId: "stale-scyrian",
                  },
                },
                roundNumber: baseState.roundNumber,
                submittedBy: "gm" as const,
              },
              stepStatuses: {
                ...participant.stepStatuses,
                phase_1_actions: "gmEdited" as const,
                select_actions: "gmEdited" as const,
              },
            }
          : participant,
      ),
      phaseResolutionCursor: {
        participantId: "encounter-participant-2",
        phase: "phase1" as const,
        substep: "attack" as const,
      },
      selectedParticipantId: "encounter-participant-2",
      selectedStep: "phase_1_actions" as const,
    };
    setupCombatDeclarationRoute({
      combatExperienceResolved: false,
      encounter: {
        combatRoundState: staleRoundState,
        participants: combatEncounter.participants,
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "GET",
      url: "/encounters/encounter-1",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = response.json().encounter;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: baseState.roundNumber,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.phaseResolutionCursor).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[1].declaration).toBeUndefined();
    expect(mocks.encounterService.updateCombatEncounter).not.toHaveBeenCalled();
  });

  it("clears a player-originated command-backed DE declaration", async () => {
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience();
    const stateWithCommand = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "player-1",
      },
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: {
            modifierBuckets: {
              general: [],
              situationDb: [],
              situationInitiative: [],
              situationObSkill: [],
            },
            targetParticipantId: "participant-2",
          },
        },
        roundNumber: 1,
      },
      participantId: "encounter-participant-1",
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "player",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithCommand,
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [attackParryDbParryModifierEntry],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: "attack_parry",
            lastDeclaredEncounterId: "encounter-1",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "select_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toBeUndefined();
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: undefined,
            lastDeclaredEncounterId: undefined,
            lastDeclaredMovementId: undefined,
            lastDeclaredRoundNumber: undefined,
          }),
        }),
      }),
    );
  });

  it("clears M1 and rewinds without erasing submitted DE declarations", async () => {
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          currentStep: "review_action_modifiers",
          participants: [
            {
              initiatives: {},
              label: "The Gladiator",
              participantId: "encounter-participant-1",
              stepStatuses: {
                initiative_phase_1: "pending",
                initiative_phase_2: "pending",
                phase_1_actions: "pending",
                phase_2_actions: "pending",
                review_action_modifiers: "complete",
                review_phase_2_actions: "pending",
                review_phase_2_damage: "pending",
                review_phase_2_modifiers: "pending",
                round_summary: "pending",
                select_actions: "submitted",
              },
            },
          ],
          roundNumber: 1,
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_action_modifiers,
    ).toBe("pending");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.select_actions).toBe(
      "submitted",
    );
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("undoes a canonical modifier review with its exact participant state atomically", async () => {
    const priorCombatContext = { modifierBuckets: emptyModifierBuckets() };
    const baseEncounter = makeCombatEncounter() as EncounterSession;
    const baseState = combatRoundStateSchema.parse({
      ...initializeCombatRoundState({ encounter: baseEncounter }),
      currentStep: "review_action_modifiers",
      participants: initializeCombatRoundState({ encounter: baseEncounter }).participants.map(
        (participant) => ({
          ...participant,
          declaration: {
            actionId: "parry",
            combatContext: priorCombatContext,
            roundNumber: 1,
            submittedBy: "player",
          },
          stepStatuses: {
            ...participant.stepStatuses,
            review_action_modifiers: "pending",
            select_actions: "submitted",
          },
        }),
      ),
    });
    const reviewed = recordCombatRoundParticipantStepReview({
      command: {
        commandId: "modifier-review-1",
        createdAt: "2026-08-01T09:00:00.000Z",
        createdByUserId: "gm-1",
      },
      modifierReviewUndo: {
        combatContext: priorCombatContext,
        combatEffects: { effects: [], events: [] },
      },
      participantId: "encounter-participant-1",
      previousDeclaration: baseState.participants[0]?.declaration,
      state: baseState,
      step: "review_action_modifiers",
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: { combatRoundState: reviewed },
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                ...emptyModifierBuckets(),
                general: [
                  {
                    application: "percentage",
                    id: "poor-footing",
                    notes: "Poor footing",
                    scope: "until",
                    value: -1,
                  },
                ],
              },
            },
          },
          combatEffects: { effects: [], events: [] },
          equipment: {},
          health: {},
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "review_action_modifiers",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.commitCombatParticipantStateMutations).toHaveBeenCalledWith(
      expect.objectContaining({
        participants: [
          expect.objectContaining({
            state: expect.objectContaining({
              combat: expect.objectContaining({ combatContext: priorCombatContext }),
              combatEffects: { effects: [], events: [] },
            }),
          }),
        ],
      }),
    );
  });

  it("clears a top-advance M1 command after the UI has landed on i1", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const canonicalParticipant = makeCombatScenarioParticipant({
      state: {
        ...makeCombatScenarioParticipant().state,
        combatEffects: { effects: [], events: [] },
      },
    });
    const reviewPhase1 = advanceCombatRoundStep(
      initializeCombatRoundState({ encounter: combatEncounter }),
    );
    const topAdvanced = advanceCombatRoundStep(reviewPhase1, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
        participantId: "encounter-participant-1",
      },
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: topAdvanced,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([canonicalParticipant]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "M1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("review_action_modifiers");
    expect(updatedEncounter.combatRoundState.gmBacktrackHold).toBeUndefined();
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("review_action_modifiers");
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_action_modifiers,
    ).toBe("pending");
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("clears a command-backed i1 cell by restoring the command before cursor", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const initiativeState = {
      ...initializeCombatRoundState({ encounter: combatEncounter }),
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1" as const,
    };
    const stateWithCommand = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: initiativeState,
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: stateWithCommand,
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "i1",
    });
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toBeUndefined();
  });

  it("clears a top-advance i1 command without leaving no-action A1 state selected", async () => {
    const combatEncounter = makeCombatEncounter() as EncounterSession;
    const initiativePhase1 = advanceCombatRoundStep(
      advanceCombatRoundStep(initializeCombatRoundState({ encounter: combatEncounter })),
    );
    const topAdvanced = advanceCombatRoundStep(initiativePhase1, {
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
        participantId: "encounter-participant-1",
      },
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...topAdvanced,
          phaseResolutionCursor: {
            participantId: "encounter-participant-1",
            phase: "phase1",
            substep: "damage",
          },
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "phase_1_actions",
        },
      },
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "i1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.phaseResolutionCursor).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_actions).toBe(
      "pending",
    );
    expect(
      updatedEncounter.combatRoundState.participants[0].stepStatuses.review_phase_2_actions,
    ).toBe("pending");
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_damage).toBe(
      "pending",
    );
  });

  it("falls back from an empty selected A1 cell to the latest i1 command undo", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const declaredState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testCombatPhaseContext("encounter-participant-1"),
        },
        roundNumber: 1,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "attack_parry",
          phaseContexts: {
            phase1: testCombatPhaseContext("encounter-participant-2"),
          },
          roundNumber: 1,
        },
        participantId: "encounter-participant-1",
        state: initializeCombatRoundState({ encounter: combatEncounter }),
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const initiativeState = {
      ...declaredState,
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1" as const,
    };
    const afterTopRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: initiativeState,
      submittedBy: "gm",
    });
    const afterGuardRoll = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterTopRoll,
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...afterGuardRoll,
          currentStep: "phase_1_actions",
          selectedParticipantId: "encounter-participant-2",
          selectedStep: "phase_1_actions",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-2",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(1);
    expect(updatedEncounter.combatRoundState.commands[0]).toMatchObject({
      participantId: "encounter-participant-1",
      type: "roll_initiative_phase1",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "i1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.participants[1].initiatives.phase1).toBeUndefined();
    expect(mocks.encounterService.updateScenarioParticipantState).not.toHaveBeenCalled();
  });

  it("clears the latest attack command even when the inspected cell is an older i1", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const declaredState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        phaseContexts: {
          phase1: testCombatPhaseContext("encounter-participant-1"),
        },
        roundNumber: 1,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "attack_parry",
          phaseContexts: {
            phase1: testCombatPhaseContext("encounter-participant-2"),
          },
          roundNumber: 1,
        },
        participantId: "encounter-participant-1",
        state: initializeCombatRoundState({ encounter: combatEncounter }),
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const initiativeState = {
      ...declaredState,
      currentStep: "initiative_phase_1" as const,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "initiative_phase_1" as const,
    };
    const afterGladiatorInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: initiativeState,
      submittedBy: "gm",
    });
    const afterGuardInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterGladiatorInitiative,
      submittedBy: "gm",
    });
    const gladiatorMiss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterGladiatorMiss = recordCombatRoundAttackResult({
      command: {
        createdAt: gladiatorMiss.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: gladiatorMiss,
      state: afterGuardInitiative,
      submittedBy: "gm",
    });
    const guardMiss = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-2",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-1",
      ob: 10,
      phase: "phase1",
      rollD20: 10,
      rollTotal: 10,
      rolledAt: "2026-01-01T00:04:00.000Z",
      weaponName: "Spear",
    });
    const afterGuardMiss = recordCombatRoundAttackResult({
      command: {
        createdAt: guardMiss.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-2",
      result: guardMiss,
      state: afterGladiatorMiss,
      submittedBy: "gm",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...afterGuardMiss,
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "initiative_phase_1",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(3);
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      participantId: "encounter-participant-1",
      type: "roll_attack",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "A1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("phase_1_actions");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("phase_1_actions");
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toMatchObject({
      total: 14,
    });
    expect(updatedEncounter.combatRoundState.participants[1].initiatives.phase1).toMatchObject({
      total: 12,
    });
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toMatchObject({
      actionId: gladiatorMiss.actionId,
      attackIndex: 1,
      attackModeId: "mode-1",
      attackOpportunityId: "round:1:participant:encounter-participant-1:phase1:attack_1",
      attackerParticipantId: gladiatorMiss.attackerParticipantId,
      defenderParticipantId: gladiatorMiss.defenderParticipantId,
      phase: "phase1",
      rollTotal: gladiatorMiss.rollTotal,
      weaponSourceId: "unarmed:virtual-weapon-template-punch",
    });
    expect(updatedEncounter.combatRoundState.participants[1].attackResults.phase1).toBeUndefined();
  });

  it("clears the latest parry command even when the inspected cell is an older i1", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const declaredState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "attack_parry",
          roundNumber: 1,
        },
        participantId: "encounter-participant-1",
        state: initializeCombatRoundState({ encounter: combatEncounter }),
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const afterGladiatorInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: declaredState,
      submittedBy: "gm",
    });
    const afterGuardInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterGladiatorInitiative,
      submittedBy: "gm",
    });
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackOpportunityId: "test-opportunity:clear-parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: afterGuardInitiative,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...afterParry,
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "initiative_phase_1",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toHaveLength(4);
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      participantId: "encounter-participant-2",
      type: "commit_defense_review",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "P1",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("review_phase_2_actions");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("review_phase_2_actions");
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toEqual(
      attackHit,
    );
    expect(updatedEncounter.combatRoundState.participants[0].initiatives.phase1).toMatchObject({
      total: 14,
    });
    expect(updatedEncounter.combatRoundState.participants[1].initiatives.phase1).toMatchObject({
      total: 12,
    });
    expect(
      updatedEncounter.combatRoundState.phaseResolutionResults[0]?.parryResolution.status,
    ).toBe("pending");
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageRoll.status).toBe(
      "pending",
    );
  });

  it("clears the latest committed damage command and removes only its combat effect rows", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const declaredState = recordCombatRoundDeclaration({
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-2",
      state: recordCombatRoundDeclaration({
        declaration: {
          actionId: "attack_parry",
          roundNumber: 1,
        },
        participantId: "encounter-participant-1",
        state: initializeCombatRoundState({ encounter: combatEncounter }),
        submittedBy: "gm",
      }),
      submittedBy: "gm",
    });
    const afterGladiatorInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 14,
      participantId: "encounter-participant-1",
      phase: "phase1",
      state: declaredState,
      submittedBy: "gm",
    });
    const afterGuardInitiative = recordCombatRoundInitiative({
      command: {
        createdAt: "2026-01-01T00:02:00.000Z",
        createdByUserId: "gm-1",
      },
      initiative: 12,
      participantId: "encounter-participant-2",
      phase: "phase1",
      state: afterGladiatorInitiative,
      submittedBy: "gm",
    });
    const attackHit = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackOpportunityId: "test-opportunity:clear-damage",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const afterAttack = recordCombatRoundAttackResult({
      command: {
        createdAt: attackHit.rolledAt,
        createdByUserId: "gm-1",
      },
      participantId: "encounter-participant-1",
      result: attackHit,
      state: afterGuardInitiative,
      submittedBy: "gm",
    });
    const afterParry = recordCombatRoundParryResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:00.000Z",
        createdByUserId: "gm-1",
      },
      parryResolution: {
        combinedParryScore: 9,
        modifierAdjustment: 0,
        openEndedD10s: [],
        resultLabel: "Parry failed",
        rollD20: 8,
        rollTotal: 8,
        status: "resolved",
        success: false,
        targetNumber: 21,
        total: 17,
      },
      state: afterAttack,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:00.000Z",
    });
    const afterLocation = recordCombatRoundHitLocationRoll({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:04:30.000Z",
        createdByUserId: "gm-1",
      },
      hitLocationRolls: [12],
      rolledByParticipantId: "encounter-participant-1",
      state: afterParry,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:04:30.000Z",
    });
    const afterDamage = recordCombatRoundDamageResult({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:05:00.000Z",
        createdByUserId: "gm-1",
      },
      defenderDm: 0,
      dmb: 8,
      state: afterLocation,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:00.000Z",
    });
    const afterCritical = recordCombatRoundCriticalRoll({
      attackResult: attackHit,
      command: {
        createdAt: "2026-01-01T00:05:30.000Z",
        createdByUserId: "gm-1",
      },
      criticalDice: [4, 5],
      rolledByParticipantId: "encounter-participant-1",
      state: afterDamage,
      submittedBy: "gm",
      updatedAt: "2026-01-01T00:05:30.000Z",
    });
    const existingCombatEffects: CombatEffectsState = {
      effects: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          damage: 0,
          description: "Existing row",
          effectGroup: "general",
          generalDamage: 0,
          id: "existing-effect",
          sourceEventId: "existing-event",
          status: "active",
          targetParticipantId: "participant-2",
          type: "special",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          description: "",
          id: "existing-event",
          sourceLabel: "Existing event",
          sourceType: "manual",
          targetParticipantId: "participant-2",
        },
      ],
    };
    const committed = commitCombatRoundPhaseDamage({
      attackerScenarioParticipantId: "participant-1",
      command: {
        commandId: "commit-d1-api",
        createdAt: "2026-01-01T00:06:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: existingCombatEffects,
      defenderScenarioParticipantId: "participant-2",
      encounterId: "encounter-1",
      scenarioId: "scenario-1",
      state: afterCritical,
    });
    const expectedCommitEventId =
      "commit-d1-api:r1:phase1:1-phase1-encounter-participant-1-encounter-participant-2:1-phase1-encounter-participant-1-encounter-participant-2-damage:combat-effect-event";
    const expectedCommitEffectId =
      "commit-d1-api:r1:phase1:1-phase1-encounter-participant-1-encounter-participant-2:1-phase1-encounter-participant-1-encounter-participant-2-damage:combat-effect:physical-damage-chestBack";
    const scenarioParticipants = [
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({
        id: "participant-2",
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: committed.combatEffects,
        },
      }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...committed.state,
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "initiative_phase_1",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    mocks.encounterService.updateScenarioParticipantState.mockImplementation(
      async (update: { participantId: string; state: unknown }) => ({
        ...scenarioParticipants.find((participant) => participant.id === update.participantId),
        state: update.state,
      }),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "initiative_phase_1",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands.at(-1)).toMatchObject({
      type: "roll_critical",
    });
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-2",
      roundNumber: 1,
      step: "D1",
    });
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("phase_1_damage");
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageResult).toBeDefined();
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.criticalRoll.status).toBe(
      "rolled",
    );
    expect(updatedEncounter.combatRoundState.phaseResolutionResults[0]?.damageProposal.status).toBe(
      "drafted",
    );
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledTimes(1);
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-2",
        scenarioId: "scenario-1",
        state: expect.objectContaining({
          combatEffects: expect.objectContaining({
            effects: [
              expect.objectContaining({
                id: "existing-effect",
              }),
            ],
            events: [
              expect.objectContaining({
                id: "existing-event",
              }),
            ],
          }),
        }),
      }),
    );
    const updatedParticipantState =
      mocks.encounterService.updateScenarioParticipantState.mock.calls[0]?.[0]?.state;
    expect(updatedParticipantState.combatEffects.effects).not.toContainEqual(
      expect.objectContaining({ id: expectedCommitEffectId }),
    );
    expect(updatedParticipantState.combatEffects.events).not.toContainEqual(
      expect.objectContaining({ id: expectedCommitEventId }),
    );
  });

  it("clears an SU participant review commit and restores effect duration state", async () => {
    const encounterParticipants = makeCombatEncounter().participants;
    const base = initializeCombatRoundState({
      encounter: makeCombatEncounter({ participants: encounterParticipants }) as EncounterSession,
    });
    const roundSummaryState = {
      ...base,
      currentCursor: {
        participantId: "encounter-participant-1",
        roundNumber: base.roundNumber,
        step: "SU" as const,
      },
      currentStep: "round_summary" as const,
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "round_summary" as const,
    };
    const existingCombatEffects: CombatEffectsState = {
      effects: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          damage: 0,
          description: "Bleeding wound",
          bleedState: {
            accumulatedTenths: 8,
            initializedRound: 1,
          },
          duration: "2 rounds",
          effectGroup: "bleed",
          generalDamage: 0,
          id: "bleed-1",
          modifierValue: 2,
          roundNumber: 1,
          sourceEventId: "existing-event",
          status: "active",
          targetParticipantId: "participant-1",
          type: "bleed",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      events: [
        {
          createdAt: "2026-01-01T00:00:00.000Z",
          description: "",
          id: "existing-event",
          sourceLabel: "Existing bleed",
          sourceType: "manual",
          targetParticipantId: "participant-1",
        },
      ],
    };
    const reviewed = prepareCombatRoundEndReview({
      command: {
        commandId: "prepare-su-api",
        createdAt: "2026-01-01T00:09:00.000Z",
        createdByUserId: "gm-1",
      },
      participantInputs: {
        "encounter-participant-1": {
          combatEffects: existingCombatEffects,
          healthStat: 9,
        },
      },
      state: roundSummaryState,
    });
    const committed = commitCombatRoundEndParticipantReview({
      command: {
        commandId: "commit-su-api",
        createdAt: "2026-01-01T00:10:00.000Z",
        createdByUserId: "gm-1",
      },
      combatEffects: existingCombatEffects,
      participantId: "encounter-participant-1",
      scenarioParticipantId: "participant-1",
      state: reviewed,
    });
    const scenarioParticipants = [
      makeCombatScenarioParticipant({
        id: "participant-1",
        state: {
          ...makeCombatScenarioParticipant().state,
          combatEffects: committed.combatEffects,
        },
      }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: committed.state,
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue(scenarioParticipants);
    mocks.encounterService.updateScenarioParticipantState.mockImplementation(
      async (update: { participantId: string; state: unknown }) => ({
        ...scenarioParticipants.find((participant) => participant.id === update.participantId),
        state: update.state,
      }),
    );
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(mocks.encounterService.commitCombatParticipantStateMutations).toHaveBeenCalledTimes(1);
    const updatedParticipantState =
      mocks.encounterService.commitCombatParticipantStateMutations.mock.calls[0]?.[0]
        ?.participants[0]?.state;

    expect(updatedParticipantState.combatEffects.effects).toContainEqual(
      expect.objectContaining({
        duration: "2 rounds",
        id: "bleed-1",
        status: "active",
      }),
    );
    expect(
      updatedParticipantState.combatEffects.effects.find(
        (effect: { id?: string }) => effect.id === "bleed-1",
      )?.bleedState?.accumulatedTenths,
    ).toBe(8);
    expect(
      updatedParticipantState.combatEffects.effects.some(
        (effect: { generalDamage?: number; type?: string }) =>
          effect.type === "general_damage" && effect.generalDamage === 1,
      ),
    ).toBe(false);
  });

  it("fallback DE undo from an empty selected A1 cell clears mirrored declaration state", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounterWithResolvedCombatExperience({
      participants: encounterParticipants,
    });
    const stateWithCommand = recordCombatRoundDeclaration({
      command: {
        createdAt: "2026-01-01T00:01:00.000Z",
        createdByUserId: "gm-1",
      },
      declaration: {
        actionId: "attack_parry",
        roundNumber: 1,
      },
      participantId: "encounter-participant-1",
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...stateWithCommand,
          currentStep: "phase_1_actions",
          selectedParticipantId: "encounter-participant-2",
          selectedStep: "phase_1_actions",
        },
        participants: encounterParticipants,
      },
      participant: {
        state: {
          combat: {
            combatContext: {
              modifierBuckets: {
                general: [],
                situationDb: [attackParryDbParryModifierEntry],
                situationInitiative: [],
                situationObSkill: [],
              },
            },
            lastDeclaredActionId: "attack_parry",
            lastDeclaredEncounterId: "encounter-1",
            lastDeclaredMovementId: "hold",
            lastDeclaredRoundNumber: 1,
          },
          conditions: [],
          equipment: {},
          health: {},
          modifiers: [],
          resources: {},
        },
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-2",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.commands).toEqual([]);
    expect(updatedEncounter.combatRoundState.currentCursor).toEqual({
      participantId: "encounter-participant-1",
      roundNumber: 1,
      step: "DE",
    });
    expect(updatedEncounter.combatRoundState.currentStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("select_actions");
    expect(updatedEncounter.combatRoundState.participants[0].declaration).toBeUndefined();
    expect(mocks.encounterService.updateScenarioParticipantState).toHaveBeenCalledWith(
      expect.objectContaining({
        participantId: "participant-1",
        state: expect.objectContaining({
          combat: expect.objectContaining({
            lastDeclaredActionId: undefined,
            lastDeclaredEncounterId: undefined,
            lastDeclaredRoundNumber: undefined,
          }),
        }),
      }),
    );
  });

  it("clears the selected A1 cell without rewinding to initiative", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const stateWithAttack = recordCombatRoundAttackResult({
      participantId: "encounter-participant-1",
      result: attackResult,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...stateWithAttack,
          currentStep: "initiative_phase_1",
          selectedParticipantId: "encounter-participant-1",
          selectedStep: "phase_1_actions",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-1",
        step: "phase_1_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-1");
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_actions).toBe(
      "pending",
    );
  });

  it("clears an auto-opened defender P1 cell back to the attacker A1 redo point", async () => {
    const encounterParticipants = [
      makeCombatEncounter().participants[0],
      {
        ...makeCombatEncounter().participants[0],
        id: "encounter-participant-2",
        label: "City guard",
        scenarioParticipantId: "participant-2",
      },
    ];
    const combatEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const attackResult = buildCombatRoundAttackRollResult({
      actionId: "attack_parry",
      attackerParticipantId: "encounter-participant-1",
      defenderDb: 10,
      defenderParticipantId: "encounter-participant-2",
      ob: 10,
      phase: "phase1",
      rollD20: 12,
      rollTotal: 12,
      rolledAt: "2026-01-01T00:03:00.000Z",
      weaponName: "Broad sword",
    });
    const stateWithAttack = recordCombatRoundAttackResult({
      participantId: "encounter-participant-1",
      result: attackResult,
      state: initializeCombatRoundState({ encounter: combatEncounter }),
      submittedBy: "gm",
    });
    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: {
          ...stateWithAttack,
          currentStep: "initiative_phase_1",
          selectedParticipantId: "encounter-participant-2",
          selectedStep: "review_phase_2_actions",
        },
        participants: encounterParticipants,
      },
      user: mocks.adminUser,
    });
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      makeCombatScenarioParticipant({ id: "participant-1" }),
      makeCombatScenarioParticipant({ id: "participant-2" }),
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      body: {
        participantId: "encounter-participant-2",
        step: "review_phase_2_actions",
      },
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    const updatedEncounter = mocks.encounterService.updateEncounter.mock.calls[0]?.[0]?.session;
    expect(updatedEncounter.combatRoundState.currentStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedStep).toBe("initiative_phase_1");
    expect(updatedEncounter.combatRoundState.selectedParticipantId).toBe("encounter-participant-2");
    expect(updatedEncounter.combatRoundState.participants[0].attackResults.phase1).toBeUndefined();
    expect(updatedEncounter.combatRoundState.participants[0].stepStatuses.phase_1_actions).toBe(
      "pending",
    );
    expect(
      updatedEncounter.combatRoundState.participants[1].stepStatuses.review_phase_2_actions,
    ).toBe("pending");
  });

  it("does not allow players to clear combat round steps", async () => {
    setupCombatDeclarationRoute();
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      url: "/encounters/encounter-1/combat-round/clear-current-step",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("rejects duplicate player submissions for the same assigned roll side", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [
          {
            createdAt: "2026-01-01T00:01:00.000Z",
            id: "existing-result",
            mode: "opposed",
            participantId: "scenario-participant-1",
            pendingRollId: "roll-1",
            rollSetId: "roll-set-1",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
            summary: "Player rolled Dodge.",
            type: "gm_skill_roll",
          },
        ],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "roll-1",
            mode: "opposed",
            participantId: "scenario-participant-1",
            rollSetId: "roll-set-1",
            side: "actor",
            silent: false,
            skillId: "dodge",
            skillLabel: "Dodge",
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      name: "Bridge Ambush",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "roll-1",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(200);
    expect(response.json().idempotent).toBe(true);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("authorizes the projected Adjust Distance response and rejects a future-stage repeat", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const buildRoundState = (status: "awaiting_defender_response" | "awaiting_gm_adjustment") =>
      combatRoundStateSchema.parse({
        adjustDistanceProposals: [
          {
            attackerParticipantId: "encounter-participant-1",
            currentDistance: 3,
            defenderParticipantId: "encounter-participant-2",
            defenderResponse: status === "awaiting_gm_adjustment" ? "oppose" : "pending",
            direction: "closer",
            id: "distance-proposal",
            pairId: "encounter-participant-1::encounter-participant-2",
            phase1OpportunityId: "distance-opportunity",
            phase2AttackOpportunityId: "distance-attack",
            requestedDistance: 2,
            roundNumber: 1,
            status,
          },
        ],
        commands: [
          {
            afterCursor: {
              participantId: "encounter-participant-1",
              roundNumber: 1,
              step: "i1",
            },
            beforeCursor: {
              participantId: "encounter-participant-1",
              roundNumber: 1,
              step: "i1",
            },
            createdAt: "2026-01-01T00:01:30.000Z",
            facts: {},
            id: "command-i1",
            participantId: "encounter-participant-1",
            phase: "phase1",
            roundNumber: 1,
            step: "i1",
            type: "roll_initiative_phase1",
          },
        ],
        currentCursor: { participantId: "encounter-participant-1", roundNumber: 1, step: "A1" },
        currentStep: "phase_1_actions",
        phaseResolutionCursor: {
          participantId: "encounter-participant-1",
          phase: "phase1",
          substep: "adjust_distance",
        },
        participants: [
          {
            declaration: {
              actionId: "adjust_range_attack",
              adjustDistance: {
                currentDistance: 3,
                requestedDistance: 2,
                targetParticipantId: "encounter-participant-2",
              },
              attackOpportunities: [
                {
                  id: "distance-attack",
                  origin: "adjust_range_attack",
                  phase: "phase2",
                  slot: "attack_2",
                  status: "committed",
                  targetParticipantId: "encounter-participant-2",
                },
              ],
              phaseContexts: {
                phase2: { targetParticipantId: "encounter-participant-2" },
              },
              roundNumber: 1,
              submittedBy: "player",
            },
            label: "The Gladiator",
            participantId: "encounter-participant-1",
            scenarioParticipantId: "participant-1",
          },
          {
            label: "City guard",
            participantId: "encounter-participant-2",
            scenarioParticipantId: "participant-2",
          },
        ],
        roundNumber: 1,
      });
    const participants = [
      { controlledByUserId: "other-player", id: "participant-1" },
      { controlledByUserId: "player-1", id: "participant-2" },
    ];

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: buildRoundState("awaiting_defender_response"),
        participants: encounterParticipants,
      },
      participants,
    });
    const app = await buildScenarioTestApp();
    const accepted = await app.inject({
      method: "POST",
      payload: {
        proposalId: "distance-proposal",
        response: "allow",
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/respond-adjust-distance",
    });
    await app.close();

    expect(accepted.statusCode, JSON.stringify(accepted.json())).toBe(200);
    expect(
      mocks.encounterService.updateEncounter.mock.calls.at(-1)?.[0]?.session.combatRoundState
        .adjustDistanceProposals[0],
    ).toMatchObject({ defenderResponse: "allow", status: "awaiting_review" });

    setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: buildRoundState("awaiting_gm_adjustment"),
        participants: encounterParticipants,
      },
      participants,
    });
    const repeatedApp = await buildScenarioTestApp();
    const rejected = await repeatedApp.inject({
      method: "POST",
      payload: {
        proposalId: "distance-proposal",
        response: "allow",
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/respond-adjust-distance",
    });
    await repeatedApp.close();

    expect(rejected.statusCode).toBe(409);
    expect(rejected.json()).toEqual({
      error: "The defender must choose whether to oppose the maneuver.",
    });
  });

  it("accepts either participant first in the projected Adjust Distance roll group", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const roundState = combatRoundStateSchema.parse({
      adjustDistanceProposals: [
        {
          attackerParticipantId: "encounter-participant-1",
          currentDistance: 3,
          defenderParticipantId: "encounter-participant-2",
          defenderResponse: "oppose",
          direction: "closer",
          gmRollAdjustment: { participantId: "encounter-participant-1", value: 1 },
          id: "distance-proposal",
          pairId: "encounter-participant-1::encounter-participant-2",
          phase1OpportunityId: "distance-opportunity",
          phase2AttackOpportunityId: "distance-attack",
          requestedDistance: 2,
          roundNumber: 1,
          status: "awaiting_rolls",
        },
      ],
      commands: [
        {
          afterCursor: {
            participantId: "encounter-participant-1",
            roundNumber: 1,
            step: "i1",
          },
          beforeCursor: {
            participantId: "encounter-participant-1",
            roundNumber: 1,
            step: "i1",
          },
          createdAt: "2026-01-01T00:01:30.000Z",
          facts: {},
          id: "command-i1",
          participantId: "encounter-participant-1",
          phase: "phase1",
          roundNumber: 1,
          step: "i1",
          type: "roll_initiative_phase1",
        },
      ],
      currentCursor: { participantId: "encounter-participant-1", roundNumber: 1, step: "A1" },
      currentStep: "phase_1_actions",
      observationRelationships: [
        {
          bestBonus: 1,
          completedAttempts: 1,
          id: "observation:encounter-participant-1:encounter-participant-2",
          observerParticipantId: "encounter-participant-1",
          roundsTowardNextAttempt: 0,
          targetParticipantId: "encounter-participant-2",
        },
        {
          bestBonus: 2,
          completedAttempts: 1,
          id: "observation:encounter-participant-2:encounter-participant-1",
          observerParticipantId: "encounter-participant-2",
          roundsTowardNextAttempt: 0,
          targetParticipantId: "encounter-participant-1",
        },
      ],
      phaseResolutionCursor: {
        participantId: "encounter-participant-1",
        phase: "phase1",
        substep: "adjust_distance",
      },
      participants: [
        {
          declaration: {
            actionId: "adjust_range_attack",
            adjustDistance: {
              currentDistance: 3,
              requestedDistance: 2,
              targetParticipantId: "encounter-participant-2",
            },
            attackOpportunities: [
              {
                id: "distance-attack",
                origin: "adjust_range_attack",
                phase: "phase2",
                slot: "attack_2",
                status: "committed",
                targetParticipantId: "encounter-participant-2",
              },
            ],
            phaseContexts: { phase2: { targetParticipantId: "encounter-participant-2" } },
            roundNumber: 1,
            submittedBy: "player",
          },
          label: "The Gladiator",
          participantId: "encounter-participant-1",
          scenarioParticipantId: "participant-1",
        },
        {
          label: "City guard",
          participantId: "encounter-participant-2",
          scenarioParticipantId: "participant-2",
        },
      ],
      roundNumber: 1,
    });
    const participants = [
      makeCombatScenarioParticipant({
        characterId: "character-1",
        controlledByUserId: "player-1",
        id: "participant-1",
        snapshot: {
          build: makeDodgeCharacterBuild("character-1", "The Gladiator"),
          displayName: "The Gladiator",
          equipmentState: makeMovementBurdenEquipmentState({ characterId: "character-1" }),
        },
      }),
      makeCombatScenarioParticipant({
        characterId: "character-2",
        controlledByUserId: "other-player",
        id: "participant-2",
        snapshot: {
          build: makeDodgeCharacterBuild("character-2", "City guard"),
          displayName: "City guard",
          equipmentState: makeMovementBurdenEquipmentState({ characterId: "character-2" }),
        },
      }),
    ];
    const mutable = setupMutableCombatRouteState({
      encounter: makeCombatEncounter({
        combatRoundState: roundState,
        participants: encounterParticipants,
      }) as EncounterSession,
      participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.4);
    const app = await buildScenarioTestApp();

    const defenderFirst = await app.inject({
      method: "POST",
      payload: {
        proposalId: "distance-proposal",
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/roll-adjust-distance",
    });
    const duplicateDefender = await app.inject({
      method: "POST",
      payload: {
        proposalId: "distance-proposal",
        scenarioParticipantId: "participant-2",
      },
      url: "/encounters/encounter-1/combat-round/roll-adjust-distance",
    });
    const attackerSecond = await app.inject({
      method: "POST",
      payload: {
        movementModifier: 99,
        proposalId: "distance-proposal",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-adjust-distance",
    });
    const resolvedProposal = mutable.encounter.combatRoundState?.adjustDistanceProposals[0];
    const committed = await app.inject({
      method: "POST",
      payload: {
        committedDistance: resolvedProposal?.standardProposedDistance,
        outcome: resolvedProposal?.standardOutcome,
        proposalId: "distance-proposal",
      },
      url: "/encounters/encounter-1/combat-round/commit-adjust-distance",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(defenderFirst.statusCode, JSON.stringify(defenderFirst.json())).toBe(200);
    expect(duplicateDefender.statusCode).toBe(409);
    expect(attackerSecond.statusCode, JSON.stringify(attackerSecond.json())).toBe(200);
    expect(committed.statusCode, JSON.stringify(committed.json())).toBe(200);
    expect(mutable.encounter.combatRoundState?.adjustDistanceProposals[0]).toMatchObject({
      attackerRoll: {
        appliedModifiers: expect.arrayContaining([
          expect.objectContaining({ label: "GM maneuver adjustment", value: 1 }),
        ]),
        dodgeSkillLabel: "Dodge",
        preDieTotal: expect.any(Number),
        skillContestCalculation: expect.objectContaining({
          movementBurden: expect.objectContaining({
            completeness: "complete",
            finalMovementModifier: 1,
          }),
          role: "initiator",
          totalPercentageAdjustment: 0,
          percentageContributions: expect.arrayContaining([
            expect.objectContaining({ category: "movement_mm", value: -1 }),
          ]),
        }),
        totalModifiers: 0,
      },
      attackerRollRecorded: true,
      defenderRoll: {
        appliedModifiers: expect.arrayContaining([
          expect.objectContaining({
            bucket: "skill_ob",
            label: "Observe Opponent · The Gladiator",
            value: 2,
          }),
          expect.objectContaining({ label: "Movement Modifier", value: -1 }),
        ]),
        skillContestCalculation: expect.objectContaining({
          movementBurden: expect.objectContaining({ finalMovementModifier: 1 }),
          percentageContributions: expect.arrayContaining([
            expect.objectContaining({ category: "relationship", value: 2 }),
            expect.objectContaining({ category: "movement_mm", value: -1 }),
          ]),
          role: "resisting_opponent",
          totalPercentageAdjustment: 1,
        }),
        totalModifiers: 1,
      },
      defenderRollRecorded: true,
      standardTableRowId: "tie_or_opponent_wins",
      status: "committed",
    });
    expect(mutable.encounter.combatRoundState?.currentStep).toBe("phase_1_actions");
    expect(
      mutable.encounter.combatRoundState?.participants[0]?.attackResults.phase2,
    ).toBeUndefined();
  });

  it("runs the projected Break Off review, participant-owned Dodge rolls, and GM commit", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const roundState = combatRoundStateSchema.parse({
      breakOffProposals: [
        {
          attackerParticipantId: "encounter-participant-2",
          escapeeParticipantId: "encounter-participant-1",
          id: "break-off-proposal",
          pairKey: "encounter-participant-1::encounter-participant-2",
          roundNumber: 1,
          status: "awaiting_gm_review",
        },
      ],
      commands: [
        {
          afterCursor: { participantId: "encounter-participant-1", roundNumber: 1, step: "A1" },
          beforeCursor: { participantId: "encounter-participant-1", roundNumber: 1, step: "i1" },
          createdAt: "2026-01-01T00:01:30.000Z",
          facts: {},
          id: "command-i1",
          participantId: "encounter-participant-1",
          phase: "phase1",
          roundNumber: 1,
          step: "i1",
          type: "commit_phase_initiative_resolution",
        },
      ],
      currentCursor: { participantId: "encounter-participant-1", roundNumber: 1, step: "A1" },
      currentStep: "phase_1_actions",
      phaseResolutionCursor: {
        participantId: "encounter-participant-1",
        phase: "phase1",
        substep: "break_off",
      },
      participants: [
        {
          declaration: {
            actionId: "break_off_engagement",
            roundNumber: 1,
            submittedBy: "player",
          },
          initiatives: { phase1: { rolls: [2], total: 2 } },
          label: "The Gladiator",
          participantId: "encounter-participant-1",
          scenarioParticipantId: "participant-1",
        },
        {
          initiatives: { phase1: { rolls: [6], total: 18 } },
          label: "City guard",
          participantId: "encounter-participant-2",
          scenarioParticipantId: "participant-2",
        },
      ],
      phaseResolutionStatuses: {
        "encounter-participant-1": { phase1: { substep: "break_off" } },
      },
      roundNumber: 1,
    });
    const participants = [
      makeCombatScenarioParticipant({
        characterId: "character-1",
        controlledByUserId: "player-1",
        id: "participant-1",
        snapshot: {
          build: makeDodgeCharacterBuild("character-1", "The Gladiator"),
          displayName: "The Gladiator",
          equipmentState: makeMovementBurdenEquipmentState({ characterId: "character-1" }),
        },
      }),
      makeCombatScenarioParticipant({
        characterId: "character-2",
        controlledByUserId: "other-player",
        id: "participant-2",
        snapshot: {
          build: makeDodgeCharacterBuild("character-2", "City guard"),
          displayName: "City guard",
          equipmentState: makeMovementBurdenEquipmentState({ characterId: "character-2" }),
        },
      }),
    ];
    const mutable = setupMutableCombatRouteState({
      encounter: makeCombatEncounter({
        combatRoundState: roundState,
        participants: encounterParticipants,
      }) as EncounterSession,
      participants,
      user: mocks.adminUser,
    });
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.4);
    const app = await buildScenarioTestApp();
    const reviewTask = buildCombatProgressionProjection(roundState)
      .boundary.processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((task) => task.expectedCommand === "review_break_off");
    expect(reviewTask).toBeDefined();

    const reviewed = await app.inject({
      method: "POST",
      payload: {
        attackerAdjustment: -2,
        escapeeAdjustment: 3,
        notes: "The doorway favors the escapee.",
        proposalId: "break-off-proposal",
        executionGroupId: reviewTask!.executionGroupId,
        expectedRevision: "2026-01-01T00:00:00.000Z",
        taskId: reviewTask!.id,
      },
      url: "/encounters/encounter-1/combat-round/review-break-off",
    });
    const attackerRoll = await app.inject({
      method: "POST",
      payload: { proposalId: "break-off-proposal", scenarioParticipantId: "participant-2" },
      url: "/encounters/encounter-1/combat-round/roll-break-off",
    });
    const writesBeforeRejectedReplay = mocks.encounterService.updateEncounter.mock.calls.length;
    const duplicateAttackerRoll = await app.inject({
      method: "POST",
      payload: { proposalId: "break-off-proposal", scenarioParticipantId: "participant-2" },
      url: "/encounters/encounter-1/combat-round/roll-break-off",
    });
    const staleEscapeeRoll = await app.inject({
      method: "POST",
      payload: {
        expectedRevision: "2026-01-01T00:00:00.000Z",
        proposalId: "break-off-proposal",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-break-off",
    });
    expect(mocks.encounterService.updateEncounter.mock.calls).toHaveLength(
      writesBeforeRejectedReplay,
    );
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.playerUser);
    const escapeeRoll = await app.inject({
      method: "POST",
      payload: { proposalId: "break-off-proposal", scenarioParticipantId: "participant-1" },
      url: "/encounters/encounter-1/combat-round/roll-break-off",
    });
    mocks.requireAuthenticatedUser.mockResolvedValue(mocks.adminUser);
    const committed = await app.inject({
      method: "POST",
      payload: { proposalId: "break-off-proposal" },
      url: "/encounters/encounter-1/combat-round/commit-break-off",
    });

    randomSpy.mockRestore();
    await app.close();

    expect(reviewed.statusCode, JSON.stringify(reviewed.json())).toBe(200);
    expect(escapeeRoll.statusCode, JSON.stringify(escapeeRoll.json())).toBe(200);
    expect(attackerRoll.statusCode, JSON.stringify(attackerRoll.json())).toBe(200);
    expect(duplicateAttackerRoll.statusCode).toBe(409);
    expect(staleEscapeeRoll.statusCode).toBe(409);
    expect(committed.statusCode, JSON.stringify(committed.json())).toBe(200);
    const playerSafeProposal = escapeeRoll.json().encounter.combatRoundState.breakOffProposals[0];
    expect(playerSafeProposal.attackerRoll).toBeUndefined();
    expect(playerSafeProposal.escapeeRoll.rolledByUserId).toBeUndefined();
    expect(playerSafeProposal.gmReview.notes).toBeUndefined();
    expect(mutable.encounter.combatRoundState?.breakOffProposals[0]).toMatchObject({
      attackerRoll: {
        calculation: expect.objectContaining({
          contestType: "break_off",
          role: "break_off_attacker",
          percentageContributions: expect.arrayContaining([
            expect.objectContaining({ category: "gm_adjustment", value: -2 }),
          ]),
        }),
      },
      escapeeRoll: {
        calculation: expect.objectContaining({
          contestType: "break_off",
          role: "break_off_escapee",
          percentageContributions: expect.arrayContaining([
            expect.objectContaining({ category: "gm_adjustment", value: 3 }),
          ]),
        }),
      },
      gmReview: {
        attackerAdjustment: -2,
        escapeeAdjustment: 3,
        notes: "The doorway favors the escapee.",
      },
      status: "committed",
    });
  });

  it("atomically ends canonical Continued Contact and restores its persisted effect on exact undo", async () => {
    const prepared = makeContinuedContactMaintenanceFixture();
    const originalEffect = prepared.participants[1]!.state.combatEffects?.effects.find(
      (effect) => effect.id === prepared.conditionId,
    );
    expect(originalEffect).toBeDefined();
    const baseState = combatRoundStateSchema.parse(prepared.encounter.combatRoundState);
    const roundState = combatRoundStateSchema.parse({
      ...baseState,
      breakOffProposals: [
        {
          attackerParticipantId: "encounter-participant-1",
          difference: 5,
          escapeeParticipantId: "encounter-participant-2",
          id: "break-off-contact-cleanup",
          pairKey: "encounter-participant-1::encounter-participant-2",
          result: {
            attackerObModifier: 0,
            defenderDbParryModifier: 0,
            escaped: true,
            tableRowId: "defender_1_to_5",
          },
          roundNumber: baseState.roundNumber,
          status: "awaiting_commit",
        },
      ],
      commands: [
        {
          afterCursor: {
            participantId: "encounter-participant-2",
            roundNumber: baseState.roundNumber,
            step: "A1",
          },
          beforeCursor: {
            participantId: "encounter-participant-2",
            roundNumber: baseState.roundNumber,
            step: "i1",
          },
          createdAt: "2026-01-01T00:01:30.000Z",
          facts: {},
          id: "command-break-off-initiative",
          participantId: "encounter-participant-2",
          phase: "phase1",
          roundNumber: baseState.roundNumber,
          step: "i1",
          type: "commit_phase_initiative_resolution",
        },
      ],
      currentCursor: {
        participantId: "encounter-participant-2",
        roundNumber: baseState.roundNumber,
        step: "A1",
      },
      currentStep: "phase_1_actions",
      participants: baseState.participants.map((participant) => ({
        ...participant,
        declaration: {
          actionId:
            participant.participantId === "encounter-participant-2"
              ? "break_off_engagement"
              : "attack_parry",
          roundNumber: baseState.roundNumber,
          submittedBy: "player",
        },
        initiatives: {
          phase1: {
            rolls: [participant.participantId === "encounter-participant-2" ? 2 : 6],
            total: participant.participantId === "encounter-participant-2" ? 2 : 18,
          },
        },
      })),
      phaseResolutionCursor: {
        participantId: "encounter-participant-2",
        phase: "phase1",
        substep: "break_off",
      },
      phaseResolutionStatuses: {
        "encounter-participant-2": { phase1: { substep: "break_off" } },
      },
      roundEndReview: undefined,
      selectedParticipantId: "encounter-participant-2",
      selectedStep: "phase_1_actions",
      unbalancedConditions: baseState.unbalancedConditions.map((condition) => ({
        ...condition,
        canonicalLifecycle: originalEffect!.canonicalLifecycle,
      })),
    });
    const encounter = {
      ...prepared.encounter,
      combatRoundState: roundState,
      currentRound: roundState.roundNumber,
    };
    const mutable = setupMutableCombatRouteState({
      encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    try {
      const membership = resolveEncounterParticipantMembership({
        encounter,
        scenarioParticipants: prepared.participants,
      });
      const materialized = initializeCombatRoundState({
        encounter: { ...encounter, participants: membership.participants },
      });
      const commitTask = getCurrentExecutableCombatTasks(
        buildCombatProgressionProjection(materialized),
      ).find((task) => task.expectedCommand === "commit_break_off");
      expect(commitTask).toBeDefined();
      const committed = await app.inject({
        method: "POST",
        payload: {
          proposalId: "break-off-contact-cleanup",
        },
        url: "/encounters/encounter-1/combat-round/commit-break-off",
      });
      expect(committed.statusCode, committed.body).toBe(200);
      expect(mocks.encounterService.commitCombatParticipantStateMutations).toHaveBeenCalledTimes(1);
      expect(mutable.encounter.combatRoundState?.continuedContacts[0]).toMatchObject({
        canonicalLifecycle: { lifecycle: { state: "resolved" } },
        status: "ended",
      });
      expect(mutable.encounter.combatRoundState?.unbalancedConditions[0]).toMatchObject({
        canonicalLifecycle: { lifecycle: { state: "resolved" } },
        status: "ended",
      });
      const expiredEffect = mutable.participants[1]!.state.combatEffects?.effects.find(
        (effect) => effect.id === prepared.conditionId,
      );
      expect(expiredEffect).toMatchObject({
        canonicalLifecycle: { lifecycle: { state: "resolved" } },
        status: "expired",
      });
      expect(
        mutable.encounter.combatRoundState?.commands.at(-1)?.facts
          .continuedContactEffectTransitions,
      ).toEqual([
        expect.objectContaining({
          nextEffect: expiredEffect,
          previousEffect: originalEffect,
          scenarioParticipantId: "participant-2",
        }),
      ]);

      const undone = await app.inject({
        method: "POST",
        payload: {
          participantId: "encounter-participant-2",
          step: "phase_1_actions",
        },
        url: "/encounters/encounter-1/combat-round/clear-current-step",
      });
      expect(undone.statusCode, undone.body).toBe(200);
      expect(mocks.encounterService.commitCombatParticipantStateMutations).toHaveBeenCalledTimes(2);
      expect(mutable.encounter.combatRoundState?.continuedContacts).toEqual(
        roundState.continuedContacts,
      );
      expect(mutable.encounter.combatRoundState?.unbalancedConditions).toEqual(
        roundState.unbalancedConditions,
      );
      expect(
        mutable.participants[1]!.state.combatEffects?.effects.find(
          (effect) => effect.id === prepared.conditionId,
        ),
      ).toEqual(originalEffect);
    } finally {
      await app.close();
    }
  });

  it("makes hidden and nonexistent Break Off roll probes privacy-equivalent with zero writes", async () => {
    const encounterParticipants = [
      ...makeTwoCombatEncounterParticipants(),
      {
        ...makeTwoCombatEncounterParticipants()[1]!,
        id: "encounter-participant-3",
        label: "Hidden guard",
        scenarioParticipantId: "participant-3",
      },
    ];
    const participants = [
      makeCombatScenarioParticipant({
        controlledByUserId: "player-1",
        id: "participant-1",
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "other-player",
        id: "participant-2",
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "third-player",
        id: "participant-3",
      }),
    ];
    const baseEncounter = makeCombatEncounter({
      participants: encounterParticipants,
    }) as EncounterSession;
    const baseState = initializeCombatRoundState({ encounter: baseEncounter });
    const roundState = combatRoundStateSchema.parse({
      ...baseState,
      breakOffProposals: [
        {
          attackerParticipantId: "encounter-participant-3",
          escapeeParticipantId: "encounter-participant-2",
          gmReview: { attackerAdjustment: 0, escapeeAdjustment: 0 },
          id: "hidden-break-off",
          pairKey: "encounter-participant-2::encounter-participant-3",
          roundNumber: 1,
          status: "awaiting_rolls",
        },
      ],
      currentCursor: { participantId: "encounter-participant-2", roundNumber: 1, step: "A1" },
      currentStep: "phase_1_actions",
      participants: baseState.participants.map((participant) => ({
        ...participant,
        declaration: {
          actionId:
            participant.participantId === "encounter-participant-2"
              ? "break_off_engagement"
              : "attack_parry",
          roundNumber: 1,
          submittedBy: "player",
        },
      })),
      phaseResolutionCursor: {
        participantId: "encounter-participant-2",
        phase: "phase1",
        substep: "break_off",
      },
      phaseResolutionStatuses: {
        "encounter-participant-2": { phase1: { substep: "break_off" } },
      },
    });
    setupMutableCombatRouteState({
      encounter: { ...baseEncounter, combatRoundState: roundState },
      participants,
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();
    try {
      const probe = (proposalId: string) =>
        app.inject({
          method: "POST",
          payload: { proposalId, scenarioParticipantId: "participant-1" },
          url: "/encounters/encounter-1/combat-round/roll-break-off",
        });
      const hidden = await probe("hidden-break-off");
      const nonexistent = await probe("nonexistent-break-off");
      expect(hidden.statusCode).toBe(409);
      expect(nonexistent.statusCode).toBe(409);
      expect(hidden.json()).toEqual(nonexistent.json());
      expect(hidden.json()).toEqual({
        code: "break_off_roll_unavailable",
        error: "Break Off roll is stale or not currently available.",
      });
      expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
      expect(mocks.encounterService.commitCombatParticipantStateMutations).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("rejects player roleplay rolls for silent assignments", async () => {
    const encounter = {
      actionLog: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      currentRound: 1,
      currentTurnIndex: 0,
      declarationsLocked: false,
      id: "encounter-1",
      kind: "roleplay",
      participants: [
        {
          id: "scenario-participant-1",
          label: "Player hero",
          participantType: "scenario",
          scenarioParticipantId: "participant-1",
        },
      ],
      roleplayState: {
        actionLog: [],
        pendingSkillRolls: [
          {
            assignedAt: "2026-01-01T00:00:00.000Z",
            id: "silent-roll",
            participantId: "scenario-participant-1",
            silent: true,
            skillId: "stealth",
            skillLabel: "Stealth",
          },
        ],
      },
      scenarioId: "scenario-1",
      status: "active",
      title: "Courtyard",
      turnOrderMode: "manual",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    mocks.encounterService.getEncounterById.mockResolvedValue(encounter);
    mocks.scenarioService.getScenarioById.mockResolvedValue({
      campaignId: "campaign-1",
      id: "scenario-1",
      name: "Bridge Ambush",
    });
    mocks.campaignService.getCampaignById.mockResolvedValue({
      gmUserId: "gm-1",
      id: "campaign-1",
      name: "Border Trouble",
    });
    mocks.scenarioService.userHasPlayerScenarioAccess.mockResolvedValue(true);
    mocks.scenarioService.listScenarioParticipants.mockResolvedValue([
      {
        controlledByUserId: "player-1",
        id: "participant-1",
        isActive: true,
        role: "player_character",
        scenarioId: "scenario-1",
        snapshot: {
          displayName: "Player hero",
        },
        sourceType: "character",
      },
    ]);
    const app = await buildScenarioTestApp();

    const response = await app.inject({
      method: "POST",
      payload: {
        pendingRollId: "silent-roll",
        roll: {
          dieResult: 12,
          openEndedD10s: [],
          rollD20: 12,
        },
      },
      url: "/encounters/encounter-1/player-roll",
    });

    await app.close();

    expect(response.statusCode).toBe(403);
    expect(mocks.encounterService.updateEncounter).not.toHaveBeenCalled();
  });

  it("commits defense review through the direct route once and rejects stale or repeated descriptors", async () => {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const configured = setupCombatDeclarationRoute({
      encounter: {
        combatRoundState: makeOpenPhase1AttackRoundState(),
        participants: encounterParticipants,
      },
      participants: [
        makeCombatScenarioParticipant({ id: "participant-1" }),
        makeCombatScenarioParticipant({ controlledByUserId: "other-player", id: "participant-2" }),
      ],
      user: mocks.adminUser,
    });
    const mutable = setupMutableCombatRouteState({
      encounter: configured.encounter as EncounterSession,
      participants: configured.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const attackResponse = await app.inject({
      method: "POST",
      payload: {
        defenderScenarioParticipantId: "participant-2",
        ob: 10,
        obSkillRaw: 0,
        phase: "phase1",
        scenarioParticipantId: "participant-1",
      },
      url: "/encounters/encounter-1/combat-round/roll-attack",
    });
    expect(attackResponse.statusCode, JSON.stringify(attackResponse.json())).toBe(200);

    const openState = mutable.encounter.combatRoundState!;
    const task = buildCombatProgressionProjection(openState)
      .boundary.processes.flatMap((process) => process.stages.flatMap((stage) => stage.tasks))
      .find((candidate) => candidate.kind === "defense_review");
    if (
      !task?.identity.attackResultId ||
      !task.identity.attackerParticipantId ||
      !task.identity.defenderParticipantId ||
      !task.identity.phase
    ) {
      throw new Error("Expected one exact defense-review task after the attack.");
    }
    const payload = {
      attackId: task.identity.attackResultId,
      attackerParticipantId: task.identity.attackerParticipantId,
      aware: false,
      defenderParticipantId: task.identity.defenderParticipantId,
      executionGroupId: task.executionGroupId,
      expectedRevision: mutable.encounter.updatedAt,
      phase: task.identity.phase,
      sourceSelections: [] as Array<{ included: boolean; itemId: string }>,
      taskId: task.id,
    };
    const writesAfterAttack = mocks.encounterService.updateCombatEncounter.mock.calls.length;

    const stale = await app.inject({
      method: "POST",
      payload: { ...payload, expectedRevision: "stale-revision" },
      url: "/encounters/encounter-1/combat-round/commit-defense-review",
    });
    expect(stale.statusCode).toBe(409);
    expect(stale.json()).toMatchObject({ code: "stale_revision" });
    expect(mocks.encounterService.updateCombatEncounter).toHaveBeenCalledTimes(writesAfterAttack);

    const committed = await app.inject({
      method: "POST",
      payload,
      url: "/encounters/encounter-1/combat-round/commit-defense-review",
    });
    expect(committed.statusCode, JSON.stringify(committed.json())).toBe(200);
    expect(committed.json().defenseSnapshot).toMatchObject({
      attackId: payload.attackId,
      aware: false,
      ordinaryDodgeAvailable: false,
      status: "committed",
    });
    expect(mutable.encounter.combatRoundState?.defenseSnapshots).toHaveLength(1);
    expect(mutable.encounter.combatRoundState?.commands.at(-1)?.type).toBe("commit_defense_review");
    const writesAfterCommit = mocks.encounterService.updateCombatEncounter.mock.calls.length;

    const retry = await app.inject({
      method: "POST",
      payload,
      url: "/encounters/encounter-1/combat-round/commit-defense-review",
    });
    expect([400, 409]).toContain(retry.statusCode);
    expect(mocks.encounterService.updateCombatEncounter).toHaveBeenCalledTimes(writesAfterCommit);
    expect(mutable.encounter.combatRoundState?.defenseSnapshots).toHaveLength(1);

    await app.close();
  });

  function makePerformTaskFixture(input: { playerControlled?: boolean } = {}) {
    const encounterParticipants = makeTwoCombatEncounterParticipants();
    const baseEncounter = encounterSessionSchema.parse(
      makeCombatEncounter({ participants: encounterParticipants }),
    );
    const initial = initializeCombatRoundState({ encounter: baseEncounter });
    const taskId = "round:1:participant:encounter-participant-1:declaration:perform_task";
    const state = combatRoundStateSchema.parse({
      ...initial,
      commands: [
        {
          afterCursor: { participantId: "encounter-participant-1", roundNumber: 1, step: "i1" },
          beforeCursor: { participantId: "encounter-participant-1", roundNumber: 1, step: "i1" },
          createdAt: "2026-01-01T00:01:30.000Z",
          facts: {},
          id: "command-i1",
          participantId: "encounter-participant-1",
          roundNumber: 1,
          step: "i1",
          type: "roll_initiative_phase1",
        },
      ],
      currentCursor: { participantId: "encounter-participant-1", roundNumber: 1, step: "A1" },
      currentStep: "phase_1_actions",
      genericActions: [
        {
          createdAt: "2026-01-01T00:01:00.000Z",
          createdByUserId: "player-1",
          declarationKind: "perform_task",
          duration: { kind: "gm_decided" },
          id: taskId,
          intent: "Force the portcullis winch.",
          lastUpdatedAt: "2026-01-01T00:01:00.000Z",
          ownerParticipantId: "encounter-participant-1",
          progress: { completedRounds: 0 },
          status: "declared",
        },
      ],
      participants: initial.participants.map((participant, index) => ({
        ...participant,
        declaration: {
          actionId: index === 0 ? "perform_task" : "parry",
          intent:
            index === 0
              ? {
                  primaryAction: {
                    actionId: "perform_task",
                    description: "Force the portcullis winch.",
                    taskId,
                  },
                  relativePositions: [],
                }
              : undefined,
          roundNumber: 1,
          submittedAt: "2026-01-01T00:01:00.000Z",
          submittedBy: "player",
        },
      })),
      phaseResolutionCursor: {
        participantId: "encounter-participant-1",
        phase: "phase1",
        substep: "perform_task",
      },
      phaseResolutionStatuses: {
        "encounter-participant-1": {
          phase1: { substep: "perform_task", updatedAt: "2026-01-01T00:01:00.000Z" },
        },
      },
      selectedParticipantId: "encounter-participant-1",
      selectedStep: "phase_1_actions",
    });
    const encounter = encounterSessionSchema.parse({
      ...baseEncounter,
      combatRoundState: state,
      updatedAt: "2026-01-01T00:02:00.000Z",
    });
    const participants = [
      makeCombatScenarioParticipant({
        controlledByUserId: input.playerControlled ? mocks.playerUser.id : "gm-1",
        id: "participant-1",
        snapshot: {
          build: makeDodgeCharacterBuild("character-1", "The Gladiator"),
          displayName: "The Gladiator",
          sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
      makeCombatScenarioParticipant({
        controlledByUserId: "gm-1",
        id: "participant-2",
        snapshot: {
          build: makeDodgeCharacterBuild("character-2", "City guard"),
          displayName: "City guard",
          sourceUpdatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    ] as unknown as ScenarioParticipant[];
    return { encounter, participants, taskId };
  }

  function performTaskDescriptor(encounter: EncounterSession) {
    const state = combatRoundStateSchema.parse(encounter.combatRoundState);
    const task = getCurrentExecutableCombatTasks(buildCombatProgressionProjection(state))[0]!;
    return {
      actionId: task.identity.actionId,
      executionGroupId: task.executionGroupId,
      expectedRevision: encounter.updatedAt,
      processId: task.processId,
      scenarioParticipantId: "participant-1",
      stageId: task.stageId,
      taskId: task.id,
      visibleToParticipantIds: [],
    };
  }

  it("drives the canonical Perform Task lifecycle from the projected Current action descriptor", async () => {
    const prepared = makePerformTaskFixture();
    const mutable = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const staleTask = await app.inject({
      method: "POST",
      payload: { ...performTaskDescriptor(mutable.encounter), taskId: "not-a-projected-task" },
      url: "/encounters/encounter-1/combat-round/review-combat-task",
    });
    expect(staleTask.statusCode, staleTask.body).toBe(409);
    expect(staleTask.json().code).toBe("task_mismatch");

    const staleRevision = await app.inject({
      method: "POST",
      payload: {
        ...performTaskDescriptor(mutable.encounter),
        expectedRevision: "2020-01-01T00:00:00.000Z",
      },
      url: "/encounters/encounter-1/combat-round/review-combat-task",
    });
    expect(staleRevision.statusCode, staleRevision.body).toBe(409);
    expect(staleRevision.json().code).toBe("stale_revision");

    const wrongAction = await app.inject({
      method: "POST",
      payload: { ...performTaskDescriptor(mutable.encounter), actionId: "another-task" },
      url: "/encounters/encounter-1/combat-round/review-combat-task",
    });
    expect(wrongAction.statusCode, wrongAction.body).toBe(409);

    const review = await app.inject({
      method: "POST",
      payload: {
        ...performTaskDescriptor(mutable.encounter),
        difficulty: 26,
        duration: { kind: "round" },
        rollKind: "none",
      },
      url: "/encounters/encounter-1/combat-round/review-combat-task",
    });
    expect(review.statusCode, review.body).toBe(200);
    expect(review.json().command).toMatchObject({ type: "review_combat_task" });
    const reviewedState = combatRoundStateSchema.parse(mutable.encounter.combatRoundState);
    expect(reviewedState.genericActions[0]).toMatchObject({
      duration: { kind: "round" },
      status: "active",
    });

    const resolve = await app.inject({
      method: "POST",
      payload: {
        ...performTaskDescriptor(mutable.encounter),
        resultText: "The winch groans and the portcullis lifts.",
        visibleToParticipantIds: ["encounter-participant-2"],
      },
      url: "/encounters/encounter-1/combat-round/resolve-combat-task",
    });
    expect(resolve.statusCode, resolve.body).toBe(200);
    const resolvedState = combatRoundStateSchema.parse(mutable.encounter.combatRoundState);
    expect(resolvedState.genericActions[0]).toMatchObject({
      progress: { completedRounds: 1, totalRounds: 1 },
      resolution: {
        text: "The winch groans and the portcullis lifts.",
        visibleToParticipantIds: ["encounter-participant-1", "encounter-participant-2"],
      },
      status: "completed",
    });
    expect(resolvedState.events.filter((event) => event.type === "task_resolved")).toHaveLength(1);

    const undone = undoLatestCombatRoundCommand({ state: resolvedState });
    expect(undone?.events.filter((event) => event.type === "task_resolved")).toHaveLength(0);
    expect(undone?.genericActions[0]).toMatchObject({
      progress: { completedRounds: 0 },
      status: "active",
    });
    expect(undone?.genericActions[0]?.resolution).toBeUndefined();
    expect(undone).toEqual(reviewedState);

    await app.close();
  });

  it("keeps GM-only Perform Task commands closed to the owning player", async () => {
    const prepared = makePerformTaskFixture({ playerControlled: true });
    const mutable = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.playerUser,
    });
    const app = await buildScenarioTestApp();

    for (const path of ["review-combat-task", "resolve-combat-task", "finish-combat-task"]) {
      const response = await app.inject({
        method: "POST",
        payload: { ...performTaskDescriptor(mutable.encounter), resultText: "Player authored." },
        url: `/encounters/encounter-1/combat-round/${path}`,
      });
      expect(response.statusCode, response.body).toBe(403);
    }
    expect(mocks.encounterService.updateCombatEncounter).not.toHaveBeenCalled();

    await app.close();
  });

  it("lets the owning player advance a multi-round Perform Task at their own opportunity", async () => {
    const prepared = makePerformTaskFixture({ playerControlled: true });
    const gmMutable = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants: prepared.participants,
      user: mocks.adminUser,
    });
    const gmApp = await buildScenarioTestApp();
    const review = await gmApp.inject({
      method: "POST",
      payload: {
        ...performTaskDescriptor(gmMutable.encounter),
        duration: { kind: "rounds", rounds: 2 },
        rollKind: "none",
      },
      url: "/encounters/encounter-1/combat-round/review-combat-task",
    });
    expect(review.statusCode, review.body).toBe(200);
    const reviewedEncounter = gmMutable.encounter;
    await gmApp.close();

    vi.clearAllMocks();
    const playerMutable = setupMutableCombatRouteState({
      encounter: reviewedEncounter,
      participants: prepared.participants,
      user: mocks.playerUser,
    });
    const playerApp = await buildScenarioTestApp();
    const advanceDescriptor = performTaskDescriptor(playerMutable.encounter);
    const advance = await playerApp.inject({
      method: "POST",
      payload: advanceDescriptor,
      url: "/encounters/encounter-1/combat-round/advance-combat-task",
    });
    expect(advance.statusCode, advance.body).toBe(200);
    const advancedState = combatRoundStateSchema.parse(playerMutable.encounter.combatRoundState);
    expect(advancedState.genericActions[0]).toMatchObject({
      progress: { completedRounds: 1, lastProgressedRoundNumber: 1, totalRounds: 2 },
      status: "active",
    });
    expect(advancedState.phaseResolutionStatuses["encounter-participant-1"]?.phase1?.substep).toBe(
      "done",
    );

    // The opportunity is consumed for the round: no lifecycle task remains projected, and the
    // descriptor that authorized the first advance can never authorize a second.
    expect(
      getCurrentExecutableCombatTasks(buildCombatProgressionProjection(advancedState)).filter(
        (task) => task.processId.includes("process:perform_task"),
      ),
    ).toHaveLength(0);
    const second = await playerApp.inject({
      method: "POST",
      payload: { ...advanceDescriptor, expectedRevision: playerMutable.encounter.updatedAt },
      url: "/encounters/encounter-1/combat-round/advance-combat-task",
    });
    expect(second.statusCode, second.body).toBe(409);

    await playerApp.close();
  });

  /**
   * Forgejo issue #340, acceptance criteria 2 and 3. The GM drives `roll_combat_task` — not only
   * the player — and the resolve carries the audience the GM chose. The privacy assertion is made
   * on the **API payload** the player is served, through the same
   * `buildPlayerSafeEncounterForUser` projection the encounter routes serialize with, not on the
   * DOM. No privacy projection is changed here; the resolve only supplies the existing
   * `visibleToParticipantIds` input.
   */
  it("lets the GM roll and resolve, and serves the result only to the chosen audience", async () => {
    const prepared = makePerformTaskFixture();
    const participants = [
      prepared.participants[0]!,
      {
        ...prepared.participants[1]!,
        controlledByUserId: mocks.playerUser.id,
      } as ScenarioParticipant,
    ];
    const mutable = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();

    const review = await app.inject({
      method: "POST",
      payload: {
        ...performTaskDescriptor(mutable.encounter),
        difficulty: 26,
        duration: { kind: "round" },
        referenceKind: "environment",
        environmentDescription: "The rusted winch housing.",
        rollKind: "stat",
        statId: "dex",
      },
      url: "/encounters/encounter-1/combat-round/review-combat-task",
    });
    expect(review.statusCode, review.body).toBe(200);
    const reviewedState = combatRoundStateSchema.parse(mutable.encounter.combatRoundState);
    expect(reviewedState.genericActions[0]).toMatchObject({
      reference: { description: "The rusted winch housing.", kind: "environment" },
      rollRequest: { basis: { kind: "stat", statId: "dex" }, difficulty: 26 },
      status: "active",
    });

    // The roll, driven by the GM rather than the owning player.
    const roll = await app.inject({
      method: "POST",
      payload: performTaskDescriptor(mutable.encounter),
      url: "/encounters/encounter-1/combat-round/roll-combat-task",
    });
    expect(roll.statusCode, roll.body).toBe(200);
    expect(roll.json().command).toMatchObject({ type: "roll_combat_task" });
    expect(
      combatRoundStateSchema.parse(mutable.encounter.combatRoundState).genericActions[0]
        ?.rollResult,
    ).toBeTruthy();

    const resolve = await app.inject({
      method: "POST",
      payload: {
        ...performTaskDescriptor(mutable.encounter),
        resultText: "The winch groans and the portcullis lifts.",
        visibleToParticipantIds: [],
      },
      url: "/encounters/encounter-1/combat-round/resolve-combat-task",
    });
    expect(resolve.statusCode, resolve.body).toBe(200);
    const resolved = mutable.encounter;
    expect(combatRoundStateSchema.parse(resolved.combatRoundState).genericActions[0]).toMatchObject(
      {
        resolution: {
          text: "The winch groans and the portcullis lifts.",
          // The owner is always entitled; nobody else was chosen.
          visibleToParticipantIds: ["encounter-participant-1"],
        },
        status: "completed",
      },
    );
    await app.close();

    // The non-entitled viewer receives no row at all in the payload the API serves them.
    const nonEntitled = buildPlayerSafeEncounterForUser({
      encounter: resolved,
      scenarioParticipants: participants,
      userId: mocks.playerUser.id,
    });
    expect(nonEntitled.combatRoundState?.genericActions ?? []).toHaveLength(0);
    expect(JSON.stringify(nonEntitled)).not.toContain("The winch groans and the portcullis lifts.");
  });

  /** Forgejo issue #340, acceptance criterion 3 — the entitled viewer does receive the result. */
  it("serves the resolved result to a viewer the GM put in the audience", async () => {
    const prepared = makePerformTaskFixture();
    const participants = [
      prepared.participants[0]!,
      {
        ...prepared.participants[1]!,
        controlledByUserId: mocks.playerUser.id,
      } as ScenarioParticipant,
    ];
    const mutable = setupMutableCombatRouteState({
      encounter: prepared.encounter,
      participants,
      user: mocks.adminUser,
    });
    const app = await buildScenarioTestApp();
    const review = await app.inject({
      method: "POST",
      payload: {
        ...performTaskDescriptor(mutable.encounter),
        duration: { kind: "round" },
        rollKind: "none",
      },
      url: "/encounters/encounter-1/combat-round/review-combat-task",
    });
    expect(review.statusCode, review.body).toBe(200);
    const resolve = await app.inject({
      method: "POST",
      payload: {
        ...performTaskDescriptor(mutable.encounter),
        resultText: "The winch groans and the portcullis lifts.",
        visibleToParticipantIds: ["encounter-participant-2"],
      },
      url: "/encounters/encounter-1/combat-round/resolve-combat-task",
    });
    expect(resolve.statusCode, resolve.body).toBe(200);
    await app.close();

    const entitled = buildPlayerSafeEncounterForUser({
      encounter: mutable.encounter,
      scenarioParticipants: participants,
      userId: mocks.playerUser.id,
    });
    expect(entitled.combatRoundState?.genericActions).toHaveLength(1);
    expect(entitled.combatRoundState?.genericActions[0]?.resolution).toMatchObject({
      text: "The winch groans and the portcullis lifts.",
      visibleToParticipantIds: ["encounter-participant-2"],
    });
  });

  /** Forgejo issue #340, acceptance criterion 4 — both finish commands at the opportunity. */
  it.each([
    ["interrupt", "interrupted", "interrupt_combat_task"],
    ["cancel", "cancelled", "cancel_combat_task"],
  ] as const)(
    "lets the GM %s a Combat Task at the opportunity boundary",
    async (finishKind, expectedStatus, expectedCommand) => {
      vi.clearAllMocks();
      const prepared = makePerformTaskFixture();
      const mutable = setupMutableCombatRouteState({
        encounter: prepared.encounter,
        participants: prepared.participants,
        user: mocks.adminUser,
      });
      const app = await buildScenarioTestApp();
      const review = await app.inject({
        method: "POST",
        payload: {
          ...performTaskDescriptor(mutable.encounter),
          duration: { kind: "round" },
          rollKind: "none",
        },
        url: "/encounters/encounter-1/combat-round/review-combat-task",
      });
      expect(review.statusCode, review.body).toBe(200);

      const finished = await app.inject({
        method: "POST",
        payload: {
          ...performTaskDescriptor(mutable.encounter),
          boundary: "opportunity",
          finishKind,
        },
        url: "/encounters/encounter-1/combat-round/finish-combat-task",
      });
      expect(finished.statusCode, finished.body).toBe(200);
      expect(finished.json().command).toMatchObject({ type: expectedCommand });
      const state = combatRoundStateSchema.parse(mutable.encounter.combatRoundState);
      expect(state.genericActions[0]?.status).toBe(expectedStatus);
      expect(state.events.filter((event) => event.type === "task_resolved")).toHaveLength(0);
      await app.close();
    },
  );
});
