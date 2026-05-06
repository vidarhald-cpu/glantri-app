import type { EncounterSession } from "@glantri/domain";

import {
  createPrismaEncounterRepository,
  type EncounterRepository,
} from "../repositories/encounterRepository";

export class EncounterService {
  constructor(private readonly repository: EncounterRepository = createPrismaEncounterRepository()) {}

  async createEncounter(input: {
    createdByUserId?: string | null;
    session: EncounterSession;
  }): Promise<EncounterSession> {
    return this.repository.createEncounter(input.session, input.createdByUserId);
  }

  async getEncounterById(encounterId: string): Promise<EncounterSession | null> {
    return this.repository.getEncounterById(encounterId);
  }

  async listEncountersByScenario(scenarioId: string): Promise<EncounterSession[]> {
    return this.repository.listEncountersByScenario(scenarioId);
  }

  async updateEncounter(session: EncounterSession): Promise<EncounterSession> {
    return this.repository.updateEncounter(session);
  }
}
