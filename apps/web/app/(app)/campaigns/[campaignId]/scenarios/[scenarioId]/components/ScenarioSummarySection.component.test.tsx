import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Scenario } from "@glantri/domain";

import { ScenarioSummarySection } from "./ScenarioSummarySection";

afterEach(() => cleanup());

function renderSummary(
  status: "archived" | "completed" | "live",
  selectedStatus: Scenario["status"] = status,
  onStatusChange = vi.fn(),
) {
  return render(
    <ScenarioSummarySection
      onDescriptionChange={vi.fn()}
      onNameChange={vi.fn()}
      onStatusChange={onStatusChange}
      onUpdate={vi.fn()}
      scenarioDescription="An approved record"
      scenarioName="The Northern March"
      scenarioStatus={status}
      selectedStatus={selectedStatus}
    />,
  );
}

describe("ScenarioSummarySection", () => {
  it("renders archived summaries as read-only", () => {
    renderSummary("archived");

    expect(screen.getByRole("textbox", { name: "Name" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeDisabled();
    expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Scenario status")).toHaveTextContent("Archived");
    expect(screen.getByRole("button", { name: "Update scenario" })).toBeDisabled();
  });

  it("keeps only the Closed to Archived lifecycle control available", () => {
    renderSummary("completed");

    expect(screen.getByRole("textbox", { name: "Name" })).toBeDisabled();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveTextContent("ClosedArchived");
    expect(screen.getByRole("button", { name: "Update scenario" })).toBeEnabled();
  });

  it("keeps the archive step performable after Archived has been selected", () => {
    // The persisted status stays `completed` until the update is saved, so selecting
    // Archived must not disable the control that performs the transition. Deriving
    // this from the pending selection is what made the step unreachable.
    const onStatusChange = vi.fn();
    renderSummary("completed", "archived", onStatusChange);

    const statusSelect = screen.getByRole("combobox", { name: "Status" });

    expect(statusSelect).toHaveValue("archived");
    expect(statusSelect).toBeEnabled();
    expect(screen.getByRole("button", { name: "Update scenario" })).toBeEnabled();

    fireEvent.change(statusSelect, { target: { value: "archived" } });
    expect(screen.getByRole("button", { name: "Update scenario" })).toBeEnabled();
  });

  it("offers no lifecycle step out of the absorbing Archived status", () => {
    renderSummary("archived");

    // `scenarioLifecycleTransitions.archived` is empty, so the only entry is the
    // current status and the control collapses to a readout.
    expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
  });

  it("offers only the domain-permitted next steps for a non-terminal summary", () => {
    renderSummary("live");

    const offered = Array.from(
      screen.getByRole("combobox", { name: "Status" }).querySelectorAll("option"),
    ).map((option) => (option as HTMLOptionElement).value);

    // `live` may only be paused. It may not be closed or archived directly, and the
    // control must not offer a step the domain refuses.
    expect(offered).toEqual(["live", "paused"]);
  });

  it("retains scenario editing controls for an Active summary", () => {
    renderSummary("live");

    expect(screen.getByRole("textbox", { name: "Name" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Update scenario" })).toBeEnabled();
  });
});
