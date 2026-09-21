"use client";

import { useRef, useState } from "react";
import { AI_INTAKE_FORMAT_INSTRUCTIONS, type ArtifactImportPreview } from "@glantri/domain";

import { cleanupArtifactImport, stageArtifactPackage } from "@/lib/api/artifactClient";
import { ArtifactImportReview } from "../ArtifactImportPanel";
import { formatBytes } from "../artifactPackageDerivation";
import { buildIntakeProposal, planIntake } from "./intakeProposal";

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: 12,
  minWidth: 0,
  padding: "1rem",
} as const;

export function AiIntakePanel({
  campaignId,
  onAccepted,
}: {
  campaignId: string;
  onAccepted: () => Promise<void>;
}) {
  const [context, setContext] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [problems, setProblems] = useState<string[]>([]);
  const [notice, setNotice] = useState<string>();
  const [preview, setPreview] = useState<ArtifactImportPreview>();
  const [busy, setBusy] = useState(false);
  const [showFormat, setShowFormat] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const contextInput = useRef<HTMLInputElement>(null);
  const previewRef = useRef<ArtifactImportPreview | undefined>(undefined);

  async function discardPreview() {
    const current = previewRef.current;
    if (!current) return;
    previewRef.current = undefined;
    setPreview(undefined);
    try {
      await cleanupArtifactImport(campaignId, current.id);
    } catch {
      setProblems(["The previous staged proposal could not be discarded yet. Try again."]);
    }
  }

  function changed(apply: () => void) {
    setProblems([]);
    setNotice(undefined);
    apply();
    void discardPreview();
  }

  async function stage() {
    if (busy) return;
    setBusy(true);
    setProblems([]);
    setNotice(undefined);
    try {
      await discardPreview();
      const planned = planIntake(context, files);
      if (!planned.ok) {
        setProblems(planned.problems);
        return;
      }
      const proposal = await buildIntakeProposal(planned.plan);
      const staged = await stageArtifactPackage(campaignId, proposal.manifest, proposal.files);
      previewRef.current = staged;
      setPreview(staged);
    } catch (caught) {
      setProblems([
        caught instanceof Error
          ? caught.message
          : "The proposal could not be staged. Nothing was created.",
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-label="AI-assisted intake" aria-busy={busy} style={panelStyle}>
      <div>
        <h3 style={{ margin: 0 }}>Bring in material from an AI conversation</h3>
        <p style={{ color: "#5e5a50", marginBottom: 0 }}>
          Paste the semantic context your assistant produced and choose the files it describes.
          Glantri derives every technical detail itself and stages a proposal. Nothing is created in
          the Campaign until you confirm it below.
        </p>
      </div>

      <div>
        <button type="button" onClick={() => setShowFormat((current) => !current)}>
          {showFormat ? "Hide the format to ask for" : "Show the format to ask for"}
        </button>
        {showFormat ? (
          <>
            <p style={{ color: "#5e5a50" }}>
              Give this to your assistant, then paste its reply below.
            </p>
            <textarea
              aria-label="Format instructions for an AI assistant"
              readOnly
              rows={16}
              style={{ fontFamily: "monospace", maxWidth: "100%", width: "100%" }}
              value={AI_INTAKE_FORMAT_INSTRUCTIONS}
            />
          </>
        ) : null}
      </div>

      <label style={{ display: "grid", gap: 4 }}>
        Pasted context
        <textarea
          disabled={busy}
          onChange={(event) => changed(() => setContext(event.target.value))}
          placeholder='{"format":"glantri-intake","version":1,"entries":[…]}'
          rows={8}
          style={{ maxWidth: "100%", width: "100%" }}
          value={context}
        />
      </label>

      <label>
        Context file (optional)
        <input
          ref={contextInput}
          accept=".json,.txt,application/json,text/plain"
          disabled={busy}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            if (file.size > 256 * 1024) {
              setProblems(["The context file is larger than 256 KiB."]);
              return;
            }
            const text = await file.text();
            changed(() => setContext(text));
            setNotice(`Loaded the context from “${file.name}”. Review it above before staging.`);
          }}
          style={{ maxWidth: "100%" }}
          type="file"
        />
      </label>

      <label>
        Files described by the context
        <input
          ref={fileInput}
          accept=".png,.jpg,.jpeg,.webp,.pdf,image/png,image/jpeg,image/webp,application/pdf"
          disabled={busy}
          multiple
          onChange={(event) => changed(() => setFiles(Array.from(event.target.files ?? [])))}
          style={{ maxWidth: "100%" }}
          type="file"
        />
      </label>

      {files.length ? (
        <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
          {files.map((file) => (
            <li key={`${file.name}:${file.size}:${file.lastModified}`}>
              {file.name} · {formatBytes(file.size)}
            </li>
          ))}
        </ul>
      ) : null}

      {notice ? <p role="status">{notice}</p> : null}
      {problems.length ? (
        <div role="alert" style={{ display: "grid", gap: 4 }}>
          <strong>This context was not staged.</strong>
          <ul style={{ margin: 0, paddingLeft: "1.2rem" }}>
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <button disabled={busy || !context.trim()} onClick={() => void stage()} type="button">
        {busy ? "Staging…" : "Validate and stage a proposal"}
      </button>

      {preview ? (
        <>
          <ArtifactImportReview
            key={`${preview.id}:${preview.previewToken}:${preview.state}`}
            campaignId={campaignId}
            initial={preview}
            onAccepted={async () => {
              await onAccepted();
              previewRef.current = undefined;
              setContext("");
              setFiles([]);
              if (fileInput.current) fileInput.current.value = "";
              if (contextInput.current) contextInput.current.value = "";
            }}
          />
          {preview.state === "review" ? (
            <button
              disabled={busy}
              onClick={() => {
                setBusy(true);
                void discardPreview().finally(() => {
                  setBusy(false);
                  setNotice("The staged proposal was abandoned. Nothing was created.");
                });
              }}
              type="button"
            >
              Abandon this proposal
            </button>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
