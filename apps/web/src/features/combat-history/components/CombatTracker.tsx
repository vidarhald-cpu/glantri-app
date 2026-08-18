import React, { useEffect, useRef } from "react";
import { COMBAT_ROUND_STEP_ABBREVIATIONS, COMBAT_ROUND_STEP_LABELS } from "@glantri/domain";

import type { CombatTrackerCellView, CombatTrackerModel } from "../types";
import { scrollCombatTrackerCellIntoView } from "../view-models/combatTrackerScroll";

const stepCellStyle = {
  height: "2.35rem",
  minWidth: "3rem",
  padding: "0.2rem",
  textAlign: "center" as const,
};
const stickyParticipantCellStyle = {
  background: "#fbfaf7",
  boxShadow: "1px 0 0 #e3e1dc",
  left: 0,
  minWidth: "13rem",
  position: "sticky" as const,
  zIndex: 2,
};
const roundBoundaryStartBorder = "2px solid #c9bea4";

/** Inspection-only tracker. It consumes a projected presentation model; GM uses
 * the full model today and a future Player tracker will use a player-safe model. */
export function CombatTracker(input: {
  followCurrent?: boolean;
  model: CombatTrackerModel;
  onInspect: (cell: CombatTrackerCellView) => void;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  positionCurrentRequest?: number;
  registerCell?: (cellKey: string, node: HTMLButtonElement | null, currentTask: boolean) => void;
  tableRef?: React.Ref<HTMLDivElement>;
}) {
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const stepHeaderRefs = useRef(new Map<string, HTMLTableCellElement>());
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentRound = input.model.rounds.find((round) => round.currentStep !== undefined);
  const currentStepHeaderKey = currentRound?.currentStep
    ? `${currentRound.roundNumber}:${currentRound.currentStep}`
    : undefined;

  useEffect(() => {
    const cellKey = input.model.operationalCursorCellKey ?? input.model.currentTaskCellKey;
    if (!input.followCurrent || (!cellKey && !currentStepHeaderKey)) {
      return;
    }

    scrollCombatTrackerCellIntoView({
      behavior: "auto",
      cell:
        (cellKey ? cellRefs.current.get(cellKey) : undefined) ??
        (currentStepHeaderKey ? stepHeaderRefs.current.get(currentStepHeaderKey) : undefined),
      container: containerRef.current,
      mode: "center",
      padding: 96,
    });
  }, [
    currentStepHeaderKey,
    input.followCurrent,
    input.model.currentTaskCellKey,
    input.model.operationalCursorCellKey,
    input.positionCurrentRequest,
  ]);

  function assignTableRef(node: HTMLDivElement | null) {
    containerRef.current = node;
    if (typeof input.tableRef === "function") {
      input.tableRef(node);
    } else if (input.tableRef) {
      (input.tableRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }

  return (
    <>
      <details style={{ color: "#5e5a50", fontSize: "0.84rem" }}>
        <summary style={{ cursor: "pointer", fontWeight: 700 }}>Tracker legend</summary>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.35rem 0.75rem",
            paddingTop: "0.3rem",
          }}
        >
          {input.model.legend.map((meaning) => (
            <span key={meaning.kind} title={meaning.title}>
              <strong style={{ color: "#2f5d62" }}>{meaning.marker}</strong> {meaning.label}
            </span>
          ))}
        </div>
      </details>
      <div
        aria-label="Combat round timeline grid"
        onKeyDown={input.onKeyDown}
        ref={assignTableRef}
        style={{ border: "1px solid #e3e1dc", borderRadius: 10, overflowX: "auto" }}
        tabIndex={0}
      >
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            minWidth: 620,
            width: "max-content",
          }}
        >
          <thead>
            <tr>
              <th
                rowSpan={2}
                style={{
                  ...stickyParticipantCellStyle,
                  padding: "0.45rem",
                  textAlign: "left",
                  top: 0,
                }}
              >
                Participant
              </th>
              {input.model.rounds.map((round, roundIndex) => (
                <th
                  className={roundIndex > 0 ? "round-boundary-start" : undefined}
                  colSpan={input.model.steps.length}
                  key={round.roundNumber}
                  style={{
                    background: "#efe7d3",
                    borderBottom: "1px solid #d1c7aa",
                    borderLeft: roundIndex > 0 ? roundBoundaryStartBorder : "1px solid #e3e1dc",
                    padding: "0.35rem",
                    textAlign: "center",
                  }}
                >
                  Round {round.roundNumber}
                </th>
              ))}
            </tr>
            <tr>
              {input.model.rounds.flatMap((round, roundIndex) =>
                input.model.steps.map((step, stepIndex) => (
                  <th
                    className={
                      roundIndex > 0 && stepIndex === 0 ? "round-boundary-start" : undefined
                    }
                    key={`${round.roundNumber}-${step}`}
                    ref={(node) => {
                      const key = `${round.roundNumber}:${step}`;
                      if (node) stepHeaderRefs.current.set(key, node);
                      else stepHeaderRefs.current.delete(key);
                    }}
                    style={{
                      ...stepCellStyle,
                      background: round.currentStep === step ? "#f6f0dd" : "#fbfaf7",
                      borderBottom: "1px solid #e3e1dc",
                      borderLeft:
                        roundIndex > 0 && stepIndex === 0
                          ? roundBoundaryStartBorder
                          : "1px solid #e3e1dc",
                      boxShadow: round.currentStep === step ? "inset 0 -3px 0 #b7791f" : undefined,
                      fontWeight: round.currentStep === step ? 800 : 700,
                    }}
                    title={COMBAT_ROUND_STEP_LABELS[step]}
                  >
                    {COMBAT_ROUND_STEP_ABBREVIATIONS[step]}
                  </th>
                )),
              )}
            </tr>
          </thead>
          <tbody>
            {input.model.rows.map((row) => (
              <tr
                key={row.participantId}
                style={{ background: row.selected ? "#fff8e8" : undefined }}
              >
                <td
                  style={{
                    ...stickyParticipantCellStyle,
                    borderTop: "1px solid #e3e1dc",
                    padding: "0.45rem",
                  }}
                >
                  <div style={{ display: "grid", gap: "0.25rem" }}>
                    <strong>{row.label}</strong>
                  </div>
                </td>
                {input.model.rounds.flatMap((round, roundIndex) =>
                  input.model.steps.map((step, stepIndex) => {
                    const cellKey = `${round.roundNumber}:${row.participantId}:${step}`;
                    const cell = input.model.cells[cellKey];
                    if (!cell) return null;
                    return (
                      <td
                        className={
                          roundIndex > 0 && stepIndex === 0 ? "round-boundary-start" : undefined
                        }
                        key={cell.cellKey}
                        style={{
                          ...stepCellStyle,
                          background: cell.selected
                            ? "#efe7d3"
                            : cell.current
                              ? "#f6f0dd"
                              : undefined,
                          borderLeft:
                            roundIndex > 0 && stepIndex === 0
                              ? roundBoundaryStartBorder
                              : "1px solid #e3e1dc",
                          borderTop: "1px solid #e3e1dc",
                          boxShadow: cell.current ? "inset 0 0 0 2px #b7791f" : undefined,
                          outline: cell.selected ? "2px solid #2f5d62" : undefined,
                          outlineOffset: "-2px",
                        }}
                      >
                        <button
                          aria-label={cell.hoverText}
                          disabled={!cell.inspectable}
                          onClick={() => input.onInspect(cell)}
                          ref={(node) => {
                            if (node) {
                              cellRefs.current.set(cell.cellKey, node);
                            } else {
                              cellRefs.current.delete(cell.cellKey);
                            }
                            input.registerCell?.(
                              cell.cellKey,
                              node,
                              cell.cellKey === input.model.currentTaskCellKey,
                            );
                          }}
                          style={{
                            alignItems: "center",
                            background: "transparent",
                            border: "none",
                            color: "#2f5d62",
                            cursor: cell.inspectable ? "pointer" : "default",
                            display: "grid",
                            fontSize: "0.85rem",
                            fontWeight: cell.current ? 800 : 600,
                            justifyItems: "center",
                            lineHeight: 1.1,
                            minHeight: "1.8rem",
                            padding: 0,
                            width: "100%",
                          }}
                          title={cell.hoverText}
                          type="button"
                        >
                          <span
                            aria-hidden="true"
                            style={{
                              color: cell.initiativeValue ? "#1f7a4d" : undefined,
                              fontWeight: cell.initiativeValue ? 800 : undefined,
                            }}
                          >
                            {cell.marker}
                          </span>
                        </button>
                      </td>
                    );
                  }),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
