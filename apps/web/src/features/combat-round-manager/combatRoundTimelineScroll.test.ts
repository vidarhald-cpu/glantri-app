import { describe, expect, it } from "vitest";

import { calculateCombatRoundTimelineScrollLeft } from "./combatRoundTimelineScroll";

describe("combat round timeline scroll math", () => {
  it("does not scroll when the cell is comfortably visible", () => {
    expect(
      calculateCombatRoundTimelineScrollLeft({
        cellLeft: 220,
        cellWidth: 80,
        containerLeft: 100,
        containerWidth: 500,
        padding: 72,
        scrollLeft: 200,
      }),
    ).toBe(200);
  });

  it("scrolls left when the cell is near the left edge", () => {
    expect(
      calculateCombatRoundTimelineScrollLeft({
        cellLeft: 110,
        cellWidth: 80,
        containerLeft: 100,
        containerWidth: 500,
        padding: 72,
        scrollLeft: 200,
      }),
    ).toBe(138);
  });

  it("scrolls right when the cell is near the right edge", () => {
    expect(
      calculateCombatRoundTimelineScrollLeft({
        cellLeft: 520,
        cellWidth: 80,
        containerLeft: 100,
        containerWidth: 500,
        padding: 72,
        scrollLeft: 200,
      }),
    ).toBe(272);
  });

  it("centers the selected cell for current-task navigation", () => {
    expect(
      calculateCombatRoundTimelineScrollLeft(
        {
          cellLeft: 520,
          cellWidth: 80,
          containerLeft: 100,
          containerWidth: 500,
          scrollLeft: 200,
        },
        "center",
      ),
    ).toBe(410);
  });

  it("clamps scroll targets to the available horizontal range", () => {
    expect(
      calculateCombatRoundTimelineScrollLeft(
        {
          cellLeft: 900,
          cellWidth: 80,
          containerLeft: 100,
          containerWidth: 500,
          scrollLeft: 800,
          scrollMax: 900,
        },
        "center",
      ),
    ).toBe(900);
  });
});
