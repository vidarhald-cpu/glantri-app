"use client";

import { ChangeEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

import { loadAdminSkillReferenceFromServer } from "@/lib/api/adminContentClient";
import type { AdminSkillReferenceResponse } from "@glantri/shared";
import {
  AdminDataTable,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminReadOnlyNotice,
  AdminSelect,
  AdminStatusBadge,
  AdminTagList,
  AdminTableColumn
} from "../../admin-ui";
import SkillsWorkspaceTabs from "../SkillsWorkspaceTabs";

type SnapshotMode = "candidate" | "canonical";

type CompetencyRow = AdminSkillReferenceResponse["canonical"]["records"]["competencies"][number];
type RelationshipRow = AdminSkillReferenceResponse["canonical"]["records"]["relationships"][number];
type DomainRow = AdminSkillReferenceResponse["canonical"]["records"]["domains"][number];
type ScriptRow = AdminSkillReferenceResponse["canonical"]["records"]["scripts"][number];
type ProfileRow = AdminSkillReferenceResponse["canonical"]["records"]["profiles"][number];
type HistoryRow = AdminSkillReferenceResponse["canonical"]["records"]["histories"][number];
type AccessExceptionRow = AdminSkillReferenceResponse["canonical"]["records"]["accessExceptions"][number];
type GenericRow<T extends { id: string }> = T;

function sortByName<T extends { name: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.name.localeCompare(right.name));
}

function sortByLabel<T extends { id: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}

function hasSearchMatch(row: CompetencyRow, query: string): boolean {
  const haystack = [
    row.id,
    row.name,
    row.kind,
    row.domainId,
    row.shortLabel,
    row.shortDescription,
    row.description
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(query);
}

function toDomainLabel(domainId: string): string {
  return domainId.replace(/^domain:/, "");
}

function formatPrerequisites(row: CompetencyRow): string {
  if (!row.prerequisites.length) {
    return "No prerequisites";
  }

  return row.prerequisites
    .map((requirement) => `${requirement.competencyId} (≥ ${requirement.threshold})`)
    .join("; ");
}

function joinValues(values: readonly string[]): string {
  return values.length === 0 ? "—" : values.join(", ");
}

function renderRelationshipBadge(relationship: RelationshipRow): string {
  return `${relationship.strength}%`;
}

export default function SkillReferencePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [mode, setMode] = useState<SnapshotMode>("canonical");
  const [snapshot, setSnapshot] = useState<AdminSkillReferenceResponse>();

  const [selectedCompetencyId, setSelectedCompetencyId] = useState<string>();
  const [searchText, setSearchText] = useState("");
  const [selectedKind, setSelectedKind] = useState<"all" | CompetencyRow["kind"]>("all");
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [zeroTransferOnly, setZeroTransferOnly] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState<string>("all");

  useEffect(() => {
    async function load() {
      try {
        const loaded = await loadAdminSkillReferenceFromServer();
        setSnapshot(loaded);
        setLoadError(undefined);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load skill reference.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  const activeSnapshot = snapshot?.[mode] ?? snapshot?.canonical;
  const candidateAvailable = Boolean(snapshot?.candidate);

  const competencies = useMemo(() => sortByLabel(activeSnapshot?.records.competencies ?? []), [activeSnapshot?.records.competencies]);
  const domains = useMemo(() => sortByLabel(activeSnapshot?.records.domains ?? []), [activeSnapshot?.records.domains]);
  const scripts = useMemo(() => sortByLabel(activeSnapshot?.records.scripts ?? []), [activeSnapshot?.records.scripts]);
  const profiles = useMemo(() => sortByLabel(activeSnapshot?.records.profiles ?? []), [activeSnapshot?.records.profiles]);
  const histories = useMemo(() => sortByLabel(activeSnapshot?.records.histories ?? []), [activeSnapshot?.records.histories]);
  const accessExceptions = useMemo(
    () => sortByLabel(activeSnapshot?.records.accessExceptions ?? []),
    [activeSnapshot?.records.accessExceptions]
  );

  const domainOptions = useMemo(
    () => ["all", ...new Set(competencies.map((item) => item.domainId))].sort(),
    [competencies]
  );
  const kindOptions = useMemo(
    () => ["all", ...new Set(competencies.map((item) => item.kind))].sort(),
    [competencies]
  );

  const filteredCompetencies = useMemo(() => {
    if (!activeSnapshot) {
      return [];
    }

    const query = searchText.trim().toLowerCase();

    return competencies.filter((competency) => {
      if (selectedKind !== "all" && competency.kind !== selectedKind) {
        return false;
      }

      if (selectedDomain !== "all" && competency.domainId !== selectedDomain) {
        return false;
      }

      if (zeroTransferOnly && competency.kind !== "specialization") {
        return false;
      }

      if (zeroTransferOnly && competency.kind === "specialization" && competency.transfer?.kind !== "zero-transfer") {
        return false;
      }

      return query === "" || hasSearchMatch(competency, query);
    });
  }, [activeSnapshot, competencies, searchText, selectedDomain, selectedKind, zeroTransferOnly]);

  const selectedCompetency = useMemo(
    () =>
      filteredCompetencies.find((competency) => competency.id === selectedCompetencyId) ??
      filteredCompetencies[0],
    [filteredCompetencies, selectedCompetencyId]
  );

  const relationshipRows = useMemo(() => {
    if (!activeSnapshot || !selectedCompetency) {
      return {
        incoming: [],
        outgoing: []
      } as { incoming: RelationshipRow[]; outgoing: RelationshipRow[] };
    }

    const incoming = activeSnapshot.records.relationships.filter(
      (relationship) => relationship.targetCompetencyId === selectedCompetency.id
    );
    const outgoing = activeSnapshot.records.relationships.filter(
      (relationship) => relationship.sourceCompetencyId === selectedCompetency.id
    );

    return {
      incoming: sortByLabel(incoming),
      outgoing: sortByLabel(outgoing)
    };
  }, [activeSnapshot, selectedCompetency]);

  const selectedProfile = useMemo(
    () => profiles.find((entry) => entry.id === selectedProfileId),
    [profiles, selectedProfileId]
  );

  const profileRows = useMemo(() => {
    if (!selectedProfile || !activeSnapshot || !selectedCompetency) {
      return {
        normalRoutes: [],
        exceptions: [],
        overrides: []
      } as {
        normalRoutes: Array<{
          accessBand: string;
          competencyIds: readonly string[];
          description: string;
          id: string;
        }>;
        exceptions: AccessExceptionRow[];
        overrides: Array<{
          attributionId: string;
          availability: string;
          competencyIds: readonly string[];
          explanation: string;
        }>;
      };
    }

    const normalRoutes = selectedProfile.normalRoutes.filter((route) =>
      route.competencyIds.includes(selectedCompetency.id)
    );
    const exceptions = accessExceptions.filter((entry) => entry.profileId === selectedProfile.id);
    const overrides = selectedProfile.overrides.filter((override) => override.competencyIds.length > 0);

    return {
      normalRoutes,
      exceptions,
      overrides
    };
  }, [accessExceptions, selectedCompetency, selectedProfile]);

  const relatedHistories = useMemo(
    () =>
      histories.filter((history) => {
        if (!selectedCompetency) {
          return false;
        }

        return (
          history.fixedCompetencyIds.includes(selectedCompetency.id) ||
          history.selectionSlots.some((slot) => slot.candidateCompetencyIds.includes(selectedCompetency.id))
        );
      }),
    [histories, selectedCompetency]
  );

  useEffect(() => {
    if (!snapshot) {
      return;
    }

    if (selectedDomain !== "all" && !activeSnapshot?.records.domains.some(({ id }) => id === selectedDomain)) {
      setSelectedDomain("all");
    }

    if (!activeSnapshot || filteredCompetencies.length === 0) {
      setSelectedCompetencyId(undefined);
      return;
    }

    if (!filteredCompetencies.some((competency) => competency.id === selectedCompetencyId)) {
      setSelectedCompetencyId(filteredCompetencies[0]?.id);
    }
  }, [activeSnapshot, filteredCompetencies, selectedCompetencyId, selectedDomain, snapshot]);

  useEffect(() => {
    if (selectedProfileId === "all") {
      return;
    }

    if (!selectedProfile) {
      setSelectedProfileId("all");
    }
  }, [profiles, selectedProfile, selectedProfileId]);

  if (isLoading) {
    return <div style={{ color: "#3f3422" }}>Loading Admin Skill Reference…</div>;
  }

  if (!snapshot || !activeSnapshot) {
    return (
      <AdminPanel title="Skill Reference" subtitle="Unable to render from the selected source.">
        <AdminReadOnlyNotice message={loadError ?? "Reference data is currently unavailable."} />
      </AdminPanel>
    );
  }

  const competencyColumns: AdminTableColumn<GenericRow<CompetencyRow>>[] = [
    {
      header: "ID",
      render: (row: CompetencyRow) => (
        <a href={`#competency-${row.id}`} style={{ color: "#3d5b8f", textDecoration: "underline" }}>
          {row.id}
        </a>
      )
    },
    { header: "Name", render: (row: CompetencyRow) => row.name },
    { header: "Kind", render: (row: CompetencyRow) => row.kind },
    { header: "Domain", render: (row: CompetencyRow) => toDomainLabel(row.domainId) },
    { header: "Weight", render: (row: CompetencyRow) => String(row.weight) },
    {
      header: "Status",
      render: (row: CompetencyRow) => <AdminStatusBadge>{row.status}</AdminStatusBadge>
    },
    {
      header: "Dependencies",
      render: (row: CompetencyRow) => formatPrerequisites(row)
    },
    { header: "Short", render: (row: CompetencyRow) => row.shortDescription }
  ];

  const relationshipColumns: AdminTableColumn<GenericRow<RelationshipRow>>[] = [
    { header: "Source", render: (row: RelationshipRow) => row.sourceCompetencyId },
    { header: "Target", render: (row: RelationshipRow) => row.targetCompetencyId },
    { header: "Strength", render: (row: RelationshipRow) => renderRelationshipBadge(row) },
    { header: "Rationale", render: (row: RelationshipRow) => row.rationale }
  ];

  const domainColumns: AdminTableColumn<GenericRow<DomainRow>>[] = [
    { header: "ID", render: (row: DomainRow) => row.id },
    { header: "Name", render: (row: DomainRow) => row.name },
    { header: "Description", render: (row: DomainRow) => row.description }
  ];

  const scriptColumns: AdminTableColumn<GenericRow<ScriptRow>>[] = [
    { header: "Script ID", render: (row: ScriptRow) => row.id },
    { header: "Name", render: (row: ScriptRow) => row.name },
    { header: "Families", render: (row: ScriptRow) => joinValues(row.familyIds) },
    { header: "Description", render: (row: ScriptRow) => row.description }
  ];

  const historyColumns: AdminTableColumn<GenericRow<HistoryRow>>[] = [
    { header: "History ID", render: (row: HistoryRow) => row.id },
    { header: "Name", render: (row: HistoryRow) => row.name },
    { header: "Context", render: (row: HistoryRow) => row.context },
    {
      header: "Fixed competencies",
      render: (row: HistoryRow) => joinValues(row.fixedCompetencyIds)
    },
    {
      header: "Slot labels",
      render: (row: HistoryRow) =>
        joinValues(row.selectionSlots.map((slot) => `${slot.label} (${slot.chooseCount})`))
    }
  ];

  const accessColumns: AdminTableColumn<GenericRow<AccessExceptionRow>>[] = [
    { header: "Exception", render: (row: AccessExceptionRow) => row.id },
    { header: "Profile", render: (row: AccessExceptionRow) => row.profileId },
    { header: "Basis", render: (row: AccessExceptionRow) => row.basis },
    { header: "Competencies", render: (row: AccessExceptionRow) => joinValues(row.competencyIds) },
    { header: "History IDs", render: (row: AccessExceptionRow) => joinValues(row.historyIds) },
    { header: "Grants", render: (row: AccessExceptionRow) => String(row.grantsCompetence) }
  ];

  const profileRouteColumns: AdminTableColumn<{
    accessBand: string;
    competencyIds: readonly string[];
    description: string;
    id: string;
  }>[] = [
    { header: "Profile route", render: (row: { id: string }) => row.id },
    { header: "Band", render: (row: { accessBand: string }) => row.accessBand },
    {
      header: "Competencies",
      render: (row: { competencyIds: readonly string[] }) => (
        <AdminTagList emptyLabel="No competency listed" values={Array.from(row.competencyIds)} />
      )
    },
    { header: "Description", render: (row: { description: string }) => row.description }
  ];

  const handleRowKeyDown = (row: CompetencyRow, event: KeyboardEvent<HTMLTableRowElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    setSelectedCompetencyId(row.id);
  };

  return (
    <section
      style={{ display: "grid", gap: "1.25rem" }}
    >
      <AdminPageIntro
        eyebrow="Admin / Skills"
        summary="Canonical Pilot skill content for read-only Admin review, including profiles, relationships, and access. Legacy skill catalogue is edited from the separate legacy path."
        title="Admin Skill Reference"
      />

      <SkillsWorkspaceTabs />

      <AdminReadOnlyNotice message="Read-only reference surface. No publish or edit workflow is active from this page."
      />

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))"
        }}
      >
        <AdminMetric
          label="Mode"
          value={
            <AdminSelect
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setMode(event.target.value as SnapshotMode)}
              value={mode}
            >
              <option value="canonical">Canonical</option>
              <option value="candidate">Candidate</option>
            </AdminSelect>
          }
        />
        <AdminMetric
          label="Snapshot status"
          value={
            <AdminStatusBadge tone={activeSnapshot.status === "canonical" ? "success" : "neutral"}>
              {activeSnapshot.status}
            </AdminStatusBadge>
          }
        />
        <AdminMetric
          label="Compatibility"
          value={activeSnapshot.compatibility.classification}
          hint={activeSnapshot.compatibility.rationale}
        />
        <AdminMetric
          label="Candidate status"
          value={candidateAvailable ? "present" : "absent"}
          hint={
            candidateAvailable ? "Candidate payload loaded" : "No integrated candidate payload yet"
          }
        />
      </div>

      <AdminPanel title="Content contract / provenance" subtitle="Canonical release identity required for provenance checks.">
        <div style={{ display: "grid", gap: "0.45rem", color: "#4f4635", lineHeight: 1.5 }}>
          <div><strong>Title:</strong> {activeSnapshot.title}</div>
          <div>
            <strong>Canonical source:</strong> {activeSnapshot.contentVersion}
          </div>
          <div><strong>Schema:</strong> {activeSnapshot.schemaVersion}</div>
          <div><strong>Rules version:</strong> {activeSnapshot.rulesVersion}</div>
          <div><strong>Digest:</strong> {activeSnapshot.manifest.packageDigest}</div>
          <div>
            <strong>Semantic:</strong> {activeSnapshot.manifest.semanticDigest ?? "absent in current release snapshot"}
          </div>
          <div><strong>Rules docs:</strong> <a href="/admin/rules-docs">Open Rules Docs</a></div>
          <div><strong>Provenance:</strong> {joinValues(activeSnapshot.provenance)}</div>
        </div>
      </AdminPanel>

      <AdminPanel title="Search and filter" subtitle="Use this to locate competencies and route-specific details.">
        <div style={{ display: "grid", gap: "0.55rem", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ color: "#5f543a", fontSize: "0.9rem", fontWeight: 600 }}>
              Search
            </span>
            <input
              value={searchText}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setSearchText(event.target.value)}
              style={{
                background: "rgba(255, 252, 245, 0.95)",
                border: "1px solid rgba(85, 73, 48, 0.18)",
                borderRadius: 14,
                color: "#2e2619",
                padding: "0.5rem 0.8rem",
                width: "100%"
              }}
            />
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ color: "#5f543a", fontSize: "0.9rem", fontWeight: 600 }}>
              Kind
            </span>
            <AdminSelect
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setSelectedKind(event.target.value as "all" | CompetencyRow["kind"])
              }
              value={selectedKind}
            >
              {kindOptions.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </AdminSelect>
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ color: "#5f543a", fontSize: "0.9rem", fontWeight: 600 }}>
              Domain
            </span>
            <AdminSelect
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedDomain(event.target.value)}
              value={selectedDomain}
            >
              {domainOptions.map((domain) => (
                <option key={domain} value={domain}>
                  {domain === "all" ? "All domains" : toDomainLabel(domain)}
                </option>
              ))}
            </AdminSelect>
          </label>
          <label style={{ alignItems: "start", display: "flex", gap: "0.45rem", marginTop: "1.2rem" }}>
            <input
              checked={zeroTransferOnly}
              id="zero-transfer-only"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setZeroTransferOnly(event.target.checked)}
              type="checkbox"
            />
            <span>Only zero-transfer specializations</span>
          </label>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span style={{ color: "#5f543a", fontSize: "0.9rem", fontWeight: 600 }}>Profile</span>
            <AdminSelect
              onChange={(event: ChangeEvent<HTMLSelectElement>) => setSelectedProfileId(event.target.value)}
              value={selectedProfileId}
            >
              <option value="all">All profiles</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </AdminSelect>
          </label>
        </div>
      </AdminPanel>

      {mode === "candidate" && !candidateAvailable ? (
        <AdminReadOnlyNotice message="Candidate contract is not available yet. Integrated pilot proposal data must be explicitly onboarded before this mode can render." />
      ) : null}

      <AdminPanel title="Competency catalog" subtitle="Legacy Catalogue remains in /admin/skills for live catalog authoring.">
        <AdminDataTable
          columns={competencyColumns}
          emptyState="No competencies match current search or filters."
          onSelect={setSelectedCompetencyId}
          rows={filteredCompetencies}
          selectedId={selectedCompetency?.id}
          onRowKeyDown={handleRowKeyDown}
        />
      </AdminPanel>

      {selectedCompetency ? (
        <div id={`competency-${selectedCompetency.id}`}>
          <AdminPanel
            title={`Competency detail: ${selectedCompetency.name}`}
            subtitle={`Competency ${selectedCompetency.id}`}
          >
            <div style={{ display: "grid", gap: "0.85rem", lineHeight: 1.45 }}>
              <div><strong>Kind:</strong> {selectedCompetency.kind}</div>
              <div><strong>Domain:</strong> {selectedCompetency.domainId}</div>
            <div><strong>Weight:</strong> {selectedCompetency.weight}</div>
            <div><strong>Record version:</strong> {selectedCompetency.recordVersion}</div>
            <div><strong>Status:</strong> {selectedCompetency.status}</div>
            <div><strong>Practical prerequisites:</strong> {formatPrerequisites(selectedCompetency)}</div>
            <div><strong>Short:</strong> {selectedCompetency.shortDescription}</div>
            <div><strong>Full:</strong> {selectedCompetency.description}</div>
            <div>
              <strong>Language / script binding:</strong> {selectedCompetency.writtenLanguageBinding
                ? `${selectedCompetency.writtenLanguageBinding.spokenLanguageId} / ${selectedCompetency.writtenLanguageBinding.scriptId}`
                : "—"}
            </div>
            <div><strong>Transfer policy:</strong> {selectedCompetency.transfer?.kind === "zero-transfer"
              ? `Zero-transfer: ${selectedCompetency.transfer.rationale}`
              : selectedCompetency.transfer
                ? `Explicit relationships: ${selectedCompetency.transfer.relationshipIds.join(", ")}`
                : "No explicit transfer policy."}
            </div>
            <div><strong>Task envelope:</strong> {selectedCompetency.taskEnvelope.useGuidance}</div>
              <div>
                <strong>Task methods:</strong>
                <ul>
                  {selectedCompetency.taskEnvelope.methods.map((method) => (
                    <li key={method}>{method}</li>
                  ))}
                </ul>
              </div>
              <div>
                <strong>Provenance:</strong> {joinValues(selectedCompetency.provenance)}
              </div>
            </div>
          </AdminPanel>
        </div>
      ) : null}

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <AdminPanel title="Direct links" subtitle="Profiles, routes, and history are linked to selected competency.">
          <div style={{ display: "grid", gap: "0.65rem" }}>
            <div><strong>Outbound relationships:</strong></div>
            <AdminDataTable
              columns={relationshipColumns}
              emptyState="No outgoing relationships"
              rows={relationshipRows.outgoing}
              onSelect={undefined}
            />
            <div><strong>Inbound relationships:</strong></div>
            <AdminDataTable
              columns={relationshipColumns}
              emptyState="No inbound relationships"
              rows={relationshipRows.incoming}
              onSelect={undefined}
            />
          </div>
        </AdminPanel>

        <AdminPanel title="Profile access" subtitle="Selected profile route/override/exceptions for selected competency.">
          <div style={{ display: "grid", gap: "0.55rem" }}>
            <div>
              <strong>Selected profile:</strong> {selectedProfile?.name ?? "(all profiles)"}
            </div>
            {selectedProfile ? (
              <div style={{ display: "grid", gap: "0.45rem" }}>
                <div>
                  <strong>Access band:</strong> {selectedProfile.accessBand}; <strong>stage:</strong> {selectedProfile.developmentStage}
                </div>
                <AdminDataTable
                  columns={profileRouteColumns}
                  emptyState="No active routes"
                  rows={profileRows.normalRoutes}
                  onSelect={undefined}
                />
                <div>
                  <strong>Overrides:</strong>
                  <div style={{ marginTop: "0.4rem" }}>
                    <AdminTagList
                      values={profileRows.overrides.map(
                        (override) => `${override.attributionId} (${override.availability})`
                      )}
                    />
                  </div>
                </div>
                <AdminDataTable
                  columns={accessColumns}
                  emptyState="No access exceptions"
                  rows={profileRows.exceptions}
                  onSelect={undefined}
                />
              </div>
            ) : (
              <AdminReadOnlyNotice message="No profile selected. Pick a profile to focus access routes and overrides." />
            )}
          </div>
        </AdminPanel>
      </div>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))"
        }}
      >
        <AdminPanel title="Domains" subtitle="Pilot domain catalog slice used in reference projection.">
          <AdminDataTable
            columns={domainColumns}
            emptyState="No domains available."
            rows={domains}
            onSelect={undefined}
          />
        </AdminPanel>

        <AdminPanel title="Scripts" subtitle="Binding families and generated language-script records.">
          <AdminDataTable
            columns={scriptColumns}
            emptyState="No script records available."
            rows={scripts}
            onSelect={undefined}
          />
        </AdminPanel>
      </div>

      <AdminPanel title="Histories" subtitle="Grouped progression context and membership.">
        <AdminDataTable
          columns={historyColumns}
          emptyState="No grouped histories available."
          rows={relatedHistories}
          onSelect={undefined}
        />
      </AdminPanel>

      <AdminPanel title="Access exceptions" subtitle="Eligibility and override scope for selected profile scope.">
        <AdminDataTable
          columns={accessColumns}
          emptyState="No access exceptions available."
          rows={selectedProfile
            ? profileRows.exceptions
            : accessExceptions}
          onSelect={undefined}
        />
      </AdminPanel>

      {loadError ? <AdminReadOnlyNotice message={loadError} /> : null}
    </section>
  );
}
