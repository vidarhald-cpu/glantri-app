"use client";

import { useEffect, useMemo, useState } from "react";

import type { SkillDefinition } from "@glantri/domain";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { useCanAccessAdmin } from "../../../../src/lib/auth/SessionUserContext";
import {
  normalizeOptionalId,
  normalizeSkillDefinition,
  parseCommaSeparatedList,
  updateSkillInContent
} from "../../../../src/lib/admin/editing";
import { downloadCsv } from "../../../../src/lib/admin/exporters";
import { buildSkillAdminRows } from "../../../../src/lib/admin/viewModels";
import {
  AdminButton,
  AdminCheckboxList,
  AdminDataTable,
  AdminField,
  AdminInput,
  AdminPageIntro,
  AdminPanel,
  AdminReadOnlyNotice,
  AdminSelect,
  AdminTagList,
  AdminTextarea
} from "../admin-ui";
import SkillsWorkspaceTabs from "./SkillsWorkspaceTabs";

interface SkillFormState {
  allowsSpecializations: boolean;
  dependencySkillIds: string[];
  description: string;
  groupIds: string[];
  isTheoretical: boolean;
  linkedStats: string;
  name: string;
  requiresLiteracy: SkillDefinition["requiresLiteracy"];
  secondaryOfSkillId: string;
  shortDescription: string;
  societyLevel: string;
  sortOrder: string;
  specializationOfSkillId: string;
  type: SkillDefinition["category"];
}

function createSkillFormState(skill: SkillDefinition): SkillFormState {
  return {
    allowsSpecializations: skill.allowsSpecializations,
    dependencySkillIds: skill.dependencySkillIds,
    description: skill.description ?? "",
    groupIds: skill.groupIds,
    isTheoretical: skill.isTheoretical,
    linkedStats: skill.linkedStats.join(", "),
    name: skill.name,
    requiresLiteracy: skill.requiresLiteracy,
    secondaryOfSkillId: skill.secondaryOfSkillId ?? "",
    shortDescription: skill.shortDescription ?? "",
    societyLevel: String(skill.societyLevel),
    sortOrder: String(skill.sortOrder),
    specializationOfSkillId: skill.specializationOfSkillId ?? "",
    type: skill.category
  };
}

function toggleSelectedValue(values: string[], nextValue: string): string[] {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

export default function SkillsAdminPage() {
  const canEdit = useCanAccessAdmin();
  const { content, replaceContent } = useAdminContent();
  const rows = buildSkillAdminRows(content);
  const [selectedSkillId, setSelectedSkillId] = useState<string>();
  const [formState, setFormState] = useState<SkillFormState>();

  const selectedSkill =
    content.skills.find((skill) => skill.id === selectedSkillId) ??
    content.skills.slice().sort((left, right) => left.sortOrder - right.sortOrder)[0];

  const relationSkillOptions = useMemo(
    () =>
      content.skills
        .filter((skill) => skill.id !== selectedSkill?.id)
        .slice()
        .sort((left, right) => left.name.localeCompare(right.name)),
    [content.skills, selectedSkill?.id]
  );

  useEffect(() => {
    if (!selectedSkillId && rows[0]) {
      setSelectedSkillId(rows[0].id);
    }
  }, [rows, selectedSkillId]);

  useEffect(() => {
    if (selectedSkill) {
      setSelectedSkillId(selectedSkill.id);
      setFormState(createSkillFormState(selectedSkill));
    }
  }, [selectedSkill]);

  if (!selectedSkill || !formState) {
    return (
      <AdminPanel title="Skills">
        <div>No skill definitions are available in the current canonical content.</div>
      </AdminPanel>
    );
  }

  const activeForm = formState;

  async function handleSave() {
    const linkedStats = parseCommaSeparatedList(activeForm.linkedStats);
    const normalizedSkill = normalizeSkillDefinition(
      {
        ...selectedSkill,
        allowsSpecializations: activeForm.allowsSpecializations,
        category: activeForm.type,
        dependencySkillIds: activeForm.dependencySkillIds,
        description: activeForm.description.trim() || undefined,
        isTheoretical: activeForm.isTheoretical,
        linkedStats,
        name: activeForm.name.trim(),
        requiresLiteracy: activeForm.requiresLiteracy,
        secondaryOfSkillId: normalizeOptionalId(activeForm.secondaryOfSkillId),
        shortDescription: activeForm.shortDescription.trim() || undefined,
        societyLevel: Math.min(6, Math.max(1, Number(activeForm.societyLevel) || 1)),
        sortOrder: Number(activeForm.sortOrder) || 0,
        specializationOfSkillId: normalizeOptionalId(activeForm.specializationOfSkillId)
      },
      activeForm.groupIds
    );

    await replaceContent(
      updateSkillInContent(content, normalizedSkill),
      `Saved skill "${normalizedSkill.name}".`
    );
  }

  function toggleGroup(groupId: string) {
    setFormState((current) =>
      current
        ? {
            ...current,
            groupIds: toggleSelectedValue(current.groupIds, groupId)
          }
        : current
    );
  }

  function toggleDependency(skillId: string) {
    setFormState((current) =>
      current
        ? {
            ...current,
            dependencySkillIds: toggleSelectedValue(current.dependencySkillIds, skillId)
          }
        : current
    );
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
                  { header: "Short Description", value: (row) => row.shortDescription },
                  { header: "Skill Type", value: (row) => row.skillType },
                  { header: "Parent Skill Groups", value: (row) => row.groupNames.join(" | ") },
                  { header: "Characteristics", value: (row) => row.characteristics },
                  { header: "Theoretical", value: (row) => row.theoretical },
                  { header: "Society Level", value: (row) => row.societyLevel },
                  { header: "Dependencies", value: (row) => row.dependencies.join(" | ") },
                  { header: "Secondary Of", value: (row) => row.secondaryOf },
                  { header: "Specialization Of", value: (row) => row.specializationOf },
                  { header: "Sort Order", value: (row) => row.sortOrder }
                ],
                filename: "glantri-skills.csv",
                rows
              })
            }
            variant="secondary"
          >
            Export CSV
          </AdminButton>
        }
        eyebrow="Admin / Skills"
        summary="The skills workspace now focuses on the canonical skill graph itself: group membership, skill dependencies, parent-skill relationships, and society level. Those fields are intended to become the foundation that later profession and society tooling consumes."
        title="Skills"
      />

      <SkillsWorkspaceTabs />

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "minmax(0, 2.2fr) minmax(340px, 1fr)"
        }}
      >
        <AdminPanel
          subtitle="The table centers the canonical skill model rather than derived profession or society reach. Select a skill to edit its structure and rule text."
          title="Skill Catalog"
        >
          <AdminDataTable
            columns={[
              {
                header: "Name",
                render: (row) => <strong>{row.name}</strong>,
                width: "12rem"
              },
              {
                header: "Short Description",
                render: (row) =>
                  row.shortDescription || <span style={{ color: "#8a7e63" }}>None</span>,
                width: "16rem"
              },
              {
                header: "Skill Type",
                render: (row) => row.skillType
              },
              {
                header: "Parent Skill Group(s)",
                render: (row) => <AdminTagList values={row.groupNames} />
              },
              {
                header: "Characteristics",
                render: (row) => row.characteristics
              },
              {
                header: "Theoretical",
                render: (row) => (row.theoretical ? "Yes" : "No")
              },
              {
                header: "Society Level",
                render: (row) => row.societyLevel
              },
              {
                header: "Dependencies",
                render: (row) => <AdminTagList values={row.dependencies} />
              },
              {
                header: "Secondary Of",
                render: (row) => row.secondaryOf || <span style={{ color: "#8a7e63" }}>None</span>
              },
              {
                header: "Specialization Of",
                render: (row) =>
                  row.specializationOf || <span style={{ color: "#8a7e63" }}>None</span>
              },
              {
                header: "Sort Order",
                render: (row) => row.sortOrder
              }
            ]}
            emptyState="No skills found."
            onSelect={setSelectedSkillId}
            rows={rows}
            selectedId={selectedSkill.id}
          />
        </AdminPanel>

        <AdminPanel
          subtitle="This editor updates the canonical skill definition that the server-backed admin draft saves as a full content snapshot."
          title={`Edit ${selectedSkill.name}`}
        >
          {canEdit ? (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSave();
              }}
              style={{ display: "grid", gap: "0.9rem" }}
            >
              <AdminField label="Skill id">
                <AdminInput readOnly value={selectedSkill.id} />
              </AdminField>

              <AdminField label="Name">
                <AdminInput
                  onChange={(event) => setFormState({ ...activeForm, name: event.target.value })}
                  value={activeForm.name}
                />
              </AdminField>

              <AdminField
                hint="Short list copy used when this skill appears in matrix, profession, and society review surfaces. Keep it brief and functional."
                label="Short description"
              >
                <AdminInput
                  onChange={(event) =>
                    setFormState({ ...activeForm, shortDescription: event.target.value })
                  }
                  value={activeForm.shortDescription}
                />
              </AdminField>

              <div
                style={{
                  display: "grid",
                  gap: "0.9rem",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))"
                }}
              >
                <AdminField
                  hint="`ordinary` is a core skill node in the graph. `secondary` marks a skill that typically hangs off another primary skill path."
                  label="Skill type"
                >
                  <AdminSelect
                    onChange={(event) =>
                      setFormState({
                        ...activeForm,
                        type: event.target.value as SkillDefinition["category"]
                      })
                    }
                    value={activeForm.type}
                  >
                    <option value="ordinary">ordinary</option>
                    <option value="secondary">secondary</option>
                  </AdminSelect>
                </AdminField>

                <AdminField
                  hint="This is the skill's own availability tier in the skill graph, not a society-row band. Professions and societies later consume this signal."
                  label="Society level"
                >
                  <AdminSelect
                    onChange={(event) =>
                      setFormState({ ...activeForm, societyLevel: event.target.value })
                    }
                    value={activeForm.societyLevel}
                  >
                    {["1", "2", "3", "4", "5", "6"].map((level) => (
                      <option key={level} value={level}>
                        {level}
                      </option>
                    ))}
                  </AdminSelect>
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
              </div>

              <AdminField label="Characteristics">
                <AdminInput
                  onChange={(event) =>
                    setFormState({ ...activeForm, linkedStats: event.target.value })
                  }
                  placeholder="str, dex"
                  value={activeForm.linkedStats}
                />
              </AdminField>

              <AdminField
                hint="Group membership is authoritative skill taxonomy. Professions reach whole packages through these groups."
                label="Parent skill groups"
              >
                <AdminCheckboxList
                  onToggle={toggleGroup}
                  options={content.skillGroups
                    .slice()
                    .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
                    .map((group) => ({
                      label: group.name,
                      selected: activeForm.groupIds.includes(group.id),
                      value: group.id
                    }))}
                />
              </AdminField>

              <AdminField
                hint="Dependencies model prerequisite progression inside the skill layer. Avoid using these as profession or society access controls."
                label="Required skills / dependencies"
              >
                <AdminCheckboxList
                  onToggle={toggleDependency}
                  options={relationSkillOptions.map((skill) => ({
                    label: skill.name,
                    selected: activeForm.dependencySkillIds.includes(skill.id),
                    value: skill.id
                  }))}
                />
              </AdminField>

              <div
                style={{
                  display: "grid",
                  gap: "0.9rem",
                  gridTemplateColumns: "repeat(2, minmax(0, 1fr))"
                }}
              >
                <AdminField
                  hint="Use this when the current skill is a secondary branch of another skill. It expresses relationship context, not ownership."
                  label="Secondary-of skill"
                >
                  <AdminSelect
                    onChange={(event) =>
                      setFormState({ ...activeForm, secondaryOfSkillId: event.target.value })
                    }
                    value={activeForm.secondaryOfSkillId}
                  >
                    <option value="">None</option>
                    {relationSkillOptions.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                      </option>
                    ))}
                  </AdminSelect>
                </AdminField>

                <AdminField
                  hint="Use this when the current skill is a specialization variant of a broader parent skill that should allow specializations."
                  label="Specialization-of skill"
                >
                  <AdminSelect
                    onChange={(event) =>
                      setFormState({
                        ...activeForm,
                        specializationOfSkillId: event.target.value
                      })
                    }
                    value={activeForm.specializationOfSkillId}
                  >
                    <option value="">None</option>
                    {relationSkillOptions.map((skill) => (
                      <option key={skill.id} value={skill.id}>
                        {skill.name}
                      </option>
                    ))}
                  </AdminSelect>
                </AdminField>
              </div>

              <AdminField
                hint="Records whether literacy is required or merely recommended for practical access to the skill."
                label="Literacy requirement"
              >
                <AdminSelect
                  onChange={(event) =>
                    setFormState({
                      ...activeForm,
                      requiresLiteracy: event.target.value as SkillDefinition["requiresLiteracy"]
                    })
                  }
                  value={activeForm.requiresLiteracy}
                >
                  <option value="no">no</option>
                  <option value="recommended">recommended</option>
                  <option value="required">required</option>
                </AdminSelect>
              </AdminField>

              <label
                style={{
                  alignItems: "center",
                  color: "#3f3422",
                  display: "flex",
                  gap: "0.6rem"
                }}
              >
                <input
                  checked={activeForm.isTheoretical}
                  onChange={(event) =>
                    setFormState({ ...activeForm, isTheoretical: event.target.checked })
                  }
                  type="checkbox"
                />
                <span>Theoretical skill</span>
              </label>

              <label
                style={{
                  alignItems: "center",
                  color: "#3f3422",
                  display: "flex",
                  gap: "0.6rem"
                }}
              >
                <input
                  checked={activeForm.allowsSpecializations}
                  onChange={(event) =>
                    setFormState({
                      ...activeForm,
                      allowsSpecializations: event.target.checked
                    })
                  }
                  type="checkbox"
                />
                <span>Allows specializations</span>
              </label>

              <AdminField
                hint="Longer rules text or design notes for the skill itself. This is separate from the short list-facing description above."
                label="Notes / rule text"
              >
                <AdminTextarea
                  onChange={(event) =>
                    setFormState({ ...activeForm, description: event.target.value })
                  }
                  value={activeForm.description}
                />
              </AdminField>

              <AdminButton type="submit">Save Skill</AdminButton>
            </form>
          ) : (
            <AdminReadOnlyNotice message="This skill workspace is view-only for player accounts. Sign in as Admin or GM to edit canonical skill definitions." />
          )}
        </AdminPanel>
      </div>
    </section>
  );
}
