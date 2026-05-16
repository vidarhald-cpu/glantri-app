import {
  DEFAULT_CHARGEN_RULE_SET,
  chargenRuleSetParametersSchema,
  type ChargenRuleSet,
  type ChargenRuleSetParameters,
  type ChargenRuleSetStoreResponse
} from "@glantri/domain";

import {
  createPrismaChargenRuleSetRepository,
  type ChargenRuleSetRepository
} from "../repositories/chargenRuleSetRepository";

export type { ChargenRuleSetStoreResponse };

export class ChargenRuleSetService {
  constructor(
    private readonly repository: ChargenRuleSetRepository = createPrismaChargenRuleSetRepository()
  ) {}

  async activateRuleSet(id: string): Promise<ChargenRuleSetStoreResponse> {
    const store = await this.repository.activateRuleSet(id);
    return this.mapStore(store);
  }

  async createRuleSet(input: {
    name: string;
    parameters: ChargenRuleSetParameters;
  }): Promise<ChargenRuleSetStoreResponse> {
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

  async getStore(): Promise<ChargenRuleSetStoreResponse> {
    return this.mapStore(await this.repository.getStore());
  }

  private mapStore(store: {
    activeRuleSetId: string;
    ruleSets: ChargenRuleSet[];
  }): ChargenRuleSetStoreResponse {
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
