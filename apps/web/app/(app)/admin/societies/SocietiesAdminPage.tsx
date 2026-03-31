"use client";

import { useEffect, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { downloadCsv } from "../../../../src/lib/admin/exporters";
import { buildSocietyAdminRows } from "../../../../src/lib/admin/viewModels";
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
import SocietiesWorkspaceTabs from "./SocietiesWorkspaceTabs";

interface SocietyFormState {
  baseEducation: string;
  notes: string;
  professionIds: string[];
  skillGroupIds: string[];
  skillIds: string[];
  socialClass: string;
  societyName: string;
}

function createSocietyRowId(input: { societyId: string; societyLevel: number }): string {
  return `${input.societyId}:${input.societyLevel}`;
}

function createSocietyFormState(input: {
  baseEducation?: number;
  notes?: string;
  professionIds: string[];
  skillGroupIds: string[];
  skillIds: string[];
  socialClass: string;
  societyName: string;
}): SocietyFormState {
  return {
    baseEducation: input.baseEducation === undefined ? "" : String(input.baseEducation),
    notes: input.notes ?? "",
    professionIds: input.professionIds,
    skillGroupIds: input.skillGroupIds,
    skillIds: input.skillIds,
    socialClass: input.socialClass,
    societyName: input.societyName
  };
}

export default function SocietiesAdminPage() {
  const { content, replaceContent } = useAdminContent();
  const rows = buildSocietyAdminRows(content);
  const [selectedRowId, setSelectedRowId] = useState<string>();
  const selectedSocietyLevel =
    content.societyLevels.find(
      (societyLevel) =>
        createSocietyRowId({
          societyId: societyLevel.societyId,
          societyLevel: societyLevel.societyLevel
        }) === selectedRowId
    ) ??
    content.societyLevels
      .slice()
      .sort((left, right) => left.societyName.localeCompare(right.societyName) || left.societyLevel - right.societyLevel)[0];
  const [formState, setFormState] = useState<SocietyFormState>();

  useEffect(() => {
    if (!selectedRowId && rows[0]) {
      setSelectedRowId(rows[0].id);
    }
  }, [rows, selectedRowId]);

  useEffect(() => {
    if (!selectedSocietyLevel) {
      return;
    }

    setSelectedRowId(
      createSocietyRowId({
        societyId: selectedSocietyLevel.societyId,
        societyLevel: selectedSocietyLevel.societyLevel
      })
    );
    setFormState(
      createSocietyFormState({
        baseEducation: selectedSocietyLevel.baseEducation,
        notes: selectedSocietyLevel.notes,
        professionIds: selectedSocietyLevel.professionIds,
        skillGroupIds: selectedSocietyLevel.skillGroupIds,
        skillIds: selectedSocietyLevel.skillIds,
        socialClass: selectedSocietyLevel.socialClass,
        societyName: selectedSocietyLevel.societyName
      })
    );
  }, [selectedSocietyLevel]);

  if (!selectedSocietyLevel || !formState) {
    return (
      <AdminPanel title="Societies">
        <div>No society/social-class rows found.</div>
      </AdminPanel>
    );
  }

  const activeForm = formState;

  function toggleRelation(key: "professionIds" | "skillGroupIds" | "skillIds", value: string) {
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
    const nextContent = {
      ...content,
      societyLevels: content.societyLevels.map((societyLevel) => {
        const matchingSociety = societyLevel.societyId === selectedSocietyLevel.societyId;

        if (
          matchingSociety &&
          societyLevel.societyLevel === selectedSocietyLevel.societyLevel
        ) {
          return {
            ...societyLevel,
            baseEducation:
              activeForm.baseEducation.trim().length > 0
                ? Number(activeForm.baseEducation)
                : undefined,
            notes: activeForm.notes.trim() || undefined,
            professionIds: [...new Set(activeForm.professionIds)],
            skillGroupIds: [...new Set(activeForm.skillGroupIds)],
            skillIds: [...new Set(activeForm.skillIds)],
            socialClass: activeForm.socialClass.trim(),
            societyName: activeForm.societyName.trim()
          };
        }

        if (!matchingSociety) {
          return societyLevel;
        }

        return {
          ...societyLevel,
          societyName: activeForm.societyName.trim()
        };
      })
    };

    await replaceContent(
      nextContent,
      `Saved society row "${activeForm.societyName.trim()} L${selectedSocietyLevel.societyLevel}".`
    );
  }

  const selectedRowDisplayId = createSocietyRowId({
    societyId: selectedSocietyLevel.societyId,
    societyLevel: selectedSocietyLevel.societyLevel
  });

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        actions={
          <AdminButton
            onClick={() =>
              downloadCsv({
                columns: [
                  { header: "Society", value: (row) => row.society },
                  { header: "Neutral Band/Level", value: (row) => row.societyLevel },
                  { header: "Die Range", value: (row) => row.dieRange },
                  { header: "Society-Specific Class Name", value: (row) => row.societyClassName },
                  { header: "Base Education", value: (row) => row.baseEducation },
                  {
                    header: "Reachable Professions",
                    value: (row) => row.reachableProfessions.join(" | ")
                  },
                  {
                    header: "Direct Skill Groups",
                    value: (row) => row.directSkillGroups.join(" | ")
                  },
                  {
                    header: "Direct Skills",
                    value: (row) => row.directSkills.join(" | ")
                  },
                  {
                    header: "Profession-Derived Reach",
                    value: (row) => row.effectiveProfessionSkills.join(" | ")
                  },
                  {
                    header: "Direct-Only Extra Skills",
                    value: (row) => row.directOnlySkills.join(" | ")
                  },
                  { header: "Total Effective Reach", value: (row) => row.totalEffectiveReachableSkills },
                  { header: "Notes", value: (row) => row.notes }
                ],
                filename: "glantri-societies.csv",
                rows
              })
            }
            variant="secondary"
          >
            Export CSV
          </AdminButton>
        }
        eyebrow="Admin / Societies"
        summary="Society/social-class rows define who can start with which professions, skill groups, and direct skills. This page keeps those access rows legible as one matrix instead of a scattered set of ids."
        title="Societies / Social Classes"
      />

      <SocietiesWorkspaceTabs />

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1.7fr) minmax(340px, 1fr)" }}>
        <AdminPanel title="Society Access Rows">
          <AdminDataTable
            columns={[
              {
                header: "Society",
                render: (row) => <strong>{row.society}</strong>
              },
              {
                header: "Band / Level",
                render: (row) => row.societyLevel
              },
              {
                header: "Die Range",
                render: (row) => row.dieRange
              },
              {
                header: "Class Name",
                render: (row) => row.societyClassName
              },
              {
                header: "Base Education",
                render: (row) => row.baseEducation || <span style={{ color: "#8a7e63" }}>None</span>
              },
              {
                header: "Reachable Professions",
                render: (row) => <AdminTagList values={row.reachableProfessions} />
              },
              {
                header: "Direct Skill Groups",
                render: (row) => <AdminTagList values={row.directSkillGroups} />
              },
              {
                header: "Direct Skills",
                render: (row) => <AdminTagList values={row.directSkills} />
              },
              {
                header: "Profession-Derived Reach",
                render: (row) => <AdminTagList values={row.effectiveProfessionSkills} />
              },
              {
                header: "Direct-Only Extra Skills",
                render: (row) => <AdminTagList values={row.directOnlySkills} />
              },
              {
                header: "Total Effective Reach",
                render: (row) => row.totalEffectiveReachableSkills
              },
              {
                header: "Notes",
                render: (row) => row.notes || <span style={{ color: "#8a7e63" }}>None</span>
              }
            ]}
            emptyState="No society rows found."
            onSelect={setSelectedRowId}
            rows={rows}
            selectedId={selectedRowDisplayId}
          />
        </AdminPanel>

        <AdminPanel
          subtitle="The society name is shared across all bands for a society id, so saving that field propagates to the sibling rows automatically."
          title={`Edit ${selectedSocietyLevel.societyName} L${selectedSocietyLevel.societyLevel}`}
        >
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void handleSave();
            }}
            style={{ display: "grid", gap: "0.9rem" }}
          >
            <AdminField label="Society id">
              <AdminInput readOnly value={selectedSocietyLevel.societyId} />
            </AdminField>

            <AdminField
              hint="This row's neutral access band within the society. It is distinct from skill-layer society level, which lives on individual skills."
              label="Neutral band / level"
            >
              <AdminInput readOnly value={String(selectedSocietyLevel.societyLevel)} />
            </AdminField>

            <AdminField label="Die range">
              <AdminInput readOnly value={rows.find((row) => row.id === selectedRowDisplayId)?.dieRange ?? "Custom"} />
            </AdminField>

            <AdminField label="Society">
              <AdminInput
                onChange={(event) =>
                  setFormState({ ...activeForm, societyName: event.target.value })
                }
                value={activeForm.societyName}
              />
            </AdminField>

            <AdminField
              hint="Display label for this access row inside the selected society at this neutral band."
              label="Society-specific class name"
            >
              <AdminInput
                onChange={(event) =>
                  setFormState({ ...activeForm, socialClass: event.target.value })
                }
                value={activeForm.socialClass}
              />
            </AdminField>

            <AdminField
              hint="Base education is row metadata, not a direct skill grant. Use it to describe the educational floor implied by this society/class band."
              label="Base education"
            >
              <AdminInput
                onChange={(event) =>
                  setFormState({ ...activeForm, baseEducation: event.target.value })
                }
                type="number"
                value={activeForm.baseEducation}
              />
            </AdminField>

            <AdminField
              hint="These professions are the main access packages this row unlocks. Society rows should usually orchestrate professions first, then add limited direct overrides only when needed."
              label="Allowed professions"
            >
              <AdminCheckboxList
                onToggle={(value) => toggleRelation("professionIds", value)}
                options={content.professions
                  .slice()
                  .sort((left, right) => left.name.localeCompare(right.name))
                  .map((profession) => ({
                    label: profession.name,
                    selected: activeForm.professionIds.includes(profession.id),
                    value: profession.id
                  }))}
              />
            </AdminField>

            <AdminField
              hint="Direct skill-group overrides add access beyond the profession-derived package. Use sparingly when the society row needs extra group-level reach."
              label="Allowed skill groups"
            >
              <AdminCheckboxList
                onToggle={(value) => toggleRelation("skillGroupIds", value)}
                options={content.skillGroups
                  .slice()
                  .sort((left, right) => left.sortOrder - right.sortOrder)
                  .map((group) => ({
                    label: group.name,
                    selected: activeForm.skillGroupIds.includes(group.id),
                    value: group.id
                  }))}
              />
            </AdminField>

            <AdminField
              hint="Direct skill overrides are best for narrowly targeted additions on top of profession-derived reach."
              label="Individually allowed skills"
            >
              <AdminCheckboxList
                onToggle={(value) => toggleRelation("skillIds", value)}
                options={content.skills
                  .slice()
                  .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
                  .map((skill) => ({
                    label: skill.name,
                    selected: activeForm.skillIds.includes(skill.id),
                    value: skill.id
                  }))}
              />
            </AdminField>

            <AdminField
              hint="Use notes for row-specific rationale or exceptions that help reviewers understand why this access orchestration differs from neighboring levels."
              label="Notes"
            >
              <AdminTextarea
                onChange={(event) =>
                  setFormState({ ...activeForm, notes: event.target.value })
                }
                value={activeForm.notes}
              />
            </AdminField>

            <AdminButton type="submit">Save Society Row</AdminButton>
          </form>
        </AdminPanel>
      </div>
    </section>
  );
}
