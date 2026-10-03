import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthUser } from "@glantri/auth";
import type {
  EncounterSession,
  EncounterSessionSummary,
  PlayerAccessibleScenario,
  Scenario,
  ScenarioParticipant,
} from "@glantri/domain";

import { ApiRequestError } from "@/lib/api/apiClient";

const mocks = vi.hoisted(() => ({
  currentUser: null as AuthUser | null,
  loadAccess: vi.fn(),
  loadEncounterById: vi.fn(),
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
  canManageCampaignWorkspace: (user?: AuthUser | null) =>
    Boolean(user?.roles.includes("game_master") || user?.roles.includes("admin")),
  loadCampaignWorkspaceAccessForUser: mocks.loadAccess,
}));

vi.mock("@/lib/api/localServiceClient", () => ({
  loadEncounterById: mocks.loadEncounterById,
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
  PlayerRoleplayingEncounterScreen: (props: {
    inspectionParticipantId?: string;
    readOnlyInspection?: boolean;
    workspaceTab?: string;
  }) => (
    <div
      data-inspection-id={props.inspectionParticipantId}
      data-read-only={String(Boolean(props.readOnlyInspection))}
      data-tab={props.workspaceTab}
      data-testid="roleplay-surface"
    />
  ),
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
vi.mock("./WorkspaceParticipantInspectionHeader", () => ({
  default: ({ screenName }: { screenName: string }) => (
    <h2 data-testid="participant-header">{screenName}</h2>
  ),
}));
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
  default: (props: { readOnlyInspection?: boolean; workspaceTab?: string }) => (
    <div
      data-read-only={String(Boolean(props.readOnlyInspection))}
      data-tab={props.workspaceTab}
      data-testid="combat-surface"
    />
  ),
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

function focusRefreshBarrier() {
  /**
   * The focus listener is attached from a passive effect that is guarded on
   * settled workspace state, so it attaches in a commit AFTER the one that
   * renders the awaited private text. A single dispatch can therefore land
   * with zero listeners and be silently dropped — nothing in the DOM marks
   * the point at which the listener exists. Following the retrying barrier
   * PR #292 introduced for `ArtifactImportPanel`, re-dispatch until the
   * refresh the event is supposed to start has provably begun. `loadAccess`
   * is invoked synchronously by the refresh, so at most one dispatch is ever
   * effective and no queued once-value is consumed twice. No assertion is
   * weakened and no timeout is widened.
   */
  const callsBeforeFocus = mocks.loadAccess.mock.calls.length;

  return waitFor(() => {
    if (mocks.loadAccess.mock.calls.length === callsBeforeFocus) {
      fireEvent(window, new Event("focus"));
    }

    expect(mocks.loadAccess.mock.calls.length).toBeGreaterThan(callsBeforeFocus);
  });
}

describe("Campaign workspace focus-refresh authorization", () => {
  beforeEach(() => {
    // `mockClear()` — what `vi.clearAllMocks()` performs — clears recorded
    // calls but does NOT drain `onceImplementations`. A `mockRejectedValueOnce`
    // a test queued and never consumed therefore survives into the next test,
    // ahead of the `mockResolvedValueOnce` this priming adds, and that test
    // fails on an initial load it never wrote. Only `mockReset()` drains the
    // once-queue, so the queues are reset here and re-primed below.
    vi.resetAllMocks();
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

    await focusRefreshBarrier();

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
    await focusRefreshBarrier();

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

    await focusRefreshBarrier();

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
    await focusRefreshBarrier();

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

const actionPlayer: AuthUser = {
  displayName: "Test Player",
  email: "player@example.test",
  id: "player-1",
  roles: ["player"],
};

const actionPlayerScenario: PlayerAccessibleScenario = {
  campaignId: "campaign-1",
  description: "Player-safe scenario",
  id: "scenario-private",
  name: "Private Council Session",
  status: "live",
};

const actionParticipant = {
  characterId: "character-1",
  controlledByUserId: actionPlayer.id,
  id: "participant-1",
  isActive: true,
  role: "player_character",
  scenarioId: "scenario-private",
  snapshot: { displayName: "Test Hero" },
  sourceType: "character",
} as ScenarioParticipant;

function primeActionView(input: {
  encounterStatus?: EncounterSessionSummary["status"];
  perspective: "gm" | "player";
  scenarioStatus?: Scenario["status"];
}) {
  vi.resetAllMocks();
  localStorage.clear();
  const now = "2026-09-11T10:00:00.000Z";
  const summary: EncounterSessionSummary = {
    campaignId: "campaign-1",
    createdAt: now,
    id: "encounter-private",
    scenarioId: "scenario-private",
    status: input.encounterStatus ?? "active",
    title: "Council encounter",
    updatedAt: now,
    viewerAssigned: true,
  };
  const encounter = {
    ...summary,
    kind: "combat",
    participantMembershipMode: "explicit",
    participants: [
      {
        characterId: "character-1",
        id: "encounter-participant-1",
        label: "Test Hero",
        participantType: "scenario",
        scenarioParticipantId: actionParticipant.id,
      },
    ],
  } as EncounterSession;

  mocks.currentUser = input.perspective === "gm" ? gmUser : actionPlayer;
  mocks.searchParams = new URLSearchParams(
    "tab=player-skill-rolls&scenarioId=scenario-private&encounterId=encounter-private",
  );
  mocks.loadAccess.mockResolvedValue({
    accessMode: input.perspective,
    scenarios: [
      input.perspective === "gm"
        ? { ...scenario, status: input.scenarioStatus ?? "live" }
        : { ...actionPlayerScenario, status: input.scenarioStatus ?? "live" },
    ],
  });
  mocks.loadEncounterSummaries.mockResolvedValue(input.encounterStatus ? [summary] : []);
  mocks.loadEncounterById.mockResolvedValue(encounter);
  mocks.loadMyParticipant.mockResolvedValue(actionParticipant);
  mocks.loadParticipants.mockResolvedValue([actionParticipant]);
  mocks.setCurrentUser.mockImplementation((user: AuthUser | null) => {
    mocks.currentUser = user;
  });
}

describe("Campaign Action composition by perspective and encounter state", () => {
  it("stacks player Combat above Skill Roll for an active Encounter using the same tab", async () => {
    primeActionView({ encounterStatus: "active", perspective: "player" });
    render(<CampaignWorkspaceShell campaignId="campaign-1" />);

    const combat = await screen.findByTestId("combat-surface");
    const roleplay = screen.getByTestId("roleplay-surface");
    expect(
      combat.compareDocumentPosition(roleplay) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(combat).toHaveAttribute("data-tab", "player-skill-rolls");
    expect(roleplay).toHaveAttribute("data-tab", "player-skill-rolls");
    expect(combat).toHaveAttribute("data-read-only", "false");
    expect(roleplay).toHaveAttribute("data-read-only", "false");
  });

  it.each(["draft", "paused"] as const)(
    "keeps Combat out of a player's %s Encounter Action view",
    async (encounterStatus) => {
      primeActionView({ encounterStatus, perspective: "player" });
      render(<CampaignWorkspaceShell campaignId="campaign-1" />);

      expect(await screen.findByTestId("roleplay-surface")).toHaveAttribute(
        "data-tab",
        "player-skill-rolls",
      );
      expect(screen.queryByTestId("combat-surface")).not.toBeInTheDocument();
    },
  );

  it("keeps the constrained Action state outside an Encounter", async () => {
    primeActionView({ perspective: "player" });
    render(<CampaignWorkspaceShell campaignId="campaign-1" />);

    await screen.findByText("No player skill rolls are currently available.");
    expect(screen.queryByTestId("combat-surface")).not.toBeInTheDocument();
    expect(screen.queryByTestId("roleplay-surface")).not.toBeInTheDocument();
  });

  it.each(["draft", "paused"] as const)(
    "does not compose Combat while the Scenario is %s",
    async (scenarioStatus) => {
      primeActionView({ encounterStatus: "active", perspective: "player", scenarioStatus });
      render(<CampaignWorkspaceShell campaignId="campaign-1" />);

      expect(await screen.findByTestId("roleplay-surface")).toHaveAttribute(
        "data-tab",
        "player-skill-rolls",
      );
      expect(screen.queryByTestId("combat-surface")).not.toBeInTheDocument();
    },
  );

  it("keeps the GM inspection header and Skill Roll surface read-only", async () => {
    primeActionView({ encounterStatus: "active", perspective: "gm" });
    render(<CampaignWorkspaceShell campaignId="campaign-1" />);

    expect(await screen.findByTestId("participant-header")).toHaveTextContent("Player skill rolls");
    const roleplay = screen.getByTestId("roleplay-surface");
    expect(screen.queryByTestId("combat-surface")).not.toBeInTheDocument();
    expect(roleplay).toHaveAttribute("data-read-only", "true");
    expect(roleplay).toHaveAttribute("data-inspection-id", actionParticipant.id);
    expect(roleplay).toHaveAttribute("data-tab", "player-skill-rolls");
  });
});
