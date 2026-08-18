// @vitest-environment happy-dom

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CombatLogEventPresentation } from "@glantri/domain";

import { CombatLog } from "./CombatLog";

function logEvent(
  id: string,
  sequence: number,
  summary: string,
  presentationTargetId?: string,
): CombatLogEventPresentation {
  return {
    category: sequence === 0 ? "round" : "attack",
    encounterId: "encounter-1",
    id,
    phase: sequence === 0 ? "declaration" : "phase1",
    presentationTargetId,
    presentationTargetKind: presentationTargetId ? "attack" : undefined,
    roundNumber: 1,
    sequence,
    sourceEventIds: sequence === 0 ? [] : [`source-${sequence}`],
    sourceRevision: "revision-7",
    state: "final",
    summary,
    summaryFacts:
      sequence === 0
        ? { kind: "round_opened", roundNumber: 1 }
        : { kind: "attack_resolved", outcome: "hit" },
  };
}

describe("CombatLog", () => {
  it("renders the empty state", () => {
    render(<CombatLog events={[]} onSelect={vi.fn()} />);

    expect(screen.getByRole("region", { name: "Combat Log" })).toBeTruthy();
    expect(screen.getByText("No combat events have been recorded yet.")).toBeTruthy();
  });

  it("renders canonical chronological events with round and phase labels", () => {
    const events = [
      logEvent("round-open", 0, "Round 1 began."),
      logEvent("attack-hit", 1, "The Gladiator attacked Scyrian Cavalry. The attack hit."),
    ];

    render(<CombatLog events={events} onSelect={vi.fn()} />);

    const rows = screen.getAllByRole("button");
    expect(rows.map((row) => row.textContent)).toEqual([
      "Round 1 · DeclarationRound 1 began.",
      "Round 1 · Phase 1The Gladiator attacked Scyrian Cavalry. The attack hit.",
    ]);
    expect(screen.getByRole("list", { name: "Recorded combat events" }).style.overflowY).toBe(
      "auto",
    );
  });

  it("selects the canonical event and its immutable presentation target", () => {
    const onSelect = vi.fn();
    const event = logEvent(
      "attack-hit",
      1,
      "The attack hit.",
      "combat-presentation:attack:attack-1",
    );
    render(<CombatLog events={[event]} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button"));
    expect(onSelect).toHaveBeenLastCalledWith({
      combatLogEventId: "attack-hit",
      presentationTargetId: "combat-presentation:attack:attack-1",
    });
    expect(screen.getByRole("button").dataset.presentationTargetId).toBe(
      "combat-presentation:attack:attack-1",
    );
  });

  it("does not infer a replacement selection when its controlled event is absent", () => {
    const onSelect = vi.fn();
    const remaining = logEvent("remaining", 0, "Round 1 began.");

    render(
      <CombatLog
        events={[remaining]}
        onSelect={onSelect}
        selectedCombatLogEventId="undone-event"
      />,
    );

    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByRole("button").getAttribute("aria-pressed")).toBe("false");
  });

  it("selects a targetless narrative event without inventing outcome identity", () => {
    const onSelect = vi.fn();
    render(
      <CombatLog events={[logEvent("round-open", 0, "Round 1 began.")]} onSelect={onSelect} />,
    );

    fireEvent.click(screen.getByRole("button"));

    expect(onSelect).toHaveBeenCalledWith({
      combatLogEventId: "round-open",
      presentationTargetId: undefined,
    });
  });

  it("keeps the newest live event visible while preserving result selection", () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const first = logEvent("first", 1, "First event.", "target:first");
    const newest = logEvent("newest", 2, "Newest event.", "target:newest");

    try {
      const { rerender } = render(
        <CombatLog
          autoFollow
          events={[first]}
          onSelect={vi.fn()}
          selectedCombatLogEventId={first.id}
          selectedPresentationTargetId={first.presentationTargetId}
        />,
      );
      expect(scrollIntoView).toHaveBeenCalledOnce();

      scrollIntoView.mockClear();
      rerender(
        <CombatLog
          autoFollow
          events={[first, newest]}
          onSelect={vi.fn()}
          selectedCombatLogEventId={first.id}
          selectedPresentationTargetId={first.presentationTargetId}
        />,
      );

      expect(scrollIntoView).toHaveBeenCalledOnce();
      expect(
        (scrollIntoView.mock.contexts[0] as HTMLButtonElement).dataset.combatLogEventId,
      ).toBe("newest");
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      });
    }
  });

  it("does not steal the log view after manual scrolling or during historical inspection", () => {
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoView,
    });
    const first = logEvent("first", 1, "First event.", "target:first");
    const newest = logEvent("newest", 2, "Newest event.", "target:newest");

    try {
      const { rerender } = render(
        <CombatLog
          autoFollow
          events={[first]}
          onSelect={vi.fn()}
          selectedCombatLogEventId={first.id}
          selectedPresentationTargetId={first.presentationTargetId}
        />,
      );
      const list = screen.getByRole("list", { name: "Recorded combat events" });
      Object.defineProperties(list, {
        clientHeight: { configurable: true, value: 100 },
        scrollHeight: { configurable: true, value: 600 },
        scrollTop: { configurable: true, value: 100, writable: true },
      });
      scrollIntoView.mockClear();
      fireEvent.scroll(list);

      rerender(
        <CombatLog
          autoFollow
          events={[first, newest]}
          onSelect={vi.fn()}
          selectedCombatLogEventId={first.id}
          selectedPresentationTargetId={first.presentationTargetId}
        />,
      );
      expect(scrollIntoView).not.toHaveBeenCalled();

      rerender(
        <CombatLog
          autoFollow={false}
          events={[first, newest]}
          onSelect={vi.fn()}
          selectedCombatLogEventId={first.id}
          selectedPresentationTargetId={first.presentationTargetId}
        />,
      );
      expect(scrollIntoView).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: originalScrollIntoView,
      });
    }
  });
});
