"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { defaultCanonicalContent } from "@glantri/content";
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
  createScenarioOnServer,
  loadCampaignAssets,
  loadCampaignById,
  loadCampaignEntities,
  loadCampaigns,
  loadCampaignRoster,
  loadCampaignScenarioRelationships,
  loadCampaignScenarios,
  loadServerCharacters,
  loadTemplates,
  removeCampaignRosterEntryOnServer,
  type ServerCharacterRecord,
  updateCampaignAssetVisibilityOnServer
} from "../../../../src/lib/api/localServiceClient";
import { getCampaignActorMetadata } from "../../../../src/lib/campaigns/campaignActors";
import { buildCampaignWorkspaceHref } from "../../../../src/lib/campaigns/workspace";

interface CampaignDetailPageContentProps {
  campaignId: string;
  embedded?: boolean;
  onWorkspaceScenariosChanged?: (scenarios: Scenario[]) => void;
}

type RosterMembershipFilter = "all" | "inCampaign" | "otherCampaigns";
type RosterTypeFilter = "all" | "pcs" | "npcs" | "templates" | "monsters" | "other";

interface RosterCandidate {
  category: CampaignRosterEntry["category"];
  civilizationLabel: string;
  membership: "inCampaign" | "otherCampaigns" | "available";
  professionLabel: string;
  skillGroups: string[];
  typeFilter: RosterTypeFilter;
  kindLabel: string;
  member: boolean;
  name: string;
  ownerLabel: string;
  rosterEntry?: CampaignRosterEntry;
  sourceId: string;
  sourceType: CampaignRosterEntry["sourceType"];
  typeLabel: string;
}

const civilizationNameById = new Map(
  defaultCanonicalContent.civilizations.map((civilization) => [civilization.id, civilization.name])
);
const civilizationNameByName = new Map(
  defaultCanonicalContent.civilizations.map((civilization) => [
    civilization.name.toLowerCase(),
    civilization.name
  ])
);
const civilizationNamesBySocietyId = new Map<string, string[]>();

for (const civilization of defaultCanonicalContent.civilizations) {
  const existingNames = civilizationNamesBySocietyId.get(civilization.linkedSocietyId) ?? [];
  civilizationNamesBySocietyId.set(civilization.linkedSocietyId, [
    ...existingNames,
    civilization.name
  ]);
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
}

function readSnapshotMetadata(snapshot: unknown): {
  civilizationLabel?: string;
  professionLabel?: string;
  skillGroups: string[];
} {
  if (!isRecord(snapshot)) {
    return { skillGroups: [] };
  }

  return {
    civilizationLabel:
      readOptionalString(snapshot.civilization) ??
      readOptionalString(snapshot.civilizationId) ??
      readOptionalString(snapshot.culture) ??
      readOptionalString(snapshot.societyId) ??
      readOptionalString(snapshot.society),
    professionLabel: readOptionalString(snapshot.profession) ?? readOptionalString(snapshot.professionId),
    skillGroups: [
      ...readStringList(snapshot.skillGroups),
      ...readStringList(snapshot.skillGroupIds),
      ...readStringList(snapshot.trainingPackages)
    ]
  };
}

function getCivilizationDisplayName(value?: string): string {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    return "—";
  }

  const exactCivilizationName =
    civilizationNameById.get(normalizedValue) ??
    civilizationNameByName.get(normalizedValue.toLowerCase());

  if (exactCivilizationName) {
    return exactCivilizationName;
  }

  const societyCivilizationNames = civilizationNamesBySocietyId.get(normalizedValue);

  if (societyCivilizationNames && societyCivilizationNames.length > 0) {
    return societyCivilizationNames.join(" / ");
  }

  return "—";
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
  const [allRosterEntries, setAllRosterEntries] = useState<CampaignRosterEntry[]>([]);
  const [roster, setRoster] = useState<CampaignRosterEntry[]>([]);
  const [rosterMembershipFilter, setRosterMembershipFilter] = useState<RosterMembershipFilter>("all");
  const [rosterTypeFilter, setRosterTypeFilter] = useState<RosterTypeFilter>("all");
  const [rosterCivilizationFilter, setRosterCivilizationFilter] = useState("");
  const [rosterProfessionFilter, setRosterProfessionFilter] = useState("");
  const [rosterSkillGroupFilter, setRosterSkillGroupFilter] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioRelationships, setScenarioRelationships] = useState<ScenarioRelationship[]>([]);
  const [templates, setTemplates] = useState<ReusableEntity[]>([]);

  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [scenarioKind, setScenarioKind] = useState<Scenario["kind"]>("mixed");
  const [continuesFromScenarioId, setContinuesFromScenarioId] = useState("");

  const [assetTitle, setAssetTitle] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [assetType, setAssetType] = useState<CampaignAsset["type"]>("document");
  const rosterBySourceKey = useMemo(() => {
    const entries = new Map<string, CampaignRosterEntry>();

    for (const entry of roster) {
      entries.set(buildRosterSourceKey(entry.sourceType, entry.sourceId), entry);
    }

    return entries;
  }, [roster]);
  const otherRosterSourceKeys = useMemo(() => {
    const keys = new Set<string>();

    for (const entry of allRosterEntries) {
      if (entry.campaignId !== campaignId) {
        keys.add(buildRosterSourceKey(entry.sourceType, entry.sourceId));
      }
    }

    return keys;
  }, [allRosterEntries, campaignId]);
  const rosterCandidates = useMemo<RosterCandidate[]>(() => {
    const characterCandidates = characters.map((character): RosterCandidate => {
      const sourceKey = buildRosterSourceKey("character", character.id);
      const rosterEntry = rosterBySourceKey.get(sourceKey);
      const skillGroups = character.build.progression.skillGroups.map((entry) => entry.groupId);

      return {
        category: "pc",
        civilizationLabel: getCivilizationDisplayName(character.build.societyId),
        membership: rosterEntry ? "inCampaign" : otherRosterSourceKeys.has(sourceKey) ? "otherCampaigns" : "available",
        professionLabel: character.build.professionId ?? "—",
        skillGroups,
        typeFilter: "pcs",
        kindLabel: "Character",
        member: Boolean(rosterEntry),
        name: character.name,
        ownerLabel: character.owner?.displayName ?? character.owner?.email ?? "—",
        rosterEntry,
        sourceId: character.id,
        sourceType: "character",
        typeLabel: "PC"
      };
    });
    const entityCandidates = entities
      .filter((entity) => getCampaignActorMetadata(entity).actorClass !== "template")
      .map((entity): RosterCandidate => {
        const sourceKey = buildRosterSourceKey("reusableEntity", entity.id);
        const rosterEntry = rosterBySourceKey.get(sourceKey);
        const typeFilter: RosterTypeFilter =
          entity.kind === "monster" ? "monsters" : entity.kind === "npc" ? "npcs" : "other";
        const metadata = getCampaignActorMetadata(entity);
        const snapshotMetadata = readSnapshotMetadata(entity.snapshot);

        return {
          category: "npc",
          civilizationLabel: getCivilizationDisplayName(snapshotMetadata.civilizationLabel),
          membership: rosterEntry ? "inCampaign" : otherRosterSourceKeys.has(sourceKey) ? "otherCampaigns" : "available",
          professionLabel: metadata.profession ?? snapshotMetadata.professionLabel ?? "—",
          skillGroups: snapshotMetadata.skillGroups,
          typeFilter,
          kindLabel: formatEntityKind(entity.kind),
          member: Boolean(rosterEntry),
          name: entity.name,
          ownerLabel: "—",
          rosterEntry,
          sourceId: entity.id,
          sourceType: "reusableEntity",
          typeLabel: formatEntityKind(entity.kind)
        };
    });
    const templateCandidates = templates.map((template): RosterCandidate => {
      const sourceKey = buildRosterSourceKey("template", template.id);
      const rosterEntry = rosterBySourceKey.get(sourceKey);
      const metadata = getCampaignActorMetadata(template);
      const snapshotMetadata = readSnapshotMetadata(template.snapshot);

      return {
        category: "template",
        civilizationLabel: getCivilizationDisplayName(snapshotMetadata.civilizationLabel),
        membership: rosterEntry ? "inCampaign" : otherRosterSourceKeys.has(sourceKey) ? "otherCampaigns" : "available",
        professionLabel: metadata.profession ?? snapshotMetadata.professionLabel ?? "—",
        skillGroups: snapshotMetadata.skillGroups,
        typeFilter: "templates",
        kindLabel: formatEntityKind(template.kind),
        member: Boolean(rosterEntry),
        name: template.name,
        ownerLabel: "—",
        rosterEntry,
        sourceId: template.id,
        sourceType: "template",
        typeLabel: "Template"
      };
    });

    return [...characterCandidates, ...entityCandidates, ...templateCandidates].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [characters, entities, otherRosterSourceKeys, rosterBySourceKey, templates]);
  const rosterTypeFilterOptions = useMemo(
    () =>
      [
        { id: "all" as const, label: "All types" },
        { id: "pcs" as const, label: "PCs" },
        { id: "npcs" as const, label: "NPCs" },
        { id: "templates" as const, label: "Templates" },
        { id: "monsters" as const, label: "Monsters" },
        { id: "other" as const, label: "Other" }
      ].filter((option) => option.id === "all" || rosterCandidates.some((candidate) => candidate.typeFilter === option.id)),
    [rosterCandidates]
  );
  const rosterCivilizationOptions = useMemo(
    () =>
      [...new Set(rosterCandidates.map((candidate) => candidate.civilizationLabel).filter((value) => value !== "—"))].sort(),
    [rosterCandidates]
  );
  const rosterProfessionOptions = useMemo(
    () =>
      [...new Set(rosterCandidates.map((candidate) => candidate.professionLabel).filter((value) => value !== "—"))].sort(),
    [rosterCandidates]
  );
  const rosterSkillGroupOptions = useMemo(
    () => [...new Set(rosterCandidates.flatMap((candidate) => candidate.skillGroups))].sort(),
    [rosterCandidates]
  );
  const filteredRosterCandidates = useMemo(() => {
    const search = rosterSearch.trim().toLowerCase();

    return rosterCandidates.filter((candidate) => {
      const matchesMembership =
        rosterMembershipFilter === "all" || candidate.membership === rosterMembershipFilter;
      const matchesType = rosterTypeFilter === "all" || candidate.typeFilter === rosterTypeFilter;
      const matchesCivilization =
        !rosterCivilizationFilter || candidate.civilizationLabel === rosterCivilizationFilter;
      const matchesProfession =
        !rosterProfessionFilter || candidate.professionLabel === rosterProfessionFilter;
      const matchesSkillGroup =
        !rosterSkillGroupFilter || candidate.skillGroups.includes(rosterSkillGroupFilter);
      const matchesSearch =
        search.length === 0 ||
        candidate.name.toLowerCase().includes(search) ||
        candidate.typeLabel.toLowerCase().includes(search) ||
        candidate.kindLabel.toLowerCase().includes(search) ||
        candidate.civilizationLabel.toLowerCase().includes(search) ||
        candidate.professionLabel.toLowerCase().includes(search) ||
        candidate.skillGroups.some((group) => group.toLowerCase().includes(search));

      return (
        matchesMembership &&
        matchesType &&
        matchesCivilization &&
        matchesProfession &&
        matchesSkillGroup &&
        matchesSearch
      );
    });
  }, [
    rosterCandidates,
    rosterCivilizationFilter,
    rosterMembershipFilter,
    rosterProfessionFilter,
    rosterSearch,
    rosterSkillGroupFilter,
    rosterTypeFilter
  ]);
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
      nextEntities,
      nextAssets,
      nextTemplates,
      nextRoster,
      nextCharacters
    ] = await Promise.all([
      loadCampaignById(campaignId),
      loadCampaignScenarios(campaignId),
      loadCampaignEntities(campaignId),
      loadCampaignAssets(campaignId),
      loadTemplates(),
      loadCampaignRoster(campaignId),
      loadServerCharacters()
    ]);
    const nextScenarioRelationships = await loadCampaignScenarioRelationships(campaignId).catch(
      () => []
    );
    const nextAllRosterEntries = await loadCampaigns()
      .then((campaigns) =>
        Promise.allSettled(campaigns.map((entry) => loadCampaignRoster(entry.id)))
      )
      .then((results) =>
        results.flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      )
      .catch(() => nextRoster);

    setCampaign(nextCampaign);
    setScenarios(nextScenarios);
    setScenarioRelationships(nextScenarioRelationships);
    onWorkspaceScenariosChanged?.(nextScenarios);
    setEntities(nextEntities);
    setAssets(nextAssets);
    setAllRosterEntries(nextAllRosterEntries);
    setRoster(nextRoster);
    setCharacters(nextCharacters);
    const globalTemplates = nextTemplates.filter(
      (entity) => getCampaignActorMetadata(entity).actorClass === "template"
    );

    setTemplates(globalTemplates);
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
      } else {
        const rosterEntry =
          candidate.rosterEntry ??
          rosterBySourceKey.get(buildRosterSourceKey(candidate.sourceType, candidate.sourceId));

        if (!rosterEntry) {
          setFeedback(`${candidate.name} is already outside the campaign roster.`);
          await refreshPage();
          return;
        }

        await removeCampaignRosterEntryOnServer({
          campaignId,
          rosterEntryId: rosterEntry.id
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
          <div>This page is the in-campaign home for overview, roster, assets, and scenarios.</div>
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

        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <select
            aria-label="Roster membership filter"
            onChange={(event) =>
              setRosterMembershipFilter(event.target.value as RosterMembershipFilter)
            }
            value={rosterMembershipFilter}
          >
            <option value="all">All</option>
            <option value="inCampaign">Members</option>
            <option value="otherCampaigns">Other campaigns</option>
          </select>
          <select
            aria-label="Roster type filter"
            onChange={(event) => setRosterTypeFilter(event.target.value as RosterTypeFilter)}
            value={rosterTypeFilter}
          >
            {rosterTypeFilterOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Roster civilization filter"
            onChange={(event) => setRosterCivilizationFilter(event.target.value)}
            value={rosterCivilizationFilter}
          >
            <option value="">All civilizations</option>
            {rosterCivilizationOptions.map((civilization) => (
              <option key={civilization} value={civilization}>
                {civilization}
              </option>
            ))}
          </select>
          <select
            aria-label="Roster profession filter"
            onChange={(event) => setRosterProfessionFilter(event.target.value)}
            value={rosterProfessionFilter}
          >
            <option value="">All professions</option>
            {rosterProfessionOptions.map((profession) => (
              <option key={profession} value={profession}>
                {profession}
              </option>
            ))}
          </select>
          <select
            aria-label="Roster skill group filter"
            onChange={(event) => setRosterSkillGroupFilter(event.target.value)}
            value={rosterSkillGroupFilter}
          >
            <option value="">All skill groups</option>
            {rosterSkillGroupOptions.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
          <input
            aria-label="Search roster candidates"
            onChange={(event) => setRosterSearch(event.target.value)}
            placeholder="Search roster candidates"
            style={{ minWidth: 260 }}
            value={rosterSearch}
          />
        </div>

        {filteredRosterCandidates.length > 0 ? (
          <div style={{ maxHeight: "32rem", overflow: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 720, width: "100%" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                  <th style={{ background: "#fff", padding: "0.5rem 0.75rem 0.5rem 0", position: "sticky", textAlign: "center", top: 0 }}>Member</th>
                  <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>Name</th>
                  <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>Type</th>
                  <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>Civilization</th>
                  <th style={{ background: "#fff", padding: "0.5rem 0.75rem", position: "sticky", top: 0 }}>Profession</th>
                  <th style={{ background: "#fff", padding: "0.5rem 0", position: "sticky", top: 0 }}>Owner</th>
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
                    <td style={{ padding: "0.6rem 0.75rem" }}>{candidate.civilizationLabel}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{candidate.professionLabel}</td>
                    <td style={{ padding: "0.6rem 0" }}>{candidate.ownerLabel}</td>
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
