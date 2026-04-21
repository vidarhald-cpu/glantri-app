"use client";

import { useMemo, useState } from "react";

import { useAdminContent } from "../../../../src/lib/admin/AdminContentContext";
import { buildSkillGroupAdminRows } from "../../../../src/lib/admin/viewModels";
import {
  AdminDataTable,
  AdminField,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminSelect,
  AdminStatusBadge
} from "../admin-ui";
import SkillGroupsWorkspaceTabs from "./SkillGroupsWorkspaceTabs";

type SizeFilter = "all" | "balanced" | "high" | "low";
type SlotFilter = "all" | "fixed-only" | "with-slots";
type WarningFilter = "all" | "clean" | "with-warnings";

function getSizeBand(points: number): SizeFilter {
  if (points <= 5) {
    return "low";
  }

  if (points >= 12) {
    return "high";
  }

  return "balanced";
}

export default function SkillGroupMatrixAdminPage() {
  const { content } = useAdminContent();
  const rows = useMemo(() => buildSkillGroupAdminRows(content), [content]);
  const [warningFilter, setWarningFilter] = useState<WarningFilter>("all");
  const [slotFilter, setSlotFilter] = useState<SlotFilter>("all");
  const [sizeFilter, setSizeFilter] = useState<SizeFilter>("all");

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (warningFilter === "with-warnings" && row.warningDetails.length === 0) {
          return false;
        }

        if (warningFilter === "clean" && row.warningDetails.length > 0) {
          return false;
        }

        if (slotFilter === "with-slots" && row.selectionSlotCount === 0) {
          return false;
        }

        if (slotFilter === "fixed-only" && row.selectionSlotCount > 0) {
          return false;
        }

        if (sizeFilter !== "all" && getSizeBand(row.weightedContentPoints) !== sizeFilter) {
          return false;
        }

        return true;
      }),
    [rows, sizeFilter, slotFilter, warningFilter]
  );

  const warningCategoryCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const row of filteredRows) {
      for (const warning of row.warningDetails) {
        const key = warning.includes("low-size review threshold")
          ? "Low weighted points"
          : warning.includes("high-size review threshold")
            ? "High weighted points"
            : "Content warning";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }

    return [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  }, [filteredRows]);

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        eyebrow="Admin / Skill Groups / Matrix"
        summary="Review skill groups as package-shaped content slices so outlier group size, slot-heavy groups, and warning clusters stand out before they spread into professions."
        title="Skill Group Matrix Audit"
      />

      <SkillGroupsWorkspaceTabs />

      <div
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
        }}
      >
        <AdminMetric label="Visible groups" value={filteredRows.length} />
        <AdminMetric label="With warnings" value={filteredRows.filter((row) => row.warningDetails.length > 0).length} />
        <AdminMetric label="Low weighted points" value={filteredRows.filter((row) => row.weightedContentPoints <= 5).length} />
        <AdminMetric label="High weighted points" value={filteredRows.filter((row) => row.weightedContentPoints >= 12).length} />
      </div>

      <AdminPanel
        subtitle="The size review thresholds on this page are weighted points 5 or below for low groups, and 12 or above for high groups."
        title="Filters"
      >
        <div
          style={{
            display: "grid",
            gap: "0.9rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
          }}
        >
          <AdminField label="Warnings">
            <AdminSelect
              onChange={(event) => setWarningFilter(event.target.value as WarningFilter)}
              value={warningFilter}
            >
              <option value="all">All</option>
              <option value="with-warnings">With warnings</option>
              <option value="clean">Clean only</option>
            </AdminSelect>
          </AdminField>

          <AdminField label="Selection slots">
            <AdminSelect
              onChange={(event) => setSlotFilter(event.target.value as SlotFilter)}
              value={slotFilter}
            >
              <option value="all">All</option>
              <option value="with-slots">With slots</option>
              <option value="fixed-only">Fixed only</option>
            </AdminSelect>
          </AdminField>

          <AdminField label="Weighted size">
            <AdminSelect
              onChange={(event) => setSizeFilter(event.target.value as SizeFilter)}
              value={sizeFilter}
            >
              <option value="all">All</option>
              <option value="low">Low (5 or below)</option>
              <option value="balanced">Balanced</option>
              <option value="high">High (12 or above)</option>
            </AdminSelect>
          </AdminField>
        </div>
      </AdminPanel>

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "minmax(0, 2.2fr) minmax(320px, 1fr)" }}>
        <AdminPanel title="Group Matrix">
          <AdminDataTable
            columns={[
              {
                header: "Group",
                render: (row) => row.name,
                width: "18%"
              },
              {
                header: "Fixed",
                render: (row) => row.fixedSkills.length
              },
              {
                header: "Slots",
                render: (row) => row.selectionSlotCount
              },
              {
                header: "Points",
                render: (row) => `${row.weightedContentPoints} pts`
              },
              {
                header: "Professions",
                render: (row) =>
                  row.allowedProfessions.length > 0 ? row.allowedProfessions.join(", ") : "None"
              },
              {
                header: "Warnings",
                render: (row) =>
                  row.warningDetails.length > 0 ? (
                    <div style={{ display: "grid", gap: "0.35rem" }}>
                      {row.warningDetails.map((warning) => (
                        <div key={warning} style={{ color: "#6b3429", lineHeight: 1.45 }}>
                          {warning}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <span style={{ color: "#46613a" }}>None</span>
                  ),
                width: "34%"
              }
            ]}
            emptyState="No skill groups match the current audit filters."
            rows={filteredRows}
          />
        </AdminPanel>

        <div style={{ display: "grid", gap: "1rem" }}>
          <AdminPanel
            subtitle="This view is tuned for quick package review: look for warning clusters, low-weight shells, and large fixed groups before checking slot details in the catalog inspector."
            title="Audit Helpers"
          >
            <div style={{ display: "grid", gap: "0.75rem" }}>
              {warningCategoryCounts.length > 0 ? (
                warningCategoryCounts.map(([label, count]) => (
                  <div
                    key={label}
                    style={{
                      alignItems: "center",
                      display: "flex",
                      gap: "0.6rem",
                      justifyContent: "space-between"
                    }}
                  >
                    <span style={{ color: "#4f4635" }}>{label}</span>
                    <AdminStatusBadge tone="warning">{count}</AdminStatusBadge>
                  </div>
                ))
              ) : (
                <div style={{ color: "#46613a" }}>No warnings in the current filter slice.</div>
              )}
            </div>
          </AdminPanel>
        </div>
      </div>
    </section>
  );
}
