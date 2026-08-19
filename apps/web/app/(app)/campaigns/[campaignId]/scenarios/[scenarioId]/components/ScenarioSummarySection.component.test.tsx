import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScenarioSummarySection } from "./ScenarioSummarySection";

describe("Scenario lifecycle controls", () => {
  afterEach(() => cleanup());

  it("requires warning acceptance and a reason before starting", async () => {
    const user = userEvent.setup();
    const onLifecycleAction = vi.fn();
    render(
      <ScenarioSummarySection
        availableLifecycleActions={["start", "archive"]}
        lifecyclePending={false}
        onDescriptionChange={vi.fn()}
        onLifecycleAction={onLifecycleAction}
        onNameChange={vi.fn()}
        onUpdate={vi.fn()}
        scenarioDescription=""
        scenarioName="The Crossing"
        scenarioStatus="draft"
        startPreflight={{
          blockers: [],
          ready: true,
          warnings: [
            {
              code: "no_active_player_participants",
              message: "No active player characters are assigned to this Scenario.",
            },
          ],
        }}
      />,
    );

    const start = screen.getByRole("button", { name: "Start Scenario" });
    expect(start).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Reason for lifecycle action"), "Begin play");
    await user.click(
      screen.getByRole("checkbox", {
        name: "Accept warning: No active player characters are assigned to this Scenario.",
      }),
    );
    await user.click(start);

    expect(onLifecycleAction).toHaveBeenCalledWith({
      acceptedWarningCodes: ["no_active_player_participants"],
      action: "start",
      reason: "Begin play",
    });
  });

  it("shows only allowed actions for the current state", () => {
    render(
      <ScenarioSummarySection
        availableLifecycleActions={["reopen", "archive"]}
        lifecyclePending={false}
        onDescriptionChange={vi.fn()}
        onLifecycleAction={vi.fn()}
        onNameChange={vi.fn()}
        onUpdate={vi.fn()}
        scenarioDescription="Complete"
        scenarioName="The Crossing"
        scenarioStatus="closed"
      />,
    );

    expect(screen.getByText("Status: Closed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reopen for play" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Resume" })).not.toBeInTheDocument();
  });
});
