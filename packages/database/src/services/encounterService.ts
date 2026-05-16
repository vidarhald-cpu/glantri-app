import type { EncounterSession, Scenario, ScenarioParticipant, ScenarioParticipantState } from "@glantri/domain";

import {
  createPrismaEncounterRepository,
  type EncounterRepository,
} from "../repositories/encounterRepository";
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
    return this.encounterRepository.createEncounter(input);
  }

  async getEncounterById(encounterId: string): Promise<EncounterSession | null> {
    return this.encounterRepository.getEncounterById(encounterId);
  }

  async listEncountersByScenario(scenarioId: string): Promise<EncounterSession[]> {
    return this.encounterRepository.listEncountersByScenario(scenarioId);
  }

  async updateEncounter(input: {
    campaignId?: string | null;
    encounterId: string;
    scenarioId?: string | null;
    session: EncounterSession;
  }): Promise<EncounterSession> {
    return this.encounterRepository.updateEncounter(input);
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
    const liveState = startScenario(existingScenario.liveState ?? createScenarioLiveState());
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

  async setScenarioPhase(input: {
    phase: 1 | 2;
    scenarioId: string;
  }): Promise<Scenario> {
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
    const participant = await this.scenarioRepository.updateScenarioParticipantState(
      input.participantId,
      input.state,
    );
    const scenario = await this.scenarioRepository.getScenarioById(input.scenarioId);

    await this.scenarioRepository.createScenarioEventLog({
      eventType: "participant_state_updated",
      participantId: input.participantId,
      payload: input.state,
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
}
