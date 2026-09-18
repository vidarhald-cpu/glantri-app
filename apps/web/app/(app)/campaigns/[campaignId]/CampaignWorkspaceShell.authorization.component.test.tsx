import { act, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@glantri/auth";
import type { Scenario } from "@glantri/domain";

import { ApiRequestError } from "@/lib/api/apiClient";

const mocks = vi.hoisted(() => ({
  currentUser: null as AuthUser | null,
  loadAccess: vi.fn(),
  loadEncounterSummaries: vi.fn(),
  loadMyParticipant: vi.fn(),
  loadParticipants: vi.fn(),
  replace: vi.fn(),
  searchParams: new URLSearchParams(),
  setCurrentUser: vi.fn(),
}));
const router = { replace: mocks.replace };

vi.mock("next/navigation", () => ({
  usePathname: () => "/campaigns/campaign-1",
  useRouter: () => router,
  useSearchParams: () => mocks.searchParams,
}));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/auth/SessionUserContext", () => ({
  useSessionUser: () => ({
    currentUser: mocks.currentUser,
    loading: false,
    setCurrentUser: mocks.setCurrentUser,
  }),
}));

vi.mock("@/lib/campaigns/access", () => ({
  canManageCampaignWorkspace: (user?: AuthUser | null) => Boolean(user),
  loadCampaignWorkspaceAccessForUser: mocks.loadAccess,
}));

vi.mock("@/lib/api/localServiceClient", () => ({
  loadEncounterById: vi.fn(),
  loadEncounterRevision: vi.fn(),
  loadScenarioEncounterSummaries: mocks.loadEncounterSummaries,
  loadScenarioMyParticipant: mocks.loadMyParticipant,
  loadScenarioParticipants: mocks.loadParticipants,
}));

vi.mock("@/lib/campaigns/gmCombatRefresh", () => ({ pollGmCombatSnapshot: vi.fn() }));
vi.mock("@/features/combat-history", () => ({
  selectLatestCombatViewRevision: ({ candidate }: { candidate: unknown }) => candidate,
}));
vi.mock("@/features/encounters/EncounterDetail", () => ({ default: () => null }));
vi.mock("@/features/roleplay/RoleplayEncounterScreens", () => ({
  PlayerRoleplayingEncounterScreen: () => null,
}));
vi.mock("@/features/combat-round-manager/CombatRoundManagerPanel", () => ({
  default: () => null,
}));
vi.mock("@/features/equipment/campaign-items/CampaignItemsWorkspace", () => ({
  default: () => null,
}));
vi.mock("@/features/artifacts", () => ({ ArtifactPanel: () => null }));
vi.mock("@/features/blackboard", () => ({ BlackboardWorkspace: () => null }));
vi.mock("./CampaignDetailPageContent", () => ({ default: () => null }));
vi.mock("./CharacterWorkspacePanel", () => ({ default: () => null }));
vi.mock("./WorkspaceParticipantInspectionHeader", () => ({ default: () => null }));
vi.mock("./scenarios/[scenarioId]/ScenarioDetailPageContent", () => ({
  default: () => (
    <section>
      <h2>Private GM notes</h2>
      <p>The steward moved the seal after midnight.</p>
    </section>
  ),
}));
vi.mock("./scenarios/[scenarioId]/player/ScenarioPlayerPageContent", () => ({
  default: () => null,
}));
vi.mock("./scenarios/[scenarioId]/player/combat/ScenarioPlayerCombatPageContent", () => ({
  default: () => null,
}));

import CampaignWorkspaceShell from "./CampaignWorkspaceShell";

const scenario: Scenario = {
  campaignId: "campaign-1",
  createdAt: "2026-09-11T10:00:00.000Z",
  description: "Private scenario",
  id: "scenario-private",
  kind: "mixed",
  name: "Private Council Session",
  status: "live",
  updatedAt: "2026-09-11T10:00:00.000Z",
};

const gmUser: AuthUser = {
  displayName: "Test GM",
  email: "gm@example.test",
  id: "gm-1",
  roles: ["game_master"],
};

function primeAuthorizedWorkspace() {
  mocks.currentUser = gmUser;
  mocks.searchParams = new URLSearchParams(
    "tab=scenario&scenarioId=scenario-private&encounterId=encounter-private",
  );
  mocks.loadAccess.mockResolvedValueOnce({ accessMode: "gm", scenarios: [scenario] });
  mocks.loadEncounterSummaries.mockResolvedValue([]);
  mocks.loadMyParticipant.mockResolvedValue(null);
  mocks.loadParticipants.mockResolvedValue([]);
  mocks.setCurrentUser.mockImplementation((user: AuthUser | null) => {
    mocks.currentUser = user;
  });

  localStorage.setItem("glantri.remembered-selection.campaign-id", "campaign-1");
  localStorage.setItem("glantri.remembered-selection.scenario-id:campaign-1", "scenario-private");
  localStorage.setItem("glantri.remembered-selection.encounter-id:campaign-1", "encounter-private");
  localStorage.setItem("glantri.remembered-selection.workspace-tab:campaign-1", "scenario");
}

describe("Campaign workspace focus-refresh authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    primeAuthorizedWorkspace();
  });

  it("clears mounted private GM context and the old URL when focus refresh loses authentication", async () => {
    mocks.loadAccess.mockRejectedValueOnce(new ApiRequestError("Authentication required.", 401));

    render(<CampaignWorkspaceShell campaignId="campaign-1" />);

    await screen.findByText("The steward moved the seal after midnight.");
    expect(
      screen.getByRole("navigation", { name: "Scenario and Encounter context" }),
    ).toBeVisible();

    act(() => window.dispatchEvent(new Event("focus")));

    await screen.findByText("Authentication required");
    expect(
      screen.queryByText("The steward moved the seal after midnight."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Scenario and Encounter context" }),
    ).not.toBeInTheDocument();
    expect(mocks.setCurrentUser).toHaveBeenCalledWith(null);
    expect(mocks.replace).toHaveBeenCalledWith("/campaigns");
    await waitFor(() => {
      expect(localStorage.getItem("glantri.remembered-selection.campaign-id")).toBeNull();
      expect(
        localStorage.getItem("glantri.remembered-selection.scenario-id:campaign-1"),
      ).toBeNull();
      expect(
        localStorage.getItem("glantri.remembered-selection.encounter-id:campaign-1"),
      ).toBeNull();
      expect(
        localStorage.getItem("glantri.remembered-selection.workspace-tab:campaign-1"),
      ).toBeNull();
    });
  });

  it("retains mounted authorized context for a transient focus-refresh failure", async () => {
    mocks.loadAccess.mockRejectedValueOnce(new Error("Temporary network failure"));

    render(<CampaignWorkspaceShell campaignId="campaign-1" />);

    await screen.findByText("The steward moved the seal after midnight.");
    act(() => window.dispatchEvent(new Event("focus")));

    await screen.findByText(
      "We couldn't refresh the Campaign context. Try again or reload the page.",
    );
    expect(screen.getByText("The steward moved the seal after midnight.")).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Scenario and Encounter context" }),
    ).toBeVisible();
    expect(mocks.setCurrentUser).not.toHaveBeenCalled();
    expect(mocks.replace).not.toHaveBeenCalledWith("/campaigns");
  });

  it("clears mounted private context when a late 401 follows an earlier transient child failure", async () => {
    let rejectLateAuthorization!: (reason?: unknown) => void;
    const lateAuthorizationRequest = new Promise<never>((_resolve, reject) => {
      rejectLateAuthorization = reject;
    });

    render(<CampaignWorkspaceShell campaignId="campaign-1" />);

    await screen.findByText("The steward moved the seal after midnight.");
    mocks.loadAccess.mockResolvedValueOnce({ accessMode: "gm", scenarios: [scenario] });
    mocks.loadEncounterSummaries.mockRejectedValueOnce(new Error("Temporary network failure"));
    mocks.loadParticipants.mockReturnValueOnce(lateAuthorizationRequest);

    act(() => window.dispatchEvent(new Event("focus")));

    await screen.findByText(
      "We couldn't refresh the Campaign context. Try again or reload the page.",
    );
    expect(screen.getByText("The steward moved the seal after midnight.")).toBeVisible();

    await act(async () => {
      rejectLateAuthorization(new ApiRequestError("Authentication required.", 401));
      await Promise.resolve();
    });

    await screen.findByText("Authentication required");
    expect(
      screen.queryByText("The steward moved the seal after midnight."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Scenario and Encounter context" }),
    ).not.toBeInTheDocument();
    expect(mocks.setCurrentUser).toHaveBeenCalledWith(null);
    expect(mocks.replace).toHaveBeenCalledWith("/campaigns");
    await waitFor(() => {
      expect(localStorage.getItem("glantri.remembered-selection.campaign-id")).toBeNull();
      expect(
        localStorage.getItem("glantri.remembered-selection.scenario-id:campaign-1"),
      ).toBeNull();
      expect(
        localStorage.getItem("glantri.remembered-selection.encounter-id:campaign-1"),
      ).toBeNull();
      expect(
        localStorage.getItem("glantri.remembered-selection.workspace-tab:campaign-1"),
      ).toBeNull();
    });
  });

  it("clears mounted private context when focus refresh reports access denied", async () => {
    mocks.loadAccess.mockResolvedValueOnce({ accessMode: "none", scenarios: [] });

    render(<CampaignWorkspaceShell campaignId="campaign-1" />);

    await screen.findByText("The steward moved the seal after midnight.");
    act(() => window.dispatchEvent(new Event("focus")));

    await screen.findByText("Campaign unavailable");
    expect(
      screen.queryByText("The steward moved the seal after midnight."),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: "Scenario and Encounter context" }),
    ).not.toBeInTheDocument();
    expect(mocks.setCurrentUser).not.toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith("/campaigns/campaign-1?tab=campaign");
    await waitFor(() => {
      expect(localStorage.getItem("glantri.remembered-selection.campaign-id")).toBeNull();
      expect(
        localStorage.getItem("glantri.remembered-selection.scenario-id:campaign-1"),
      ).toBeNull();
      expect(
        localStorage.getItem("glantri.remembered-selection.encounter-id:campaign-1"),
      ).toBeNull();
      expect(
        localStorage.getItem("glantri.remembered-selection.workspace-tab:campaign-1"),
      ).toBeNull();
    });
  });
});
