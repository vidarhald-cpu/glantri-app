"use client";

import { useEffect, useMemo, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { downloadCsv } from "../../../../src/lib/admin/exporters";
import { buildSkillAdminRows } from "../../../../src/lib/admin/viewModels";
import {
  AdminButton,
  AdminField,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
  AdminTagList
} from "../admin-ui";
import SkillsWorkspaceTabs from "./SkillsWorkspaceTabs";

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

const skillsReviewGridTemplate =
  "minmax(11rem, 0.95fr) minmax(20rem, 1.75fr) 5.5rem minmax(9rem, 0.9fr) minmax(10rem, 0.95fr) minmax(9rem, 0.85fr) minmax(10rem, 0.9fr) minmax(10rem, 0.85fr) 5.5rem";

function SkillsReviewTable(props: {
  onInspect: (rowId: string) => void;
  rows: ReturnType<typeof buildSkillAdminRows>;
  selectedId?: string;
}) {
  if (props.rows.length === 0) {
    return <div style={{ color: "#6d624d", padding: "1rem" }}>No skills found.</div>;
  }

  return (
    <div
      style={{
        border: "1px solid rgba(85, 73, 48, 0.12)",
        borderRadius: 18,
        maxHeight: "70vh",
        overflow: "auto",
        position: "relative"
      }}
    >
      <div style={{ minWidth: 1080 }}>
        <div
          style={{
            background: "rgba(126, 93, 42, 0.08)",
            borderBottom: "1px solid rgba(85, 73, 48, 0.1)",
            display: "grid",
            gridTemplateColumns: skillsReviewGridTemplate,
            position: "sticky",
            top: 0,
            zIndex: 2
          }}
        >
          {["Skill", "Description", "Type", "Skill category", "Primary Group", "Cross-listed", "Professions", "Dependencies", "Inspect"].map(
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
                gridTemplateColumns: skillsReviewGridTemplate
              }}
            >
              <div style={{ padding: "0.9rem 0.8rem" }}>
                <div style={{ color: "#2e2619", fontWeight: 700 }}>{row.name}</div>
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.shortDescription ? renderClampedCell(row.shortDescription, 2) : <span style={{ color: "#8a7e63" }}>None</span>}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem", textTransform: "capitalize" }}>{row.skillType}</div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem", textTransform: "capitalize" }}>
                {row.skillCategory.replaceAll("-", " ")}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.primaryGroup || <span style={{ color: "#8a7e63" }}>None</span>}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.optionalGroupCount > 0
                  ? renderClampedCell(summarizeList(row.optionalGroupNames, 2), 2)
                  : <span style={{ color: "#8a7e63" }}>None</span>}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {renderClampedCell(summarizeList(row.professionNames, 3), 2)}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {renderClampedCell(summarizeList(row.dependencies, 2), 2)}
              </div>
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

export default function SkillsAdminPage() {
  const { content } = useAdminContent();
  const allRows = buildSkillAdminRows(content);
  const [skillCategoryFilter, setSkillCategoryFilter] = useState("all");
  const [selectedSkillId, setSelectedSkillId] = useState<string>();
  const skillCategoryOptions = useMemo(
    () => ["all", ...new Set(allRows.map((row) => row.skillCategory))],
    [allRows]
  );
  const rows = useMemo(
    () =>
      allRows.filter((row) =>
        skillCategoryFilter === "all" ? true : row.skillCategory === skillCategoryFilter
      ),
    [allRows, skillCategoryFilter]
  );

  const selectedSkill =
    content.skills.find((skill) => skill.id === selectedSkillId) ??
    content.skills.slice().sort((left, right) => left.sortOrder - right.sortOrder)[0];
  const selectedRow = allRows.find((row) => row.id === selectedSkill.id);

  useEffect(() => {
    if (!selectedSkillId && rows[0]) {
      setSelectedSkillId(rows[0].id);
    }
  }, [rows, selectedSkillId]);

  useEffect(() => {
    if (selectedSkill) {
      setSelectedSkillId(selectedSkill.id);
    }
  }, [selectedSkill]);

  if (!selectedSkill) {
    return (
      <AdminPanel title="Skills">
        <div>No skill definitions are available in the current canonical content.</div>
      </AdminPanel>
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
                  { header: "Type", value: (row) => row.skillType },
                  { header: "Skill Category", value: (row) => row.skillCategory },
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

      <AdminPanel
        subtitle="Skill category comes from the canonical explicit category field used by chargen and other player-facing views. Type remains the mechanical ordinary / secondary field."
        title="Review filters"
      >
        <div style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: "minmax(220px, 280px)" }}>
          <AdminField label="Skill category">
            <AdminSelect
              onChange={(event) => setSkillCategoryFilter(event.target.value)}
              value={skillCategoryFilter}
            >
              {skillCategoryOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All categories" : option.replaceAll("-", " ")}
                </option>
              ))}
            </AdminSelect>
          </AdminField>
        </div>
      </AdminPanel>

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "minmax(0, 2.35fr) minmax(340px, 1fr)"
        }}
      >
        <AdminPanel
          subtitle="The table centers the canonical skill model rather than derived profession or society reach. Select a skill to inspect its structure, category, and rule-facing relationships."
          title="Skill Catalog"
        >
          <SkillsReviewTable onInspect={setSelectedSkillId} rows={rows} selectedId={selectedSkill.id} />
        </AdminPanel>

        <div style={{ display: "grid", gap: "1rem" }}>
          <AdminPanel
            subtitle="This inspector keeps the explicit membership system readable at a glance: primary group, cross-listed memberships, player-facing skill category, and the structural links that shape broader profession and society reach."
            title={selectedSkill.name}
          >
            <div style={{ display: "grid", gap: "0.85rem" }}>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                <AdminMetric label="Society level" value={`L${selectedRow?.societyLevel ?? selectedSkill.societyLevel}`} />
                <AdminMetric label="Cross-listed groups" value={selectedRow?.optionalGroupCount ?? 0} />
                <AdminMetric label="Professions" value={selectedRow?.professionNames.length ?? 0} />
                <AdminMetric label="Foundational access" value={selectedRow?.foundationalAccessBandsSummary ?? "—"} />
              </div>

              <div
                style={{
                  background: "rgba(126, 93, 42, 0.07)",
                  border: "1px solid rgba(85, 73, 48, 0.12)",
                  borderRadius: 16,
                  display: "grid",
                  gap: "0.25rem",
                  padding: "0.85rem 1rem"
                }}
              >
                <div><strong>Primary group:</strong> {selectedRow?.primaryGroup || "None"}</div>
                <div><strong>Skill category:</strong> {selectedRow?.skillCategory.replaceAll("-", " ")}</div>
                <div><strong>Cross-listed groups:</strong> {selectedRow?.optionalGroupNames.join(", ") || "None"}</div>
                <div><strong>Characteristics:</strong> {selectedRow?.characteristics || "None"}</div>
                <div><strong>Type:</strong> {selectedRow?.skillType}</div>
              </div>

              <div>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Cross-listed groups
                </div>
                {(selectedRow?.optionalGroupNames.length ?? 0) > 0 ? (
                  <AdminTagList values={selectedRow?.optionalGroupNames ?? []} />
                ) : (
                  <div style={{ color: "#8a7e63" }}>No optional or cross-listed group memberships.</div>
                )}
              </div>

              <div>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Profession reach
                </div>
                {(selectedRow?.professionNames.length ?? 0) > 0 ? (
                  <AdminTagList values={selectedRow?.professionNames ?? []} />
                ) : (
                  <div style={{ color: "#8a7e63" }}>No profession package currently reaches this skill.</div>
                )}
              </div>

              <div>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.45rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Access overview
                </div>
                {(selectedRow?.foundationalAccessSlots.length ?? 0) > 0 ? (
                  <div
                    style={{
                      border: "1px solid rgba(85, 73, 48, 0.12)",
                      borderRadius: 16,
                      overflow: "hidden"
                    }}
                  >
                    <div
                      style={{
                        background: "rgba(126, 93, 42, 0.08)",
                        display: "grid",
                        gridTemplateColumns: "minmax(11rem, 1.15fr) repeat(4, minmax(0, 1fr))"
                      }}
                    >
                      {["Society", "L1", "L2", "L3", "L4"].map((header) => (
                        <div
                          key={header}
                          style={{
                            color: "#594320",
                            fontSize: "0.78rem",
                            fontWeight: 700,
                            letterSpacing: "0.08em",
                            padding: "0.7rem 0.65rem",
                            textTransform: "uppercase"
                          }}
                        >
                          {header}
                        </div>
                      ))}
                    </div>
                    {[...new Set((selectedRow?.foundationalAccessSlots ?? []).map((slot) => slot.societyName))]
                      .sort((left, right) => left.localeCompare(right))
                      .map((societyName) => {
                        const societySlots =
                          selectedRow?.foundationalAccessSlots.filter(
                            (slot) => slot.societyName === societyName
                          ) ?? [];
                        const canonicalLevel = societySlots[0]?.canonicalSocietyLevel;

                        return (
                          <div
                            key={societyName}
                            style={{
                              borderTop: "1px solid rgba(85, 73, 48, 0.08)",
                              display: "grid",
                              gridTemplateColumns: "minmax(11rem, 1.15fr) repeat(4, minmax(0, 1fr))"
                            }}
                          >
                            <div
                              style={{
                                color: "#4d412d",
                                fontSize: "0.85rem",
                                fontWeight: 700,
                                lineHeight: 1.4,
                                padding: "0.7rem 0.65rem"
                              }}
                            >
                              {societyName}
                              <div style={{ color: "#8a7e63", fontSize: "0.78rem", fontWeight: 600 }}>
                                {canonicalLevel ? `S${canonicalLevel}` : "Society"}
                              </div>
                            </div>
                            {Array.from({ length: 4 }, (_, bandIndex) => bandIndex + 1).map((accessBand) => {
                              const isAccessible = societySlots.some(
                                (slot) => slot.accessBand === accessBand
                              );

                              return (
                                <div
                                  key={`${societyName}:${accessBand}`}
                                  style={{
                                    alignItems: "center",
                                    background: isAccessible
                                      ? "rgba(86, 112, 67, 0.13)"
                                      : "rgba(255, 255, 255, 0.55)",
                                    color: isAccessible ? "#36512b" : "#9b9077",
                                    display: "flex",
                                    justifyContent: "center",
                                    minHeight: "2.7rem",
                                    padding: "0.45rem",
                                    textAlign: "center"
                                  }}
                                  title={
                                    isAccessible
                                      ? `${selectedSkill.name} is accessible for main skill-point spending in ${societyName} at band L${accessBand}.`
                                      : `${selectedSkill.name} is not accessible in ${societyName} at band L${accessBand}.`
                                  }
                                >
                                  <span style={{ fontWeight: isAccessible ? 700 : 500 }}>
                                    {isAccessible ? "Yes" : "—"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                  </div>
                ) : (
                  <div style={{ color: "#8a7e63" }}>
                    No society-band foundational access is currently modeled for this skill.
                  </div>
                )}
                {(selectedRow?.foundationalAccessSlots.length ?? 0) > 0 ? (
                  <div style={{ color: "#7a6f5a", fontSize: "0.88rem", lineHeight: 1.45, marginTop: "0.45rem" }}>
                    This marks access for main skill-point spending, not a free grant.
                  </div>
                ) : null}
              </div>

              <div>
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Structural links
                </div>
                <div style={{ display: "grid", gap: "0.45rem" }}>
                  <div><strong>Dependencies:</strong> {summarizeList(selectedRow?.dependencies ?? [], 4)}</div>
                  <div><strong>Secondary of:</strong> {selectedRow?.secondaryOf || "None"}</div>
                  <div><strong>Specialization of:</strong> {selectedRow?.specializationOf || "None"}</div>
                </div>
              </div>
            </div>
          </AdminPanel>

        </div>
      </div>
    </section>
  );
}
