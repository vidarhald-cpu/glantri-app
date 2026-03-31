"use client";

import { useEffect, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
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
  AdminPageIntro,
  AdminPanel,
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
  const { content, replaceContent } = useAdminContent();
  const rows = buildSkillGroupAdminRows(content);
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const selectedGroup =
    content.skillGroups.find((group) => group.id === selectedGroupId) ??
    content.skillGroups.slice().sort((left, right) => left.sortOrder - right.sortOrder)[0];
  const [formState, setFormState] = useState<SkillGroupFormState>();

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

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1.65fr) minmax(320px, 1fr)" }}>
        <AdminPanel title="Group Catalog">
          <AdminDataTable
            columns={[
              {
                header: "Name",
                render: (row) => <strong>{row.name}</strong>
              },
              {
                header: "Sort Order",
                render: (row) => row.sortOrder
              },
              {
                header: "Included Skills",
                render: (row) => <AdminTagList values={row.includedSkills} />
              },
              {
                header: "Allowed Profession(s)",
                render: (row) => <AdminTagList values={row.allowedProfessions} />
              },
              {
                header: "Notes",
                render: (row) => row.notes || <span style={{ color: "#8a7e63" }}>None</span>
              }
            ]}
            emptyState="No skill groups found."
            onSelect={setSelectedGroupId}
            rows={rows}
            selectedId={selectedGroup.id}
          />
        </AdminPanel>

        <AdminPanel
          subtitle="Included skills are edited here because group membership is one of the core relationships we want to manage explicitly."
          title={`Edit ${selectedGroup.name}`}
        >
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
        </AdminPanel>
      </div>
    </section>
  );
}
