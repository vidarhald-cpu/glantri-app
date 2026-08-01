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

  it("renders a new-round empty cell as disabled after a prior-round attack marker", () => {
    const onInspect = vi.fn();
    const { rerender } = render(<CombatTracker model={model} onInspect={onInspect} />);
    const nextRoundModel: CombatTrackerModel = {
      ...model,
      cells: {
        "2:participant-a:phase_1_actions": {
          ...model.cells["1:participant-a:select_actions"]!,
          cellKey: "2:participant-a:phase_1_actions",
          completed: false,
          current: false,
          executable: false,
          executionGroupIds: [],
          hoverText: "Aldren · Round 2 · A1: Not opened.",
          inspectable: false,
          marker: "·",
          markerKind: "not_reached",
          processIds: [],
          roundNumber: 2,
          selected: false,
          stageIds: [],
          status: "unopened",
          step: "phase_1_actions",
          taskIds: [],
          taskKinds: [],
        },
      },
      currentTaskCellKey: undefined,
      rounds: [{ currentStep: "select_actions", roundNumber: 2 }],
      selectedCellKey: undefined,
      steps: ["phase_1_actions"],
    };

    rerender(<CombatTracker model={nextRoundModel} onInspect={onInspect} />);

    const emptyCell = screen.getByRole("button", {
      name: "Aldren · Round 2 · A1: Not opened.",
    });
    expect((emptyCell as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("·")).toBeTruthy();
    fireEvent.click(emptyCell);
    expect(onInspect).not.toHaveBeenCalled();
  });

  it("positions the live current cell without resetting manual scroll on ordinary rerenders", () => {
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function mockRect(this: HTMLElement) {
        return {
          bottom: 40,
          height: 40,
          left: this.getAttribute("aria-label") === "Combat round timeline grid" ? 0 : 600,
          right: this.getAttribute("aria-label") === "Combat round timeline grid" ? 300 : 660,
          toJSON: () => ({}),
          top: 0,
          width: this.getAttribute("aria-label") === "Combat round timeline grid" ? 300 : 60,
          x: this.getAttribute("aria-label") === "Combat round timeline grid" ? 0 : 600,
          y: 0,
        };
      });
    const clientWidth = vi
      .spyOn(HTMLElement.prototype, "clientWidth", "get")
      .mockReturnValue(300);
    const scrollWidth = vi
      .spyOn(HTMLElement.prototype, "scrollWidth", "get")
      .mockReturnValue(900);

    try {
      const { rerender } = render(
        <CombatTracker followCurrent model={model} onInspect={vi.fn()} />,
      );
      expect(scrollTo).toHaveBeenCalledOnce();

      scrollTo.mockClear();
      rerender(
        <CombatTracker
          followCurrent
          model={{ ...model, selectedCellKey: undefined }}
          onInspect={vi.fn()}
        />,
      );
      expect(scrollTo).not.toHaveBeenCalled();

      const nextRoundCell = {
        ...model.cells["1:participant-a:select_actions"]!,
        cellKey: "2:participant-a:select_actions",
        hoverText: "Aldren · Round 2 · S: declaration submitted.",
        roundNumber: 2,
      };
      const nextRoundModel: CombatTrackerModel = {
        ...model,
        cells: { [nextRoundCell.cellKey]: nextRoundCell },
        currentTaskCellKey: nextRoundCell.cellKey,
        rounds: [{ currentStep: "select_actions", roundNumber: 2 }],
        selectedCellKey: nextRoundCell.cellKey,
      };
      rerender(<CombatTracker followCurrent model={nextRoundModel} onInspect={vi.fn()} />);
      expect(scrollTo).toHaveBeenCalledOnce();

      scrollTo.mockClear();
      rerender(
        <CombatTracker
          followCurrent
          model={nextRoundModel}
          onInspect={vi.fn()}
          positionCurrentRequest={1}
        />,
      );
      expect(scrollTo).toHaveBeenCalledOnce();
    } finally {
      rect.mockRestore();
      clientWidth.mockRestore();
      scrollWidth.mockRestore();
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });

  it("positions ownerless current work on the shared step header", () => {
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });
    const rect = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function mockRect(this: HTMLElement) {
        const container = this.getAttribute("aria-label") === "Combat round timeline grid";
        return {
          bottom: 40,
          height: 40,
          left: container ? 0 : 600,
          right: container ? 300 : 660,
          toJSON: () => ({}),
          top: 0,
          width: container ? 300 : 60,
          x: container ? 0 : 600,
          y: 0,
        };
      });
    const clientWidth = vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    const scrollWidth = vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockReturnValue(900);

    try {
      render(
        <CombatTracker
          followCurrent
          model={{ ...model, currentTaskCellKey: undefined }}
          onInspect={vi.fn()}
        />,
      );
      expect(scrollTo).toHaveBeenCalledOnce();
    } finally {
      rect.mockRestore();
      clientWidth.mockRestore();
      scrollWidth.mockRestore();
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });

  it("does not auto-position while the viewer is inspecting history", () => {
    const originalScrollTo = HTMLElement.prototype.scrollTo;
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: scrollTo,
    });

    try {
      render(<CombatTracker followCurrent={false} model={model} onInspect={vi.fn()} />);
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollTo", {
        configurable: true,
        value: originalScrollTo,
      });
    }
  });
});
