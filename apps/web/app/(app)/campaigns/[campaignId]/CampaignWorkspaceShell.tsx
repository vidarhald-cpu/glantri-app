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
  buildCampaignWorkspaceHref,
  buildCampaignWorkspaceTabs,
  resolveCampaignWorkspaceState,
  type CampaignWorkspaceTabId,
} from "@/lib/campaigns/workspace";
import { buildGmCharacterWorkspaceCandidates } from "@/lib/campaigns/characterWorkspace";
import EncounterDetail from "@/features/encounters/EncounterDetail";
import CampaignDetailPageContent from "./CampaignDetailPageContent";
import CampaignWorkspaceLoadErrorState from "./CampaignWorkspaceLoadErrorState";
import CharacterWorkspacePanel from "./CharacterWorkspacePanel";
import WorkspaceParticipantInspectionHeader from "./WorkspaceParticipantInspectionHeader";
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

export default function CampaignWorkspaceShell({ campaignId }: CampaignWorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamString = searchParams.toString();
  const { currentUser, loading: sessionLoading } = useSessionUser();
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
  const canAccessGmEncounter = canManageCampaignWorkspace(currentUser);
  const rememberedCampaignSelection = useRememberedSelection(REMEMBERED_SELECTION_KEYS.campaignId);
  const workspaceSelectionKeys = useMemo(
    () => getCampaignWorkspaceSelectionKeys(campaignId),
    [campaignId],
  );
  const rememberedScenarioSelection = useRememberedSelection(workspaceSelectionKeys.scenarioId);
  const rememberedEncounterSelection = useRememberedSelection(workspaceSelectionKeys.encounterId);
  const rememberedWorkspaceTab = useRememberedSelection(workspaceSelectionKeys.workspaceTab);

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

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setAccessMode(canManageCampaignWorkspace(currentUser) ? "gm" : "player");

    async function initializeWorkspace() {
      try {
        const initialData = await loadCampaignWorkspaceInitialData({
          loadAccess: () =>
            loadCampaignWorkspaceAccessForUser({
              campaignId,
              user: currentUser,
            }),
          loadEncounterSummaries: loadScenarioEncounterSummaries,
          loadMyParticipant: loadScenarioMyParticipant,
          loadParticipants: loadScenarioParticipants,
        });
        const workspaceAccess = initialData.access;
        const scenarioIds = workspaceAccess.scenarios.map((scenario) => scenario.id);

        if (cancelled) return;

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
        if (cancelled) return;

        setError(undefined);
        setWorkspaceLoadError(true);
        setAccessibleCampaign(null);
        setScenarios([]);
        setScenarioParticipants([]);
        setEncounterSummaries([]);
        setActiveEncounter(undefined);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initializeWorkspace();

    return () => {
      cancelled = true;
    };
  }, [campaignId, currentUser, loadAttempt, sessionLoading]);

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
  const activeScenarios = scenarios.filter(
    (scenario) => scenario.status !== "completed" && scenario.status !== "archived",
  );
  const completedScenarios = scenarios.filter((scenario) => scenario.status === "completed");
  const activeScenario = scenarios.find(
    (scenario) => scenario.id === workspaceState.activeScenarioId,
  );
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
        participantId: nextParams.get("participantId"),
        scenarioId: nextParams.get("scenarioId"),
        tab: (nextParams.get("tab") as CampaignWorkspaceTabId | null) ?? undefined,
      });
    },
    [campaignId, searchParamString],
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

    rememberedCampaignSelection.setValue(campaignId);
  }, [accessMode, campaignId, rememberedCampaignSelection, workspaceLoadError]);

  useEffect(() => {
    if (sessionLoading || loading || workspaceLoadError) {
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
    const nextHref = buildWorkspaceHref({
      encounterId: searchParams.get("encounterId") ?? workspaceState.activeEncounterId ?? null,
      participantId:
        requestedTabFromUrl === "player-encounter" ||
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
        workspaceState.activeTab === "player-combat"
          ? searchParams.get("participantId")
          : null,
      scenarioId: searchParams.get("scenarioId") ?? workspaceState.activeScenarioId ?? null,
      tab: requestedTabFromUrl ?? workspaceState.activeTab,
    });
    const currentHref = searchParamString ? `${pathname}?${searchParamString}` : pathname;

    if (nextHref !== currentHref) {
      router.replace(nextHref);
    }
  }, [
    buildWorkspaceHref,
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
    rememberedScenarioSelection.setValue(workspaceState.activeScenarioId);
  }, [rememberedScenarioSelection, workspaceState.activeScenarioId]);

  useEffect(() => {
    rememberedEncounterSelection.setValue(workspaceState.activeEncounterId);
  }, [rememberedEncounterSelection, workspaceState.activeEncounterId]);

  useEffect(() => {
    rememberedWorkspaceTab.setValue(workspaceState.activeTab);
  }, [rememberedWorkspaceTab, workspaceState.activeTab]);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1240 }}>
      <nav
        aria-label="Campaign workspace"
        style={{
          borderBottom: "1px solid #d9ddd8",
          display: "flex",
          flexWrap: "wrap",
          gap: "1rem",
          paddingBottom: "0.5rem",
        }}
      >
        <Link
          href="/campaigns"
          style={{
            borderBottom: pathname === "/campaigns" ? "2px solid #2f5d62" : "2px solid transparent",
            color: "#2f5d62",
            fontWeight: 700,
            paddingBottom: "0.35rem",
            textDecoration: "none",
          }}
        >
          Campaigns
        </Link>
        {tabs.map((tab) => {
          const href = buildWorkspaceHref({ tab: tab.id });

          return (
            <Link
              key={tab.id}
              href={href}
              style={{
                borderBottom:
                  workspaceState.activeTab === tab.id
                    ? "2px solid #2f5d62"
                    : "2px solid transparent",
                color: "#2f5d62",
                fontWeight: 700,
                paddingBottom: "0.35rem",
                textDecoration: "none",
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {error ? <section style={panelStyle}>{error}</section> : null}

      {workspaceLoadError ? (
        <CampaignWorkspaceLoadErrorState
          onRetry={() => setLoadAttempt((current) => current + 1)}
          retrying={loading}
        />
      ) : null}

      {!loading && !workspaceLoadError && accessMode === "none" ? (
        <section style={panelStyle}>
          <strong>Campaign unavailable</strong>
          <div>This campaign is not accessible for the current player account.</div>
          <Link href="/campaigns">Back to campaigns</Link>
        </section>
      ) : null}

      {!workspaceLoadError && accessMode !== "none" && workspaceState.activeTab === "campaign" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {canAccessGmEncounter ? (
            <CampaignDetailPageContent
              campaignId={campaignId}
              embedded
              onWorkspaceScenariosChanged={setScenarios}
            />
          ) : (
            <section style={{ display: "grid", gap: "1rem" }}>
              <section style={panelStyle}>
                <h2 style={{ margin: 0 }}>{accessibleCampaign?.name ?? "Campaign"}</h2>
                <div>
                  {accessibleCampaign?.description ||
                    "No campaign description has been written yet."}
                </div>
                <section style={{ display: "grid", gap: "0.5rem" }}>
                  <h3 style={{ margin: 0 }}>Available scenarios</h3>
                  {activeScenarios.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {activeScenarios.map((scenario) => (
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
          <CampaignItemsWorkspace campaignId={campaignId} />
        ) : null
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
        <section style={{ display: "grid", gap: "1rem" }}>
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
              {activeScenarios.length > 0 || completedScenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {[...activeScenarios, ...completedScenarios].map((scenario) => (
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
              ) : activeScenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div>Choose a scenario to check for player encounters.</div>
                  {activeScenarios.map((scenario) => (
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
              ) : activeScenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div>Choose a scenario to check for player skill rolls.</div>
                  {activeScenarios.map((scenario) => (
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
        <section style={{ display: "grid", gap: "1rem" }}>
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
              {activeScenarios.length > 0 ? (
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
              {activeScenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {activeScenarios.map((scenario) => (
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
