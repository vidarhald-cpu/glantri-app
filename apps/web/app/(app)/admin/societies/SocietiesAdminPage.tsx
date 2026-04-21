"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { downloadCsv } from "../../../../src/lib/admin/exporters";
import { buildSocietyAdminRows } from "../../../../src/lib/admin/viewModels";
import {
  AdminButton,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminTagList
} from "../admin-ui";
import SocietiesWorkspaceTabs from "./SocietiesWorkspaceTabs";

function createSocietyRowId(input: { societyId: string; societyLevel: number }): string {
  return `${input.societyId}:${input.societyLevel}`;
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

function renderClampedCell(text: string, options?: { lines?: number; width?: string }) {
  return (
    <span
      style={{
        color: "#4f4635",
        display: "-webkit-box",
        lineHeight: 1.45,
        maxWidth: options?.width ?? "100%",
        overflow: "hidden",
        WebkitBoxOrient: "vertical",
        WebkitLineClamp: options?.lines ?? 2
      }}
      title={text}
    >
      {text}
    </span>
  );
}

const societiesReviewGridTemplate =
  "minmax(10rem, 1.1fr) 3.5rem 3.75rem 8rem 4rem 5.25rem minmax(24rem, 2.5fr) minmax(9rem, 0.95fr) minmax(8rem, 0.9fr) minmax(15rem, 1.45fr) 4.5rem";

function SocietiesReviewTable(props: {
  onInspect: (rowId: string) => void;
  rows: ReturnType<typeof buildSocietyAdminRows>;
  selectedId?: string;
}) {
  if (props.rows.length === 0) {
    return <div style={{ color: "#6d624d", padding: "1rem" }}>No society rows found.</div>;
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
      <div style={{ minWidth: 1360 }}>
        <div
          style={{
            background: "rgba(126, 93, 42, 0.08)",
            borderBottom: "1px solid rgba(85, 73, 48, 0.1)",
            display: "grid",
            gridTemplateColumns: societiesReviewGridTemplate,
            position: "sticky",
            top: 0,
            zIndex: 2
          }}
        >
          {[
            "Society",
            "Level",
            "Band",
            "Class",
            "Edu",
            "Literacy",
            "Description",
            "Historical Ref.",
            "Glantri Examples",
            "Professions",
            "Inspect"
          ].map((header) => (
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
          ))}
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
                gridTemplateColumns: societiesReviewGridTemplate
              }}
            >
              <div style={{ color: "#2e2619", fontWeight: 700, padding: "0.9rem 0.8rem" }}>{row.society}</div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.canonicalSocietyLevel ?? <span style={{ color: "#8a7e63" }}>None</span>}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>{`L${row.societyLevel}`}</div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {renderClampedCell(row.societyClassName, { lines: 2 })}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.baseEducation || <span style={{ color: "#8a7e63" }}>None</span>}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.literacyAccessSummary}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.shortDescription || row.notes ? (
                  renderClampedCell(summarizeText(row.shortDescription || row.notes, 220), {
                    lines: 2
                  })
                ) : (
                  <span style={{ color: "#8a7e63" }}>None</span>
                )}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.historicalReference ? (
                  renderClampedCell(summarizeText(row.historicalReference, 90), { lines: 2 })
                ) : (
                  <span style={{ color: "#8a7e63" }}> </span>
                )}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.glantriExamples ? (
                  renderClampedCell(summarizeText(row.glantriExamples, 90), { lines: 2 })
                ) : (
                  <span style={{ color: "#8a7e63" }}> </span>
                )}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {renderClampedCell(summarizeList(row.reachableProfessions, 5), { lines: 2 })}
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

export default function SocietiesAdminPage() {
  const { content } = useAdminContent();
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
    content.societyLevels.find((societyLevel) => {
      return (
        createSocietyRowId({
          societyId: societyLevel.societyId,
          societyLevel: societyLevel.societyLevel
        }) === rows[0]?.id
      );
    }) ??
    content.societyLevels
      .slice()
      .sort((left, right) => left.societyName.localeCompare(right.societyName) || left.societyLevel - right.societyLevel)[0];

  useEffect(() => {
    if (!selectedRowId && rows[0]) {
      setSelectedRowId(rows[0].id);
    }
  }, [rows, selectedRowId]);

  if (!selectedSocietyLevel) {
    return (
      <AdminPanel title="Societies">
        <div>No society/social-class rows found.</div>
      </AdminPanel>
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

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 2.8fr) minmax(340px, 1fr)" }}>
        <AdminPanel title="Society Access Review">
          <SocietiesReviewTable
            onInspect={setSelectedRowId}
            rows={rows}
            selectedId={selectedRowDisplayId}
          />
        </AdminPanel>

        <div style={{ display: "grid", gap: "1rem" }}>
          <AdminPanel
            subtitle={
              selectedRow?.shortDescription?.trim() ||
              selectedRow?.notes?.trim() ||
              "No canonical society description recorded."
            }
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
        </div>
      </div>
    </section>
  );
}
