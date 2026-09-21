"use client";
import { useState } from "react";
import type { ArtifactGmDto, ArtifactImportPreview, ArtifactPackage } from "@glantri/domain";
import {
  artifactRevisionUrl,
  loadArtifactHistory,
  stageArtifactPackage,
  type ArtifactHistory,
} from "@/lib/api/artifactClient";
import { ArtifactImportReview } from "./ArtifactImportPanel";
export function ArtifactDetails({
  campaignId,
  artifact,
  onChanged,
}: {
  campaignId: string;
  artifact: ArtifactGmDto;
  onChanged: () => Promise<void>;
}) {
  const [history, setHistory] = useState<ArtifactHistory>(),
    [error, setError] = useState<string>(),
    [file, setFile] = useState<File>(),
    [busy, setBusy] = useState(false),
    [preview, setPreview] = useState<ArtifactImportPreview>();
  async function inspect() {
    try {
      setHistory(await loadArtifactHistory(campaignId, artifact.id));
      setError(undefined);
    } catch (error) {
      setError(error instanceof Error ? error.message : "History unavailable.");
    }
  }
  return (
    <details
      onToggle={(event) => {
        if (event.currentTarget.open) void inspect();
      }}
    >
      <summary>History, uses and new version</summary>
      <div style={{ display: "grid", gap: 8, minWidth: 0 }}>
        {error ? <p role="alert">{error}</p> : null}
        <p>
          Owned by this Campaign. {artifact.sourceLabel ? `Source: ${artifact.sourceLabel}.` : ""}{" "}
          {artifact.provenanceKind === "imported" ? "Imported content." : ""}
        </p>
        {history ? (
          <>
            <h4>Revision history</h4>
            {history.revisions.map((row) => (
              <div key={row.id}>
                <a
                  href={artifactRevisionUrl(campaignId, artifact.id, row.id)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Version {row.number}
                </a>{" "}
                · {new Date(row.createdAt).toLocaleString()}
                {row.note ? <p>{row.note}</p> : null}
              </div>
            ))}
            <h4>Uses</h4>
            {history.usages.references.map((row) => (
              <p key={row.scenario.id}>
                Scenario: {row.scenario.name} · {row.state}
              </p>
            ))}
            {history.usages.maps.map((row) => (
              <p key={row.id}>Scenario map: {row.name}</p>
            ))}
            {history.usages.workspaceMaps.map((row) => (
              <p key={row.id}>Map Workspace background: {row.name}</p>
            ))}
            {history.usages.links.map((row) => (
              <p key={`${row.entryId}-${row.revisionNumber}`}>
                Blackboard: {row.title} · {row.current ? "Current use" : "Historical use"} ·
                publication version {row.revisionNumber}
              </p>
            ))}
            {!history.usages.references.length &&
            !history.usages.maps.length &&
            !history.usages.workspaceMaps.length &&
            !history.usages.links.length ? (
              <p>No recorded uses.</p>
            ) : null}
          </>
        ) : (
          <p>Loading history…</p>
        )}
        {artifact.lifecycle === "active" ? (
          <>
            <h4>Publish a new version</h4>
            <p>
              Use this for a correction to the same authored thing. Existing uses will show the new
              media. To depict something different, create another Artifact and change the
              consumer’s selection.
            </p>
            <label>
              Corrected media{" "}
              <input
                style={{ maxWidth: "100%" }}
                type="file"
                accept="image/png,image/jpeg,image/webp,application/pdf"
                disabled={busy}
                onChange={(event) => {
                  setFile(event.target.files?.[0]);
                  setPreview(undefined);
                }}
              />
            </label>
            <button
              type="button"
              disabled={!file || busy}
              onClick={async () => {
                if (!file) return;
                setBusy(true);
                setError(undefined);
                try {
                  if (!file.size || file.size > 25 * 1024 * 1024)
                    throw new Error("Choose media no larger than 25 MiB.");
                  const digest = Array.from(
                    new Uint8Array(await crypto.subtle.digest("SHA-256", await file.arrayBuffer())),
                  )
                    .map((x) => x.toString(16).padStart(2, "0"))
                    .join("");
                  const manifest: ArtifactPackage = {
                    schemaVersion: 1,
                    producer: "local-gm",
                    packageId: crypto.randomUUID(),
                    version: "1",
                    title: `New version of ${artifact.title}`,
                    objects: [
                      {
                        id: "revision",
                        type: "Artifact",
                        optional: false,
                        targetArtifactId: artifact.id,
                        resourceId: "media",
                        attachments: [],
                        dependencies: [],
                        metadata: {
                          title: artifact.title,
                          artifactKind: artifact.artifactKind,
                          altText: artifact.altText,
                          description: artifact.description,
                          provenanceKind: artifact.provenanceKind ?? "user_upload",
                          sourceLabel: artifact.sourceLabel,
                          sourceUri: artifact.sourceUri,
                        },
                      },
                    ],
                    resources: [
                      {
                        id: "media",
                        mediaType: file.type as ArtifactPackage["resources"][number]["mediaType"],
                        sha256: digest,
                      },
                    ],
                  };
                  setPreview(await stageArtifactPackage(campaignId, manifest, { media: file }));
                } catch (error) {
                  setError(
                    error instanceof Error ? error.message : "Unable to preview this version.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              Preview new version
            </button>
            {preview ? (
              <ArtifactImportReview
                key={`${preview.id}:${preview.previewToken}:${preview.state}`}
                campaignId={campaignId}
                initial={preview}
                onAccepted={async () => {
                  await onChanged();
                  await inspect();
                }}
              />
            ) : null}
          </>
        ) : (
          <p>
            Retired Artifacts retain their history and existing uses. Restore this Artifact before
            publishing a new version.
          </p>
        )}
      </div>
    </details>
  );
}
