import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalCombatModifierEffectSchema } from "@glantri/domain";

import type { CombatSituationLifecycleEffect } from "./combatSituationAwareness";
import {
  PlayerCombatActionButtonPanel,
  PlayerCombatActionSelectorPanel,
  PlayerCombatAttackModeSelector,
  PlayerCombatCommittedDefenseReview,
  PlayerCombatCurrentConsequences,
  PlayerCombatModifierPanel,
  PlayerCombatObservationProgress,
  PlayerCombatOpponentSelector,
} from "./PlayerCombatPanels";

afterEach(() => {
  cleanup();
});

describe("PlayerCombatCurrentConsequences", () => {
  it("updates the current consequence across polling without rendering private provenance", () => {
    const consequence = {
      detail: "External bleeding",
      durationLabel: "Until cleared",
      summary: "Bleed 5/10 HP per round",
    };
    const { container, rerender } = render(
      <PlayerCombatCurrentConsequences consequences={[consequence]} />,
    );

    expect(screen.getByRole("region", { name: "Current consequences" })).toBeInTheDocument();
    expect(screen.getByText("Bleed 5/10 HP per round")).toBeInTheDocument();
    expect(screen.getByText("Until cleared · External bleeding")).toBeInTheDocument();
    [
      "pointed_weapons|arm|12|03",
      "private-critical-command",
      "private-critical-effect",
      "encounter-participant-1",
    ].forEach((secret) => expect(container.textContent).not.toContain(secret));

    rerender(
      <PlayerCombatCurrentConsequences
        consequences={[{ ...consequence, detail: "Bleeding continues" }]}
      />,
    );
    expect(screen.getByText("Until cleared · Bleeding continues")).toBeInTheDocument();
    expect(screen.queryByText("Until cleared · External bleeding")).not.toBeInTheDocument();

    rerender(<PlayerCombatCurrentConsequences consequences={[]} />);
    expect(screen.queryByRole("region", { name: "Current consequences" })).not.toBeInTheDocument();
    expect(screen.queryByText("Bleed 5/10 HP per round")).not.toBeInTheDocument();
  });
});

describe("PlayerCombatActionSelectorPanel", () => {
  it("advances the rendered committed defense without exposing canonical identifiers", () => {
    const first = {
      attackDirection: "front" as const,
      aware: true,
      eventSequence: 8,
      ordinaryDodgeAvailable: true,
      phase: "phase1" as const,
      roundNumber: 2,
      sources: [
        {
          included: true,
          kind: "shield" as const,
          label: "Round shield",
          slot: "offHand" as const,
        },
      ],
    };
    const { container, rerender } = render(<PlayerCombatCommittedDefenseReview review={first} />);

    expect(screen.getByText("Awareness: Aware")).toBeInTheDocument();
    expect(screen.getByText("Included defense sources: Round shield")).toBeInTheDocument();

    rerender(
      <PlayerCombatCommittedDefenseReview
        review={{
          ...first,
          attackDirection: "rear",
          aware: false,
          eventSequence: 9,
          ordinaryDodgeAvailable: false,
          sources: [
            { ...first.sources[0]!, included: false },
            {
              included: true,
              kind: "weapon",
              label: "Main gauche",
              slot: "mainHand",
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("Awareness: Unaware")).toBeInTheDocument();
    expect(screen.getByText("Ordinary Dodge: Unavailable")).toBeInTheDocument();
    expect(screen.getByText("Incoming direction: Rear")).toBeInTheDocument();
    expect(screen.getByText("Included defense sources: Main gauche")).toBeInTheDocument();
    expect(screen.getByText("Excluded defense sources: Round shield")).toBeInTheDocument();
    expect(container.textContent).not.toContain("item-");
    expect(container.textContent).not.toContain("template-");
    expect(container.textContent).not.toContain("revision");
    expect(container.textContent).not.toContain("attacker");
  });

  /**
   * Forgejo issue #356 — the Action Selector is the declaration destination the Combat Panel
   * Contract §12.4 names for Item operations ("Action selector, secondary action"), and it carries
   * that surface as a slot so it keeps no encounter or transport knowledge of its own. Both call
   * sites — the GM Combat Inspector and the player Combat page — pass the existing
   * `CombatItemInteractionPanel` into it unchanged.
   */
  it("renders the supplied Item interaction declaration surface in the secondary-action region", () => {
    render(
      <PlayerCombatActionSelectorPanel
        actionId=""
        additionalActionNotes=""
        itemInteractionControls={<div data-testid="item-interaction-surface">Items</div>}
        movementId=""
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onMovementChange={vi.fn()}
        onSecondaryActionChange={vi.fn()}
        secondaryActionId=""
      />,
    );

    const surface = screen.getByTestId("item-interaction-surface");
    expect(surface).toBeInTheDocument();
    const region = screen.getByRole("combobox", { name: "Secondary action" }).closest("section");
    expect(region?.contains(surface)).toBe(true);
  });

  it("omits the Item interaction region when no declaration surface is supplied", () => {
    render(
      <PlayerCombatActionSelectorPanel
        actionId=""
        additionalActionNotes=""
        movementId=""
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onMovementChange={vi.fn()}
        onSecondaryActionChange={vi.fn()}
        secondaryActionId=""
      />,
    );

    expect(screen.queryByTestId("item-interaction-surface")).toBeNull();
  });

  it("keeps the selector prompt and shows the completed declaration state", () => {
    render(
      <PlayerCombatActionSelectorPanel
        actionId=""
        additionalActionNotes=""
        declarationRecorded
        movementId=""
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onMovementChange={vi.fn()}
        onSecondaryActionChange={vi.fn()}
        secondaryActionId=""
      />,
    );

    expect(screen.getByRole("option", { name: "Choose primary action" })).toBeInTheDocument();
    expect(screen.getByText("Action declared.")).toBeInTheDocument();
    expect(
      Array.from(
        (screen.getByRole("combobox", { name: "Secondary action" }) as HTMLSelectElement).options,
      ).map((option) => option.text),
    ).toEqual([
      "Choose secondary action",
      "Observe opponent",
      "Pass",
      "Talk / Shout",
      "Equip / Unequip",
      "Small Action",
    ]);
  });

  it("supports secondary-first selection and then constrains compatible primaries", () => {
    function CompatibilityHarness() {
      const [actionId, setActionId] = useState<"" | "parry">("");
      const [secondaryActionId, setSecondaryActionId] = useState<"" | "observe_opponent">("");
      return (
        <PlayerCombatActionSelectorPanel
          actionId={actionId}
          additionalActionNotes=""
          movementId="hold"
          onActionChange={(value) => setActionId(value as "" | "parry")}
          onAdditionalActionNotesChange={vi.fn()}
          onMovementChange={vi.fn()}
          onSecondaryActionChange={(value) =>
            setSecondaryActionId(value as "" | "observe_opponent")
          }
          secondaryActionId={secondaryActionId}
        />
      );
    }

    render(<CompatibilityHarness />);
    fireEvent.change(screen.getByRole("combobox", { name: "Secondary action" }), {
      target: { value: "observe_opponent" },
    });

    const primary = screen.getByRole("combobox", { name: "Action" }) as HTMLSelectElement;
    expect(Array.from(primary.options).map((option) => option.value)).toEqual([
      "",
      "parry",
      "pass",
    ]);
    expect(
      screen.getByText("Choose a compatible primary action for Observe Opponent."),
    ).toBeInTheDocument();

    fireEvent.change(primary, { target: { value: "parry" } });
    expect(
      screen.queryByText("Choose a compatible primary action for Observe Opponent."),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Secondary action" })).toHaveValue(
      "observe_opponent",
    );
  });

  it("offers Observe Opponent as an explicit Parry secondary action", () => {
    const onSecondaryActionChange = vi.fn();
    render(
      <PlayerCombatActionSelectorPanel
        actionId="parry"
        additionalActionNotes=""
        movementId="hold"
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onMovementChange={vi.fn()}
        onSecondaryActionChange={onSecondaryActionChange}
        secondaryActionId=""
      />,
    );

    const primary = screen.getByRole("combobox", { name: "Action" }) as HTMLSelectElement;
    const secondary = screen.getByRole("combobox", {
      name: "Secondary action",
    }) as HTMLSelectElement;
    expect(Array.from(primary.options).some((option) => option.text === "Parry")).toBe(true);
    expect(Array.from(primary.options).some((option) => option.text === "Observe Opponent")).toBe(
      false,
    );
    expect(Array.from(secondary.options).map((option) => option.text)).toEqual([
      "Choose secondary action",
      "Observe opponent",
      "Pass",
      "Talk / Shout",
      "Equip / Unequip",
      "Small Action",
    ]);
    expect(secondary.value).toBe("");
    fireEvent.change(secondary, { target: { value: "observe_opponent" } });
    expect(onSecondaryActionChange).toHaveBeenCalledWith("observe_opponent");
    expect(screen.getByRole("combobox", { name: "Movement direction" })).toHaveValue("");
    expect(screen.queryByText("Focus on defense for this round.", { exact: false })).toBeNull();
    expect(
      screen.queryByText("Parry assumes sufficient room to maneuver.", { exact: false }),
    ).toBeNull();
  });

  it("records prioritized participant-relative intent without leaking hidden opponents", () => {
    const onMovementIntentChange = vi.fn();
    const onDeclarationIntentChange = vi.fn();
    render(
      <PlayerCombatActionSelectorPanel
        actionId="move_only"
        additionalActionNotes=""
        declarationIntent={{
          primaryAction: { actionId: "move_only" },
          relativePositions: [
            {
              desiredDistance: 2,
              kind: "keep_distance",
              targetParticipantId: "visible-guard",
            },
          ],
        }}
        distancePreferenceOptions={[
          { currentDistance: 2, displayName: "Visible guard", id: "visible-guard" },
        ]}
        movementId="step"
        movementIntent={{ distancePreferences: [], mode: "set_distance_preferences" }}
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onDeclarationIntentChange={onDeclarationIntentChange}
        onMovementChange={vi.fn()}
        onMovementIntentChange={onMovementIntentChange}
        onSecondaryActionChange={vi.fn()}
        secondaryActionId=""
      />,
    );

    expect(screen.getByRole("group", { name: "Relative position" })).toBeTruthy();
    expect(screen.getByText("Priority 1")).toBeInTheDocument();
    expect(screen.getByText("Visible guard")).toBeInTheDocument();
    expect(document.body.textContent).not.toContain("Hidden spy");
    fireEvent.change(screen.getByRole("combobox", { name: "Desired distance" }), {
      target: { value: "1" },
    });
    expect(onDeclarationIntentChange).toHaveBeenLastCalledWith({
      primaryAction: { actionId: "move_only" },
      relativePositions: [
        {
          desiredDistance: 1,
          kind: "keep_distance",
          targetParticipantId: "visible-guard",
        },
      ],
    });
    expect(onMovementIntentChange).toHaveBeenLastCalledWith({
      distancePreferences: [
        {
          desiredDistance: 1,
          source: "player_declared",
          targetParticipantId: "visible-guard",
        },
      ],
      mode: "set_distance_preferences",
    });
  });

  it("records independent eight-direction movement and facing without feasibility controls", () => {
    render(
      <PlayerCombatActionSelectorPanel
        actionId="move_only"
        additionalActionNotes=""
        declarationIntent={{
          facing: "backward_left",
          movementDirection: "forward_right",
          primaryAction: { actionId: "move_only" },
          relativePositions: [],
        }}
        movementId="step"
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onMovementChange={vi.fn()}
        onMovementIntentChange={vi.fn()}
        onSecondaryActionChange={vi.fn()}
        secondaryActionId=""
      />,
    );

    expect(screen.getByRole("combobox", { name: "Movement direction" })).toHaveValue(
      "forward_right",
    );
    expect(screen.getByRole("combobox", { name: "Facing" })).toHaveValue("backward_left");
    expect(screen.getByText("The GM resolves feasibility.", { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "How" })).not.toBeInTheDocument();
    expect(screen.queryByText("Expected time", { exact: false })).not.toBeInTheDocument();
  });

  it("keeps Perform Task and communication as description-only player declarations", () => {
    const onDeclarationIntentChange = vi.fn();
    const { rerender } = render(
      <PlayerCombatActionSelectorPanel
        actionId="perform_task"
        additionalActionNotes=""
        declarationIntent={{
          primaryAction: { actionId: "perform_task" },
          relativePositions: [],
        }}
        movementId="hold"
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onDeclarationIntentChange={onDeclarationIntentChange}
        onMovementChange={vi.fn()}
        onSecondaryActionChange={vi.fn()}
        secondaryActionId=""
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Task description" }), {
      target: { value: "Bar the gate." },
    });
    expect(onDeclarationIntentChange).toHaveBeenLastCalledWith({
      primaryAction: { actionId: "perform_task", description: "Bar the gate." },
      relativePositions: [],
    });
    expect(screen.queryByText("Difficulty", { exact: false })).not.toBeInTheDocument();

    rerender(
      <PlayerCombatActionSelectorPanel
        actionId="pass"
        additionalActionNotes=""
        declarationIntent={{
          primaryAction: { actionId: "pass" },
          relativePositions: [],
          secondaryAction: { actionId: "talk_shout" },
        }}
        movementId="hold"
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onDeclarationIntentChange={onDeclarationIntentChange}
        onMovementChange={vi.fn()}
        onSecondaryActionChange={vi.fn()}
        secondaryActionId="talk_shout"
      />,
    );
    expect(
      Array.from(
        (screen.getByRole("combobox", { name: "Utterance type" }) as HTMLSelectElement).options,
      ).map((option) => option.text),
    ).toEqual(["Choose type", "Speak", "Shout", "Whisper", "Other"]);
    expect(screen.getByText("it has no automatic mechanics", { exact: false })).toBeInTheDocument();
  });

  it("keeps Offensive Parry opponent selection out of the general action selector", () => {
    render(
      <PlayerCombatActionSelectorPanel
        actionId="offensive_parry"
        additionalActionNotes=""
        movementId="hold"
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onMovementChange={vi.fn()}
        onSecondaryActionChange={vi.fn()}
        secondaryActionId=""
      />,
    );

    expect(screen.queryByRole("combobox", { name: "Opponent to counter" })).not.toBeInTheDocument();
  });

  it("hides unsupported actions for new declarations and preserves a selected legacy value", () => {
    const { rerender } = render(
      <PlayerCombatActionSelectorPanel
        actionId=""
        additionalActionNotes=""
        movementId="hold"
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onMovementChange={vi.fn()}
        onSecondaryActionChange={vi.fn()}
        secondaryActionId=""
      />,
    );

    const primary = screen.getByRole("combobox", { name: "Action" }) as HTMLSelectElement;
    expect(Array.from(primary.options).map((option) => option.value)).not.toContain(
      "counterattack",
    );
    expect(Array.from(primary.options).map((option) => option.value)).toContain("disarm");
    expect(Array.from(primary.options).map((option) => option.value)).toContain("parry_disarm");

    rerender(
      <PlayerCombatActionSelectorPanel
        actionId="counterattack"
        additionalActionNotes=""
        controlsDisabled
        movementId="hold"
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onMovementChange={vi.fn()}
        onSecondaryActionChange={vi.fn()}
        secondaryActionId=""
      />,
    );

    expect(screen.getByRole("option", { name: "Counterattack · Unavailable" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Action" })).toHaveValue("counterattack");
  });

  it("presents a stale incompatible pair and requires explicit reconciliation", () => {
    const onSecondaryActionChange = vi.fn();
    render(
      <PlayerCombatActionSelectorPanel
        actionId="attack_parry"
        additionalActionNotes=""
        movementId="hold"
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onMovementChange={vi.fn()}
        onSecondaryActionChange={onSecondaryActionChange}
        secondaryActionId="observe_opponent"
      />,
    );

    expect(
      screen.getByText(
        "Single attack cannot be combined with Observe Opponent. Choose a compatible primary action or remove the secondary action.",
      ),
    ).toBeInTheDocument();
    expect(
      Array.from(
        (screen.getByRole("combobox", { name: "Action" }) as HTMLSelectElement).options,
      ).map((option) => option.value),
    ).toEqual(["", "attack_parry", "parry", "pass"]);
    expect(
      screen.getByRole("option", {
        name: "Single attack · Not compatible with Observe Opponent",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("option", {
        name: "Observe Opponent · Not compatible with Single attack",
      }),
    ).toBeDisabled();

    fireEvent.change(screen.getByRole("combobox", { name: "Secondary action" }), {
      target: { value: "" },
    });
    expect(onSecondaryActionChange).toHaveBeenCalledWith("");
  });

  it("renders the shared canonical Offensive Parry opponent selector for the Phase 1 panel", () => {
    const onSelectedOpponentChange = vi.fn();
    render(
      <PlayerCombatOpponentSelector
        onSelectedOpponentChange={onSelectedOpponentChange}
        opponentOptions={[
          { displayName: "Borin", id: "encounter-participant-borin" },
          { displayName: "Cora", id: "encounter-participant-cora" },
        ]}
        selectedOpponentId="encounter-participant-borin"
      />,
    );

    const selector = screen.getByRole("combobox", { name: "Opponent to counter" });
    expect(selector).toHaveValue("encounter-participant-borin");
    fireEvent.change(selector, { target: { value: "encounter-participant-cora" } });
    expect(onSelectedOpponentChange).toHaveBeenCalledWith("encounter-participant-cora");
  });

  it("renders the shared selector with Observe Opponent's Phase 1 label", () => {
    render(
      <PlayerCombatOpponentSelector
        label="Opponent"
        onSelectedOpponentChange={vi.fn()}
        opponentOptions={[{ displayName: "Borin", id: "encounter-participant-borin" }]}
        selectedOpponentId="encounter-participant-borin"
      />,
    );

    expect(screen.getByRole("combobox", { name: "Opponent" })).toBeTruthy();
  });
});

describe("PlayerCombatObservationProgress", () => {
  it("renders separate progress and best bonus for every observed target", () => {
    render(
      <PlayerCombatObservationProgress
        relationships={[
          {
            bestBonus: 0,
            completedAttempts: 0,
            id: "observation:observer:gladiator",
            observerParticipantId: "observer",
            roundsTowardNextAttempt: 2,
            targetParticipantId: "gladiator",
          },
          {
            bestBonus: 1,
            completedAttempts: 1,
            id: "observation:observer:orc",
            observerParticipantId: "observer",
            roundsTowardNextAttempt: 4,
            targetParticipantId: "orc",
          },
        ]}
        targetLabels={{ gladiator: "Gladiator", orc: "Orc captain" }}
      />,
    );

    expect(screen.getByText("Observation progress")).toBeInTheDocument();
    expect(screen.getByText("Gladiator: 2 / 3")).toBeInTheDocument();
    expect(screen.getByText("Orc captain: 4 / 6 · best +1% · attempts 1")).toBeInTheDocument();
    expect(screen.queryByText("Observation", { exact: true })).not.toBeInTheDocument();
  });
});

describe("PlayerCombatAttackModeSelector", () => {
  it("renders the explicit selected mode used by the editable declaration context", () => {
    const onChange = vi.fn();

    render(
      <PlayerCombatAttackModeSelector
        onChange={onChange}
        options={[
          { id: "mode-1", label: "Slash" },
          { id: "mode-2", label: "Thrust" },
        ]}
        selectedAttackModeId="mode-2"
      />,
    );

    expect(screen.getByRole("combobox", { name: "Attack mode" })).toHaveValue("mode-2");
    fireEvent.change(screen.getByRole("combobox", { name: "Attack mode" }), {
      target: { value: "mode-1" },
    });
    expect(onChange).toHaveBeenCalledWith("mode-1");
  });

  it("shows why no canonical mode can be selected instead of hiding the field", () => {
    render(
      <PlayerCombatAttackModeSelector
        emptyState="The selected Phase 2 attack mode is not eligible."
        onChange={vi.fn()}
        options={[]}
      />,
    );

    expect(screen.getByText("Attack mode")).toBeInTheDocument();
    expect(
      screen.getByText("The selected Phase 2 attack mode is not eligible."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Attack mode" })).not.toBeInTheDocument();
  });
});

describe("PlayerCombatModifierPanel", () => {
  it("separates pending initiative modifiers from active arithmetic", () => {
    render(
      <PlayerCombatModifierPanel
        pendingActivationLabel="Effective after Initiative 4 finishes"
        pendingEntries={[
          {
            id: "pending-unbalanced",
            imported: true,
            notes: "Unbalanced",
            scope: "until",
            value: -2,
          },
        ]}
        readOnly
        rows={[]}
      />,
    );

    expect(screen.getByText("Pending / expiring")).toBeInTheDocument();
    expect(screen.getByText("Unbalanced")).toBeInTheDocument();
    expect(screen.getByText("-2%")).toBeInTheDocument();
    expect(screen.getByText("Effective after Initiative 4 finishes")).toBeInTheDocument();
  });

  it("renders concise current calculation sources, scope, and reconciled total", () => {
    render(
      <PlayerCombatModifierPanel
        context={{ phase: "phase1" }}
        readOnly
        rows={[
          {
            bucketKey: "situation_ob_skill",
            entries: [
              {
                generated: true,
                id: "generated:distance:phase1:ob-skill",
                notes: "distance: Broad sword preferred 2 · actual 3 · nearest 2 · Skill/OB -2",
                scope: "until",
                sourcePhase: "phase1",
                sourceRule: "distance-ob-skill-phase1",
                value: -2,
              },
            ],
            label: "Skill/OB",
            total: -2,
          },
        ]}
      />,
    );

    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("Distance")).toBeInTheDocument();
    expect(screen.getByText("Total -2%")).toBeInTheDocument();
    expect(screen.getByText("Phase 1")).toBeInTheDocument();
    expect(screen.queryByText(/Broad sword preferred 2/)).not.toBeInTheDocument();
  });

  it("renders the round-scoped Parry percentage row during modifier review", () => {
    render(
      <PlayerCombatModifierPanel
        readOnly
        rows={[
          {
            bucketKey: "situation_db",
            entries: [
              {
                application: "percentage",
                durationRounds: 1,
                expiresAtRound: 4,
                generated: true,
                id: "generated:parry:round:db-parry-percentage",
                notes: "Parry: Dodge 7; one fifth, rounded down; Parry +1%",
                scope: "until",
                sourceActionId: "parry",
                sourceRoundNumber: 4,
                sourceRule: "parry-dodge-one-fifth",
                value: 1,
              },
            ],
            label: "DB/Parry",
            total: 1,
          },
        ]}
      />,
    );

    expect(screen.getByText("+1%")).toBeInTheDocument();
    expect(screen.getByText("Total +1%")).toBeInTheDocument();
    expect(screen.getByText("Parry")).toBeInTheDocument();
    expect(screen.queryByText(/one fifth/i)).not.toBeInTheDocument();
  });

  it("shows only target-aware canonical observation contributions", () => {
    render(
      <PlayerCombatModifierPanel
        context={{
          opponentParticipantId: "orc",
          participantLabels: { orc: "Orc captain" },
        }}
        readOnly
        rows={[
          {
            bucketKey: "situation_ob_skill",
            derivedEntries: [
              {
                application: "percentage",
                id: "observe:orc:skill",
                scopeLabel: "Against Orc captain",
                sourceLabel: "Observe Opponent",
                value: 3,
              },
            ],
            entries: [],
            label: "Skill/OB",
            total: 3,
          },
        ]}
      />,
    );

    expect(screen.getByText("Observe Opponent")).toBeInTheDocument();
    expect(screen.getByText("+3%")).toBeInTheDocument();
    expect(screen.getByText("Total +3%")).toBeInTheDocument();
    expect(screen.getByText("Against Orc captain")).toBeInTheDocument();
  });

  it("suppresses empty categories and uses an explicit empty state", () => {
    const rows = [
      {
        bucketKey: "situation_initiative" as const,
        entries: [],
        label: "Initiative",
        total: 0,
      },
    ];
    const { rerender } = render(<PlayerCombatModifierPanel readOnly rows={rows} />);

    expect(screen.queryByText("Initiative")).not.toBeInTheDocument();

    rerender(<PlayerCombatModifierPanel readOnly rows={rows} showEmptyCategories />);

    expect(screen.queryByText("Initiative")).not.toBeInTheDocument();
    expect(screen.getByText("No active modifiers.")).toBeInTheDocument();
  });

  it("shows a concise provisional empty state", () => {
    render(<PlayerCombatModifierPanel provisional readOnly rows={[]} />);

    expect(screen.getByText("Provisional")).toBeInTheDocument();
    expect(screen.getByText("No active modifiers.")).toBeInTheDocument();
  });

  it("keeps editable modifier details on a full-width row", () => {
    const onAddEntry = vi.fn();
    const onRemoveEntry = vi.fn();
    const onUpdateEntry = vi.fn();
    render(
      <PlayerCombatModifierPanel
        onAddEntry={onAddEntry}
        onRemoveEntry={onRemoveEntry}
        onUpdateEntry={onUpdateEntry}
        rows={[
          {
            bucketKey: "situation_db",
            entries: [
              {
                durationRounds: 1,
                generated: true,
                id: "generated:attack-parry:phase1:db-parry",
                notes: "single attack",
                scope: "until",
                sourcePhase: "phase1",
                sourceRule: "attack-parry-db-phase1",
                value: -4,
              },
            ],
            label: "DB/Parry",
            total: -4,
          },
        ]}
      />,
    );

    expect(screen.getByText("Source/scope")).toBeInTheDocument();
    expect(screen.getByText("Mod")).toBeInTheDocument();
    expect(screen.getByText("Dur")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Situational · P1")).toBeInTheDocument();
    expect(screen.getByLabelText("DB/Parry modifier details")).toHaveValue("single attack");
    expect(screen.getByLabelText("DB/Parry modifier value")).not.toBeDisabled();

    fireEvent.change(screen.getByLabelText("DB/Parry modifier value"), {
      target: { value: "-3" },
    });
    fireEvent.change(screen.getByLabelText("DB/Parry modifier duration"), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText("DB/Parry modifier details"), {
      target: { value: "updated" },
    });
    fireEvent.click(screen.getByLabelText("Remove modifier"));
    fireEvent.click(screen.getByRole("button", { name: "Add" }));
    fireEvent.change(screen.getAllByLabelText("DB/Parry modifier value").at(-1)!, {
      target: { value: "1" },
    });

    expect(onUpdateEntry).toHaveBeenCalledWith(
      "situation_db",
      "generated:attack-parry:phase1:db-parry",
      { value: -3 },
    );
    expect(onUpdateEntry).toHaveBeenCalledWith(
      "situation_db",
      "generated:attack-parry:phase1:db-parry",
      { durationRounds: 2 },
    );
    expect(onUpdateEntry).toHaveBeenCalledWith(
      "situation_db",
      "generated:attack-parry:phase1:db-parry",
      { notes: "updated" },
    );
    expect(onRemoveEntry).toHaveBeenCalledWith(
      "situation_db",
      "generated:attack-parry:phase1:db-parry",
    );
    expect(onAddEntry).toHaveBeenCalledWith("situation_db", expect.any(Object));
  });

  it("renders imported persistent rows read-only beside editable situational rows", () => {
    const onRemoveEntry = vi.fn();
    const onUpdateEntry = vi.fn();

    render(
      <PlayerCombatModifierPanel
        onAddEntry={vi.fn()}
        onRemoveEntry={onRemoveEntry}
        onUpdateEntry={onUpdateEntry}
        rows={[
          {
            bucketKey: "situation_initiative",
            entries: [
              {
                generated: false,
                id: "import:character_effect:haste:initiative",
                imported: true,
                notes: "Haste",
                readOnly: true,
                scope: "until",
                sourceDuration: "2 rounds",
                sourceEffectId: "haste",
                sourceType: "character_effect",
                value: 2,
              },
              {
                id: "manual-initiative",
                notes: "GM adjustment",
                scope: "until",
                value: 1,
              },
            ],
            label: "Initiative",
            total: 3,
          },
        ]}
      />,
    );

    expect(screen.getByText("Character/state")).toBeInTheDocument();
    expect(screen.getByText("Haste")).toBeInTheDocument();
    expect(screen.getByText("2 rounds")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Initiative modifier value", { selector: "input[value='2']" }),
    ).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("1")).not.toBeDisabled();

    fireEvent.change(screen.getByDisplayValue("1"), { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("Remove modifier"));

    expect(onUpdateEntry).toHaveBeenCalledWith("situation_initiative", "manual-initiative", {
      value: 3,
    });
    expect(onRemoveEntry).toHaveBeenCalledWith("situation_initiative", "manual-initiative");
  });
});

describe("PlayerCombatActionButtonPanel", () => {
  it("scopes a loading attack context to Current Action and keeps the roll disabled", () => {
    render(
      <PlayerCombatActionButtonPanel
        disabled
        presentation={{
          actionName: "Single Attack",
          boundary: "phase1_resolution",
          encounterId: "encounter-1",
          encounterRevision: "revision-4",
          heading: "Phase 1",
          primaryAction: {
            descriptor: {
              commandType: "roll_attack",
              encounterId: "encounter-1",
              expectedBoundary: "phase1_resolution",
              expectedRevision: "revision-4",
              opportunityId: "opportunity-1",
              phase: "phase1",
              taskId: "task-1",
            },
            enabled: true,
            gmProxyAvailable: true,
            label: "Roll attack",
            viewerMayInvoke: true,
          },
          reason: "",
          requiredActor: { hidden: false, id: "aria", label: "Aria" },
          requiredNow: "Roll attack.",
          status: "executable",
          summary: "Aria is attacking Borin.",
          taskHeading: "Roll attack",
          taskId: "task-1",
          taskKind: "attack",
        }}
        validationMessage="Loading attack context…"
        validationMessageTone="neutral"
      />,
    );

    expect(screen.getByText("Loading attack context…")).toHaveStyle({ color: "#5e5a50" });
    expect(screen.getByRole("button", { name: "Roll attack" })).toBeDisabled();
  });

  it("renders a non-submit primary command and invokes the immutable descriptor once", () => {
    const onAction = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());
    const descriptor = {
      commandType: "roll_attack" as const,
      encounterId: "encounter-1",
      expectedBoundary: "phase1_resolution" as const,
      expectedRevision: "revision-4",
      opportunityId: "opportunity-1",
      phase: "phase1" as const,
      taskId: "task-1",
    };
    render(
      <form onSubmit={onSubmit}>
        <PlayerCombatActionButtonPanel
          onDeclareAction={onAction}
          presentation={{
            actionName: "Single Attack",
            actor: { hidden: false, id: "aria", label: "Aria" },
            boundary: "phase1_resolution",
            encounterId: "encounter-1",
            encounterRevision: "revision-4",
            heading: "Phase 1",
            primaryAction: {
              descriptor,
              enabled: true,
              gmProxyAvailable: true,
              label: "Roll attack",
              viewerMayInvoke: true,
            },
            reason: "",
            requiredActor: { hidden: false, id: "aria", label: "Aria" },
            requiredNow: "Roll attack.",
            status: "executable",
            summary: "Aria is attacking Borin.",
            target: { hidden: false, id: "borin", label: "Borin" },
            taskHeading: "Roll attack",
            taskId: "task-1",
            taskKind: "attack",
            weapon: { id: "weapon-1", label: "Long Sword" },
          }}
        />
      </form>,
    );

    expect(screen.getByText("Phase 1")).toBeInTheDocument();
    expect(screen.getByText("Aria is attacking Borin.")).toBeInTheDocument();
    expect(screen.getByText("Weapon: Long Sword")).toBeInTheDocument();
    expect(screen.getByText("Roll attack.")).toBeInTheDocument();
    expect(screen.queryByText(/^Reason:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument();
    const action = screen.getByRole("button", { name: "Roll attack" });
    expect((action as HTMLButtonElement).type).toBe("button");
    fireEvent.click(action);
    expect(onAction).toHaveBeenCalledWith(descriptor);
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("renders the shared secondary combat command with non-submit semantics", () => {
    const onSecondaryAction = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent<HTMLFormElement>) => event.preventDefault());

    render(
      <form onSubmit={onSubmit}>
        <PlayerCombatActionButtonPanel
          onSecondaryAction={onSecondaryAction}
          secondaryButtonLabel="Secondary combat command"
        />
      </form>,
    );

    const action = screen.getByRole("button", { name: "Secondary combat command" });
    expect((action as HTMLButtonElement).type).toBe("button");
    fireEvent.click(action);

    expect(onSecondaryAction).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows contextual waiting state without rendering a fallback action", () => {
    render(
      <PlayerCombatActionButtonPanel
        presentation={{
          actionName: "Parry",
          boundary: "phase1_resolution",
          encounterId: "encounter-1",
          encounterRevision: "revision-4",
          heading: "Phase 1",
          primaryAction: {
            enabled: false,
            gmProxyAvailable: false,
            label: "Waiting for another combatant",
            viewerMayInvoke: false,
          },
          reason: "",
          requiredActor: { hidden: true, label: "another combatant" },
          requiredNow: "Waiting for another combatant.",
          status: "waiting",
          summary: "Aria is waiting for another combatant's parry.",
          taskHeading: "Waiting for another combatant",
        }}
      />,
    );

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Aria is waiting for another combatant's parry.")).toBeInTheDocument();
    expect(screen.getByText("Waiting for another combatant.")).toBeInTheDocument();
  });

  it("shows the canonical graze die with the descriptor-bound damage action", () => {
    const descriptor = {
      commandType: "resolve_damage" as const,
      damageRollExpression: "1d7",
      encounterId: "encounter-1",
      expectedBoundary: "phase1_resolution" as const,
      expectedRevision: "revision-4",
      taskId: "task-graze",
    };
    render(
      <PlayerCombatActionButtonPanel
        presentation={{
          actionName: "Graze Damage",
          boundary: "phase1_resolution",
          damageRollExpression: "1d7",
          encounterId: "encounter-1",
          encounterRevision: "revision-4",
          heading: "Phase 1",
          primaryAction: {
            descriptor,
            enabled: true,
            gmProxyAvailable: true,
            label: "Roll damage",
            viewerMayInvoke: true,
          },
          reason: "",
          requiredActor: { hidden: false, id: "aria", label: "Aria" },
          requiredNow: "Roll damage.",
          status: "executable",
          summary: "Aria hit Borin.",
          taskHeading: "Roll damage",
          taskId: "task-graze",
          taskKind: "damage_roll",
        }}
      />,
    );

    expect(screen.getByText("Die: 1d7")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Roll damage" })).toBeEnabled();
  });

  it("renders no primary button without a canonical current task", () => {
    render(<PlayerCombatActionButtonPanel />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText("Declare action")).not.toBeInTheDocument();
  });
});

/**
 * An effect carrying a unit the schema does not declare, cast past the type boundary —
 * the shape of malformed, downlevel or hand-edited persisted data. It is supplied through
 * `derivedEntries`, which passes a canonical effect straight through: an entry parsed from
 * the wire could not carry it, because the schema would reject the unit.
 */
function unrenderableDerivedEffect(): CombatSituationLifecycleEffect {
  const base = canonicalCombatModifierEffectSchema.parse({
    applicability: { combatWide: true, rollPurposes: [], roundNumber: 3 },
    createdAt: "2026-08-01T10:00:00.000Z",
    createdRevision: "revision-3",
    createdSequence: 12,
    id: "panel-unit-unrecognised",
    lifecycle: {
      duration: { kind: "indefinite", startRound: 3, startSequence: 12 },
      state: "active",
    },
    lineage: {},
    missingFacts: [],
    ownerParticipantId: "scyrian",
    payload: {
      category: "skill_ob",
      contributionScope: "calculation",
      kind: "numeric",
      unit: "percentage",
      value: -2,
    },
    provenanceCompleteness: "complete",
    publicLabel: "Strange effect",
    schemaVersion: 1,
    sourceFamily: "feint",
    sourceReferences: {},
    version: 1,
    visibility: { audience: "involved", sourceIdentity: "public" },
  });
  return {
    ...base,
    payload: { ...base.payload, unit: "arcane_flux" },
  } as unknown as CombatSituationLifecycleEffect;
}

describe("a calculation group whose breakdown is incomplete", () => {
  const INCOMPLETE_BREAKDOWN_COPY = "Total is exact; its breakdown is incomplete.";

  it("states both that the total is exact and that the breakdown is incomplete", () => {
    render(
      <PlayerCombatModifierPanel
        context={{ phase: "phase2", roundNumber: 3 }}
        readOnly
        rows={[
          {
            bucketKey: "situation_ob_skill",
            derivedEntries: [
              {
                application: "percentage",
                canonicalLifecycle: unrenderableDerivedEffect(),
                id: "panel-unit-unrecognised",
                scopeLabel: "",
                sourceLabel: "Strange effect",
                value: -2,
              },
            ],
            entries: [],
            label: "Skill/OB",
            total: -7,
          },
        ]}
      />,
    );

    // The authoritative total is still shown, unadjusted.
    expect(screen.getByText("Total -7")).toBeInTheDocument();
    // The contribution is not suppressed: its row is still present and still says so.
    expect(screen.getByText("Strange effect")).toBeInTheDocument();
    expect(screen.getByText("Unknown value")).toBeInTheDocument();
    // And the group says the decomposition below the total is not complete.
    expect(screen.getByText(INCOMPLETE_BREAKDOWN_COPY)).toBeInTheDocument();
  });

  /**
   * The regression that would reach every player, not just the unreachable data path:
   * an ordinary group must render exactly what it rendered before — no extra element.
   */
  it("adds nothing at all to an ordinary group", () => {
    render(
      <PlayerCombatModifierPanel
        context={{ phase: "phase1" }}
        readOnly
        rows={[
          {
            bucketKey: "situation_ob_skill",
            entries: [
              {
                generated: true,
                id: "generated:distance:phase1:ob-skill",
                notes: "distance: Skill/OB -2",
                scope: "until",
                sourcePhase: "phase1",
                sourceRule: "distance-ob-skill-phase1",
                value: -2,
              },
            ],
            label: "Skill/OB",
            total: -2,
          },
        ]}
      />,
    );

    expect(screen.getByText("Total -2%")).toBeInTheDocument();
    expect(screen.queryByText(INCOMPLETE_BREAKDOWN_COPY)).not.toBeInTheDocument();
    expect(screen.queryByText(/breakdown/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Unknown value")).not.toBeInTheDocument();
    // Structural, not just textual: the group element still has exactly its two children
    // — the header and the rows container — so no element was added and nothing shifted.
    const group = screen.getByText("Total -2%").closest("div")?.parentElement;
    expect(group).not.toBeNull();
    expect(group?.children).toHaveLength(2);
  });
});
