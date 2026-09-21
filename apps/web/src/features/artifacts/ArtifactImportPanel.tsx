"use client";
import { useEffect, useRef, useState } from "react";
import {
  artifactPackageSchema,
  type ArtifactImportPreviewItem,
  type ArtifactPackage,
  type ArtifactImportPreview,
  type ArtifactRelationshipBinding,
  type ArtifactRelationshipTarget,
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
function candidateValue(candidate: { kind: string; id: string }): string {
  return `${candidate.kind}:${candidate.id}`;
}

function candidateTarget(value: string): ArtifactRelationshipTarget | null {
  const [kind, ...rest] = value.split(":");
  const id = rest.join(":");
  if (kind === "item") return { kind: "item", itemId: id };
  if (kind === "artifact") return { kind: "artifact", artifactId: id };
  if (kind === "local") return { kind: "local", id };
  return null;
}

const relationshipHeadings: Record<string, string> = {
  ambiguous: "Relationship — ambiguous, not resolved",
  bound: "Relationship — bound by you",
  cleared: "Relationship — cleared",
  not_found: "Relationship — no match, not resolved",
  resolved: "Relationship — proposed",
  unsupported: "Relationship — not supported here",
};

/** What Glantri derived, shown so the GM can confirm they never supplied it. */
function DerivedFacts({ item }: { item: ArtifactImportPreviewItem }) {
  if (!item.derived) return null;
  return (
    <dl style={{ display: "grid", fontSize: "0.85rem", gap: 2, margin: "8px 0 0" }}>
      <div>
        <dt style={{ display: "inline", fontWeight: 600 }}>Derived format: </dt>
        <dd style={{ display: "inline", margin: 0 }}>{item.derived.mediaType}</dd>
      </div>
      <div>
        <dt style={{ display: "inline", fontWeight: 600 }}>Derived size: </dt>
        <dd style={{ display: "inline", margin: 0 }}>{item.derived.byteSize} bytes</dd>
      </div>
      <div>
        <dt style={{ display: "inline", fontWeight: 600 }}>Derived SHA-256: </dt>
        <dd style={{ display: "inline", margin: 0, overflowWrap: "anywhere" }}>
          {item.derived.sha256}
        </dd>
      </div>
      <div>
        <dt style={{ display: "inline", fontWeight: 600 }}>Storage identity: </dt>
        <dd style={{ display: "inline", margin: 0, overflowWrap: "anywhere" }}>
          {item.derived.storageProvider}:{item.derived.storageKey}
        </dd>
      </div>
    </dl>
  );
}

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
    [bindings, setBindings] = useState<ArtifactRelationshipBinding[]>(initial.bindings ?? []),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string>();
  const pending = useRef(false);
  useEffect(() => {
    setPreview(initial);
    setApproved([]);
    setBindings(initial.bindings ?? []);
    setError(undefined);
  }, [initial]);
  function bind(objectId: string, target: ArtifactRelationshipTarget | null | undefined) {
    const next =
      target === undefined
        ? bindings.filter((entry) => entry.objectId !== objectId)
        : [...bindings.filter((entry) => entry.objectId !== objectId), { objectId, target }];
    setBindings(next);
    setApproved([]);
    void act(() =>
      reviewArtifactImport(
        campaignId,
        preview.id,
        preview.items.filter((x) => x.selected).map((x) => x.id),
        next,
      ),
    );
  }
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
  const acceptedIds = new Set(Object.keys(preview.result ?? {}));
  const accepted = {
    artifacts: preview.items.filter(
      (x) => acceptedIds.has(x.id) && (x.objectType ?? "Artifact") === "Artifact",
    ).length,
    items: preview.items.filter((x) => acceptedIds.has(x.id) && x.objectType === "Item").length,
  };
  return (
    <section
      aria-label="Artifact import review"
      aria-busy={busy}
      style={{ display: "grid", gap: 12, minWidth: 0 }}
    >
      <h3>{preview.title}</h3>
      {preview.state === "accepted" ? (
        <p role="status">
          Accepted: {accepted.artifacts} Artifacts
          {accepted.items ? ` and ${accepted.items} Items` : ""}. New Artifacts are private until
          explicitly shared. Existing sharing was preserved.
        </p>
      ) : (
        <p>
          Proposed content — nothing exists in the Campaign yet. Confirming is what creates
          canonical state. Updates create a new version of the same Artifact; existing uses will
          show the new media.
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
                void act(() => reviewArtifactImport(campaignId, preview.id, ids, bindings));
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
            {item.objectType
              ? ` · ${
                  item.objectType === "Item"
                    ? item.attachedObjectIds?.length || item.attachedArtifactIds?.length
                      ? "Canonical Item with attached Artifact representation"
                      : "Canonical Item"
                    : "Artifact"
                }`
              : ""}
          </p>
          {item.itemDescription ? <p>{item.itemDescription}</p> : null}
          {item.gmNotes ? (
            <p style={{ whiteSpace: "pre-wrap" }}>
              <strong>GM notes (never player-facing): </strong>
              {item.gmNotes}
            </p>
          ) : null}
          {item.relationship ? (
            <div
              style={{ border: "1px dashed #b9bdb6", borderRadius: 6, marginTop: 8, padding: 8 }}
            >
              <p style={{ margin: 0 }}>
                <strong>{relationshipHeadings[item.relationship.status]}</strong>
              </p>
              <p style={{ margin: "4px 0" }}>{item.relationship.explanation}</p>
              {preview.state === "review" ? (
                <label style={{ display: "block" }}>
                  Link {item.title} to
                  <select
                    disabled={busy}
                    onChange={(event) =>
                      bind(
                        item.id,
                        event.target.value === "__cleared__"
                          ? null
                          : event.target.value === "__suggested__"
                            ? undefined
                            : candidateTarget(event.target.value),
                      )
                    }
                    value={
                      bindings.find((entry) => entry.objectId === item.id)
                        ? bindings.find((entry) => entry.objectId === item.id)!.target === null
                          ? "__cleared__"
                          : candidateValue(
                              bindings.find((entry) => entry.objectId === item.id)!
                                .target as unknown as { id: string; kind: string },
                            )
                        : "__suggested__"
                    }
                  >
                    <option value="__suggested__">Whatever Glantri proposed</option>
                    {item.relationship.candidates.map((candidate) => (
                      <option key={candidateValue(candidate)} value={candidateValue(candidate)}>
                        {candidate.label} ({candidate.kind})
                      </option>
                    ))}
                    <option value="__cleared__">Do not link anything</option>
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}
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
          {(item.warnings ?? []).map((warning) => (
            <p key={warning} role="note">
              {warning}
            </p>
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
          <DerivedFacts item={item} />
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
                  bindings,
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
            {busy
              ? "Working…"
              : selected.some((x) => x.objectType === "Item")
                ? "Confirm and create selected content"
                : "Accept selected Artifacts"}
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
  const manifestRead = useRef(0);
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
              const read = ++manifestRead.current;
              setManifest(undefined);
              setFiles({});
              setPreview(undefined);
              setError(undefined);
              if (!file) return;
              try {
                if (file.size > 1024 * 1024) throw new Error("Manifest exceeds 1 MiB.");
                const next = artifactPackageSchema.parse(JSON.parse(await file.text()));
                if (read === manifestRead.current) setManifest(next);
              } catch {
                if (read === manifestRead.current)
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
                setPreview(undefined);
                setError(undefined);
                setFiles((current) => {
                  const next = { ...current };
                  if (file) next[resource.id] = file;
                  else delete next[resource.id];
                  return next;
                });
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
            setPreview(undefined);
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
