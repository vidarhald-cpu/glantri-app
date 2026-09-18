"use client";

import { useRef, useState } from "react";
import {
  artifactPackageSchema,
  ORDINARY_ARTIFACT_UPLOAD_PRODUCER,
  type ArtifactImportPreview,
  type ArtifactKind,
  type ArtifactMediaType,
  type ArtifactPackage,
} from "@glantri/domain";
import { cleanupArtifactImport, stageArtifactPackage } from "@/lib/api/artifactClient";
import { ArtifactImportReview } from "./ArtifactImportPanel";

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const MAX_FILES = 100;

export interface OrdinaryArtifactDraft {
  altText: string;
  artifactKind: ArtifactKind;
  description: string;
  file: File;
  id: string;
  mediaType: ArtifactMediaType;
  title: string;
}

function mediaTypeFromFile(file: File): ArtifactMediaType | undefined {
  const declared = file.type.toLowerCase().split(";", 1)[0]?.trim();
  if (["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(declared))
    return declared as ArtifactMediaType;
  const extension = file.name.toLowerCase().match(/\.([^.]+)$/)?.[1];
  if (extension === "png") return "image/png";
  if (["jpg", "jpeg"].includes(extension ?? "")) return "image/jpeg";
  if (extension === "webp") return "image/webp";
  if (extension === "pdf") return "application/pdf";
  return undefined;
}

function titleFromFilename(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  return withoutExtension.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "Untitled Artifact";
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${bytes} bytes`;
}

async function digestFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function buildOrdinaryArtifactPackage(
  drafts: OrdinaryArtifactDraft[],
): Promise<{ files: Record<string, File>; manifest: ArtifactPackage }> {
  const resources = await Promise.all(
    drafts.map(async (draft, index) => ({
      id: `resource-${index + 1}`,
      mediaType: draft.mediaType,
      sha256: await digestFile(draft.file),
    })),
  );
  const manifest = artifactPackageSchema.parse({
    schemaVersion: 1,
    producer: ORDINARY_ARTIFACT_UPLOAD_PRODUCER,
    packageId: `ordinary-${crypto.randomUUID()}`,
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
  return {
    manifest,
    files: Object.fromEntries(
      drafts.map((draft, index) => {
        const resource = resources[index]!;
        const file =
          draft.file.type === resource.mediaType
            ? draft.file
            : new File([draft.file], draft.file.name, {
                lastModified: draft.file.lastModified,
                type: resource.mediaType,
              });
        return [resource.id, file];
      }),
    ),
  };
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
          id: crypto.randomUUID(),
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
