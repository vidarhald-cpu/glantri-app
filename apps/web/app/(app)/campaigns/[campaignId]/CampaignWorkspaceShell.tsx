"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { Campaign, EncounterSession, Scenario } from "@glantri/domain";

import { loadScenarioEncounters } from "../../../../src/lib/api/localServiceClient";
import {
  REMEMBERED_SELECTION_KEYS,
  useRememberedSelection,
} from "../../../../src/lib/browser/rememberedSelection";
import { useSessionUser } from "../../../../src/lib/auth/SessionUserContext";
import { canManageCampaignWorkspace, loadCampaignWorkspaceAccessForUser } from "../../../../src/lib/campaigns/access";
import {
  getCampaignWorkspaceVisibleEncounters,
  getScenarioVisibleEncounters,
} from "../../../../src/lib/campaigns/encounters";
import { getCampaignWorkspaceSelectionKeys } from "../../../../src/lib/campaigns/RememberedCampaignWorkspaceEffect";
import {
  buildCampaignWorkspaceHref,
  buildCampaignWorkspaceTabs,
  resolveCampaignWorkspaceState,
  type CampaignWorkspaceTabId
} from "../../../../src/lib/campaigns/workspace";
import EncounterDetail from "../../encounters/[id]/EncounterDetail";
import CampaignDetailPageContent from "./CampaignDetailPageContent";
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

  async function refreshWorkspaceContext() {
    const workspaceAccess = await loadCampaignWorkspaceAccessForUser({
      campaignId,
      user: currentUser,
    });
    const scenarioIds = workspaceAccess.scenarios.map((scenario) => scenario.id);
    const encounterGroups = await Promise.all(
      workspaceAccess.scenarios.map((scenario) => loadScenarioEncounters(scenario.id)),
    );
    const nextEncounters = encounterGroups.flat();

    setAccessibleCampaign(workspaceAccess.campaign ?? null);
    setAccessMode(workspaceAccess.accessMode);
    setScenarios(workspaceAccess.scenarios);
    setEncounters(
      getCampaignWorkspaceVisibleEncounters({
        campaignId,
        encounters: nextEncounters,
        scenarioIds,
      }),
    );
  }

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    setLoading(true);
    refreshWorkspaceContext()
      .then(() => {
        setError(undefined);
      })
      .catch((caughtError) => {
        setError(
          caughtError instanceof Error ? caughtError.message : "Unable to load campaign workspace.",
        );
        setAccessMode("none");
        setAccessibleCampaign(null);
        setScenarios([]);
        setEncounters([]);
      })
      .finally(() => setLoading(false));
  }, [campaignId, currentUser, sessionLoading]);

  const workspaceState = useMemo(
    () =>
      resolveCampaignWorkspaceState({
        activeCampaignId: campaignId,
        canAccessGmEncounter,
        encounters,
        rememberedEncounterId: rememberedEncounterSelection.value,
        rememberedScenarioId: rememberedScenarioSelection.value,
        rememberedTab: rememberedWorkspaceTab.value,
        requestedEncounterId: searchParams.get("encounterId"),
        requestedScenarioId: searchParams.get("scenarioId"),
        requestedTab: searchParams.get("tab"),
        scenarios
      }),
    [
      campaignId,
      canAccessGmEncounter,
      encounters,
      rememberedEncounterSelection.value,
      rememberedScenarioSelection.value,
      rememberedWorkspaceTab.value,
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
        requestedTabFromUrl === "player-encounter" || workspaceState.activeTab === "player-encounter"
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
                {accessibleCampaign?.description || "This player account can access the scenarios below."}
              </div>
              <div>
                Accessible scenarios:{" "}
                {scenarios.length > 0
                  ? scenarios.map((scenario) => scenario.name).join(", ")
                  : "None"}
              </div>
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
            <section style={panelStyle}>Open a scenario from the campaign Scenarios list to load this tab.</section>
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
              Select a scenario and encounter from the workspace picker to open the player
              encounter tab.
            </section>
          )}
        </section>
      ) : null}
    </section>
  );
}
