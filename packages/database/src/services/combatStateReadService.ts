import type {
  ActiveCombatStateView,
  ArchivedCombatRoundsView,
  CombatHistorySourceView,
  EncounterAccessMetadataView,
  EncounterMetadataView,
  FullEncounterReadView,
} from "@glantri/domain";

import {
  createPrismaCombatStateReadRepository,
  type CombatStateReadRepository,
} from "../repositories/combatStateReadRepository";

/**
 * Read-only combat persistence boundary.
 *
 * The current adapter still reads the single Encounter.sessionJson document
 * for state/history views. Callers are insulated from that storage shape and
 * request only the canonical view they consume.
 */
export class CombatStateReadService {
  constructor(
    private readonly repository: CombatStateReadRepository = createPrismaCombatStateReadRepository(),
  ) {}

  getActiveCombatStateById(encounterId: string): Promise<ActiveCombatStateView | null> {
    return this.repository.getActiveCombatStateById(encounterId);
  }

  getArchivedCombatRoundsById(encounterId: string): Promise<ArchivedCombatRoundsView | null> {
    return this.repository.getArchivedCombatRoundsById(encounterId);
  }

  getCombatHistorySourceById(encounterId: string): Promise<CombatHistorySourceView | null> {
    return this.repository.getCombatHistorySourceById(encounterId);
  }

  getEncounterMetadataById(encounterId: string): Promise<EncounterMetadataView | null> {
    return this.repository.getEncounterMetadataById(encounterId);
  }

  getFullEncounterById(encounterId: string): Promise<FullEncounterReadView | null> {
    return this.repository.getFullEncounterById(encounterId);
  }

  listEncounterAccessMetadataByScenario(
    scenarioId: string,
  ): Promise<EncounterAccessMetadataView[]> {
    return this.repository.listEncounterAccessMetadataByScenario(scenarioId);
  }
}
