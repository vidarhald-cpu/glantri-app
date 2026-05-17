"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Campaign, EncounterSession, Scenario, ScenarioParticipant } from "@glantri/domain";

import { loadScenarioEncounters, loadScenarioParticipants } from "@/lib/api/localServiceClient";
import {
  REMEMBERED_SELECTION_KEYS,
  useRememberedSelection,
} from "@/lib/browser/rememberedSelection";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import { canManageCampaignWorkspace, loadCampaignWorkspaceAccessForUser } from "@/lib/campaigns/access";
import {
  getCampaignWorkspaceVisibleEncounters,
  getScenarioVisibleEncounters,
} from "@/lib/campaigns/encounters";
import { getCampaignWorkspaceSelectionKeys } from "@/lib/campaigns/RememberedCampaignWorkspaceEffect";
import {
  buildCampaignWorkspaceHref,
  buildCampaignWorkspaceTabs,
  resolveCampaignWorkspaceState,
  type CampaignWorkspaceTabId
} from "@/lib/campaigns/workspace";
import EncounterDetail from "../../encounters/[id]/EncounterDetail";
import CampaignDetailPageContent from "./CampaignDetailPageContent";
import CharacterWorkspacePanel from "./CharacterWorkspacePanel";
import ScenarioDetailPageContent from "./scenarios/[scenarioId]/ScenarioDetailPageContent";
import ScenarioPlayerPageContent from "./scenarios/[scenarioId]/player/ScenarioPlayerPageContent";
import ScenarioPlayerCombatPageContent from "./scenarios/[scenarioId]/player/combat/ScenarioPlayerCombatPageContent";
import { PlayerRoleplayingEncounterScreen } from "../../encounters/[id]/RoleplayEncounterScreens";

interface CampaignWorkspaceShellProps {
  campaignId: string;
}

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem"
} as const;

export default function CampaignWorkspaceShell({
  campaignId
}: CampaignWorkspaceShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [accessibleCampaign, setAccessibleCampaign] = useState<Campaign | null>(null);
  const [accessMode, setAccessMode] = useState<"gm" | "player" | "none">("gm");
  const [encounters, setEncounters] = useState<EncounterSession[]>([]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [scenarioParticipants, setScenarioParticipants] = useState<ScenarioParticipant[]>([]);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const canAccessGmEncounter = canManageCampaignWorkspace(currentUser);
  const rememberedCampaignSelection = useRememberedSelection(
    REMEMBERED_SELECTION_KEYS.campaignId,
  );
  const workspaceSelectionKeys = useMemo(
    () => getCampaignWorkspaceSelectionKeys(campaignId),
    [campaignId],
  );
  const rememberedScenarioSelection = useRememberedSelection(
    workspaceSelectionKeys.scenarioId,
  );
  const rememberedEncounterSelection = useRememberedSelection(
    workspaceSelectionKeys.encounterId,
  );
  const rememberedWorkspaceTab = useRememberedSelection(
    workspaceSelectionKeys.workspaceTab,
  );

  const refreshWorkspaceContext = useCallback(async () => {
    const workspaceAccess = await loadCampaignWorkspaceAccessForUser({
      campaignId,
      user: currentUser,
    });
    const scenarioIds = workspaceAccess.scenarios.map((scenario) => scenario.id);
    const encounterGroups = await Promise.all(
      workspaceAccess.scenarios.map((scenario) => loadScenarioEncounters(scenario.id)),
    );
    const participantGroups = await Promise.all(
      workspaceAccess.scenarios.map((scenario) => loadScenarioParticipants(scenario.id)),
    );
    const nextEncounters = encounterGroups.flat();
    const nextScenarioParticipants = participantGroups.flat();

    setAccessibleCampaign(workspaceAccess.campaign ?? null);
    setAccessMode(workspaceAccess.accessMode);
    setScenarios(workspaceAccess.scenarios);
    setScenarioParticipants(nextScenarioParticipants);
    setEncounters(
      getCampaignWorkspaceVisibleEncounters({
        campaignId,
        encounters: nextEncounters,
        scenarioIds,
      }),
    );
  }, [campaignId, currentUser]);

  const refreshWorkspaceContextWithErrorHandling = useCallback(async () => {
    try {
      await refreshWorkspaceContext();
      setError(undefined);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to load campaign workspace.",
      );
      setAccessMode("none");
      setAccessibleCampaign(null);
      setScenarios([]);
      setScenarioParticipants([]);
      setEncounters([]);
    }
  }, [refreshWorkspaceContext]);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    setLoading(true);
    refreshWorkspaceContextWithErrorHandling()
      .finally(() => setLoading(false));
  }, [refreshWorkspaceContextWithErrorHandling, sessionLoading]);

  useEffect(() => {
    if (sessionLoading || loading) {
      return;
    }

    void refreshWorkspaceContextWithErrorHandling();
  }, [loading, refreshWorkspaceContextWithErrorHandling, searchParams, sessionLoading]);

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    function refreshVisibleWorkspace() {
      if (document.visibilityState === "hidden") {
        return;
      }

      void refreshWorkspaceContextWithErrorHandling();
    }

    window.addEventListener("focus", refreshVisibleWorkspace);
    document.addEventListener("visibilitychange", refreshVisibleWorkspace);

    return () => {
      window.removeEventListener("focus", refreshVisibleWorkspace);
      document.removeEventListener("visibilitychange", refreshVisibleWorkspace);
    };
  }, [refreshWorkspaceContextWithErrorHandling, sessionLoading]);

  const workspaceState = useMemo(
    () =>
      resolveCampaignWorkspaceState({
        activeCampaignId: campaignId,
        canAccessGmEncounter,
        currentUserId: currentUser?.id,
        encounters,
        rememberedEncounterId: rememberedEncounterSelection.value,
        rememberedScenarioId: rememberedScenarioSelection.value,
        rememberedTab: rememberedWorkspaceTab.value,
        requestedEncounterId: searchParams.get("encounterId"),
        requestedScenarioId: searchParams.get("scenarioId"),
        requestedTab: searchParams.get("tab"),
        scenarioParticipants,
        scenarios
      }),
    [
      campaignId,
      canAccessGmEncounter,
      currentUser?.id,
      encounters,
      rememberedEncounterSelection.value,
      rememberedScenarioSelection.value,
      rememberedWorkspaceTab.value,
      scenarioParticipants,
      scenarios,
      searchParams,
    ]
  );

  const tabs = useMemo(
    () => buildCampaignWorkspaceTabs({ canAccessGmEncounter }),
    [canAccessGmEncounter]
  );
  const activeScenarioEncounters = getScenarioVisibleEncounters({
    encounters,
    scenarioId: workspaceState.activeScenarioId,
  });
  const activeEncounter = activeScenarioEncounters.find(
    (encounter) => encounter.id === workspaceState.activeEncounterId
  );
  const currentUserActiveScenarioParticipant = scenarioParticipants.find(
    (participant) =>
      Boolean(currentUser?.id) &&
      participant.scenarioId === workspaceState.activeScenarioId &&
      participant.isActive &&
      participant.role === "player_character" &&
      participant.controlledByUserId === currentUser?.id
  );
  const playerEncounterEmptyDetail =
    workspaceState.activeScenarioId &&
    currentUserActiveScenarioParticipant &&
    activeScenarioEncounters.some((encounter) => encounter.status !== "archived")
      ? "You are in this scenario, but not assigned to this encounter."
      : "Waiting for GM to add you to an encounter.";

  function buildWorkspaceHref(partial: {
    encounterId?: string | null;
    participantId?: string | null;
    scenarioId?: string | null;
    tab?: CampaignWorkspaceTabId | null;
  }): string {
    const nextParams = new URLSearchParams(searchParams.toString());

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

    return buildCampaignWorkspaceHref({
      campaignId,
      encounterId: nextParams.get("encounterId"),
      participantId: nextParams.get("participantId"),
      scenarioId: nextParams.get("scenarioId"),
      tab: (nextParams.get("tab") as CampaignWorkspaceTabId | null) ?? undefined,
    });
  }

  useEffect(() => {
    if (accessMode === "none") {
      return;
    }

    rememberedCampaignSelection.setValue(campaignId);
  }, [accessMode, campaignId, rememberedCampaignSelection]);

  useEffect(() => {
    if (
      !rememberedScenarioSelection.hydrated ||
      !rememberedEncounterSelection.hydrated ||
      !rememberedWorkspaceTab.hydrated
    ) {
      return;
    }

    if (!searchParams.get("scenarioId") && rememberedScenarioSelection.value && !workspaceState.activeScenarioId) {
      rememberedScenarioSelection.setValue(undefined);
    }

    if (!searchParams.get("encounterId") && rememberedEncounterSelection.value && !workspaceState.activeEncounterId) {
      rememberedEncounterSelection.setValue(undefined);
    }

    const requestedTabFromUrl = tabs.find((tab) => tab.id === searchParams.get("tab"))?.id;
    const nextHref = buildWorkspaceHref({
      encounterId:
        searchParams.get("encounterId") ?? workspaceState.activeEncounterId ?? null,
      participantId:
        requestedTabFromUrl === "player-encounter" ||
        requestedTabFromUrl === "character" ||
        requestedTabFromUrl === "combat" ||
        workspaceState.activeTab === "player-encounter" ||
        workspaceState.activeTab === "character" ||
        workspaceState.activeTab === "combat"
          ? searchParams.get("participantId")
          : null,
      scenarioId:
        searchParams.get("scenarioId") ?? workspaceState.activeScenarioId ?? null,
      tab: requestedTabFromUrl ?? workspaceState.activeTab,
    });
    const currentHref = searchParams.toString() ? `${pathname}?${searchParams.toString()}` : pathname;

    if (nextHref !== currentHref) {
      router.replace(nextHref);
    }
  }, [
    buildWorkspaceHref,
    pathname,
    rememberedEncounterSelection,
    rememberedScenarioSelection,
    rememberedWorkspaceTab.hydrated,
    router,
    searchParams,
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
          paddingBottom: "0.5rem"
        }}
      >
        <Link
          href="/campaigns"
          style={{
            borderBottom: pathname === "/campaigns" ? "2px solid #2f5d62" : "2px solid transparent",
            color: "#2f5d62",
            fontWeight: 700,
            paddingBottom: "0.35rem",
            textDecoration: "none"
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
                textDecoration: "none"
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {error ? <section style={panelStyle}>{error}</section> : null}

      {!loading && accessMode === "none" ? (
        <section style={panelStyle}>
          <strong>Campaign unavailable</strong>
          <div>This campaign is not accessible for the current player account.</div>
          <Link href="/campaigns">Back to campaigns</Link>
        </section>
      ) : null}

      {accessMode !== "none" && workspaceState.activeTab === "campaign" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {canAccessGmEncounter ? (
            <CampaignDetailPageContent
              campaignId={campaignId}
              embedded
              onWorkspaceScenariosChanged={setScenarios}
            />
          ) : (
            <section style={panelStyle}>
              <h2 style={{ margin: 0 }}>{accessibleCampaign?.name ?? "Campaign"}</h2>
              <div>
                {accessibleCampaign?.description || "No campaign description has been written yet."}
              </div>
              <section style={{ display: "grid", gap: "0.5rem" }}>
                <h3 style={{ margin: 0 }}>Available scenarios</h3>
                {scenarios.length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                    {scenarios.map((scenario) => (
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
            </section>
          )}
        </section>
      ) : null}

      {accessMode !== "none" && workspaceState.activeTab === "scenario" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {workspaceState.activeScenarioId ? (
            canAccessGmEncounter ? (
              <ScenarioDetailPageContent
                campaignId={campaignId}
                embedded
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
              {scenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {scenarios.map((scenario) => (
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

      {accessMode !== "none" && workspaceState.activeTab === "gm-encounter" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {workspaceState.activeScenarioId && workspaceState.activeEncounterId ? (
            <EncounterDetail
              campaignId={campaignId}
              embedded
              id={workspaceState.activeEncounterId}
              scenarioId={workspaceState.activeScenarioId}
            />
          ) : (
            <section style={panelStyle}>
              Select a scenario and encounter from the workspace picker to open the GM encounter
              tab.
            </section>
          )}
        </section>
      ) : null}

      {accessMode !== "none" && workspaceState.activeTab === "player-encounter" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {workspaceState.activeScenarioId && workspaceState.activeEncounterId && activeEncounter?.kind === "roleplay" ? (
            <PlayerRoleplayingEncounterScreen
              campaignId={campaignId}
              embedded
              encounterId={workspaceState.activeEncounterId}
              scenarioId={workspaceState.activeScenarioId}
            />
          ) : workspaceState.activeScenarioId && workspaceState.activeEncounterId ? (
            <ScenarioPlayerCombatPageContent
              campaignId={campaignId}
              encounterId={workspaceState.activeEncounterId}
              embedded
              encounterTitle={activeEncounter?.title}
              participantId={searchParams.get("participantId") ?? undefined}
              scenarioId={workspaceState.activeScenarioId}
            />
          ) : (
            <section style={panelStyle}>
              <strong>No player encounter is currently available.</strong>
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
              ) : scenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  <div>Choose a scenario to check for player encounters.</div>
                  {scenarios.map((scenario) => (
                    <Link
                      key={scenario.id}
                      href={buildWorkspaceHref({
                        scenarioId: scenario.id,
                        tab: "player-encounter",
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

      {accessMode !== "none" && workspaceState.activeTab === "character" ? (
        <CharacterWorkspacePanel
          activeEncounter={activeEncounter}
          currentUserId={currentUser?.id}
          isGameMaster={canAccessGmEncounter}
          onSelectParticipantId={(participantId) => {
            router.replace(
              buildWorkspaceHref({
                participantId,
                tab: "character",
              }),
            );
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

      {accessMode !== "none" && workspaceState.activeTab === "combat" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {workspaceState.activeScenarioId ? (
            <ScenarioPlayerCombatPageContent
              campaignId={campaignId}
              encounterId={workspaceState.activeEncounterId}
              embedded
              encounterTitle={activeEncounter?.title}
              participantId={searchParams.get("participantId") ?? undefined}
              scenarioId={workspaceState.activeScenarioId}
              workspaceTab="combat"
            />
          ) : (
            <section style={panelStyle}>
              <strong>Select a scenario to open the combat panel.</strong>
              {scenarios.length > 0 ? (
                <div style={{ display: "grid", gap: "0.5rem" }}>
                  {scenarios.map((scenario) => (
                    <Link
                      key={scenario.id}
                      href={buildWorkspaceHref({
                        scenarioId: scenario.id,
                        tab: "combat",
                      })}
                    >
                      {scenario.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <div>No combat encounter is currently available.</div>
              )}
            </section>
          )}
        </section>
      ) : null}
    </section>
  );
}
