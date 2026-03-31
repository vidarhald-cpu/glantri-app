"use client";

import { useMemo, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import {
  buildSkillAuditIssues,
  buildSkillMatrixRows,
  type SkillAuditIssue,
  type SkillMatrixRow
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
import SkillsWorkspaceTabs from "./SkillsWorkspaceTabs";

type DependencyFilter = "all" | "has-dependencies" | "no-dependencies";
type GroupByOption = "none" | "parent-group" | "skill-type" | "society-level";
type RelationshipFilter = "all" | "secondary-only" | "specializations-only";

function matchesDependencyFilter(row: SkillMatrixRow, filter: DependencyFilter): boolean {
  if (filter === "has-dependencies") {
    return row.dependencies.length > 0;
  }

  if (filter === "no-dependencies") {
    return row.dependencies.length === 0;
  }

  return true;
}

function matchesRelationshipFilter(row: SkillMatrixRow, filter: RelationshipFilter): boolean {
  if (filter === "secondary-only") {
    return row.skillType === "secondary";
  }

  if (filter === "specializations-only") {
    return row.specializationOf.length > 0;
  }

  return true;
}

function getGroupLabel(row: SkillMatrixRow, groupBy: GroupByOption): string {
  if (groupBy === "skill-type") {
    return row.skillType;
  }

  if (groupBy === "society-level") {
    return `Society level ${row.societyLevel}`;
  }

  if (groupBy === "parent-group") {
    if (row.groupNames.length === 0) {
      return "Ungrouped";
    }

    return row.groupNames.length === 1 ? row.groupNames[0] : `Multiple groups: ${row.groupNames.join(", ")}`;
  }

  return "All visible skills";
}

function countIssuesBySeverity(issues: SkillAuditIssue[], severity: SkillAuditIssue["severity"]): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

export default function SkillMatrixAdminPage() {
  const { content } = useAdminContent();
  const rows = useMemo(() => buildSkillMatrixRows(content), [content]);
  const auditIssues = useMemo(() => buildSkillAuditIssues(content), [content]);
  const [skillTypeFilter, setSkillTypeFilter] = useState("all");
  const [societyLevelFilter, setSocietyLevelFilter] = useState("all");
  const [parentGroupFilter, setParentGroupFilter] = useState("all");
  const [dependencyFilter, setDependencyFilter] = useState<DependencyFilter>("all");
  const [relationshipFilter, setRelationshipFilter] = useState<RelationshipFilter>("all");
  const [groupBy, setGroupBy] = useState<GroupByOption>("parent-group");

  const parentGroupOptions = useMemo(
    () =>
      [...new Set(rows.flatMap((row) => row.groupNames))]
        .sort((left, right) => left.localeCompare(right)),
    [rows]
  );
  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (skillTypeFilter !== "all" && row.skillType !== skillTypeFilter) {
          return false;
        }

        if (societyLevelFilter !== "all" && String(row.societyLevel) !== societyLevelFilter) {
          return false;
        }

        if (parentGroupFilter !== "all" && !row.groupNames.includes(parentGroupFilter)) {
          return false;
        }

        if (!matchesDependencyFilter(row, dependencyFilter)) {
          return false;
        }

        return matchesRelationshipFilter(row, relationshipFilter);
      }),
    [dependencyFilter, parentGroupFilter, relationshipFilter, rows, skillTypeFilter, societyLevelFilter]
  );
  const visibleSkillIdSet = useMemo(
    () => new Set(filteredRows.map((row) => row.id)),
    [filteredRows]
  );
  const filteredIssues = useMemo(
    () => auditIssues.filter((issue) => visibleSkillIdSet.has(issue.skillId)),
    [auditIssues, visibleSkillIdSet]
  );
  const groupedRows = useMemo(() => {
    if (filteredRows.length === 0 || groupBy === "none") {
      return [
        {
          label: "All visible skills",
          rows: filteredRows
        }
      ];
    }

    const grouped = new Map<string, SkillMatrixRow[]>();

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
      .map(([label, groupedSkillRows]) => ({
        label,
        rows: groupedSkillRows
      }));
  }, [filteredRows, groupBy]);
  const issueCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const issue of filteredIssues) {
      counts.set(issue.category, (counts.get(issue.category) ?? 0) + 1);
    }

    return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }, [filteredIssues]);

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Skills / Matrix"
        summary="This read-first workspace turns the skill graph into a relationship matrix so we can spot prerequisite hubs, structural gaps, and suspicious level mismatches before professions are built on top of it."
        title="Skill Matrix Audit"
      />

      <SkillsWorkspaceTabs />

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
        }}
      >
        <AdminMetric hint="Skills visible after filters" label="Visible Skills" value={filteredRows.length} />
        <AdminMetric
          hint="Fix these before building more profession or society content on top of this slice"
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
          hint="Visible skills acting as prerequisite hubs"
          label="Dependency Hubs"
          value={filteredRows.filter((row) => row.dependentCount >= 3).length}
        />
      </div>

      <AdminPanel
        subtitle="Use filters to isolate a slice of the skill graph, then regroup the table to review it by type, society level, or parent group."
        title="Filters"
      >
        <div
          style={{
            display: "grid",
            gap: "0.9rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))"
          }}
        >
          <AdminField label="Skill type">
            <AdminSelect
              onChange={(event) => setSkillTypeFilter(event.target.value)}
              value={skillTypeFilter}
            >
              <option value="all">All</option>
              <option value="ordinary">ordinary</option>
              <option value="secondary">secondary</option>
            </AdminSelect>
          </AdminField>

          <AdminField label="Society level">
            <AdminSelect
              onChange={(event) => setSocietyLevelFilter(event.target.value)}
              value={societyLevelFilter}
            >
              <option value="all">All</option>
              {["1", "2", "3", "4", "5", "6"].map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField label="Parent group">
            <AdminSelect
              onChange={(event) => setParentGroupFilter(event.target.value)}
              value={parentGroupFilter}
            >
              <option value="all">All</option>
              {parentGroupOptions.map((groupName) => (
                <option key={groupName} value={groupName}>
                  {groupName}
                </option>
              ))}
            </AdminSelect>
          </AdminField>

          <AdminField label="Dependencies">
            <AdminSelect
              onChange={(event) => setDependencyFilter(event.target.value as DependencyFilter)}
              value={dependencyFilter}
            >
              <option value="all">All</option>
              <option value="has-dependencies">Has dependencies</option>
              <option value="no-dependencies">No dependencies</option>
            </AdminSelect>
          </AdminField>

          <AdminField label="Relationship focus">
            <AdminSelect
              onChange={(event) =>
                setRelationshipFilter(event.target.value as RelationshipFilter)
              }
              value={relationshipFilter}
            >
              <option value="all">All</option>
              <option value="secondary-only">Secondary skills only</option>
              <option value="specializations-only">Specializations only</option>
            </AdminSelect>
          </AdminField>

          <AdminField label="Group rows by">
            <AdminSelect
              onChange={(event) => setGroupBy(event.target.value as GroupByOption)}
              value={groupBy}
            >
              <option value="none">No grouping</option>
              <option value="parent-group">Parent group</option>
              <option value="skill-type">Skill type</option>
              <option value="society-level">Society level</option>
            </AdminSelect>
          </AdminField>
        </div>
      </AdminPanel>

      <AdminPanel
        subtitle="These helpers turn the skill graph audit into a triage workflow: fix blocking contradictions first, then warnings, then polish informational gaps."
        title="Audit Helpers"
      >
        <div style={{ marginBottom: "1rem" }}>
          <AdminAuditLegend />
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          {issueCategoryCounts.length === 0 ? (
            <AdminStatusBadge tone="success">No audit issues for the current filters</AdminStatusBadge>
          ) : (
            issueCategoryCounts.map(([category, count]) => {
              const categoryIssues = filteredIssues.filter((issue) => issue.category === category);
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
              header: "Skill",
              render: (issue) => <strong>{issue.skillName}</strong>,
              width: "12rem"
            },
            {
              header: "Review Note",
              render: (issue) => issue.detail,
              width: "24rem"
            },
            {
              header: "Related Skills",
              render: (issue) => <AdminTagList values={issue.relatedSkills} />,
              width: "16rem"
            }
          ]}
          emptyState="No audit issues match the current filters."
          rows={filteredIssues}
        />
      </AdminPanel>

      {groupedRows.map((group) => (
        <AdminPanel
          key={group.label}
          subtitle={`${group.rows.length} skill${group.rows.length === 1 ? "" : "s"} in this slice.`}
          title={group.label}
        >
          <AdminDataTable
            columns={[
              {
                header: "Skill Name",
                render: (row) => <strong>{row.name}</strong>,
                width: "12rem"
              },
              {
                header: "Skill Type",
                render: (row) => row.skillType
              },
              {
                header: "Parent Skill Group(s)",
                render: (row) => <AdminTagList values={row.groupNames} />,
                width: "14rem"
              },
              {
                header: "Society Level",
                render: (row) => row.societyLevel
              },
              {
                header: "Dependencies",
                render: (row) => <AdminTagList values={row.dependencies} />,
                width: "15rem"
              },
              {
                header: "Depended On By",
                render: (row) => <AdminTagList values={row.dependedOnBy} />,
                width: "15rem"
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
                header: "Has Specializations",
                render: (row) => (row.hasSpecializations ? "Yes" : "No")
              },
              {
                header: "Literacy Requirement",
                render: (row) => row.literacyRequirement
              },
              {
                header: "Allows Specializations",
                render: (row) => (row.allowsSpecializations ? "Yes" : "No")
              }
            ]}
            emptyState="No skills match this grouping."
            rows={group.rows}
          />
        </AdminPanel>
      ))}
    </section>
  );
}
