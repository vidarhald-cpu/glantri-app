import {
  DEFAULT_CHARGEN_RULE_SET,
  chargenRuleSetParametersSchema,
  type ChargenRuleSet,
  type ChargenRuleSetParameters
} from "@glantri/domain";

import {
  createPrismaChargenRuleSetRepository,
  type ChargenRuleSetRepository
} from "../repositories/chargenRuleSetRepository";

export interface ChargenRuleSetStoreView {
  activeRuleSet: ChargenRuleSet;
  ruleSets: ChargenRuleSet[];
}

export class ChargenRuleSetService {
  constructor(
    private readonly repository: ChargenRuleSetRepository = createPrismaChargenRuleSetRepository()
  ) {}

  async activateRuleSet(id: string): Promise<ChargenRuleSetStoreView> {
    const store = await this.repository.activateRuleSet(id);
    return this.mapStore(store);
  }

  async createRuleSet(input: {
    name: string;
    parameters: ChargenRuleSetParameters;
  }): Promise<ChargenRuleSetStoreView> {
    const name = input.name.trim();

    if (!name) {
      throw new Error("Rule set name is required.");
    }

    const parameters = chargenRuleSetParametersSchema.parse(input.parameters);
    const store = await this.repository.createRuleSet({
      name,
      parameters
    });

    return this.mapStore(store);
  }

  async getStore(): Promise<ChargenRuleSetStoreView> {
    return this.mapStore(await this.repository.getStore());
  }

  private mapStore(store: {
    activeRuleSetId: string;
    ruleSets: ChargenRuleSet[];
  }): ChargenRuleSetStoreView {
    const activeRuleSet =
      store.ruleSets.find((ruleSet) => ruleSet.id === store.activeRuleSetId) ??
      DEFAULT_CHARGEN_RULE_SET;

    return {
      activeRuleSet,
      ruleSets: store.ruleSets.map((ruleSet) => ({
        ...ruleSet,
        isActive: ruleSet.id === activeRuleSet.id
      }))
    };
  }
}
