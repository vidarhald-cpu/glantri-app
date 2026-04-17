"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { useCanAccessAdmin } from "../../../../src/lib/auth/SessionUserContext";
import {
  normalizeSkillDefinition,
  updateSkillGroupInContent
} from "../../../../src/lib/admin/editing";
import { downloadCsv } from "../../../../src/lib/admin/exporters";
import { buildSkillGroupAdminRows } from "../../../../src/lib/admin/viewModels";
import {
  AdminButton,
  AdminCheckboxList,
  AdminDataTable,
  AdminField,
  AdminInput,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminReadOnlyNotice,
  AdminTagList,
  AdminTextarea
} from "../admin-ui";

interface SkillGroupFormState {
  description: string;
  includedSkillIds: string[];
  name: string;
  sortOrder: string;
}

function createFormState(group: { description?: string; name: string; sortOrder: number }, includedSkillIds: string[]): SkillGroupFormState {
  return {
    description: group.description ?? "",
    includedSkillIds,
    name: group.name,
    sortOrder: String(group.sortOrder)
  };
}

export default function SkillGroupsAdminPage() {
  const canEdit = useCanAccessAdmin();
  const { content, replaceContent } = useAdminContent();
  const rows = buildSkillGroupAdminRows(content);
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const selectedGroup =
    content.skillGroups.find((group) => group.id === selectedGroupId) ??
    content.skillGroups.slice().sort((left, right) => left.sortOrder - right.sortOrder)[0];
  const [formState, setFormState] = useState<SkillGroupFormState>();
  const selectedRow = rows.find((row) => row.id === selectedGroup.id);

  useEffect(() => {
    if (!selectedGroupId && rows[0]) {
      setSelectedGroupId(rows[0].id);
    }
  }, [rows, selectedGroupId]);

  useEffect(() => {
    if (!selectedGroup) {
      return;
    }

    const includedSkillIds = content.skills
      .filter((skill) => skill.groupIds.includes(selectedGroup.id))
      .map((skill) => skill.id);

    setSelectedGroupId(selectedGroup.id);
    setFormState(createFormState(selectedGroup, includedSkillIds));
  }, [content.skills, selectedGroup]);

  if (!selectedGroup || !formState) {
    return (
      <AdminPanel title="Skill Groups">
        <div>No skill groups found.</div>
      </AdminPanel>
    );
  }

  const activeForm = formState;

  function toggleSkill(skillId: string) {
    setFormState((current) =>
      current
        ? {
            ...current,
            includedSkillIds: current.includedSkillIds.includes(skillId)
              ? current.includedSkillIds.filter((candidate) => candidate !== skillId)
              : [...current.includedSkillIds, skillId]
          }
        : current
    );
  }

  async function handleSave() {
    const updatedGroupContent = updateSkillGroupInContent(content, {
      ...selectedGroup,
      description: activeForm.description.trim() || undefined,
      name: activeForm.name.trim(),
      sortOrder: Number(activeForm.sortOrder) || 0
    });
    const fallbackGroupId =
      updatedGroupContent.skillGroups.find((group) => group.id !== selectedGroup.id)?.id ?? selectedGroup.id;
    const nextContent = {
      ...updatedGroupContent,
      skills: updatedGroupContent.skills.map((skill) => {
        const hasGroup = skill.groupIds.includes(selectedGroup.id);
        const shouldHaveGroup = activeForm.includedSkillIds.includes(skill.id);

        if (hasGroup === shouldHaveGroup) {
          return skill;
        }

        if (shouldHaveGroup) {
          return normalizeSkillDefinition(skill, [...skill.groupIds, selectedGroup.id]);
        }

        const remainingGroups = skill.groupIds.filter((groupId) => groupId !== selectedGroup.id);
        return normalizeSkillDefinition(skill, remainingGroups.length > 0 ? remainingGroups : [fallbackGroupId]);
      })
    };

    await replaceContent(nextContent, `Saved skill group "${activeForm.name.trim()}".`);
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
                  { header: "Sort Order", value: (row) => row.sortOrder },
                  { header: "Included Skills", value: (row) => row.includedSkills.join(" | ") },
                  {
                    header: "Allowed Professions",
                    value: (row) => row.allowedProfessions.join(" | ")
                  },
                  { header: "Notes", value: (row) => row.notes }
                ],
                filename: "glantri-skill-groups.csv",
                rows
              })
            }
            variant="secondary"
          >
            Export CSV
          </AdminButton>
        }
        eyebrow="Admin / Skill Groups"
        summary="Skill groups are the structural layer that professions and societies point at most often. This workspace keeps those memberships visible and editable."
        title="Skill Groups"
      />

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1.65fr) minmax(340px, 1fr)" }}>
        <AdminPanel title="Group Catalog">
          <AdminDataTable
            columns={[
              {
                header: "Name",
                render: (row) => <strong>{row.name}</strong>
              },
              {
                header: "Core Skills",
                render: (row) => <AdminTagList values={row.coreSkills} />
              },
              {
                header: "Optional Skills",
                render: (row) =>
                  row.optionalSkills.length > 0 ? (
                    <AdminTagList values={row.optionalSkills} />
                  ) : (
                    <span style={{ color: "#8a7e63" }}>None</span>
                  )
              },
              {
                header: "Weighted Size",
                render: (row) => `${row.weightedContentPoints} pts`
              },
              {
                header: "Warnings",
                render: (row) =>
                  row.warningDetails.length > 0 ? (
                    <span style={{ color: "#8a3b2f", fontWeight: 700 }}>
                      {row.warningDetails.length} warning{row.warningDetails.length === 1 ? "" : "s"}
                    </span>
                  ) : (
                    <span style={{ color: "#567043" }}>Healthy</span>
                  )
              },
              {
                header: "Allowed Profession(s)",
                render: (row) =>
                  row.allowedProfessions.length > 0 ? (
                    <AdminTagList values={row.allowedProfessions} />
                  ) : (
                    <span style={{ color: "#8a7e63" }}>None</span>
                  )
              }
            ]}
            emptyState="No skill groups found."
            onSelect={setSelectedGroupId}
            rows={rows}
            selectedId={selectedGroup.id}
          />
        </AdminPanel>

        <div style={{ display: "grid", gap: "1rem" }}>
          <AdminPanel
            subtitle="This is the primary inspection view for the new skill-group structure. Core versus optional membership, weighted content size, and weak-group warnings are surfaced here instead of being hidden in raw ids."
            title={selectedGroup.name}
          >
            <div style={{ display: "grid", gap: "0.85rem" }}>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                <AdminMetric label="Core skills" value={selectedRow?.coreSkills.length ?? 0} />
                <AdminMetric label="Optional skills" value={selectedRow?.optionalSkills.length ?? 0} />
                <AdminMetric label="Weighted size" value={`${selectedRow?.weightedContentPoints ?? 0} pts`} />
              </div>

              {selectedRow?.warningDetails.length ? (
                <div
                  style={{
                    background: "rgba(139, 59, 47, 0.08)",
                    border: "1px solid rgba(139, 59, 47, 0.16)",
                    borderRadius: 16,
                    color: "#6b3429",
                    display: "grid",
                    gap: "0.45rem",
                    padding: "0.9rem 1rem"
                  }}
                >
                  <strong>Validation warnings</strong>
                  {selectedRow.warningDetails.map((warning) => (
                    <div key={warning}>{warning}</div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    background: "rgba(86, 112, 67, 0.08)",
                    border: "1px solid rgba(86, 112, 67, 0.16)",
                    borderRadius: 16,
                    color: "#46613a",
                    padding: "0.9rem 1rem"
                  }}
                >
                  No weak-group warnings for this skill group.
                </div>
              )}

              <div style={{ display: "grid", gap: "0.85rem" }}>
                <div>
                  <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Core skills
                  </div>
                  <AdminTagList values={selectedRow?.coreSkills ?? []} />
                </div>

                <div>
                  <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Optional skills
                  </div>
                  {selectedRow?.optionalSkills.length ? (
                    <AdminTagList values={selectedRow.optionalSkills} />
                  ) : (
                    <div style={{ color: "#8a7e63" }}>No optional cross-listed skills in this group.</div>
                  )}
                </div>

                <div>
                  <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Professions using this group
                  </div>
                  {selectedRow?.allowedProfessions.length ? (
                    <AdminTagList values={selectedRow.allowedProfessions} />
                  ) : (
                    <div style={{ color: "#8a7e63" }}>No profession currently grants this group.</div>
                  )}
                </div>

                <div style={{ color: "#5f543a", fontSize: "0.92rem", lineHeight: 1.5 }}>
                  <Link href="/admin/skills" style={{ color: "#7e5d2a", fontWeight: 700 }}>
                    Open skills inspector
                  </Link>
                  {" "}
                  to review the linked skills in the broader skill catalog.
                </div>
              </div>
            </div>
          </AdminPanel>

          <AdminPanel
            subtitle="Editing remains available here, but membership relevance editing is still deferred. This form preserves the current raw inclusion workflow."
            title={`Edit ${selectedGroup.name}`}
          >
            {canEdit ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSave();
                }}
                style={{ display: "grid", gap: "0.9rem" }}
              >
                <AdminField label="Group id">
                  <AdminInput readOnly value={selectedGroup.id} />
                </AdminField>

                <AdminField label="Name">
                  <AdminInput
                    onChange={(event) => setFormState({ ...formState, name: event.target.value })}
                    value={activeForm.name}
                  />
                </AdminField>

                <AdminField label="Sort order">
                  <AdminInput
                    onChange={(event) =>
                      setFormState({ ...activeForm, sortOrder: event.target.value })
                    }
                    type="number"
                    value={activeForm.sortOrder}
                  />
                </AdminField>

                <AdminField label="Notes">
                  <AdminTextarea
                    onChange={(event) =>
                      setFormState({ ...activeForm, description: event.target.value })
                    }
                    value={activeForm.description}
                  />
                </AdminField>

                <AdminField label="Included skills">
                  <AdminCheckboxList
                    onToggle={toggleSkill}
                    options={content.skills
                      .slice()
                      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
                      .map((skill) => ({
                        label: skill.name,
                        selected: activeForm.includedSkillIds.includes(skill.id),
                        value: skill.id
                      }))}
                  />
                </AdminField>

                <AdminButton type="submit">Save Skill Group</AdminButton>
              </form>
            ) : (
              <AdminReadOnlyNotice message="Skill groups are visible here for review, but editing is limited to Admin and GM accounts." />
            )}
          </AdminPanel>
        </div>
      </div>
    </section>
  );
}
