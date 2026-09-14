import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { COMBAT_ROUND_STEPS } from "@glantri/domain";

import { CombatTracker } from "../../src/features/combat-history/components/CombatTracker";
import type {
  CombatTrackerCellView,
  CombatTrackerModel,
} from "../../src/features/combat-history/types";
import { AppHeader } from "../../src/lib/layout/AppHeader";

const label = "Treated guard critical-treatment-390px";
const cells = Object.fromEntries(
  COMBAT_ROUND_STEPS.map((step) => {
    const cellKey = `1:guard:${step}`;
    const hoverText = `${label} · Round 1 · ${step === "select_actions" ? "DE" : step}: inspect`;
    return [
      cellKey,
      {
        attention: "ordinary",
        cellKey,
        completed: false,
        current: step === "select_actions",
        executable: false,
        executionGroupIds: [],
        gmProxyAvailable: false,
        historical: false,
        hover: {
          actionLabel: "Declaration",
          gmActionRequired: false,
          text: hoverText,
          waiting: false,
        },
        hoverText,
        initiativeValue: false,
        inspectable: true,
        marker: "?",
        markerKind: "required",
        ownerParticipantIds: [],
        participantId: "guard",
        processIds: [],
        roundNumber: 1,
        selected: false,
        stageIds: [],
        status: "open",
        step,
        taskIds: [],
        taskKinds: [],
        waiting: false,
      } satisfies CombatTrackerCellView,
    ];
  }),
);
const model: CombatTrackerModel = {
  cells,
  currentTaskCellKey: "1:guard:select_actions",
  legend: [],
  rounds: [{ roundNumber: 1, currentStep: "select_actions" }],
  rows: [{ label, participantId: "guard", selected: false }],
  steps: COMBAT_ROUND_STEPS,
};

function Fixture() {
  const [inspected, setInspected] = useState("");
  return (
    <>
      <AppHeader />
      <main style={{ padding: "1.5rem", minWidth: 0 }}>
        <div style={{ height: 900 }}>Disposable Critical participant inspection fixture</div>
        <CombatTracker
          followCurrent
          model={model}
          onInspect={(cell) => setInspected(cell.hoverText)}
        />
        <output aria-label="Inspected participant step">{inspected}</output>
        <div style={{ height: 1000 }} />
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
