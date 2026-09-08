"use client";

import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

import { loadAdminSkillReferenceFromServer } from "@/lib/api/adminContentClient";
import type { AdminSkillReferenceResponse, AdminSkillReferenceSnapshot } from "@glantri/shared";
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
  attribution?: string;
  availability: Availability;
  explanation: string;
  resolvedBy: "competency override" | "normal route" | "safe restricted fallback";
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
      attribution: override.attributionId,
      availability: override.availability as Availability,
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
      explanation: route.description,
      resolvedBy: "normal route",
    };
  }

  return {
    availability: "restricted",
    explanation: "No authored route or override applies, so access resolves restricted.",
    resolvedBy: "safe restricted fallback",
  };
}

function costSummary(competency: Competency): string {
  const weight = competency.acquisitionWeight ?? competency.weight;

  if (competency.kind === "specialization") {
    return `First rank costs ${2 + weight} points (2 initiation + ${weight} for the rank); later ranks cost ${weight} ${weight === 1 ? "point" : "points"} each.`;
  }

  return `${competency.weight} ${competency.weight === 1 ? "point" : "points"} per directly acquired rank.`;
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
    focusDetailAfterSelection.current = focusDetail;
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
                      <span className={styles.skillSummary}>{competency.shortDescription}</span>
                      <span className={styles.skillMeta}>
                        {toLabel(competency.kind)} · {domain?.name ?? toLabel(competency.domainId)}{" "}
                        · Weight {competency.acquisitionWeight ?? competency.weight}
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
                  <div className={styles.detailEyebrow}>
                    {toLabel(selectedCompetency.kind)} · {selectedDomain?.name}
                  </div>
                  <h2 ref={detailHeadingRef} tabIndex={-1}>
                    {selectedCompetency.name}
                  </h2>
                  <p className={styles.lede}>{selectedCompetency.shortDescription}</p>
                </div>
                <AdminStatusBadge
                  tone={selectedCompetency.status === "canonical" ? "success" : "warning"}
                >
                  {selectedCompetency.status}
                </AdminStatusBadge>
              </header>
              <p className={styles.description}>{selectedCompetency.description}</p>
              <section aria-labelledby="rules-at-a-glance" className={styles.rulesSection}>
                <h3 id="rules-at-a-glance">Rules at a glance</h3>
                <dl className={styles.ruleGrid}>
                  <RuleFact label="Cost" value={costSummary(selectedCompetency)} />
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
                              {prerequisite.justification ? ` — ${prerequisite.justification}` : ""}
                            </span>
                          ))
                    }
                  />
                  <RuleFact
                    label="Domain"
                    value={
                      selectedDomain
                        ? `${selectedDomain.name} — ${selectedDomain.description}`
                        : toLabel(selectedCompetency.domainId)
                    }
                  />
                  <RuleFact
                    label="Specializations"
                    value={
                      selectedCompetency.kind === "specialization" ? (
                        <>
                          A Specialization of{" "}
                          <SkillLink
                            id={selectedCompetency.parentCompetencyId ?? ""}
                            names={names}
                            onSelect={selectCompetency}
                          />
                          . Meeting prerequisites makes acquisition available; ownership begins only
                          with the first acquired rank.
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
                        "No Specializations are authored for this Skill in the candidate."
                      )
                    }
                  />
                  <RuleFact
                    label="Transfer"
                    value={
                      selectedCompetency.transfer?.kind === "zero-transfer"
                        ? `No transfer — ${selectedCompetency.transfer.rationale}`
                        : selectedCompetency.transfer?.kind === "explicit-relationships"
                          ? "Only the explicit relationships listed below transfer competence."
                          : "Only explicit directional relationships transfer competence; no reverse or domain-wide transfer is implied."
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
              <section aria-labelledby="what-it-covers" className={styles.rulesSection}>
                <h3 id="what-it-covers">What it covers</h3>
                <p>{selectedCompetency.taskEnvelope.useGuidance}</p>
                <div className={styles.envelopeGrid}>
                  <EnvelopeList
                    label="Typical uses"
                    values={selectedCompetency.taskEnvelope.coreTasks}
                  />
                  <EnvelopeList label="Methods" values={selectedCompetency.taskEnvelope.methods} />
                  <EnvelopeList label="Limits" values={selectedCompetency.taskEnvelope.limits} />
                </div>
              </section>
              <section aria-labelledby="relationships" className={styles.rulesSection}>
                <h3 id="relationships">Relationships</h3>
                {incomingRelationships.length === 0 && outgoingRelationships.length === 0 ? (
                  <p>No Skill relationships are authored for this entry.</p>
                ) : (
                  <ul className={styles.relationshipList}>
                    {incomingRelationships.map((relationship) => (
                      <li key={relationship.id}>
                        Receives {relationship.strength}% from{" "}
                        <SkillLink
                          id={relationship.sourceCompetencyId}
                          names={names}
                          onSelect={selectCompetency}
                        />
                        . {relationship.rationale}
                      </li>
                    ))}
                    {outgoingRelationships.map((relationship) => (
                      <li key={relationship.id}>
                        Contributes {relationship.strength}% to{" "}
                        <SkillLink
                          id={relationship.targetCompetencyId}
                          names={names}
                          onSelect={selectCompetency}
                        />
                        . {relationship.rationale}
                      </li>
                    ))}
                  </ul>
                )}
                <p className={styles.ruleNote}>
                  Relationships use acquired base competence, keep only the strongest incoming
                  result, round down, and do not chain in Pilot v1.
                </p>
              </section>
              {selectedCompetency.writtenLanguageBinding ? (
                <section aria-labelledby="language-binding" className={styles.rulesSection}>
                  <h3 id="language-binding">Language and writing</h3>
                  <p>
                    This written tradition is bound to{" "}
                    <SkillLink
                      id={selectedCompetency.writtenLanguageBinding.spokenLanguageId}
                      names={names}
                      onSelect={selectCompetency}
                    />{" "}
                    in {toLabel(selectedCompetency.writtenLanguageBinding.scriptId)}. Spoken and
                    written competence remain separate.
                  </p>
                </section>
              ) : null}
            </AdminPanel>
          </article>
        ) : null}
      </div>
    </section>
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
        <span>Society profile</span>
        <AdminSelect
          aria-label="Availability profile"
          onChange={(event) => props.setSelectedProfileId(event.target.value)}
          value={props.selectedProfileId}
        >
          <option value="none">Choose a profile</option>
          {props.profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </AdminSelect>
      </label>
      {props.accessResolution ? (
        <>
          {selectedProfile ? (
            <div className={styles.ruleNote}>
              {selectedProfile.name}: development stage {selectedProfile.developmentStage}, access
              band {selectedProfile.accessBand}.
            </div>
          ) : null}
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
            {props.accessResolution.explanation}
          </div>
          <div className={styles.ruleNote}>
            Resolved by {props.accessResolution.resolvedBy}
            {props.accessResolution.attribution
              ? ` (${toLabel(props.accessResolution.attribution)})`
              : ""}
            . Access opens a learning route and grants no ranks or competence.
          </div>
          {props.accessExceptions.map((exception) => (
            <div className={styles.exception} key={exception.id}>
              <strong>Possible {toLabel(exception.basis)} exception:</strong>{" "}
              {exception.explanation} It applies only if accepted and grants no competence.
            </div>
          ))}
        </>
      ) : (
        <span className={styles.ruleNote}>
          Choose a profile to see whether this Skill is available, restricted, or unavailable.
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
          <li key={value}>{value}</li>
        ))}
      </ul>
    </div>
  );
}
