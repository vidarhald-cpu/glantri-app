import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { canonicalCombatModifierEffectSchema } from "@glantri/domain";

import type { CombatSituationLifecycleEffect } from "./combatSituationAwareness";
import { buildPlayerCombatLoadoutSummary } from "./playerCombatPhaseModel";
import {
  PlayerCombatActionButtonPanel,
  PlayerCombatActionSelectorPanel,
  PlayerCombatAttackModeSelector,
  PlayerCombatAttackSourceSelector,
  PlayerCombatAttackStatsTable,
  PlayerCombatCommittedDefenseReview,
  PlayerCombatDefenseGroup,
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

  /**
   * #778 — the Product Owner's case: a player who only wants to draw a weapon must not be made
   * to find `Pass` in the primary selector. With a general secondary chosen and no primary, the
   * panel reports nothing, and the primary selector still offers the empty choice plus every
   * available primary action rather than a narrowed list.
   */
  it("accepts a general secondary action with no primary action chosen", () => {
    function SecondaryOnlyHarness() {
      const [actionId, setActionId] = useState<"" | "attack_parry">("");
      const [secondaryActionId, setSecondaryActionId] = useState<"" | "equip_unequip">("");
      return (
        <PlayerCombatActionSelectorPanel
          actionId={actionId}
          additionalActionNotes=""
          movementId="hold"
          onActionChange={(value) => setActionId(value as "" | "attack_parry")}
          onAdditionalActionNotesChange={vi.fn()}
          onMovementChange={vi.fn()}
          onSecondaryActionChange={(value) => setSecondaryActionId(value as "" | "equip_unequip")}
          secondaryActionId={secondaryActionId}
        />
      );
    }

    render(<SecondaryOnlyHarness />);
    const primary = screen.getByRole("combobox", { name: "Action" }) as HTMLSelectElement;
    const unconstrainedPrimaryValues = Array.from(primary.options).map((option) => option.value);

    fireEvent.change(screen.getByRole("combobox", { name: "Secondary action" }), {
      target: { value: "equip_unequip" },
    });

    expect(screen.getByRole("combobox", { name: "Secondary action" })).toHaveValue("equip_unequip");
    expect(primary).toHaveValue("");
    expect(Array.from(primary.options).map((option) => option.value)).toEqual(
      unconstrainedPrimaryValues,
    );
    expect(Array.from(primary.options).map((option) => option.value)).toEqual([
      "",
      "attack_parry",
      "parry_attack",
      "double_attack",
      "feint_attack",
      "adjust_range_attack",
      "offensive_parry",
      "parry",
      "parry_disarm",
      "disarm",
      "break_off_engagement",
      "pass",
      "perform_task",
      "move_only",
    ]);
    expect(screen.queryByText(/compatible primary action/)).not.toBeInTheDocument();
    expect(screen.queryByText(/cannot be combined with/)).not.toBeInTheDocument();
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
    // Forgejo issue #771 R2-7: the explanatory sentence that used to be asserted here is
    // removed. The two assertions above are the substance — movement direction and facing hold
    // independent values — and survive untouched.
    expect(
      screen.queryByText("The GM resolves feasibility.", { exact: false }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "How" })).not.toBeInTheDocument();
    expect(screen.queryByText("Expected time", { exact: false })).not.toBeInTheDocument();
  });

  /**
   * Forgejo issue #771 finding R2-8. `Movement direction` and `Facing` share one eight-direction
   * enum by approved rule, so nothing in the two selects distinguishes them; the sentence that did
   * was removed by the R2-7 prose repair. Each select must carry the approved
   * `docs/rules/combat-declarations.md` §7/§8 definition of the field it records, verbatim, as its
   * own programmatic description — and the two accessible names must stay exactly
   * `Movement direction` and `Facing`, which is why the description cannot live inside the
   * wrapping `<label>`.
   */
  it("distinguishes movement direction from facing with the approved per-field descriptions", () => {
    render(
      <>
        <PlayerCombatActionSelectorPanel
          actionId="move_only"
          additionalActionNotes=""
          movementId="step"
          onActionChange={vi.fn()}
          onAdditionalActionNotesChange={vi.fn()}
          onMovementChange={vi.fn()}
          onSecondaryActionChange={vi.fn()}
          secondaryActionId=""
        />
        <PlayerCombatActionSelectorPanel
          actionId="move_only"
          additionalActionNotes=""
          movementId="step"
          onActionChange={vi.fn()}
          onAdditionalActionNotesChange={vi.fn()}
          onMovementChange={vi.fn()}
          onSecondaryActionChange={vi.fn()}
          secondaryActionId=""
        />
      </>,
    );

    const movementDirectionSelects = screen.getAllByRole("combobox", {
      name: "Movement direction",
    });
    const facingSelects = screen.getAllByRole("combobox", { name: "Facing" });
    expect(movementDirectionSelects).toHaveLength(2);
    expect(facingSelects).toHaveLength(2);

    movementDirectionSelects.forEach((select) => {
      expect(select).toHaveAccessibleDescription(
        "Movement Direction records the absolute direction in which the character intends to move.",
      );
    });
    facingSelects.forEach((select) => {
      expect(select).toHaveAccessibleDescription(
        "Facing records the direction/orientation the character intends to maintain or reach.",
      );
    });

    // Two panels on one page must not collide on a description id.
    const describedByIds = [...movementDirectionSelects, ...facingSelects].map((select) =>
      select.getAttribute("aria-describedby"),
    );
    expect(describedByIds.every((value) => typeof value === "string" && value.length > 0)).toBe(
      true,
    );
    expect(new Set(describedByIds).size).toBe(4);

    // The descriptions are visible text, not hover-only tooltips.
    expect(
      screen.getAllByText(
        "Movement Direction records the absolute direction in which the character intends to move.",
      ),
    ).toHaveLength(2);
    expect(
      screen.getAllByText(
        "Facing records the direction/orientation the character intends to maintain or reach.",
      ),
    ).toHaveLength(2);
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
  const INCOMPLETE_BREAKDOWN_COPY = "Exact total; incomplete breakdown.";

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

describe("PlayerCombatAttackStatsTable", () => {
  /**
   * **Forgejo issue #771 R2-5 supersedes ruling #517 E2 for the Combat surface.**
   *
   * This case was written for #517 E2, which required the GM — and only the GM — to see the
   * selected weapon mode's workbook coordinates in this mini-table. The Product Owner has since
   * ruled that workbook/source-row provenance is not player or GM combat information and must
   * not appear on the ordinary Combat surface at all. R2-5 is the newer controlling decision.
   *
   * The assertion is therefore **rewritten, deliberately and against a cited prior ruling**,
   * not deleted. #517 E2's protective half is kept and strengthened: the player still never
   * sees the coordinates, and now neither does the GM. The `includeSourceProvenance` input
   * itself is untouched and still only reachable from the GM path, which
   * `playerCombatPhaseModel.test.ts` continues to pin.
   */
  it("never shows a selected mode's workbook coordinates, to the GM or the player (#771 R2-5, superseding #517 E2)", () => {
    const loadoutModel = {
      armorSummary: null,
      combatStatePanelModel: {
        capabilityRows: [],
        description: "",
        statsRows: [],
        title: "Combat State Panel",
        weaponModeTable: {
          columns: ["Mode", "Weapon", "I", "Attack 1", "OB", "DMB", "Crit 1", "Sec", "AM"],
          description: "",
          rows: [
            ["Primary", "Dagger", "2", "Thrust", "8", "3", "DP", "—", "A"],
            ["Thrown", "Dagger", "-1", "Throw", "5", "1", "DP", "—", "A"],
          ],
          title: "Weapons",
        },
        weaponRows: [
          {
            attackModes: [
              {
                attackType: "melee",
                canonicalMeleeMode: "thrust",
                crit: "DP",
                dmb: 3,
                id: "mode-1",
                initiative: 2,
                isPrimaryAttack: true,
                label: "Thrust",
                ob: 8,
                order: 0,
              },
            ],
            attackMode1Id: "mode-1",
            currentItemLabel: "Dagger",
            itemId: "scenario-dagger",
            modeLabel: "Primary",
            templateId: "weapon-template-dagger",
          },
          {
            attackModes: [
              {
                allowsRepeatedRoundAttack: false,
                armorModifier: "A",
                attackType: "thrown",
                canonicalMeleeMode: null,
                crit: "DP",
                damageClass: "pointed",
                dmb: 1,
                id: "mode-3",
                initiative: -1,
                isPrimaryAttack: true,
                label: "Throw",
                ob: 5,
                order: 2,
                provenance: "imported",
                range: "10/30/60",
                sourceMetadata: {
                  rawRow: { A: "Dagger" },
                  row: 12,
                  sheet: "Weapon2",
                  sourceColumns: { A: "Weapon" },
                  sourceRange: "A12:K12",
                  workbook: "Themistogenes 1.07.xlsx",
                },
              },
            ],
            attackMode1Id: "mode-3",
            currentItemLabel: "Dagger",
            itemId: "scenario-dagger",
            modeLabel: "Thrown",
            templateId: "weapon-template-dagger",
          },
        ],
      },
      encumbranceSkillsTable: null,
      fields: [
        {
          id: "primary",
          label: "Primary weapon",
          options: [],
          value: "scenario-dagger",
          valueLabel: "Dagger",
        },
        {
          id: "throwing",
          label: "Throwing weapon",
          options: [],
          value: "scenario-dagger",
          valueLabel: "Dagger",
        },
      ],
    } as unknown as Parameters<typeof buildPlayerCombatLoadoutSummary>[0]["loadoutModel"];
    const summaryFor = (includeSourceProvenance?: boolean) =>
      buildPlayerCombatLoadoutSummary({
        actionId: "attack_parry",
        includeSourceProvenance,
        loadoutModel,
        phaseKey: "phase1",
        secondaryActionId: "",
        selectedAttackModeId: "mode-3",
      }).attackStats!;

    // The player page's call, which never asks for the coordinates.
    const player = render(<PlayerCombatAttackStatsTable stats={summaryFor()} />);
    expect(player.container.textContent).not.toContain("Source:");
    expect(player.container.textContent).not.toContain("imported");
    expect(player.container.textContent).not.toContain("Weapon2");
    expect(player.container.textContent).not.toContain("A12:K12");
    cleanup();

    // The GM's Combat Round Manager's call, for the same loadout. The model still builds the
    // coordinates for internal diagnostics; this table no longer renders them.
    expect(summaryFor(true).provenance).toBe("Weapon2 row 12 · A12:K12");
    const gm = render(<PlayerCombatAttackStatsTable stats={summaryFor(true)} />);
    expect(gm.container.textContent).not.toContain("Source:");
    expect(gm.container.textContent).not.toContain("Weapon2");
    expect(gm.container.textContent).not.toContain("A12:K12");
  });
});

/*
 * #771 phase-panel composition refinement. The Product Owner's multi-source case: Halgeir "Dunk"
 * Halgeirsson carrying a Medium metal shield, whose derived defensive modes are Primary `Dunk`
 * parry 9, Shield `Medium metal shield` parry 14, Combined `Sword / shield` parry 15 and Unarmed
 * `Brawling` parry 9.
 */
const parrySourceOptions = [
  {
    db: "12",
    dm: "−1",
    id: "Primary|Dunk",
    label: "Dunk · Primary",
    parry: "9",
    sourceName: "Dunk",
  },
  {
    db: "17",
    dm: "−1",
    id: "Shield|Medium metal shield",
    label: "Medium metal shield · Shield",
    parry: "14",
    sourceName: "Medium metal shield",
  },
  {
    db: "18",
    dm: "−1",
    id: "Combined|Sword / shield",
    label: "Sword / shield · Combined",
    parry: "15",
    sourceName: "Sword / shield",
  },
  {
    db: "11",
    dm: "−1",
    id: "Brawling|Brawling",
    label: "Brawling · Brawling",
    parry: "9",
    sourceName: "Brawling",
  },
];

const combinedDefenseStats = {
  db: "18",
  dm: "−1",
  parry: "15",
  sourceName: "Sword / shield",
};

function readDefenseRow(container: HTMLElement): string[] {
  const row = container.querySelector("tbody tr");
  return [...(row?.querySelectorAll("td") ?? [])].map((cell) => cell.textContent ?? "");
}

describe("PlayerCombatDefenseGroup", () => {
  it("offers every derived defensive mode in the mini-table's source cell and updates the values immediately", () => {
    const { container } = render(
      <PlayerCombatDefenseGroup
        defaultParrySourceId="Combined|Sword / shield"
        defenseStats={combinedDefenseStats}
        parrySourceOptions={parrySourceOptions}
        separatedFromAttack
        showParrySourceSelector
      >
        <div>Main hand</div>
      </PlayerCombatDefenseGroup>,
    );

    const selector = screen.getByRole("combobox", { name: "Parry source" });
    // The selector is inside the mini-table's source/name cell, as the first element of the row
    // that holds the DB/DM/P table.
    expect(selector.parentElement?.nextElementSibling?.tagName).toBe("TABLE");
    expect([...selector.querySelectorAll("option")].map((option) => option.textContent)).toEqual([
      "Dunk · Primary",
      "Medium metal shield · Shield",
      "Sword / shield · Combined",
      "Brawling · Brawling",
    ]);
    // It opens on what the unchanged derivation already displays.
    expect((selector as HTMLSelectElement).value).toBe("Combined|Sword / shield");
    expect(readDefenseRow(container)).toEqual(["18", "−1", "15"]);

    fireEvent.change(selector, { target: { value: "Shield|Medium metal shield" } });
    expect(readDefenseRow(container)).toEqual(["17", "−1", "14"]);
    expect(screen.getByRole("combobox", { name: "Parry source" })).toHaveValue(
      "Shield|Medium metal shield",
    );

    fireEvent.change(selector, { target: { value: "Primary|Dunk" } });
    expect(readDefenseRow(container)).toEqual(["12", "−1", "9"]);
  });

  it("names the source instead of offering a selector where the parry allocation does nothing", () => {
    const { container } = render(
      <PlayerCombatDefenseGroup
        defaultParrySourceId="Combined|Sword / shield"
        defenseStats={combinedDefenseStats}
        parrySourceOptions={parrySourceOptions}
        showParrySourceSelector={false}
      >
        <div>Main hand</div>
      </PlayerCombatDefenseGroup>,
    );

    expect(screen.queryByRole("combobox", { name: "Parry source" })).not.toBeInTheDocument();
    expect(container.textContent).toContain("Sword / shield");
    expect(readDefenseRow(container)).toEqual(["18", "−1", "15"]);
  });

  it("offers no selector when the character has a single defensive mode", () => {
    render(
      <PlayerCombatDefenseGroup
        defaultParrySourceId="Primary|Dunk"
        defenseStats={{ db: "12", dm: "−1", parry: "9", sourceName: "Dunk" }}
        parrySourceOptions={[parrySourceOptions[0]!]}
        showParrySourceSelector
      >
        <div>Main hand</div>
      </PlayerCombatDefenseGroup>,
    );

    expect(screen.queryByRole("combobox", { name: "Parry source" })).not.toBeInTheDocument();
    expect(screen.getByText("Dunk")).toBeInTheDocument();
  });

  it("draws one hairline above the group only when an Attack group renders above it", () => {
    const separated = render(
      <PlayerCombatDefenseGroup defenseStats={combinedDefenseStats} separatedFromAttack>
        <div>Main hand</div>
      </PlayerCombatDefenseGroup>,
    );
    const separatedGroup = separated.container.firstElementChild as HTMLElement;
    expect(separatedGroup.style.borderTop).toBe("1px solid #e3e1dc");
    // Top-aligned and internally packed, so slack falls at the bottom of the panel.
    expect(separatedGroup.style.alignContent).toBe("start");
    // The parry controls belong to this group: no hairline of their own, and no heading.
    expect(separated.container.querySelectorAll("[style*='border-top']")).toHaveLength(1);
    expect(separated.container.textContent).not.toContain("Parry context");
    cleanup();

    const alone = render(
      <PlayerCombatDefenseGroup defenseStats={combinedDefenseStats}>
        <div>Main hand</div>
      </PlayerCombatDefenseGroup>,
    );
    expect((alone.container.firstElementChild as HTMLElement).style.borderTop).toBe("");
  });

  it("keeps the group and its hairline when a committed defence review replaces the table", () => {
    const { container } = render(
      <PlayerCombatDefenseGroup
        committedReview={<div>Committed defense</div>}
        defaultParrySourceId="Combined|Sword / shield"
        defenseStats={combinedDefenseStats}
        parrySourceOptions={parrySourceOptions}
        separatedFromAttack
        showParrySourceSelector
      >
        <div>Main hand</div>
      </PlayerCombatDefenseGroup>,
    );

    // The GM's committed review replaces the DB/DM/P table and the parry controls, exactly as it
    // did before the recomposition. The group wrapper and its single hairline remain.
    expect(screen.getByText("Committed defense")).toBeInTheDocument();
    expect(container.querySelector("table")).toBeNull();
    expect(screen.queryByRole("combobox", { name: "Parry source" })).not.toBeInTheDocument();
    expect(container.textContent).not.toContain("Main hand");
    expect((container.firstElementChild as HTMLElement).style.borderTop).toBe("1px solid #e3e1dc");
  });

  /**
   * Forgejo #782, QA finding F1. A presentation choice of defensive mode must stop governing the
   * displayed DB/DM/P the moment the selector that made it is gone, and must not follow the panel
   * onto a different option set. Guarded against the vacuous read QA hit first: the defence row is
   * asserted to have exactly three cells, and the chosen row is asserted to differ from the
   * default before any "went back to the default" comparison is trusted.
   */
  describe("presentation selection lifetime (#782 F1)", () => {
    const brawlingRow = ["11", "−1", "9"];

    it("stops honouring the choice when the selector's gate closes, and resumes the derivation", () => {
      const { container, rerender } = render(
        <PlayerCombatDefenseGroup
          defaultParrySourceId="Combined|Sword / shield"
          defenseStats={combinedDefenseStats}
          parrySourceOptions={parrySourceOptions}
          showParrySourceSelector
        >
          <div>Main hand</div>
        </PlayerCombatDefenseGroup>,
      );

      const defaultRow = readDefenseRow(container);
      expect(defaultRow).toHaveLength(3);
      expect(defaultRow).toEqual(["18", "−1", "15"]);

      fireEvent.change(screen.getByRole("combobox", { name: "Parry source" }), {
        target: { value: "Brawling|Brawling" },
      });
      const chosenRow = readDefenseRow(container);
      expect(chosenRow).toHaveLength(3);
      // Guard: the choice must actually have moved the numbers, or the comparison below is empty.
      expect(chosenRow).not.toEqual(defaultRow);
      expect(chosenRow).toEqual(brawlingRow);
      expect(container.textContent).toContain("Brawling");

      // The declaration changes to one whose parry allocation does not reach the DB/Parry stack:
      // the selector is gone, so the choice must be gone with it.
      rerender(
        <PlayerCombatDefenseGroup
          defaultParrySourceId="Combined|Sword / shield"
          defenseStats={combinedDefenseStats}
          parrySourceOptions={parrySourceOptions}
          showParrySourceSelector={false}
        >
          <div>Main hand</div>
        </PlayerCombatDefenseGroup>,
      );
      expect(screen.queryByRole("combobox", { name: "Parry source" })).not.toBeInTheDocument();
      const gatedRow = readDefenseRow(container);
      expect(gatedRow).toHaveLength(3);
      expect(gatedRow).toEqual(defaultRow);
      expect(container.textContent).toContain("Sword / shield");
      expect(container.textContent).not.toContain("Brawling");
    });

    it("stops honouring the choice when the offered rows collapse to fewer than two", () => {
      // Binds the `options.length <= 1` arm of the gate specifically. The remaining single option
      // is deliberately the one that was chosen: that is the only configuration in which this arm
      // is observable at all, since a chosen id absent from the new set already falls back.
      const { container, rerender } = render(
        <PlayerCombatDefenseGroup
          defaultParrySourceId="Combined|Sword / shield"
          defenseStats={combinedDefenseStats}
          parrySourceOptions={parrySourceOptions}
          showParrySourceSelector
        >
          <div>Main hand</div>
        </PlayerCombatDefenseGroup>,
      );
      const defaultRow = readDefenseRow(container);
      expect(defaultRow).toHaveLength(3);
      expect(defaultRow).toEqual(["18", "\u22121", "15"]);

      fireEvent.change(screen.getByRole("combobox", { name: "Parry source" }), {
        target: { value: "Brawling|Brawling" },
      });
      const chosenRow = readDefenseRow(container);
      expect(chosenRow).toHaveLength(3);
      // Guard: the choice moved the numbers, so the fallback assertion below is not vacuous.
      expect(chosenRow).not.toEqual(defaultRow);
      expect(chosenRow).toEqual(brawlingRow);

      rerender(
        <PlayerCombatDefenseGroup
          defaultParrySourceId="Combined|Sword / shield"
          defenseStats={combinedDefenseStats}
          parrySourceOptions={[parrySourceOptions[3]!]}
          showParrySourceSelector
        >
          <div>Main hand</div>
        </PlayerCombatDefenseGroup>,
      );
      expect(screen.queryByRole("combobox", { name: "Parry source" })).not.toBeInTheDocument();
      const collapsedRow = readDefenseRow(container);
      expect(collapsedRow).toHaveLength(3);
      expect(collapsedRow).toEqual(defaultRow);
      expect(collapsedRow).not.toEqual(brawlingRow);
    });

    it("does not carry the choice onto another participant's identically named rows", () => {
      // Same option ids, different derived numbers: the next participant in the GM inspector.
      const otherParticipantOptions = parrySourceOptions.map((option) => ({
        ...option,
        db: `${Number(option.db) - 2}`,
        parry: `${Number(option.parry) - 2}`,
      }));
      const otherDefaultStats = {
        db: "16",
        dm: "−1",
        parry: "13",
        sourceName: "Sword / shield",
      };

      const { container, rerender } = render(
        <PlayerCombatDefenseGroup
          defaultParrySourceId="Combined|Sword / shield"
          defenseStats={combinedDefenseStats}
          parrySourceOptions={parrySourceOptions}
          showParrySourceSelector
        >
          <div>Main hand</div>
        </PlayerCombatDefenseGroup>,
      );
      const firstDefaultRow = readDefenseRow(container);
      expect(firstDefaultRow).toHaveLength(3);

      fireEvent.change(screen.getByRole("combobox", { name: "Parry source" }), {
        target: { value: "Brawling|Brawling" },
      });
      expect(readDefenseRow(container)).toEqual(brawlingRow);
      expect(readDefenseRow(container)).not.toEqual(firstDefaultRow);

      rerender(
        <PlayerCombatDefenseGroup
          defaultParrySourceId="Combined|Sword / shield"
          defenseStats={otherDefaultStats}
          parrySourceOptions={otherParticipantOptions}
          showParrySourceSelector
        >
          <div>Main hand</div>
        </PlayerCombatDefenseGroup>,
      );
      const otherRow = readDefenseRow(container);
      expect(otherRow).toHaveLength(3);
      // The second participant's own default, not their Brawling row (["9", "−1", "7"]).
      expect(otherRow).toEqual(["16", "−1", "13"]);
      expect(otherRow).not.toEqual(["9", "−1", "7"]);
      expect(screen.getByRole("combobox", { name: "Parry source" })).toHaveValue(
        "Combined|Sword / shield",
      );
    });

    it("keeps the choice while the same option set is still offered", () => {
      const { container, rerender } = render(
        <PlayerCombatDefenseGroup
          defaultParrySourceId="Combined|Sword / shield"
          defenseStats={combinedDefenseStats}
          parrySourceOptions={parrySourceOptions}
          showParrySourceSelector
        >
          <div>Main hand</div>
        </PlayerCombatDefenseGroup>,
      );
      fireEvent.change(screen.getByRole("combobox", { name: "Parry source" }), {
        target: { value: "Brawling|Brawling" },
      });
      expect(readDefenseRow(container)).toEqual(brawlingRow);

      // A re-render with an equal-but-not-identical option array must not reset the choice.
      rerender(
        <PlayerCombatDefenseGroup
          defaultParrySourceId="Combined|Sword / shield"
          defenseStats={{ ...combinedDefenseStats }}
          parrySourceOptions={parrySourceOptions.map((option) => ({ ...option }))}
          showParrySourceSelector
        >
          <div>Main hand</div>
        </PlayerCombatDefenseGroup>,
      );
      expect(readDefenseRow(container)).toEqual(brawlingRow);
    });
  });
});

describe("PlayerCombatAttackStatsTable source cell", () => {
  it("carries the source and mode controls in the source/name cell, replacing the static name", () => {
    const stats = {
      attackMode: "C",
      dmb: "7",
      initiative: "4",
      maxCrits: "FS",
      ob: "12",
      weaponName: "Dunk",
    };
    const { container } = render(
      <PlayerCombatAttackStatsTable
        modeSelector={
          <PlayerCombatAttackModeSelector
            onChange={() => {}}
            options={[
              { id: "mode-1", label: "Slash" },
              { id: "mode-2", label: "Thrust" },
            ]}
            selectedAttackModeId="mode-1"
            variant="cell"
          />
        }
        sourceSelector={
          <PlayerCombatAttackSourceSelector
            onChange={() => {}}
            options={[
              { id: "weapon:dunk", label: "Dunk · Primary" },
              { id: "unarmed:punch", label: "Punch · Unarmed" },
            ]}
            selectedAttackSourceId="weapon:dunk"
            variant="cell"
          />
        }
        stats={stats}
      />,
    );

    const source = screen.getByRole("combobox", { name: "Attack source" });
    const mode = screen.getByRole("combobox", { name: "Attack mode" });
    // Both controls sit in the same cell, beside each other, and that cell precedes the table.
    expect(source.parentElement).toBe(mode.parentElement);
    expect(source.parentElement?.nextElementSibling?.tagName).toBe("TABLE");
    // The selected option names the source, so the cell still reads as the source name.
    expect((source as HTMLSelectElement).value).toBe("weapon:dunk");
    expect(container.querySelector("strong")).toBeNull();
    // The mini-table's own cells are unchanged: I, OB, DMB, AM, MC.
    expect(readDefenseRow(container)).toEqual(["4", "12", "7", "C", "FS"]);
  });

  it("names a single mode instead of offering a mode selector that cannot change anything", () => {
    render(
      <PlayerCombatAttackStatsTable
        modeSelector={
          <PlayerCombatAttackModeSelector
            onChange={() => {}}
            options={[{ id: "mode-1", label: "Strike" }]}
            selectedAttackModeId="mode-1"
            variant="cell"
          />
        }
        stats={{
          attackMode: "A",
          dmb: "0",
          initiative: "0",
          maxCrits: "AC",
          ob: "1",
          weaponName: "Punch",
        }}
      />,
    );

    expect(screen.queryByRole("combobox", { name: "Attack mode" })).not.toBeInTheDocument();
    expect(screen.getByText("Strike")).toBeInTheDocument();
    // With no source selector the cell keeps naming the source.
    expect(screen.getByText("Punch")).toBeInTheDocument();
  });
});

describe("PlayerCombatAttackSourceSelector remembered-source gate (#785)", () => {
  const dunk = { id: "weapon:dunk", label: "Dunk · Primary" };
  const punch = { id: "unarmed:punch", label: "Punch · Unarmed" };

  it("renders an attack source that is in the currently derived legal option set", () => {
    render(
      <PlayerCombatAttackSourceSelector
        onChange={() => {}}
        options={[dunk, punch]}
        selectedAttackSourceId={punch.id}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Attack source" }) as HTMLSelectElement;
    expect(select.value).toBe(punch.id);
    // No placeholder is offered for an available source, so the gate is not simply off.
    expect(Array.from(select.options).map((option) => option.value)).toHaveLength(2);
    expect(screen.queryByRole("option", { name: "Select attack source" })).not.toBeInTheDocument();
  });

  it("does not render a remembered attack source that left the legal option set", () => {
    // The remembered id names no option here, and a <select> whose value matches no <option>
    // displays the FIRST option. Guard that the unrepaired reading and the required reading are
    // genuinely different values, so neither assertion below can pass by coincidence.
    const options = [dunk, punch];
    const rememberedId = "weapon:shield-bash";
    expect(options.map((option) => option.id)).toHaveLength(2);
    expect(options.some((option) => option.id === rememberedId)).toBe(false);
    expect(options[0].id).not.toBe("");

    render(
      <PlayerCombatAttackSourceSelector
        onChange={() => {}}
        options={options}
        selectedAttackSourceId={rememberedId}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Attack source" }) as HTMLSelectElement;
    // Not the first option, and not the remembered id: nothing is shown as selected.
    expect(select.value).toBe("");
    expect(select.value).not.toBe(options[0].id);
    expect(select.value).not.toBe(rememberedId);
    // The placeholder must not be suppressed by an id that names no available option.
    const optionValues = Array.from(select.options).map((option) => option.value);
    expect(optionValues).toHaveLength(3);
    expect(optionValues[0]).toBe("");
    expect(screen.getByRole("option", { name: "Select attack source" })).toBeInTheDocument();
  });

  it("stops and resumes rendering a remembered source as it leaves and re-enters the option set", () => {
    // The ruling permits the memory to survive; only rendering is gated. The caller keeps passing
    // the same id throughout, so this measures the gate rather than any erasure.
    const { rerender } = render(
      <PlayerCombatAttackSourceSelector
        onChange={() => {}}
        options={[dunk, punch]}
        selectedAttackSourceId={punch.id}
      />,
    );
    const read = () =>
      (screen.getByRole("combobox", { name: "Attack source" }) as HTMLSelectElement).value;
    expect(read()).toBe(punch.id);

    rerender(
      <PlayerCombatAttackSourceSelector
        onChange={() => {}}
        options={[dunk]}
        selectedAttackSourceId={punch.id}
      />,
    );
    expect(read()).toBe("");
    expect(read()).not.toBe(dunk.id);

    rerender(
      <PlayerCombatAttackSourceSelector
        onChange={() => {}}
        options={[dunk, punch]}
        selectedAttackSourceId={punch.id}
      />,
    );
    expect(read()).toBe(punch.id);
  });

  it("names no attack source in the read-only presentation paths when the source is unavailable", () => {
    const { container, rerender } = render(
      <PlayerCombatAttackSourceSelector
        onChange={() => {}}
        options={[dunk, punch]}
        readOnly
        selectedAttackSourceId="weapon:shield-bash"
        variant="cell"
      />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("No attack source");
    expect(screen.queryByText(punch.label)).not.toBeInTheDocument();
    expect(screen.queryByText(dunk.label)).not.toBeInTheDocument();

    rerender(
      <PlayerCombatAttackSourceSelector
        onChange={() => {}}
        options={[dunk, punch]}
        readOnly
        selectedAttackSourceId={dunk.id}
        variant="cell"
      />,
    );
    expect(container.querySelector("strong")?.textContent).toBe(dunk.label);
  });

  it("gates a filtered option set: an unarmed resolved source cannot name a weapon the player holds", () => {
    // The weapon-feint control at ScenarioPlayerCombatPageContent.tsx filters the derived options
    // to sourceKind "weapon" while passing the unfiltered resolved source id, so an unarmed
    // resolution reaches a weapon-only option set. That is a props-level route into the state this
    // issue is about, with no remembered draft involved.
    const weaponOnly = [
      { id: dunk.id, label: dunk.label, slot: "primary" as const, sourceKind: "weapon" as const },
    ];
    render(
      <PlayerCombatAttackSourceSelector
        emptyState="No ready weapon can perform a weapon feint."
        onChange={() => {}}
        options={weaponOnly}
        selectedAttackSourceId={punch.id}
      />,
    );

    const select = screen.getByRole("combobox", { name: "Attack source" }) as HTMLSelectElement;
    expect(weaponOnly).toHaveLength(1);
    expect(select.value).toBe("");
    expect(select.value).not.toBe(dunk.id);
    expect(Array.from(select.options).map((option) => option.value)).toHaveLength(2);
  });
});
