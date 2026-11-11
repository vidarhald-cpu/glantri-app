"use client";

import { useRef, useState } from "react";
import {
  artifactPackageSchema,
  ORDINARY_ARTIFACT_UPLOAD_PRODUCER,
  type ArtifactImportPreview,
  type ArtifactKind,
  type ArtifactPackage,
} from "@glantri/domain";
import { cleanupArtifactImport, stageArtifactPackage } from "@/lib/api/artifactClient";
import { randomId } from "@/lib/browser/randomId";
import { ArtifactImportReview } from "./ArtifactImportPanel";
import {
  deriveArtifactPackageResources,
  formatBytes,
  MAX_FILE_BYTES,
  MAX_FILES,
  MAX_TOTAL_BYTES,
  mediaTypeFromFile,
  titleFromFilename,
  type OrdinaryArtifactDraft,
} from "./artifactPackageDerivation";

export type { OrdinaryArtifactDraft };

export async function buildOrdinaryArtifactPackage(
  drafts: OrdinaryArtifactDraft[],
): Promise<{ files: Record<string, File>; manifest: ArtifactPackage }> {
  const { files, resources } = await deriveArtifactPackageResources(drafts);
  const manifest = artifactPackageSchema.parse({
    schemaVersion: 1,
    producer: ORDINARY_ARTIFACT_UPLOAD_PRODUCER,
    packageId: `ordinary-${randomId()}`,
    version: "1",
    title: drafts.length === 1 ? "Artifact upload" : `${drafts.length} Artifact uploads`,
    resources,
    objects: drafts.map((draft, index) => ({
      id: `artifact-${index + 1}`,
      type: "Artifact",
      resourceId: resources[index]!.id,
      metadata: {
        altText: draft.altText.trim() || undefined,
        artifactKind: draft.artifactKind,
        description: draft.description.trim() || undefined,
        provenanceKind: "user_upload",
        title: draft.title.trim(),
      },
    })),
  });
  return { files, manifest };
}

export function OrdinaryArtifactUploadPanel({
  campaignId,
  onAccepted,
}: {
  campaignId: string;
  onAccepted: () => Promise<void>;
}) {
  const [drafts, setDrafts] = useState<OrdinaryArtifactDraft[]>([]);
  const [preview, setPreview] = useState<ArtifactImportPreview>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<ArtifactImportPreview | undefined>(undefined);

  async function discardPreview() {
    const current = previewRef.current;
    if (!current) return;
    previewRef.current = undefined;
    setPreview(undefined);
    try {
      await cleanupArtifactImport(campaignId, current.id);
    } catch {
      setError("The previous private staging area could not be cleaned up yet. Try again.");
    }
  }

  function updateDraft(id: string, update: Partial<OrdinaryArtifactDraft>) {
    setError(undefined);
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, ...update } : draft)),
    );
    void discardPreview();
  }

  async function chooseFiles(files: File[]) {
    setError(undefined);
    await discardPreview();
    if (files.length === 0) {
      setDrafts([]);
      return;
    }
    if (files.length > MAX_FILES) {
      setDrafts([]);
      setError("Choose no more than 100 files at a time.");
      return;
    }
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const invalid = files.find(
      (file) => !mediaTypeFromFile(file) || file.size === 0 || file.size > MAX_FILE_BYTES,
    );
    if (invalid || totalBytes > MAX_TOTAL_BYTES) {
      setDrafts([]);
      setError(
        "Choose non-empty PNG, JPEG, WebP, or PDF files no larger than 25 MiB each and 100 MiB total.",
      );
      return;
    }
    setDrafts(
      files.map((file) => {
        const mediaType = mediaTypeFromFile(file)!;
        return {
          altText: "",
          artifactKind: mediaType === "application/pdf" ? "document" : "image",
          description: "",
          file,
          id: randomId(),
          mediaType,
          title: titleFromFilename(file.name),
        };
      }),
    );
  }

  async function validateAndPreview() {
    if (busy || drafts.length === 0) return;
    if (drafts.some((draft) => !draft.title.trim())) {
      setError("Give every Artifact a title before validation.");
      return;
    }
    setBusy(true);
    setError(undefined);
    try {
      const staged = await buildOrdinaryArtifactPackage(drafts);
      const next = await stageArtifactPackage(campaignId, staged.manifest, staged.files);
      previewRef.current = next;
      setPreview(next);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The files could not be validated. Your choices were preserved.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      aria-label="Upload Artifacts"
      aria-busy={busy}
      style={{
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: 12,
        padding: "1rem",
      }}
    >
      <div>
        <h3 style={{ margin: 0 }}>Upload Artifacts</h3>
        <p style={{ color: "#5e5a50", marginBottom: 0 }}>
          Choose one or more files, confirm what each Artifact means, then review validation before
          accepting. New Artifacts begin private.
        </p>
      </div>
      <label>
        Files
        <input
          ref={fileInput}
          accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
          disabled={busy}
          multiple
          onChange={(event) => void chooseFiles(Array.from(event.target.files ?? []))}
          type="file"
        />
      </label>
      {error ? <p role="alert">{error}</p> : null}
      {drafts.length > 0 ? (
        <div style={{ display: "grid", gap: 12 }}>
          <div>
            <h4 style={{ marginBottom: 4 }}>Review files</h4>
            <p style={{ color: "#5e5a50", margin: 0 }}>
              File format and size are derived. Kind and descriptive details stay under your
              control. Alt text is optional and can be added later.
            </p>
          </div>
          {drafts.map((draft) => (
            <article
              key={draft.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 8,
                display: "grid",
                gap: 8,
                padding: 12,
              }}
            >
              <div>
                <strong>{draft.file.name}</strong>
                <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
                  {draft.mediaType} · {formatBytes(draft.file.size)}
                </div>
              </div>
              <label>
                Kind for {draft.file.name}
                <select
                  disabled={busy}
                  onChange={(event) =>
                    updateDraft(draft.id, { artifactKind: event.target.value as ArtifactKind })
                  }
                  value={draft.artifactKind}
                >
                  <option value="map">Map</option>
                  <option value="image">Image</option>
                  <option value="portrait">Portrait</option>
                  <option value="document">Document</option>
                  <option value="handout">Handout</option>
                </select>
              </label>
              <label>
                Title for {draft.file.name}
                <input
                  disabled={busy}
                  maxLength={200}
                  onChange={(event) => updateDraft(draft.id, { title: event.target.value })}
                  required
                  value={draft.title}
                />
              </label>
              <label>
                Description for {draft.file.name} (optional)
                <textarea
                  disabled={busy}
                  maxLength={4000}
                  onChange={(event) => updateDraft(draft.id, { description: event.target.value })}
                  value={draft.description}
                />
              </label>
              <label>
                Alt text for {draft.file.name} (optional)
                <input
                  disabled={busy}
                  maxLength={1000}
                  onChange={(event) => updateDraft(draft.id, { altText: event.target.value })}
                  value={draft.altText}
                />
              </label>
              <button
                disabled={busy}
                onClick={() => {
                  setDrafts((current) => current.filter((candidate) => candidate.id !== draft.id));
                  void discardPreview();
                }}
                type="button"
              >
                Remove {draft.file.name}
              </button>
            </article>
          ))}
          <button
            disabled={busy || drafts.some((draft) => !draft.title.trim())}
            onClick={() => void validateAndPreview()}
            type="button"
          >
            {busy ? "Validating…" : "Validate and preview"}
          </button>
        </div>
      ) : null}
      {preview ? (
        <ArtifactImportReview
          key={`${preview.id}:${preview.previewToken}:${preview.state}`}
          campaignId={campaignId}
          initial={preview}
          onAccepted={async () => {
            await onAccepted();
            setDrafts([]);
            if (fileInput.current) fileInput.current.value = "";
          }}
        />
      ) : null}
    </section>
  );
}
