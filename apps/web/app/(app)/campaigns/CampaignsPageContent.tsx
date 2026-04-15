"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Campaign } from "@glantri/domain";

import {
  createCampaignOnServer,
  loadCampaigns
} from "../../../src/lib/api/localServiceClient";

export default function CampaignsPageContent() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [allowPlayerSelfJoin, setAllowPlayerSelfJoin] = useState(false);

  async function refreshCampaigns() {
    const nextCampaigns = await loadCampaigns();
    setCampaigns(nextCampaigns);
  }

  useEffect(() => {
    refreshCampaigns()
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load campaigns.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleCreateCampaign() {
    try {
      setError(undefined);
      setFeedback(undefined);

      const campaign = await createCampaignOnServer({
        description,
        name,
        settings: {
          allowPlayerSelfJoin,
          defaultVisibility: "hidden"
        },
        status: "draft"
      });

      setFeedback(`Created campaign ${campaign.name}.`);
      setName("");
      setDescription("");
      setAllowPlayerSelfJoin(false);
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
          Basic GM campaign management for scenarios, reusable entities, and assets.
        </p>
      </div>

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
        <label style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
          <input
            checked={allowPlayerSelfJoin}
            onChange={(event) => setAllowPlayerSelfJoin(event.target.checked)}
            type="checkbox"
          />
          Allow player self-join
        </label>
        <div>
          <button onClick={() => void handleCreateCampaign()} type="button">
            Create campaign
          </button>
        </div>
      </section>

      {error ? <div>{error}</div> : null}
      {feedback ? <div>{feedback}</div> : null}

      {loading ? (
        <div>Loading campaigns...</div>
      ) : campaigns.length > 0 ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {campaigns.map((campaign) => (
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
              <div>Status: {campaign.status}</div>
              <div>{campaign.description || "No description yet."}</div>
              <div>
                Player self-join: {campaign.settings.allowPlayerSelfJoin ? "Enabled" : "Disabled"}
              </div>
              <div>
                <Link href={`/campaigns/${campaign.id}`}>Open campaign</Link>
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
          No campaigns yet.
        </div>
      )}
    </section>
  );
}
