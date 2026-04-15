"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type { Campaign, CampaignAsset, ReusableEntity, Scenario } from "@glantri/domain";

import {
  createCampaignAssetOnServer,
  createReusableEntityOnServer,
  createScenarioOnServer,
  loadCampaignAssets,
  loadCampaignById,
  loadCampaignEntities,
  loadCampaignScenarios,
  updateCampaignAssetVisibilityOnServer
} from "../../../../src/lib/api/localServiceClient";

interface CampaignDetailPageContentProps {
  campaignId: string;
}

export default function CampaignDetailPageContent({
  campaignId
}: CampaignDetailPageContentProps) {
  const [assets, setAssets] = useState<CampaignAsset[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [entities, setEntities] = useState<ReusableEntity[]>([]);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState<Scenario[]>([]);

  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [scenarioKind, setScenarioKind] = useState<Scenario["kind"]>("mixed");

  const [entityName, setEntityName] = useState("");
  const [entityDescription, setEntityDescription] = useState("");
  const [entityKind, setEntityKind] = useState<ReusableEntity["kind"]>("npc");

  const [assetTitle, setAssetTitle] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [assetType, setAssetType] = useState<CampaignAsset["type"]>("document");

  async function refreshPage() {
    const [nextCampaign, nextScenarios, nextEntities, nextAssets] = await Promise.all([
      loadCampaignById(campaignId),
      loadCampaignScenarios(campaignId),
      loadCampaignEntities(campaignId),
      loadCampaignAssets(campaignId)
    ]);

    setCampaign(nextCampaign);
    setScenarios(nextScenarios);
    setEntities(nextEntities);
    setAssets(nextAssets);
  }

  useEffect(() => {
    refreshPage()
      .catch((caughtError) => {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to load campaign.");
      })
      .finally(() => setLoading(false));
  }, [campaignId]);

  async function handleCreateScenario() {
    try {
      setError(undefined);
      setFeedback(undefined);

      const scenario = await createScenarioOnServer({
        campaignId,
        description: scenarioDescription,
        kind: scenarioKind,
        name: scenarioName,
        status: "draft"
      });

      setFeedback(`Created scenario ${scenario.name}.`);
      setScenarioName("");
      setScenarioDescription("");
      await refreshPage();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create scenario.");
    }
  }

  async function handleCreateEntity() {
    try {
      setError(undefined);
      setFeedback(undefined);

      const entity = await createReusableEntityOnServer({
        campaignId,
        description: entityDescription,
        kind: entityKind,
        name: entityName
      });

      setFeedback(`Created reusable entity ${entity.name}.`);
      setEntityName("");
      setEntityDescription("");
      await refreshPage();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create entity.");
    }
  }

  async function handleCreateAsset() {
    try {
      setError(undefined);
      setFeedback(undefined);

      const asset = await createCampaignAssetOnServer({
        campaignId,
        storageUrl: assetUrl,
        title: assetTitle,
        type: assetType,
        visibility: "hidden"
      });

      setFeedback(`Created asset ${asset.title}.`);
      setAssetTitle("");
      setAssetUrl("");
      await refreshPage();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create asset.");
    }
  }

  async function handleAssetVisibilityChange(
    assetId: string,
    visibility: CampaignAsset["visibility"]
  ) {
    try {
      setError(undefined);
      await updateCampaignAssetVisibilityOnServer({
        assetId,
        visibility
      });
      await refreshPage();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to update asset visibility."
      );
    }
  }

  if (loading) {
    return <section>Loading campaign...</section>;
  }

  if (!campaign) {
    return <section>{error ?? "Campaign not found."}</section>;
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 980 }}>
      <div>
        <Link href="/campaigns">Campaigns</Link>
        <h1 style={{ marginBottom: "0.5rem" }}>{campaign.name}</h1>
        <p style={{ margin: 0 }}>{campaign.description || "No description yet."}</p>
      </div>

      {error ? <div>{error}</div> : null}
      {feedback ? <div>{feedback}</div> : null}

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <h2 style={{ margin: 0 }}>Create scenario</h2>
        <input
          onChange={(event) => setScenarioName(event.target.value)}
          placeholder="Scenario name"
          value={scenarioName}
        />
        <textarea
          onChange={(event) => setScenarioDescription(event.target.value)}
          placeholder="Description"
          rows={3}
          value={scenarioDescription}
        />
        <select
          onChange={(event) => setScenarioKind(event.target.value as Scenario["kind"])}
          value={scenarioKind}
        >
          <option value="combat">Combat</option>
          <option value="social">Social</option>
          <option value="travel">Travel</option>
          <option value="mixed">Mixed</option>
        </select>
        <div>
          <button onClick={() => void handleCreateScenario()} type="button">
            Create scenario
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Scenarios</h2>
        {scenarios.length > 0 ? (
          scenarios.map((scenario) => (
            <div
              key={scenario.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "0.35rem",
                padding: "1rem"
              }}
            >
              <strong>{scenario.name}</strong>
              <div>
                {scenario.kind} · {scenario.status}
              </div>
              <div>{scenario.description || "No description yet."}</div>
              <Link href={`/campaigns/${campaignId}/scenarios/${scenario.id}`}>Open scenario</Link>
            </div>
          ))
        ) : (
          <div>No scenarios yet.</div>
        )}
      </section>

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <h2 style={{ margin: 0 }}>Create reusable entity</h2>
        <input
          onChange={(event) => setEntityName(event.target.value)}
          placeholder="Entity name"
          value={entityName}
        />
        <textarea
          onChange={(event) => setEntityDescription(event.target.value)}
          placeholder="Description"
          rows={2}
          value={entityDescription}
        />
        <select
          onChange={(event) => setEntityKind(event.target.value as ReusableEntity["kind"])}
          value={entityKind}
        >
          <option value="npc">NPC</option>
          <option value="monster">Monster</option>
          <option value="animal">Animal</option>
        </select>
        <div>
          <button onClick={() => void handleCreateEntity()} type="button">
            Create reusable entity
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Reusable entities</h2>
        {entities.length > 0 ? (
          entities.map((entity) => (
            <div
              key={entity.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "0.35rem",
                padding: "1rem"
              }}
            >
              <strong>{entity.name}</strong>
              <div>{entity.kind}</div>
              <div>{entity.description || "No description yet."}</div>
            </div>
          ))
        ) : (
          <div>No reusable entities yet.</div>
        )}
      </section>

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <h2 style={{ margin: 0 }}>Create campaign asset</h2>
        <input
          onChange={(event) => setAssetTitle(event.target.value)}
          placeholder="Asset title"
          value={assetTitle}
        />
        <input
          onChange={(event) => setAssetUrl(event.target.value)}
          placeholder="Storage URL"
          value={assetUrl}
        />
        <select
          onChange={(event) => setAssetType(event.target.value as CampaignAsset["type"])}
          value={assetType}
        >
          <option value="document">Document</option>
          <option value="map">Map</option>
          <option value="image">Image</option>
          <option value="handout">Handout</option>
          <option value="drawing">Drawing</option>
        </select>
        <div>
          <button onClick={() => void handleCreateAsset()} type="button">
            Create asset
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Campaign assets</h2>
        {assets.length > 0 ? (
          assets.map((asset) => (
            <div
              key={asset.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "0.35rem",
                padding: "1rem"
              }}
            >
              <strong>{asset.title}</strong>
              <div>
                {asset.type} · {asset.visibility}
              </div>
              <div>{asset.storageUrl}</div>
              <select
                onChange={(event) =>
                  void handleAssetVisibilityChange(
                    asset.id,
                    event.target.value as CampaignAsset["visibility"]
                  )
                }
                value={asset.visibility}
              >
                <option value="hidden">Hidden</option>
                <option value="visible_to_all">Visible to all</option>
                <option value="gm_only">GM only</option>
              </select>
            </div>
          ))
        ) : (
          <div>No assets yet.</div>
        )}
      </section>
    </section>
  );
}
