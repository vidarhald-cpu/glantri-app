"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { downloadCsv } from "../../../../src/lib/admin/exporters";
import {
  buildProfessionAdminRows,
  buildProfessionFamilyFilterOptions,
  getProfessionFamilyName
} from "../../../../src/lib/admin/viewModels";
import {
  AdminButton,
  AdminField,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
  AdminTagList
} from "../admin-ui";
import ProfessionsWorkspaceTabs from "./ProfessionsWorkspaceTabs";

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
  "minmax(11rem, 0.95fr) minmax(8rem, 0.75fr) minmax(22rem, 1.95fr) minmax(10rem, 0.95fr) minmax(10rem, 0.95fr) minmax(12rem, 1fr) 5rem 5.5rem";

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
            gridTemplateColumns: professionsReviewGridTemplate,
            position: "sticky",
            top: 0,
            zIndex: 2
          }}
        >
          {["Profession", "Family", "Description", "Core Groups", "Optional Groups", "Access", "Skills", "Inspect"].map(
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
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.familyName || <span style={{ color: "#8a7e63" }}>None</span>}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.description ? renderClampedCell(row.description, 2) : <span style={{ color: "#8a7e63" }}>None</span>}
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
  const { content } = useAdminContent();
  const allRows = buildProfessionAdminRows(content);
  const [familyFilter, setFamilyFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [selectedProfessionId, setSelectedProfessionId] = useState<string>();
  const familyOptions = buildProfessionFamilyFilterOptions(
    content,
    allRows.map((row) => row.familyId)
  );
  const groupOptions = [
    "all",
    ...new Set(allRows.flatMap((row) => row.grantedSkillGroups))
  ].sort((left, right) => {
    if (left === "all") {
      return -1;
    }

    if (right === "all") {
      return 1;
    }

    return left.localeCompare(right);
  });
  const rows = allRows.filter((row) => {
    if (familyFilter !== "all" && row.familyId !== familyFilter) {
      return false;
    }

    if (groupFilter !== "all" && !row.grantedSkillGroups.includes(groupFilter)) {
      return false;
    }

    return true;
  });
  const selectedVisibleRow = rows.find((row) => row.id === selectedProfessionId) ?? rows[0];
  const selectedProfession =
    content.professions.find(
      (profession) => profession.id === (selectedVisibleRow?.id ?? selectedProfessionId)
    ) ??
    content.professions.slice().sort((left, right) => left.name.localeCompare(right.name))[0];
  const selectedRow =
    selectedVisibleRow ?? allRows.find((row) => row.id === selectedProfession.id);

  useEffect(() => {
    if (!selectedProfessionId && rows[0]) {
      setSelectedProfessionId(rows[0].id);
    }
  }, [rows, selectedProfessionId]);

  if (!selectedProfession) {
    return (
      <AdminPanel title="Professions">
        <div>No professions found.</div>
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

      <AdminPanel title="Review filters">
        <div
          style={{
            display: "grid",
            gap: "0.9rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 280px))"
          }}
        >
          <AdminField label="Family">
            <AdminSelect
              onChange={(event) => setFamilyFilter(event.target.value)}
              value={familyFilter}
            >
              {familyOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all"
                    ? "All families"
                    : getProfessionFamilyName(content, option)}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField label="Group">
            <AdminSelect
              onChange={(event) => setGroupFilter(event.target.value)}
              value={groupFilter}
            >
              {groupOptions.map((option) => (
                <option key={option} value={option}>
                  {option === "all" ? "All groups" : option}
                </option>
              ))}
            </AdminSelect>
          </AdminField>
        </div>
      </AdminPanel>

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
            subtitle={selectedProfession.description?.trim() || "No canonical profession description recorded."}
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
                <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.45rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Access overview
                </div>
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
                      gridTemplateColumns: "5.75rem repeat(4, minmax(0, 1fr))"
                    }}
                  >
                    {["Level", "L1", "L2", "L3", "L4"].map((header) => (
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
                  {Array.from({ length: 6 }, (_, index) => index + 1).map((canonicalLevel) => (
                    <div
                      key={canonicalLevel}
                      style={{
                        borderTop: "1px solid rgba(85, 73, 48, 0.08)",
                        display: "grid",
                        gridTemplateColumns: "5.75rem repeat(4, minmax(0, 1fr))"
                      }}
                    >
                      <div
                        style={{
                          color: "#4d412d",
                          fontSize: "0.85rem",
                          fontWeight: 700,
                          padding: "0.7rem 0.65rem"
                        }}
                      >
                        S{canonicalLevel}
                      </div>
                      {Array.from({ length: 4 }, (_, bandIndex) => bandIndex + 1).map((accessBand) => {
                        const matchingSlots =
                          selectedRow?.allowedSocietySlots.filter(
                            (slot) =>
                              slot.canonicalSocietyLevel === canonicalLevel &&
                              slot.accessBand === accessBand
                          ) ?? [];
                        const isAllowed = matchingSlots.length > 0;

                        return (
                          <div
                            key={`${canonicalLevel}:${accessBand}`}
                            style={{
                              alignItems: "center",
                              background: isAllowed ? "rgba(86, 112, 67, 0.13)" : "rgba(255, 255, 255, 0.55)",
                              color: isAllowed ? "#36512b" : "#9b9077",
                              display: "flex",
                              justifyContent: "center",
                              minHeight: "2.7rem",
                              padding: "0.45rem",
                              textAlign: "center"
                            }}
                            title={
                              isAllowed
                                ? matchingSlots
                                    .map((slot) => `${slot.societyName} - ${slot.socialClass}`)
                                    .join("\n")
                                : `No access at society level ${canonicalLevel}, band L${accessBand}`
                            }
                          >
                            {isAllowed ? (
                              <span style={{ fontWeight: 700 }}>
                                Yes{matchingSlots.length > 1 ? ` (${matchingSlots.length})` : ""}
                              </span>
                            ) : (
                              <span>—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ color: "#5f543a", fontSize: "0.78rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Detailed access rows
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
        </div>
      </div>
    </section>
  );
}
