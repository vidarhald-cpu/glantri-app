// @vitest-environment happy-dom

import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import TablesAdminPage from "./TablesAdminPage";

describe("TablesAdminPage", () => {
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
