"use client";

import { useMemo, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import {
  buildProfessionAuditIssues,
  buildProfessionMatrixRows,
  type ProfessionAuditIssue,
  type ProfessionMatrixRow
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
import ProfessionsWorkspaceTabs from "./ProfessionsWorkspaceTabs";

type DirectExceptionFilter = "all" | "with-exceptions" | "without-exceptions";
type GroupByOption = "none" | "granted-group" | "reach-band" | "society-access";
type ReachFilter = "all" | "broad" | "medium" | "narrow";

function getGroupLabel(row: ProfessionMatrixRow, groupBy: GroupByOption): string {
  if (groupBy === "reach-band") {
    return `${row.reachBand[0].toUpperCase()}${row.reachBand.slice(1)} reach`;
  }

  if (groupBy === "granted-group") {
    if (row.grantedSkillGroups.length === 0) {
      return "No granted groups";
    }

    return row.grantedSkillGroups.length === 1
      ? row.grantedSkillGroups[0]
      : `Multiple groups: ${row.grantedSkillGroups.join(", ")}`;
  }

  if (groupBy === "society-access") {
    if (row.allowedSocietyEntries.length === 0) {
      return "No society access";
    }

    return row.allowedSocietyEntries.length === 1
      ? row.allowedSocietyEntries[0]
      : `Multiple society rows (${row.allowedSocietyEntries.length})`;
  }

  return "All visible professions";
}

function countIssuesBySeverity(
  issues: ProfessionAuditIssue[],
  severity: ProfessionAuditIssue["severity"]
): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

export default function ProfessionMatrixAdminPage() {
  const { content } = useAdminContent();
  const rows = useMemo(() => buildProfessionMatrixRows(content), [content]);
  const auditIssues = useMemo(() => buildProfessionAuditIssues(content), [content]);
  const [professionFilter, setProfessionFilter] = useState("all");
  const [grantedGroupFilter, setGrantedGroupFilter] = useState("all");
  const [societyAccessFilter, setSocietyAccessFilter] = useState("all");
  const [directExceptionFilter, setDirectExceptionFilter] =
    useState<DirectExceptionFilter>("all");
  const [reachFilter, setReachFilter] = useState<ReachFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupByOption>("reach-band");

  const grantedGroupOptions = useMemo(
    () =>
      [...new Set(rows.flatMap((row) => row.grantedSkillGroups))].sort((left, right) =>
        left.localeCompare(right)
      ),
    [rows]
  );
  const societyAccessOptions = useMemo(
    () =>
      [...new Set(rows.flatMap((row) => row.allowedSocietyEntries))].sort((left, right) =>
        left.localeCompare(right)
      ),
    [rows]
  );
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (professionFilter !== "all" && row.id !== professionFilter) {
          return false;
        }

        if (grantedGroupFilter !== "all" && !row.grantedSkillGroups.includes(grantedGroupFilter)) {
          return false;
        }

        if (societyAccessFilter !== "all" && !row.allowedSocietyEntries.includes(societyAccessFilter)) {
          return false;
        }

        if (
          directExceptionFilter === "with-exceptions" &&
          !row.hasDirectSkillExceptions
        ) {
          return false;
        }

        if (
          directExceptionFilter === "without-exceptions" &&
          row.hasDirectSkillExceptions
        ) {
          return false;
        }

        if (reachFilter !== "all" && row.reachBand !== reachFilter) {
          return false;
        }

        return true;
      }),
    [
      directExceptionFilter,
      grantedGroupFilter,
      professionFilter,
      reachFilter,
      rows,
      societyAccessFilter
    ]
  );
  const visibleProfessionIdSet = useMemo(
    () => new Set(filteredRows.map((row) => row.id)),
    [filteredRows]
  );
  const filteredIssues = useMemo(
    () => auditIssues.filter((issue) => visibleProfessionIdSet.has(issue.professionId)),
    [auditIssues, visibleProfessionIdSet]
  );
  const groupedRows = useMemo(() => {
    if (filteredRows.length === 0 || groupBy === "none") {
      return [
        {
          label: "All visible professions",
          rows: filteredRows
        }
      ];
    }

    const grouped = new Map<string, ProfessionMatrixRow[]>();

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
      .map(([label, professionRows]) => ({
        label,
        rows: professionRows
      }));
  }, [filteredRows, groupBy]);

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Professions / Matrix"
        summary="This read-first workspace treats each profession as a structured consumer of the skill graph, so we can audit grant packages, reach, direct exceptions, and society availability before layering in deeper class design."
        title="Profession Matrix Audit"
      />

      <ProfessionsWorkspaceTabs />

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
        }}
      >
        <AdminMetric hint="Professions visible after filters" label="Visible Professions" value={filteredRows.length} />
        <AdminMetric
          hint="Fix these before treating a profession as a stable grant package for society-layer orchestration"
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
          hint="Visible professions with direct skill exceptions"
          label="Direct Exceptions"
          value={filteredRows.filter((row) => row.hasDirectSkillExceptions).length}
        />
      </div>

      <AdminPanel
        subtitle="Filter by grant package shape, society access, and reach profile, then regroup to compare professions that sit in the same slice."
        title="Filters"
      >
        <div
          style={{
            display: "grid",
            gap: "0.9rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))"
          }}
        >
          <AdminField label="Profession">
            <AdminSelect
              onChange={(event) => setProfessionFilter(event.target.value)}
              value={professionFilter}
            >
              <option value="all">All</option>
              {rows.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField label="Granted group">
            <AdminSelect
              onChange={(event) => setGrantedGroupFilter(event.target.value)}
              value={grantedGroupFilter}
            >
              <option value="all">All</option>
              {grantedGroupOptions.map((groupName) => (
                <option key={groupName} value={groupName}>
                  {groupName}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField label="Society / class access">
            <AdminSelect
              onChange={(event) => setSocietyAccessFilter(event.target.value)}
              value={societyAccessFilter}
            >
              <option value="all">All</option>
              {societyAccessOptions.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField label="Direct skill exceptions">
            <AdminSelect
              onChange={(event) =>
                setDirectExceptionFilter(event.target.value as DirectExceptionFilter)
              }
              value={directExceptionFilter}
            >
              <option value="all">All</option>
              <option value="with-exceptions">With direct exceptions</option>
              <option value="without-exceptions">Without direct exceptions</option>
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
            <AdminSelect
              onChange={(event) => setGroupBy(event.target.value as GroupByOption)}
              value={groupBy}
            >
              <option value="none">No grouping</option>
              <option value="reach-band">Reach band</option>
              <option value="granted-group">Granted group</option>
              <option value="society-access">Society access</option>
            </AdminSelect>
          </AdminField>
        </div>
      </AdminPanel>

      <AdminPanel
        subtitle="These helpers treat professions as auditable grant packages: resolve blocking package gaps first, then review duplicate or missing access signals, then clean up metadata and reach outliers."
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
              header: "Profession",
              render: (issue) => <strong>{issue.professionName}</strong>,
              width: "12rem"
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
          emptyState="No profession audit issues match the current filters."
          rows={filteredIssues}
        />
      </AdminPanel>

      {groupedRows.map((group) => (
        <AdminPanel
          key={group.label}
          subtitle={`${group.rows.length} profession${group.rows.length === 1 ? "" : "s"} in this slice.`}
          title={group.label}
        >
          <AdminDataTable
            columns={[
              {
                header: "Profession Name",
                render: (row) => <strong>{row.name}</strong>,
                width: "12rem"
              },
              {
                header: "Description",
                render: (row) => row.description || <span style={{ color: "#8a7e63" }}>None</span>,
                width: "18rem"
              },
              {
                header: "Granted Skill Groups",
                render: (row) => <AdminTagList values={row.grantedSkillGroups} />,
                width: "14rem"
              },
              {
                header: "Directly Granted Skills",
                render: (row) => <AdminTagList values={row.directlyGrantedSkills} />,
                width: "15rem"
              },
              {
                header: "Total Reachable Skills",
                render: (row) => row.totalReachableSkills
              },
              {
                header: "Reachable Secondary Skills",
                render: (row) => <AdminTagList values={row.reachableSecondarySkills} />,
                width: "15rem"
              },
              {
                header: "Reachable Specialization-Linked Skills",
                render: (row) => <AdminTagList values={row.reachableSpecializationLinkedSkills} />,
                width: "16rem"
              },
              {
                header: "Allowed Society / Class Rows",
                render: (row) => <AdminTagList values={row.allowedSocietyEntries} />,
                width: "16rem"
              },
              {
                header: "Notes",
                render: (row) => row.notes || <span style={{ color: "#8a7e63" }}>None</span>
              }
            ]}
            emptyState="No professions match this grouping."
            rows={group.rows}
          />
        </AdminPanel>
      ))}
    </section>
  );
}
