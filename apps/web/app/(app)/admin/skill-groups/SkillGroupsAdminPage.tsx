"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { downloadCsv } from "../../../../src/lib/admin/exporters";
import { buildSkillGroupAdminRows } from "../../../../src/lib/admin/viewModels";
import {
  AdminButton,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminTagList
} from "../admin-ui";
import SkillGroupsWorkspaceTabs from "./SkillGroupsWorkspaceTabs";

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

function renderMembershipLabel(skill: { name: string; relevance: "core" | "optional" }) {
  return `${skill.name}${skill.relevance === "optional" ? " (secondary membership)" : ""}`;
}

function renderSlotSummary(slot: {
  candidateSkills: string[];
  chooseCount: number;
  label: string;
  required: boolean;
}) {
  const requirement = slot.required ? "Required" : "Optional";
  return `${slot.label} • choose ${slot.chooseCount} • ${requirement}`;
}

const skillGroupsReviewGridTemplate =
  "minmax(11rem, 0.95fr) minmax(22rem, 1.8fr) 5.5rem 5.5rem 6rem minmax(11rem, 1fr) 5.5rem";

function SkillGroupsReviewTable(props: {
  onInspect: (rowId: string) => void;
  rows: ReturnType<typeof buildSkillGroupAdminRows>;
  selectedId?: string;
}) {
  if (props.rows.length === 0) {
    return <div style={{ color: "#6d624d", padding: "1rem" }}>No skill groups found.</div>;
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
      <div style={{ minWidth: 980 }}>
        <div
          style={{
            background: "rgba(126, 93, 42, 0.08)",
            borderBottom: "1px solid rgba(85, 73, 48, 0.1)",
            display: "grid",
            gridTemplateColumns: skillGroupsReviewGridTemplate,
            position: "sticky",
            top: 0,
            zIndex: 2
          }}
        >
          {["Group", "Description", "Fixed", "Slots", "Points", "Professions", "Inspect"].map(
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
          const warningText =
            row.warningDetails.length > 0
              ? `${row.warningDetails.length} warning${row.warningDetails.length === 1 ? "" : "s"}`
              : "Healthy";

          return (
            <div
              key={row.id}
              onClick={() => props.onInspect(row.id)}
              style={{
                background: selected ? "rgba(215, 226, 216, 0.72)" : "transparent",
                borderTop: "1px solid rgba(85, 73, 48, 0.1)",
                cursor: "pointer",
                display: "grid",
                gridTemplateColumns: skillGroupsReviewGridTemplate
              }}
            >
              <div style={{ padding: "0.9rem 0.8rem" }}>
                <div style={{ color: "#2e2619", fontWeight: 700 }}>{row.name}</div>
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                {row.notes ? renderClampedCell(row.notes, 2) : <span style={{ color: "#8a7e63" }}>None</span>}
              </div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>{row.fixedSkills.length}</div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>{row.selectionSlotCount}</div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>{row.weightedContentPoints} pts</div>
              <div style={{ color: "#2e2619", padding: "0.9rem 0.8rem" }}>
                <div style={{ alignItems: "center", display: "grid", gap: "0.25rem" }}>
                  <span>
                    {renderClampedCell(
                      row.selectionSlotCount > 0
                        ? `${summarizeList(row.allowedProfessions, 2)} • ${row.selectionSlotCount} slot${row.selectionSlotCount === 1 ? "" : "s"}`
                        : summarizeList(row.allowedProfessions, 3),
                      2
                    )}
                  </span>
                  <span style={{ color: row.warningDetails.length ? "#8a3b2f" : "#46613a", fontSize: "0.82rem", fontWeight: 700 }}>
                    {warningText}
                  </span>
                </div>
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

export default function SkillGroupsAdminPage() {
  const { content } = useAdminContent();
  const rows = buildSkillGroupAdminRows(content);
  const [selectedGroupId, setSelectedGroupId] = useState<string>();
  const selectedGroup =
    content.skillGroups.find((group) => group.id === selectedGroupId) ??
    content.skillGroups.find((group) => group.id === rows[0]?.id) ??
    content.skillGroups.slice().sort((left, right) => left.name.localeCompare(right.name))[0];
  const selectedRow = rows.find((row) => row.id === selectedGroup.id);

  useEffect(() => {
    if (!selectedGroupId && rows[0]) {
      setSelectedGroupId(rows[0].id);
    }
  }, [rows, selectedGroupId]);

  if (!selectedGroup) {
    return (
      <AdminPanel title="Skill Groups">
        <div>No skill groups found.</div>
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
                  { header: "Sort Order", value: (row) => row.sortOrder },
                  { header: "Fixed Skills", value: (row) => row.fixedSkillNames.join(" | ") },
                  {
                    header: "Selection Slots",
                    value: (row) => row.selectionSlots.map((slot) => `${slot.label} [${slot.chooseCount}]`).join(" | ")
                  },
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
        summary="Skill groups are the structural layer that professions and societies point at most often. This workspace keeps fixed memberships, slot-based choices, and validation warnings visible for review."
        title="Skill Groups"
      />

      <SkillGroupsWorkspaceTabs />

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 2.2fr) minmax(340px, 1fr)" }}>
        <AdminPanel title="Group Catalog">
          <SkillGroupsReviewTable onInspect={setSelectedGroupId} rows={rows} selectedId={selectedGroup.id} />
        </AdminPanel>

        <div style={{ display: "grid", gap: "1rem" }}>
          <AdminPanel
            subtitle={selectedGroup.description?.trim() || "No canonical skill-group description recorded."}
            title={selectedGroup.name}
          >
            <div style={{ display: "grid", gap: "0.85rem" }}>
              <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))" }}>
                <AdminMetric label="Fixed skills" value={selectedRow?.fixedSkills.length ?? 0} />
                <AdminMetric label="Selection slots" value={selectedRow?.selectionSlotCount ?? 0} />
                <AdminMetric label="Weighted size" value={`${selectedRow?.weightedContentPoints ?? 0} pts`} />
              </div>

              <div
                style={{
                  background: "rgba(126, 93, 42, 0.07)",
                  border: "1px solid rgba(85, 73, 48, 0.12)",
                  borderRadius: 16,
                  color: "#5b5036",
                  fontSize: "0.92rem",
                  lineHeight: 1.5,
                  padding: "0.85rem 1rem"
                }}
              >
                {(selectedRow?.fixedSkills.length ?? 0) === 0
                  ? "No fixed skills are attached to this group."
                  : `${selectedRow?.fixedSkills.length ?? 0} fixed skill${(selectedRow?.fixedSkills.length ?? 0) === 1 ? "" : "s"} contribute `}
                {(selectedRow?.fixedSkills.length ?? 0) > 0 ? <strong>{selectedRow?.weightedContentPoints ?? 0} weighted points</strong> : null}
                {(selectedRow?.selectionSlotCount ?? 0) > 0
                  ? `, with ${selectedRow?.selectionSlotCount ?? 0} selection slot${(selectedRow?.selectionSlotCount ?? 0) === 1 ? "" : "s"} layered on top.`
                  : (selectedRow?.fixedSkills.length ?? 0) > 0
                    ? "."
                    : ""}
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
                  No audit warnings for this skill group.
                </div>
              )}

              <div style={{ display: "grid", gap: "0.85rem" }}>
                <div>
                  <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Fixed skills
                  </div>
                  {selectedRow?.fixedSkills.length ? (
                    <AdminTagList values={selectedRow.fixedSkills.map(renderMembershipLabel)} />
                  ) : (
                    <div style={{ color: "#8a7e63" }}>No fixed skills in this group.</div>
                  )}
                </div>

                <div>
                  <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                    Selection slots
                  </div>
                  {selectedRow?.selectionSlots.length ? (
                    <div style={{ display: "grid", gap: "0.75rem" }}>
                      {selectedRow.selectionSlots.map((slot) => (
                        <div
                          key={slot.id}
                          style={{
                            background: "rgba(126, 93, 42, 0.06)",
                            border: "1px solid rgba(85, 73, 48, 0.12)",
                            borderRadius: 14,
                            display: "grid",
                            gap: "0.45rem",
                            padding: "0.75rem 0.9rem"
                          }}
                        >
                          <div style={{ color: "#2e2619", fontWeight: 700 }}>{renderSlotSummary(slot)}</div>
                          <div style={{ color: "#5b5036", fontSize: "0.92rem", lineHeight: 1.5 }}>
                            Candidates: {slot.candidateSkills.join(", ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div style={{ color: "#8a7e63" }}>No selection slots in this group.</div>
                  )}
                </div>

                {selectedRow?.optionalSkills.length ? (
                  <div>
                    <div style={{ color: "#5f543a", fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.35rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                      Secondary fixed memberships
                    </div>
                    <AdminTagList values={selectedRow.optionalSkills} />
                  </div>
                ) : null}

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
        </div>
      </div>
    </section>
  );
}
