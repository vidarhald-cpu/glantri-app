"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  buildEncounterSessionSummary,
  type Campaign,
  type EncounterSession,
  type EncounterSessionSummary,
  type PlayerAccessibleCampaign,
  type PlayerAccessibleScenario,
  type Scenario,
  type ScenarioParticipant,
} from "@glantri/domain";

import {
  loadEncounterById,
  loadEncounterRevision,
  loadScenarioEncounterSummaries,
  loadScenarioMyParticipant,
  loadScenarioParticipants,
} from "@/lib/api/localServiceClient";
import { ApiRequestError } from "@/lib/api/apiClient";
import {
  REMEMBERED_SELECTION_KEYS,
  useRememberedSelection,
} from "@/lib/browser/rememberedSelection";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import {
  canManageCampaignWorkspace,
  loadCampaignWorkspaceAccessForUser,
} from "@/lib/campaigns/access";
import {
  getCampaignWorkspaceVisibleEncounters,
  getScenarioVisibleEncounters,
} from "@/lib/campaigns/encounters";
import { getCampaignWorkspaceSelectionKeys } from "@/lib/campaigns/RememberedCampaignWorkspaceEffect";
import {
  buildCampaignEncounterHref,
  buildCampaignPlayViews,
  buildCampaignScenarioHref,
  buildCampaignTaskHref,
  buildCampaignWorkspaceHref,
  buildCampaignWorkspaceTabs,
  isLiveCampaignScenario,
  PLAYER_COMBAT_PLAY_ENTRY_LABEL,
  resolveActiveCampaignPlayView,
  resolveCampaignTaskTargetId,
  resolveCampaignWorkspaceState,
  type CampaignWorkspaceTabId,
} from "@/lib/campaigns/workspace";
import { buildGmCharacterWorkspaceCandidates } from "@/lib/campaigns/characterWorkspace";
import EncounterDetail from "@/features/encounters/EncounterDetail";
import CampaignDetailPageContent from "./CampaignDetailPageContent";
import CampaignWorkspaceLoadErrorState from "./CampaignWorkspaceLoadErrorState";
import CharacterWorkspacePanel from "./CharacterWorkspacePanel";
import {
  buildPlayerScenarioContext,
  PlayerCampaignHomeSummary,
  usePlayerCampaignHome,
  type PlayerScenarioContext,
} from "./PlayerCampaignLanding";
import WorkspaceParticipantInspectionHeader from "./WorkspaceParticipantInspectionHeader";
import { formatScenarioStatus } from "@/lib/campaigns/scenarioStatusLabel";
import ScenarioDetailPageContent from "./scenarios/[scenarioId]/ScenarioDetailPageContent";
import ScenarioPlayerPageContent from "./scenarios/[scenarioId]/player/ScenarioPlayerPageContent";
import ScenarioPlayerCombatPageContent from "./scenarios/[scenarioId]/player/combat/ScenarioPlayerCombatPageContent";
import { PlayerRoleplayingEncounterScreen } from "@/features/roleplay/RoleplayEncounterScreens";
import CombatRoundManagerPanel from "@/features/combat-round-manager/CombatRoundManagerPanel";
import { selectLatestCombatViewRevision } from "@/features/combat-history";
import { loadCampaignWorkspaceInitialData } from "@/lib/campaigns/campaignWorkspaceLoading";
import { pollGmCombatSnapshot } from "@/lib/campaigns/gmCombatRefresh";
import CampaignItemsWorkspace from "@/features/equipment/campaign-items/CampaignItemsWorkspace";
import { ArtifactPanel } from "@/features/artifacts";
import { BlackboardWorkspace } from "@/features/blackboard";
import { MapWorkspace } from "@/features/maps";

import styles from "./CampaignWorkspaceShell.module.css";

interface CampaignWorkspaceShellProps {
  campaignId: string;
}

const GM_COMBAT_REFRESH_INTERVAL_MS = 5_000;

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

interface CurrentScenarioContextPanelProps {
  buildWorkspaceHref: (input: {
    encounterId?: string | null;
    scenarioId?: string | null;
    tab?: CampaignWorkspaceTabId | null;
  }) => string;
  canAccessGmEncounter: boolean;
  encounters: EncounterSessionSummary[];
  /** The folded Campaign Home lines for each Scenario: Characters played and the current Encounter. */
  playerContext?: Record<string, PlayerScenarioContext>;
  scenarios: Array<Scenario | PlayerAccessibleScenario>;
}

export function CurrentScenarioContextPanel({
  buildWorkspaceHref,
  canAccessGmEncounter,
  encounters,
  playerContext,
  scenarios,
}: CurrentScenarioContextPanelProps) {
  return (
    <section
      aria-label="Current Scenario and Encounter"
      style={{ ...panelStyle, background: "#f6f5ef" }}
    >
      <h2 style={{ margin: 0 }}>Current Scenario and Encounter</h2>
      {scenarios.length === 0 ? (
        <div>
          No active Scenario is currently available. Campaign Home and completed history remain
          available below.
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 260px), 1fr))",
            }}
          >
            {scenarios.map((scenario) => {
              const activeEncounters = encounters.filter(
                (encounter) =>
                  encounter.scenarioId === scenario.id && encounter.status === "active",
              );

              return (
                <article
                  key={scenario.id}
                  style={{
                    background: "white",
                    border: "1px solid #d9ddd8",
                    borderRadius: 10,
                    display: "grid",
                    gap: "0.5rem",
                    padding: "0.75rem",
                  }}
                >
                  <strong>{scenario.name}</strong>
                  {playerContext?.[scenario.id]?.characters.length ? (
                    <small>Playing as {playerContext[scenario.id]!.characters.join(", ")}</small>
                  ) : null}
                  <Link
                    href={buildCampaignScenarioHref({
                      campaignId: scenario.campaignId,
                      scenarioId: scenario.id,
                    })}
                  >
                    Open Scenario
                  </Link>
                  {activeEncounters.length > 0 ? (
                    <div style={{ display: "grid", gap: "0.5rem" }}>
                      {activeEncounters.map((encounter) => (
                        <div key={encounter.id} style={{ display: "grid", gap: "0.25rem" }}>
                          <span>{encounter.title}</span>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                            <Link
                              href={buildCampaignEncounterHref({
                                campaignId: scenario.campaignId,
                                encounterId: encounter.id,
                                scenarioId: scenario.id,
                              })}
                            >
                              Open Encounter
                            </Link>
                            <Link
                              href={buildWorkspaceHref({
                                encounterId: encounter.id,
                                scenarioId: scenario.id,
                                tab: canAccessGmEncounter ? "combat" : "player-combat",
                              })}
                            >
                              Open Combat
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <small>No active Encounter yet.</small>
                  )}
                  {activeEncounters.length === 0 && playerContext?.[scenario.id]?.encounterTitle ? (
                    <small>Current encounter: {playerContext[scenario.id]!.encounterTitle}</small>
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

/**
 * The Campaign-level navigation above the Scenario Play arena.
 *
 * A player's Campaign row carries `Campaigns`, `Campaign` and the Blackboard and
 * Maps tools. While the Play arena is on screen the Play views row is the one
 * player navigation level (#787, #849): it names `Blackboard` and `Map` itself,
 * and `Campaigns` in the application navigation reaches the same Campaign
 * landing `Campaign` does, so the Campaign row renders nothing at all. It is the
 * player's only row whenever no Play arena is rendered, and is unchanged there.
 *
 * A GM's navigation is unchanged.
 */
export function CampaignWorkspaceNavigation({
  activeTab,
  campaignId,
  canManageCampaign,
  playArenaPresent = false,
}: {
  activeTab: CampaignWorkspaceTabId;
  campaignId: string;
  canManageCampaign: boolean;
  playArenaPresent?: boolean;
}) {
  const commonLinkStyle = {
    color: "#2f5d62",
    fontWeight: 700,
    padding: "0.4rem 0",
    textDecoration: "none",
  } as const;
  const taskLinks = [
    { href: buildCampaignTaskHref({ campaignId, section: "overview" }), label: "Campaign home" },
    { href: buildCampaignTaskHref({ campaignId, section: "membership" }), label: "Membership" },
    { href: buildCampaignTaskHref({ campaignId, section: "scenarios" }), label: "Scenarios" },
    { href: buildCampaignTaskHref({ campaignId, section: "history" }), label: "Campaign history" },
    {
      href: buildCampaignTaskHref({ campaignId, section: "create-material" }),
      label: "Create material",
    },
    {
      href: buildCampaignTaskHref({ campaignId, section: "material" }),
      label: "Notes & material",
    },
  ];
  const relatedLinks = [
    {
      href: buildCampaignWorkspaceHref({ campaignId, tab: "blackboard" }),
      id: "blackboard" as const,
      label: "Blackboard",
    },
    {
      href: buildCampaignWorkspaceHref({ campaignId, tab: "maps" }),
      id: "maps" as const,
      label: "Maps",
    },
  ];

  if (!canManageCampaign) {
    if (playArenaPresent) {
      return null;
    }

    return (
      <nav
        aria-label="Campaign navigation"
        style={{
          borderBottom: "1px solid #d9ddd8",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          paddingBottom: "0.5rem",
        }}
      >
        <Link href="/campaigns" style={commonLinkStyle}>
          Campaigns
        </Link>
        <Link
          aria-current={activeTab === "campaign" ? "page" : undefined}
          href={buildCampaignWorkspaceHref({ campaignId, tab: "campaign" })}
          style={commonLinkStyle}
        >
          Campaign
        </Link>
        {relatedLinks.map((link) => (
          <Link
            aria-current={activeTab === link.id ? "page" : undefined}
            href={link.href}
            key={link.id}
            style={commonLinkStyle}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <nav
        aria-label="Campaign tasks"
        style={{
          borderBottom: "1px solid #d9ddd8",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          paddingBottom: "0.5rem",
        }}
      >
        <Link href="/campaigns" style={commonLinkStyle}>
          Campaigns
        </Link>
        {taskLinks.map((link) => (
          <Link href={link.href} key={link.href} scroll={false} style={commonLinkStyle}>
            {link.label}
          </Link>
        ))}
      </nav>
      <nav
        aria-label="Related Campaign tools"
        style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}
      >
        {relatedLinks.map((link) => (
          <Link
            aria-current={activeTab === link.id ? "page" : undefined}
            href={link.href}
            key={link.id}
            style={{ ...commonLinkStyle, fontWeight: 600 }}
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/**
 * Navigation inside a live Scenario.
 *
 * A player sees one line: the Scenario and active Encounter as compact context
 * (plain text, not links, so they are not a second navigation hierarchy) and the
 * single `Play views` row holding
 * `Situation | Skill rolls | Map | Blackboard | Character`, plus `Combat` while
 * an Encounter is active (#849; the entry was labelled `Player combat`). The
 * player Combat entry keeps its own `?tab=player-combat` route and is not
 * composed into `Skill rolls`, which renders only the Skill roll screen (#848).
 *
 * A GM's navigation is unchanged: the Scenario and Encounter tools row as it
 * was, including the GM-only Combat link.
 */
export function ScenarioPlayNavigation({
  activeEncounterId,
  activeEncounterTitle,
  activeTab,
  buildWorkspaceHref,
  campaignId,
  canAccessGmEncounter,
  scenarioId,
  scenarioName,
  scenarioStatus,
}: {
  activeEncounterId?: string;
  activeEncounterTitle?: string;
  activeTab: CampaignWorkspaceTabId;
  buildWorkspaceHref: (input: {
    encounterId?: string | null;
    scenarioId?: string | null;
    tab?: CampaignWorkspaceTabId | null;
  }) => string;
  campaignId: string;
  canAccessGmEncounter: boolean;
  scenarioId: string;
  scenarioName: string;
  /** Shown beside the name only when the Scenario is not simply live. */
  scenarioStatus?: string;
}) {
  if (canAccessGmEncounter) {
    return (
      <nav
        aria-label="Scenario and Encounter tools"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}
      >
        <Link href={buildCampaignScenarioHref({ campaignId, scenarioId })}>Scenario</Link>
        {activeEncounterId ? (
          <Link
            href={buildCampaignEncounterHref({
              campaignId,
              encounterId: activeEncounterId,
              scenarioId,
            })}
          >
            Encounter
          </Link>
        ) : null}
        <Link
          href={buildWorkspaceHref({
            encounterId: activeEncounterId,
            scenarioId,
            tab: "character",
          })}
        >
          Character
        </Link>
        {activeEncounterId ? (
          <>
            <Link
              href={buildWorkspaceHref({
                encounterId: activeEncounterId,
                scenarioId,
                tab: "skill-rolls",
              })}
            >
              Skill rolls
            </Link>
            <Link
              href={buildWorkspaceHref({
                encounterId: activeEncounterId,
                scenarioId,
                tab: "combat",
              })}
            >
              Combat
            </Link>
            <Link
              href={buildWorkspaceHref({
                encounterId: activeEncounterId,
                scenarioId,
                tab: "player-combat",
              })}
            >
              Player combat
            </Link>
          </>
        ) : null}
      </nav>
    );
  }

  const activePlayView = resolveActiveCampaignPlayView(activeTab);
  const playEntries: Array<{ current: boolean; href: string; key: string; label: string }> = [
    ...buildCampaignPlayViews().map((view) => ({
      current: activePlayView === view.id,
      href: buildWorkspaceHref({
        encounterId: activeEncounterId,
        scenarioId,
        tab: view.canonicalTab,
      }),
      key: view.id,
      label: view.label,
    })),
    // The player Combat entry keeps its own `?tab=player-combat` route and is not
    // folded into `Skill rolls`; it sits inside the one Play views row (#787).
    // Whether it is present at all depends on `activeEncounterId`; that
    // condition is unchanged and awaits a Product Owner ruling (#849).
    ...(activeEncounterId
      ? [
          {
            current: activeTab === "player-combat",
            href: buildWorkspaceHref({
              encounterId: activeEncounterId,
              scenarioId,
              tab: "player-combat" as const,
            }),
            key: "player-combat",
            label: PLAYER_COMBAT_PLAY_ENTRY_LABEL,
          },
        ]
      : []),
  ];

  return (
    <div
      style={{
        alignItems: "baseline",
        columnGap: "1.25rem",
        display: "flex",
        flexWrap: "wrap",
        rowGap: "0.35rem",
      }}
    >
      <section
        aria-label="Play header"
        style={{ alignItems: "baseline", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
      >
        <strong>{scenarioName}</strong>
        {scenarioStatus && scenarioStatus !== "live" ? (
          <small>{formatScenarioStatus(scenarioStatus)}</small>
        ) : null}
        {activeEncounterTitle ? (
          <span
            data-testid="play-header-encounter"
            style={{
              border: "1px solid #b8c4bd",
              borderRadius: "0.75rem",
              fontSize: "0.85rem",
              padding: "0.1rem 0.6rem",
            }}
          >
            Encounter · {activeEncounterTitle}
          </span>
        ) : null}
      </section>
      <nav aria-label="Play views" style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        {playEntries.map((entry) => (
          <Link aria-current={entry.current ? "page" : undefined} href={entry.href} key={entry.key}>
            {entry.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

function getEncounterStatusRank(status: EncounterSessionSummary["status"]): number {
  switch (status) {
    case "active":
      return 0;
    case "draft":
      return 1;
    case "paused":
      return 2;
    case "completed":
      return 4;
    case "archived":
      return 99;
    default:
      return 50;
  }
}

function isWorkspaceAuthorizationDenial(error: unknown): error is ApiRequestError {
  return error instanceof ApiRequestError && (error.status === 401 || error.status === 403);
}

export default function CampaignWorkspaceShell({ campaignId }: CampaignWorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();
  const { currentUser, loading: sessionLoading, setCurrentUser } = useSessionUser();
  const [accessibleCampaign, setAccessibleCampaign] = useState<
    Campaign | PlayerAccessibleCampaign | null
  >(null);
  const [accessMode, setAccessMode] = useState<"gm" | "player" | "none">("gm");
  const [activeEncounter, setActiveEncounter] = useState<EncounterSession>();
  const [encounterSummaries, setEncounterSummaries] = useState<EncounterSessionSummary[]>([]);
  const [error, setError] = useState<string>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scenarioParticipants, setScenarioParticipants] = useState<ScenarioParticipant[]>([]);
  const [scenarios, setScenarios] = useState<Array<Scenario | PlayerAccessibleScenario>>([]);
  const [workspaceLoadError, setWorkspaceLoadError] = useState(false);
  const activeEncounterIdRef = useRef<string | undefined>(undefined);
  const activeEncounterRef = useRef<EncounterSession | undefined>(undefined);
  const activeEncounterRequestIdRef = useRef(0);
  const workspaceContextRequestIdRef = useRef(0);
  const canAccessGmEncounter = canManageCampaignWorkspace(currentUser);
  const rememberedCampaignSelection = useRememberedSelection(REMEMBERED_SELECTION_KEYS.campaignId);
  const workspaceSelectionKeys = useMemo(
    () => getCampaignWorkspaceSelectionKeys(campaignId),
    [campaignId],
  );
  const rememberedScenarioSelection = useRememberedSelection(workspaceSelectionKeys.scenarioId);
  const rememberedEncounterSelection = useRememberedSelection(workspaceSelectionKeys.encounterId);
  const rememberedWorkspaceTab = useRememberedSelection(workspaceSelectionKeys.workspaceTab);
  const setRememberedCampaignSelection = rememberedCampaignSelection.setValue;
  const setRememberedScenarioSelection = rememberedScenarioSelection.setValue;
  const setRememberedEncounterSelection = rememberedEncounterSelection.setValue;
  const setRememberedWorkspaceTab = rememberedWorkspaceTab.setValue;

  const clearUnauthorizedWorkspaceContext = useCallback(() => {
    workspaceContextRequestIdRef.current += 1;
    activeEncounterRequestIdRef.current += 1;
    activeEncounterIdRef.current = undefined;
    activeEncounterRef.current = undefined;
    setAccessibleCampaign(null);
    setAccessMode("none");
    setActiveEncounter(undefined);
    setEncounterSummaries([]);
    setError(undefined);
    setLoading(false);
    setScenarioParticipants([]);
    setScenarios([]);
    setWorkspaceLoadError(false);
    setRememberedCampaignSelection(undefined);
    setRememberedScenarioSelection(undefined);
    setRememberedEncounterSelection(undefined);
    setRememberedWorkspaceTab(undefined);
  }, [
    setRememberedCampaignSelection,
    setRememberedEncounterSelection,
    setRememberedScenarioSelection,
    setRememberedWorkspaceTab,
  ]);

  const acceptActiveEncounter = useCallback((candidate: EncounterSession) => {
    setActiveEncounter((accepted) =>
      accepted?.id === candidate.id
        ? selectLatestCombatViewRevision({ accepted, candidate })
        : candidate,
    );
    setEncounterSummaries((current) =>
      current.map((summary) =>
        summary.id === candidate.id
          ? {
              ...buildEncounterSessionSummary(candidate),
              viewerAssigned: summary.viewerAssigned,
            }
          : summary,
      ),
    );
  }, []);

  const refreshEncounterSummaries = useCallback(async () => {
    const scenarioIds = scenarios.map((scenario) => scenario.id);
    const encounterGroups = await Promise.all(
      scenarioIds.map((scenarioId) => loadScenarioEncounterSummaries(scenarioId)),
    );
    const visibleEncounters = getCampaignWorkspaceVisibleEncounters({
      campaignId,
      encounters: encounterGroups.flat(),
      scenarioIds,
    });

    setEncounterSummaries(visibleEncounters);
  }, [campaignId, scenarios]);

  const refreshWorkspaceContext = useCallback(
    async (initial: boolean) => {
      const requestId = workspaceContextRequestIdRef.current + 1;
      workspaceContextRequestIdRef.current = requestId;

      function handleWorkspaceAuthorizationDenial(status: 401 | 403) {
        if (initial || workspaceContextRequestIdRef.current !== requestId) return;

        clearUnauthorizedWorkspaceContext();

        if (status === 401) {
          setCurrentUser(null);
          router.replace("/campaigns");
        } else {
          router.replace(buildCampaignWorkspaceHref({ campaignId, tab: "campaign" }));
        }
      }

      async function observeWorkspaceRequest<T>(request: () => Promise<T>): Promise<T> {
        try {
          return await request();
        } catch (caughtError) {
          if (isWorkspaceAuthorizationDenial(caughtError)) {
            handleWorkspaceAuthorizationDenial(caughtError.status === 401 ? 401 : 403);
          }

          throw caughtError;
        }
      }

      if (initial) {
        setLoading(true);
        setAccessMode(canManageCampaignWorkspace(currentUser) ? "gm" : "player");
      }

      try {
        const initialData = await loadCampaignWorkspaceInitialData({
          loadAccess: () =>
            observeWorkspaceRequest(() =>
              loadCampaignWorkspaceAccessForUser({
                campaignId,
                user: currentUser,
              }),
            ),
          loadEncounterSummaries: (scenarioId) =>
            observeWorkspaceRequest(() => loadScenarioEncounterSummaries(scenarioId)),
          loadMyParticipant: (scenarioId) =>
            observeWorkspaceRequest(() => loadScenarioMyParticipant(scenarioId)),
          loadParticipants: (scenarioId) =>
            observeWorkspaceRequest(() => loadScenarioParticipants(scenarioId)),
        });
        const workspaceAccess = initialData.access;
        const scenarioIds = workspaceAccess.scenarios.map((scenario) => scenario.id);

        if (workspaceContextRequestIdRef.current !== requestId) return;

        if (!initial && workspaceAccess.accessMode === "none") {
          clearUnauthorizedWorkspaceContext();
          router.replace(buildCampaignWorkspaceHref({ campaignId, tab: "campaign" }));
          return;
        }

        setAccessibleCampaign(workspaceAccess.campaign ?? null);
        setAccessMode(workspaceAccess.accessMode);
        setScenarios(workspaceAccess.scenarios);
        setScenarioParticipants(initialData.participants);
        setEncounterSummaries(
          getCampaignWorkspaceVisibleEncounters({
            campaignId,
            encounters: initialData.encounterSummaries,
            scenarioIds,
          }),
        );
        setError(undefined);
        setWorkspaceLoadError(false);
      } catch {
        if (workspaceContextRequestIdRef.current !== requestId) return;

        if (initial) {
          setError(undefined);
          setWorkspaceLoadError(true);
          setAccessibleCampaign(null);
          setScenarios([]);
          setScenarioParticipants([]);
          setEncounterSummaries([]);
          setActiveEncounter(undefined);
        } else {
          setError("We couldn't refresh the Campaign context. Try again or reload the page.");
        }
      } finally {
        if (initial && workspaceContextRequestIdRef.current === requestId) {
          setLoading(false);
        }
      }
    },
    [campaignId, clearUnauthorizedWorkspaceContext, currentUser, router, setCurrentUser],
  );

  useEffect(() => {
    if (sessionLoading) return;

    if (!currentUser) {
      clearUnauthorizedWorkspaceContext();
      return;
    }

    void refreshWorkspaceContext(true);

    return () => {
      workspaceContextRequestIdRef.current += 1;
    };
  }, [
    clearUnauthorizedWorkspaceContext,
    currentUser,
    loadAttempt,
    refreshWorkspaceContext,
    sessionLoading,
  ]);

  useEffect(() => {
    if (sessionLoading || loading || workspaceLoadError || accessMode === "none") return;

    let disposed = false;
    let refreshInFlight = false;

    async function refreshVisibleWorkspace() {
      if (disposed || refreshInFlight || document.visibilityState === "hidden") return;
      refreshInFlight = true;
      try {
        await refreshWorkspaceContext(false);
      } finally {
        refreshInFlight = false;
      }
    }

    window.addEventListener("focus", refreshVisibleWorkspace);
    document.addEventListener("visibilitychange", refreshVisibleWorkspace);

    return () => {
      disposed = true;
      window.removeEventListener("focus", refreshVisibleWorkspace);
      document.removeEventListener("visibilitychange", refreshVisibleWorkspace);
    };
  }, [accessMode, loading, refreshWorkspaceContext, sessionLoading, workspaceLoadError]);

  const workspaceState = useMemo(
    () =>
      resolveCampaignWorkspaceState({
        activeCampaignId: campaignId,
        canAccessGmEncounter,
        currentUserId: currentUser?.id,
        encounters: encounterSummaries,
        rememberedEncounterId: rememberedEncounterSelection.value,
        rememberedScenarioId: rememberedScenarioSelection.value,
        rememberedTab: rememberedWorkspaceTab.value,
        requestedEncounterId: searchParams.get("encounterId"),
        requestedScenarioId: searchParams.get("scenarioId"),
        requestedTab: searchParams.get("tab"),
        scenarioParticipants,
        scenarios,
      }),
    [
      campaignId,
      canAccessGmEncounter,
      currentUser?.id,
      encounterSummaries,
      rememberedEncounterSelection.value,
      rememberedScenarioSelection.value,
      rememberedWorkspaceTab.value,
      scenarioParticipants,
      scenarios,
      searchParams,
    ],
  );

  const tabs = useMemo(
    () => buildCampaignWorkspaceTabs({ canAccessGmEncounter }),
    [canAccessGmEncounter],
  );
  const activeScenarioEncounters = getScenarioVisibleEncounters({
    encounters: encounterSummaries,
    scenarioId: workspaceState.activeScenarioId,
  });
  const sortedActiveScenarioEncounters = [...activeScenarioEncounters]
    .filter((encounter) => encounter.status !== "archived")
    .sort(
      (left, right) =>
        getEncounterStatusRank(left.status) - getEncounterStatusRank(right.status) ||
        left.title.localeCompare(right.title),
    );
  const liveScenarios = scenarios.filter(isLiveCampaignScenario);
  const completedScenarios = scenarios.filter((scenario) => scenario.status === "completed");
  const activeScenario = scenarios.find(
    (scenario) => scenario.id === workspaceState.activeScenarioId,
  );
  /**
   * True exactly when `ScenarioPlayNavigation` renders the player Play arena,
   * which is the one row that then carries Blackboard and Map (#787).
   */
  const playArenaPresent = Boolean(
    activeScenario &&
    activeScenario.status !== "completed" &&
    activeScenario.status !== "archived" &&
    !canAccessGmEncounter,
  );
  const playerCampaignHome = usePlayerCampaignHome({
    campaignId,
    enabled:
      Boolean(currentUser) &&
      !loading &&
      !workspaceLoadError &&
      !canAccessGmEncounter &&
      accessMode === "player" &&
      workspaceState.activeTab === "campaign",
  });
  const activeScenarioRoundNumber =
    activeScenario && "liveState" in activeScenario
      ? activeScenario.liveState?.roundNumber
      : undefined;
  const activeEncounterSummary = activeScenarioEncounters.find(
    (summary) => summary.id === workspaceState.activeEncounterId,
  );
  const activeEncounterId = activeEncounterSummary?.id;
  const shouldLoadActiveEncounter =
    canAccessGmEncounter &&
    (
      ["character", "combat", "player-combat", "player-skill-rolls"] as CampaignWorkspaceTabId[]
    ).includes(workspaceState.activeTab);
  const selectedActiveEncounter =
    shouldLoadActiveEncounter && activeEncounter?.id === activeEncounterId
      ? activeEncounter
      : undefined;
  activeEncounterIdRef.current = shouldLoadActiveEncounter ? activeEncounterId : undefined;
  activeEncounterRef.current = activeEncounter;

  useEffect(() => {
    const encounterId = shouldLoadActiveEncounter ? activeEncounterId : undefined;
    const summaryRevision = activeEncounterSummary?.updatedAt;

    if (!encounterId || !summaryRevision) {
      activeEncounterRequestIdRef.current += 1;
      setActiveEncounter(undefined);
      return;
    }

    if (activeEncounter?.id === encounterId && activeEncounter.updatedAt >= summaryRevision) {
      return;
    }

    const requestId = activeEncounterRequestIdRef.current + 1;
    activeEncounterRequestIdRef.current = requestId;
    setActiveEncounter((current) => (current?.id === encounterId ? current : undefined));

    loadEncounterById(encounterId)
      .then((candidate) => {
        if (
          activeEncounterRequestIdRef.current !== requestId ||
          activeEncounterIdRef.current !== encounterId
        ) {
          return;
        }

        acceptActiveEncounter(candidate);
        setError(undefined);
      })
      .catch((caughtError) => {
        if (
          activeEncounterRequestIdRef.current !== requestId ||
          activeEncounterIdRef.current !== encounterId
        ) {
          return;
        }

        if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
          setEncounterSummaries((current) =>
            current.filter((summary) => summary.id !== encounterId),
          );
          setActiveEncounter(undefined);
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "Unable to load encounter.");
      });
  }, [
    acceptActiveEncounter,
    activeEncounter?.id,
    activeEncounter?.updatedAt,
    activeEncounterId,
    activeEncounterSummary?.updatedAt,
    shouldLoadActiveEncounter,
  ]);

  useEffect(() => {
    if (
      sessionLoading ||
      !canAccessGmEncounter ||
      workspaceState.activeTab !== "combat" ||
      !activeEncounterId ||
      activeEncounter?.id !== activeEncounterId
    ) {
      return;
    }

    const polledEncounterId = activeEncounterId;
    let refreshInFlight = false;
    let disposed = false;
    async function refreshActiveCombatRevision() {
      if (refreshInFlight) return;
      refreshInFlight = true;
      try {
        const accepted = activeEncounterRef.current;
        const result = await pollGmCombatSnapshot({
          acceptedRevision: accepted?.id === polledEncounterId ? accepted.updatedAt : undefined,
          encounterId: polledEncounterId,
          loadEncounter: loadEncounterById,
          loadParticipants: loadScenarioParticipants,
          loadRevision: loadEncounterRevision,
        });

        if (
          disposed ||
          activeEncounterIdRef.current !== polledEncounterId ||
          result.kind !== "updated"
        ) {
          return;
        }

        setScenarioParticipants((current) => [
          ...current.filter(
            (participant) => participant.scenarioId !== result.encounter.scenarioId,
          ),
          ...result.participants,
        ]);
        acceptActiveEncounter(result.encounter);
        setError(undefined);
      } catch (caughtError) {
        if (disposed || activeEncounterIdRef.current !== polledEncounterId) {
          return;
        }

        if (caughtError instanceof ApiRequestError && caughtError.status === 404) {
          setEncounterSummaries((current) =>
            current.filter((summary) => summary.id !== polledEncounterId),
          );
          setActiveEncounter(undefined);
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Unable to refresh active encounter.",
        );
      } finally {
        refreshInFlight = false;
      }
    }

    function refreshVisibleCombat() {
      if (document.visibilityState !== "hidden") {
        void refreshActiveCombatRevision();
      }
    }

    refreshVisibleCombat();
    const intervalId = window.setInterval(refreshVisibleCombat, GM_COMBAT_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshVisibleCombat);
    document.addEventListener("visibilitychange", refreshVisibleCombat);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshVisibleCombat);
      document.removeEventListener("visibilitychange", refreshVisibleCombat);
    };
  }, [
    acceptActiveEncounter,
    activeEncounter?.id,
    activeEncounterId,
    canAccessGmEncounter,
    sessionLoading,
    workspaceState.activeTab,
  ]);
  const gmInspectableCandidates = useMemo(
    () =>
      buildGmCharacterWorkspaceCandidates({
        activeEncounter: selectedActiveEncounter,
        scenarioId: workspaceState.activeScenarioId,
        scenarioParticipants,
      }),
    [scenarioParticipants, selectedActiveEncounter, workspaceState.activeScenarioId],
  );
  const selectedGmInspectableCandidate =
    gmInspectableCandidates.find(
      (candidate) => candidate.id === searchParams.get("participantId"),
    ) ?? gmInspectableCandidates[0];
  const currentUserActiveScenarioParticipant = scenarioParticipants.find(
    (participant) =>
      Boolean(currentUser?.id) &&
      participant.scenarioId === workspaceState.activeScenarioId &&
      participant.isActive &&
      participant.role === "player_character" &&
      participant.controlledByUserId === currentUser?.id,
  );
  const playerEncounterEmptyDetail =
    workspaceState.activeScenarioId &&
    currentUserActiveScenarioParticipant &&
    activeScenarioEncounters.some((encounter) => encounter.status !== "archived")
      ? "You are in this scenario, but not assigned to this encounter."
      : "Waiting for GM to add you to an encounter.";

  const buildWorkspaceHref = useCallback(
    (partial: {
      blackboardCategory?: string | null;
      blackboardPinned?: string | null;
      blackboardQuery?: string | null;
      encounterId?: string | null;
      entryId?: string | null;
      mapId?: string | null;
      participantId?: string | null;
      scenarioId?: string | null;
      tab?: CampaignWorkspaceTabId | null;
    }): string => {
      const nextParams = new URLSearchParams(searchParamString);

      if (partial.scenarioId === null) {
        nextParams.delete("scenarioId");
      } else if (partial.scenarioId !== undefined) {
        nextParams.set("scenarioId", partial.scenarioId);
      }

      if (partial.encounterId === null) {
        nextParams.delete("encounterId");
      } else if (partial.encounterId !== undefined) {
        nextParams.set("encounterId", partial.encounterId);
      }

      if (partial.tab === null) {
        nextParams.delete("tab");
      } else if (partial.tab !== undefined) {
        nextParams.set("tab", partial.tab);
      }

      if (partial.participantId === null) {
        nextParams.delete("participantId");
      } else if (partial.participantId !== undefined) {
        nextParams.set("participantId", partial.participantId);
      }

      for (const [key, value] of [
        ["entryId", partial.entryId],
        ["mapId", partial.mapId],
        ["blackboardQuery", partial.blackboardQuery],
        ["blackboardCategory", partial.blackboardCategory],
        ["blackboardPinned", partial.blackboardPinned],
      ] as const) {
        if (value === null) nextParams.delete(key);
        else if (value !== undefined) nextParams.set(key, value);
      }

      return buildCampaignWorkspaceHref({
        blackboardCategory: nextParams.get("blackboardCategory"),
        blackboardPinned: nextParams.get("blackboardPinned"),
        blackboardQuery: nextParams.get("blackboardQuery"),
        campaignId,
        encounterId: nextParams.get("encounterId"),
        entryId: nextParams.get("entryId"),
        mapId: nextParams.get("mapId"),
        participantId: nextParams.get("participantId"),
        scenarioId: nextParams.get("scenarioId"),
        tab: (nextParams.get("tab") as CampaignWorkspaceTabId | null) ?? undefined,
      });
    },
    [campaignId, searchParamString],
  );

  const handleMapRouteChange = useCallback(
    (mapId?: string, history: "push" | "replace" = "replace") => {
      const href = buildWorkspaceHref({ mapId: mapId ?? null, tab: "maps" });
      const currentHref = searchParamString ? `${pathname}?${searchParamString}` : pathname;
      if (href !== currentHref) {
        if (history === "push") router.push(href);
        else router.replace(href);
      }
    },
    [buildWorkspaceHref, pathname, router, searchParamString],
  );

  function selectInspectableParticipant(input: {
    participantId: string;
    tab: Extract<CampaignWorkspaceTabId, "character" | "player-combat" | "player-skill-rolls">;
  }) {
    const nextHref = buildWorkspaceHref({
      participantId: input.participantId,
      tab: input.tab,
    });
    const currentHref = searchParamString ? `${pathname}?${searchParamString}` : pathname;

    if (nextHref !== currentHref) {
      router.replace(nextHref);
    }
  }

  useEffect(() => {
    if (accessMode === "none" || workspaceLoadError) {
      return;
    }

    setRememberedCampaignSelection(campaignId);
  }, [accessMode, campaignId, setRememberedCampaignSelection, workspaceLoadError]);

  useEffect(() => {
    if (sessionLoading || loading || workspaceLoadError || accessMode === "none") {
      return;
    }

    if (
      !rememberedScenarioSelection.hydrated ||
      !rememberedEncounterSelection.hydrated ||
      !rememberedWorkspaceTab.hydrated
    ) {
      return;
    }

    if (
      !searchParams.get("scenarioId") &&
      rememberedScenarioSelection.value &&
      !workspaceState.activeScenarioId
    ) {
      rememberedScenarioSelection.setValue(undefined);
    }

    if (
      !searchParams.get("encounterId") &&
      rememberedEncounterSelection.value &&
      !workspaceState.activeEncounterId
    ) {
      rememberedEncounterSelection.setValue(undefined);
    }

    const requestedTabFromUrl = tabs.find((tab) => tab.id === searchParams.get("tab"))?.id;
    const canonicalWorkspaceTab =
      workspaceState.activeTab === "campaign" && !workspaceState.activeScenarioId
        ? "campaign"
        : (requestedTabFromUrl ?? workspaceState.activeTab);
    const nextHref = buildWorkspaceHref({
      encounterId: workspaceState.activeEncounterId ?? null,
      participantId:
        workspaceState.activeScenarioId &&
        (requestedTabFromUrl === "player-encounter" ||
          requestedTabFromUrl === "encounter" ||
          requestedTabFromUrl === "skill-rolls" ||
          requestedTabFromUrl === "player-skill-rolls" ||
          requestedTabFromUrl === "character" ||
          requestedTabFromUrl === "combat" ||
          requestedTabFromUrl === "player-combat" ||
          workspaceState.activeTab === "player-encounter" ||
          workspaceState.activeTab === "encounter" ||
          workspaceState.activeTab === "skill-rolls" ||
          workspaceState.activeTab === "player-skill-rolls" ||
          workspaceState.activeTab === "character" ||
          workspaceState.activeTab === "combat" ||
          workspaceState.activeTab === "player-combat")
          ? searchParams.get("participantId")
          : null,
      scenarioId: workspaceState.activeScenarioId ?? null,
      tab: canonicalWorkspaceTab,
    });
    const currentHref = searchParamString ? `${pathname}?${searchParamString}` : pathname;

    if (nextHref !== currentHref) {
      router.replace(nextHref);
    }
  }, [
    buildWorkspaceHref,
    accessMode,
    pathname,
    rememberedEncounterSelection,
    rememberedScenarioSelection,
    rememberedWorkspaceTab.hydrated,
    loading,
    router,
    searchParams,
    searchParamString,
    sessionLoading,
    workspaceLoadError,
    tabs,
    workspaceState.activeEncounterId,
    workspaceState.activeScenarioId,
    workspaceState.activeTab,
  ]);

  useEffect(() => {
    if (accessMode !== "none") {
      setRememberedScenarioSelection(workspaceState.activeScenarioId);
    }
  }, [accessMode, setRememberedScenarioSelection, workspaceState.activeScenarioId]);

  useEffect(() => {
    if (accessMode !== "none") {
      setRememberedEncounterSelection(workspaceState.activeEncounterId);
    }
  }, [accessMode, setRememberedEncounterSelection, workspaceState.activeEncounterId]);

  useEffect(() => {
    if (accessMode !== "none") {
      setRememberedWorkspaceTab(workspaceState.activeTab);
    }
  }, [accessMode, setRememberedWorkspaceTab, workspaceState.activeTab]);

  useEffect(() => {
    if (workspaceState.activeTab !== "campaign") {
      return;
    }

    let animationFrameId: number | undefined;
    const observer = new MutationObserver(() => requestCampaignTaskScroll());

    const scrollToCampaignTask = () => {
      const targetId = resolveCampaignTaskTargetId(window.location.hash);
      if (!targetId) {
        return false;
      }

      const target = document.getElementById(targetId);
      if (!target) {
        return false;
      }

      if (animationFrameId !== undefined) {
        window.cancelAnimationFrame(animationFrameId);
      }
      animationFrameId = window.requestAnimationFrame(() => {
        target.scrollIntoView({ block: "start" });
        observer.disconnect();
        animationFrameId = undefined;
      });
      return true;
    };

    function requestCampaignTaskScroll() {
      if (!scrollToCampaignTask()) {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    }

    requestCampaignTaskScroll();
    window.addEventListener("hashchange", requestCampaignTaskScroll);
    return () => {
      window.removeEventListener("hashchange", requestCampaignTaskScroll);
      observer.disconnect();
      if (animationFrameId !== undefined) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, [workspaceState.activeTab]);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1240 }}>
      <CampaignWorkspaceNavigation
        activeTab={workspaceState.activeTab}
        campaignId={campaignId}
        canManageCampaign={canAccessGmEncounter}
        playArenaPresent={playArenaPresent}
      />

      {activeScenario && playArenaPresent ? (
        /*
         * The player's one play-navigation level (#849): Scenario and Encounter as
         * compact context and the Play views row on a single line. The Campaign
         * and Scenario breadcrumb is not rendered here; it repeated the same
         * names and links the row and the application navigation already carry.
         */
        <section style={{ ...panelStyle, gap: "0.5rem", padding: "0.5rem 1rem" }}>
          <ScenarioPlayNavigation
            activeEncounterId={activeEncounterSummary?.id}
            activeEncounterTitle={activeEncounterSummary?.title}
            activeTab={workspaceState.activeTab}
            buildWorkspaceHref={buildWorkspaceHref}
            campaignId={campaignId}
            canAccessGmEncounter={canAccessGmEncounter}
            scenarioId={activeScenario.id}
            scenarioName={activeScenario.name}
            scenarioStatus={activeScenario.status}
          />
        </section>
      ) : activeScenario ? (
        <section style={{ ...panelStyle, gap: "0.5rem", padding: "0.75rem 1rem" }}>
          <nav
            aria-label="Scenario and Encounter context"
            style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}
          >
            <Link href={buildCampaignTaskHref({ campaignId, section: "overview" })} scroll={false}>
              Campaign
            </Link>
            <span aria-hidden="true">›</span>
            <Link
              href={buildCampaignScenarioHref({
                campaignId,
                scenarioId: activeScenario.id,
              })}
            >
              {activeScenario.name}
            </Link>
            <small>{formatScenarioStatus(activeScenario.status)}</small>
            {activeEncounterSummary ? (
              <>
                <span aria-hidden="true">›</span>
                <Link
                  href={buildCampaignEncounterHref({
                    campaignId,
                    encounterId: activeEncounterSummary.id,
                    scenarioId: activeScenario.id,
                  })}
                >
                  {activeEncounterSummary.title}
                </Link>
              </>
            ) : null}
          </nav>
          {activeScenario.status !== "completed" && activeScenario.status !== "archived" ? (
            <ScenarioPlayNavigation
              activeEncounterId={activeEncounterSummary?.id}
              activeEncounterTitle={activeEncounterSummary?.title}
              activeTab={workspaceState.activeTab}
              buildWorkspaceHref={buildWorkspaceHref}
              campaignId={campaignId}
              canAccessGmEncounter={canAccessGmEncounter}
              scenarioId={activeScenario.id}
              scenarioName={activeScenario.name}
            />
          ) : (
            <small>Historical inspection is read-only and does not resume this Scenario.</small>
          )}
        </section>
      ) : null}

      {error ? <section style={panelStyle}>{error}</section> : null}

      {workspaceLoadError ? (
        <CampaignWorkspaceLoadErrorState
          onRetry={() => setLoadAttempt((current) => current + 1)}
          retrying={loading}
        />
      ) : null}

      {!loading && !workspaceLoadError && accessMode === "none" ? (
        <section style={panelStyle}>
          {currentUser ? (
            <>
              <strong>Campaign unavailable</strong>
              <div>This campaign is not accessible for the current player account.</div>
              <Link href="/campaigns">Back to campaigns</Link>
            </>
          ) : (
            <>
              <strong>Authentication required</strong>
              <div>Sign in to see your Campaigns and continue playing.</div>
              <Link href="/auth">Sign in</Link>
            </>
          )}
        </section>
      ) : null}

      {!loading &&
      !workspaceLoadError &&
      accessMode !== "none" &&
      workspaceState.activeTab === "campaign" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {canAccessGmEncounter ? (
            <CampaignDetailPageContent
              campaignId={campaignId}
              embedded
              onWorkspaceScenariosChanged={setScenarios}
            />
          ) : (
            <section style={{ display: "grid", gap: "1rem" }}>
              <CurrentScenarioContextPanel
                buildWorkspaceHref={buildWorkspaceHref}
                canAccessGmEncounter={canAccessGmEncounter}
                encounters={encounterSummaries}
                playerContext={buildPlayerScenarioContext(playerCampaignHome)}
                scenarios={liveScenarios}
              />
              <section style={panelStyle}>
                <h2 style={{ margin: 0 }}>{accessibleCampaign?.name ?? "Campaign"}</h2>
                <div>
                  {accessibleCampaign?.description ||
                    "No campaign description has been written yet."}
                </div>
                <PlayerCampaignHomeSummary state={playerCampaignHome} />
                {completedScenarios.length > 0 ? (
                  <section style={{ display: "grid", gap: "0.5rem" }}>
                    <h3 style={{ margin: 0 }}>Completed history</h3>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {completedScenarios.map((scenario) => (
                        <Link
                          key={scenario.id}
                          href={buildWorkspaceHref({
                            scenarioId: scenario.id,
                            tab: "scenario",
                          })}
                        >
                          {scenario.name}
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}
              </section>
              <ArtifactPanel campaignId={campaignId} scenarios={[]} />
            </section>
          )}
        </section>
      ) : null}

      {!workspaceLoadError && accessMode !== "none" && workspaceState.activeTab === "items" ? (
        canAccessGmEncounter ? (
          <CampaignItemsWorkspace
            campaignId={campaignId}
            initialHolderCharacterId={searchParams.get("itemHolder") ?? undefined}
            initialItemId={searchParams.get("itemId") ?? undefined}
            createRequested={searchParams.get("itemCreate") === "1"}
          />
        ) : null
      ) : null}

      {!workspaceLoadError && accessMode !== "none" && workspaceState.activeTab === "maps" ? (
        <MapWorkspace
          campaignId={campaignId}
          initialMapId={searchParams.get("mapId") ?? undefined}
          isGameMaster={canAccessGmEncounter}
          onMapRouteChange={handleMapRouteChange}
        />
      ) : null}

      {!workspaceLoadError && accessMode !== "none" && workspaceState.activeTab === "blackboard" ? (
        <BlackboardWorkspace
          campaignId={campaignId}
          isGameMaster={canAccessGmEncounter}
          onRouteChange={(next) => {
            router.replace(
              buildWorkspaceHref({
                blackboardCategory: next.category ?? null,
                blackboardPinned: next.pinned ?? null,
                blackboardQuery: next.query || null,
                entryId: next.entryId ?? null,
                tab: "blackboard",
              }),
            );
          }}
          routeCategory={searchParams.get("blackboardCategory")}
          routeEntryId={searchParams.get("entryId")}
          routePinned={searchParams.get("blackboardPinned")}
          routeQuery={searchParams.get("blackboardQuery")}
        />
      ) : null}

      {!workspaceLoadError && accessMode !== "none" && workspaceState.activeTab === "scenario" ? (
        /*
         * Containment only (#601 D1): the Scenario surface below is laid out horizontally, so the
         * single-column `auto` track it sits in took its max-content width and widened the whole
         * document. `minmax(0, 1fr)` keeps it inside the viewport; its tables keep their own
         * `overflow-x: auto` wrappers.
         */
        <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1fr)" }}>
          {workspaceState.activeScenarioId ? (
            canAccessGmEncounter ? (
              <ScenarioDetailPageContent
                campaignId={campaignId}
                embedded
                onWorkspaceEncountersChanged={() => void refreshEncounterSummaries()}
                scenarioId={workspaceState.activeScenarioId}
              />
            ) : (
              <ScenarioPlayerPageContent
                campaignId={campaignId}
                encounters={activeScenarioEncounters}
                scenarioId={workspaceState.activeScenarioId}
              />
            )
          ) : (
            <section style={panelStyle}>
              <strong>No active scenario is currently available.</strong>
              {liveScenarios.length > 0 || completedScenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {[...liveScenarios, ...completedScenarios].map((scenario) => (
                    <Link
                      key={scenario.id}
                      href={buildWorkspaceHref({
                        scenarioId: scenario.id,
                        tab: "scenario",
                      })}
                    >
                      {scenario.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <div>No active scenario is currently available.</div>
              )}
            </section>
          )}
        </section>
      ) : null}

      {!workspaceLoadError && accessMode !== "none" && workspaceState.activeTab === "encounter" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {workspaceState.activeScenarioId &&
          workspaceState.activeEncounterId &&
          canAccessGmEncounter ? (
            <EncounterDetail
              campaignId={campaignId}
              embedded
              id={workspaceState.activeEncounterId}
              surface="encounter"
              scenarioId={workspaceState.activeScenarioId}
            />
          ) : workspaceState.activeScenarioId && workspaceState.activeEncounterId ? (
            <PlayerRoleplayingEncounterScreen
              campaignId={campaignId}
              embedded
              encounterId={workspaceState.activeEncounterId}
              scenarioId={workspaceState.activeScenarioId}
              surface="encounter"
            />
          ) : (
            <section style={panelStyle}>
              <strong>No encounter is currently available.</strong>
              <div>{playerEncounterEmptyDetail}</div>
            </section>
          )}
        </section>
      ) : null}

      {!workspaceLoadError &&
      accessMode !== "none" &&
      workspaceState.activeTab === "skill-rolls" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {workspaceState.activeScenarioId &&
          workspaceState.activeEncounterId &&
          canAccessGmEncounter ? (
            <EncounterDetail
              campaignId={campaignId}
              embedded
              id={workspaceState.activeEncounterId}
              surface="skill-rolls"
              scenarioId={workspaceState.activeScenarioId}
            />
          ) : workspaceState.activeScenarioId && workspaceState.activeEncounterId ? (
            <PlayerRoleplayingEncounterScreen
              campaignId={campaignId}
              embedded
              encounterId={workspaceState.activeEncounterId}
              scenarioId={workspaceState.activeScenarioId}
              surface="skill-rolls"
            />
          ) : (
            <section style={panelStyle}>
              <strong>No skill rolls are currently available.</strong>
              <div>{playerEncounterEmptyDetail}</div>
              {workspaceState.activeScenarioId ? (
                <Link
                  href={buildWorkspaceHref({
                    scenarioId: workspaceState.activeScenarioId,
                    tab: "scenario",
                  })}
                >
                  Back to scenario
                </Link>
              ) : liveScenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div>Choose a scenario to check for player encounters.</div>
                  {liveScenarios.map((scenario) => (
                    <Link
                      key={scenario.id}
                      href={buildWorkspaceHref({
                        scenarioId: scenario.id,
                        tab: "skill-rolls",
                      })}
                    >
                      {scenario.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          )}
        </section>
      ) : null}

      {!workspaceLoadError &&
      accessMode !== "none" &&
      workspaceState.activeTab === "player-skill-rolls" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {workspaceState.activeScenarioId &&
          workspaceState.activeEncounterId &&
          canAccessGmEncounter ? (
            <>
              <WorkspaceParticipantInspectionHeader
                candidates={gmInspectableCandidates}
                isGameMaster={canAccessGmEncounter}
                onSelectParticipantId={(participantId) =>
                  selectInspectableParticipant({ participantId, tab: "player-skill-rolls" })
                }
                screenName="Player skill rolls"
                selectedCandidate={selectedGmInspectableCandidate}
              />
              {selectedGmInspectableCandidate ? (
                <PlayerRoleplayingEncounterScreen
                  campaignId={campaignId}
                  embedded
                  encounterId={workspaceState.activeEncounterId}
                  inspectionParticipantId={selectedGmInspectableCandidate.id}
                  readOnlyInspection
                  scenarioId={workspaceState.activeScenarioId}
                  showWorkspaceHeader={false}
                  surface="skill-rolls"
                  workspaceTab="player-skill-rolls"
                />
              ) : (
                <section style={panelStyle}>
                  <div>No participant is available for player skill rolls.</div>
                </section>
              )}
            </>
          ) : workspaceState.activeScenarioId && workspaceState.activeEncounterId ? (
            /*
             * The Skill rolls surface is the whole surface (#848). It previously
             * mounted the player Combat surface above this screen whenever the
             * Scenario was live and its Encounter active, which displaced the
             * Skill roll grid down a 6,000-line Combat page as soon as the
             * Combat projection arrived -- the "brief Skill-roll render followed
             * by a Combat takeover" the Product Owner reported. Combat keeps its
             * own entry in the same Play views row, so no player capability is
             * lost by rendering only the Skill roll screen here.
             */
            <PlayerRoleplayingEncounterScreen
              campaignId={campaignId}
              embedded
              encounterId={workspaceState.activeEncounterId}
              scenarioId={workspaceState.activeScenarioId}
              surface="skill-rolls"
              workspaceTab="player-skill-rolls"
              workspaceScreenName="Player skill rolls"
            />
          ) : (
            <section style={panelStyle}>
              <strong>No player skill rolls are currently available.</strong>
              <div>{playerEncounterEmptyDetail}</div>
              {workspaceState.activeScenarioId ? (
                <Link
                  href={buildWorkspaceHref({
                    scenarioId: workspaceState.activeScenarioId,
                    tab: "scenario",
                  })}
                >
                  Back to scenario
                </Link>
              ) : liveScenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div>Choose a scenario to check for player skill rolls.</div>
                  {liveScenarios.map((scenario) => (
                    <Link
                      key={scenario.id}
                      href={buildWorkspaceHref({
                        scenarioId: scenario.id,
                        tab: "player-skill-rolls",
                      })}
                    >
                      {scenario.name}
                    </Link>
                  ))}
                </div>
              ) : null}
            </section>
          )}
        </section>
      ) : null}

      {!workspaceLoadError && accessMode !== "none" && workspaceState.activeTab === "character" ? (
        <CharacterWorkspacePanel
          activeEncounter={selectedActiveEncounter}
          currentRoundNumber={activeScenarioRoundNumber}
          currentUserId={currentUser?.id}
          isGameMaster={canAccessGmEncounter}
          onSelectParticipantId={(participantId) => {
            selectInspectableParticipant({ participantId, tab: "character" });
          }}
          onScenarioParticipantUpdated={(participant) => {
            setScenarioParticipants((current) =>
              current.map((entry) => (entry.id === participant.id ? participant : entry)),
            );
          }}
          scenarioId={workspaceState.activeScenarioId}
          scenarioParticipants={scenarioParticipants}
          selectedParticipantId={searchParams.get("participantId")}
        />
      ) : null}

      {!workspaceLoadError && accessMode !== "none" && workspaceState.activeTab === "combat" ? (
        /*
         * Containment only (#601 D3). A single-column `auto` grid track takes its max-content
         * width, so the Combat panel widened the whole document to 427px in a 375px viewport and
         * the content nearest the right edge - the Parry-context modifier labels among it - fell
         * outside the visible area. `minmax(0, 1fr)` holds the track to the available width, and
         * below 960px the region around the panel gives it its own horizontal scroll affordance,
         * so nothing is hidden. At wider viewports the page was already contained and no scroll
         * region is created, because one would clip the few pixels `main`'s side padding has room
         * for (see `CampaignWorkspaceShell.module.css`). The panel's own markup and inline styles
         * are untouched.
         */
        <section style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1fr)" }}>
          {canAccessGmEncounter && selectedActiveEncounter ? (
            <>
              {sortedActiveScenarioEncounters.length > 1 ? (
                <section style={panelStyle}>
                  <strong>Encounters</strong>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {sortedActiveScenarioEncounters.map((encounter) => (
                      <Link
                        key={encounter.id}
                        href={buildWorkspaceHref({
                          encounterId: encounter.id,
                          scenarioId: encounter.scenarioId,
                          tab: "combat",
                        })}
                      >
                        {encounter.title}
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
              <div className={styles.combatPanelRegion}>
                <CombatRoundManagerPanel
                  encounter={selectedActiveEncounter}
                  key={selectedActiveEncounter.id}
                  onEncounterUpdated={acceptActiveEncounter}
                  onScenarioParticipantsUpdated={(nextParticipants) => {
                    setScenarioParticipants((current) =>
                      current.map(
                        (participant) =>
                          nextParticipants.find((entry) => entry.id === participant.id) ??
                          participant,
                      ),
                    );
                  }}
                  scenarioParticipants={scenarioParticipants}
                />
              </div>
            </>
          ) : canAccessGmEncounter ? (
            <section style={panelStyle}>
              <strong>Select an encounter to open the Combat Round Manager.</strong>
              {sortedActiveScenarioEncounters.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {sortedActiveScenarioEncounters.map((encounter) => (
                    <Link
                      key={encounter.id}
                      href={buildWorkspaceHref({
                        encounterId: encounter.id,
                        scenarioId: encounter.scenarioId,
                        tab: "combat",
                      })}
                    >
                      {encounter.title}
                    </Link>
                  ))}
                </div>
              ) : (
                <>
                  <div>No encounter is currently available for combat tools.</div>
                  {workspaceState.activeScenarioId ? (
                    <Link
                      href={buildWorkspaceHref({
                        scenarioId: workspaceState.activeScenarioId,
                        tab: "scenario",
                      })}
                    >
                      Create or open an encounter on Scenario tab
                    </Link>
                  ) : null}
                </>
              )}
            </section>
          ) : (
            <section style={panelStyle}>
              <strong>Combat Round Manager is a GM tool.</strong>
              {liveScenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <Link href={buildWorkspaceHref({ tab: "player-combat" })}>
                    Open Player combat
                  </Link>
                </div>
              ) : (
                <div>No combat encounter is currently available.</div>
              )}
            </section>
          )}
        </section>
      ) : null}

      {!workspaceLoadError &&
      accessMode !== "none" &&
      workspaceState.activeTab === "player-combat" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {canAccessGmEncounter && workspaceState.activeScenarioId && selectedActiveEncounter ? (
            <>
              <WorkspaceParticipantInspectionHeader
                candidates={gmInspectableCandidates}
                isGameMaster={canAccessGmEncounter}
                onSelectParticipantId={(participantId) =>
                  selectInspectableParticipant({ participantId, tab: "player-combat" })
                }
                screenName="Player combat"
                selectedCandidate={selectedGmInspectableCandidate}
              />
              {selectedGmInspectableCandidate ? (
                <ScenarioPlayerCombatPageContent
                  campaignId={campaignId}
                  encounterId={workspaceState.activeEncounterId}
                  embedded
                  encounterTitle={selectedActiveEncounter.title}
                  key={`${selectedActiveEncounter.id}:${selectedGmInspectableCandidate.id}`}
                  participantId={selectedGmInspectableCandidate.id}
                  readOnlyInspection
                  scenarioId={workspaceState.activeScenarioId}
                  showParticipantSelector={false}
                  showWorkspaceHeader={false}
                  workspaceTab="player-combat"
                />
              ) : (
                <section style={panelStyle}>
                  <div>No participant is available for player combat.</div>
                </section>
              )}
            </>
          ) : canAccessGmEncounter ? (
            <section style={panelStyle}>
              <strong>Select an encounter to open player combat.</strong>
              {sortedActiveScenarioEncounters.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {sortedActiveScenarioEncounters.map((encounter) => (
                    <Link
                      key={encounter.id}
                      href={buildWorkspaceHref({
                        encounterId: encounter.id,
                        scenarioId: encounter.scenarioId,
                        tab: "player-combat",
                      })}
                    >
                      {encounter.title}
                    </Link>
                  ))}
                </div>
              ) : (
                <div>No player combat view is currently available.</div>
              )}
            </section>
          ) : workspaceState.activeScenarioId ? (
            <ScenarioPlayerCombatPageContent
              campaignId={campaignId}
              encounterId={workspaceState.activeEncounterId}
              embedded
              encounterTitle={activeEncounterSummary?.title}
              participantId={searchParams.get("participantId") ?? undefined}
              scenarioId={workspaceState.activeScenarioId}
              showParticipantSelector={false}
              workspaceTab="player-combat"
            />
          ) : (
            <section style={panelStyle}>
              <strong>Select a scenario to open player combat.</strong>
              {liveScenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {liveScenarios.map((scenario) => (
                    <Link
                      key={scenario.id}
                      href={buildWorkspaceHref({
                        scenarioId: scenario.id,
                        tab: "player-combat",
                      })}
                    >
                      {scenario.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <div>No player combat view is currently available.</div>
              )}
            </section>
          )}
        </section>
      ) : null}
    </section>
  );
}
