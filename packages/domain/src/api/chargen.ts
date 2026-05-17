import type { ChargenRuleSet } from "../character/chargenRuleSet";

export interface ChargenRuleSetStoreResponse {
  activeRuleSet: ChargenRuleSet;
  ruleSets: ChargenRuleSet[];
}
