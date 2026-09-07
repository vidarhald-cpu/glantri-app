import {
  isScenarioLiveInteractive,
  refreshScenarioParticipantPersistentCombatModifiers,
  type EncounterSession,
  type EncounterSessionSummary,
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
import {
  advanceScenarioRound,
  createScenarioLiveState,
  setScenarioPhase,
  startScenario,
} from "@glantri/domain";

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
      | "participant_already_active"
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
  constructor(
    private readonly encounterRepository: EncounterRepository = createPrismaEncounterRepository(),
    private readonly scenarioRepository: ScenarioRepository = createPrismaScenarioRepository(),
  ) {}

  async createEncounter(input: {
    campaignId?: string | null;
    createdByUserId?: string | null;
    scenarioId: string;
    session: EncounterSession;
  }): Promise<EncounterSession> {
    await this.assertScenarioAllowsLiveMutation(input.scenarioId);
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
    if (input.scenarioId) {
      await this.assertScenarioAllowsLiveMutation(input.scenarioId);
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
    if (input.scenarioId) {
      await this.assertScenarioAllowsLiveMutation(input.scenarioId);
    }
    try {
      return await this.encounterRepository.updateCombatEncounter(input);
    } catch (error) {
      if (
        error instanceof CombatPersistenceError &&
        (error.code === "stale_revision" || error.code === "transaction_conflict")
      ) {
        throw new EncounterCombatWriteError(error.code, error.message, error);
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
