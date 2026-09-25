"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import type {
  ArtifactCommonDto,
  ArtifactGmDto,
  Scenario,
  ScenarioArtifactReferenceDto,
} from "@glantri/domain";

import {
  ApiRequestError,
  artifactContentUrl,
  isManagedArtifact,
  loadArtifacts,
  mutateScenarioArtifact,
  retryArtifactCleanup,
  setArtifactAudience,
  setArtifactLifecycle,
  updateArtifactMetadata,
} from "@/lib/api/localServiceClient";

import { ArtifactDetails } from "./ArtifactDetails";
import { ArtifactImportPanel } from "./ArtifactImportPanel";
import { ArtifactInspectionDialog, type InspectedArtifact } from "./ArtifactInspectionDialog";
import { OrdinaryArtifactUploadPanel } from "./OrdinaryArtifactUploadPanel";
import { AiIntakePanel } from "./intake/AiIntakePanel";

/**
 * Artifact access has exactly two states (Campaign Material §2.4, Content
 * authoring §18.24). A residual legacy row has already been resolved to
 * `gm_private` at the persistence boundary, so it renders as Private to GM.
 */
function audienceLabel(artifact: ArtifactGmDto): string {
  return artifact.audience === "campaign" ? "Shared with Campaign" : "Private to GM";
}

/** The two canonical access filter values, per Campaign Material §2.1/§2.4. */
const accessFilterOptions = [
  { label: "GM only", value: "gm_private" },
  { label: "Shared with Campaign players", value: "campaign" },
] as const;

type AccessFilter = "" | (typeof accessFilterOptions)[number]["value"];

export function ArtifactPanel({
  campaignId,
  scenarios,
}: {
  campaignId: string;
  scenarios: Scenario[];
}) {
  const [artifacts, setArtifacts] = useState<Array<ArtifactCommonDto | ArtifactGmDto>>([]);
  const [references, setReferences] = useState<ScenarioArtifactReferenceDto[]>([]);
  const [mode, setMode] = useState<"gm" | "viewer">("viewer");
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState("active");
  const [accessFilter, setAccessFilter] = useState<AccessFilter>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [selectedScenarioByArtifact, setSelectedScenarioByArtifact] = useState<
    Record<string, string>
  >({});
  const [editingId, setEditingId] = useState<string>();
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editAltText, setEditAltText] = useState("");
  const [inspected, setInspected] = useState<InspectedArtifact>();

  const refresh = useCallback(async () => {
    const result = await loadArtifacts(campaignId);
    setArtifacts(result.artifacts);
    setMode(result.mode);
    setReferences(result.mode === "gm" ? result.references : []);
  }, [campaignId]);

  useEffect(() => {
    setLoading(true);
    void refresh()
      .catch((caught) =>
        setError(caught instanceof Error ? caught.message : "Unable to load Artifacts."),
      )
      .finally(() => setLoading(false));
  }, [refresh]);

  const activeScenarios = useMemo(
    () => scenarios.filter((scenario) => scenario.status !== "archived"),
    [scenarios],
  );

  async function runMutation(action: () => Promise<unknown>, success: string) {
    setError(undefined);
    setFeedback(undefined);
    try {
      await action();
      await refresh();
      setFeedback(success);
    } catch (caught) {
      if (caught instanceof ApiRequestError && caught.status === 409) {
        await refresh();
        setError("This Artifact changed elsewhere. The current state has been refreshed.");
        return;
      }
      setError(caught instanceof Error ? caught.message : "Unable to update the Artifact.");
    }
  }

  function beginEdit(artifact: ArtifactGmDto) {
    setEditingId(artifact.id);
    setEditTitle(artifact.title);
    setEditDescription(artifact.description ?? "");
    setEditAltText(artifact.altText ?? "");
  }

  const activeAccessFilter = accessFilterOptions.find((option) => option.value === accessFilter);

  if (loading) return <section aria-busy="true">Loading Artifacts…</section>;

  return (
    <section aria-label="Artifact library" style={{ display: "grid", gap: "1rem", minWidth: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <label>
          Find Artifacts{" "}
          <input value={search} onChange={(event) => setSearch(event.target.value)} type="search" />
        </label>
        <label>
          Filter by kind{" "}
          <select value={kindFilter} onChange={(event) => setKindFilter(event.target.value)}>
            <option value="">All kinds</option>
            {["image", "map", "portrait", "document", "handout"].map((kind) => (
              <option key={kind}>{kind}</option>
            ))}
          </select>
        </label>
        {mode === "gm" ? (
          <label>
            Lifecycle{" "}
            <select
              value={lifecycleFilter}
              onChange={(event) => setLifecycleFilter(event.target.value)}
            >
              <option value="active">Active</option>
              <option value="archived">Retired</option>
              <option value="">All</option>
            </select>
          </label>
        ) : null}
        {mode === "gm" ? (
          <label>
            Access{" "}
            <select
              onChange={(event) => setAccessFilter(event.target.value as AccessFilter)}
              value={accessFilter}
            >
              <option value="">All access</option>
              {accessFilterOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      {activeAccessFilter ? (
        <ul
          aria-label="Active filters"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            listStyle: "none",
            margin: 0,
            padding: 0,
          }}
        >
          <li>
            <button onClick={() => setAccessFilter("")} type="button">
              Access: {activeAccessFilter.label} — remove filter
            </button>
          </li>
        </ul>
      ) : null}
      <div>
        <h2 style={{ marginBottom: "0.25rem" }}>Artifacts</h2>
        <p style={{ color: "#5e5a50", margin: 0 }}>
          {mode === "gm"
            ? "Upload privately, preview, then share with the Campaign or a Scenario."
            : "Maps, images, and handouts deliberately shared with you."}
        </p>
      </div>

      {error ? <div role="alert">{error}</div> : null}
      {feedback ? <div role="status">{feedback}</div> : null}

      {mode === "gm" ? (
        <OrdinaryArtifactUploadPanel campaignId={campaignId} onAccepted={refresh} />
      ) : null}
      {mode === "gm" ? <AiIntakePanel campaignId={campaignId} onAccepted={refresh} /> : null}
      {mode === "gm" ? <ArtifactImportPanel campaignId={campaignId} onAccepted={refresh} /> : null}

      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))",
        }}
      >
        {artifacts
          .filter(
            (artifact) =>
              `${artifact.title} ${artifact.description ?? ""}`
                .toLowerCase()
                .includes(search.toLowerCase()) &&
              (!kindFilter || artifact.artifactKind === kindFilter) &&
              (!isManagedArtifact(artifact) ||
                !lifecycleFilter ||
                artifact.lifecycle === lifecycleFilter) &&
              (!accessFilter ||
                (isManagedArtifact(artifact) && artifact.audience === accessFilter)),
          )
          .map((artifact) => {
            const managed = isManagedArtifact(artifact) ? artifact : undefined;
            const isImage = artifact.mediaType?.startsWith("image/");
            const isDocument = artifact.mediaType === "application/pdf";
            const contentAvailable = !managed || managed.storageState === "ready";
            const contentSrc = `${artifactContentUrl(campaignId, artifact.id)}${managed ? `?version=${managed.metadataVersion}` : ""}`;
            // Only images support full-viewport inspection today. The API deliberately
            // refuses inline rendering of PDF Artifact content (attachment disposition
            // plus a `sandbox; default-src 'none'` CSP), so PDFs keep the plain, safe
            // download link only. Secure in-app PDF inspection is a separate, out-of-scope
            // Design issue.
            const inspect = () =>
              setInspected({
                alt: artifact.altText ?? artifact.title,
                artifactKind: artifact.artifactKind,
                audience: managed ? audienceLabel(managed) : undefined,
                kind: "image",
                src: contentSrc,
                title: artifact.title,
              });
            const selectedScenarioId =
              selectedScenarioByArtifact[artifact.id] ?? activeScenarios[0]?.id ?? "";
            const reference = references.find(
              (entry) =>
                entry.artifactId === artifact.id && entry.scenarioId === selectedScenarioId,
            );

            return (
              <article
                key={artifact.id}
                style={{
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  display: "grid",
                  gap: "0.55rem",
                  padding: "1rem",
                }}
              >
                <div>
                  <strong>{artifact.title}</strong>
                  <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                    {artifact.artifactKind}
                    {managed ? ` · ${audienceLabel(managed)} · ${managed.lifecycle}` : ""}
                  </div>
                </div>
                {artifact.description ? <div>{artifact.description}</div> : null}
                {managed?.legacyNeedsUpload ? (
                  <div role="status">
                    Legacy reference — re-upload required. The old link will not be opened.
                  </div>
                ) : null}
                {managed?.storageState === "failed" ? (
                  <div role="status">
                    Upload failed safely. No one can read a partial file; upload again.
                  </div>
                ) : null}
                {managed?.cleanupRequired ? (
                  <div role="status">
                    Private storage cleanup is pending.
                    <button
                      onClick={() =>
                        void runMutation(
                          () => retryArtifactCleanup({ artifactId: managed.id, campaignId }),
                          "Private storage cleanup completed.",
                        )
                      }
                      type="button"
                    >
                      Retry cleanup
                    </button>
                  </div>
                ) : null}
                {contentAvailable && isImage ? (
                  <button
                    aria-label={`Inspect ${artifact.title}`}
                    onClick={() => inspect()}
                    style={{
                      background: "none",
                      border: 0,
                      cursor: "zoom-in",
                      display: "grid",
                      padding: 0,
                    }}
                    type="button"
                  >
                    <img
                      alt={artifact.altText ?? ""}
                      src={contentSrc}
                      style={{ maxHeight: 240, maxWidth: "100%", objectFit: "contain" }}
                    />
                  </button>
                ) : null}
                {contentAvailable && isDocument ? (
                  <a
                    href={artifactContentUrl(campaignId, artifact.id)}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Download PDF safely
                  </a>
                ) : null}

                {managed && managed.lifecycle !== "deleted" && managed.storageState === "ready" ? (
                  <div style={{ display: "grid", gap: "0.45rem" }}>
                    {editingId === managed.id ? (
                      <div style={{ display: "grid", gap: "0.35rem" }}>
                        <label>
                          Title
                          <input
                            onChange={(event) => setEditTitle(event.target.value)}
                            value={editTitle}
                          />
                        </label>
                        <label>
                          Description
                          <textarea
                            onChange={(event) => setEditDescription(event.target.value)}
                            value={editDescription}
                          />
                        </label>
                        <label>
                          Alt text
                          <input
                            onChange={(event) => setEditAltText(event.target.value)}
                            value={editAltText}
                          />
                        </label>
                        <button
                          onClick={() =>
                            void runMutation(
                              () =>
                                updateArtifactMetadata({
                                  altText: editAltText.trim() || null,
                                  artifactId: managed.id,
                                  campaignId,
                                  description: editDescription.trim() || null,
                                  expectedMetadataVersion: managed.metadataVersion,
                                  title: editTitle.trim(),
                                }),
                              "Artifact details updated. Existing Scenario snapshots were preserved.",
                            ).then(() => setEditingId(undefined))
                          }
                          type="button"
                        >
                          Save details
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => beginEdit(managed)} type="button">
                        Edit details
                      </button>
                    )}

                    {managed.lifecycle === "active" ? (
                      <>
                        <button
                          onClick={() =>
                            void runMutation(
                              () =>
                                setArtifactAudience({
                                  artifactId: managed.id,
                                  audience:
                                    managed.audience === "campaign" ? "gm_private" : "campaign",
                                  campaignId,
                                  expectedMetadataVersion: managed.metadataVersion,
                                }),
                              managed.audience === "campaign"
                                ? "Campaign access withdrawn."
                                : "Artifact shared with the Campaign.",
                            )
                          }
                          type="button"
                        >
                          {managed.audience === "campaign"
                            ? "Withdraw from Campaign"
                            : "Share with Campaign"}
                        </button>

                        {activeScenarios.length > 0 ? (
                          <div style={{ display: "grid", gap: "0.35rem" }}>
                            <label>
                              Scenario
                              <select
                                onChange={(event) =>
                                  setSelectedScenarioByArtifact((current) => ({
                                    ...current,
                                    [managed.id]: event.target.value,
                                  }))
                                }
                                value={selectedScenarioId}
                              >
                                {activeScenarios.map((scenario) => (
                                  <option key={scenario.id} value={scenario.id}>
                                    {scenario.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {!reference || reference.state === "withdrawn" ? (
                              <button
                                onClick={() =>
                                  void runMutation(
                                    () =>
                                      mutateScenarioArtifact({
                                        action: "attach",
                                        artifactId: managed.id,
                                        campaignId,
                                        expectedArtifactVersion: managed.metadataVersion,
                                        expectedReferenceVersion: reference?.version ?? 0,
                                        scenarioId: selectedScenarioId,
                                      }),
                                    "Artifact attached privately to the Scenario.",
                                  )
                                }
                                type="button"
                              >
                                Attach privately
                              </button>
                            ) : reference.state === "attached" ? (
                              <button
                                onClick={() =>
                                  void runMutation(
                                    () =>
                                      mutateScenarioArtifact({
                                        action: "publish",
                                        artifactId: managed.id,
                                        campaignId,
                                        expectedArtifactVersion: managed.metadataVersion,
                                        expectedReferenceVersion: reference.version,
                                        scenarioId: selectedScenarioId,
                                      }),
                                    "Artifact shared with entitled Scenario players.",
                                  )
                                }
                                type="button"
                              >
                                Share with Scenario
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  void runMutation(
                                    () =>
                                      mutateScenarioArtifact({
                                        action: "withdraw",
                                        artifactId: managed.id,
                                        campaignId,
                                        expectedArtifactVersion: managed.metadataVersion,
                                        expectedReferenceVersion: reference.version,
                                        scenarioId: selectedScenarioId,
                                      }),
                                    "Scenario access withdrawn.",
                                  )
                                }
                                type="button"
                              >
                                Withdraw from Scenario
                              </button>
                            )}
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    <button
                      onClick={() =>
                        void runMutation(
                          () =>
                            setArtifactLifecycle({
                              artifactId: managed.id,
                              campaignId,
                              expectedMetadataVersion: managed.metadataVersion,
                              lifecycle: managed.lifecycle === "archived" ? "active" : "archived",
                            }),
                          managed.lifecycle === "archived"
                            ? "Artifact restored."
                            : "Artifact retired. Existing uses and history are preserved.",
                        )
                      }
                      type="button"
                    >
                      {managed.lifecycle === "archived" ? "Restore" : "Retire"}
                    </button>
                    <ArtifactDetails
                      campaignId={campaignId}
                      artifact={managed}
                      onChanged={refresh}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
      </div>
      {artifacts.length === 0 ? <div>No shared Artifacts yet.</div> : null}
      {inspected ? (
        <ArtifactInspectionDialog artifact={inspected} onExit={() => setInspected(undefined)} />
      ) : null}
    </section>
  );
}
