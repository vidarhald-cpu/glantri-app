import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  PlayerCombatActionButtonPanel,
  PlayerCombatActionSelectorPanel,
  PlayerCombatAttackModeSelector,
  PlayerCombatModifierPanel,
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
  });

  it("renders the canonical Offensive Parry opponent selector used by GM and Player Combat", () => {
    const onSelectedOpponentChange = vi.fn();
    render(
      <PlayerCombatActionSelectorPanel
        actionId="offensive_parry"
        additionalActionNotes=""
        movementId="hold"
        onActionChange={vi.fn()}
        onAdditionalActionNotesChange={vi.fn()}
        onMovementChange={vi.fn()}
        onSelectedOpponentChange={onSelectedOpponentChange}
        onSecondaryActionChange={vi.fn()}
        opponentOptions={[
          { displayName: "Borin", id: "encounter-participant-borin" },
          { displayName: "Cora", id: "encounter-participant-cora" },
        ]}
        secondaryActionId=""
        selectedOpponentId="encounter-participant-borin"
      />,
    );

    const selector = screen.getByRole("combobox", { name: "Opponent to counter" });
    expect(selector).toHaveValue("encounter-participant-borin");
    fireEvent.change(selector, { target: { value: "encounter-participant-cora" } });
    expect(onSelectedOpponentChange).toHaveBeenCalledWith("encounter-participant-cora");
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
  it("renders player modifier rows with readable source, mod, duration, and details lines", () => {
    render(
      <PlayerCombatModifierPanel
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

    expect(screen.getByText("Source/scope")).toBeInTheDocument();
    expect(screen.getByText("Mod")).toBeInTheDocument();
    expect(screen.getByText("Dur")).toBeInTheDocument();
    expect(screen.getByText("Details")).toBeInTheDocument();
    expect(screen.getByText("Situational")).toBeInTheDocument();
    expect(screen.getAllByText("-2")).toHaveLength(2);
    expect(screen.getByText("P1")).toBeInTheDocument();
    expect(screen.getByText("long distance")).toBeInTheDocument();
    expect(screen.queryByText(/Broad sword preferred 2/)).not.toBeInTheDocument();
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
  it("renders the canonical context and invokes the immutable descriptor", () => {
    const onAction = vi.fn();
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
      />,
    );

    expect(screen.getByText("Phase 1")).toBeInTheDocument();
    expect(screen.getByText("Aria is attacking Borin.")).toBeInTheDocument();
    expect(screen.getByText("Weapon: Long Sword")).toBeInTheDocument();
    expect(screen.getByText("Roll attack.")).toBeInTheDocument();
    expect(screen.queryByText(/^Reason:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Next:/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Roll attack" }));
    expect(onAction).toHaveBeenCalledWith(descriptor);
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
