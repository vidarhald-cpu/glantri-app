"use client";

import { useEffect, useState } from "react";
import { loadAdminSkillReferenceFromServer } from "@/lib/api/adminContentClient";
import type { CompetencyV2ReferenceSource } from "@glantri/content";
import { AdminMetric, AdminPageIntro, AdminPanel, AdminReadOnlyNotice } from "../../../admin-ui";

export function SkillReferenceAuditContent() {
  const [source, setSource] = useState<CompetencyV2ReferenceSource>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let active = true;
    loadAdminSkillReferenceFromServer()
      .then((value) => {
        if (active) setSource(value);
      })
      .catch((cause) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "The reference audit is unavailable.");
      });
    return () => {
      active = false;
    };
  }, []);
  if (error) return <AdminReadOnlyNotice message={error} />;
  if (!source) return <p role="status">Loading reference audit…</p>;
  return (
    <section>
      <AdminPageIntro
        eyebrow="Admin / Skills / Reference"
        title="Competency reference provenance"
        summary="The canonical V2 catalogue and the approved relationship metadata used by this read-only reference."
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem" }}>
        <AdminMetric label="Skills" value={source.skills.length} />
        <AdminMetric label="Specializations" value={source.specializations.length} />
        <AdminMetric label="Learning Groups" value={source.groups.length} />
        <AdminMetric label="Profession paths" value={source.paths.length} />
        <AdminMetric label="Profession families" value={source.families.length} />
      </div>
      <AdminPanel title="Source identity">
        <p>
          Canonical Competency V2 source digest: <code>{source.sourceDigest}</code>
        </p>
        <p>
          Relationships: {source.relationships.grants.length} derived grants and{" "}
          {source.relationships.meleeSources.length} melee source records. Their endpoints are
          projected onto canonical V2 identities for reference presentation.
        </p>
      </AdminPanel>
    </section>
  );
}
