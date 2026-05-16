import type { ChargenRuleSet } from "@glantri/domain";

export interface ChargenRuleSetStoreResponse {
  activeRuleSet: ChargenRuleSet;
  ruleSets: ChargenRuleSet[];
}
