"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Campaign, PlayerCampaignHomeRecord } from "@glantri/domain";

import { createCampaignOnServer, loadPlayerCampaignHome } from "@/lib/api/campaignClient";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import {
  canManageCampaignWorkspace,
  loadCampaignBrowserRecordsForUser,
} from "@/lib/campaigns/access";
import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

function buildPlayerResumeHref(record: PlayerCampaignHomeRecord): string {
  return buildCampaignWorkspaceHref({
    campaignId: record.campaign.id,
    encounterId: record.resume.encounterId,
    scenarioId: record.resume.scenarioId,
    tab: record.resume.tab,
  });
}

function getPlayerResumeLabel(record: PlayerCampaignHomeRecord): string {
  if (record.resume.tab === "player-combat") return "Continue combat";
  if (record.resume.tab === "encounter") return "Continue encounter";
  if (record.resume.tab === "scenario") return "Continue scenario";
  return "Open campaign";
}

function PlayerCampaignCard({ record }: { record: PlayerCampaignHomeRecord }) {
  const characterLabel = record.characters.length === 1 ? "Your character" : "Your characters";

  return (
    <article style={{ ...panelStyle, background: "#fff", alignContent: "start" }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <h2 style={{ fontSize: "1.25rem", margin: 0 }}>{record.campaign.name}</h2>
        <p style={{ margin: 0 }}>
          {record.campaign.description || "No campaign briefing has been written yet."}
        </p>
      </div>

      <div>
        <strong>{characterLabel}</strong>
        <div>
          {record.characters.length > 0
            ? record.characters.map((character) => character.name).join(", ")
            : "No controlled character is currently available."}
        </div>
      </div>

      {record.scenarios.length > 0 ? (
        <div style={{ display: "grid", gap: "0.6rem" }}>
          <strong>
            {record.scenarios.length === 1 ? "Current scenario" : "Current scenarios"}
          </strong>
          {record.scenarios.map(({ characters, encounter, scenario }) => (
            <div
              key={scenario.id}
              style={{
                background: "#f6f5ef",
                borderRadius: 10,
                display: "grid",
                gap: "0.2rem",
                padding: "0.75rem",
              }}
            >
              <span>{scenario.name}</span>
              {characters.length > 0 ? (
                <small>Playing as {characters.map((character) => character.name).join(", ")}</small>
              ) : null}
              {encounter ? <small>Current encounter: {encounter.title}</small> : null}
            </div>
          ))}
        </div>
      ) : (
        <div>No active scenario is currently available.</div>
      )}

      <div>
        <Link
          href={buildPlayerResumeHref(record)}
          style={{
            background: "#2f5d62",
            borderRadius: 8,
            color: "white",
            display: "inline-block",
            fontWeight: 700,
            padding: "0.7rem 1rem",
            textDecoration: "none",
          }}
        >
          {getPlayerResumeLabel(record)}
        </Link>
      </div>
    </article>
  );
}

export default function CampaignsPageContent() {
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [playerCampaigns, setPlayerCampaigns] = useState<PlayerCampaignHomeRecord[]>([]);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const canManageCampaigns = canManageCampaignWorkspace(currentUser);

  async function refreshCampaigns() {
    setError(undefined);

    if (!currentUser) {
      setCampaigns([]);
      setPlayerCampaigns([]);
      return;
    }

    if (canManageCampaigns) {
      const nextCampaigns = await loadCampaignBrowserRecordsForUser(currentUser);
      setCampaigns(nextCampaigns.map((record) => record.campaign as Campaign));
      setPlayerCampaigns([]);
      return;
    }

    setPlayerCampaigns(await loadPlayerCampaignHome());
    setCampaigns([]);
  }

  async function handleRefreshCampaigns() {
    setLoading(true);

    try {
      await refreshCampaigns();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load campaigns.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (sessionLoading) return;

    void handleRefreshCampaigns();
  }, [currentUser, sessionLoading]);

  async function handleCreateCampaign() {
    try {
      setError(undefined);
      setFeedback(undefined);

      const campaign = await createCampaignOnServer({
        description,
        name,
        settings: {
          allowPlayerSelfJoin: false,
          defaultVisibility: "hidden",
        },
        status: "draft",
      });

      setFeedback(`Created campaign ${campaign.name}.`);
      setName("");
      setDescription("");
      await refreshCampaigns();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create campaign.");
    }
  }

  if (!sessionLoading && !currentUser) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 920 }}>
        <div>
          <h1 style={{ marginBottom: "0.5rem" }}>Campaigns</h1>
          <p style={{ margin: 0 }}>Sign in to see your Campaigns and continue playing.</p>
        </div>
        <section style={panelStyle}>
          <Link href="/auth">Sign in</Link>
        </section>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1040 }}>
      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>
          {canManageCampaigns ? "Campaigns" : "Campaign Home"}
        </h1>
        <p style={{ margin: 0 }}>
          {canManageCampaigns
            ? "Basic GM campaign management for scenarios, campaign NPC rosters, and assets. Reusable templates now live in the shared Templates library."
            : "See where your Characters are playing and continue from the current Scenario or Encounter."}
        </p>
      </div>

      {canManageCampaigns ? (
        <section style={panelStyle}>
          <h2 style={{ margin: 0 }}>Create campaign</h2>
          <input
            onChange={(event) => setName(event.target.value)}
            placeholder="Campaign name"
            value={name}
          />
          <textarea
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description"
            rows={3}
            value={description}
          />
          <div>
            <button onClick={() => void handleCreateCampaign()} type="button">
              Create campaign
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <section role="alert" style={panelStyle}>
          <div>{error}</div>
          <div>
            <button onClick={() => void handleRefreshCampaigns()} type="button">
              Try again
            </button>
          </div>
        </section>
      ) : null}
      {feedback ? <div>{feedback}</div> : null}

      {sessionLoading || loading ? (
        <div>Loading campaigns...</div>
      ) : canManageCampaigns ? (
        campaigns.length > 0 ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {campaigns.map((campaign) => (
              <div key={campaign.id} style={panelStyle}>
                <strong>{campaign.name}</strong>
                <div>{campaign.description || "No description yet."}</div>
                <div>Status: {campaign.status}</div>
                <div>
                  <Link
                    href={buildCampaignWorkspaceHref({ campaignId: campaign.id, tab: "campaign" })}
                  >
                    Open campaign
                  </Link>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <section style={{ ...panelStyle, background: "#f6f5ef" }}>No campaigns yet.</section>
        )
      ) : error ? null : playerCampaigns.length > 0 ? (
        <div
          style={{
            display: "grid",
            gap: "1rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 290px), 1fr))",
          }}
        >
          {playerCampaigns.map((record) => (
            <PlayerCampaignCard key={record.campaign.id} record={record} />
          ))}
        </div>
      ) : (
        <section style={{ ...panelStyle, background: "#f6f5ef" }}>
          <strong>No Campaigns yet</strong>
          <div>Your Campaigns will appear here when a GM adds one of your Characters.</div>
        </section>
      )}
    </section>
  );
}
