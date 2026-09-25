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

  it("searches canonical Skills and follows a Learning Group link", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    await user.type(
      screen.getByRole("searchbox", { name: "Search Skills, languages, and writing" }),
      "Falconry",
    );
    expect(screen.getByText("1 results")).toBeVisible();
    const groupSection = screen.getByRole("heading", {
      name: "Learning Groups",
      level: 3,
    }).parentElement!;
    const group = within(groupSection).getByRole("link");
    await user.click(group);
    expect(screen.getByRole("tab", { name: "Learning Groups" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByRole("heading", { name: group.textContent! })).toHaveFocus();
  });

  it("shows Profession core alternatives and choice counts", async () => {
    const user = userEvent.setup();
    render(<SkillsReferencePage />);
    await user.click(screen.getByRole("tab", { name: "Professions" }));
    const search = screen.getByRole("searchbox", {
      name: "Search Professions, tracks, or training",
    });
    await user.type(search, "Courier and Messenger");
    expect(screen.getByText(/3 defining route alternatives/)).toBeVisible();
    await user.clear(search);
    await user.type(search, "Soldier");
    await user.click(screen.getByRole("button", { name: /^Soldier / }));
    expect(screen.getAllByText(/choose 2 from/).length).toBeGreaterThan(0);
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
