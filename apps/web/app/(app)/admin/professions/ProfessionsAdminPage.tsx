"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { useCanAccessAdmin } from "../../../../src/lib/auth/SessionUserContext";
import {
  replaceProfessionRelations,
  updateProfessionInContent
} from "../../../../src/lib/admin/editing";
import { downloadCsv } from "../../../../src/lib/admin/exporters";
import { buildProfessionAdminRows } from "../../../../src/lib/admin/viewModels";
import {
  AdminButton,
  AdminCheckboxList,
  AdminField,
  AdminInput,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminReadOnlyNotice,
  AdminTagList,
  AdminTextarea
} from "../admin-ui";
import ProfessionsWorkspaceTabs from "./ProfessionsWorkspaceTabs";

interface ProfessionFormState {
  description: string;
  groupIds: string[];
  name: string;
  ordinarySkillIds: string[];
  societyEntryIds: string[];
  secondarySkillIds: string[];
}

function createSocietyEntryId(input: { societyId: string; societyLevel: number }): string {
  return `${input.societyId}:${input.societyLevel}`;
}

function createProfessionFormState(input: {
  description?: string;
  groupIds: string[];
  name: string;
  ordinarySkillIds: string[];
  societyEntryIds: string[];
  secondarySkillIds: string[];
}): ProfessionFormState {
  return {
    description: input.description ?? "",
    groupIds: input.groupIds,
    name: input.name,
    ordinarySkillIds: input.ordinarySkillIds,
    societyEntryIds: input.societyEntryIds,
    secondarySkillIds: input.secondarySkillIds
  };
}

function summarizeList(values: string[], maxItems = 3): string {
  if (values.length === 0) {
    return "None";
  }

  if (values.length <= maxItems) {
    return values.join(", ");
  }

  return `${values.slice(0, maxItems).join(", ")} +${values.length - maxItems} more`;
}

function renderClampedCell(text: string, lines = 2) {
  return (
    <span
      style={{
        color: "#4f4635",
        display: "-webkit-box",
        lineHeight: 1.45,
        overflow: "hidden",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: lines
      }}
      title={text}
    >
      {text}
    </span>
  );
}

const professionsReviewGridTemplate =
  "minmax(12rem, 1.15fr) minmax(8rem, 0.8fr) minmax(12rem, 1.1fr) minmax(12rem, 1.1fr) minmax(15rem, 1.35fr) 6rem 5.5rem";

function ProfessionsReviewTable(props: {
  onInspect: (rowId: string) => void;
  rows: ReturnType<typeof buildProfessionAdminRows>;
  selectedId?: string;
}) {
  if (props.rows.length === 0) {
    return <div style={{ color: "#6d624d", padding: "1rem" }}>No professions found.</div>;
  }

  return (
    <div
      style={{
        border: "1px solid rgba(85, 73, 48, 0.12)",
        borderRadius: 18,
        overflowX: "auto"
      }}
    >
      <div style={{ minWidth: 1080 }}>
        <div
          style={{
            background: "rgba(126, 93, 42, 0.08)",
            borderBottom: "1px solid rgba(85, 73, 48, 0.1)",
            display: "grid",
            gridTemplateColumns: professionsReviewGridTemplate
          }}
        >
          {["Profession", "Family", "Core Groups", "Optional Groups", "Access", "Skills", "Inspect"].map(
            (header) => (
              <div
                key={header}
                style={{
                  color: "#594320",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  padding: "0.8rem",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap"
                }}
              >
                {header}
              </div>
            )
          )}
        </div>

        {props.rows.map((row) => {
          const selected = row.id === props.selectedId;

          return (
            <div
              key={row.id}
              onClick={() => props.onInspect(row.id)}
              style={{
                background: selected ? "rgba(215, 226, 216, 0.72)" : "transparent",
                borderTop: "1px solid rgba(85, 73, 48, 0.1)",
                cursor: "pointer",
                display: "grid",
                gridTemplateColumns: professionsReviewGridTemplate
              }}
            >
              <div style={{ padding: "0.9rem 0.8rem" }}>
                <div style={{ color: "#2e2619", fontWeight: 700 }}>{row.name}</div>
                <div style={{ color: "#7a6f5a", fontSize: "0.9rem", marginTop: "0.2rem" }}>
                  {row.description ? renderClampedCell(row.description, 2) : "No description"}
                </div>
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.familyName || <span style={{ color: "#8a7e63" }}>None</span>}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {renderClampedCell(summarizeList(row.coreSkillGroups, 3), 2)}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {renderClampedCell(summarizeList(row.optionalSkillGroups, 3), 2)}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {renderClampedCell(summarizeList(row.allowedSocietyEntries, 2), 2)}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>{row.totalReachableSkills}</div>
              <div style={{ padding: "0.75rem 0.8rem" }}>
                <AdminButton
                  onClick={() => props.onInspect(row.id)}
                  variant={selected ? "primary" : "secondary"}
                >
                  {selected ? "Open" : "Inspect"}
                </AdminButton>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProfessionsAdminPage() {
  const canEdit = useCanAccessAdmin();
  const { content, replaceContent } = useAdminContent();
  const rows = buildProfessionAdminRows(content);
  const [selectedProfessionId, setSelectedProfessionId] = useState<string>();
  const selectedProfession =
    content.professions.find((profession) => profession.id === selectedProfessionId) ??
    content.professions.slice().sort((left, right) => left.name.localeCompare(right.name))[0];
  const [formState, setFormState] = useState<ProfessionFormState>();
  const selectedRow = rows.find((row) => row.id === selectedProfession.id);

  useEffect(() => {
    if (!selectedProfessionId && rows[0]) {
      setSelectedProfessionId(rows[0].id);
    }
  }, [rows, selectedProfessionId]);

  useEffect(() => {
    if (!selectedProfession) {
      return;
    }

    const grants = content.professionSkills.filter(
      (professionSkill) => professionSkill.professionId === selectedProfession.id
    );
    const societyEntryIds = content.societyLevels
      .filter((societyLevel) => societyLevel.professionIds.includes(selectedProfession.id))
      .map((societyLevel) =>
        createSocietyEntryId({
          societyId: societyLevel.societyId,
          societyLevel: societyLevel.societyLevel
        })
      );

    setSelectedProfessionId(selectedProfession.id);
    setFormState(
      createProfessionFormState({
        description: selectedProfession.description,
        groupIds: grants
          .filter((grant) => grant.grantType === "group" && grant.skillGroupId)
          .map((grant) => grant.skillGroupId ?? ""),
        name: selectedProfession.name,
        ordinarySkillIds: grants
          .filter((grant) => grant.grantType === "ordinary-skill" && grant.skillId)
          .map((grant) => grant.skillId ?? ""),
        societyEntryIds,
        secondarySkillIds: grants
          .filter((grant) => grant.grantType === "secondary-skill" && grant.skillId)
          .map((grant) => grant.skillId ?? "")
      })
    );
  }, [content.professionSkills, content.societyLevels, selectedProfession]);

  if (!selectedProfession || !formState) {
    return (
      <AdminPanel title="Professions">
        <div>No professions found.</div>
      </AdminPanel>
    );
  }

  const activeForm = formState;

  function toggleRelation(key: "groupIds" | "ordinarySkillIds" | "secondarySkillIds" | "societyEntryIds", value: string) {
    setFormState((current) =>
      current
        ? {
            ...current,
            [key]: current[key].includes(value)
              ? current[key].filter((candidate) => candidate !== value)
              : [...current[key], value]
          }
        : current
    );
  }

  async function handleSave() {
    const baseContent = updateProfessionInContent(content, {
      ...selectedProfession,
      description: activeForm.description.trim() || undefined,
      name: activeForm.name.trim()
    });
    const withRelations = replaceProfessionRelations(baseContent, selectedProfession.id, {
      groupIds: activeForm.groupIds,
      ordinarySkillIds: activeForm.ordinarySkillIds,
      secondarySkillIds: activeForm.secondarySkillIds
    });
    const nextContent = {
      ...withRelations,
      societyLevels: withRelations.societyLevels.map((societyLevel) => {
        const entryId = createSocietyEntryId({
          societyId: societyLevel.societyId,
          societyLevel: societyLevel.societyLevel
        });
        const selected = activeForm.societyEntryIds.includes(entryId);
        const professionIds = selected
          ? [...new Set([...societyLevel.professionIds, selectedProfession.id])]
          : societyLevel.professionIds.filter((professionId) => professionId !== selectedProfession.id);

        return {
          ...societyLevel,
          professionIds
        };
      })
    };

    await replaceContent(nextContent, `Saved profession "${activeForm.name.trim()}".`);
  }

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        actions={
          <AdminButton
            onClick={() =>
              downloadCsv({
                columns: [
                  { header: "Name", value: (row) => row.name },
                  { header: "Description", value: (row) => row.description },
                  {
                    header: "Granted Skill Groups",
                    value: (row) => row.grantedSkillGroups.join(" | ")
                  },
                  {
                    header: "Directly Granted Skills",
                    value: (row) => row.directlyGrantedSkills.join(" | ")
                  },
                  {
                    header: "Reachable Through Groups",
                    value: (row) => row.reachableGroupSkills.join(" | ")
                  },
                  {
                    header: "Direct Skill Exceptions",
                    value: (row) => row.directSkillExceptions.join(" | ")
                  },
                  {
                    header: "Allowed Societies/Social Classes",
                    value: (row) => row.allowedSocietyEntries.join(" | ")
                  },
                  { header: "Total Reachable Skills", value: (row) => row.totalReachableSkills },
                  { header: "Notes", value: (row) => row.notes }
                ],
                filename: "glantri-professions.csv",
                rows
              })
            }
            variant="secondary"
          >
            Export CSV
          </AdminButton>
        }
        eyebrow="Admin / Professions"
        summary="Professions connect character options to both skill grants and society access. This editor lets us keep those relationships together instead of scattering them across separate raw records."
        title="Professions"
      />

      <ProfessionsWorkspaceTabs />

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 2.2fr) minmax(340px, 1fr)" }}>
        <AdminPanel title="Profession Catalog">
          <ProfessionsReviewTable
            onInspect={setSelectedProfessionId}
            rows={rows}
            selectedId={selectedProfession.id}
          />
        </AdminPanel>

        <div style={{ display: "grid", gap: "1rem" }}>
          <AdminPanel
            subtitle="This page now surfaces profession packages as explicit core versus optional group grants so reviewers can inspect the structure without hopping between raw relation records."
            title={selectedProfession.name}
          >
            <div style={{ display: "grid", gap: "0.85rem" }}>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                <AdminMetric label="Core groups" value={selectedRow?.coreSkillGroups.length ?? 0} />
                <AdminMetric label="Optional groups" value={selectedRow?.optionalSkillGroups.length ?? 0} />
                <AdminMetric label="Reachable skills" value={selectedRow?.totalReachableSkills ?? 0} />
              </div>

              <div
                style={{
                  background: "rgba(126, 93, 42, 0.07)",
                  border: "1px solid rgba(85, 73, 48, 0.12)",
                  borderRadius: 16,
                  color: "#5b5036",
                  display: "grid",
                  gap: "0.25rem",
                  padding: "0.85rem 1rem"
                }}
              >
                <div><strong>Family:</strong> {selectedRow?.familyName || "Unclassified"}</div>
                <div>
                  <strong>Direct skills:</strong>{" "}
                  {selectedRow?.directlyGrantedSkills.length
                    ? summarizeList(selectedRow.directlyGrantedSkills, 4)
                    : "None"}
                </div>
              </div>

              <div>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Core groups
                </div>
                <AdminTagList values={selectedRow?.coreSkillGroups ?? []} />
              </div>

              <div>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Optional groups
                </div>
                {selectedRow?.optionalSkillGroups.length ? (
                  <AdminTagList values={selectedRow.optionalSkillGroups} />
                ) : (
                  <div style={{ color: "#8a7e63" }}>No optional group grants are modeled for this profession.</div>
                )}
              </div>

              <div>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Allowed societies / access rows
                </div>
                <AdminTagList values={selectedRow?.allowedSocietyEntries ?? []} />
              </div>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Group to skill fan
                </div>
                {selectedRow?.groupFans.length ? (
                  selectedRow.groupFans.map((groupFan) => (
                    <div
                      key={`${groupFan.relevance}:${groupFan.groupName}`}
                      style={{
                        background: "rgba(255, 255, 255, 0.78)",
                        border: "1px solid rgba(85, 73, 48, 0.12)",
                        borderRadius: 16,
                        display: "grid",
                        gap: "0.55rem",
                        padding: "0.85rem 0.95rem"
                      }}
                    >
                      <div style={{ alignItems: "baseline", display: "flex", gap: "0.45rem", justifyContent: "space-between" }}>
                        <strong style={{ color: "#2f2618" }}>{groupFan.groupName}</strong>
                        <span style={{ color: "#7a6f5a", fontSize: "0.85rem", textTransform: "capitalize" }}>
                          {groupFan.relevance} group · {groupFan.weightedContentPoints} pts
                        </span>
                      </div>
                      <div>
                        <div style={{ color: "#5f543a", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Core skills
                        </div>
                        <AdminTagList values={groupFan.coreSkills} />
                      </div>
                      <div>
                        <div style={{ color: "#5f543a", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                          Optional skills
                        </div>
                        {groupFan.optionalSkills.length ? (
                          <AdminTagList values={groupFan.optionalSkills} />
                        ) : (
                          <div style={{ color: "#8a7e63" }}>No optional cross-listed skills.</div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ color: "#8a7e63" }}>No skill-group grants are modeled for this profession.</div>
                )}
              </div>

              <div style={{ color: "#5f543a", fontSize: "0.92rem", lineHeight: 1.5 }}>
                <Link href="/admin/skill-groups" style={{ color: "#7e5d2a", fontWeight: 700 }}>
                  Open skill groups inspector
                </Link>
                {" "}
                or{" "}
                <Link href="/admin/societies" style={{ color: "#7e5d2a", fontWeight: 700 }}>
                  open societies inspector
                </Link>
                {" "}
                for the related access context.
              </div>
            </div>
          </AdminPanel>

          <AdminPanel
            subtitle="Skill grants are edited here as relation sets. Core versus optional grant editing is intentionally deferred, but the richer inspection summary above now exposes the structure clearly."
            title={`Edit ${selectedProfession.name}`}
          >
            {canEdit ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSave();
                }}
                style={{ display: "grid", gap: "0.9rem" }}
              >
                <AdminField label="Profession id">
                  <AdminInput readOnly value={selectedProfession.id} />
                </AdminField>

                <AdminField label="Name">
                  <AdminInput
                    onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                    value={activeForm.name}
                  />
                </AdminField>

                <AdminField
                  hint="Describe the profession as a grant package and play-facing identity. This helps later society-layer review explain why the package exists."
                  label="Description"
                >
                  <AdminTextarea
                    onChange={(event) =>
                      setFormState({ ...activeForm, description: event.target.value })
                    }
                    value={activeForm.description}
                  />
                </AdminField>

                <AdminField
                  hint="These group grants are the authoritative profession package. Most profession reach should come from groups rather than one-off direct skills."
                  label="Allowed skill groups"
                >
                  <AdminCheckboxList
                    onToggle={(value) => toggleRelation("groupIds", value)}
                    options={content.skillGroups
                      .slice()
                      .sort((left, right) => left.sortOrder - right.sortOrder)
                      .map((group) => ({
                        label: group.name,
                        selected: activeForm.groupIds.includes(group.id),
                        value: group.id
                      }))}
                  />
                </AdminField>

                <AdminField
                  hint="Use direct ordinary skills as explicit exceptions or additions when a profession needs skills outside its granted groups."
                  label="Individually allowed ordinary skills"
                >
                  <AdminCheckboxList
                    onToggle={(value) => toggleRelation("ordinarySkillIds", value)}
                    options={content.skills
                      .filter((skill) => skill.category === "ordinary")
                      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
                      .map((skill) => ({
                        label: skill.name,
                        selected: activeForm.ordinarySkillIds.includes(skill.id),
                        value: skill.id
                      }))}
                  />
                </AdminField>

                <AdminField
                  hint="Use direct secondary skills sparingly when the profession should reach a secondary branch without granting the whole parent group."
                  label="Individually allowed secondary skills"
                >
                  <AdminCheckboxList
                    onToggle={(value) => toggleRelation("secondarySkillIds", value)}
                    options={content.skills
                      .filter((skill) => skill.category === "secondary")
                      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
                      .map((skill) => ({
                        label: skill.name,
                        selected: activeForm.secondarySkillIds.includes(skill.id),
                        value: skill.id
                      }))}
                  />
                </AdminField>

                <AdminField
                  hint="These rows govern where the profession package is reachable. Society rows orchestrate access to professions rather than redefining the package."
                  label="Allowed societies / social classes"
                >
                  <AdminCheckboxList
                    onToggle={(value) => toggleRelation("societyEntryIds", value)}
                    options={content.societyLevels
                      .slice()
                      .sort((left, right) => left.societyName.localeCompare(right.societyName) || left.societyLevel - right.societyLevel)
                      .map((societyLevel) => {
                        const value = createSocietyEntryId({
                          societyId: societyLevel.societyId,
                          societyLevel: societyLevel.societyLevel
                        });

                        return {
                          label: `${societyLevel.societyName} L${societyLevel.societyLevel} - ${societyLevel.socialClass}`,
                          selected: activeForm.societyEntryIds.includes(value),
                          value
                        };
                      })}
                  />
                </AdminField>

                <AdminButton type="submit">Save Profession</AdminButton>
              </form>
            ) : (
              <AdminReadOnlyNotice message="Professions are viewable here for all signed-in users, while editing stays limited to Admin and GM roles." />
            )}
          </AdminPanel>
        </div>
      </div>
    </section>
  );
}
