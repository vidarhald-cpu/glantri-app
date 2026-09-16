"use client";

import { useEffect, useRef, useState } from "react";
import type { AdminSkillReferenceResponse } from "@glantri/shared";
import { loadAdminSkillReferenceFromServer } from "@/lib/api/adminContentClient";
import { AdminPageIntro, AdminPanel, AdminReadOnlyNotice } from "../../../admin-ui";
import SkillsWorkspaceTabs from "../../SkillsWorkspaceTabs";
import styles from "../skillReference.module.css";

function groupFromHash() {
  return typeof window !== "undefined" && /^#group-[GF]\d{2}$/.test(window.location.hash)
    ? window.location.hash.slice(7)
    : "";
}

export function LearningGroupReferenceContent() {
  const [response, setResponse] = useState<AdminSkillReferenceResponse | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    loadAdminSkillReferenceFromServer()
      .then((value) => {
        if (active) setResponse(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);
  if (failed || (response && !response.targetLearningGroups))
    return <AdminReadOnlyNotice message="Learning Group Reference is currently unavailable." />;
  if (!response) return <p>Loading Learning Group Reference…</p>;
  return <LearningGroupBrowser response={response} />;
}

function LearningGroupBrowser({ response }: { response: AdminSkillReferenceResponse }) {
  const catalogue = response.targetLearningGroups!;
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(groupFromHash);
  const heading = useRef<HTMLHeadingElement>(null);
  const focusNext = useRef(false);
  const names = new Map(response.fullCatalogue?.entries.map((entry) => [entry.id, entry.name]));
  const filtered = catalogue.groups.filter((group) =>
    [group.id, group.name, group.shortDescription, ...group.members.map((member) => member.name)]
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  const selected = filtered.find((group) => group.id === selectedId) ?? filtered[0];
  useEffect(() => {
    const restore = () => {
      setSearch("");
      setSelectedId(groupFromHash());
    };
    window.addEventListener("hashchange", restore);
    return () => window.removeEventListener("hashchange", restore);
  }, []);
  useEffect(() => {
    if (focusNext.current) {
      focusNext.current = false;
      heading.current?.focus();
    }
  }, [selected?.id]);
  function select(id: string) {
    focusNext.current = true;
    setSelectedId(id);
    window.history.replaceState(null, "", `#group-${id}`);
  }
  return (
    <section className={styles.page}>
      <AdminPageIntro
        eyebrow="Admin / Skills / Learning Groups"
        title="Learning Group Reference"
        summary="Explore the practices through which these Skills and Specializations are taught together."
      />
      <SkillsWorkspaceTabs />
      <p>
        Approved reference catalogue · {catalogue.manifest.groups} groups. Membership grants no
        competence and does not activate character creation or change costs. Specializations retain
        their immediate-parent eligibility requirements.
      </p>
      <AdminPanel title="Find a Learning Group">
        <div className={styles.filters}>
          <label>
            <span>Search groups or members</span>
            <input
              aria-label="Search groups or members"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <label>
            <span>Learning Group ({filtered.length})</span>
            <select
              aria-label="Learning Group"
              value={selected?.id ?? ""}
              onChange={(event) => select(event.target.value)}
              disabled={!filtered.length}
            >
              {!filtered.length ? (
                <option value="">No matching groups</option>
              ) : (
                filtered.map((group) => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))
              )}
            </select>
          </label>
        </div>
        {!filtered.length ? <p>No Learning Groups match. Clear or change the search.</p> : null}
      </AdminPanel>
      {selected ? (
        <article className={styles.detail} id={`group-${selected.id}`}>
          <AdminPanel>
            <header className={styles.detailHeader}>
              <div>
                <h2 ref={heading} tabIndex={-1}>
                  {selected.name}
                </h2>
                <p className={styles.lede}>{selected.shortDescription}</p>
              </div>
            </header>
            <div className={styles.description}>
              {selected.description.split(/\n\n+/).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
            {selected.equipment ? (
              <p>
                <strong>Equipment and taught practice. </strong>
                {selected.equipment}
              </p>
            ) : null}
            <section className={styles.rulesSection} aria-labelledby="group-members">
              <h3 id="group-members">Members and taught practice</h3>
              <ul className={styles.groupMembers}>
                {selected.members.map((member) => (
                  <li key={member.competencyId}>
                    <a
                      href={`/admin/skills/reference#competency-${encodeURIComponent(member.competencyId)}`}
                    >
                      {member.name}
                    </a>
                    <p>
                      {member.kind === "base-skill" ? "Base Skill" : "Specialization"}
                      {member.parentId ? (
                        <>
                          {" "}
                          · Parent:{" "}
                          <a
                            href={`/admin/skills/reference#competency-${encodeURIComponent(member.parentId)}`}
                          >
                            {names.get(member.parentId) ?? member.parentId}
                          </a>
                        </>
                      ) : null}
                    </p>
                    <p>{member.practice}</p>
                  </li>
                ))}
              </ul>
            </section>
            <section className={styles.rulesSection}>
              <h3>Exclusions and boundaries</h3>
              <ul>
                {selected.boundaries.map((boundary) => (
                  <li key={boundary}>{boundary}</li>
                ))}
              </ul>
            </section>
            <details className={styles.provenanceDisclosure}>
              <summary>Source provenance and membership history</summary>
              <p>{selected.provenance.annotation}</p>
              <p>
                Group {selected.id}. The supplied proposal wording is preserved; approval is
                recorded in issue #104. This reference does not activate acquisition.
              </p>
              <p>
                {selected.provenance.sourcePath}, lines {selected.provenance.startLine}–
                {selected.provenance.endLine}
              </p>
              <p>SHA-256: {selected.provenance.sourceSha256}</p>
              <ul>
                {selected.members.map((member) => (
                  <li key={member.competencyId}>
                    {member.name}: {member.sourceStatus} ({member.competencyId})
                  </li>
                ))}
              </ul>
            </details>
          </AdminPanel>
        </article>
      ) : null}
      <details className={styles.catalogueDisclosure}>
        <summary>
          Deliberately groupless base Skills ({catalogue.grouplessBaseSkillIds.length})
        </summary>
        <div className={styles.catalogueDisclosureBody}>
          <p>
            These remain valid Skills. They have no membership in this catalogue; no group is
            inferred or created for them.
          </p>
          <ul>
            {catalogue.grouplessBaseSkillIds.map((id) => (
              <li key={id}>
                <a href={`/admin/skills/reference#competency-${encodeURIComponent(id)}`}>
                  {names.get(id) ?? id}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </details>
      <details className={styles.catalogueDisclosure}>
        <summary>
          Historical Pilot snapshot ({catalogue.manifest.pilotGroups} groups;{" "}
          {catalogue.manifest.pilotLinks} links)
        </summary>
        <div className={styles.catalogueDisclosureBody}>
          <p>
            Original names and identities are preserved as provenance. These links do not define
            target memberships or acquisition choices. Obsolete Pilot weapon identities are not
            mapped to new weapon families.
          </p>
          {catalogue.pilotLearningGroups.map((group) => (
            <section key={group.id}>
              <h3>
                {group.id} — {group.name}
              </h3>
              <ul>
                {group.skillIds.map((id, index) => (
                  <li key={id}>
                    {group.skillNames[index]} ({id})
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </details>
    </section>
  );
}
