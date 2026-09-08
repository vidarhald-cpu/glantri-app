"use client";

import { RequireRole } from "@/lib/auth/RouteAccessGate";
import { AdminPageIntro, AdminPanel, AdminReadOnlyNotice } from "../../../admin-ui";
import SkillsWorkspaceTabs from "../../SkillsWorkspaceTabs";
import styles from "../skillReference.module.css";

export default function SkillSystemReferencePage() {
  return (
    <RequireRole
      allowedRoles={["admin"]}
      message="The Skill System reference is limited to Admin accounts."
      title="Admin access required"
    >
      <section className={styles.page}>
        <AdminPageIntro
          eyebrow="Admin / Skills / Reference"
          summary="The shared rules behind costs, prerequisites, relationships, Specializations, and access in the bounded Pilot Skill system."
          title="How the Skill System Works"
        />
        <SkillsWorkspaceTabs />
        <AdminReadOnlyNotice message="This explains the current Pilot v1 rules. The candidate Skill wording remains a proposal until Product Owner calibration in #26." />
        <nav aria-label="Skill System links" className={styles.guideLinks}>
          <a href="/admin/skills/reference">Browse the Skill Reference</a>
          <a href="/admin/skills/reference/audit">Technical and audit details</a>
        </nav>
        <div className={styles.envelopeGrid}>
          <AdminPanel title="Ranks and cost">
            <p>
              A Skill's weight is its point cost per directly acquired rank. Weight affects price,
              not the highest competence a character can reach.
            </p>
            <p>
              Learning histories contribute group competence separately. The strongest selected
              history contribution counts; weaker overlapping histories remain visible but do not
              stack.
            </p>
          </AdminPanel>
          <AdminPanel title="Relationships">
            <p>
              A relationship transfers 25%, 50%, 75%, or 100% of the source's acquired base
              competence, rounded down. Only the strongest incoming result counts.
            </p>
            <p>
              Relationships are directional, never inferred in reverse, and do not chain in Pilot
              v1. Domains and categories are for finding Skills and imply no transfer.
            </p>
          </AdminPanel>
          <AdminPanel title="Specializations">
            <p>
              A Specialization has its own ranks and requires its named parent Skill threshold.
              Meeting the prerequisite makes acquisition possible; it does not grant ownership.
            </p>
            <p>
              The first rank adds a 2-point initiation cost. A Specialization transfers competence
              only through an explicit relationship; a genuine zero-transfer declaration is valid.
            </p>
          </AdminPanel>
          <AdminPanel title="Availability and access">
            <p>
              A society profile resolves each Skill as available, restricted, or unavailable.
              Specific overrides take priority over normal routes; missing or ambiguous authoring
              resolves safely to restricted.
            </p>
            <p>
              An accepted biography, contact, institution, teacher, text, tradition, or other
              authored exception may open a route. Access and exceptions always grant zero ranks and
              zero competence.
            </p>
          </AdminPanel>
          <AdminPanel title="Languages and writing">
            <p>
              Spoken languages and written traditions are separate competencies. Knowing a spoken
              language does not grant writing, and a written tradition is tied to its named language
              and script.
            </p>
          </AdminPanel>
          <AdminPanel title="Candidate boundary">
            <p>
              The reference contains only the bounded Pilot candidate. It does not expand the full
              catalogue, activate content in Chargen, change mechanics, or publish a canonical
              release.
            </p>
          </AdminPanel>
        </div>
      </section>
    </RequireRole>
  );
}
