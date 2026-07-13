import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PlayerCombatModifierPanel } from "./PlayerCombatPanels";

afterEach(() => {
  cleanup();
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
    expect(screen.queryByLabelText("Initiative modifier value", { selector: "input[value='2']" }))
      .not.toBeInTheDocument();
    expect(screen.getByDisplayValue("1")).not.toBeDisabled();

    fireEvent.change(screen.getByDisplayValue("1"), { target: { value: "3" } });
    fireEvent.click(screen.getByLabelText("Remove modifier"));

    expect(onUpdateEntry).toHaveBeenCalledWith("situation_initiative", "manual-initiative", {
      value: 3,
    });
    expect(onRemoveEntry).toHaveBeenCalledWith("situation_initiative", "manual-initiative");
  });
});
