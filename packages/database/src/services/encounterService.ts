import {
  buildCombatLogProjection,
  canTransitionEncounterStatus,
  isCombatStepEventPublishedToActivity,
  isEncounterMutable,
  isScenarioLiveInteractive,
  refreshScenarioParticipantPersistentCombatModifiers,
  type CombatLogSummaryFacts,
  type EncounterSession,
  type EncounterSessionSummary,
  type CombatStepEvent,
  type Scenario,
  type ScenarioParticipant,
  type ScenarioParticipantState,
} from "@glantri/domain";

import {
  createPrismaEncounterRepository,
  EncounterPresenceError,
  type EncounterRepository,
} from "../repositories/encounterRepository";
import { CombatPersistenceError } from "../repositories/combatStatePersistenceRepository";
import {
  createPrismaScenarioRepository,
  type ScenarioRepository,
} from "../repositories/scenarioRepository";
import { prisma as defaultPrisma } from "../client";
import { assertScenarioEquipmentCurrent } from "./scenarioEquipmentReconciliation";
import {
  advanceScenarioRound,
  createScenarioLiveState,
  setScenarioPhase,
  startScenario,
} from "@glantri/domain";

function collectCombatStepEvents(session: EncounterSession): CombatStepEvent[] {
  const state = session.combatRoundState;
  if (!state) return [];
  return [...state.rounds.flatMap((round) => round.events), ...state.events];
}

/**
 * Activity summaries derive from the **same** `CombatLogSummaryFacts` the Combat Log already uses,
 * so Combat never grows a second, independently drifting summariser
 * (combat-panel-contract.md 12.7, 12.13 A2-Q1). Events the Combat Log does not project carry no
 * entry here and fall back to their own public-scope facts at projection time.
 */
function collectCombatLogSummaryFacts(
  session: EncounterSession,
): Record<string, CombatLogSummaryFacts> {
  const state = session.combatRoundState;
  if (!state) return {};
  const facts: Record<string, CombatLogSummaryFacts> = {};
  for (const entry of buildCombatLogProjection({
    encounterId: session.id,
    sourceRevision: session.updatedAt,
    state,
  }).events) {
    for (const sourceEventId of entry.sourceEventIds) {
      facts[sourceEventId] ??= entry.summaryFacts;
    }
  }
  return facts;
}

export class EncounterCombatWriteError extends Error {
  constructor(
    readonly code: "stale_revision" | "transaction_conflict",
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "EncounterCombatWriteError";
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: cause,
        writable: true,
      });
    }
  }
}

export class EncounterWriteError extends Error {
  constructor(
    readonly code:
      | "inactive_participant"
      | "invalid_active_membership"
      | "invalid_transition"
      | "encounter_not_active"
      | "parent_scenario_not_active"
      | "participant_already_active"
      | "read_only"
      | "stale_revision"
      | "transaction_conflict",
    message: string,
    cause?: unknown,
  ) {
    super(message);
    this.name = "EncounterWriteError";
    if (cause !== undefined) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: cause,
        writable: true,
      });
    }
  }
}

export class EncounterService {
  private readonly equipmentGuard?: (scenarioId: string) => Promise<void>;

  constructor(
    private readonly encounterRepository: EncounterRepository = createPrismaEncounterRepository(),
    private readonly scenarioRepository: ScenarioRepository = createPrismaScenarioRepository(),
    equipmentGuard?: (scenarioId: string) => Promise<void>,
  ) {
    this.equipmentGuard =
      equipmentGuard ??
      (arguments.length === 0
        ? (scenarioId) => assertScenarioEquipmentCurrent({ client: defaultPrisma, scenarioId })
        : undefined);
  }

  async createEncounter(input: {
    campaignId?: string | null;
    createdByUserId?: string | null;
    scenarioId: string;
    session: EncounterSession;
  }): Promise<EncounterSession> {
    const scenario = await this.assertScenarioExists(input.scenarioId);
    if (scenario.status === "completed" || scenario.status === "archived") {
      throw new EncounterWriteError(
        "read_only",
        "Closed or archived Scenarios cannot contain new Encounters.",
      );
    }
    if (input.session.status !== "draft") {
      throw new EncounterWriteError("invalid_transition", "A new Encounter must begin as Draft.");
    }
    return this.encounterRepository.createEncounter(input);
  }

  async getEncounterById(encounterId: string): Promise<EncounterSession | null> {
    return this.encounterRepository.getEncounterById(encounterId);
  }

  async getEncounterSummaryById(encounterId: string): Promise<EncounterSessionSummary | null> {
    return this.encounterRepository.getEncounterSummaryById(encounterId);
  }

  async listEncountersByScenario(scenarioId: string): Promise<EncounterSession[]> {
    return this.encounterRepository.listEncountersByScenario(scenarioId);
  }

  async listEncounterSummariesByScenario(scenarioId: string): Promise<EncounterSessionSummary[]> {
    return this.encounterRepository.listEncounterSummariesByScenario(scenarioId);
  }

  async updateEncounter(input: {
    objectiveEvent?: {
      actorUserId?: string | null;
      eventType: string;
      summary: string;
    };
    campaignId?: string | null;
    encounterId: string;
    expectedRevision?: string;
    scenarioId?: string | null;
    session: EncounterSession;
  }): Promise<EncounterSession> {
    const existing = await this.encounterRepository.getEncounterById(input.encounterId);
    if (!existing) throw new Error("Encounter not found.");
    if (!canTransitionEncounterStatus(existing.status, input.session.status)) {
      throw new EncounterWriteError(
        "invalid_transition",
        `Encounter cannot move from ${existing.status} to ${input.session.status}.`,
      );
    }
    if (existing.status === input.session.status && !isEncounterMutable(existing.status)) {
      throw new EncounterWriteError("read_only", "Closed and archived Encounters are read-only.");
    }
    if (existing.status === "paused" && input.session.status === "paused") {
      throw new EncounterWriteError(
        "read_only",
        "A paused Encounter must be resumed or closed before it can change.",
      );
    }
    const scenarioId = input.scenarioId ?? existing.scenarioId;
    if (scenarioId) {
      const scenario = await this.assertScenarioExists(scenarioId);
      if (input.session.status === "active" && !isScenarioLiveInteractive(scenario.status)) {
        throw new EncounterWriteError(
          "parent_scenario_not_active",
          "The parent Scenario must be active before this Encounter can be active.",
        );
      }
      if (input.session.status === "active" && existing.status !== "active") {
        await this.equipmentGuard?.(scenarioId);
      }
      if (
        scenario.status === "archived" ||
        (scenario.status === "completed" && input.session.status !== "archived")
      ) {
        throw new EncounterWriteError("read_only", "The parent Scenario is read-only.");
      }
    }
    try {
      return await this.encounterRepository.updateEncounter(input);
    } catch (error) {
      if (
        error instanceof CombatPersistenceError &&
        (error.code === "stale_revision" || error.code === "transaction_conflict")
      ) {
        throw new EncounterWriteError(error.code, error.message, error);
      }
      if (error instanceof EncounterPresenceError) {
        throw new EncounterWriteError(error.code, error.message, error);
      }
      throw error;
    }
  }

  async updateCombatEncounter(input: {
    campaignId?: string | null;
    encounterId: string;
    expectedRevision: string;
    scenarioId?: string | null;
    session: EncounterSession;
    participantStateUpdates?: Array<{
      expectedRevision: string;
      participantId: string;
      scenarioId: string;
      state: ScenarioParticipantState;
    }>;
  }): Promise<EncounterSession> {
    const existing = await this.encounterRepository.getEncounterById(input.encounterId);
    if (!existing) throw new Error("Encounter not found.");
    if (existing.status !== "active" || input.session.status !== "active") {
      throw new EncounterWriteError(
        "encounter_not_active",
        "Combat activity requires an active Encounter.",
      );
    }
    const scenarioId = input.scenarioId ?? existing.scenarioId;
    if (scenarioId) {
      const scenario = await this.assertScenarioExists(scenarioId);
      if (!isScenarioLiveInteractive(scenario.status)) {
        throw new EncounterWriteError(
          "parent_scenario_not_active",
          "Combat activity requires an active parent Scenario.",
        );
      }
      await this.equipmentGuard?.(scenarioId);
    }
    try {
      const existingEventIds = new Set(collectCombatStepEvents(existing).map((event) => event.id));
      return await this.encounterRepository.updateCombatEncounter({
        ...input,
        // combat-panel-contract.md 12.7 is satisfied on the server: a suppressed event is never
        // forwarded as an Activity objectiveEvent at all.
        objectiveEventSummaryFacts: collectCombatLogSummaryFacts(input.session),
        objectiveEvents: collectCombatStepEvents(input.session).filter(
          (event) =>
            !existingEventIds.has(event.id) && isCombatStepEventPublishedToActivity(event.type),
        ),
      });
    } catch (error) {
      if (
        error instanceof CombatPersistenceError &&
        (error.code === "stale_revision" || error.code === "transaction_conflict")
      ) {
        throw new EncounterCombatWriteError(error.code, error.message, error);
      }
      if (error instanceof EncounterPresenceError) {
        throw new EncounterWriteError(error.code, error.message, error);
      }
      throw error;
    }
  }

  async commitCombatModifierReview(input: {
    campaignId?: string | null;
    encounterId: string;
    expectedEncounterRevision: string;
    participant: ScenarioParticipant;
    scenarioId: string;
    session: EncounterSession;
    state: ScenarioParticipantState;
  }): Promise<{ encounter: EncounterSession; participant: ScenarioParticipant }> {
    const saved = await this.commitCombatParticipantStateMutations({
      campaignId: input.campaignId,
      encounterId: input.encounterId,
      expectedEncounterRevision: input.expectedEncounterRevision,
      participants: [{ participant: input.participant, state: input.state }],
      scenarioId: input.scenarioId,
      session: input.session,
    });
    return { encounter: saved.encounter, participant: saved.participants[0]! };
  }

  async commitCombatModifierReviews(input: {
    campaignId?: string | null;
    encounterId: string;
    expectedEncounterRevision: string;
    participants: Array<{ participant: ScenarioParticipant; state: ScenarioParticipantState }>;
    scenarioId: string;
    session: EncounterSession;
  }): Promise<{ encounter: EncounterSession; participants: ScenarioParticipant[] }> {
    return this.commitCombatParticipantStateMutations(input);
  }

  /**
   * Serializable combat mutation for commands that update one or more participant effect states
   * together with the encounter cursor, events, results, revision, and undo facts.
   */
  async commitCombatParticipantStateMutation(input: {
    campaignId?: string | null;
    encounterId: string;
    expectedEncounterRevision: string;
    participant: ScenarioParticipant;
    scenarioId: string;
    session: EncounterSession;
    state: ScenarioParticipantState;
  }): Promise<{ encounter: EncounterSession; participant: ScenarioParticipant }> {
    const saved = await this.commitCombatParticipantStateMutations({
      campaignId: input.campaignId,
      encounterId: input.encounterId,
      expectedEncounterRevision: input.expectedEncounterRevision,
      participants: [{ participant: input.participant, state: input.state }],
      scenarioId: input.scenarioId,
      session: input.session,
    });
    return { encounter: saved.encounter, participant: saved.participants[0]! };
  }

  async commitCombatParticipantStateMutations(input: {
    campaignId?: string | null;
    encounterId: string;
    expectedEncounterRevision: string;
    participants: Array<{ participant: ScenarioParticipant; state: ScenarioParticipantState }>;
    scenarioId: string;
    session: EncounterSession;
  }): Promise<{ encounter: EncounterSession; participants: ScenarioParticipant[] }> {
    const participantStateUpdates = input.participants.map(({ participant, state }) => ({
      expectedRevision: participant.updatedAt,
      participantId: participant.id,
      scenarioId: input.scenarioId,
      state: refreshScenarioParticipantPersistentCombatModifiers({ state }),
    }));
    const encounter = await this.updateCombatEncounter({
      campaignId: input.campaignId,
      encounterId: input.encounterId,
      expectedRevision: input.expectedEncounterRevision,
      participantStateUpdates,
      scenarioId: input.scenarioId,
      session: input.session,
    });
    const participants = await Promise.all(
      input.participants.map(({ participant }) =>
        this.scenarioRepository.getScenarioParticipantById(participant.id, input.scenarioId),
      ),
    );
    if (participants.some((participant) => !participant)) {
      throw new Error("A scenario participant disappeared after the atomic combat commit.");
    }
    return { encounter, participants: participants as ScenarioParticipant[] };
  }

  async updateScenarioLiveState(input: {
    liveState: Scenario["liveState"];
    scenarioId: string;
  }): Promise<Scenario> {
    await this.assertScenarioExists(input.scenarioId);

    const scenario = await this.scenarioRepository.updateScenarioLiveState(
      input.scenarioId,
      input.liveState ?? createScenarioLiveState(),
    );

    await this.scenarioRepository.createScenarioEventLog({
      eventType: "live_state_updated",
      payload: scenario.liveState,
      phase: scenario.liveState?.phase,
      roundNumber: scenario.liveState?.roundNumber,
      scenarioId: input.scenarioId,
      summary: "Scenario live state updated.",
    });

    return scenario;
  }

  async startScenario(scenarioId: string): Promise<Scenario> {
    const existingScenario = await this.assertScenarioExists(scenarioId);
    const liveState = startScenario(
      existingScenario.liveState ?? createScenarioLiveState(),
      new Date().toISOString(),
    );
    const scenario = await this.scenarioRepository.updateScenarioLiveState(scenarioId, liveState);

    await this.scenarioRepository.createScenarioEventLog({
      eventType: "scenario_started",
      payload: liveState,
      phase: liveState.phase,
      roundNumber: liveState.roundNumber,
      scenarioId,
      summary: "Scenario started.",
    });

    return scenario;
  }

  async advanceScenarioRound(scenarioId: string): Promise<Scenario> {
    const existingScenario = await this.assertScenarioExists(scenarioId);
    const liveState = advanceScenarioRound(existingScenario.liveState ?? createScenarioLiveState());
    const scenario = await this.scenarioRepository.updateScenarioLiveState(scenarioId, liveState);

    await this.scenarioRepository.createScenarioEventLog({
      eventType: "round_advanced",
      payload: liveState,
      phase: liveState.phase,
      roundNumber: liveState.roundNumber,
      scenarioId,
      summary: `Advanced to round ${liveState.roundNumber}.`,
    });

    return scenario;
  }

  async setScenarioPhase(input: { phase: 1 | 2; scenarioId: string }): Promise<Scenario> {
    const existingScenario = await this.assertScenarioExists(input.scenarioId);
    const liveState = setScenarioPhase(
      existingScenario.liveState ?? createScenarioLiveState(),
      input.phase,
    );
    const scenario = await this.scenarioRepository.updateScenarioLiveState(
      input.scenarioId,
      liveState,
    );

    await this.scenarioRepository.createScenarioEventLog({
      eventType: "phase_changed",
      payload: liveState,
      phase: liveState.phase,
      roundNumber: liveState.roundNumber,
      scenarioId: input.scenarioId,
      summary: `Scenario phase set to ${input.phase}.`,
    });

    return scenario;
  }

  async updateScenarioParticipantState(input: {
    participantId: string;
    scenarioId: string;
    state: ScenarioParticipantState;
  }): Promise<ScenarioParticipant> {
    await this.assertScenarioAllowsLiveMutation(input.scenarioId);
    // This is the shared persisted-state boundary for participant effect mutations from
    // combat commands, undo, round-end duration changes, and direct GM effect editing.
    const state = refreshScenarioParticipantPersistentCombatModifiers({ state: input.state });
    const participant = await this.scenarioRepository.updateScenarioParticipantState(
      input.participantId,
      state,
    );
    const scenario = await this.scenarioRepository.getScenarioById(input.scenarioId);

    await this.scenarioRepository.createScenarioEventLog({
      eventType: "participant_state_updated",
      participantId: input.participantId,
      payload: state,
      phase: scenario?.liveState?.phase,
      roundNumber: scenario?.liveState?.roundNumber,
      scenarioId: input.scenarioId,
      summary: `Updated state for ${participant.snapshot.displayName}.`,
    });

    return participant;
  }

  private async assertScenarioExists(scenarioId: string): Promise<Scenario> {
    const scenario = await this.scenarioRepository.getScenarioById(scenarioId);

    if (!scenario) {
      throw new Error("Scenario not found.");
    }

    return scenario;
  }

  private async assertScenarioAllowsLiveMutation(scenarioId: string): Promise<void> {
    const scenario = await this.scenarioRepository.getScenarioById(scenarioId);

    if (!scenario) {
      throw new Error("Scenario not found.");
    }

    if (!isScenarioLiveInteractive(scenario.status)) {
      throw new Error("Scenario is not currently live.");
    }
  }
}
