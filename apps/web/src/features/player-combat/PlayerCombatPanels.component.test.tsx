import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PlayerCombatActionButtonPanel,
  PlayerCombatActionSelectorPanel,
  PlayerCombatAttackModeSelector,
  PlayerCombatModifierPanel,
  PlayerCombatObservationProgress,
  PlayerCombatOpponentSelector,
} from "./PlayerCombatPanels";

afterEach(() => {
  cleanup();
});

describe("PlayerCombatActionSelectorPanel", () => {
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

    expect(screen.getByRole("option", { name: "Choose action" })).toBeInTheDocument();
    expect(screen.getByText("Action declared.")).toBeInTheDocument();
    expect(
      Array.from(
        (screen.getByRole("combobox", { name: "Secondary action" }) as HTMLSelectElement).options,
      ).map((option) => option.text),
    ).toEqual(["Open"]);
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
    const movement = screen.getByRole("combobox", { name: "Movement" }) as HTMLSelectElement;
    expect(Array.from(primary.options).some((option) => option.text === "Parry")).toBe(true);
    expect(Array.from(primary.options).some((option) => option.text === "Observe Opponent")).toBe(
      false,
    );
    expect(Array.from(secondary.options).map((option) => option.text)).toEqual([
      "None",
      "Observe opponent",
    ]);
    expect(secondary.value).toBe("");
    fireEvent.change(secondary, { target: { value: "observe_opponent" } });
    expect(onSecondaryActionChange).toHaveBeenCalledWith("observe_opponent");
    expect(movement.value).toBe("hold_position");
    expect(screen.queryByText("Focus on defense for this round.", { exact: false })).toBeNull();
    expect(
      screen.queryByText("Parry assumes sufficient room to maneuver.", { exact: false }),
    ).toBeNull();
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
    expect(Array.from(primary.options).map((option) => option.value)).not.toContain("disarm");

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
