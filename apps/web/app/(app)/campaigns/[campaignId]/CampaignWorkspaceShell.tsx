"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import type { EncounterSession, Scenario } from "@glantri/domain";

import { loadCampaignScenarios } from "../../../../src/lib/api/localServiceClient";
import { useSessionUser } from "../../../../src/lib/auth/SessionUserContext";
import {
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
        requestedEncounterId: searchParams.get("encounterId"),
        requestedScenarioId: searchParams.get("scenarioId"),
        requestedTab: searchParams.get("tab"),
        scenarios
      }),
    [campaignId, canAccessGmEncounter, encounters, scenarios, searchParams]
  );

  const tabs = useMemo(
    () => buildCampaignWorkspaceTabs({ canAccessGmEncounter }),
    [canAccessGmEncounter]
  );
  const activeScenario = scenarios.find(
    (scenario) => scenario.id === workspaceState.activeScenarioId
  );
  const activeScenarioEncounters = encounters.filter(
    (encounter) => encounter.scenarioId === workspaceState.activeScenarioId
  );
  const activeEncounter = activeScenarioEncounters.find(
    (encounter) => encounter.id === workspaceState.activeEncounterId
  );

  function updateWorkspace(partial: {
    encounterId?: string | null;
    scenarioId?: string | null;
    tab?: CampaignWorkspaceTabId | null;
  }) {
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

    const query = nextParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }

  function handleOpenScenario() {
    if (!workspaceState.activeScenarioId) {
      return;
    }

    updateWorkspace({
      encounterId: null,
      tab: "scenario"
    });
  }

  function handleOpenEncounter(targetTab: "gm-encounter" | "player-encounter") {
    if (!workspaceState.activeEncounterId) {
      return;
    }

    updateWorkspace({
      tab: targetTab
    });
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1240 }}>
      <div style={{ display: "grid", gap: "0.5rem" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <Link href="/campaigns">Back to campaigns</Link>
        </div>
        <h1 style={{ margin: 0 }}>Campaign workspace</h1>
        <p style={{ margin: 0 }}>
          Follow the connected play flow from campaign setup to scenario management, encounter
          handling, and the player combat screen.
        </p>
      </div>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Workspace flow</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => updateWorkspace({ tab: tab.id })}
              style={{
                background:
                  workspaceState.activeTab === tab.id ? "#2f5d62" : "rgba(47, 93, 98, 0.08)",
                border: "1px solid #2f5d62",
                borderRadius: 999,
                color: workspaceState.activeTab === tab.id ? "#fff" : "#2f5d62",
                cursor: "pointer",
                fontWeight: 700,
                padding: "0.5rem 0.9rem"
              }}
              type="button"
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div style={{ color: "#5e5a50", display: "grid", gap: "0.25rem" }}>
          <div>Campaign: {workspaceState.activeCampaignId}</div>
          <div>Scenario: {activeScenario?.name ?? "None selected"}</div>
          <div>Encounter: {activeEncounter?.title ?? "None selected"}</div>
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Workspace selection</h2>
        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(3, minmax(220px, 1fr))" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Campaign</span>
            <input disabled value={workspaceState.activeCampaignId} />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Scenario</span>
            <select
              disabled={loading || scenarios.length === 0}
              onChange={(event) =>
                updateWorkspace({
                  encounterId: null,
                  scenarioId: event.target.value || null
                })
              }
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
              onChange={(event) =>
                updateWorkspace({
                  encounterId: event.target.value || null
                })
              }
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

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
          <button
            disabled={!workspaceState.activeScenarioId}
            onClick={handleOpenScenario}
            type="button"
          >
            Open scenario
          </button>
          {canAccessGmEncounter ? (
            <button
              disabled={!workspaceState.activeEncounterId}
              onClick={() => handleOpenEncounter("gm-encounter")}
              type="button"
            >
              Open GM encounter
            </button>
          ) : null}
          <button
            disabled={!workspaceState.activeEncounterId || !workspaceState.activeScenarioId}
            onClick={() => handleOpenEncounter("player-encounter")}
            type="button"
          >
            Open player encounter
          </button>
          {workspaceState.activeScenarioId ? (
            <Link href={`/campaigns/${campaignId}/scenarios/${workspaceState.activeScenarioId}`}>
              Full scenario page
            </Link>
          ) : null}
          {workspaceState.activeScenarioId ? (
            <Link
              href={`/campaigns/${campaignId}/scenarios/${workspaceState.activeScenarioId}/encounters`}
            >
              Full encounter list
            </Link>
          ) : null}
        </div>
      </section>

      {workspaceState.activeTab === "campaign" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          <section style={panelStyle}>
            <h2 style={{ margin: 0 }}>Campaign tab</h2>
            <div>Pick a scenario here, then open the Scenario tab to continue the play flow.</div>
            <div>
              {activeScenario ? (
                <>
                  Next scenario: <strong>{activeScenario.name}</strong>
                </>
              ) : (
                "Select a scenario from the workspace picker above."
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <button
                disabled={!workspaceState.activeScenarioId}
                onClick={handleOpenScenario}
                type="button"
              >
                Open scenario
              </button>
            </div>
          </section>
          <CampaignDetailPageContent
            campaignId={campaignId}
            embedded
            onWorkspaceScenariosChanged={setScenarios}
          />
        </section>
      ) : null}

      {workspaceState.activeTab === "scenario" ? (
        <section style={{ display: "grid", gap: "1rem" }}>
          <section style={panelStyle}>
            <h2 style={{ margin: 0 }}>Scenario tab</h2>
            <div>
              This tab is the session hub. Choose an encounter here, then open the GM or Player
              Encounter tab for the next stage.
            </div>
            <div>
              {activeScenario ? (
                <>
                  Active scenario: <strong>{activeScenario.name}</strong>
                </>
              ) : (
                "Select a scenario from the workspace picker above."
              )}
            </div>
            <div>
              {activeEncounter ? (
                <>
                  Active encounter: <strong>{activeEncounter.title}</strong>
                </>
              ) : (
                "Select an encounter to continue into the encounter tabs."
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              {canAccessGmEncounter ? (
                <button
                  disabled={!workspaceState.activeEncounterId}
                  onClick={() => handleOpenEncounter("gm-encounter")}
                  type="button"
                >
                  Open GM encounter
                </button>
              ) : null}
              <button
                disabled={!workspaceState.activeEncounterId}
                onClick={() => handleOpenEncounter("player-encounter")}
                type="button"
              >
                Open player encounter
              </button>
            </div>
          </section>
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
          <section style={panelStyle}>
            <h2 style={{ margin: 0 }}>GM Encounter tab</h2>
            <div>Use the selected encounter here for GM combat management.</div>
          </section>
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
          <section style={panelStyle}>
            <h2 style={{ margin: 0 }}>Player Encounter tab</h2>
            <div>
              This is the visible home for the player combat screen shell tied to the selected
              encounter.
            </div>
            <div>
              {activeEncounter ? (
                <>
                  Selected encounter: <strong>{activeEncounter.title}</strong>
                </>
              ) : (
                "Select an encounter to load the player combat screen."
              )}
            </div>
          </section>
          {workspaceState.activeScenarioId && workspaceState.activeEncounterId ? (
            <ScenarioPlayerCombatPageContent
              campaignId={campaignId}
              embedded
              encounterTitle={activeEncounter?.title}
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
