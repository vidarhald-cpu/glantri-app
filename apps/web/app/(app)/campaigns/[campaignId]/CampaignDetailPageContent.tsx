"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { Campaign, CampaignAsset, ReusableEntity, Scenario } from "@glantri/domain";

import {
  createCampaignAssetOnServer,
  createReusableEntityOnServer,
  createScenarioOnServer,
  loadCampaignAssets,
  loadCampaignById,
  loadCampaignEntities,
  loadCampaignScenarios,
  loadTemplates,
  updateCampaignAssetVisibilityOnServer
} from "../../../../src/lib/api/localServiceClient";
import {
  buildCampaignNpcSnapshotFromTemplate,
  getCampaignActorMetadata,
  splitCampaignActors
} from "../../../../src/lib/campaigns/campaignActors";

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
  const [templates, setTemplates] = useState<ReusableEntity[]>([]);

  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [scenarioKind, setScenarioKind] = useState<Scenario["kind"]>("mixed");

  const [entityName, setEntityName] = useState("");
  const [entityDescription, setEntityDescription] = useState("");
  const [entityKind, setEntityKind] = useState<ReusableEntity["kind"]>("npc");
  const [entityRoleLabel, setEntityRoleLabel] = useState("");
  const [entityAllegiance, setEntityAllegiance] = useState("");
  const [entityTags, setEntityTags] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const [assetTitle, setAssetTitle] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [assetType, setAssetType] = useState<CampaignAsset["type"]>("document");
  const splitEntities = useMemo(() => splitCampaignActors(entities, campaignId), [campaignId, entities]);

  async function refreshPage() {
    const [nextCampaign, nextScenarios, nextEntities, nextAssets, nextTemplates] = await Promise.all([
      loadCampaignById(campaignId),
      loadCampaignScenarios(campaignId),
      loadCampaignEntities(campaignId),
      loadCampaignAssets(campaignId),
      loadTemplates()
    ]);

    setCampaign(nextCampaign);
    setScenarios(nextScenarios);
    setEntities(nextEntities);
    setAssets(nextAssets);
    const globalTemplates = nextTemplates.filter(
      (entity) => getCampaignActorMetadata(entity).actorClass === "template"
    );

    setTemplates(globalTemplates);
    setSelectedTemplateId((current) => current || globalTemplates[0]?.id || "");
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
      const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);
      const templateSnapshot = selectedTemplate
        ? buildCampaignNpcSnapshotFromTemplate({
            campaignId,
            name: entityName,
            template: selectedTemplate
          })
        : {
            actorClass: "campaign_npc" as const,
            campaignId
          };

      const entity = await createReusableEntityOnServer({
        campaignId,
        description: entityDescription,
        kind: entityKind,
        name: entityName,
        snapshot: {
          ...templateSnapshot,
          allegiance: entityAllegiance.trim() || undefined,
          roleLabel: entityRoleLabel.trim() || undefined,
          tags: entityTags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean)
        }
      });

      setFeedback(`Created campaign NPC ${entity.name}.`);
      setEntityName("");
      setEntityDescription("");
      setEntityRoleLabel("");
      setEntityAllegiance("");
      setEntityTags("");
      await refreshPage();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create entity.");
    }
  }

  function handleApplyTemplate() {
    const selectedTemplate = templates.find((template) => template.id === selectedTemplateId);

    if (!selectedTemplate) {
      return;
    }

    const metadata = getCampaignActorMetadata(selectedTemplate);

    setEntityName(selectedTemplate.name);
    setEntityDescription(selectedTemplate.description ?? "");
    setEntityKind(selectedTemplate.kind);
    setEntityAllegiance("");
    setEntityRoleLabel(metadata.roleLabel ?? "");
    setEntityTags(metadata.tags?.join(", ") ?? "");
    setFeedback(`Loaded template ${selectedTemplate.name} into the campaign NPC form.`);
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

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.5rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Campaign flow</h2>
        <div>This page is the in-campaign home for overview, roster, NPCs, assets, and scenarios.</div>
        <div>Scenarios belong to this campaign and handle session-level setup.</div>
        <div>Encounters belong inside scenarios and lead onward to the player combat screen.</div>
      </section>

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
        <p style={{ margin: 0 }}>
          Open a scenario to manage participants, controller assignment, live state, and the
          encounters that belong to that session.
        </p>
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
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                <Link href={`/campaigns/${campaignId}/scenarios/${scenario.id}`}>Open scenario</Link>
                <Link href={`/campaigns/${campaignId}/scenarios/${scenario.id}/encounters`}>
                  Open encounters
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div>No scenarios yet.</div>
        )}
      </section>

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <h2 style={{ margin: 0 }}>Create campaign NPC</h2>
          <p style={{ margin: 0 }}>
            Campaign NPCs are persistent individuals tied to this campaign. Reusable archetypes are
            authored in the <Link href="/templates">Templates</Link> library.
          </p>
        </div>
        {templates.length > 0 ? (
          <div style={{ display: "grid", gap: "0.5rem" }}>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Start from template</span>
              <select
                onChange={(event) => setSelectedTemplateId(event.target.value)}
                value={selectedTemplateId}
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} ({template.kind})
                  </option>
                ))}
              </select>
            </label>
            <div>
              <button onClick={handleApplyTemplate} type="button">
                Use template values
              </button>
            </div>
          </div>
        ) : (
          <div>No global templates yet. Create one in the Templates library if you want a reusable starting point.</div>
        )}
        <input
          onChange={(event) => setEntityName(event.target.value)}
          placeholder="NPC name"
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
        <input
          onChange={(event) => setEntityRoleLabel(event.target.value)}
          placeholder="Role in campaign (optional)"
          value={entityRoleLabel}
        />
        <input
          onChange={(event) => setEntityAllegiance(event.target.value)}
          placeholder="Allegiance or faction (optional)"
          value={entityAllegiance}
        />
        <input
          onChange={(event) => setEntityTags(event.target.value)}
          placeholder="Tags (comma-separated, optional)"
          value={entityTags}
        />
        <div>
          <button onClick={() => void handleCreateEntity()} type="button">
            Create campaign NPC
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Campaign NPCs</h2>
        <p style={{ margin: 0 }}>
          Persistent individuals for this campaign. Scenario pages can still pull from both the
          global template library and this roster.
        </p>
        {splitEntities.campaignNpcs.length > 0 ? (
          splitEntities.campaignNpcs.map((entity) => {
            const metadata = getCampaignActorMetadata(entity);

            return (
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
                {metadata.roleLabel ? <div>Role: {metadata.roleLabel}</div> : null}
                {metadata.allegiance ? <div>Allegiance: {metadata.allegiance}</div> : null}
                {metadata.tags?.length ? <div>Tags: {metadata.tags.join(", ")}</div> : null}
              </div>
            );
          })
        ) : (
          <div>No campaign NPCs yet.</div>
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
