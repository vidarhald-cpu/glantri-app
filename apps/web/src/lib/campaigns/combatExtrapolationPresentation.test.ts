import { describe, expect, it } from "vitest";

import {
  COMBAT_EXTRAPOLATION_INLINE_MARKER,
  COMBAT_EXTRAPOLATION_MARKER_LABEL,
  buildCombatExtrapolationMarker,
  formatCombatExtrapolationAxes,
} from "@/lib/campaigns/combatExtrapolationPresentation";
import { resolveWorkbookPercentageAdjustment } from "@glantri/rules-engine";

describe("#940 Tier A the extrapolation marker is drawn only for an extrapolated figure", () => {
  it("draws nothing for a figure the lookup read from an authored cell", () => {
    expect(
      buildCombatExtrapolationMarker({ extrapolated: false, extrapolatedAxes: [] }),
    ).toBeUndefined();
  });

  it("names each edge in plain words rather than the rules-engine axis key", () => {
    expect(formatCombatExtrapolationAxes(["base"])).toBe("above the table's highest base");
    expect(formatCombatExtrapolationAxes(["base_below_zero"])).toBe("below the table's first row");
    expect(formatCombatExtrapolationAxes(["modifier"])).toBe("beyond the table's largest modifier");
    expect(formatCombatExtrapolationAxes(["base", "modifier"])).toBe(
      "above the table's highest base and beyond the table's largest modifier",
    );
  });

  it("renders no raw axis key in any marker a reader can see", () => {
    for (const axes of [
      ["base"],
      ["base_below_zero"],
      ["modifier"],
      ["base", "modifier"],
      ["base_below_zero", "modifier"],
    ] as const) {
      const marker = buildCombatExtrapolationMarker({ extrapolated: true, extrapolatedAxes: axes });

      expect(marker).toBeDefined();
      expect(marker!.detail).not.toMatch(/base_below_zero|extrapolatedAxes/);
      expect(`${marker!.label} ${marker!.detail}`).not.toContain("_");
    }
  });

  it("still marks a flagged figure that arrives with no axes, because the flag is the claim", () => {
    const marker = buildCombatExtrapolationMarker({ extrapolated: true, extrapolatedAxes: [] });

    expect(marker?.label).toBe(COMBAT_EXTRAPOLATION_MARKER_LABEL);
    expect(marker?.detail).toBe("Resolved past the table. Review this figure.");
  });

  it("asks for the review the flag exists to prompt", () => {
    expect(
      buildCombatExtrapolationMarker({ extrapolated: true, extrapolatedAxes: ["base"] })?.detail,
    ).toBe("Resolved past the table, above the table's highest base. Review this figure.");
  });
});

describe("#940 Tier A the marker follows the lookup across each axis boundary", () => {
  function markerFor(base: number, rawModifier: number) {
    const adjustment = resolveWorkbookPercentageAdjustment(base, Math.abs(rawModifier));

    expect(adjustment).not.toBeNull();

    return buildCombatExtrapolationMarker({
      extrapolated: adjustment!.extrapolated,
      extrapolatedAxes: adjustment!.extrapolatedAxes,
    });
  }

  it("is absent at base 49 and present at base 50, the authored base edge", () => {
    expect(markerFor(49, 4)).toBeUndefined();
    expect(markerFor(50, 4)?.detail).toContain("above the table's highest base");
  });

  it("is absent at modifier 15 and present at modifier 16, the authored modifier edge", () => {
    expect(markerFor(20, 15)).toBeUndefined();
    expect(markerFor(20, 16)?.detail).toContain("beyond the table's largest modifier");
  });

  it("is present below the grid's first row, the edge a damaged character reaches", () => {
    expect(markerFor(-3, -4)?.detail).toContain("below the table's first row");
  });

  /**
   * The zero row is the one figure that departs from the authored cell and is deliberately not
   * marked. The Product Owner ruled on 2026-11-04, in comment 20880 on issue #922, that the
   * override supersedes the authored row and is an explicit rule decision, so `extrapolated: false`
   * is correct there and no marker belongs on it. Two source comments in the rules engine and its
   * test still describe that question as open; they are stale and are tracked separately.
   */
  it("leaves the base-zero override unmarked at every in-grid column", () => {
    for (let step = 1; step <= 15; step += 1) {
      expect(markerFor(0, step), `base 0 step ${step}`).toBeUndefined();
    }

    expect(markerFor(0, 16)?.detail).toContain("beyond the table's largest modifier");
  });
});

describe("#940 Tier A the inline marker suits a figure inside a formatted sentence", () => {
  it("reads as an aside beside the figure it qualifies", () => {
    expect(COMBAT_EXTRAPOLATION_INLINE_MARKER).toBe("(extrapolated)");
    expect(`OB 79 ${COMBAT_EXTRAPOLATION_INLINE_MARKER} - DB 12`).toBe(
      "OB 79 (extrapolated) - DB 12",
    );
  });
});
