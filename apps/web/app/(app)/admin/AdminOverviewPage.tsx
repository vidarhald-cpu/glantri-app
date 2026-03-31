"use client";

import Link from "next/link";

import { useAdminContent } from "../../../src/lib/admin/AdminContentContext";
import { buildAdminOverviewStats } from "../../../src/lib/admin/viewModels";
import {
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminStatusBadge,
  adminNavItems,
  formatAdminTimestamp
} from "./admin-ui";

function describeSource(source: "cached-database" | "database" | "seed"): string {
  if (source === "cached-database") {
    return "Cached database";
  }

  return source === "database" ? "Database" : "Seed";
}

export default function AdminOverviewPage() {
  const {
    content,
    hasDraftChanges,
    hasLocalDraft,
    lastDraftSavedAt,
    lastPublishedUpdatedAt,
    lastSaveFailed,
    loadedSource,
    publishedRevision
  } = useAdminContent();
  const stats = buildAdminOverviewStats(content);

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        actions={
          <Link href="/admin/skills" style={{ color: "#594320", fontWeight: 700 }}>
            Open Skills Workspace
          </Link>
        }
        eyebrow="Admin Structure"
        summary="This admin layer now treats the server-backed canonical content snapshot as the source of truth, while still using Dexie for last-synced cache and preserved local drafts when saves fail or conflict."
        title="Rules Content Management"
      />

      <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <AdminMetric hint="Canonical skill definitions" label="Skills" value={stats.skillCount} />
        <AdminMetric hint="Higher-level content buckets" label="Skill Groups" value={stats.skillGroupCount} />
        <AdminMetric hint="Profession rule definitions" label="Professions" value={stats.professionCount} />
        <AdminMetric hint="Society/social-class access rows" label="Society Rows" value={stats.societyEntryCount} />
      </div>

      <AdminPanel
        subtitle="This panel tracks the published server snapshot separately from any preserved Dexie draft, so operators can quickly see whether they are working from truth or from recovery state."
        title="Admin Persistence Status"
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          <AdminStatusBadge>{describeSource(loadedSource)}</AdminStatusBadge>
          <AdminStatusBadge tone={hasLocalDraft ? "warning" : "neutral"}>
            {hasLocalDraft ? "Local draft exists" : "No local draft"}
          </AdminStatusBadge>
          <AdminStatusBadge tone={hasDraftChanges ? "warning" : "neutral"}>
            {hasDraftChanges ? "Draft differs from published" : "Draft matches published"}
          </AdminStatusBadge>
          <AdminStatusBadge tone={lastSaveFailed ? "danger" : "success"}>
            {lastSaveFailed ? "Last save failed" : "No recent save failure"}
          </AdminStatusBadge>
        </div>

        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div
            style={{
              background: "rgba(255, 252, 245, 0.92)",
              border: "1px solid rgba(85, 73, 48, 0.12)",
              borderRadius: 18,
              display: "grid",
              gap: "0.3rem",
              padding: "0.95rem 1rem"
            }}
          >
            <span style={{ color: "#776b52", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Current Revision
            </span>
            <strong style={{ color: "#241d12", fontSize: "1.4rem" }}>{publishedRevision}</strong>
            <span style={{ color: "#5f543a" }}>Published server revision</span>
          </div>
          <div
            style={{
              background: "rgba(255, 252, 245, 0.92)",
              border: "1px solid rgba(85, 73, 48, 0.12)",
              borderRadius: 18,
              display: "grid",
              gap: "0.3rem",
              padding: "0.95rem 1rem"
            }}
          >
            <span style={{ color: "#776b52", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Published Source
            </span>
            <strong style={{ color: "#241d12", fontSize: "1.15rem" }}>{describeSource(loadedSource)}</strong>
            <span style={{ color: "#5f543a" }}>
              Updated {formatAdminTimestamp(lastPublishedUpdatedAt)}
            </span>
          </div>
          <div
            style={{
              background: "rgba(255, 252, 245, 0.92)",
              border: "1px solid rgba(85, 73, 48, 0.12)",
              borderRadius: 18,
              display: "grid",
              gap: "0.3rem",
              padding: "0.95rem 1rem"
            }}
          >
            <span style={{ color: "#776b52", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Local Draft
            </span>
            <strong style={{ color: "#241d12", fontSize: "1.15rem" }}>
              {hasLocalDraft ? "Present" : "Absent"}
            </strong>
            <span style={{ color: "#5f543a" }}>
              Saved locally {formatAdminTimestamp(lastDraftSavedAt)}
            </span>
          </div>
          <div
            style={{
              background: "rgba(255, 252, 245, 0.92)",
              border: "1px solid rgba(85, 73, 48, 0.12)",
              borderRadius: 18,
              display: "grid",
              gap: "0.3rem",
              padding: "0.95rem 1rem"
            }}
          >
            <span style={{ color: "#776b52", fontSize: "0.82rem", textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Draft Delta
            </span>
            <strong style={{ color: "#241d12", fontSize: "1.15rem" }}>
              {hasDraftChanges ? "Differs from published" : "Matches published"}
            </strong>
            <span style={{ color: "#5f543a" }}>
              {lastSaveFailed
                ? "Review the recovery actions in the header."
                : "No failed save is currently flagged."}
            </span>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        subtitle="The current pass keeps the route structure and editing model intact, but moves persistence to a revisioned admin content API. Dexie remains in place for cached server content and local draft recovery."
        title="Route Map"
      >
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {adminNavItems.map((item) => (
            <Link
              href={item.href}
              key={item.href}
              style={{
                background: "rgba(255, 252, 245, 0.92)",
                border: "1px solid rgba(85, 73, 48, 0.12)",
                borderRadius: 20,
                color: "inherit",
                display: "grid",
                gap: "0.35rem",
                padding: "1rem",
                textDecoration: "none"
              }}
            >
              <strong style={{ color: "#2e2619" }}>{item.label}</strong>
              <span style={{ color: "#5f543a", lineHeight: 1.5 }}>{item.description}</span>
              <span style={{ color: "#835c1f", fontSize: "0.9rem", fontWeight: 700 }}>{item.href}</span>
            </Link>
          ))}
        </div>
      </AdminPanel>
    </section>
  );
}
