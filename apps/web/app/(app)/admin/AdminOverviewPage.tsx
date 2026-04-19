"use client";

import Link from "next/link";
import { useState } from "react";

import { useAdminContent } from "../../../src/lib/admin/AdminContentContext";
import { buildAdminOverviewStats } from "../../../src/lib/admin/viewModels";
import {
  AdminButton,
  AdminMetric,
  AdminPageIntro,
  AdminPanel,
  AdminStatusBadge,
  AdminTextarea,
  adminNavGroups,
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
    discardLocalDraft,
    feedback,
    hasDraftChanges,
    hasLocalDraft,
    hasRevisionConflict,
    isLoading,
    isSaving,
    keepLocalDraft,
    lastDraftSavedAt,
    lastPublishedUpdatedAt,
    lastSaveFailed,
    lastSaveState,
    loadedSource,
    publishedRevision,
    reloadFromServer,
    revision
  } = useAdminContent();
  const stats = buildAdminOverviewStats(content);
  const [revisionNote, setRevisionNote] = useState("");

  return (
    <section style={{ display: "grid", gap: "1.25rem" }}>
      <AdminPageIntro
        actions={
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            <Link href="/admin/skills" style={{ color: "#594320", fontWeight: 700 }}>
              Open Skills & Societies
            </Link>
            <Link href="/admin/melee-weapons" style={{ color: "#594320", fontWeight: 700 }}>
              Open Weapons & Equipment
            </Link>
          </div>
        }
        eyebrow="Admin Overview"
        summary="Overview is now the single home for aggregate content counts, server-versus-draft persistence status, and save/reload workflow context. The child workspaces stay focused on their own review and editing tasks."
        title="Rules Content Management"
      />

      <AdminPanel
        subtitle="These metrics summarize the major content areas and grouped workspaces without repeating that framing on every child page."
        title="System Snapshot"
      >
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <AdminMetric hint="Canonical skill definitions" label="Skills" value={stats.skillCount} />
          <AdminMetric hint="Higher-level content buckets" label="Skill Groups" value={stats.skillGroupCount} />
          <AdminMetric hint="Profession rule definitions" label="Professions" value={stats.professionCount} />
          <AdminMetric hint="Canonical societies" label="Societies" value={stats.societyCount} />
          <AdminMetric hint="Society/social-class access rows" label="Access Rows" value={stats.societyEntryCount} />
          <AdminMetric hint="Baseline language definitions" label="Languages" value={stats.languageCount} />
          <AdminMetric hint="Skills, groups, professions, societies, access" label="Skills & Societies Pages" value={stats.societyWorkspaceCount} />
          <AdminMetric hint="Melee, missile, shields, armor, gear, valuables" label="Weapons & Equipment Pages" value={stats.weaponWorkspaceCount + stats.equipmentWorkspaceCount} />
          <AdminMetric hint="Players workspace" label="Accounts Pages" value={stats.accountWorkspaceCount} />
          <AdminMetric hint="Documents and tables" label="Rules & Docs Pages" value={stats.documentWorkspaceCount} />
        </div>
      </AdminPanel>

      <AdminPanel
        subtitle="This panel keeps published state, working state, local draft recovery, and save/publish controls together in one place."
        title="Persistence & Publishing"
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1rem" }}>
          <AdminStatusBadge>{describeSource(loadedSource)}</AdminStatusBadge>
          <AdminStatusBadge tone={hasLocalDraft ? "warning" : "neutral"}>
            {hasLocalDraft ? "Local draft exists" : "No local draft"}
          </AdminStatusBadge>
          <AdminStatusBadge tone={hasDraftChanges ? "warning" : "neutral"}>
            {hasDraftChanges ? "Draft differs from published" : "Draft matches published"}
          </AdminStatusBadge>
          <AdminStatusBadge tone={hasRevisionConflict ? "danger" : "neutral"}>
            {hasRevisionConflict ? "Revision conflict" : "Revision aligned"}
          </AdminStatusBadge>
          <AdminStatusBadge tone={lastSaveFailed ? "danger" : "success"}>
            {lastSaveFailed ? "Last save failed" : "No recent save failure"}
          </AdminStatusBadge>
          <AdminStatusBadge tone={lastSaveState === "saving" ? "warning" : "neutral"}>
            {lastSaveState === "saving" ? "Save in progress" : "Save controls ready"}
          </AdminStatusBadge>
        </div>

        <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", marginBottom: "1rem" }}>
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
            <span style={{ color: "#5f543a" }}>Revision {publishedRevision}</span>
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
              Working Revision
            </span>
            <strong style={{ color: "#241d12", fontSize: "1.4rem" }}>{revision}</strong>
            <span style={{ color: "#5f543a" }}>
              {hasLocalDraft ? "Local draft base revision" : "Matches published content"}
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
              Last Published Update
            </span>
            <strong style={{ color: "#241d12", fontSize: "1.15rem" }}>
              {formatAdminTimestamp(lastPublishedUpdatedAt)}
            </strong>
            <span style={{ color: "#5f543a" }}>Server snapshot timestamp</span>
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
              Saved Locally
            </span>
            <strong style={{ color: "#241d12", fontSize: "1.15rem" }}>
              {formatAdminTimestamp(lastDraftSavedAt)}
            </strong>
            <span style={{ color: "#5f543a" }}>
              {hasLocalDraft ? "Preserved local draft timestamp" : "No preserved draft timestamp"}
            </span>
          </div>
        </div>

        <div style={{ display: "grid", gap: "0.9rem", gridTemplateColumns: "minmax(0, 1.2fr) minmax(280px, 0.8fr)" }}>
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label style={{ color: "#5f543a", display: "grid", fontSize: "0.9rem", fontWeight: 600, gap: "0.35rem" }}>
              Revision note / change annotation
              <AdminTextarea
                onChange={(event) => setRevisionNote(event.target.value)}
                placeholder="Summarize what changed in this editing pass. This is currently an Overview-only drafting note and is not yet persisted with the server revision workflow."
                value={revisionNote}
              />
            </label>
            <div style={{ color: "#5f543a", fontSize: "0.92rem", lineHeight: 1.5 }}>
              Revision-note persistence is intentionally deferred. This field gives editors one place to draft publication notes until a server-backed revision log is added.
            </div>
            <div style={{ color: isLoading ? "#7b5713" : "#5f543a", minHeight: 24 }}>
              {isLoading ? "Loading server-backed rules content..." : feedback ?? ""}
            </div>
          </div>

          <div
            style={{
              background: "rgba(255, 252, 245, 0.92)",
              border: "1px solid rgba(85, 73, 48, 0.12)",
              borderRadius: 18,
              display: "grid",
              gap: "0.75rem",
              padding: "1rem"
            }}
          >
            <strong style={{ color: "#2e2619" }}>Save / publish controls</strong>
            <div style={{ color: "#5f543a", fontSize: "0.92rem", lineHeight: 1.5 }}>
              Reload and draft-recovery actions live here so the child workspaces can stay focused on inspection and editing.
            </div>
            <div style={{ display: "grid", gap: "0.6rem" }}>
              <AdminButton
                disabled={isLoading || isSaving}
                onClick={() => void reloadFromServer()}
                variant="ghost"
              >
                Reload Latest Server Content
              </AdminButton>
              {hasLocalDraft ? (
                <AdminButton
                  disabled={isLoading || isSaving}
                  onClick={keepLocalDraft}
                  variant="secondary"
                >
                  Keep Local Draft
                </AdminButton>
              ) : null}
              {hasLocalDraft ? (
                <AdminButton
                  disabled={isLoading || isSaving}
                  onClick={() => void discardLocalDraft()}
                  variant="ghost"
                >
                  Discard Local Draft
                </AdminButton>
              ) : null}
            </div>
          </div>
        </div>
      </AdminPanel>

      <AdminPanel
        subtitle="The route map follows the grouped admin structure so operators can scan by responsibility instead of reading one long flat list."
        title="Workspace Map"
      >
        <div style={{ display: "grid", gap: "1rem" }}>
          {adminNavGroups.map((group) => (
            <div key={group.label} style={{ display: "grid", gap: "0.6rem" }}>
              <div
                style={{
                  color: "#7e5d2a",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase"
                }}
              >
                {group.label}
              </div>
              <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
                {group.items.map((item) => (
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
            </div>
          ))}
        </div>
      </AdminPanel>
    </section>
  );
}
