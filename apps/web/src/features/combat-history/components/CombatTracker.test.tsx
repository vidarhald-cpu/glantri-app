// @vitest-environment happy-dom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CombatTrackerModel } from "../types";
import { CombatTracker } from "./CombatTracker";

const model: CombatTrackerModel = {
  cells: {
    "1:participant-a:select_actions": {
      attention: "ordinary",
      cellKey: "1:participant-a:select_actions",
      completed: true,
      current: true,
      executable: true,
      executionGroupIds: ["group-1"],
      gmProxyAvailable: true,
      historical: false,
      hover: {
        actionLabel: "Declaration",
        actorLabel: "Aldren",
        gmActionRequired: false,
        requiredActorLabel: "Aldren",
        text: "Declaration submitted for Aldren.",
        waiting: false,
      },
      hoverText: "Aldren · Round 1 · S: declaration submitted.",
      initiativeValue: false,
      inspectable: true,
      marker: "✓",
      markerKind: "complete",
      participantId: "participant-a",
      ownerParticipantIds: ["participant-a"],
      processIds: ["process-1"],
      roundNumber: 1,
      selected: true,
      status: "completed",
      stageIds: ["stage-1"],
      step: "select_actions",
      taskIds: ["task-1"],
      taskKinds: ["submit_declaration"],
      waiting: false,
    },
  },
  currentTaskCellKey: "1:participant-a:select_actions",
  legend: [{ kind: "complete", label: "done", marker: "✓", title: "Completed." }],
  rounds: [{ currentStep: "select_actions", roundNumber: 1 }],
  rows: [{ label: "Aldren", participantId: "participant-a", selected: true }],
  selectedCellKey: "1:participant-a:select_actions",
  steps: ["select_actions"],
};

describe("CombatTracker", () => {
  it("renders the model and delegates inspection", () => {
    const onInspect = vi.fn();
    render(<CombatTracker model={model} onInspect={onInspect} />);

    expect(screen.getByText("Round 1")).toBeTruthy();
    expect(screen.getByText("Aldren")).toBeTruthy();
    expect(screen.getByText("done")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: model.cells["1:participant-a:select_actions"].hoverText }),
    );
    expect(onInspect).toHaveBeenCalledWith(model.cells["1:participant-a:select_actions"]);
  });

  it("delegates keyboard navigation to its caller", () => {
    const onKeyDown = vi.fn();
    render(<CombatTracker model={model} onInspect={vi.fn()} onKeyDown={onKeyDown} />);

    fireEvent.keyDown(screen.getByLabelText("Combat round timeline grid"), { key: "ArrowRight" });
    expect(onKeyDown).toHaveBeenCalledOnce();
  });
});
