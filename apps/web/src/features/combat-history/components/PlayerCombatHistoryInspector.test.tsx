// @vitest-environment happy-dom

import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProjectedCombatHistoryEvent, ProjectedCombatHistorySnapshot } from "@glantri/domain";

import { createEmptyPlayerEncounterCombatContext } from "@/lib/campaigns/playerEncounter";

import { PlayerCombatHistoryInspector } from "./PlayerCombatHistoryInspector";

function snapshot(): ProjectedCombatHistorySnapshot {
  return {
    completeness: "complete",
    id: "snapshot-1",
    panels: {
      actionResult: {},
      actionSelector: {
        actionId: "attack_parry",
        actionLabel: "Single attack",
        additionalActionNotes: "Hold the bridge",
        movementId: "hold",
        movementIntent: { distancePreferences: [], mode: "hold_position" },
      },
      modifiers: {
        dbRaw: -2,
        generalFatigueRaw: 0,
        initiativeRaw: 0,
        obSkillRaw: 0,
        rows: [
          {
            bucketKey: "general",
            entries: [
              {
                durationRounds: 1,
                id: "modifier-1",
                notes: "single attack",
                scope: "until",
                sourceRule: "internal-rule-key",
                value: -2,
              },
              {
                durationRounds: 2,
                id: "modifier-2",
                notes: "second modifier",
                scope: "until",
                sourceRule: "another-internal-rule-key",
                value: 1,
              },
            ],
            label: "General/Fatigue",
            total: -2,
          },
        ],
      },
      phase1: {
        attackModeLabel: "Thrust",
        attackSummary: {
          attackMode: "C",
          dmb: "8",
          initiative: "3",
          maxCrits: "FS",
          ob: "10",
          weaponName: "Long sword",
        },
        defenseSummary: { db: "13", dm: "0", parry: "9", sourceName: "Sword / shield" },
        distanceLabel: "Distance: 3",
        phaseContext: {
          ...createEmptyPlayerEncounterCombatContext(),
          attackModeId: "mode-thrust",
        },
        targetOptions: [{ displayName: "Visible opponent", participantId: "visible" }],
      },
      phase2: {
        defenseSummary: { db: "18", dm: "0", parry: "13", sourceName: "Sword / shield" },
        phaseContext: createEmptyPlayerEncounterCombatContext(),
      },
    },
    participant: { displayName: "Aria", participantId: "aria" },
    roundNumber: 1,
    step: "phase_1_actions",
  };
}

describe("PlayerCombatHistoryInspector", () => {
  it("renders every ordered committed defense event instead of current snapshot equipment", () => {
    const safeEvent = (
      sequence: number,
      label: string,
      included: boolean,
    ): ProjectedCombatHistoryEvent => ({
      completeness: "complete",
      facts: {
        defenseReview: {
          attackDirection: sequence === 5 ? "left" : "rear",
          aware: sequence === 5,
          eventSequence: sequence,
          ordinaryDodgeAvailable: sequence === 5,
          phase: "phase1",
          roundNumber: 1,
          sources: [{ included, kind: "weapon", label, slot: "mainHand" }],
        },
        publicOutcome: { hit: true },
      },
      id: `round:1:event:${sequence}`,
      identities: [],
      missingFacts: [],
      occurredAt: "2026-08-18T10:00:00.000Z",
      ownerParticipantId: "aria",
      phase: "phase1",
      roundNumber: 1,
      sequence,
      status: "committed",
      step: "phase_1_actions",
      type: "attack",
    });
    const { container } = render(
      <PlayerCombatHistoryInspector
        events={[safeEvent(5, "Round shield", true), safeEvent(6, "Main gauche", false)]}
        snapshot={snapshot()}
      />,
    );

    expect(screen.getAllByText("Committed defense")).toHaveLength(2);
    expect(screen.getByText("Included defense sources: Round shield")).toBeTruthy();
    expect(screen.getByText("Excluded defense sources: Main gauche")).toBeTruthy();
    expect(screen.getByText("Awareness: Unaware")).toBeTruthy();
    expect(container.textContent).not.toContain("item-");
    expect(container.textContent).not.toContain("template-");
    expect(container.textContent).not.toContain("revision-");
  });

  it("preserves panel placement while rendering historical values without form controls", () => {
    const { container } = render(
      <PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />,
    );

    expect(screen.getByText("Single attack")).toBeTruthy();
    expect(screen.getByText("Maintain distance to opponent")).toBeTruthy();
    expect(screen.getByText("Hold the bridge")).toBeTruthy();
    expect(screen.getByText("Long sword")).toBeTruthy();
    expect(screen.getByText("Thrust")).toBeTruthy();
    expect(screen.getAllByText("Sword / shield")).toHaveLength(2);
    expect(screen.getByText("General/Fatigue")).toBeTruthy();
    expect(screen.getByText("Historical context")).toBeTruthy();
    expect(screen.getByLabelText(/Historical result/)).toBeTruthy();
    expect(container.textContent).not.toContain("Bucket Key");
    expect(container.textContent).not.toContain("Source Rule");
    expect(container.textContent).not.toContain("internal-rule-key");
    expect(container.textContent).not.toContain("another-internal-rule-key");
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector("input")).toBeNull();
    expect(container.querySelector("button")).toBeNull();
  });

  it("uses the same concise situation grammar for historical modifiers", () => {
    render(<PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />);

    expect(screen.getByText("Combat situation")).toBeTruthy();
    expect(screen.getByText("Current")).toBeTruthy();
    expect(screen.getByText("General/Fatigue")).toBeTruthy();
    expect(screen.getByText("Total -2%")).toBeTruthy();
    expect(screen.getByText("single attack")).toBeTruthy();
    expect(screen.getByText("second modifier")).toBeTruthy();
    expect(screen.queryByText("Source/scope")).toBeNull();
  });

  it("renders read-only historical context in the normal action-area position", () => {
    render(<PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />);

    const modifierPanel = screen.getByText("Combat situation").closest("section");
    const currentActionPanel = screen.getByText("Historical context").closest("section");
    const actionResultPanel = screen.getByLabelText(/Historical result/);
    expect(modifierPanel?.parentElement).toBe(currentActionPanel?.parentElement);
    expect(currentActionPanel?.parentElement).toBe(actionResultPanel.parentElement);
    expect(Array.from(currentActionPanel?.parentElement?.children ?? [])).toEqual([
      modifierPanel,
      currentActionPanel,
      actionResultPanel,
    ]);

    expect(screen.queryByText("Current action")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  /*
   * #771 R2-12 changed the first half of this expectation on purpose. The original decision it
   * records — show an explicit per-panel statement rather than a generic projected-data summary —
   * was about *what* an unrecorded panel says, and the Product Owner has now ruled that such a
   * panel should say nothing and take no space: four reserved cards filled roughly half the
   * historical viewport. So the card is omitted rather than reworded.
   *
   * The anti-leak half is unchanged and must stay: an unrecorded panel still must not fall back to
   * dumping raw projected keys such as `Action Label` or `Attack Summary` into the surface.
   */
  it("omits unrecorded historical panels instead of reserving a card for each", () => {
    const empty = snapshot();
    empty.panels.actionSelector = {};
    empty.panels.phase1 = {};
    empty.panels.modifiers = {};
    const { container } = render(<PlayerCombatHistoryInspector events={[]} snapshot={empty} />);

    expect(screen.queryByText("No information available for this panel.")).toBeNull();
    // The one panel that cannot be omitted names the inspected step, so it keeps an empty message
    // — now the same specific sentence the GM surface already shows.
    expect(screen.getByText("No recorded result for this step.")).toBeTruthy();
    expect(screen.queryByLabelText("Action selector")).toBeNull();
    expect(screen.queryByLabelText("Combat situation")).toBeNull();
    expect(screen.queryByText("Phase 1")).toBeNull();
    /*
     * Omission is per-panel, not wholesale: this fixture leaves Phase 2 recorded, so that card
     * still renders beside the three that were emptied. That is the measurement that separates
     * "omit the empty panel" from "drop the historical workspace".
     */
    expect(screen.getByText("Phase 2")).toBeTruthy();
    expect(screen.getByText("Historical context")).toBeTruthy();
    expect(container.textContent).not.toContain("Action Label");
    expect(container.textContent).not.toContain("Attack Summary");
    expect(screen.queryByText("Action Label")).toBeNull();
    expect(screen.queryByText("Attack Summary")).toBeNull();
  });

  it("explains a recorded non-required historical step without a legacy warning", () => {
    const nonRequired = snapshot();
    nonRequired.step = "review_phase_2_actions";
    nonRequired.stepOutcome = {
      category: "not_required",
      message: "No parry required. The incoming attack missed.",
      reason: "incoming_attack_missed",
    };
    const { container } = render(
      <PlayerCombatHistoryInspector events={[]} snapshot={nonRequired} />,
    );

    expect(screen.getByText("No parry required. The incoming attack missed.")).toBeTruthy();
    expect(container.textContent).not.toContain("canonical event history");
  });

  it("does not render identities absent from the projected snapshot", () => {
    const { container } = render(
      <PlayerCombatHistoryInspector events={[]} snapshot={snapshot()} />,
    );

    expect(container.textContent).toContain("No target");
    expect(container.textContent).not.toContain("Hidden opponent");
  });

  it("renders archived observation progress and established bonus inside existing panels", () => {
    const observed = snapshot();
    observed.panels.actionSelector = {
      actionId: "parry",
      actionLabel: "Parry",
      secondaryActionId: "observe_opponent",
      secondaryActionLabel: "Observe opponent",
      secondaryActionTargetParticipantId: "visible",
    };
    if ("rows" in observed.panels.modifiers) {
      observed.panels.modifiers.obSkillRaw = 1;
      observed.panels.modifiers.rows.push({
        bucketKey: "situation_ob_skill",
        entries: [],
        label: "Skill/OB",
        total: 1,
      });
      observed.panels.modifiers.effects = [
        {
          applicability: {
            combatWide: false,
            opponentParticipantId: "visible",
            rollPurposes: [],
          },
          id: "observe:aria:visible:skill",
          lifecycle: {
            duration: {
              endsWhen: "relationship_ends",
              kind: "relationship",
              relationshipId: "observation:aria:visible",
              startRound: 1,
              startSequence: 4,
            },
            state: "active",
          },
          ownerParticipantId: "aria",
          payload: {
            category: "skill_ob",
            contributionScope: "calculation",
            kind: "numeric",
            unit: "percentage",
            value: 1,
          },
          provenanceCompleteness: "complete",
          publicLabel: "Observe Opponent",
          schemaVersion: 1,
          sourceFamily: "observe_relationship",
        },
      ];
    }
    render(
      <PlayerCombatHistoryInspector
        events={[]}
        observationRelationships={[
          {
            bestBonus: 1,
            completedAttempts: 1,
            id: "observation:aria:visible",
            observerParticipantId: "aria",
            roundsTowardNextAttempt: 4,
            targetParticipantId: "visible",
          },
        ]}
        observationTargetLabels={{ visible: "Visible opponent" }}
        snapshot={observed}
      />,
    );

    expect(screen.getByText("Observation progress")).toBeTruthy();
    expect(screen.getByText("Visible opponent: 4 / 6 · best +1% · attempts 1")).toBeTruthy();
    expect(screen.getByText("Observe Opponent")).toBeTruthy();
    expect(screen.getByText(/Against Visible opponent/)).toBeTruthy();
    expect(screen.getAllByText("Historical context")).toHaveLength(1);
  });
});
