"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { createCampaignOnServer, type AccessibleCampaignRecord } from "@/lib/api/campaignClient";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import { canManageCampaignWorkspace, loadCampaignBrowserRecordsForUser } from "@/lib/campaigns/access";
import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";

export default function CampaignsPageContent() {
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [campaigns, setCampaigns] = useState<AccessibleCampaignRecord[]>([]);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const canManageCampaigns = canManageCampaignWorkspace(currentUser);

  async function refreshCampaigns() {
    const nextCampaigns = await loadCampaignBrowserRecordsForUser(currentUser);
    setCampaigns(nextCampaigns);
  }

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    refreshCampaigns()
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load campaigns.");
      })
      .finally(() => setLoading(false));
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
          defaultVisibility: "hidden"
        },
        status: "draft"
      });

      setFeedback(`Created campaign ${campaign.name}.`);
      setName("");
      setDescription("");
      await refreshCampaigns();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create campaign.");
    }
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 920 }}>
      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Campaigns</h1>
        <p style={{ margin: 0 }}>
          {canManageCampaigns
            ? "Basic GM campaign management for scenarios, campaign NPC rosters, and assets. Reusable templates now live in the shared Templates library."
            : "Choose an available campaign to continue your story."}
        </p>
      </div>

      {canManageCampaigns ? (
        <section
          style={{
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "0.75rem",
            padding: "1rem"
          }}
        >
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

      {error ? <div>{error}</div> : null}
      {feedback ? <div>{feedback}</div> : null}

      {sessionLoading || loading ? (
        <div>Loading campaigns...</div>
      ) : campaigns.length > 0 ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {campaigns.map(({ campaign, scenarios }) => (
            <div
              key={campaign.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "0.35rem",
                padding: "1rem"
              }}
            >
              <strong>{campaign.name}</strong>
              <div>{campaign.description || "No description yet."}</div>
              {canManageCampaigns ? (
                <>
                  <div>Status: {campaign.status}</div>
                </>
              ) : scenarios.length > 0 ? (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {scenarios.map((scenario) => (
                    <Link
                      key={scenario.id}
                      href={buildCampaignWorkspaceHref({
                        campaignId: campaign.id,
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
              <div>
                <Link
                  href={buildCampaignWorkspaceHref({
                    campaignId: campaign.id,
                    tab: "campaign",
                  })}
                >
                  Open campaign
                </Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          {canManageCampaigns ? "No campaigns yet." : "No accessible campaigns yet."}
        </div>
      )}
    </section>
  );
}
