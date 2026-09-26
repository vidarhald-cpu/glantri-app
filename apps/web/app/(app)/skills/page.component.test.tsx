// @vitest-environment happy-dom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SkillsReferencePage from "./page";
import AdminSkillReferencePage from "../admin/skills/reference/page";

const mocks = vi.hoisted(() => ({
  session: {
    currentUser: { id: "reader", roles: ["player"] } as { id: string; roles: string[] } | null,
    loading: false,
  },
}));
vi.mock("@/lib/auth/SessionUserContext", () => ({ useSessionUser: () => mocks.session }));
beforeEach(() => {
  mocks.session.currentUser = { id: "reader", roles: ["player"] };
  window.history.replaceState(null, "", "/skills");
});

describe("player competency reference", () => {
  it.each(["player", "game_master", "admin"])("is available to an authenticated %s", (role) => {
    mocks.session.currentUser = { id: role, roles: [role] };
    render(<SkillsReferencePage />);
    expect(screen.getByRole("heading", { name: "Skills and training" })).toBeVisible();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Skills",
      "Learning Groups",
      "Professions",
      "Societies",
      "How it works",
    ]);
  });

  it("requires login while the Admin reader requires Admin role", () => {
    mocks.session.currentUser = null;
    const { unmount } = render(<SkillsReferencePage />);
    expect(screen.getByRole("heading", { name: "Login required" })).toBeVisible();
    unmount();
    mocks.session.currentUser = { id: "reader", roles: ["player"] };
    render(<AdminSkillReferencePage />);
    expect(screen.getByRole("heading", { name: "Admin access required" })).toBeVisible();
  });

  it("gives every catalogue a compact table whose row selection opens the Inspector", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    for (const [tab, caption] of [
      ["Skills", /competencies$/],
      ["Learning Groups", /Learning Groups$/],
      ["Professions", /Professions$/],
      ["Societies", /Societies$/],
    ] as const) {
      await user.click(screen.getByRole("tab", { name: tab }));
      const table = screen.getByRole("table", { name: caption });
      expect(within(table).getAllByRole("row").length).toBeGreaterThan(1);
    }
    await user.click(screen.getByRole("tab", { name: "Professions" }));
    const table = screen.getByRole("table", { name: /Professions$/ });
    const row = within(table).getByRole("button", { name: "Soldier" });
    await user.click(row);
    expect(screen.getByRole("heading", { name: "Soldier", level: 2 })).toHaveFocus();
  });

  it("searches canonical Skills and follows a Learning Group link", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    await user.type(
      screen.getByRole("searchbox", { name: "Search Skills, languages, and writing" }),
      "Falconry",
    );
    expect(screen.getByRole("table", { name: /^1 of \d+ competencies$/ })).toBeVisible();
    const groupSection = screen.getByRole("heading", {
      name: /^Learning Groups: [1-9]/,
      level: 3,
    }).parentElement!;
    const group = within(groupSection).getAllByRole("link")[0]!;
    const groupName = group.textContent!;
    await user.click(group);
    expect(screen.getByRole("tab", { name: "Learning Groups" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("heading", { name: groupName, level: 2 })).toHaveFocus();
  });

  it("keeps search and filter state across Skill, Learning Group and Profession traversal", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    const skillSearch = screen.getByRole("searchbox", {
      name: "Search Skills, languages, and writing",
    });
    await user.selectOptions(screen.getByRole("combobox", { name: "Competency type" }), "Skill");
    await user.type(skillSearch, "Falconry");
    const groupSection = screen.getByRole("heading", {
      name: /^Learning Groups: [1-9]/,
      level: 3,
    }).parentElement!;
    await user.click(within(groupSection).getAllByRole("link")[0]!);

    const groupSearch = screen.getByRole("searchbox", {
      name: "Search Learning Groups or members",
    });
    await user.type(groupSearch, "falcon");
    const professionSection = screen.getByRole("heading", {
      name: /^Where it is used/,
    }).parentElement!;
    await user.click(within(professionSection).getAllByRole("link")[0]!);
    expect(screen.getByRole("tab", { name: "Professions" })).toHaveAttribute(
      "aria-selected",
      "true",
    );

    await user.click(screen.getByRole("tab", { name: "Learning Groups" }));
    expect(
      screen.getByRole("searchbox", { name: "Search Learning Groups or members" }),
    ).toHaveValue("falcon");
    await user.click(screen.getByRole("tab", { name: "Skills" }));
    expect(
      screen.getByRole("searchbox", { name: "Search Skills, languages, and writing" }),
    ).toHaveValue("Falconry");
    expect(screen.getByRole("combobox", { name: "Competency type" })).toHaveValue("Skill");
  });

  it("opens a Profession with its description and the deduplicated reachable Skill list", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    await user.click(screen.getByRole("tab", { name: "Professions" }));
    const search = screen.getByRole("searchbox", {
      name: "Search Professions, tracks, or training",
    });
    await user.type(search, "Carpenter");
    const inspector = screen.getByRole("heading", { name: "Carpenter", level: 2 })
      .parentElement as HTMLElement;
    /* Step 1 explains the occupation. A route count is not the headline. */
    const lede = within(inspector).getByRole("heading", { name: "Carpenter" })
      .nextElementSibling as HTMLElement;
    expect(lede.textContent).not.toMatch(/training routes/);
    expect(within(inspector).getByRole("heading", { name: "What can I learn?" })).toBeVisible();
    expect(
      within(inspector).getByRole("heading", { name: /^Skills this Profession can train/ }),
    ).toBeVisible();
    /* Effective breadth is stated; possible reach is reported separately and never substituted. */
    expect(within(inspector).getByText(/effective base Skills/)).toBeVisible();
    expect(within(inspector).getByText(/possible reach, not effective breadth/)).toBeVisible();
    /* Narrative route order, with the taught choice inside its own route in reader language. */
    const order = within(inspector)
      .getAllByRole("heading", { level: 4 })
      .map((heading) => heading.textContent);
    expect(order).toEqual(["Core training", "Additional training routes", "Direct training"]);
    expect(within(inspector).getAllByText(/Choose one taught craft/).length).toBeGreaterThan(0);
    expect(within(inspector).queryByText(/choice slot/i)).toBeNull();
  });

  it("says so when a Learning Group has no published full description", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    await user.click(screen.getByRole("tab", { name: "Learning Groups" }));
    await user.type(
      screen.getByRole("searchbox", { name: "Search Learning Groups or members" }),
      "Small-craft boat working",
    );
    await user.click(screen.getByRole("button", { name: "Small-craft boat working" }));
    const inspector = screen.getByRole("heading", { name: "Small-craft boat working", level: 2 })
      .parentElement as HTMLElement;
    expect(
      within(inspector).getByText(
        /A full description of this training practice has not been published/,
      ),
    ).toBeVisible();
    expect(
      within(inspector).getByText("Working an open boat: handling, lines, water and weather."),
    ).toBeVisible();
    expect(
      screen.getByText(/44 of 95 Learning Groups have a published full description/),
    ).toBeVisible();
  });

  it("reads a groupless competency as Learning Groups: 0 with an explanation", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    await user.selectOptions(screen.getByRole("combobox", { name: "Training route" }), "groupless");
    const table = screen.getByRole("table", { name: /competencies$/ });
    for (const row of within(table).getAllByRole("row").slice(1))
      expect(within(row).getAllByRole("cell")[3]!.textContent).toBe("0");
    await user.click(within(table).getByRole("button", { name: "Poisons" }));
    expect(screen.getByRole("heading", { name: "Learning Groups: 0", level: 3 })).toBeVisible();
    expect(
      screen.getByText(/No Learning Group teaches this competency, so there is no Learning Group/),
    ).toBeVisible();
  });

  it("puts the Access Overview matrix last and marks unauthored Society Levels", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    await user.click(screen.getByRole("tab", { name: "Learning Groups" }));
    const matrix = screen.getByRole("table", { name: "Society Level by Social Band" });
    expect(
      within(matrix)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual([
      "Society Level",
      "Common Folk",
      "Trades and Guilds",
      "Established Households",
      "Court and Elite",
    ]);
    expect(within(matrix).getAllByText("Not yet authored")).toHaveLength(3);
    const inspector = screen.getByRole("heading", {
      name: "Access Overview",
      level: 3,
    }).parentElement!;
    expect(inspector.parentElement!.lastElementChild).toBe(inspector);
  });

  it("keeps retired Groups and groupless diagnostics out of the player catalogue", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    await user.click(screen.getByRole("tab", { name: "Learning Groups" }));
    expect(screen.queryByText(/Retired Learning Groups/)).toBeNull();
    expect(screen.queryByText(/Skills without a Learning Group/)).toBeNull();
    expect(screen.queryByText(/^Audit —/)).toBeNull();
  });

  it("supports keyboard tabs and states the authored availability ceiling", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    const skills = screen.getByRole("tab", { name: "Skills" });
    skills.focus();
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "How it works" })).toHaveFocus();
    expect(
      screen.getByText(/Above Society Level 3, route availability has not yet been authored/),
    ).toBeVisible();
  });
});
