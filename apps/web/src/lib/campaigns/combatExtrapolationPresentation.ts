import { type CSSProperties } from "react";

import { type WorkbookPercentageAdjustmentAxis } from "@glantri/rules-engine";

/**
 * How an extrapolated combat figure is marked on screen (#940 Tier A).
 *
 * The Product Owner ruled on 2026-11-05 that "an extrapolated value must be visibly identified as
 * extrapolated wherever that value is displayed". The flag already existed on the data and no
 * screen drew it, which is the outcome the original ruling on lookup tables was written to avoid:
 * an open-ended lookup with no visible flag turns a loud, wrong refusal into a quiet extrapolation
 * nobody is prompted to check.
 *
 * The marker lives here, once, because its two initiative consumers are different files — the GM
 * round-manager panel and the player combat page — and the enumeration of display sites named that
 * sibling pair as exactly the shape this kind of work forgets. One helper means the two readings
 * cannot drift, and the plain-word axis names are written once rather than restated per surface.
 *
 * **Which edge is named, and in plain words.** The axis keys are rules-engine vocabulary, so they
 * are translated here rather than rendered raw: §4.2 of the presentation principles keeps
 * implementation vocabulary out of ordinary UI. The word *extrapolated* itself is the Product
 * Owner's own term from the ruling and is the thing the GM is being asked to review, so it stays.
 *
 * **The marker is text, not colour.** §4.14 requires important state to be distinguishable without
 * relying on colour alone, and the detail is rendered as visible text rather than a tooltip
 * because the same section forbids hover-only facts.
 *
 * **What is deliberately not marked.** A base of zero with a non-zero raw modifier departs from the
 * authored cell at every in-grid column and reports `extrapolated: false`. That is correct: the
 * Product Owner ruled on 2026-11-04, in comment 20880 on issue #922, that the zero override
 * *supersedes* the authored row and is recorded as an explicit rule decision. It is a rule, not an
 * unreviewed departure from the grid, so no marker belongs on it. The coverage this module claims
 * is therefore worded against the governing rule, not against the authored grid.
 *
 * This module decides appearance only. It never decides whether a figure is extrapolated: that is
 * the rules-engine lookup's answer, carried on the calculation, and a caller passes it through
 * unchanged. In particular a caller must not infer "in grid" from an empty axis list on a committed
 * attack, where the collected flag is known to be incomplete on the attacker's own side.
 */
export const COMBAT_EXTRAPOLATION_MARKER_LABEL = "Extrapolated";

/**
 * The marker as it reads inside a formatted sentence rather than beside a figure in a panel, for
 * the committed attack result's main line, which is assembled as one string.
 */
export const COMBAT_EXTRAPOLATION_INLINE_MARKER = "(extrapolated)";

/**
 * The badge beside the figure. Bordered and worded rather than tinted, so the state survives a
 * reader who cannot use the colour, and `nowrap` keeps the single word whole — the badge is inline
 * in a prose line, so a narrow card wraps it onto its own line instead of clipping it.
 */
export const COMBAT_EXTRAPOLATION_MARKER_BADGE_STYLE: CSSProperties = {
  border: "1px solid #8a6d3b",
  borderRadius: "0.25rem",
  color: "#8a6d3b",
  fontSize: "0.72rem",
  fontWeight: 600,
  marginLeft: "0.35rem",
  padding: "0 0.3rem",
  whiteSpace: "nowrap",
};

/** The sentence under the figure. Visible text, because a hover-only fact is not a marker. */
export const COMBAT_EXTRAPOLATION_MARKER_DETAIL_STYLE: CSSProperties = {
  color: "#8a6d3b",
  fontSize: "0.78rem",
};

const COMBAT_EXTRAPOLATION_AXIS_PHRASES: Record<WorkbookPercentageAdjustmentAxis, string> = {
  base: "above the table's highest base",
  base_below_zero: "below the table's first row",
  modifier: "beyond the table's largest modifier",
};

/**
 * The edges this figure was resolved outside, in plain words, or `undefined` when the list is
 * empty. Order follows the caller's list, which the lookup builds base-edge first.
 */
export function formatCombatExtrapolationAxes(
  axes: readonly WorkbookPercentageAdjustmentAxis[],
): string | undefined {
  const phrases = axes.map((axis) => COMBAT_EXTRAPOLATION_AXIS_PHRASES[axis]).filter(Boolean);

  if (phrases.length === 0) {
    return undefined;
  }

  return phrases.join(" and ");
}

export interface CombatExtrapolationMarker {
  /** The sentence naming the edge and asking for the review the flag exists to prompt. */
  detail: string;
  /** The short badge shown beside the figure itself. */
  label: string;
}

/**
 * The marker for one figure, or `undefined` when the figure is not extrapolated and nothing should
 * be drawn. A figure flagged with no axes still gets the marker, because the flag is the claim and
 * the axis list is only the explanation — swallowing the marker for want of a reason would hide the
 * very thing the ruling requires to be visible.
 */
export function buildCombatExtrapolationMarker(input: {
  extrapolated: boolean;
  extrapolatedAxes: readonly WorkbookPercentageAdjustmentAxis[];
}): CombatExtrapolationMarker | undefined {
  if (!input.extrapolated) {
    return undefined;
  }

  const edges = formatCombatExtrapolationAxes(input.extrapolatedAxes);

  return {
    detail: edges
      ? `Resolved past the table, ${edges}. Review this figure.`
      : "Resolved past the table. Review this figure.",
    label: COMBAT_EXTRAPOLATION_MARKER_LABEL,
  };
}
