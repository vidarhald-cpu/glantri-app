import React from "react";

import {
  COMBAT_EXTRAPOLATION_MARKER_BADGE_STYLE,
  COMBAT_EXTRAPOLATION_MARKER_DETAIL_STYLE,
} from "@/lib/campaigns/combatExtrapolationPresentation";
import {
  buildCombatCalculationPresentationRows,
  type CombatCalculationPresentation,
  type CombatCalculationPresentationRow,
} from "../view-models/combatCalculationPresentation";

function CombatCalculationRow({ row }: { row: CombatCalculationPresentationRow }) {
  if (!row.marker) return <div>{row.text}</div>;
  return (
    <div data-testid="combat-calculation-extrapolated-row">
      {row.text}
      <span
        data-testid="combat-calculation-extrapolation-marker"
        style={COMBAT_EXTRAPOLATION_MARKER_BADGE_STYLE}
      >
        {row.marker.label}
      </span>
      <div
        data-testid="combat-calculation-extrapolation-detail"
        style={COMBAT_EXTRAPOLATION_MARKER_DETAIL_STYLE}
      >
        {row.marker.detail}
      </div>
    </div>
  );
}

export function CombatCalculationPanel(input: {
  expanded?: boolean;
  onToggle?: () => void;
  presentation: CombatCalculationPresentation;
}) {
  const rows = buildCombatCalculationPresentationRows(input.presentation);
  if (!rows.length) return null;
  if (input.expanded !== undefined && input.onToggle) {
    return (
      <div
        style={{
          background: "#f6f5ef",
          borderRadius: 6,
          color: "#5e5a50",
          display: "grid",
          fontSize: "0.84rem",
          gap: "0.12rem",
          padding: "0.35rem 0.45rem",
        }}
      >
        <button
          aria-controls={`${input.presentation.calculationId}:calculation`}
          aria-expanded={input.expanded}
          onClick={input.onToggle}
          style={{
            background: "transparent",
            border: 0,
            color: "inherit",
            cursor: "pointer",
            font: "inherit",
            fontWeight: 700,
            justifySelf: "start",
            padding: 0,
          }}
          type="button"
        >
          {input.presentation.label} calculation
        </button>
        {input.expanded ? (
          <div
            id={`${input.presentation.calculationId}:calculation`}
            style={{ display: "grid", gap: "0.12rem" }}
          >
            {rows.map((row) => (
              <CombatCalculationRow key={row.key} row={row} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <details
      style={{
        background: "#f6f5ef",
        borderRadius: 6,
        color: "#5e5a50",
        fontSize: "0.84rem",
        padding: "0.35rem 0.45rem",
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 700 }}>
        {input.presentation.label} calculation
      </summary>
      <div style={{ display: "grid", gap: "0.12rem", paddingTop: "0.25rem" }}>
        {rows.map((row) => (
          <CombatCalculationRow key={row.key} row={row} />
        ))}
      </div>
    </details>
  );
}
