// @vitest-environment happy-dom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, expect, it, vi } from "vitest";
import { getCompetencyV2ReferenceSource } from "@glantri/content";
import LearningGroupReferencePage from "./page";
import { loadAdminSkillReferenceFromServer } from "@/lib/api/adminContentClient";

const mocks = vi.hoisted(() => ({
  session: { currentUser: { id: "admin", roles: ["admin"] }, loading: false },
}));
vi.mock("@/lib/auth/SessionUserContext", () => ({ useSessionUser: () => mocks.session }));
vi.mock("@/lib/api/adminContentClient", () => ({ loadAdminSkillReferenceFromServer: vi.fn() }));
beforeEach(() => {
  window.history.replaceState(null, "", "/admin/skills/reference/groups");
  vi.mocked(loadAdminSkillReferenceFromServer).mockResolvedValue(getCompetencyV2ReferenceSource());
});

it("opens Learning Groups and explains one, many, and no successor cases", async () => {
  const user = userEvent.setup();
  render(<LearningGroupReferencePage />);
  await waitFor(() =>
    expect(screen.getByRole("tab", { name: "Learning Groups" })).toHaveAttribute(
      "aria-selected",
      "true",
    ),
  );
  await user.click(screen.getByText("Audit — retired Learning Groups (13)"));
  await user.click(screen.getByRole("link", { name: "Working a boat" }));
  expect(screen.getByText(/Current practice:/)).toBeVisible();
  await user.click(screen.getByRole("link", { name: "Lineage investigation apprenticeship" }));
  expect(screen.getByText("Retired — no direct replacement")).toBeVisible();
  await user.click(screen.getByRole("link", { name: "Metalworking apprenticeship" }));
  expect(screen.getByText(/Replaced by F24/)).toBeVisible();
});
