"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  Campaign,
  CampaignAsset,
  CampaignRosterEntry,
  ReusableEntity,
  Scenario,
  ScenarioRelationship
} from "@glantri/domain";

import {
  addCampaignRosterEntryOnServer,
  createCampaignAssetOnServer,
  createReusableEntityOnServer,
  createScenarioOnServer,
  loadCampaignAssets,
  loadCampaignById,
  loadCampaignEntities,
  loadCampaignRoster,
  loadCampaignScenarioRelationships,
  loadCampaignScenarios,
  loadServerCharacters,
  loadTemplates,
  removeCampaignRosterEntryOnServer,
  type ServerCharacterRecord,
  updateCampaignAssetVisibilityOnServer
} from "../../../../src/lib/api/localServiceClient";
import {
  buildCampaignNpcSnapshotFromTemplate,
  getCampaignActorMetadata,
  splitCampaignActors
} from "../../../../src/lib/campaigns/campaignActors";
import { buildCampaignWorkspaceHref } from "../../../../src/lib/campaigns/workspace";

interface CampaignDetailPageContentProps {
  campaignId: string;
  embedded?: boolean;
  onWorkspaceScenariosChanged?: (scenarios: Scenario[]) => void;
}

type RosterFilter = "all" | "pcs" | "npcs" | "templates" | "monsters" | "other";

interface RosterCandidate {
  category: CampaignRosterEntry["category"];
  filter: RosterFilter;
  kindLabel: string;
  member: boolean;
  name: string;
  rosterEntry?: CampaignRosterEntry;
  sourceId: string;
  sourceLabel: string;
  sourceType: CampaignRosterEntry["sourceType"];
  typeLabel: string;
}

function buildRosterSourceKey(sourceType: CampaignRosterEntry["sourceType"], sourceId: string): string {
  return `${sourceType}:${sourceId}`;
}

function formatEntityKind(kind: ReusableEntity["kind"]): string {
  if (kind === "npc") {
    return "NPC";
  }

  return `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;
}

export default function CampaignDetailPageContent({
  campaignId,
  embedded = false,
  onWorkspaceScenariosChanged
}: CampaignDetailPageContentProps) {
  const [assets, setAssets] = useState<CampaignAsset[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [characters, setCharacters] = useState<ServerCharacterRecord[]>([]);
  const [entities, setEntities] = useState<ReusableEntity[]>([]);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [roster, setRoster] = useState<CampaignRosterEntry[]>([]);
  const [rosterFilter, setRosterFilter] = useState<RosterFilter>("all");
  const [rosterSearch, setRosterSearch] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioRelationships, setScenarioRelationships] = useState<ScenarioRelationship[]>([]);
  const [templates, setTemplates] = useState<ReusableEntity[]>([]);

  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [scenarioKind, setScenarioKind] = useState<Scenario["kind"]>("mixed");
  const [continuesFromScenarioId, setContinuesFromScenarioId] = useState("");

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
  const rosterBySourceKey = useMemo(() => {
    const entries = new Map<string, CampaignRosterEntry>();

    for (const entry of roster) {
      entries.set(buildRosterSourceKey(entry.sourceType, entry.sourceId), entry);
    }

    return entries;
  }, [roster]);
  const rosterCandidates = useMemo<RosterCandidate[]>(() => {
    const characterCandidates = characters.map((character): RosterCandidate => {
      const rosterEntry = rosterBySourceKey.get(buildRosterSourceKey("character", character.id));

      return {
        category: "pc",
        filter: "pcs",
        kindLabel: character.owner?.displayName ? `Owner: ${character.owner.displayName}` : "Character",
        member: Boolean(rosterEntry),
        name: character.name,
        rosterEntry,
        sourceId: character.id,
        sourceLabel: "Character",
        sourceType: "character",
        typeLabel: "PC"
      };
    });
    const entityCandidates = entities
      .filter((entity) => getCampaignActorMetadata(entity).actorClass !== "template")
      .map((entity): RosterCandidate => {
        const rosterEntry = rosterBySourceKey.get(buildRosterSourceKey("reusableEntity", entity.id));
        const filter: RosterFilter =
          entity.kind === "monster" ? "monsters" : entity.kind === "npc" ? "npcs" : "other";

        return {
          category: "npc",
          filter,
          kindLabel: formatEntityKind(entity.kind),
          member: Boolean(rosterEntry),
          name: entity.name,
          rosterEntry,
          sourceId: entity.id,
          sourceLabel: "Reusable entity",
          sourceType: "reusableEntity",
          typeLabel: formatEntityKind(entity.kind)
        };
      });
    const templateCandidates = templates.map((template): RosterCandidate => {
      const rosterEntry = rosterBySourceKey.get(buildRosterSourceKey("template", template.id));

      return {
        category: "template",
        filter: "templates",
        kindLabel: formatEntityKind(template.kind),
        member: Boolean(rosterEntry),
        name: template.name,
        rosterEntry,
        sourceId: template.id,
        sourceLabel: "Template",
        sourceType: "template",
        typeLabel: "Template"
      };
    });

    return [...characterCandidates, ...entityCandidates, ...templateCandidates].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [characters, entities, rosterBySourceKey, templates]);
  const rosterFilterOptions = useMemo(
    () =>
      [
        { id: "all" as const, label: "All" },
        { id: "pcs" as const, label: "PCs" },
        { id: "npcs" as const, label: "NPCs" },
        { id: "templates" as const, label: "Templates" },
        { id: "monsters" as const, label: "Monsters" },
        { id: "other" as const, label: "Other" }
      ].filter((option) => option.id === "all" || rosterCandidates.some((candidate) => candidate.filter === option.id)),
    [rosterCandidates]
  );
  const filteredRosterCandidates = useMemo(() => {
    const search = rosterSearch.trim().toLowerCase();

    return rosterCandidates.filter((candidate) => {
      const matchesFilter = rosterFilter === "all" || candidate.filter === rosterFilter;
      const matchesSearch =
        search.length === 0 ||
        candidate.name.toLowerCase().includes(search) ||
        candidate.typeLabel.toLowerCase().includes(search) ||
        candidate.kindLabel.toLowerCase().includes(search);

      return matchesFilter && matchesSearch;
    });
  }, [rosterCandidates, rosterFilter, rosterSearch]);
  const orderedScenarios = useMemo(
    () =>
      [...scenarios].sort(
        (first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt)
      ),
    [scenarios]
  );

  async function refreshPage() {
    const [
      nextCampaign,
      nextScenarios,
      nextScenarioRelationships,
      nextEntities,
      nextAssets,
      nextTemplates,
      nextRoster,
      nextCharacters
    ] = await Promise.all([
      loadCampaignById(campaignId),
      loadCampaignScenarios(campaignId),
      loadCampaignScenarioRelationships(campaignId),
      loadCampaignEntities(campaignId),
      loadCampaignAssets(campaignId),
      loadTemplates(),
      loadCampaignRoster(campaignId),
      loadServerCharacters()
    ]);

    setCampaign(nextCampaign);
    setScenarios(nextScenarios);
    setScenarioRelationships(nextScenarioRelationships);
    onWorkspaceScenariosChanged?.(nextScenarios);
    setEntities(nextEntities);
    setAssets(nextAssets);
    setRoster(nextRoster);
    setCharacters(nextCharacters);
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
        continuesFromScenarioId: continuesFromScenarioId || undefined,
        description: scenarioDescription,
        kind: scenarioKind,
        name: scenarioName,
        status: "draft"
      });

      setFeedback(`Created scenario ${scenario.name}.`);
      setScenarioName("");
      setScenarioDescription("");
      setContinuesFromScenarioId("");
      await refreshPage();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to create scenario.");
    }
  }

  async function handleRosterMembershipToggle(candidate: RosterCandidate, member: boolean) {
    try {
      setError(undefined);
      setFeedback(undefined);

      if (member) {
        const entry = await addCampaignRosterEntryOnServer({
          campaignId,
          category: candidate.category,
          sourceId: candidate.sourceId,
          sourceType: candidate.sourceType
        });

        setFeedback(`Linked ${entry.labelSnapshot ?? candidate.name} to the campaign roster.`);
      } else if (candidate.rosterEntry) {
        await removeCampaignRosterEntryOnServer({
          campaignId,
          rosterEntryId: candidate.rosterEntry.id
        });

        setFeedback(`Removed ${candidate.name} from the campaign roster.`);
      }
      await refreshPage();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to update campaign roster."
      );
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

  function getContinuationLabel(scenarioId: string): string {
    const relationship = scenarioRelationships.find(
      (entry) => entry.relationType === "continues_from" && entry.toScenarioId === scenarioId
    );

    if (!relationship) {
      return "—";
    }

    return scenarios.find((scenario) => scenario.id === relationship.fromScenarioId)?.name ?? "Earlier scenario";
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
        {!embedded ? <Link href="/campaigns">Campaigns</Link> : null}
        <h1 style={{ marginBottom: "0.5rem" }}>{campaign.name}</h1>
        <p style={{ margin: 0 }}>{campaign.description || "No description yet."}</p>
      </div>

      {!embedded ? (
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
      ) : null}

      {error ? <div>{error}</div> : null}
      {feedback ? <div>{feedback}</div> : null}

      <section style={{ border: "1px solid #d9ddd8", borderRadius: 12, display: "grid", gap: "0.75rem", padding: "1rem" }}>
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <h2 style={{ margin: 0 }}>Campaign roster</h2>
          <p style={{ margin: 0 }}>
            Campaign roster links make PCs, concrete NPCs, and templates available to this
            campaign. Scenario participant snapshots are created later from the scenario screen.
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          {rosterFilterOptions.map((option) => (
            <button
              key={option.id}
              onClick={() => setRosterFilter(option.id)}
              style={{
                background: rosterFilter === option.id ? "#283426" : "#f6f5ef",
                border: "1px solid #bfc8ba",
                borderRadius: 999,
                color: rosterFilter === option.id ? "#fff" : "#283426",
                padding: "0.25rem 0.65rem"
              }}
              type="button"
            >
              {option.label}
            </button>
          ))}
          <input
            onChange={(event) => setRosterSearch(event.target.value)}
            placeholder="Search roster candidates"
            style={{ minWidth: 220 }}
            value={rosterSearch}
          />
        </div>

        {filteredRosterCandidates.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 640, width: "100%" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0.75rem 0.5rem 0", textAlign: "center" }}>In campaign</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Name</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Type</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Source</th>
                  <th style={{ padding: "0.5rem 0" }}>Kind</th>
                </tr>
              </thead>
              <tbody>
                {filteredRosterCandidates.map((candidate) => (
                  <tr
                    key={buildRosterSourceKey(candidate.sourceType, candidate.sourceId)}
                    style={{ borderBottom: "1px solid #eee8dc" }}
                  >
                    <td style={{ padding: "0.6rem 0.75rem 0.6rem 0", textAlign: "center" }}>
                      <input
                        aria-label={`Toggle ${candidate.name} campaign roster membership`}
                        checked={candidate.member}
                        onChange={(event) =>
                          void handleRosterMembershipToggle(candidate, event.target.checked)
                        }
                        type="checkbox"
                      />
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      <strong>{candidate.name}</strong>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{candidate.typeLabel}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{candidate.sourceLabel}</td>
                    <td style={{ padding: "0.6rem 0" }}>{candidate.kindLabel}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>No roster candidates match the current filters.</div>
        )}
      </section>

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
        <select
          onChange={(event) => setContinuesFromScenarioId(event.target.value)}
          value={continuesFromScenarioId}
        >
          <option value="">No previous scenario</option>
          {orderedScenarios.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              Continues from {scenario.name}
            </option>
          ))}
        </select>
        <div>
          <button onClick={() => void handleCreateScenario()} type="button">
            Create scenario
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Scenarios</h2>
        {!embedded ? (
          <p style={{ margin: 0 }}>
            Open a scenario to manage participants, controller assignment, live state, and the
            encounters that belong to that session.
          </p>
        ) : null}
        {scenarios.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 680, width: "100%" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Scenario</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Kind</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Status</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Combat</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Follows</th>
                  <th style={{ padding: "0.5rem 0" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {orderedScenarios.map((scenario) => (
                  <tr key={scenario.id} style={{ borderBottom: "1px solid #eee8dc" }}>
                    <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>
                      <div>
                        <strong>{scenario.name}</strong>
                      </div>
                      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                        {scenario.description || "No description yet."}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{scenario.kind}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{scenario.status}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      {scenario.liveState?.combatStatus ?? "not_started"}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      {getContinuationLabel(scenario.id)}
                    </td>
                    <td style={{ padding: "0.6rem 0" }}>
                      <Link
                        href={buildCampaignWorkspaceHref({
                          campaignId,
                          scenarioId: scenario.id,
                          tab: "scenario"
                        })}
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
