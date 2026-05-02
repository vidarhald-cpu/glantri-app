import { describe, expect, it } from "vitest";

import type { ChargenRuleSet } from "@glantri/domain";

import { ChargenRuleSetService } from "./chargenRuleSetService";
import type { ChargenRuleSetRepository } from "../repositories/chargenRuleSetRepository";

function createRuleSet(overrides: Partial<ChargenRuleSet>): ChargenRuleSet {
  return {
    createdAt: "2026-05-02T00:00:00.000Z",
    exchangeCount: 2,
    flexiblePointFactor: 1,
    id: "standard",
    isActive: false,
    name: "Standard chargen",
    ordinarySkillPoints: 60,
    statRollCount: 20,
    updatedAt: "2026-05-02T00:00:00.000Z",
    ...overrides
  };
}

describe("ChargenRuleSetService", () => {
  it("activates exactly one historical rule set", async () => {
    let store = {
      activeRuleSetId: "standard",
      ruleSets: [
        createRuleSet({ id: "standard", isActive: true }),
        createRuleSet({ id: "experiment", name: "Experimental chargen" })
      ]
    };
    const repository: ChargenRuleSetRepository = {
      async activateRuleSet(id) {
        store = {
          ...store,
          activeRuleSetId: id
        };
        return store;
      },
      async createRuleSet() {
        return store;
      },
      async getStore() {
        return store;
      }
    };
    const service = new ChargenRuleSetService(repository);

    const updated = await service.activateRuleSet("experiment");

    expect(updated.activeRuleSet.id).toBe("experiment");
    expect(updated.ruleSets.filter((ruleSet) => ruleSet.isActive)).toHaveLength(1);
    expect(updated.ruleSets.find((ruleSet) => ruleSet.id === "standard")?.isActive).toBe(false);
  });
});
