"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";

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
  AdminTableColumn
} from "../../admin-ui";
import SkillsWorkspaceTabs from "../SkillsWorkspaceTabs";

type SnapshotMode = "candidate" | "canonical";

type CompetencyRow = AdminSkillReferenceResponse["canonical"]["records"]["competencies"][number];

type RelationshipRow = AdminSkillReferenceResponse["canonical"]["records"]["relationships"][number];
type DomainRow = AdminSkillReferenceResponse["canonical"]["records"]["domains"][number];
type ScriptRow = AdminSkillReferenceResponse["canonical"]["records"]["scripts"][number];
type ProfileRow = AdminSkillReferenceResponse["canonical"]["records"]["profiles"][number];
type AccessExceptionRow = AdminSkillReferenceResponse["canonical"]["records"]["accessExceptions"][number];

type GenericRow<T extends { id: string }> = T;

function sortByName<T extends { name: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.name.localeCompare(right.name));
}

function formatDependencyText(prerequisites: CompetencyRow["prerequisites"]): string {
  if (prerequisites.length === 0) {
    return "No prerequisites";
  }

  return prerequisites
    .map(
      (prerequisite: CompetencyRow["prerequisites"][number]) =>
        `${prerequisite.competencyId} (≥ ${prerequisite.threshold})`
    )
    .join("; ");
}

function formatStringSet(values: readonly string[]): string {
  if (values.length === 0) {
    return "None";
  }

  return values.join(", ");
}

function formatTransfer(transfer?: CompetencyRow["transfer"]): string {
  if (!transfer) {
    return "Not a specialization transfer";
  }

  if (transfer.kind === "explicit-relationships") {
    return `Explicit relationships from ${formatStringSet(transfer.relationshipIds)}`;
  }

  return `Zero-transfer: ${transfer.rationale}`;
}

export default function SkillReferencePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [mode, setMode] = useState<SnapshotMode>("canonical");
  const [snapshot, setSnapshot] = useState<AdminSkillReferenceResponse>();
  const [selectedCompetencyId, setSelectedCompetencyId] = useState<string>();

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

  const competencies = useMemo(
    () => sortByName(activeSnapshot?.records.competencies ?? []),
    [activeSnapshot?.records.competencies]
  );
  const selectedCompetency = useMemo(
    () =>
      competencies.find((competency) => competency.id === selectedCompetencyId) ??
      competencies[0],
    [competencies, selectedCompetencyId]
  );

  useEffect(() => {
    if (!selectedCompetencyId && competencies[0]) {
      setSelectedCompetencyId(competencies[0].id);
    }
  }, [competencies, selectedCompetencyId]);

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
    { header: "ID", render: (row: CompetencyRow) => row.id },
    { header: "Name", render: (row: CompetencyRow) => row.name },
    { header: "Kind", render: (row: CompetencyRow) => row.kind },
    { header: "Domain", render: (row: CompetencyRow) => row.domainId || "—" },
    { header: "Weight", render: (row: CompetencyRow) => String(row.weight) },
    {
      header: "Status",
      render: (row: CompetencyRow) => <AdminStatusBadge>{row.status}</AdminStatusBadge>
    },
    {
      header: "Dependencies",
      render: (row: CompetencyRow) =>
        row.prerequisites.length === 0 ? "—" : `${row.prerequisites.length}`
    },
    { header: "Short", render: (row: CompetencyRow) => row.shortDescription }
  ];

  const relationshipColumns: AdminTableColumn<GenericRow<RelationshipRow>>[] = [
    { header: "Source", render: (row: RelationshipRow) => row.sourceCompetencyId },
    { header: "Target", render: (row: RelationshipRow) => row.targetCompetencyId },
    { header: "Strength", render: (row: RelationshipRow) => `${row.strength}%` },
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
    { header: "Families", render: (row: ScriptRow) => formatStringSet(row.familyIds) },
    { header: "Description", render: (row: ScriptRow) => row.description }
  ];

  const profileColumns: AdminTableColumn<GenericRow<ProfileRow>>[] = [
    { header: "Profile", render: (row: ProfileRow) => row.name },
    { header: "Access band", render: (row: ProfileRow) => row.accessBand },
    { header: "Stage", render: (row: ProfileRow) => row.developmentStage },
    {
      header: "Routes",
      render: (row: ProfileRow) => `${row.normalRoutes.length} routes / ${row.overrides.length} overrides`
    }
  ];

  const accessExceptionColumns: AdminTableColumn<GenericRow<AccessExceptionRow>>[] = [
    { header: "Exception", render: (row: AccessExceptionRow) => row.id },
    { header: "Profile", render: (row: AccessExceptionRow) => row.profileId },
    { header: "Basis", render: (row: AccessExceptionRow) => row.basis },
    {
      header: "Competencies",
      render: (row: AccessExceptionRow) => formatStringSet(row.competencyIds)
    },
    { header: "History IDs", render: (row: AccessExceptionRow) => formatStringSet(row.historyIds) }
  ];

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Skills"
        summary="This read-only reference projects the canonical Pilot v1 skill content into a review-focused shape: competencies, dependencies, relationships, domains, profiles, access exceptions, and language/writing bindings."
        title="Admin Skill Reference"
      />

      <SkillsWorkspaceTabs />

      <AdminReadOnlyNotice message="Read-only reference surface. No publish or edit workflow is active from this page." />

      <div
        style={{
          display: "grid",
          gap: "0.8rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))"
        }}
      >
        <AdminMetric
          label="Mode"
          value={
            <AdminSelect
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setMode(event.target.value as SnapshotMode)
              }
              value={mode}
            >
              <option value="canonical">Canonical</option>
              <option value="candidate">Candidate</option>
            </AdminSelect>
          }
        />
        <AdminMetric
          label="Status"
          value={
            <AdminStatusBadge tone={activeSnapshot.status === "canonical" ? "success" : "neutral"}>
              {activeSnapshot.status}
            </AdminStatusBadge>
          }
          hint="Used for review only"
        />
        <AdminMetric
          label="Provenance entries"
          value={activeSnapshot.provenance.length}
        />
        <AdminMetric
          label="Compatibility"
          value={activeSnapshot.compatibility.classification}
          hint={activeSnapshot.compatibility.rationale}
        />
      </div>

      <AdminPanel
        title="Content metadata"
        subtitle="Versions and provenance for review and handoff."
      >
        <div style={{ display: "grid", gap: "0.35rem", color: "#4f4635", lineHeight: 1.6 }}>
          <div><strong>Title:</strong> {activeSnapshot.title}</div>
          <div><strong>Content version:</strong> {activeSnapshot.contentVersion}</div>
          <div><strong>Schema:</strong> {activeSnapshot.schemaVersion}</div>
          <div><strong>Rules version:</strong> {activeSnapshot.rulesVersion}</div>
          <div><strong>Digest:</strong> {activeSnapshot.manifest.packageDigest}</div>
          <div>
            <strong>Record counts:</strong> {activeSnapshot.manifest.counts.competencies} competencies, {" "}
            {activeSnapshot.manifest.counts.relationships} relationships, {" "}
            {activeSnapshot.manifest.counts.domains} domains
          </div>
          <div><strong>Provenance:</strong> {formatStringSet(activeSnapshot.provenance)}</div>
        </div>
      </AdminPanel>

      <AdminPanel title="Competency catalog" subtitle="Select a row to inspect task and binding details.">
        <AdminDataTable
          columns={competencyColumns}
          emptyState="No competencies found."
          onSelect={setSelectedCompetencyId}
          rows={competencies}
          selectedId={selectedCompetency?.id}
        />
      </AdminPanel>

      {selectedCompetency ? (
        <AdminPanel title={selectedCompetency.name} subtitle="Canonical fields for review.">
          <div style={{ display: "grid", gap: "0.75rem", lineHeight: 1.45 }}>
            <div><strong>ID:</strong> {selectedCompetency.id}</div>
            <div><strong>Domain:</strong> {selectedCompetency.domainId || "—"}</div>
            <div><strong>Kind:</strong> {selectedCompetency.kind}</div>
            <div><strong>Parent:</strong> {selectedCompetency.parentCompetencyId ?? "—"}</div>
            <div><strong>Acquisition weight:</strong> {selectedCompetency.acquisitionWeight ?? "—"}</div>
            <div><strong>Short label:</strong> {selectedCompetency.shortLabel}</div>
            <div><strong>Short description:</strong> {selectedCompetency.shortDescription}</div>
            <div><strong>Full description:</strong> {selectedCompetency.description}</div>
            <div><strong>Prerequisites:</strong> {formatDependencyText(selectedCompetency.prerequisites)}</div>
            <div><strong>Task guidance:</strong> {selectedCompetency.taskEnvelope.useGuidance}</div>
            <div><strong>Transfer:</strong> {formatTransfer(selectedCompetency.transfer)}</div>
            <div>
              <strong>Language/writing:</strong> {selectedCompetency.writtenLanguageBinding
                ? `${selectedCompetency.writtenLanguageBinding.scriptId} / ${selectedCompetency.writtenLanguageBinding.spokenLanguageId}`
                : "—"}
            </div>
            <div><strong>Record version:</strong> {selectedCompetency.recordVersion}</div>
            <div><strong>Provenance:</strong> {formatStringSet(selectedCompetency.provenance)}</div>
          </div>
        </AdminPanel>
      ) : null}

      <AdminPanel title="Relationships" subtitle="Canonical directional relationship set." >
          <AdminDataTable
            columns={relationshipColumns}
            emptyState="No recorded explicit relationships."
            rows={activeSnapshot.records.relationships.map((row: RelationshipRow) => ({
              ...row,
              name: `${row.sourceCompetencyId}->${row.targetCompetencyId}`
            }))}
          onSelect={undefined}
        />
      </AdminPanel>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))"
        }}
      >
        <AdminPanel title="Domains" subtitle="Pilot domain records exposed to this projection.">
            <AdminDataTable
              columns={domainColumns}
              emptyState="No domains available."
              rows={[...activeSnapshot.records.domains]}
              onSelect={undefined}
            />
        </AdminPanel>
        <AdminPanel title="Scripts" subtitle="Derived language/script bindings from written competencies.">
          <AdminDataTable
            columns={scriptColumns}
            emptyState="No script bindings available."
            rows={sortByName(activeSnapshot.records.scripts)}
            onSelect={undefined}
          />
        </AdminPanel>
      </div>

      <AdminPanel title="Profiles" subtitle="Applicability routes and overrides.">
          <AdminDataTable
            columns={profileColumns}
            emptyState="No access profiles available."
            rows={[...activeSnapshot.records.profiles]}
            onSelect={undefined}
          />
      </AdminPanel>

      <AdminPanel title="Access exceptions" subtitle="Exceptions and grant metadata (informational).">
          <AdminDataTable
            columns={accessExceptionColumns}
            emptyState="No access exceptions available."
            rows={[...activeSnapshot.records.accessExceptions]}
            onSelect={undefined}
          />
      </AdminPanel>

      {loadError ? <AdminReadOnlyNotice message={loadError} /> : null}
    </section>
  );
}
