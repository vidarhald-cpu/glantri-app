import type {
  ActiveCombatStateView,
  ArchivedCombatRoundsView,
  CombatHistorySourceView,
  EncounterAccessMetadataView,
  EncounterMetadataView,
  FullEncounterReadView,
  ScenarioEncounterManagementProjection,
} from "@glantri/domain";

import {
  createPrismaCombatStateReadRepository,
  type CombatStateReadRepository,
} from "../repositories/combatStateReadRepository";

/**
 * Read-only combat persistence boundary.
 *
 * Split-v1 encounters read metadata, active state, and archives from their
 * physical stores. Legacy encounters retain the validated sessionJson adapter.
 * Callers remain insulated from both persistence shapes and request only the
 * canonical view they consume.
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

  listScenarioEncounterManagementProjections(
    scenarioId: string,
  ): Promise<ScenarioEncounterManagementProjection[]> {
    return this.repository.listScenarioEncounterManagementProjections(scenarioId);
  }
}
