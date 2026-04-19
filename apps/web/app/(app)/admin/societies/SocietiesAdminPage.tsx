"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { useCanAccessAdmin } from "../../../../src/lib/auth/SessionUserContext";
import { downloadCsv } from "../../../../src/lib/admin/exporters";
import { buildSocietyAdminRows } from "../../../../src/lib/admin/viewModels";
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

function summarizeList(values: string[], maxItems = 3): string {
  if (values.length === 0) {
    return "None";
  }

  if (values.length <= maxItems) {
    return values.join(", ");
  }

  return `${values.slice(0, maxItems).join(", ")} +${values.length - maxItems} more`;
}

function summarizeText(value: string | undefined, maxLength = 90): string {
  const trimmed = value?.trim();

  if (!trimmed) {
    return "";
  }

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1).trimEnd()}…`;
}

export default function SocietiesAdminPage() {
  const canEdit = useCanAccessAdmin();
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
  const selectedRow = rows.find((row) => row.id === selectedRowDisplayId);

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
        summary="Review societies as compact access rows first, then drill into a selected row to inspect baseline languages, reachable professions, and the downstream profession → group → skill fan."
        title="Societies / Social Classes"
      />

      <SocietiesWorkspaceTabs />

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 1.7fr) minmax(340px, 1fr)" }}>
        <AdminPanel title="Society Access Review">
          <AdminDataTable
            columns={[
              {
                header: "Society",
                render: (row) => <strong>{row.society}</strong>,
                width: "12rem"
              },
              {
                header: "Level",
                render: (row) => row.canonicalSocietyLevel ?? <span style={{ color: "#8a7e63" }}>None</span>,
                width: "5.5rem"
              },
              {
                header: "Band",
                render: (row) => `L${row.societyLevel}`,
                width: "5.5rem"
              },
              {
                header: "Class",
                render: (row) => row.societyClassName,
                width: "12rem"
              },
              {
                header: "Education",
                render: (row) => row.baseEducation || <span style={{ color: "#8a7e63" }}>None</span>,
                width: "6rem"
              },
              {
                header: "Description",
                render: (row) => (
                  <span style={{ color: "#4f4635", display: "block", lineHeight: 1.45 }}>
                    {summarizeText(row.shortDescription || row.notes, 120) || (
                      <span style={{ color: "#8a7e63" }}>None</span>
                    )}
                  </span>
                ),
                width: "24rem"
              },
              {
                header: "Historical Ref.",
                render: (row) => (
                  <span style={{ color: "#4f4635", display: "block", lineHeight: 1.45 }}>
                    {summarizeText(row.historicalReference, 70) || (
                      <span style={{ color: "#8a7e63" }}> </span>
                    )}
                  </span>
                ),
                width: "16rem"
              },
              {
                header: "Glantri Examples",
                render: (row) => (
                  <span style={{ color: "#4f4635", display: "block", lineHeight: 1.45 }}>
                    {summarizeText(row.glantriExamples, 70) || (
                      <span style={{ color: "#8a7e63" }}> </span>
                    )}
                  </span>
                ),
                width: "14rem"
              },
              {
                header: "Professions",
                render: (row) => (
                  <span style={{ color: "#4f4635", display: "block", lineHeight: 1.45 }}>
                    {summarizeList(row.reachableProfessions, 4)}
                  </span>
                ),
                width: "20rem"
              },
              {
                header: "Inspector",
                render: (row) => (
                  <AdminButton
                    onClick={() => setSelectedRowId(row.id)}
                    variant={row.id === selectedRowDisplayId ? "primary" : "secondary"}
                  >
                    {row.id === selectedRowDisplayId ? "Open" : "Inspect"}
                  </AdminButton>
                ),
                width: "10rem"
              }
            ]}
            emptyState="No society rows found."
            onSelect={setSelectedRowId}
            rows={rows}
            selectedId={selectedRowDisplayId}
          />
        </AdminPanel>

        <div style={{ display: "grid", gap: "1rem" }}>
          <AdminPanel
            subtitle="This inspector keeps the two concepts separate: society level 1–6 is the canonical culture scale, while access band L1–L4 is the row-specific access band that shapes reachable professions and downstream skill reach."
            title={`${selectedSocietyLevel.societyName} L${selectedSocietyLevel.societyLevel}`}
          >
            <div style={{ display: "grid", gap: "0.85rem" }}>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                <AdminMetric
                  hint="Canonical society scale"
                  label="Society Level"
                  value={selectedRow?.canonicalSocietyLevel ?? "—"}
                />
                <AdminMetric
                  hint="Access row within the society"
                  label="Access Band"
                  value={`L${selectedSocietyLevel.societyLevel}`}
                />
                <AdminMetric
                  hint="Row metadata"
                  label="Base Education"
                  value={selectedRow?.baseEducation || "—"}
                />
              </div>

              <div>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Baseline languages
                </div>
                {selectedRow?.baselineLanguages.length ? (
                  <AdminTagList values={selectedRow.baselineLanguages} />
                ) : (
                  <div style={{ color: "#8a7e63" }}>No baseline languages recorded.</div>
                )}
              </div>

              <div>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Society description
                </div>
                <div style={{ color: "#4f4635", lineHeight: 1.5 }}>
                  {selectedRow?.shortDescription || "No canonical society description recorded."}
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "0.85rem",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))"
                }}
              >
                <div>
                  <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Historical reference
                  </div>
                  <div style={{ color: "#4f4635", lineHeight: 1.5 }}>
                    {selectedRow?.historicalReference || <span style={{ color: "#8a7e63" }}>None</span>}
                  </div>
                </div>

                <div>
                  <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Glantri examples
                  </div>
                  <div style={{ color: "#4f4635", lineHeight: 1.5 }}>
                    {selectedRow?.glantriExamples || <span style={{ color: "#8a7e63" }}>None</span>}
                  </div>
                </div>
              </div>

              <div>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Reachable professions
                </div>
                <AdminTagList values={selectedRow?.reachableProfessions ?? []} />
              </div>

              <div style={{ display: "grid", gap: "0.75rem" }}>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Profession → groups → skills fan
                </div>
                {selectedRow?.professionFans.length ? (
                  selectedRow.professionFans.map((fan) => (
                    <details
                      key={fan.professionName}
                      style={{
                        background: "rgba(255, 252, 245, 0.88)",
                        border: "1px solid rgba(85, 73, 48, 0.12)",
                        borderRadius: 16,
                        padding: "0.85rem 1rem"
                      }}
                    >
                      <summary style={{ cursor: "pointer", fontWeight: 700, color: "#2e2619" }}>
                        {fan.professionName} · {fan.reachableSkills.length} reachable skills
                      </summary>
                      <div style={{ display: "grid", gap: "0.8rem", marginTop: "0.8rem" }}>
                        <div>
                          <div style={{ color: "#5f543a", fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Core groups
                          </div>
                          {fan.coreGroups.length ? (
                            <div style={{ display: "grid", gap: "0.55rem" }}>
                              {fan.coreGroups.map((group) => (
                                <div key={group.groupName} style={{ color: "#4f4635", lineHeight: 1.45 }}>
                                  <strong>{group.groupName}</strong>
                                  <div>Core: {summarizeList(group.coreSkills, 4)}</div>
                                  {group.optionalSkills.length ? <div>Optional: {summarizeList(group.optionalSkills, 4)}</div> : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: "#8a7e63" }}>No core groups modeled.</div>
                          )}
                        </div>

                        <div>
                          <div style={{ color: "#5f543a", fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Optional groups
                          </div>
                          {fan.optionalGroups.length ? (
                            <div style={{ display: "grid", gap: "0.55rem" }}>
                              {fan.optionalGroups.map((group) => (
                                <div key={group.groupName} style={{ color: "#4f4635", lineHeight: 1.45 }}>
                                  <strong>{group.groupName}</strong>
                                  <div>Core: {summarizeList(group.coreSkills, 4)}</div>
                                  {group.optionalSkills.length ? <div>Optional: {summarizeList(group.optionalSkills, 4)}</div> : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ color: "#8a7e63" }}>No optional groups modeled.</div>
                          )}
                        </div>

                        <div>
                          <div style={{ color: "#5f543a", fontSize: "0.82rem", fontWeight: 700, marginBottom: "0.3rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            Total reachable skills
                          </div>
                          <div style={{ color: "#4f4635", lineHeight: 1.45 }}>
                            {summarizeList(fan.reachableSkills, 8)}
                          </div>
                        </div>
                      </div>
                    </details>
                  ))
                ) : (
                  <div style={{ color: "#8a7e63" }}>No profession fan is available for this row yet.</div>
                )}
              </div>

              <div style={{ color: "#5f543a", fontSize: "0.92rem", lineHeight: 1.5 }}>
                <Link href="/admin/professions" style={{ color: "#7e5d2a", fontWeight: 700 }}>
                  Open professions inspector
                </Link>
                {" "}
                to review the profession packages this access row unlocks.
              </div>
            </div>
          </AdminPanel>

          <AdminPanel
            subtitle="The society name is shared across all bands for a society id, so saving that field propagates to the sibling rows automatically."
            title={`Edit ${selectedSocietyLevel.societyName} L${selectedSocietyLevel.societyLevel}`}
          >
            {canEdit ? (
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
                  hint="This row's neutral access band within the society. It is distinct from the canonical 1–6 society level shown above."
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
            ) : (
              <AdminReadOnlyNotice message="Society access rows are readable for all signed-in users, while editing stays limited to Admin and GM roles." />
            )}
          </AdminPanel>
        </div>
      </div>
    </section>
  );
}
