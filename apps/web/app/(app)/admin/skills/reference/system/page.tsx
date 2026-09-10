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
          summary="The shared rules behind costs, prerequisites, relationships, Specializations, and availability in the bounded Pilot Skill system."
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
          <AdminPanel title="How related Skills help">
            <p>
              A relationship transfers 25%, 50%, 75%, or 100% of the source's acquired base
              competence, rounded down. Only the strongest incoming result counts.
            </p>
            <p>
              A relationship works in its stated direction only and does not pass through a chain of
              Skills. Domains and categories help readers find Skills; they do not make Skills help
              one another.
            </p>
          </AdminPanel>
          <AdminPanel title="Specializations">
            <p>
              A Specialization has its own ranks and requires its named parent Skill threshold.
              Meeting the prerequisite makes the Specialization available to learn; it does not
              provide a rank by itself.
            </p>
            <p>
              The first rank adds a 2-point starting cost. A Specialization benefits from another
              Skill only when its own reference lists that relationship.
            </p>
          </AdminPanel>
          <AdminPanel title="Where Skills are available">
            <p>
              A society profile resolves each Skill as available, restricted, or unavailable. A
              specific exception takes priority over the usual availability. If the answer is
              unclear, treat the Skill as restricted until it is clarified.
            </p>
            <p>
              An accepted biography, contact, institution, teacher, text, tradition, or other
              exception may make a Skill available to learn. It does not teach the Skill
              automatically.
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
