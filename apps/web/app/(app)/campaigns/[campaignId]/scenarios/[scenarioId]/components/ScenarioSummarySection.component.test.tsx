import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ScenarioSummarySection } from "./ScenarioSummarySection";

afterEach(() => cleanup());

function renderSummary(status: "archived" | "completed" | "live") {
  return render(
    <ScenarioSummarySection
      onDescriptionChange={vi.fn()}
      onNameChange={vi.fn()}
      onStatusChange={vi.fn()}
      onUpdate={vi.fn()}
      scenarioDescription="An approved record"
      scenarioName="The Northern March"
      scenarioStatus={status}
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

  it("retains scenario editing controls for an Active summary", () => {
    renderSummary("live");

    expect(screen.getByRole("textbox", { name: "Name" })).toBeEnabled();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeEnabled();
    expect(screen.getByRole("combobox", { name: "Status" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Update scenario" })).toBeEnabled();
  });
});
