import {
  DEFAULT_CHARGEN_RULE_SET_PARAMETERS,
  type ChargenRuleSetParameters
} from "@glantri/domain";

export interface ChargenMethodPolicy {
  displayedRollCount: number;
  flexiblePointFactor: number;
  maxBuilds: number;
  maxExchanges: number;
  primaryPoolTotal: number;
  secondaryPoolTotal: number;
}

export const STANDARD_CHARGEN_METHOD_POLICY: ChargenMethodPolicy = {
  displayedRollCount: DEFAULT_CHARGEN_RULE_SET_PARAMETERS.statRollCount,
  flexiblePointFactor: DEFAULT_CHARGEN_RULE_SET_PARAMETERS.flexiblePointFactor,
  maxBuilds: 2,
  maxExchanges: DEFAULT_CHARGEN_RULE_SET_PARAMETERS.exchangeCount,
  primaryPoolTotal: DEFAULT_CHARGEN_RULE_SET_PARAMETERS.ordinarySkillPoints,
  secondaryPoolTotal: 0
};

export function createChargenMethodPolicy(
  ruleSet?: Partial<ChargenRuleSetParameters>
): ChargenMethodPolicy {
  return {
    ...STANDARD_CHARGEN_METHOD_POLICY,
    displayedRollCount:
      ruleSet?.statRollCount ?? STANDARD_CHARGEN_METHOD_POLICY.displayedRollCount,
    flexiblePointFactor:
      ruleSet?.flexiblePointFactor ?? STANDARD_CHARGEN_METHOD_POLICY.flexiblePointFactor,
    maxExchanges: ruleSet?.exchangeCount ?? STANDARD_CHARGEN_METHOD_POLICY.maxExchanges,
    primaryPoolTotal:
      ruleSet?.ordinarySkillPoints ?? STANDARD_CHARGEN_METHOD_POLICY.primaryPoolTotal
  };
}
