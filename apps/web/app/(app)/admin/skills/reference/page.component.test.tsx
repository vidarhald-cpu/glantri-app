// @vitest-environment happy-dom
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getCompetencyV2ReferenceSource } from "@glantri/content";
import SkillReferencePage from "./page";
import { loadAdminSkillReferenceFromServer } from "@/lib/api/adminContentClient";

const mocks = vi.hoisted(() => ({
  session: {
    currentUser: { id: "admin", roles: ["admin"] } as { id: string; roles: string[] } | null,
    loading: false,
  },
}));
vi.mock("@/lib/auth/SessionUserContext", () => ({ useSessionUser: () => mocks.session }));
vi.mock("@/lib/api/adminContentClient", () => ({ loadAdminSkillReferenceFromServer: vi.fn() }));

beforeEach(() => {
  mocks.session.currentUser = { id: "admin", roles: ["admin"] };
  window.history.replaceState(null, "", "/admin/skills/reference");
  vi.mocked(loadAdminSkillReferenceFromServer).mockReset();
});

describe("Admin V2 competency reference", () => {
  it("loads the bounded V2 reference for Admin", async () => {
    vi.mocked(loadAdminSkillReferenceFromServer).mockResolvedValue(
      getCompetencyV2ReferenceSource(),
    );
    render(<SkillReferencePage />);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Skills and training" })).toBeVisible(),
    );
    expect(screen.getAllByRole("tab")).toHaveLength(5);
    expect(loadAdminSkillReferenceFromServer).toHaveBeenCalledOnce();
  });

  it("does not call the reference API for a player", () => {
    mocks.session.currentUser = { id: "player", roles: ["player"] };
    render(<SkillReferencePage />);
    expect(screen.getByRole("heading", { name: "Admin access required" })).toBeVisible();
    expect(loadAdminSkillReferenceFromServer).not.toHaveBeenCalled();
  });
});
