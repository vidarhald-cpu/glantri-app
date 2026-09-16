// @vitest-environment happy-dom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { targetLearningGroupCatalogue } from "@glantri/content";
import { fullSkillCatalogueProposal } from "@glantri/content/full-skill-catalogue-proposal";
import LearningGroupReferencePage from "./page";
import { LearningGroupReferenceContent } from "./LearningGroupReferenceContent";
import { SkillReferenceContent } from "../SkillReferenceContent";

const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  session: { currentUser: { id: "admin-104", roles: ["admin"] }, loading: false },
}));
vi.mock("@/lib/api/adminContentClient", () => ({ loadAdminSkillReferenceFromServer: mocks.load }));
vi.mock("@/lib/auth/SessionUserContext", () => ({ useSessionUser: () => mocks.session }));
vi.mock("next/navigation", () => ({ usePathname: () => "/admin/skills/reference/groups" }));
beforeEach(() => {
  window.history.replaceState(null, "", "/admin/skills/reference/groups");
  mocks.session.currentUser.roles = ["admin"];
  mocks.load.mockReset().mockResolvedValue({
    candidate: null,
    canonical: null,
    fullCatalogue: fullSkillCatalogueProposal,
    targetLearningGroups: targetLearningGroupCatalogue,
  });
});

describe("Learning Group Reference", () => {
  it("shows full prose and explicit members before secondary source details, with searchable navigation", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/admin/skills/reference/groups#group-G08");
    render(<LearningGroupReferencePage />);
    const title = await screen.findByRole("heading", {
      name: "One-handed edged close-combat practice",
    });
    const article = title.closest("article")!;
    const group = targetLearningGroupCatalogue.groups.find((group) => group.id === "G08")!;
    expect(within(article).getByText(group.description.split("\n\n")[0]!)).toBeVisible();
    for (const name of ["1-h edged", "Dodge", "Parry"])
      expect(within(article).getByRole("link", { name })).toBeVisible();
    expect(within(article).queryByRole("link", { name: "Sword" })).toBeNull();
    expect(
      within(article).getByText("Source provenance and membership history").closest("details"),
    ).not.toHaveAttribute("open");
    await user.type(screen.getByRole("textbox", { name: "Search groups or members" }), "Falconry");
    expect(
      screen.getByRole("combobox", { name: "Learning Group" }).querySelectorAll("option"),
    ).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Falconry" })).toHaveAttribute(
      "href",
      "/admin/skills/reference#competency-spec%3Afalconry",
    );
    expect(screen.getAllByRole("link", { name: "Animal Training" }).length).toBeGreaterThan(0);
    await user.clear(screen.getByRole("textbox", { name: "Search groups or members" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Learning Group" }), "F41");
    expect(screen.getByRole("heading", { name: "Longbow hunting apprenticeship" })).toHaveFocus();
    expect(window.location.hash).toBe("#group-F41");
  });
  it("keeps all historical links inspectable and explains deliberate grouplessness", async () => {
    const user = userEvent.setup();
    render(<LearningGroupReferenceContent />);
    await screen.findByRole("heading", { name: "Learning Group Reference" });
    await user.click(screen.getByText("Historical Pilot snapshot (18 groups; 46 links)"));
    expect(screen.getByText("Sword (skill:sword)")).toBeVisible();
    expect(screen.getByText("G08 — Close weapon practice")).toBeVisible();
    await user.click(screen.getByText("Deliberately groupless base Skills (41)"));
    const groupless = screen
      .getByText("Deliberately groupless base Skills (41)")
      .closest("details")!;
    expect(within(groupless).getAllByRole("link")).toHaveLength(41);
  });
  it("denies non-admin access without loading reference data", () => {
    mocks.session.currentUser.roles = ["player"];
    render(<LearningGroupReferencePage />);
    expect(screen.getByText("Admin access required")).toBeVisible();
    expect(mocks.load).not.toHaveBeenCalled();
  });
  it("reports missing catalogue and failed loads honestly", async () => {
    mocks.load.mockRejectedValueOnce(new Error("private error"));
    render(<LearningGroupReferenceContent />);
    expect(
      await screen.findByText("Learning Group Reference is currently unavailable."),
    ).toBeVisible();
    expect(screen.queryByText("private error")).toBeNull();
  });
  it("uses approved reverse memberships on Skill pages while keeping the prose first", async () => {
    window.history.replaceState(null, "", "/admin/skills/reference#competency-one_handed_edged");
    render(<SkillReferenceContent />);
    const title = await screen.findByRole("heading", { name: "1-h edged" });
    const article = title.closest("article")!;
    expect(
      within(article).getByRole("link", { name: "One-handed edged close-combat practice" }),
    ).toHaveAttribute("href", "/admin/skills/reference/groups#group-G08");
    expect(
      within(article).getByText("Earlier catalogue annotation").closest("details"),
    ).not.toHaveAttribute("open");
  });
});
