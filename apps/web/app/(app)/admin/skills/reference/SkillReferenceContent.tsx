"use client";

import { type ChangeEvent, type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

import { loadAdminSkillReferenceFromServer } from "@/lib/api/adminContentClient";
import type { AdminSkillReferenceResponse, AdminSkillReferenceSnapshot } from "@glantri/shared";
import {
  AdminDataTable,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminReadOnlyNotice,
  AdminSelect,
  AdminStatusBadge,
  type AdminTableColumn,
} from "../../admin-ui";
import SkillsWorkspaceTabs from "../SkillsWorkspaceTabs";

type SnapshotMode = "candidate" | "canonical";
type CompetencyRow = AdminSkillReferenceSnapshot["records"]["competencies"][number];
type RelationshipRow = AdminSkillReferenceSnapshot["records"]["relationships"][number];
type DomainRow = AdminSkillReferenceSnapshot["records"]["domains"][number];
type ScriptRow = AdminSkillReferenceSnapshot["records"]["scripts"][number];
type ProfileRow = AdminSkillReferenceSnapshot["records"]["profiles"][number];
type HistoryRow = AdminSkillReferenceSnapshot["records"]["histories"][number];
type AccessExceptionRow = AdminSkillReferenceSnapshot["records"]["accessExceptions"][number];
type Availability = "available" | "restricted" | "unavailable";

interface AccessResolution {
  attribution?: string;
  availability: Availability;
  exceptionCount: number;
  explanation: string;
  resolvedBy: "competency override" | "normal route" | "safe restricted fallback";
}

function sortById<T extends { id: string }>(values: readonly T[]): T[] {
  return [...values].sort((left, right) => left.id.localeCompare(right.id));
}

function joinValues(values: readonly string[]): string {
  return values.length === 0 ? "—" : values.join(", ");
}

function toLabel(id: string): string {
  return id
    .replace(/^[^:]+:/, "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function competencyIdFromHash(): string | undefined {
  if (typeof window === "undefined" || !window.location.hash.startsWith("#competency-")) {
    return undefined;
  }

  return decodeURIComponent(window.location.hash.slice("#competency-".length));
}

function formatPrerequisites(row: CompetencyRow, names: ReadonlyMap<string, string>): string {
  if (row.prerequisites.length === 0) {
    return "No prerequisites";
  }

  return row.prerequisites
    .map((requirement) => {
      const label = names.get(requirement.competencyId) ?? requirement.competencyId;
      const justification = requirement.justification ? ` — ${requirement.justification}` : "";
      return `${label} ${requirement.threshold}+${justification}`;
    })
    .join("; ");
}

function exceptionsForCompetency(
  exceptions: readonly AccessExceptionRow[],
  profileId: string,
  competencyId: string,
): AccessExceptionRow[] {
  return exceptions.filter(
    (entry) => entry.profileId === profileId && entry.competencyIds.includes(competencyId),
  );
}

function resolveProfileAccess(
  profile: ProfileRow,
  competency: CompetencyRow,
  exceptions: readonly AccessExceptionRow[],
): AccessResolution {
  const applicableExceptions = exceptionsForCompetency(exceptions, profile.id, competency.id);
  const override = profile.overrides
    .filter((entry) => entry.competencyIds.includes(competency.id))
    .sort((left, right) => left.attributionId.localeCompare(right.attributionId))[0];

  if (override) {
    return {
      attribution: override.attributionId,
      availability: override.availability as Availability,
      exceptionCount: applicableExceptions.length,
      explanation: override.explanation,
      resolvedBy: "competency override",
    };
  }

  const route = profile.normalRoutes
    .filter((entry) => entry.competencyIds.includes(competency.id))
    .sort((left, right) => left.id.localeCompare(right.id))[0];

  if (route) {
    return {
      attribution: route.id,
      availability: "available",
      exceptionCount: applicableExceptions.length,
      explanation: route.description,
      resolvedBy: "normal route",
    };
  }

  return {
    availability: "restricted",
    exceptionCount: applicableExceptions.length,
    explanation: "No authored route or override applies, so access resolves restricted.",
    resolvedBy: "safe restricted fallback",
  };
}

function relationshipSentence(
  relationship: RelationshipRow,
  direction: "incoming" | "outgoing",
  names: ReadonlyMap<string, string>,
): string {
  if (direction === "incoming") {
    return `Receives ${relationship.strength}% from ${names.get(relationship.sourceCompetencyId) ?? relationship.sourceCompetencyId}`;
  }

  return `Contributes ${relationship.strength}% to ${names.get(relationship.targetCompetencyId) ?? relationship.targetCompetencyId}`;
}

function hasSearchMatch(row: CompetencyRow, query: string): boolean {
  return [
    row.id,
    row.name,
    row.shortLabel,
    row.shortDescription,
    row.description,
    row.domainId,
    row.kind,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function SkillReferenceContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [mode, setMode] = useState<SnapshotMode>("candidate");
  const [snapshot, setSnapshot] = useState<AdminSkillReferenceResponse>();
  const [selectedCompetencyId, setSelectedCompetencyId] = useState<string | undefined>(
    competencyIdFromHash,
  );
  const [searchText, setSearchText] = useState("");
  const [selectedKind, setSelectedKind] = useState<"all" | CompetencyRow["kind"]>("all");
  const [selectedDomain, setSelectedDomain] = useState("all");
  const [selectedWeight, setSelectedWeight] = useState("all");
  const [selectedPrerequisite, setSelectedPrerequisite] = useState("all");
  const [selectedRelationship, setSelectedRelationship] = useState("all");
  const [selectedAccessException, setSelectedAccessException] = useState("all");
  const [selectedAvailability, setSelectedAvailability] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [zeroTransferOnly, setZeroTransferOnly] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState("all");
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusDetailAfterSelection = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const loaded = await loadAdminSkillReferenceFromServer();
        setSnapshot(loaded);
        setMode(loaded.candidate ? "candidate" : "canonical");
        setLoadError(undefined);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "Unable to load Skill Reference.");
      } finally {
        setIsLoading(false);
      }
    }

    void load();
  }, []);

  useEffect(() => {
    const restoreDirectLink = () => setSelectedCompetencyId(competencyIdFromHash());
    window.addEventListener("hashchange", restoreDirectLink);
    return () => window.removeEventListener("hashchange", restoreDirectLink);
  }, []);

  const activeSnapshot = snapshot?.[mode] ?? null;
  const competencies = useMemo(
    () => sortById(activeSnapshot?.records.competencies ?? []),
    [activeSnapshot?.records.competencies],
  );
  const domains = useMemo(
    () => sortById(activeSnapshot?.records.domains ?? []),
    [activeSnapshot?.records.domains],
  );
  const scripts = useMemo(
    () => sortById(activeSnapshot?.records.scripts ?? []),
    [activeSnapshot?.records.scripts],
  );
  const profiles = useMemo(
    () => sortById(activeSnapshot?.records.profiles ?? []),
    [activeSnapshot?.records.profiles],
  );
  const histories = useMemo(
    () => sortById(activeSnapshot?.records.histories ?? []),
    [activeSnapshot?.records.histories],
  );
  const accessExceptions = useMemo(
    () => sortById(activeSnapshot?.records.accessExceptions ?? []),
    [activeSnapshot?.records.accessExceptions],
  );
  const relationships = useMemo(
    () => sortById(activeSnapshot?.records.relationships ?? []),
    [activeSnapshot?.records.relationships],
  );
  const names = useMemo(
    () => new Map(competencies.map((competency) => [competency.id, competency.name])),
    [competencies],
  );
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);

  const filteredCompetencies = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return competencies.filter((competency) => {
      const incoming = relationships.some(
        (relationship) => relationship.targetCompetencyId === competency.id,
      );
      const outgoing = relationships.some(
        (relationship) => relationship.sourceCompetencyId === competency.id,
      );
      const hasException = accessExceptions.some((entry) =>
        entry.competencyIds.includes(competency.id),
      );
      const access = selectedProfile
        ? resolveProfileAccess(selectedProfile, competency, accessExceptions)
        : undefined;

      return (
        (query === "" || hasSearchMatch(competency, query)) &&
        (selectedKind === "all" || competency.kind === selectedKind) &&
        (selectedDomain === "all" || competency.domainId === selectedDomain) &&
        (selectedWeight === "all" || competency.weight === Number(selectedWeight)) &&
        (selectedPrerequisite === "all" ||
          (selectedPrerequisite === "has") === competency.prerequisites.length > 0) &&
        (selectedRelationship === "all" ||
          (selectedRelationship === "incoming" && incoming) ||
          (selectedRelationship === "outgoing" && outgoing) ||
          (selectedRelationship === "any" && (incoming || outgoing)) ||
          (selectedRelationship === "none" && !incoming && !outgoing)) &&
        (selectedAccessException === "all" ||
          (selectedAccessException === "has") === hasException) &&
        (selectedAvailability === "all" || access?.availability === selectedAvailability) &&
        (selectedStatus === "all" || competency.status === selectedStatus) &&
        (!zeroTransferOnly || competency.transfer?.kind === "zero-transfer")
      );
    });
  }, [
    accessExceptions,
    competencies,
    relationships,
    searchText,
    selectedAccessException,
    selectedAvailability,
    selectedDomain,
    selectedKind,
    selectedPrerequisite,
    selectedProfile,
    selectedRelationship,
    selectedStatus,
    selectedWeight,
    zeroTransferOnly,
  ]);

  useEffect(() => {
    if (
      filteredCompetencies.length > 0 &&
      !filteredCompetencies.some((competency) => competency.id === selectedCompetencyId)
    ) {
      setSelectedCompetencyId(filteredCompetencies[0]?.id);
    }
  }, [filteredCompetencies, selectedCompetencyId]);

  useEffect(() => {
    if (focusDetailAfterSelection.current && selectedCompetencyId) {
      focusDetailAfterSelection.current = false;
      detailHeadingRef.current?.focus();
    }
  }, [selectedCompetencyId]);

  useEffect(() => {
    if (!selectedProfile && selectedAvailability !== "all") {
      setSelectedAvailability("all");
    }
  }, [selectedAvailability, selectedProfile]);

  const selectedCompetency = filteredCompetencies.find(
    (competency) => competency.id === selectedCompetencyId,
  );
  const incomingRelationships = selectedCompetency
    ? relationships.filter(
        (relationship) => relationship.targetCompetencyId === selectedCompetency.id,
      )
    : [];
  const outgoingRelationships = selectedCompetency
    ? relationships.filter(
        (relationship) => relationship.sourceCompetencyId === selectedCompetency.id,
      )
    : [];
  const relatedHistories = selectedCompetency
    ? histories.filter(
        (history) =>
          history.fixedCompetencyIds.includes(selectedCompetency.id) ||
          history.selectionSlots.some((slot) =>
            slot.candidateCompetencyIds.includes(selectedCompetency.id),
          ),
      )
    : [];
  const applicableExceptions =
    selectedCompetency && selectedProfile
      ? exceptionsForCompetency(accessExceptions, selectedProfile.id, selectedCompetency.id)
      : [];
  const accessResolution =
    selectedCompetency && selectedProfile
      ? resolveProfileAccess(selectedProfile, selectedCompetency, accessExceptions)
      : undefined;

  function selectCompetency(id: string, focusDetail = false) {
    focusDetailAfterSelection.current = focusDetail;
    setSelectedCompetencyId(id);
    window.history.replaceState(null, "", `#competency-${id}`);
  }

  function handleRowKeyDown(row: CompetencyRow, event: KeyboardEvent<HTMLTableRowElement>) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectCompetency(row.id, true);
    }
  }

  if (isLoading) {
    return <div style={{ color: "#3f3422" }}>Loading Admin Skill Reference…</div>;
  }

  if (!snapshot || !activeSnapshot) {
    return (
      <AdminPanel title="Skill Reference" subtitle="Unable to render the read-only release.">
        <AdminReadOnlyNotice message={loadError ?? "Reference data is currently unavailable."} />
      </AdminPanel>
    );
  }

  const competencyColumns: AdminTableColumn<CompetencyRow>[] = [
    {
      header: "Name",
      render: (row) => (
        <a
          href={`#competency-${row.id}`}
          onClick={() => selectCompetency(row.id)}
          style={{ color: "#3d5b8f", fontWeight: 700 }}
        >
          {row.name}
        </a>
      ),
    },
    { header: "Kind", render: (row) => toLabel(row.kind) },
    { header: "Domain", render: (row) => toLabel(row.domainId) },
    { header: "Weight", render: (row) => String(row.weight) },
    { header: "Prerequisites", render: (row) => formatPrerequisites(row, names) },
    {
      header: "Status",
      render: (row) => <AdminStatusBadge>{row.status}</AdminStatusBadge>,
    },
    { header: "Summary", render: (row) => row.shortDescription },
  ];
  const relationshipColumns: AdminTableColumn<RelationshipRow>[] = [
    {
      header: "Relationship",
      render: (row) =>
        row.targetCompetencyId === selectedCompetency?.id
          ? relationshipSentence(row, "incoming", names)
          : relationshipSentence(row, "outgoing", names),
    },
    { header: "Rationale", render: (row) => row.rationale },
  ];
  const historyColumns: AdminTableColumn<HistoryRow>[] = [
    { header: "History", render: (row) => row.name },
    { header: "Context", render: (row) => row.context },
    {
      header: "Membership",
      render: (row) =>
        joinValues([
          ...row.fixedCompetencyIds.map((id) => names.get(id) ?? id),
          ...row.selectionSlots.flatMap((slot) =>
            slot.candidateCompetencyIds.map(
              (id) => `${names.get(id) ?? id} (${slot.label}, choose ${slot.chooseCount})`,
            ),
          ),
        ]),
    },
  ];
  const exceptionColumns: AdminTableColumn<AccessExceptionRow>[] = [
    { header: "Exception", render: (row) => toLabel(row.id) },
    { header: "Basis", render: (row) => toLabel(row.basis) },
    { header: "Explanation", render: (row) => row.explanation },
    { header: "Competence granted", render: (row) => String(row.grantsCompetence) },
  ];
  const domainColumns: AdminTableColumn<DomainRow>[] = [
    { header: "Domain", render: (row) => row.name },
    { header: "Description", render: (row) => row.description },
  ];
  const scriptColumns: AdminTableColumn<ScriptRow>[] = [
    { header: "Script", render: (row) => row.name },
    { header: "Families", render: (row) => joinValues(row.familyIds.map(toLabel)) },
    { header: "Description", render: (row) => row.description },
  ];

  return (
    <section style={{ display: "grid", gap: "1.25rem", maxWidth: "100%", minWidth: 0 }}>
      <AdminPageIntro
        eyebrow="Admin / Skills"
        summary="Review the integrated Pilot proposal, its authored scope, mechanics, relationships, access, histories, bindings, and provenance. This proposal is not a canonical release."
        title="Admin Skill Reference"
      />
      <SkillsWorkspaceTabs />
      <AdminReadOnlyNotice message="Read-only review surface. Publishing and editing are not available here." />

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))",
          minWidth: 0,
        }}
      >
        <AdminMetric
          label="Release view"
          value={
            <AdminSelect
              aria-label="Release view"
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setMode(event.target.value as SnapshotMode)
              }
              value={mode}
            >
              <option disabled={!snapshot.candidate} value="candidate">
                Candidate / proposal
              </option>
              <option disabled={!snapshot.canonical} value="canonical">
                Canonical
              </option>
            </AdminSelect>
          }
        />
        <AdminMetric
          label="Current status"
          value={<AdminStatusBadge tone="warning">{activeSnapshot.status}</AdminStatusBadge>}
          hint="Proposal content awaits #26 Product Owner calibration."
        />
        <AdminMetric
          label="Canonical release"
          value={snapshot.canonical ? snapshot.canonical.contentVersion : "Absent"}
          hint={
            snapshot.canonical
              ? "An actual canonical v2 release is available."
              : "No canonical v2 release exists; #26 is the sole release gate."
          }
        />
        <AdminMetric
          label="Records"
          value={String(activeSnapshot.records.competencies.length)}
          hint="Competencies and Specializations in this bounded Pilot proposal."
        />
      </div>

      <AdminPanel
        title="Release identity and provenance"
        subtitle="The package digest covers the whole proposal; the semantic digest covers structured interpretation facts."
      >
        <div style={{ display: "grid", gap: "0.45rem", lineHeight: 1.5, minWidth: 0 }}>
          <div>
            <strong>Title:</strong> {activeSnapshot.title}
          </div>
          <div>
            <strong>Content version:</strong> {activeSnapshot.contentVersion}
          </div>
          <div>
            <strong>Release ID:</strong> {activeSnapshot.id}
          </div>
          <div>
            <strong>Schema:</strong> {activeSnapshot.schemaVersion}
          </div>
          <div>
            <strong>Rules version:</strong> {activeSnapshot.rulesVersion}
          </div>
          <div>
            <strong>Package digest:</strong> {activeSnapshot.manifest.packageDigest}
          </div>
          <div>
            <strong>Semantic digest:</strong> {activeSnapshot.manifest.semanticDigest}
          </div>
          <div>
            <strong>Compatibility:</strong> {activeSnapshot.compatibility.classification} —{" "}
            {activeSnapshot.compatibility.rationale}
          </div>
          <div>
            <strong>Provenance:</strong> {joinValues(activeSnapshot.provenance)}
          </div>
          <div>
            <strong>System rules:</strong> <a href="/admin/rules-docs">Open Rules Docs</a>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        title="Search and filter"
        subtitle="Availability has meaning only after selecting a profile."
      >
        <div
          style={{
            display: "grid",
            gap: "0.65rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 10rem), 1fr))",
            minWidth: 0,
          }}
        >
          <label style={{ display: "grid", gap: "0.25rem", minWidth: 0 }}>
            <span>Search</span>
            <input
              aria-label="Search competencies"
              onChange={(event) => setSearchText(event.target.value)}
              style={{ boxSizing: "border-box", minWidth: 0, padding: "0.65rem", width: "100%" }}
              value={searchText}
            />
          </label>
          <Filter
            label="Kind"
            onChange={setSelectedKind}
            options={["all", "skill", "spoken-language", "written-tradition", "specialization"]}
            value={selectedKind}
          />
          <Filter
            label="Domain"
            onChange={setSelectedDomain}
            options={["all", ...domains.map((domain) => domain.id)]}
            value={selectedDomain}
          />
          <Filter
            label="Weight"
            onChange={setSelectedWeight}
            options={["all", "1", "2", "3"]}
            value={selectedWeight}
          />
          <Filter
            label="Prerequisites"
            onChange={setSelectedPrerequisite}
            options={["all", "has", "none"]}
            value={selectedPrerequisite}
          />
          <Filter
            label="Relationships"
            onChange={setSelectedRelationship}
            options={["all", "incoming", "outgoing", "any", "none"]}
            value={selectedRelationship}
          />
          <Filter
            label="Access exceptions"
            onChange={setSelectedAccessException}
            options={["all", "has", "none"]}
            value={selectedAccessException}
          />
          <Filter
            label="Status"
            onChange={setSelectedStatus}
            options={["all", "proposal", "canonical"]}
            value={selectedStatus}
          />
          <Filter
            label="Profile"
            labels={new Map(profiles.map((profile) => [profile.id, profile.name]))}
            onChange={setSelectedProfileId}
            options={["all", ...profiles.map((profile) => profile.id)]}
            value={selectedProfileId}
          />
          <Filter
            disabled={!selectedProfile}
            label="Availability"
            onChange={setSelectedAvailability}
            options={["all", "available", "restricted", "unavailable"]}
            value={selectedAvailability}
          />
          <label style={{ alignItems: "center", display: "flex", gap: "0.45rem", minWidth: 0 }}>
            <input
              checked={zeroTransferOnly}
              onChange={(event) => setZeroTransferOnly(event.target.checked)}
              type="checkbox"
            />
            <span>Zero-transfer only</span>
          </label>
        </div>
      </AdminPanel>

      <AdminPanel
        title="Competencies"
        subtitle="The Legacy Catalogue remains a separate compatibility surface under its explicit label."
      >
        <AdminDataTable
          columns={competencyColumns}
          emptyState="No competencies match the current search and filters. Clear or change a filter to continue."
          onRowKeyDown={handleRowKeyDown}
          onSelect={selectCompetency}
          rows={filteredCompetencies}
          selectedId={selectedCompetency?.id}
        />
      </AdminPanel>

      {selectedCompetency ? (
        <div id={`competency-${selectedCompetency.id}`} style={{ minWidth: 0 }}>
          <AdminPanel subtitle={selectedCompetency.id} title="Competency detail">
            <h2 ref={detailHeadingRef} style={{ marginTop: 0 }} tabIndex={-1}>
              {selectedCompetency.name}
            </h2>
            <div style={{ display: "grid", gap: "0.75rem", lineHeight: 1.5, minWidth: 0 }}>
              <div>
                <strong>Short label:</strong> {selectedCompetency.shortLabel}
              </div>
              <div>
                <strong>Kind / domain / weight:</strong> {toLabel(selectedCompetency.kind)} ·{" "}
                {toLabel(selectedCompetency.domainId)} · {selectedCompetency.weight}
              </div>
              <div>
                <strong>Status:</strong> {selectedCompetency.status};{" "}
                <strong>record version:</strong> {selectedCompetency.recordVersion}
              </div>
              <div>
                <strong>Concise description:</strong> {selectedCompetency.shortDescription}
              </div>
              <div>
                <strong>Full description:</strong> {selectedCompetency.description}
              </div>
              <div>
                <strong>Prerequisites:</strong> {formatPrerequisites(selectedCompetency, names)}
              </div>
              <EnvelopeList label="Core tasks" values={selectedCompetency.taskEnvelope.coreTasks} />
              <EnvelopeList label="Methods" values={selectedCompetency.taskEnvelope.methods} />
              <EnvelopeList label="Limits" values={selectedCompetency.taskEnvelope.limits} />
              <div>
                <strong>Use guidance:</strong> {selectedCompetency.taskEnvelope.useGuidance}
              </div>
              {selectedCompetency.parentCompetencyId ? (
                <div>
                  <strong>Specialization parent:</strong>{" "}
                  {names.get(selectedCompetency.parentCompetencyId) ??
                    selectedCompetency.parentCompetencyId}
                </div>
              ) : null}
              <div>
                <strong>Transfer:</strong>{" "}
                {selectedCompetency.transfer?.kind === "zero-transfer"
                  ? `Explicit zero transfer — ${selectedCompetency.transfer.rationale}`
                  : selectedCompetency.transfer?.kind === "explicit-relationships"
                    ? `Only the authored relationships ${selectedCompetency.transfer.relationshipIds.join(", ")}`
                    : "No separate Specialization transfer declaration applies."}
              </div>
              <div>
                <strong>Language and script binding:</strong>{" "}
                {selectedCompetency.writtenLanguageBinding
                  ? `${names.get(selectedCompetency.writtenLanguageBinding.spokenLanguageId) ?? toLabel(selectedCompetency.writtenLanguageBinding.spokenLanguageId)} in ${toLabel(selectedCompetency.writtenLanguageBinding.scriptId)}`
                  : "Not applicable."}
              </div>
              <div>
                <strong>Record provenance:</strong> {joinValues(selectedCompetency.provenance)}
              </div>
            </div>
          </AdminPanel>
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 20rem), 1fr))",
          minWidth: 0,
        }}
      >
        <AdminPanel
          title="Directional relationships"
          subtitle="Only authored source-to-target edges are shown; reverse edges are never inferred."
        >
          <h3>Incoming</h3>
          <AdminDataTable
            columns={relationshipColumns}
            emptyState="No incoming relationship."
            rows={incomingRelationships}
          />
          <h3>Outgoing</h3>
          <AdminDataTable
            columns={relationshipColumns}
            emptyState="No outgoing relationship."
            rows={outgoingRelationships}
          />
        </AdminPanel>
        <AdminPanel
          title="Resolved profile access"
          subtitle="Access opens an acquisition route and always grants zero competence."
        >
          {selectedProfile && selectedCompetency && accessResolution ? (
            <div style={{ display: "grid", gap: "0.7rem" }}>
              <div>
                <strong>Profile:</strong> {selectedProfile.name} ({selectedProfile.developmentStage}{" "}
                / {selectedProfile.accessBand})
              </div>
              <div>
                <strong>Availability:</strong>{" "}
                <AdminStatusBadge
                  tone={
                    accessResolution.availability === "available"
                      ? "success"
                      : accessResolution.availability === "unavailable"
                        ? "danger"
                        : "warning"
                  }
                >
                  {accessResolution.availability}
                </AdminStatusBadge>
              </div>
              <div>
                <strong>Resolved by:</strong> {accessResolution.resolvedBy}
                {accessResolution.attribution ? ` — ${toLabel(accessResolution.attribution)}` : ""}
              </div>
              <div>
                <strong>Explanation:</strong> {accessResolution.explanation}
              </div>
              <div>
                <strong>Applicable exceptions:</strong> {accessResolution.exceptionCount}.
                Exceptions are possible authored routes; this reference does not assume one has been
                accepted.
              </div>
              <AdminDataTable
                columns={exceptionColumns}
                emptyState="No access exception applies to this competency and profile."
                rows={applicableExceptions}
              />
            </div>
          ) : (
            <AdminReadOnlyNotice message="Select a profile to resolve this competency's availability and explanation." />
          )}
        </AdminPanel>
      </div>

      <AdminPanel
        title="Learning histories"
        subtitle="Fixed and selectable memberships related to the selected competency."
      >
        <AdminDataTable
          columns={historyColumns}
          emptyState="No learning history contains this competency."
          rows={relatedHistories}
        />
      </AdminPanel>
      <AdminPanel
        title="Access exceptions"
        subtitle="Authored narrow routes; every exception grants zero competence."
      >
        <AdminDataTable
          columns={exceptionColumns}
          emptyState="No access exceptions are authored for this view."
          rows={
            selectedProfile
              ? accessExceptions.filter((entry) => entry.profileId === selectedProfile.id)
              : accessExceptions
          }
        />
      </AdminPanel>
      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))",
          minWidth: 0,
        }}
      >
        <AdminPanel
          title="Domains"
          subtitle="Navigation context only; domains imply no transfer or access."
        >
          <AdminDataTable
            columns={domainColumns}
            emptyState="No domains are present."
            rows={domains}
          />
        </AdminPanel>
        <AdminPanel
          title="Scripts"
          subtitle="Authored script families used by written-tradition bindings."
        >
          <AdminDataTable
            columns={scriptColumns}
            emptyState="No scripts are present."
            rows={scripts}
          />
        </AdminPanel>
      </div>
      {loadError ? <AdminReadOnlyNotice message={loadError} /> : null}
    </section>
  );
}

function Filter<T extends string>(props: {
  disabled?: boolean;
  label: string;
  labels?: ReadonlyMap<string, string>;
  onChange: (value: T) => void;
  options: readonly T[];
  value: T;
}) {
  return (
    <label style={{ display: "grid", gap: "0.25rem", minWidth: 0 }}>
      <span>{props.label}</span>
      <AdminSelect
        aria-label={props.label}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value as T)}
        value={props.value}
      >
        {props.options.map((option) => (
          <option key={option} value={option}>
            {props.labels?.get(option) ??
              (option === "all" ? `All ${props.label.toLowerCase()}` : toLabel(option))}
          </option>
        ))}
      </AdminSelect>
    </label>
  );
}

function EnvelopeList(props: { label: string; values: readonly string[] }) {
  return (
    <div>
      <strong>{props.label}:</strong>
      <ul style={{ marginBottom: 0 }}>
        {props.values.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}
