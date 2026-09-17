// @vitest-environment happy-dom
import fs from "node:fs";
import path from "node:path";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import SkillsReferencePage from "./page";
import AdminSkillReferencePage from "../admin/skills/reference/page";

const mocks = vi.hoisted(() => ({
  session: {
    currentUser: { id: "reader-106", roles: ["player"] as string[] } as {
      id: string;
      roles: string[];
    } | null,
    loading: false,
  },
}));

vi.mock("@/lib/auth/SessionUserContext", () => ({ useSessionUser: () => mocks.session }));

beforeEach(() => {
  mocks.session.currentUser = { id: "reader-106", roles: ["player"] };
  window.history.replaceState(null, "", "/skills");
});

describe("ordinary Skill reference", () => {
  it.each(["player", "game_master", "admin"])("is available to an authenticated %s", (role) => {
    mocks.session.currentUser = { id: `${role}-106`, roles: [role] };
    render(<SkillsReferencePage />);
    expect(screen.getByRole("heading", { name: "Skills and training" })).toBeVisible();
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Skills",
      "Learning Groups",
      "Professions",
      "Societies",
    ]);
  });

  it("requires authentication and leaves the Admin reference Admin-only", () => {
    mocks.session.currentUser = null;
    const { unmount } = render(<SkillsReferencePage />);
    expect(screen.getByRole("heading", { name: "Login required" })).toBeVisible();
    unmount();

    mocks.session.currentUser = { id: "player-106", roles: ["player"] };
    render(<AdminSkillReferencePage />);
    expect(screen.getByRole("heading", { name: "Admin access required" })).toBeVisible();
  });

  it("searches relationships and follows links between Skills and Learning Groups", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    const search = screen.getByRole("searchbox", { name: "Search Skills, languages, and writing" });
    await user.type(search, "Falconry");
    expect(screen.getByText("1 results")).toBeVisible();
    expect(screen.getByRole("heading", { name: "Falconry" })).toBeVisible();

    const section = screen.getByRole("heading", {
      name: "Learning Groups",
      level: 3,
    }).parentElement!;
    const groupLink = within(section).getByRole("link");
    await user.click(groupLink);
    expect(screen.getByRole("tab", { name: "Learning Groups" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("heading", { name: groupLink.textContent! })).toHaveFocus();
  });

  it("shows Profession training rather than automatic grants and preserves both exceptions", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    await user.click(screen.getByRole("tab", { name: "Professions" }));
    const search = screen.getByRole("searchbox", {
      name: "Search Professions, tracks, or training",
    });
    await user.type(search, "Sailor and Boat Worker");
    expect(screen.getByText(/alternative training routes here/)).toBeVisible();
    expect(screen.getByText(/grants no ranks, points, competencies/)).toBeVisible();
    await user.clear(search);
    await user.type(search, "Guard, Watcher and Escort");
    expect(screen.getByText(/mutually exclusive here/)).toBeVisible();
  });

  it("shows all society models and states the current generic Chargen boundary", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    await user.click(screen.getByRole("tab", { name: "Societies" }));
    expect(screen.getByText(/Generic Chargen does not yet filter Professions/)).toBeVisible();
    expect(screen.getAllByText(/Society Level [1-6]/)).toHaveLength(11);
    expect(screen.getAllByText("Civilization examples")).toHaveLength(11);
  });

  it("reflows the browser and guide for a 390 px viewport", () => {
    const css = fs.readFileSync(path.join(__dirname, "skillsReference.module.css"), "utf-8");
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain("grid-template-columns: minmax(0, 1fr)");
    expect(css).toContain("max-height: 18rem");
  });

  it("supports arrow-key movement between the four tabs", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    const skills = screen.getByRole("tab", { name: "Skills" });
    skills.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Learning Groups" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Learning Groups" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Societies" })).toHaveFocus();
  });
});
