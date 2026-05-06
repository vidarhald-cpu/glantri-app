"use client";

import { useMemo, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import {
  buildSocietyAuditIssues,
  buildSocietyMatrixRows,
  type SocietyAuditIssue,
  type SocietyMatrixRow
} from "../../../../src/lib/admin/viewModels";
import {
  AdminAuditLegend,
  AdminDataTable,
  AdminField,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
  AdminStatusBadge,
  AdminTagList,
  getAuditSeverityTone
} from "../admin-ui";
import SocietiesWorkspaceTabs from "./SocietiesWorkspaceTabs";

type DirectOverrideFilter = "all" | "with-overrides" | "without-overrides";
type GroupByOption = "none" | "society" | "level" | "reach-band";
type ReachFilter = "all" | "broad" | "medium" | "narrow";
type WarningNoiseFilter = "all" | "focused";

function getGroupLabel(row: SocietyMatrixRow, groupBy: GroupByOption): string {
  if (groupBy === "society") {
    return row.society;
  }

  if (groupBy === "level") {
    return `Level ${row.societyLevel}`;
  }

  if (groupBy === "reach-band") {
    return `${row.reachBand[0].toUpperCase()}${row.reachBand.slice(1)} reach`;
  }

  return "All visible society rows";
}

function countIssuesBySeverity(
  issues: SocietyAuditIssue[],
  severity: SocietyAuditIssue["severity"]
): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

export default function SocietyMatrixAdminPage() {
  const { content } = useAdminContent();
  const rows = useMemo(() => buildSocietyMatrixRows(content), [content]);
  const auditIssues = useMemo(() => buildSocietyAuditIssues(content), [content]);
  const [societyFilter, setSocietyFilter] = useState("all");
  const [levelFilter, setLevelFilter] = useState("all");
  const [professionAccessFilter, setProfessionAccessFilter] = useState("all");
  const [directOverrideFilter, setDirectOverrideFilter] =
    useState<DirectOverrideFilter>("all");
  const [reachFilter, setReachFilter] = useState<ReachFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupByOption>("society");
  const [warningNoiseFilter, setWarningNoiseFilter] =
    useState<WarningNoiseFilter>("focused");

  const societyOptions = useMemo(
    () => [...new Set(rows.map((row) => row.society))].sort((left, right) => left.localeCompare(right)),
    [rows]
  );
  const professionOptions = useMemo(
    () =>
      [...new Set(rows.flatMap((row) => row.reachableProfessions))].sort((left, right) =>
        left.localeCompare(right)
      ),
    [rows]
  );
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (societyFilter !== "all" && row.society !== societyFilter) {
          return false;
        }

        if (levelFilter !== "all" && String(row.societyLevel) !== levelFilter) {
          return false;
        }

        if (
          professionAccessFilter !== "all" &&
          !row.reachableProfessions.includes(professionAccessFilter)
        ) {
          return false;
        }

        if (directOverrideFilter === "with-overrides" && !row.hasDirectOverrides) {
          return false;
        }

        if (directOverrideFilter === "without-overrides" && row.hasDirectOverrides) {
          return false;
        }

        if (reachFilter !== "all" && row.reachBand !== reachFilter) {
          return false;
        }

        return true;
      }),
    [directOverrideFilter, levelFilter, professionAccessFilter, reachFilter, rows, societyFilter]
  );
  const visibleRowIdSet = useMemo(() => new Set(filteredRows.map((row) => row.id)), [filteredRows]);
  const filteredIssues = useMemo(
    () =>
      auditIssues.filter((issue) => {
        if (!visibleRowIdSet.has(issue.societyRowId)) {
          return false;
        }

        if (
          warningNoiseFilter === "focused" &&
          (issue.category === "Duplicate direct skills" ||
            issue.category === "Duplicate direct groups")
        ) {
          return false;
        }

        return true;
      }),
    [auditIssues, visibleRowIdSet, warningNoiseFilter]
  );
  const groupedRows = useMemo(() => {
    if (filteredRows.length === 0 || groupBy === "none") {
      return [
        {
          label: "All visible society rows",
          rows: filteredRows
        }
      ];
    }

    const grouped = new Map<string, SocietyMatrixRow[]>();

    for (const row of filteredRows) {
      const label = getGroupLabel(row, groupBy);
      const existing = grouped.get(label);

      if (existing) {
        existing.push(row);
        continue;
      }

      grouped.set(label, [row]);
    }

    return [...grouped.entries()]
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([label, societyRows]) => ({
        label,
        rows: societyRows
      }));
  }, [filteredRows, groupBy]);

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Societies / Matrix"
        summary="This read-first workspace treats each society/class row as a profession-centric access layer, so we can review how profession packages, direct overrides, education, and level progression combine into effective reach."
        title="Society Matrix Audit"
      />

      <SocietiesWorkspaceTabs />

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
        }}
      >
        <AdminMetric hint="Society rows visible after filters" label="Visible Rows" value={filteredRows.length} />
        <AdminMetric
          hint="Fix these before trusting the society layer as stable orchestration over profession packages"
          label="Blocking"
          value={countIssuesBySeverity(filteredIssues, "blocking")}
        />
        <AdminMetric
          hint="Warnings in the current filtered audit slice"
          label="Warnings"
          value={countIssuesBySeverity(filteredIssues, "warning")}
        />
        <AdminMetric
          hint="Informational review notes in the current filtered audit slice"
          label="Info"
          value={countIssuesBySeverity(filteredIssues, "info")}
        />
        <AdminMetric
          hint="Visible rows with direct group or skill overrides"
          label="Direct Overrides"
          value={filteredRows.filter((row) => row.hasDirectOverrides).length}
        />
      </div>

      <AdminPanel
        subtitle="Filter by society, level, profession access, override presence, and reach profile, then regroup rows to inspect progression and override patterns."
        title="Filters"
      >
        <div
          style={{
            display: "grid",
            gap: "0.9rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))"
          }}
        >
          <AdminField label="Society">
            <AdminSelect onChange={(event) => setSocietyFilter(event.target.value)} value={societyFilter}>
              <option value="all">All</option>
              {societyOptions.map((society) => (
                <option key={society} value={society}>
                  {society}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField label="Level">
            <AdminSelect onChange={(event) => setLevelFilter(event.target.value)} value={levelFilter}>
              <option value="all">All</option>
              {["1", "2", "3", "4", "5", "6"].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField label="Profession access">
            <AdminSelect
              onChange={(event) => setProfessionAccessFilter(event.target.value)}
              value={professionAccessFilter}
            >
              <option value="all">All</option>
              {professionOptions.map((profession) => (
                <option key={profession} value={profession}>
                  {profession}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField label="Direct overrides">
            <AdminSelect
              onChange={(event) =>
                setDirectOverrideFilter(event.target.value as DirectOverrideFilter)
              }
              value={directOverrideFilter}
            >
              <option value="all">All</option>
              <option value="with-overrides">With overrides</option>
              <option value="without-overrides">Without overrides</option>
            </AdminSelect>
          </AdminField>

          <AdminField label="Reach profile">
            <AdminSelect
              onChange={(event) => setReachFilter(event.target.value as ReachFilter)}
              value={reachFilter}
            >
              <option value="all">All</option>
              <option value="broad">Broad</option>
              <option value="medium">Medium</option>
              <option value="narrow">Narrow</option>
            </AdminSelect>
          </AdminField>

          <AdminField label="Group rows by">
            <AdminSelect onChange={(event) => setGroupBy(event.target.value as GroupByOption)} value={groupBy}>
              <option value="none">No grouping</option>
              <option value="society">Society</option>
              <option value="level">Level</option>
              <option value="reach-band">Reach band</option>
            </AdminSelect>
          </AdminField>

          <AdminField label="Warning clutter">
            <AdminSelect
              onChange={(event) => setWarningNoiseFilter(event.target.value as WarningNoiseFilter)}
              value={warningNoiseFilter}
            >
              <option value="focused">Hide duplicate direct skill/group noise</option>
              <option value="all">Show all warnings</option>
            </AdminSelect>
          </AdminField>
        </div>
      </AdminPanel>

      <AdminPanel
        subtitle="These helpers treat society rows as profession-centric orchestration: fix empty or contradictory rows first, then review override duplication, progression, and education signals."
        title="Audit Helpers"
      >
        <div style={{ marginBottom: "1rem" }}>
          <AdminAuditLegend />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          {filteredIssues.length === 0 ? (
            <AdminStatusBadge tone="success">No audit issues for the current filters</AdminStatusBadge>
          ) : (
            [...new Set(filteredIssues.map((issue) => issue.category))]
              .sort((left, right) => left.localeCompare(right))
              .map((category) => {
                const categoryIssues = filteredIssues.filter((issue) => issue.category === category);
                const count = categoryIssues.length;
                const categorySeverity = categoryIssues.some((issue) => issue.severity === "blocking")
                  ? "blocking"
                  : categoryIssues.some((issue) => issue.severity === "warning")
                    ? "warning"
                    : "info";

                return (
                  <AdminStatusBadge key={category} tone={getAuditSeverityTone(categorySeverity)}>
                    {category}: {count}
                  </AdminStatusBadge>
                );
              })
          )}
        </div>

        <AdminDataTable
          columns={[
            {
              header: "Severity",
              render: (issue) => (
                <AdminStatusBadge tone={getAuditSeverityTone(issue.severity)}>
                  {issue.severity}
                </AdminStatusBadge>
              ),
              width: "9rem"
            },
            {
              header: "Category",
              render: (issue) => issue.category,
              width: "14rem"
            },
            {
              header: "Society Row",
              render: (issue) => <strong>{issue.societyRowName}</strong>,
              width: "16rem"
            },
            {
              header: "Review Note",
              render: (issue) => issue.detail,
              width: "24rem"
            },
            {
              header: "Related Entries",
              render: (issue) => <AdminTagList values={issue.relatedEntries} />,
              width: "16rem"
            }
          ]}
          emptyState="No society audit issues match the current filters."
          rows={filteredIssues}
        />
      </AdminPanel>

      {groupedRows.map((group) => (
        <AdminPanel
          key={group.label}
          subtitle={`${group.rows.length} society row${group.rows.length === 1 ? "" : "s"} in this slice.`}
          title={group.label}
        >
          <AdminDataTable
            columns={[
              {
                header: "Society",
                render: (row) => <strong>{row.society}</strong>,
                width: "12rem"
              },
              {
                header: "Level / Band",
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
                render: (row) => <AdminTagList values={row.reachableProfessions} />,
                width: "15rem"
              },
              {
                header: "Direct Skill Groups",
                render: (row) => <AdminTagList values={row.directSkillGroups} />,
                width: "15rem"
              },
              {
                header: "Direct Skills",
                render: (row) => <AdminTagList values={row.directSkills} />,
                width: "15rem"
              },
              {
                header: "Total Effective Reach",
                render: (row) => row.totalEffectiveReachableSkills
              },
              {
                header: "Profession-Derived Reach",
                render: (row) => <AdminTagList values={row.effectiveProfessionSkills} />,
                width: "16rem"
              },
              {
                header: "Direct Society-Added Reach",
                render: (row) => <AdminTagList values={row.directOnlySkills} />,
                width: "16rem"
              },
              {
                header: "Notes",
                render: (row) => row.notes || <span style={{ color: "#8a7e63" }}>None</span>
              }
            ]}
            emptyState="No society rows match this grouping."
            rows={group.rows}
          />
        </AdminPanel>
      ))}
    </section>
  );
}
