// @vitest-environment happy-dom

import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import TablesAdminPage from "./TablesAdminPage";

describe("TablesAdminPage", () => {
  it("renders the canonical combat to-hit table from structured rule data", () => {
    render(createElement(TablesAdminPage));

    const heading = screen.getByRole("heading", { name: "Combat To Hit" });
    const panel = heading.closest("section");

    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).queryByText("Open-ended 1d20")).not.toBeNull();
    expect(within(panel as HTMLElement).queryByText("Roll open-ended 1d20.")).not.toBeNull();
    expect(within(panel as HTMLElement).queryByText("Add the roll total to OB minus DB.")).not.toBeNull();
    expect(
      within(panel as HTMLElement).queryByText("Lookup total = OB - DB + open-ended roll total."),
    ).not.toBeNull();
    expect(
      within(panel as HTMLElement).queryByText(
        "Damage and critical details are separate and will be added later.",
      ),
    ).not.toBeNull();
    expect(within(panel as HTMLElement).queryByText("Sheet: to hit (new)")).toBeNull();
    expect(within(panel as HTMLElement).queryByText(/New[_ ]Combat[_ ]Arena\.xlsx/)).toBeNull();

    const rows = within(panel as HTMLElement).getAllByRole("row");
    const bodyRows = rows.slice(1).map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

    expect(bodyRows).toEqual([
      ["<= 10", "Miss", "No", "No"],
      ["11", "Grazing hit", "Yes", "Yes"],
      [">= 12", "Hit", "Yes", "No"],
    ]);
  });

  it("renders the canonical combat hit-location table from structured rule data", () => {
    render(createElement(TablesAdminPage));

    const heading = screen.getByRole("heading", { name: "Combat Hit Location" });
    const panel = heading.closest("section");

    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).queryByText("Combat")).not.toBeNull();
    expect(within(panel as HTMLElement).queryByText("Closed 1d20")).not.toBeNull();
    expect(
      within(panel as HTMLElement).queryByText(
        "If an attacker aims at a location, roll closed 1d20 twice and use the roll closest to the aimed location.",
      ),
    ).not.toBeNull();

    const rows = within(panel as HTMLElement).getAllByRole("row");
    const bodyRows = rows.slice(1).map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

    expect(bodyRows.slice(0, 3)).toEqual([
      ["20", "Head", "Head", "head"],
      ["19", "Head", "Head", "head"],
      ["18", "Right arm", "R arm", "rightArm"],
    ]);
    expect(bodyRows.at(-1)).toEqual(["1", "Left leg", "L leg", "leftLeg"]);
  });
});
