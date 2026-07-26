import { describe, expect, it, vi } from "vitest";

import type { CombatStateReadRepository } from "../repositories/combatStateReadRepository";
import { CombatStateReadService } from "./combatStateReadService";

describe("CombatStateReadService", () => {
  it("keeps callers on explicit read-view operations", async () => {
    const repository = {
      getActiveCombatStateById: vi.fn().mockResolvedValue(null),
      getArchivedCombatRoundsById: vi.fn().mockResolvedValue(null),
      getCombatHistorySourceById: vi.fn().mockResolvedValue(null),
      getEncounterMetadataById: vi.fn().mockResolvedValue(null),
      getFullEncounterById: vi.fn().mockResolvedValue(null),
      listEncounterAccessMetadataByScenario: vi.fn().mockResolvedValue([]),
    } satisfies CombatStateReadRepository;
    const service = new CombatStateReadService(repository);

    await service.getEncounterMetadataById("encounter-1");
    await service.getActiveCombatStateById("encounter-1");
    await service.getArchivedCombatRoundsById("encounter-1");
    await service.getCombatHistorySourceById("encounter-1");
    await service.getFullEncounterById("encounter-1");
    await service.listEncounterAccessMetadataByScenario("scenario-1");

    expect(repository.getEncounterMetadataById).toHaveBeenCalledWith("encounter-1");
    expect(repository.getActiveCombatStateById).toHaveBeenCalledWith("encounter-1");
    expect(repository.getArchivedCombatRoundsById).toHaveBeenCalledWith("encounter-1");
    expect(repository.getCombatHistorySourceById).toHaveBeenCalledWith("encounter-1");
    expect(repository.getFullEncounterById).toHaveBeenCalledWith("encounter-1");
    expect(repository.listEncounterAccessMetadataByScenario).toHaveBeenCalledWith("scenario-1");
  });
});
