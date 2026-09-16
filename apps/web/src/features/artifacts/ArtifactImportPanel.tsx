"use client";
import { useEffect, useRef, useState } from "react";
import {
  artifactPackageSchema,
  type ArtifactPackage,
  type ArtifactImportPreview,
} from "@glantri/domain";
import {
  acceptArtifactImport,
  artifactImportResourceUrl,
  cleanupArtifactImport,
  listArtifactImports,
  loadArtifactImport,
  reviewArtifactImport,
  stageArtifactPackage,
} from "@/lib/api/artifactClient";
const acceptedLabels = {
  create: "Created",
  update: "Updated",
  present: "Already present",
  conflict: "Conflict",
  invalid: "Invalid",
};
const labels = {
  create: "Create",
  update: "Update candidate",
  present: "Already present",
  conflict: "Conflict",
  invalid: "Invalid",
};
export function ArtifactImportReview({
  campaignId,
  initial,
  onAccepted,
}: {
  campaignId: string;
  initial: ArtifactImportPreview;
  onAccepted: () => Promise<void>;
}) {
  const [preview, setPreview] = useState(initial),
    [approved, setApproved] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const pending = useRef(false);
  useEffect(() => {
    setPreview(initial);
    setApproved([]);
    setError(undefined);
  }, [initial]);
  async function act(action: () => Promise<ArtifactImportPreview>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(undefined);
    try {
      const next = await action();
      setPreview(next);
      setApproved([]);
      if (next.state === "accepted") await onAccepted();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Unable to complete import. Review and try again.",
      );
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  const selected = preview.items.filter((x) => x.selected);
  return (
    <section
      aria-label="Artifact import review"
      aria-busy={busy}
      style={{ display: "grid", gap: 12, minWidth: 0 }}
    >
      <h3>{preview.title}</h3>
      {preview.state === "accepted" ? (
        <p role="status">
          Accepted: {Object.keys(preview.result ?? {}).length} Artifacts. New Artifacts are private
          until explicitly shared. Existing sharing was preserved.
        </p>
      ) : (
        <p>
          Proposed content — nothing is accepted yet. Updates create a new version of the same
          Artifact; existing uses will show the new media.
        </p>
      )}
      {error || preview.error ? <p role="alert">{error ?? preview.error}</p> : null}
      {preview.items.map((item) => (
        <article
          key={item.id}
          style={{
            border: "1px solid #d9ddd8",
            borderRadius: 8,
            padding: 12,
            overflowWrap: "anywhere",
          }}
        >
          <label>
            <input
              type="checkbox"
              checked={item.selected}
              disabled={busy || !item.optional || preview.state !== "review"}
              onChange={(event) => {
                const ids = event.target.checked
                  ? [...selected.map((x) => x.id), item.id]
                  : selected.filter((x) => x.id !== item.id).map((x) => x.id);
                setApproved([]);
                void act(() => reviewArtifactImport(campaignId, preview.id, ids));
              }}
            />{" "}
            {item.title}
          </label>
          <p>
            {!item.selected
              ? "Excluded"
              : preview.state === "accepted"
                ? acceptedLabels[item.status]
                : labels[item.status]}
            {!item.optional ? " · Required" : ""}
          </p>
          {item.existingTitle ? (
            <p>
              {preview.state === "accepted" && item.status === "update"
                ? "Previous title"
                : "Existing Artifact"}
              : {item.existingTitle}
            </p>
          ) : null}
          {item.reasons.map((reason) => (
            <p key={reason}>{reason}</p>
          ))}
          {item.resourceId && preview.state === "review" ? (
            <a
              href={artifactImportResourceUrl(campaignId, preview.id, item.resourceId)}
              target="_blank"
              rel="noreferrer"
            >
              Inspect proposed media
            </a>
          ) : null}
          {item.selected && item.status === "update" && preview.state === "review" ? (
            <label style={{ display: "block", marginTop: 8 }}>
              <input
                type="checkbox"
                checked={approved.includes(item.id)}
                disabled={busy}
                onChange={(event) =>
                  setApproved(
                    event.target.checked
                      ? [...approved, item.id]
                      : approved.filter((x) => x !== item.id),
                  )
                }
              />{" "}
              Approve updating {item.title} as the same authored Artifact
            </label>
          ) : null}
        </article>
      ))}
      {preview.state === "review" ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void act(() =>
                reviewArtifactImport(
                  campaignId,
                  preview.id,
                  selected.map((x) => x.id),
                ),
              )
            }
          >
            Refresh validation
          </button>
          <button
            type="button"
            disabled={
              busy ||
              !preview.valid ||
              selected.some((x) => x.status === "update" && !approved.includes(x.id))
            }
            onClick={() => void act(() => acceptArtifactImport(campaignId, preview, approved))}
          >
            {busy ? "Working…" : "Accept selected Artifacts"}
          </button>
        </div>
      ) : null}
    </section>
  );
}
export function ArtifactImportPanel({
  campaignId,
  onAccepted,
}: {
  campaignId: string;
  onAccepted: () => Promise<void>;
}) {
  const [manifest, setManifest] = useState<ArtifactPackage>(),
    [files, setFiles] = useState<Record<string, File>>({}),
    [preview, setPreview] = useState<ArtifactImportPreview>(),
    [error, setError] = useState<string>(),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState<Awaited<ReturnType<typeof listArtifactImports>>>([]);
  const pending = useRef(false);
  const refreshHistory = () => listArtifactImports(campaignId).then(setHistory);
  useEffect(() => {
    void listArtifactImports(campaignId)
      .then(setHistory)
      .catch(() => undefined);
  }, [campaignId]);
  return (
    <details>
      <summary>Import Artifact package</summary>
      <div style={{ display: "grid", gap: 12, minWidth: 0 }}>
        <p>
          Choose a package manifest and its named resources. Only Artifacts can be accepted. PNG,
          JPEG, WebP and PDF; up to 25 MiB per file and 100 MiB total.
        </p>
        <label>
          Package manifest{" "}
          <input
            type="file"
            accept=".json,application/json"
            disabled={busy}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                if (file.size > 1024 * 1024) throw new Error("Manifest exceeds 1 MiB.");
                setManifest(artifactPackageSchema.parse(JSON.parse(await file.text())));
                setFiles({});
                setPreview(undefined);
                setError(undefined);
              } catch {
                setError("Choose a valid Artifact package manifest, no larger than 1 MiB.");
              }
            }}
            style={{ maxWidth: "100%" }}
          />
        </label>
        {manifest?.resources.map((resource) => (
          <label key={resource.id}>
            Resource: {resource.id}{" "}
            <input
              type="file"
              accept={resource.mediaType}
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) setFiles({ ...files, [resource.id]: file });
              }}
              style={{ maxWidth: "100%" }}
            />
          </label>
        ))}
        {error ? <p role="alert">{error}</p> : null}
        <button
          type="button"
          disabled={!manifest || busy || manifest.resources.some((x) => !files[x.id])}
          onClick={async () => {
            if (!manifest || pending.current) return;
            pending.current = true;
            setBusy(true);
            setError(undefined);
            try {
              setPreview(await stageArtifactPackage(campaignId, manifest, files));
              await refreshHistory();
            } catch (error) {
              setError(
                error instanceof Error
                  ? error.message
                  : "Upload failed. Your file choices were preserved.",
              );
            } finally {
              pending.current = false;
              setBusy(false);
            }
          }}
        >
          Validate and preview package
        </button>
        {preview ? (
          <ArtifactImportReview
            key={`${preview.id}:${preview.previewToken}:${preview.state}`}
            campaignId={campaignId}
            initial={preview}
            onAccepted={async () => {
              await onAccepted();
              await refreshHistory();
            }}
          />
        ) : null}
        <h3>Import history</h3>
        {history.length === 0 ? (
          <p>No imports yet.</p>
        ) : (
          history.map((item) => (
            <div key={item.id} style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <span>
                {item.title} ·{" "}
                {item.state === "accepted"
                  ? "Accepted"
                  : item.state === "review"
                    ? "Awaiting review"
                    : "Not accepted"}{" "}
                · {new Date(item.createdAt).toLocaleString()}
              </span>
              <button
                type="button"
                onClick={() =>
                  void loadArtifactImport(campaignId, item.id)
                    .then(setPreview)
                    .catch((error) => setError(error.message))
                }
              >
                Review record
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const result = await cleanupArtifactImport(campaignId, item.id);
                    setError(
                      result.cleanupPending
                        ? "Private cleanup is still pending. Try again when storage is available."
                        : undefined,
                    );
                    await refreshHistory();
                    if (preview?.id === item.id)
                      setPreview(await loadArtifactImport(campaignId, item.id));
                  } catch (error) {
                    setError(error instanceof Error ? error.message : "Cleanup failed.");
                  }
                }}
              >
                {item.state === "accepted" ? "Remove unused staging" : "Discard staged package"}
              </button>
            </div>
          ))
        )}
      </div>
    </details>
  );
}
