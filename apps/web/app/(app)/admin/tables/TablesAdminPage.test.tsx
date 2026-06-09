// @vitest-environment happy-dom

import { render, screen, within } from "@testing-library/react";
import { createElement } from "react";
import { describe, expect, it } from "vitest";

import TablesAdminPage from "./TablesAdminPage";

describe("TablesAdminPage", () => {
  it("renders the canonical combat to-hit table from structured rule data", () => {
    render(createElement(TablesAdminPage));

    const heading = screen.getByRole("heading", { name: "Glantri Combat To Hit / Damage" });
    const panel = heading.closest("section");

    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).queryByText("Open-ended 1d20")).not.toBeNull();
    expect(within(panel as HTMLElement).queryByText("Roll open-ended 1d20.")).not.toBeNull();
    expect(within(panel as HTMLElement).queryByText("Add the roll total to OB minus DB.")).not.toBeNull();
    expect(
      within(panel as HTMLElement).queryByText("Hit lookup total = OB - DB + open-ended roll total."),
    ).not.toBeNull();
    expect(
      within(panel as HTMLElement).queryByText(
        "Normal hit damage uses a second lookup: hit lookup total + weapon DMB + defender DM + armor modifier.",
      ),
    ).not.toBeNull();
    expect(
      within(panel as HTMLElement).queryByText(
        "Grazing damage rolls 1d of the table damage from lookup 12 plus the same DMB, DM, and armor modifier.",
      ),
    ).not.toBeNull();
    expect(
      within(panel as HTMLElement).queryByText(
        "Hit location and armor modifier are resolved in later damage steps.",
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

    expect(bodyRows.slice(0, 3)).toEqual([
      ["<= 10", "Miss", "No", "No", "—", "—", "—", "—"],
      ["11", "Grazing hit", "Yes", "Yes", "1d reference damage", "—", "—", "—"],
      ["12", "Hit", "Yes", "No", "1", "—", "—", "—"],
    ]);
    expect(bodyRows).toContainEqual(["17", "Hit", "Yes", "No", "4", "—", "—", "—"]);
    expect(bodyRows).toContainEqual(["18", "Hit", "Yes", "No", "5", "—", "—", "—"]);
    expect(bodyRows).toContainEqual(["20", "Hit", "Yes", "No", "7", "A", "—", "—"]);
    expect(bodyRows).toContainEqual(["22", "Hit", "Yes", "No", "9", "B", "1", "—"]);
    expect(bodyRows.at(-1)).toEqual([
      ">= 35",
      "Hit",
      "Yes",
      "No",
      "Lookup - 13",
      "F",
      "5",
      "max damage: 17 + GM STR when relevant",
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
