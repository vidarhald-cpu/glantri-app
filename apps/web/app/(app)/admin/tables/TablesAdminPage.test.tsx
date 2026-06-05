// @vitest-environment happy-dom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TablesAdminPage from "./TablesAdminPage";

describe("TablesAdminPage", () => {
  it("renders the canonical combat to-hit table from structured rule data", () => {
    render(<TablesAdminPage />);

    const heading = screen.getByRole("heading", { name: "Combat To Hit" });
    const panel = heading.closest("section");

    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByText("Closed 1d20")).toBeInTheDocument();
    expect(
      within(panel as HTMLElement).getByText("Sheet: to hit (new)"),
    ).toBeInTheDocument();
    expect(
      within(panel as HTMLElement).getByText("docs/source/combat/New Combat Arena.xlsx"),
    ).toBeInTheDocument();
    expect(
      within(panel as HTMLElement).getByText("Lookup total = OB - DB + roll."),
    ).toBeInTheDocument();
    expect(
      within(panel as HTMLElement).getByText(
        "Damage, critical, and minimum-damage columns from the workbook are deferred because duplicate 17/18 rows need clarification.",
      ),
    ).toBeInTheDocument();

    const rows = within(panel as HTMLElement).getAllByRole("row");
    const bodyRows = rows.slice(1).map((row) =>
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    );

    expect(bodyRows).toEqual([
      ["<= 10", "Miss", "No", "No", "to hit (new)!A3:B4"],
      ["11", "Grazing hit", "Yes", "Yes", "to hit (new)!A5:B5"],
      [">= 12", "Hit", "Yes", "No", "to hit (new)!A6:B29"],
    ]);
  });

  it("renders the canonical combat hit-location table from structured rule data", () => {
    render(<TablesAdminPage />);

    const heading = screen.getByRole("heading", { name: "Combat Hit Location" });
    const panel = heading.closest("section");

    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getByText("Combat")).toBeInTheDocument();
    expect(within(panel as HTMLElement).getByText("Closed 1d20")).toBeInTheDocument();
    expect(
      within(panel as HTMLElement).getByText(
        "If an attacker aims at a location, roll closed 1d20 twice and use the roll closest to the aimed location.",
      ),
    ).toBeInTheDocument();

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
