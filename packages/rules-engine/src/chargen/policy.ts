export interface ChargenMethodPolicy {
  displayedRollCount: number;
  maxBuilds: number;
  maxExchanges: number;
  primaryPoolTotal: number;
  secondaryPoolTotal: number;
}

export const STANDARD_CHARGEN_METHOD_POLICY: ChargenMethodPolicy = {
  displayedRollCount: 20,
  maxBuilds: 2,
  maxExchanges: 2,
  primaryPoolTotal: 60,
  secondaryPoolTotal: 0
};
