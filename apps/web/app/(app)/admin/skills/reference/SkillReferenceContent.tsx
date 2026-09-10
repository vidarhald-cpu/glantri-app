"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { loadAdminSkillReferenceFromServer } from "@/lib/api/adminContentClient";
import type {
  AdminSkillReferenceMetadata,
  AdminSkillReferenceResponse,
  AdminSkillReferenceSnapshot,
} from "@glantri/shared";
import {
  AdminPageIntro,
  AdminPanel,
  AdminReadOnlyNotice,
  AdminSelect,
  AdminStatusBadge,
} from "../../admin-ui";
import SkillsWorkspaceTabs from "../SkillsWorkspaceTabs";
import styles from "./skillReference.module.css";

type SnapshotMode = "candidate" | "canonical";
type Competency = AdminSkillReferenceSnapshot["records"]["competencies"][number];
type Profile = AdminSkillReferenceSnapshot["records"]["profiles"][number];
type AccessException = AdminSkillReferenceSnapshot["records"]["accessExceptions"][number];
type Availability = "available" | "restricted" | "unavailable";

interface AccessResolution {
  availability: Availability;
  explanation: string;
}

function sortByName<T extends { id: string; name: string }>(values: readonly T[]): T[] {
  return [...values].sort(
    (left, right) => left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
  );
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

function resolveProfileAccess(profile: Profile, competency: Competency): AccessResolution {
  const override = profile.overrides
    .filter((entry) => entry.competencyIds.includes(competency.id))
    .sort((left, right) => left.attributionId.localeCompare(right.attributionId))[0];

  if (override) {
    return {
      availability: override.availability as Availability,
      explanation: override.explanation,
    };
  }

  const route = profile.normalRoutes
    .filter((entry) => entry.competencyIds.includes(competency.id))
    .sort((left, right) => left.id.localeCompare(right.id))[0];

  if (route) {
    return {
      availability: "available",
      explanation: route.description,
    };
  }

  return {
    availability: "restricted",
    explanation: "No availability information is recorded for this Skill in this society.",
  };
}

function costSummary(competency: Competency): string {
  const weight = competency.acquisitionWeight ?? competency.weight;

  if (competency.kind === "specialization") {
    return `The first rank costs ${2 + weight} points (2 to begin, plus ${weight} for the rank). Each later rank costs ${weight} ${weight === 1 ? "point" : "points"}.`;
  }

  return `Each rank costs ${competency.weight} ${competency.weight === 1 ? "point" : "points"}.`;
}

function compactCostSummary(competency: Competency): string {
  const weight = competency.acquisitionWeight ?? competency.weight;
  return competency.kind === "specialization"
    ? `${2 + weight} points for the first rank`
    : `${weight} ${weight === 1 ? "point" : "points"} per rank`;
}

function readerFacingText(value: string): string {
  return value.replace(/\bauthored\b/gi, "established");
}

function readerFacingAvailabilityText(value: string): string {
  return readerFacingText(value)
    .replace(
      /;\s*it grants zero[- ]ranks? and excludes\b/gi,
      ". Access still requires learning the Skill. This exception excludes",
    )
    .replace(/\s+and grants zero[- ]ranks?\b/gi, ". Access still requires learning the Skill")
    .replace(/\s+while granting no competence\b/gi, ". Access still requires learning the Skill")
    .replace(/\bgrants? (?:zero[- ]ranks?|no competence)\b/gi, "does not itself teach the Skill")
    .replace(/\bno competence is granted\b/gi, "access still requires learning the Skill")
    .replace(/\broute implementations\b/gi, "ways to learn")
    .replace(/\broute implementation\b/gi, "way to learn")
    .replace(/\bfallback\b/gi, "alternative")
    .replace(/\broutes\b/gi, "paths to learning")
    .replace(/\broute\b/gi, "path to learning");
}

function matchesSearch(competency: Competency, query: string, domainName: string): boolean {
  return [
    competency.name,
    competency.shortLabel,
    competency.shortDescription,
    competency.description,
    toLabel(competency.kind),
    domainName,
  ]
    .join(" ")
    .toLowerCase()
    .includes(query);
}

export function SkillReferenceContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string>();
  const [mode, setMode] = useState<SnapshotMode>("candidate");
  const [response, setResponse] = useState<AdminSkillReferenceResponse>();
  const [selectedCompetencyId, setSelectedCompetencyId] = useState<string | undefined>(
    competencyIdFromHash,
  );
  const [searchText, setSearchText] = useState("");
  const [selectedKind, setSelectedKind] = useState<"all" | Competency["kind"]>("all");
  const [selectedDomainId, setSelectedDomainId] = useState("all");
  const [selectedProfileId, setSelectedProfileId] = useState("none");
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusDetailAfterSelection = useRef(false);

  useEffect(() => {
    async function load() {
      try {
        const loaded = await loadAdminSkillReferenceFromServer();
        setResponse(loaded);
        setMode(loaded.candidate ? "candidate" : "canonical");
        setLoadError(undefined);
      } catch (error) {
        setResponse(undefined);
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

  const snapshot = response?.[mode] ?? null;
  const competencies = useMemo(
    () => sortByName(snapshot?.records.competencies ?? []),
    [snapshot?.records.competencies],
  );
  const domains = useMemo(
    () => sortByName(snapshot?.records.domains ?? []),
    [snapshot?.records.domains],
  );
  const profiles = useMemo(
    () => sortByName(snapshot?.records.profiles ?? []),
    [snapshot?.records.profiles],
  );
  const names = useMemo(
    () => new Map(competencies.map((competency) => [competency.id, competency.name])),
    [competencies],
  );
  const domainById = useMemo(
    () => new Map(domains.map((domain) => [domain.id, domain])),
    [domains],
  );
  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId);
  const filteredCompetencies = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return competencies.filter(
      (competency) =>
        (query === "" ||
          matchesSearch(
            competency,
            query,
            domainById.get(competency.domainId)?.name ?? toLabel(competency.domainId),
          )) &&
        (selectedKind === "all" || competency.kind === selectedKind) &&
        (selectedDomainId === "all" || competency.domainId === selectedDomainId),
    );
  }, [competencies, domainById, searchText, selectedDomainId, selectedKind]);

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

  function selectCompetency(id: string, focusDetail = false) {
    if (!filteredCompetencies.some((competency) => competency.id === id)) {
      setSearchText("");
      setSelectedKind("all");
      setSelectedDomainId("all");
    }
    if (focusDetail && id === selectedCompetencyId) {
      detailHeadingRef.current?.focus();
    }
    focusDetailAfterSelection.current = focusDetail && id !== selectedCompetencyId;
    setSelectedCompetencyId(id);
    window.history.replaceState(null, "", `#competency-${encodeURIComponent(id)}`);
  }

  if (isLoading) return <div className={styles.loading}>Loading Admin Skill Reference…</div>;

  if (!response || !snapshot) {
    return (
      <AdminPanel title="Skill Reference" subtitle="Unable to render the read-only reference.">
        <AdminReadOnlyNotice message={loadError ?? "Reference data is currently unavailable."} />
      </AdminPanel>
    );
  }

  const selectedCompetency = filteredCompetencies.find(
    (competency) => competency.id === selectedCompetencyId,
  );
  const selectedDomain = selectedCompetency
    ? domainById.get(selectedCompetency.domainId)
    : undefined;
  const incomingRelationships = selectedCompetency
    ? snapshot.records.relationships.filter(
        (relationship) => relationship.targetCompetencyId === selectedCompetency.id,
      )
    : [];
  const outgoingRelationships = selectedCompetency
    ? snapshot.records.relationships.filter(
        (relationship) => relationship.sourceCompetencyId === selectedCompetency.id,
      )
    : [];
  const specializations = selectedCompetency
    ? competencies.filter((competency) => competency.parentCompetencyId === selectedCompetency.id)
    : [];
  const accessResolution =
    selectedCompetency && selectedProfile
      ? resolveProfileAccess(selectedProfile, selectedCompetency)
      : undefined;
  const applicableExceptions =
    selectedCompetency && selectedProfile
      ? snapshot.records.accessExceptions.filter(
          (entry) =>
            entry.profileId === selectedProfile.id &&
            entry.competencyIds.includes(selectedCompetency.id),
        )
      : [];

  return (
    <section className={styles.page}>
      <AdminPageIntro
        eyebrow="Admin / Skills / Reference"
        summary="Read the bounded Pilot Skill candidate in game terms. Nothing on this page publishes the proposal or makes it canonical."
        title="Skill Reference"
      />
      <SkillsWorkspaceTabs />
      <div className={styles.candidateBanner}>
        <div>
          <strong>Candidate for review</strong>
          <p>
            This proposal awaits Product Owner calibration in #26. It is read-only and is not the
            live Skill catalogue.
          </p>
        </div>
        <AdminStatusBadge tone="warning">proposal</AdminStatusBadge>
      </div>
      <nav aria-label="Skill Reference guides" className={styles.guideLinks}>
        <a href="/admin/skills/reference/system">How the Skill system works</a>
        <a href="/admin/skills/reference/audit">Technical and audit details</a>
        <a href="/admin/skills/matrix">Open Matrix Audit</a>
      </nav>
      <AdminPanel
        title="Find a Skill"
        subtitle="Search by name or purpose, then narrow the bounded candidate by type or domain."
      >
        <div className={styles.filters}>
          <label>
            <span>Search</span>
            <input
              aria-label="Search Skills"
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Name, purpose, or domain"
              value={searchText}
            />
          </label>
          <Filter
            label="Type"
            onChange={setSelectedKind}
            options={["all", "skill", "spoken-language", "written-tradition", "specialization"]}
            value={selectedKind}
          />
          <Filter
            label="Domain"
            labels={new Map(domains.map((domain) => [domain.id, domain.name]))}
            onChange={setSelectedDomainId}
            options={["all", ...domains.map((domain) => domain.id)]}
            value={selectedDomainId}
          />
          <label>
            <span>Release view</span>
            <AdminSelect
              aria-label="Release view"
              onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                setMode(event.target.value as SnapshotMode)
              }
              value={mode}
            >
              <option disabled={!response.candidate} value="candidate">
                Candidate / proposal
              </option>
              <option disabled={!response.canonical} value="canonical">
                Canonical
              </option>
            </AdminSelect>
          </label>
        </div>
      </AdminPanel>
      <div className={styles.referenceLayout}>
        <AdminPanel
          title={`Skills (${filteredCompetencies.length})`}
          subtitle="Each entry leads directly to its reader-focused reference."
        >
          {filteredCompetencies.length === 0 ? (
            <p>No Skills match the current search and filters. Clear or change a filter.</p>
          ) : (
            <ul aria-label="Skills" className={styles.skillList}>
              {filteredCompetencies.map((competency) => {
                const domain = domainById.get(competency.domainId);
                const selected = competency.id === selectedCompetency?.id;
                return (
                  <li className={selected ? styles.selectedSkill : undefined} key={competency.id}>
                    <a
                      aria-current={selected ? "location" : undefined}
                      href={`#competency-${encodeURIComponent(competency.id)}`}
                      onClick={(event) => {
                        event.preventDefault();
                        selectCompetency(competency.id, true);
                      }}
                    >
                      <span className={styles.skillName}>{competency.name}</span>
                      <span className={styles.skillSummary}>
                        {readerFacingText(competency.shortDescription)}
                      </span>
                      <span className={styles.skillMeta}>
                        {toLabel(competency.kind)} · {domain?.name ?? toLabel(competency.domainId)}{" "}
                        · {compactCostSummary(competency)}
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </AdminPanel>
        {selectedCompetency ? (
          <article className={styles.detail} id={`competency-${selectedCompetency.id}`}>
            <AdminPanel>
              <header className={styles.detailHeader}>
                <div>
                  <h2 ref={detailHeadingRef} tabIndex={-1}>
                    {selectedCompetency.name}
                  </h2>
                  <p className={styles.lede}>
                    {readerFacingText(selectedCompetency.shortDescription)}
                  </p>
                </div>
              </header>
              <p className={styles.description}>
                {readerFacingText(selectedCompetency.description)}
              </p>
              <section aria-labelledby="rules-at-a-glance" className={styles.rulesSection}>
                <h3 id="rules-at-a-glance">Rules at a glance</h3>
                <dl className={styles.ruleGrid}>
                  <RuleFact label="Cost" value={costSummary(selectedCompetency)} />
                  <RuleFact
                    label="Domain"
                    value={
                      selectedDomain ? (
                        <a
                          href={`/admin/skills/reference/audit#domain-${encodeURIComponent(selectedDomain.id)}`}
                        >
                          {selectedDomain.name}
                        </a>
                      ) : (
                        "Not recorded."
                      )
                    }
                  />
                  <RuleFact
                    label="Prerequisites"
                    value={
                      selectedCompetency.prerequisites.length === 0
                        ? "None."
                        : selectedCompetency.prerequisites.map((prerequisite) => (
                            <span className={styles.stackedValue} key={prerequisite.competencyId}>
                              <SkillLink
                                id={prerequisite.competencyId}
                                names={names}
                                onSelect={selectCompetency}
                              />{" "}
                              {prerequisite.threshold}+
                            </span>
                          ))
                    }
                  />
                  <RuleFact
                    label="Specializations"
                    value={
                      selectedCompetency.kind === "specialization" ? (
                        <>
                          Parent:{" "}
                          <SkillLink
                            id={selectedCompetency.parentCompetencyId ?? ""}
                            names={names}
                            onSelect={selectCompetency}
                          />
                          .
                        </>
                      ) : specializations.length > 0 ? (
                        specializations.map((specialization) => (
                          <span className={styles.stackedValue} key={specialization.id}>
                            <SkillLink
                              id={specialization.id}
                              names={names}
                              onSelect={selectCompetency}
                            />
                          </span>
                        ))
                      ) : (
                        "None."
                      )
                    }
                  />
                  <RuleFact
                    label="Availability"
                    value={
                      <AccessSummary
                        accessExceptions={applicableExceptions}
                        accessResolution={accessResolution}
                        profiles={profiles}
                        selectedProfileId={selectedProfileId}
                        setSelectedProfileId={setSelectedProfileId}
                      />
                    }
                  />
                </dl>
              </section>
              <section aria-labelledby="typical-uses" className={styles.rulesSection}>
                <h3 id="typical-uses">Typical uses and boundaries</h3>
                <div className={styles.readerGrid}>
                  <EnvelopeList
                    label="Typical uses"
                    values={selectedCompetency.taskEnvelope.coreTasks}
                  />
                  <EnvelopeList
                    label="Boundaries"
                    values={selectedCompetency.taskEnvelope.limits}
                  />
                </div>
              </section>
              <section aria-labelledby="relationships" className={styles.rulesSection}>
                <h3 id="relationships">Relationships</h3>
                {incomingRelationships.length === 0 &&
                outgoingRelationships.length === 0 &&
                !selectedCompetency.writtenLanguageBinding ? (
                  <p>None.</p>
                ) : (
                  <ul className={styles.relationshipList}>
                    {incomingRelationships.map((relationship) => (
                      <li key={relationship.id}>
                        Receives {relationship.strength}% of acquired base competence from{" "}
                        <SkillLink
                          id={relationship.sourceCompetencyId}
                          names={names}
                          onSelect={selectCompetency}
                        />
                        .
                      </li>
                    ))}
                    {outgoingRelationships.map((relationship) => (
                      <li key={relationship.id}>
                        Contributes {relationship.strength}% of acquired base competence to{" "}
                        <SkillLink
                          id={relationship.targetCompetencyId}
                          names={names}
                          onSelect={selectCompetency}
                        />
                        .
                      </li>
                    ))}
                    {selectedCompetency.writtenLanguageBinding ? (
                      <li>
                        Written form of{" "}
                        <SkillReference
                          id={selectedCompetency.writtenLanguageBinding.spokenLanguageId}
                          names={names}
                          onSelect={selectCompetency}
                        />
                        , using {toLabel(selectedCompetency.writtenLanguageBinding.scriptId)}.
                        Spoken and written competence remain separate.
                      </li>
                    ) : null}
                  </ul>
                )}
              </section>
            </AdminPanel>
            {snapshot.referenceMetadata ? (
              <ReferenceMetadataPanel
                key={`${mode}:${selectedCompetency.id}`}
                metadata={snapshot.referenceMetadata}
                selectedSkillId={selectedCompetency.id}
                selectedSkillName={selectedCompetency.name}
              />
            ) : null}
          </article>
        ) : null}
      </div>
    </section>
  );
}

function ReferenceMetadataPanel(props: {
  metadata: AdminSkillReferenceMetadata;
  selectedSkillId: string;
  selectedSkillName: string;
}) {
  const { metadata, selectedSkillId, selectedSkillName } = props;
  // The integrated foundation also projects Domains as proposal Arch Skills.
  // Only canonical or explicitly decision-backed mappings are authored authority.
  const memberships = metadata.archSkills.filter(
    (entry) =>
      (entry.metadata.status === "canonical" || entry.metadata.provenance.kind === "decision") &&
      entry.skillMemberships.some(({ skillId }) => skillId === selectedSkillId),
  );
  const groupMemberships = metadata.learningGroups.filter((group) =>
    group.skillMemberships.some(({ skillId }) => skillId === selectedSkillId),
  );
  const manifestations = metadata.manifestations.filter(
    ({ skillId }) => skillId === selectedSkillId,
  );
  const historicalAvailability = metadata.historicalAvailability.filter(
    ({ skillId }) => skillId === selectedSkillId,
  );
  const skillSocietyFloors = metadata.skillSocietyFloors.filter(
    ({ skillId }) => skillId === selectedSkillId,
  );
  const societyApplicability = metadata.societyApplicability.filter(
    ({ skillId }) => skillId === selectedSkillId,
  );
  const histories = metadata.learningHistories.filter(({ skillIds }) =>
    skillIds.includes(selectedSkillId),
  );
  const professions = metadata.professionReferences.flatMap((profession) => {
    const direct = profession.suggestedSkillIds.includes(selectedSkillId);
    const associatedHistories = histories.filter(({ historyId }) =>
      profession.learningHistoryIds.includes(historyId),
    );
    return direct || associatedHistories.length > 0
      ? [{ ...profession, direct, associatedHistories }]
      : [];
  });
  const societyNames = new Map(metadata.archSocieties.map(({ id, name }) => [id, name]));
  const societyName = (id: string) => societyNames.get(id) ?? "Arch Society name not recorded";
  const matrix = metadata.societyLevelBandMatrix;
  // Use the supplied axes, but summarize only this Skill's exact historical facts.
  // The server matrix aggregates all Skills and cannot describe a selected Skill.
  const cells = matrix.societyLevels.flatMap((level) =>
    matrix.socialBands.map((band) => {
      const records = historicalAvailability.filter(
        (record) => record.societyLevel === level.level && record.socialBand === band.id,
      );
      const statuses = new Set(records.map(({ status }) => status));
      return {
        societyLevel: level.level,
        socialBand: band.id,
        status:
          records.length === 0 || statuses.has("unresolved") || statuses.has("review-required")
            ? "unresolved"
            : statuses.size > 1
              ? "context-dependent"
              : "recorded",
      };
    }),
  );
  const allUnresolved = cells.length > 0 && cells.every(({ status }) => status === "unresolved");

  return (
    <section aria-labelledby="learning-historical-context" className={styles.metadataPanels}>
      <header>
        <h3 id="learning-historical-context">Learning &amp; historical context</h3>
        <p>
          Reference context for {selectedSkillName}. These records do not grant competence or decide
          Character access.
        </p>
      </header>
      <div className={styles.selectedReferenceFacts}>
        <ReferenceFactList
          label="Arch Skills"
          empty="Not yet authored."
          values={memberships.map(({ name }) => name)}
        />
        <ReferenceFactList
          label="Learning Groups"
          empty="No Learning Group placement is recorded for this Skill."
          values={groupMemberships.map(({ name }) => name)}
        />
        <ReferenceFactList
          label="Learning Histories"
          empty="No Learning History is recorded for this Skill."
          values={histories.map((history) => `${history.name} — ${history.context}`)}
        />
        <div className={styles.referenceFactList}>
          <h4>Profession references</h4>
          <p>Suggestions and associations are reference facts, not access rules.</p>
          {professions.length === 0 ? (
            <p>No profession reference is recorded for this Skill.</p>
          ) : (
            <ul>
              {professions.map((profession) => (
                <li key={profession.id}>
                  <strong>{profession.name}</strong>
                  {profession.direct ? <div>Direct Skill suggestion.</div> : null}
                  {profession.associatedHistories.length > 0 ? (
                    <div>
                      Associated through Learning History:{" "}
                      {profession.associatedHistories.map(({ name }) => name).join(", ")}.
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <ReferenceFactList
          label="Skill and Arch Society manifestations"
          empty="No exact Skill and Arch Society manifestation is recorded for this Skill."
          values={manifestations.map(
            ({ archSocietyId, status, explanation }) =>
              `${societyName(archSocietyId)} (${toLabel(status)})${explanation ? ` — ${explanation}` : ""}`,
          )}
        />
        <ReferenceFactList
          label="Structural Society-Level floor"
          empty="No structural Society-Level floor is recorded for this Skill."
          values={skillSocietyFloors.map(
            ({ societyLevel, status, explanation }) =>
              `${societyLevel ? `Society Level ${societyLevel}` : "Society Level unresolved"} (${toLabel(status)}) — ${explanation}`,
          )}
        />
        <ReferenceFactList
          label="Skill and Arch Society applicability"
          empty="No Skill and Arch Society applicability record is supplied for this Skill."
          values={societyApplicability.map(
            ({ archSocietyId, status, explanation }) =>
              `${societyName(archSocietyId)} (${toLabel(status)}) — ${explanation}`,
          )}
        />
      </div>
      <section aria-labelledby="historical-availability">
        <h4 id="historical-availability">Historical availability for {selectedSkillName}</h4>
        <p>
          Society Level × Social Band is historical reference, separate from normal acquisition and
          the Society selector above.
        </p>
        {allUnresolved ? (
          <p>
            All {cells.length} cells are unresolved for {selectedSkillName}.
          </p>
        ) : null}
        <ReferenceFactList
          label="Historical notes"
          empty="No historical availability note is recorded for this Skill."
          values={historicalAvailability.map(
            ({ archSocietyId, socialBand, societyLevel, status, explanation }) =>
              `${societyName(archSocietyId)} · Society Level ${societyLevel} · Social Band ${socialBand} (${toLabel(status)}) — ${explanation}`,
          )}
        />
        {cells.length === 0 ? (
          <p>No historical matrix axes are supplied.</p>
        ) : (
          <details className={styles.matrixDisclosure} open={allUnresolved ? undefined : true}>
            <summary>
              Inspect full historical matrix for {selectedSkillName} ({matrix.societyLevels.length}{" "}
              × {matrix.socialBands.length})
            </summary>
            <p id="matrix-scroll-hint" className={styles.matrixHint}>
              Scroll horizontally to inspect all Social Bands. Keyboard: focus the table area and
              use the left and right arrow keys.
            </p>
            <div
              className={styles.matrixScroller}
              role="region"
              aria-label={`Historical matrix for ${selectedSkillName}`}
              aria-describedby="matrix-scroll-hint"
              tabIndex={0}
            >
              <table
                aria-label={`Society Level and Social Band historical availability for ${selectedSkillName}`}
              >
                <thead>
                  <tr>
                    <th scope="col">Society Level</th>
                    {matrix.socialBands.map((band) => (
                      <th key={band.id} scope="col">
                        {band.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.societyLevels.map((level) => (
                    <tr key={level.level}>
                      <th scope="row">{level.label}</th>
                      {matrix.socialBands.map((band) => {
                        const cell = cells.find(
                          (entry) =>
                            entry.societyLevel === level.level && entry.socialBand === band.id,
                        )!;
                        return (
                          <td key={band.id}>
                            <span
                              className={
                                cell.status === "recorded"
                                  ? styles.matrixRecorded
                                  : cell.status === "context-dependent"
                                    ? styles.matrixContextDependent
                                    : styles.matrixUnresolved
                              }
                            >
                              {toLabel(cell.status)}
                            </span>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>
    </section>
  );
}

function ReferenceFactList(props: { empty: string; label: string; values: readonly string[] }) {
  return (
    <div className={styles.referenceFactList}>
      <h4>{props.label}</h4>
      {props.values.length === 0 ? (
        <p>{props.empty}</p>
      ) : (
        <ul>
          {props.values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Filter<T extends string>(props: {
  label: string;
  labels?: ReadonlyMap<string, string>;
  onChange: (value: T) => void;
  options: readonly T[];
  value: T;
}) {
  return (
    <label>
      <span>{props.label}</span>
      <AdminSelect
        aria-label={props.label}
        onChange={(event) => props.onChange(event.target.value as T)}
        value={props.value}
      >
        {props.options.map((option) => (
          <option key={option} value={option}>
            {props.labels?.get(option) ??
              (option === "all" ? `All ${props.label.toLowerCase()}s` : toLabel(option))}
          </option>
        ))}
      </AdminSelect>
    </label>
  );
}

function RuleFact(props: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  );
}

function SkillLink(props: {
  id: string;
  names: ReadonlyMap<string, string>;
  onSelect: (id: string, focusDetail?: boolean) => void;
}) {
  return (
    <a
      href={`#competency-${encodeURIComponent(props.id)}`}
      onClick={(event) => {
        event.preventDefault();
        props.onSelect(props.id, true);
      }}
    >
      {props.names.get(props.id) ?? toLabel(props.id)}
    </a>
  );
}

function SkillReference(props: {
  id: string;
  names: ReadonlyMap<string, string>;
  onSelect: (id: string, focusDetail?: boolean) => void;
}) {
  return props.names.has(props.id) ? (
    <SkillLink {...props} />
  ) : (
    <>{toLabel(props.id)} (not included)</>
  );
}

function AccessSummary(props: {
  accessExceptions: readonly AccessException[];
  accessResolution?: AccessResolution;
  profiles: readonly Profile[];
  selectedProfileId: string;
  setSelectedProfileId: (id: string) => void;
}) {
  const selectedProfile = props.profiles.find((profile) => profile.id === props.selectedProfileId);

  return (
    <div className={styles.accessSummary}>
      <label>
        <span>Society</span>
        <AdminSelect
          aria-label="Availability society"
          onChange={(event) => props.setSelectedProfileId(event.target.value)}
          value={props.selectedProfileId}
        >
          <option value="none">Choose a society</option>
          {props.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </AdminSelect>
      </label>
      {props.accessResolution ? (
        <>
          <div>
            <AdminStatusBadge
              tone={
                props.accessResolution.availability === "available"
                  ? "success"
                  : props.accessResolution.availability === "unavailable"
                    ? "danger"
                    : "warning"
              }
            >
              {props.accessResolution.availability}
            </AdminStatusBadge>{" "}
            {selectedProfile ? <span>for {selectedProfile.name}.</span> : null}{" "}
            {props.accessResolution.availability === "available" ? null : (
              <span>{readerFacingAvailabilityText(props.accessResolution.explanation)}</span>
            )}
          </div>
          {props.accessExceptions.map((exception) => (
            <div className={styles.exception} key={exception.id}>
              <strong>{toLabel(exception.basis)} exception:</strong>{" "}
              {readerFacingAvailabilityText(exception.explanation)} Subject to approval.
            </div>
          ))}
        </>
      ) : (
        <span className={styles.ruleNote}>
          Choose a society to see whether this Skill is available, restricted, or unavailable.
        </span>
      )}
    </div>
  );
}

function EnvelopeList(props: { label: string; values: readonly string[] }) {
  return (
    <div>
      <h4>{props.label}</h4>
      <ul>
        {props.values.map((value) => (
          <li key={value}>{readerFacingText(value)}</li>
        ))}
      </ul>
    </div>
  );
}
