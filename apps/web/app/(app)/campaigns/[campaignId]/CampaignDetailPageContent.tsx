"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { defaultCanonicalContent } from "@glantri/content";
import type {
  Campaign,
  CampaignCharacterRosterCandidate,
  CampaignWorkspaceOverview,
  CampaignRosterEntry,
  ReusableEntity,
  Scenario,
  ScenarioRelationship,
} from "@glantri/domain";

import {
  addCampaignRosterEntryOnServer,
  createScenarioOnServer,
  activateCampaignOnServer,
  loadCampaignById,
  loadCampaignCharacterRosterCandidates,
  loadCampaignEntities,
  loadCampaigns,
  loadCampaignRoster,
  loadCampaignScenarioRelationships,
  loadCampaignScenarios,
  loadCampaignWorkspaceOverview,
  loadTemplates,
  removeCampaignRosterEntryOnServer,
} from "@/lib/api/localServiceClient";
import { getCampaignActorMetadata } from "@/lib/campaigns/campaignActors";
import { buildCampaignScenarioHref, buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";
import { ArtifactPanel } from "@/features/artifacts";
import { ApiRequestError } from "@/lib/api/apiClient";
import { CampaignHomeOverview } from "./CampaignHomeOverview";
import { CampaignNotesPanel } from "./CampaignNotesPanel";

interface CampaignDetailPageContentProps {
  campaignId: string;
  embedded?: boolean;
  onWorkspaceScenariosChanged?: (scenarios: Scenario[]) => void;
}

type RosterMembershipFilter = "all" | "current" | "former" | "otherCampaigns" | "available";
type RosterTypeFilter = "all" | "pcs" | "npcs" | "templates" | "monsters" | "other";

interface RosterCandidate {
  category: CampaignRosterEntry["category"];
  civilizationLabel: string;
  membership: Exclude<RosterMembershipFilter, "all">;
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
  defaultCanonicalContent.civilizations.map((civilization) => [civilization.id, civilization.name]),
);
const civilizationNameByName = new Map(
  defaultCanonicalContent.civilizations.map((civilization) => [
    civilization.name.toLowerCase(),
    civilization.name,
  ]),
);
const civilizationNamesBySocietyId = new Map<string, string[]>();

for (const civilization of defaultCanonicalContent.civilizations) {
  const existingNames = civilizationNamesBySocietyId.get(civilization.linkedSocietyId) ?? [];
  civilizationNamesBySocietyId.set(civilization.linkedSocietyId, [
    ...existingNames,
    civilization.name,
  ]);
}

function buildRosterSourceKey(
  sourceType: CampaignRosterEntry["sourceType"],
  sourceId: string,
): string {
  return `${sourceType}:${sourceId}`;
}

function removeRosterSourceFromList(
  entries: CampaignRosterEntry[],
  removedSource: Pick<CampaignRosterEntry, "campaignId" | "sourceId" | "sourceType">,
): CampaignRosterEntry[] {
  const removedSourceKey = buildRosterSourceKey(removedSource.sourceType, removedSource.sourceId);

  return entries.filter((entry) => {
    return !(
      entry.campaignId === removedSource.campaignId &&
      buildRosterSourceKey(entry.sourceType, entry.sourceId) === removedSourceKey
    );
  });
}

export function getRosterRemovalSource(input: {
  rosterEntry?: Pick<CampaignRosterEntry, "sourceId" | "sourceType">;
  sourceId: string;
  sourceType: CampaignRosterEntry["sourceType"];
}): Pick<CampaignRosterEntry, "sourceId" | "sourceType"> {
  return {
    sourceId: input.rosterEntry?.sourceId ?? input.sourceId,
    sourceType: input.rosterEntry?.sourceType ?? input.sourceType,
  };
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

  return value.filter(
    (entry): entry is string => typeof entry === "string" && entry.trim().length > 0,
  );
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
    professionLabel:
      readOptionalString(snapshot.profession) ?? readOptionalString(snapshot.professionId),
    skillGroups: [
      ...readStringList(snapshot.skillGroups),
      ...readStringList(snapshot.skillGroupIds),
      ...readStringList(snapshot.trainingPackages),
    ],
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
  onWorkspaceScenariosChanged,
}: CampaignDetailPageContentProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [overview, setOverview] = useState<CampaignWorkspaceOverview | null>(null);
  const [characters, setCharacters] = useState<CampaignCharacterRosterCandidate[]>([]);
  const [entities, setEntities] = useState<ReusableEntity[]>([]);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [allRosterEntries, setAllRosterEntries] = useState<CampaignRosterEntry[]>([]);
  const [roster, setRoster] = useState<CampaignRosterEntry[]>([]);
  const [rosterMembershipFilter, setRosterMembershipFilter] =
    useState<RosterMembershipFilter>("all");
  const [rosterTypeFilter, setRosterTypeFilter] = useState<RosterTypeFilter>("all");
  const [rosterCivilizationFilter, setRosterCivilizationFilter] = useState("");
  const [rosterProfessionFilter, setRosterProfessionFilter] = useState("");
  const [rosterSkillGroupFilter, setRosterSkillGroupFilter] = useState("");
  const [rosterSearch, setRosterSearch] = useState("");
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [scenarioRelationships, setScenarioRelationships] = useState<ScenarioRelationship[]>([]);
  const [scenarioSearch, setScenarioSearch] = useState("");
  const [scenarioStatusFilter, setScenarioStatusFilter] = useState<"all" | Scenario["status"]>(
    "all",
  );
  const [templates, setTemplates] = useState<ReusableEntity[]>([]);

  const [scenarioName, setScenarioName] = useState("");
  const [scenarioDescription, setScenarioDescription] = useState("");
  const [continuesFromScenarioId, setContinuesFromScenarioId] = useState("");

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
      const membershipState = rosterEntry?.membershipState ?? character.membershipState ?? "none";
      const member = membershipState === "current" || character.alreadyRostered;

      return {
        category: "pc",
        civilizationLabel: "—",
        membership: member
          ? "current"
          : membershipState === "former"
            ? "former"
            : character.currentElsewhere
              ? "otherCampaigns"
              : "available",
        professionLabel: "—",
        skillGroups: [],
        typeFilter: "pcs",
        kindLabel: "Character",
        member,
        name: character.name,
        ownerLabel: character.ownerLabel,
        rosterEntry,
        sourceId: character.id,
        sourceType: "character",
        typeLabel: "PC",
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
          membership: rosterEntry
            ? "current"
            : otherRosterSourceKeys.has(sourceKey)
              ? "otherCampaigns"
              : "available",
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
          typeLabel: formatEntityKind(entity.kind),
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
        membership: rosterEntry
          ? "current"
          : otherRosterSourceKeys.has(sourceKey)
            ? "otherCampaigns"
            : "available",
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
        typeLabel: "Template",
      };
    });

    return [...characterCandidates, ...entityCandidates, ...templateCandidates].sort((a, b) =>
      a.name.localeCompare(b.name),
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
        { id: "other" as const, label: "Other" },
      ].filter(
        (option) =>
          option.id === "all" ||
          rosterCandidates.some((candidate) => candidate.typeFilter === option.id),
      ),
    [rosterCandidates],
  );
  const rosterCivilizationOptions = useMemo(
    () =>
      [
        ...new Set(
          rosterCandidates
            .map((candidate) => candidate.civilizationLabel)
            .filter((value) => value !== "—"),
        ),
      ].sort(),
    [rosterCandidates],
  );
  const rosterProfessionOptions = useMemo(
    () =>
      [
        ...new Set(
          rosterCandidates
            .map((candidate) => candidate.professionLabel)
            .filter((value) => value !== "—"),
        ),
      ].sort(),
    [rosterCandidates],
  );
  const rosterSkillGroupOptions = useMemo(
    () => [...new Set(rosterCandidates.flatMap((candidate) => candidate.skillGroups))].sort(),
    [rosterCandidates],
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
    rosterTypeFilter,
  ]);
  const orderedScenarios = useMemo(
    () =>
      [...scenarios].sort(
        (first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt),
      ),
    [scenarios],
  );
  const continuationScenarios = useMemo(
    () => orderedScenarios.filter((scenario) => scenario.status !== "archived"),
    [orderedScenarios],
  );
  const filteredScenarios = useMemo(() => {
    const search = scenarioSearch.trim().toLowerCase();
    return orderedScenarios.filter(
      (scenario) =>
        (scenarioStatusFilter === "all" || scenario.status === scenarioStatusFilter) &&
        (!search ||
          scenario.name.toLowerCase().includes(search) ||
          scenario.description.toLowerCase().includes(search)),
    );
  }, [orderedScenarios, scenarioSearch, scenarioStatusFilter]);

  async function refreshPage() {
    const [
      nextCampaign,
      nextScenarios,
      nextEntities,
      nextTemplates,
      nextRoster,
      nextCharacters,
      nextOverview,
    ] = await Promise.all([
      loadCampaignById(campaignId),
      loadCampaignScenarios(campaignId),
      loadCampaignEntities(campaignId),
      loadTemplates(),
      loadCampaignRoster(campaignId),
      loadCampaignCharacterRosterCandidates(campaignId),
      loadCampaignWorkspaceOverview(campaignId),
    ]);
    const nextScenarioRelationships = await loadCampaignScenarioRelationships(campaignId).catch(
      () => [],
    );
    const nextAllRosterEntries = await loadCampaigns()
      .then((campaigns) =>
        Promise.allSettled(campaigns.map((entry) => loadCampaignRoster(entry.id))),
      )
      .then((results) =>
        results.flatMap((result) => (result.status === "fulfilled" ? result.value : [])),
      )
      .catch(() => nextRoster);

    setCampaign(nextCampaign);
    setOverview(nextOverview);
    setScenarios(nextScenarios);
    setScenarioRelationships(nextScenarioRelationships);
    onWorkspaceScenariosChanged?.(nextScenarios);
    setEntities(nextEntities);
    setAllRosterEntries(nextAllRosterEntries);
    setRoster(nextRoster);
    setCharacters(nextCharacters);
    const globalTemplates = nextTemplates.filter(
      (entity) => getCampaignActorMetadata(entity).actorClass === "template",
    );

    setTemplates(globalTemplates);
  }

  useEffect(() => {
    refreshPage()
      .catch((caughtError) => {
        if (
          caughtError instanceof ApiRequestError &&
          [401, 403, 404].includes(caughtError.status)
        ) {
          clearPrivateCampaignState();
        }
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
        kind: "mixed",
        name: scenarioName,
        status: "draft",
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

  async function handleActivateCampaign() {
    try {
      setError(undefined);
      setFeedback(undefined);
      const nextCampaign = await activateCampaignOnServer({ campaignId });

      setCampaign(nextCampaign);
      setFeedback(`Activated ${nextCampaign.name}.`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to activate campaign.");
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
          sourceType: candidate.sourceType,
        });

        setFeedback(
          candidate.sourceType === "character"
            ? `Marked ${entry.labelSnapshot ?? candidate.name} as a current PC.`
            : `Marked ${entry.labelSnapshot ?? candidate.name} as Campaign-relevant.`,
        );
        setRoster((current) =>
          current.some((rosterEntry) => rosterEntry.id === entry.id)
            ? current
            : [...current, entry],
        );
        setAllRosterEntries((current) =>
          current.some((rosterEntry) => rosterEntry.id === entry.id)
            ? current
            : [...current, entry],
        );
      } else {
        const rosterEntry =
          candidate.rosterEntry ??
          rosterBySourceKey.get(buildRosterSourceKey(candidate.sourceType, candidate.sourceId));

        if (!rosterEntry) {
          setFeedback(`${candidate.name} is already outside the campaign roster.`);
          await refreshPage();
          return;
        }

        const removalSource = getRosterRemovalSource({
          rosterEntry,
          sourceId: candidate.sourceId,
          sourceType: candidate.sourceType,
        });

        await removeCampaignRosterEntryOnServer({
          campaignId,
          sourceId: removalSource.sourceId,
          sourceType: removalSource.sourceType,
        });

        setFeedback(
          candidate.sourceType === "character"
            ? `Marked ${candidate.name} as a former PC. Campaign history is unchanged.`
            : `Removed ${candidate.name} from the prominent Campaign roster.`,
        );
        setRoster((current) =>
          removeRosterSourceFromList(current, {
            campaignId,
            sourceId: removalSource.sourceId,
            sourceType: removalSource.sourceType,
          }),
        );
        setAllRosterEntries((current) =>
          removeRosterSourceFromList(current, {
            campaignId,
            sourceId: removalSource.sourceId,
            sourceType: removalSource.sourceType,
          }),
        );
      }
      await refreshPage();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Unable to update campaign roster.",
      );
    }
  }

  function clearPrivateCampaignState() {
    setOverview(null);
    setRoster([]);
    setAllRosterEntries([]);
    setCharacters([]);
    setEntities([]);
    setCampaign(null);
  }

  function getContinuationLabel(scenarioId: string): string {
    const relationship = scenarioRelationships.find(
      (entry) => entry.relationType === "continues_from" && entry.toScenarioId === scenarioId,
    );

    if (!relationship) {
      return "—";
    }

    return (
      scenarios.find((scenario) => scenario.id === relationship.fromScenarioId)?.name ??
      "Earlier scenario"
    );
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
        <div style={{ marginBottom: "0.5rem" }}>Status: {campaign.status}</div>
        <p style={{ margin: 0 }}>{campaign.description || "No description yet."}</p>
        {campaign.status === "draft" ? (
          <div>
            <p>
              Once activated, rostered players can discover this Campaign in their active campaign
              list. Unrostered players remain blocked.
            </p>
            <p>Campaigns can be activated once, and cannot return to draft through this action.</p>
            <button
              onClick={() => void handleActivateCampaign()}
              type="button"
              style={{ background: "#2f5d62", color: "white", padding: "0.55rem 1rem" }}
            >
              Activate campaign
            </button>
          </div>
        ) : null}
      </div>

      {!embedded ? (
        <section
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "0.5rem",
            padding: "1rem",
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

      {overview ? <CampaignHomeOverview overview={overview} /> : null}
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
        }}
      >
        <section
          id="campaign-create-material"
          style={{
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "0.65rem",
            padding: "1rem",
          }}
        >
          <h2 style={{ margin: 0 }}>Create material</h2>
          <p style={{ margin: 0 }}>
            Start in the domain that owns the new material. Items and Artifacts keep their own
            identity and lifecycle.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <Link href={`${buildCampaignWorkspaceHref({ campaignId, tab: "items" })}&itemCreate=1`}>
              Create item
            </Link>
            <Link href="#campaign-artifacts">Upload Artifacts</Link>
          </div>
        </section>

        <section
          id="campaign-material"
          style={{
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "0.65rem",
            padding: "1rem",
          }}
        >
          <h2 style={{ margin: 0 }}>Notes, Items &amp; Artifacts</h2>
          <p style={{ margin: 0 }}>
            Use the Campaign to find related material, then manage each object in its established
            home.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <Link href="#campaign-notes">Notes</Link>
            <Link href={buildCampaignWorkspaceHref({ campaignId, tab: "items" })}>Items</Link>
            <Link href="#campaign-artifacts">Artifacts</Link>
          </div>
        </section>
      </div>
      {overview ? (
        <CampaignNotesPanel
          campaignId={campaignId}
          notes={overview.notes}
          onAuthorizationLoss={clearPrivateCampaignState}
          onNotesChanged={(notes) =>
            setOverview((current) => (current ? { ...current, notes } : current))
          }
          references={overview.references}
        />
      ) : null}

      <section
        id="campaign-membership"
        style={{
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem",
        }}
      >
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <h2 style={{ margin: 0 }}>Campaign roster</h2>
          <p style={{ margin: 0 }}>
            Campaign roster links make PCs, concrete NPCs, and templates available to this campaign.
            Scenario participant snapshots are created later from the scenario screen.
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
            <option value="current">Current / prominent</option>
            <option value="former">Former PCs</option>
            <option value="otherCampaigns">Other campaigns</option>
            <option value="available">Available</option>
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
                  <th
                    style={{
                      background: "#fff",
                      padding: "0.5rem 0.75rem 0.5rem 0",
                      position: "sticky",
                      textAlign: "center",
                      top: 0,
                    }}
                  >
                    Current
                  </th>
                  <th
                    style={{
                      background: "#fff",
                      padding: "0.5rem 0.75rem",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    Name
                  </th>
                  <th
                    style={{
                      background: "#fff",
                      padding: "0.5rem 0.75rem",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    Type
                  </th>
                  <th
                    style={{
                      background: "#fff",
                      padding: "0.5rem 0.75rem",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    Civilization
                  </th>
                  <th
                    style={{
                      background: "#fff",
                      padding: "0.5rem 0.75rem",
                      position: "sticky",
                      top: 0,
                    }}
                  >
                    Profession
                  </th>
                  <th
                    style={{ background: "#fff", padding: "0.5rem 0", position: "sticky", top: 0 }}
                  >
                    Owner
                  </th>
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

      <section
        id="campaign-create-scenario"
        style={{
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem",
        }}
      >
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
          onChange={(event) => setContinuesFromScenarioId(event.target.value)}
          value={continuesFromScenarioId}
        >
          <option value="">No previous scenario</option>
          {continuationScenarios.map((scenario) => (
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

      <section id="campaign-scenarios" style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Scenarios</h2>
        {!embedded ? (
          <p style={{ margin: 0 }}>
            Open a scenario to manage participants, controller assignment, live state, and the
            encounters that belong to that session.
          </p>
        ) : null}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <input
            aria-label="Search Scenarios"
            onChange={(event) => setScenarioSearch(event.target.value)}
            placeholder="Search Scenarios"
            type="search"
            value={scenarioSearch}
          />
          <select
            aria-label="Scenario lifecycle filter"
            onChange={(event) =>
              setScenarioStatusFilter(event.target.value as "all" | Scenario["status"])
            }
            value={scenarioStatusFilter}
          >
            <option value="all">All lifecycle states</option>
            <option value="draft">Draft</option>
            <option value="live">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Closed</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        {filteredScenarios.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 680, width: "100%" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Scenario</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Status</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Follows</th>
                  <th style={{ padding: "0.5rem 0" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredScenarios.map((scenario) => (
                  <tr key={scenario.id} style={{ borderBottom: "1px solid #eee8dc" }}>
                    <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>
                      <div>
                        <strong>{scenario.name}</strong>
                      </div>
                      <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                        {scenario.description || "No description yet."}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      {scenario.status === "completed"
                        ? "Closed · history"
                        : scenario.status.charAt(0).toUpperCase() + scenario.status.slice(1)}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      {getContinuationLabel(scenario.id)}
                    </td>
                    <td style={{ padding: "0.6rem 0" }}>
                      <Link
                        href={buildCampaignScenarioHref({
                          campaignId,
                          scenarioId: scenario.id,
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
          <div>No Scenarios match the current filters.</div>
        )}
      </section>

      <div id="campaign-artifacts">
        <ArtifactPanel campaignId={campaignId} scenarios={scenarios} />
      </div>
    </section>
  );
}
