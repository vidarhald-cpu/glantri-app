"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { EncounterSession, Scenario } from "@glantri/domain";

import { loadCampaignScenarios } from "../../../../src/lib/api/localServiceClient";
import {
  REMEMBERED_SELECTION_KEYS,
  useRememberedSelection,
} from "../../../../src/lib/browser/rememberedSelection";
import { useSessionUser } from "../../../../src/lib/auth/SessionUserContext";
import { getCampaignWorkspaceSelectionKeys } from "../../../../src/lib/campaigns/RememberedCampaignWorkspaceEffect";
import {
  buildCampaignWorkspaceHref,
  buildCampaignWorkspaceTabs,
  resolveCampaignWorkspaceState,
  type CampaignWorkspaceTabId
} from "../../../../src/lib/campaigns/workspace";
import { LocalEncounterRepository } from "../../../../src/lib/offline/repositories/localEncounterRepository";
import EncounterDetail from "../../encounters/[id]/EncounterDetail";
import CampaignDetailPageContent from "./CampaignDetailPageContent";
import ScenarioDetailPageContent from "./scenarios/[scenarioId]/ScenarioDetailPageContent";
import ScenarioPlayerCombatPageContent from "./scenarios/[scenarioId]/player/combat/ScenarioPlayerCombatPageContent";

interface CampaignWorkspaceShellProps {
  campaignId: string;
}

const localEncounterRepository = new LocalEncounterRepository();

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
  const { currentUser } = useSessionUser();
  const [encounters, setEncounters] = useState<EncounterSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const canAccessGmEncounter = Boolean(
    currentUser?.roles.includes("game_master") || currentUser?.roles.includes("admin")
  );
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
    const nextScenarios = await loadCampaignScenarios(campaignId);
    const nextEncounters = await localEncounterRepository.list();
    const scenarioIds = new Set(nextScenarios.map((scenario) => scenario.id));

    setScenarios(nextScenarios);
    setEncounters(
      nextEncounters.filter(
        (encounter) =>
          (encounter.campaignId ? encounter.campaignId === campaignId : true) &&
          (encounter.scenarioId ? scenarioIds.has(encounter.scenarioId) : true)
      )
    );
  }

  useEffect(() => {
    refreshWorkspaceContext()
      .catch(() => {
        setScenarios([]);
        setEncounters([]);
      })
      .finally(() => setLoading(false));
  }, [campaignId]);

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
  const activeScenarioEncounters = encounters.filter(
    (encounter) => encounter.scenarioId === workspaceState.activeScenarioId
  );
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
    rememberedCampaignSelection.setValue(campaignId);
  }, [campaignId, rememberedCampaignSelection]);

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

      {workspaceState.activeTab !== "player-encounter" ? (
        <section style={panelStyle}>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "minmax(220px, 1fr) minmax(220px, 1fr) minmax(220px, 1fr)"
            }}
          >
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Campaign</span>
              <input disabled value={workspaceState.activeCampaignId} />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Scenario</span>
              <select
                disabled={loading || scenarios.length === 0}
                onChange={(event) => {
                  window.location.href = buildWorkspaceHref({
                    encounterId: null,
                    scenarioId: event.target.value || null
                  });
                }}
                value={workspaceState.activeScenarioId ?? ""}
              >
                <option value="">Select scenario</option>
                {scenarios.map((scenario) => (
                  <option key={scenario.id} value={scenario.id}>
                    {scenario.name} ({scenario.kind}, {scenario.status})
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Encounter</span>
              <select
                disabled={!workspaceState.activeScenarioId}
                onChange={(event) => {
                  window.location.href = buildWorkspaceHref({
                    encounterId: event.target.value || null
                  });
                }}
                value={workspaceState.activeEncounterId ?? ""}
              >
                <option value="">Select encounter</option>
                {activeScenarioEncounters.map((encounter) => (
                  <option key={encounter.id} value={encounter.id}>
                    {encounter.title} ({encounter.status})
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>
      ) : null}

      {workspaceState.activeTab === "campaign" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          <CampaignDetailPageContent
            campaignId={campaignId}
            embedded
            onWorkspaceScenariosChanged={setScenarios}
          />
        </section>
      ) : null}

      {workspaceState.activeTab === "scenario" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {workspaceState.activeScenarioId ? (
            <ScenarioDetailPageContent
              campaignId={campaignId}
              embedded
              scenarioId={workspaceState.activeScenarioId}
            />
          ) : (
            <section style={panelStyle}>Open a scenario from the picker to load this tab.</section>
          )}
        </section>
      ) : null}

      {workspaceState.activeTab === "gm-encounter" ? (
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

      {workspaceState.activeTab === "player-encounter" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          {workspaceState.activeScenarioId && workspaceState.activeEncounterId ? (
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
