import { describe, expect, it } from "vitest";

import { formatOpenEndedD20RollBreakdown, rollOpenEndedD20 } from "./openEndedD20";

function rngFromRolls(d20: number, d10s: number[] = []): () => number {
  const rolls = [(d20 - 0.5) / 20, ...d10s.map((roll) => (roll - 0.5) / 10)];

  return () => rolls.shift() ?? 0.5;
}

describe("open-ended d20", () => {
  it("returns one roll and total for non-open-ended rolls", () => {
    expect(rollOpenEndedD20(rngFromRolls(14))).toEqual({
      dieResult: 14,
      openEndedD10s: [],
      rollD20: 14,
    });
  });

  it("opens upward on an initial 20 and repeats on d10 10", () => {
    expect(rollOpenEndedD20(rngFromRolls(20, [10, 3]))).toEqual({
      dieResult: 33,
      openEndedD10s: [10, 3],
      rollD20: 20,
    });
  });

  it("opens downward on an initial 1 and can produce negative totals", () => {
    expect(rollOpenEndedD20(rngFromRolls(1, [10, 4]))).toEqual({
      dieResult: -13,
      openEndedD10s: [10, 4],
      rollD20: 1,
    });
  });

  it("formats the roll breakdown using the skill-roll convention", () => {
    expect(formatOpenEndedD20RollBreakdown({ dieResult: 18, openEndedD10s: [], rollD20: 18 })).toBe("18");
    expect(formatOpenEndedD20RollBreakdown({ dieResult: 27, openEndedD10s: [7], rollD20: 20 })).toBe("20 + 7");
    expect(formatOpenEndedD20RollBreakdown({ dieResult: -13, openEndedD10s: [10, 4], rollD20: 1 })).toBe("1 - 10 - 4");
  });
});
