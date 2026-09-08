"use client";

import { useEffect, useState } from "react";
import { loadAdminSkillReferenceFromServer } from "@/lib/api/adminContentClient";
import type { AdminSkillReferenceSnapshot } from "@glantri/shared";
import {
  AdminDataTable,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminReadOnlyNotice,
  AdminStatusBadge,
  type AdminTableColumn,
} from "../../../admin-ui";
import SkillsWorkspaceTabs from "../../SkillsWorkspaceTabs";
import styles from "../skillReference.module.css";

type History = AdminSkillReferenceSnapshot["records"]["histories"][number];
type AccessException = AdminSkillReferenceSnapshot["records"]["accessExceptions"][number];

function join(values: readonly string[]): string {
  return values.length === 0 ? "None" : values.join(", ");
}

export function SkillReferenceAuditContent() {
  const [snapshot, setSnapshot] = useState<AdminSkillReferenceSnapshot>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    async function load() {
      try {
        const response = await loadAdminSkillReferenceFromServer();
        const loaded = response.candidate ?? response.canonical;
        if (!loaded) throw new Error("No Skill Reference release is available.");
        setSnapshot(loaded);
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Unable to load reference audit details.",
        );
      }
    }
    void load();
  }, []);

  if (error)
    return (
      <AdminPanel title="Reference Audit" subtitle="Unable to load the audit view.">
        <AdminReadOnlyNotice message={error} />
      </AdminPanel>
    );
  if (!snapshot) return <div className={styles.loading}>Loading reference audit…</div>;

  const historyColumns: AdminTableColumn<History>[] = [
    { header: "History", render: (row) => row.name },
    { header: "Context", render: (row) => row.context },
    { header: "Fixed competencies", render: (row) => join(row.fixedCompetencyIds) },
    {
      header: "Selection slots",
      render: (row) =>
        join(
          row.selectionSlots.map(
            (slot) =>
              `${slot.label}: choose ${slot.chooseCount} from ${join(slot.candidateCompetencyIds)}`,
          ),
        ),
    },
  ];
  const exceptionColumns: AdminTableColumn<AccessException>[] = [
    { header: "Exception", render: (row) => row.id },
    { header: "Profile", render: (row) => row.profileId },
    { header: "Basis", render: (row) => row.basis },
    { header: "Competencies", render: (row) => join(row.competencyIds) },
    { header: "Histories", render: (row) => join(row.historyIds) },
    { header: "Explanation", render: (row) => row.explanation },
  ];

  return (
    <section className={styles.page}>
      <AdminPageIntro
        eyebrow="Admin / Skills / Reference"
        summary="Release identity, integrity, provenance, and cross-record audit information kept outside the reader-focused Skill detail."
        title="Skill Reference Audit"
      />
      <SkillsWorkspaceTabs />
      <AdminReadOnlyNotice message="Audit-only, read-only information. This candidate is not canonical and cannot be published from this surface." />
      <nav aria-label="Reference Audit links" className={styles.guideLinks}>
        <a href="/admin/skills/reference">Browse the Skill Reference</a>
        <a href="/admin/skills/reference/system">How the Skill system works</a>
        <a href="/admin/skills/matrix">Open Matrix Audit</a>
      </nav>
      <div className={styles.envelopeGrid}>
        <AdminMetric
          label="Status"
          value={<AdminStatusBadge tone="warning">{snapshot.status}</AdminStatusBadge>}
        />
        <AdminMetric label="Competencies" value={snapshot.manifest.counts.competencies} />
        <AdminMetric label="Relationships" value={snapshot.manifest.counts.relationships} />
      </div>
      <AdminPanel
        title="Release identity and integrity"
        subtitle="Technical identifiers support comparison and audit; they are intentionally absent from ordinary Skill detail."
      >
        <dl className={styles.ruleGrid}>
          <AuditFact label="Title" value={snapshot.title} />
          <AuditFact label="Release ID" value={snapshot.id} />
          <AuditFact label="Content version" value={snapshot.contentVersion} />
          <AuditFact label="Schema version" value={snapshot.schemaVersion} />
          <AuditFact label="Rules version" value={snapshot.rulesVersion} />
          <AuditFact label="Package digest" value={snapshot.manifest.packageDigest ?? "Absent"} />
          <AuditFact label="Semantic digest" value={snapshot.manifest.semanticDigest ?? "Absent"} />
          <AuditFact label="Serialization" value={snapshot.manifest.serialization ?? "Absent"} />
          <AuditFact
            label="Compatibility"
            value={`${snapshot.compatibility.classification} — ${snapshot.compatibility.rationale}`}
          />
          <AuditFact label="Release provenance" value={join(snapshot.provenance)} />
        </dl>
      </AdminPanel>
      <AdminPanel
        title="Record provenance"
        subtitle="Version and source evidence for each candidate competency."
      >
        <div className={styles.auditCards}>
          {snapshot.records.competencies.map((competency) => (
            <details key={competency.id}>
              <summary>{competency.name}</summary>
              <div>
                <strong>ID:</strong> {competency.id}
              </div>
              <div>
                <strong>Record version:</strong> {competency.recordVersion}
              </div>
              <div>
                <strong>Status:</strong> {competency.status}
              </div>
              <div>
                <strong>Provenance:</strong> {join(competency.provenance)}
              </div>
            </details>
          ))}
        </div>
      </AdminPanel>
      <AdminPanel
        title="Learning-history index"
        subtitle="Cross-record membership belongs in audit, not the primary Skill detail."
      >
        <AdminDataTable
          columns={historyColumns}
          emptyState="No learning histories are present."
          rows={[...snapshot.records.histories]}
        />
      </AdminPanel>
      <AdminPanel
        title="Access-exception register"
        subtitle="All authored exceptions across the candidate; each grants zero competence."
      >
        <AdminDataTable
          columns={exceptionColumns}
          emptyState="No access exceptions are present."
          rows={[...snapshot.records.accessExceptions]}
        />
      </AdminPanel>
      <div className={styles.envelopeGrid}>
        <AdminPanel title="Domains">
          <ul>
            {snapshot.records.domains.map((domain) => (
              <li key={domain.id}>
                <strong>{domain.name}:</strong> {domain.description}
              </li>
            ))}
          </ul>
        </AdminPanel>
        <AdminPanel title="Scripts">
          <ul>
            {snapshot.records.scripts.map((script) => (
              <li key={script.id}>
                <strong>{script.name}:</strong> {script.description} Families:{" "}
                {join(script.familyIds)}.
              </li>
            ))}
          </ul>
        </AdminPanel>
      </div>
    </section>
  );
}

function AuditFact(props: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt>{props.label}</dt>
      <dd>{props.value}</dd>
    </div>
  );
}
