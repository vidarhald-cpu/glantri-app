"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type {
  ArtifactBlackboardCandidate,
  BlackboardCategory,
  BlackboardCommonDto,
  BlackboardCommonEntry,
  BlackboardPlacementDto,
} from "@glantri/domain";

import { artifactContentUrl } from "@/lib/api/artifactClient";
import { ApiRequestError } from "@/lib/api/apiClient";
import {
  createBlackboardEntry,
  loadBlackboard,
  loadBlackboardArtifactCandidates,
  loadBlackboardHistory,
  moveBlackboardEntry,
  pinBlackboardEntry,
  retractBlackboardEntry,
  reviseBlackboardEntry,
  unpinBlackboardEntry,
  type BlackboardSafeHistory,
} from "@/lib/api/blackboardClient";

import styles from "./BlackboardWorkspace.module.css";

interface BlackboardWorkspaceProps {
  campaignId: string;
  isGameMaster: boolean;
}

interface EntryDraft {
  category: BlackboardCategory;
  context: string;
  sourceArtifactId: string;
  text: string;
  title: string;
}

const emptyDraft: EntryDraft = {
  category: "clue_fact",
  context: "",
  sourceArtifactId: "",
  text: "",
  title: "",
};

const categoryLabels: Record<BlackboardCategory, string> = {
  clue_fact: "Clue",
  document_text: "Document",
  image_map: "Map or image",
  recap: "Recap",
};

function displayDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function entrySummary(entry: BlackboardCommonEntry): string {
  switch (entry.category) {
    case "clue_fact":
      return entry.fact;
    case "document_text":
      return entry.documentText;
    case "image_map":
      return entry.caption ?? entry.artifact.altText;
    case "recap":
      return entry.recapText;
  }
}

function historySummary(revision: BlackboardSafeHistory["revisions"][number]): string {
  switch (revision.content.category) {
    case "clue_fact":
      return revision.content.fact;
    case "document_text":
      return revision.content.documentText;
    case "image_map":
      return revision.content.caption ?? revision.content.artifact.altText;
    case "recap":
      return revision.content.recapText;
  }
}

function draftFromEntry(entry: BlackboardCommonEntry): EntryDraft {
  switch (entry.category) {
    case "clue_fact":
      return {
        category: entry.category,
        context: entry.context ?? "",
        sourceArtifactId: "",
        text: entry.fact,
        title: entry.title,
      };
    case "document_text":
      return {
        category: entry.category,
        context: entry.context ?? "",
        sourceArtifactId: "",
        text: entry.documentText,
        title: entry.title,
      };
    case "image_map":
      return {
        category: entry.category,
        context: entry.caption ?? "",
        sourceArtifactId: entry.artifact.id,
        text: "",
        title: entry.title,
      };
    case "recap":
      return {
        category: entry.category,
        context: "",
        sourceArtifactId: "",
        text: entry.recapText,
        title: entry.title,
      };
  }
}

function buildCreateContent(draft: EntryDraft) {
  switch (draft.category) {
    case "clue_fact":
      return {
        category: draft.category,
        ...(draft.context.trim() ? { context: draft.context.trim() } : {}),
        fact: draft.text.trim(),
        title: draft.title.trim(),
      } as const;
    case "document_text":
      return {
        category: draft.category,
        ...(draft.context.trim() ? { context: draft.context.trim() } : {}),
        documentText: draft.text.trim(),
        title: draft.title.trim(),
      } as const;
    case "image_map":
      return {
        ...(draft.context.trim() ? { caption: draft.context.trim() } : {}),
        category: draft.category,
        sourceArtifactId: draft.sourceArtifactId,
        title: draft.title.trim(),
      } as const;
    case "recap":
      return {
        category: draft.category,
        recapText: draft.text.trim(),
        title: draft.title.trim(),
      } as const;
  }
}

export function BlackboardWorkspace({ campaignId, isGameMaster }: BlackboardWorkspaceProps) {
  const [board, setBoard] = useState<BlackboardCommonDto>();
  const [artifacts, setArtifacts] = useState<ArtifactBlackboardCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [composerMode, setComposerMode] = useState<"create" | "correct">();
  const [revisionKind, setRevisionKind] = useState<"correction" | "replacement">("correction");
  const [draft, setDraft] = useState<EntryDraft>(emptyDraft);
  const [history, setHistory] = useState<BlackboardSafeHistory>();
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [artifactNotice, setArtifactNotice] = useState<string>();
  const [confirmRetract, setConfirmRetract] = useState(false);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const catalogueButtons = useRef(new Map<string, HTMLButtonElement>());

  const refreshBoard = useCallback(async () => {
    const nextBoard = await loadBlackboard(campaignId);
    setBoard(nextBoard);
    return nextBoard;
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    void Promise.all([
      loadBlackboard(campaignId),
      loadBlackboardArtifactCandidates(campaignId).catch(() => {
        if (!cancelled) {
          setArtifactNotice(
            "Maps and images are temporarily unavailable. Other Blackboard entries still work.",
          );
        }
        return [];
      }),
    ])
      .then(([nextBoard, nextArtifacts]) => {
        if (cancelled) return;
        setBoard(nextBoard);
        setArtifacts(nextArtifacts);
      })
      .catch(() => {
        if (!cancelled) {
          setError(
            "The Blackboard could not be loaded. Nothing was changed. Try again when the Campaign is available.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const selectedEntry = board?.catalogue.find((entry) => entry.id === selectedId);
  const selectedTombstone = board?.tombstones.find((entry) => entry.id === selectedId);
  const selectedPlacement = board?.layout.placements.find(
    (placement) => placement.entryId === selectedId,
  );
  const pinnedRecords = useMemo(() => {
    if (!board) return [];
    return board.layout.placements.map((placement) => ({
      entry: board.catalogue.find((entry) => entry.id === placement.entryId),
      placement,
      tombstone: board.tombstones.find((entry) => entry.id === placement.entryId),
    }));
  }, [board]);

  useEffect(() => {
    if (selectedId) detailHeadingRef.current?.focus();
  }, [selectedId]);

  function selectEntry(entryId: string) {
    setComposerMode(undefined);
    setConfirmRetract(false);
    setHistory(undefined);
    setSelectedId(entryId);
  }

  function returnToList() {
    const previousId = selectedId;
    setSelectedId(undefined);
    setComposerMode(undefined);
    setConfirmRetract(false);
    window.requestAnimationFrame(() => {
      if (previousId) catalogueButtons.current.get(previousId)?.focus();
    });
  }

  function beginCreate() {
    setDraft({ ...emptyDraft, sourceArtifactId: artifacts[0]?.id ?? "" });
    setComposerMode("create");
    setRevisionKind("correction");
    setSelectedId(undefined);
    setHistory(undefined);
    setConfirmRetract(false);
    setError(undefined);
  }

  function beginCorrection() {
    if (!selectedEntry) return;
    setDraft(draftFromEntry(selectedEntry));
    setComposerMode("correct");
    setRevisionKind("correction");
    setConfirmRetract(false);
    setError(undefined);
  }

  async function handleConflict(caught: unknown, fallback: string) {
    if (caught instanceof ApiRequestError && caught.status === 409) {
      await refreshBoard().catch(() => undefined);
      setError(
        "The Blackboard changed elsewhere. Your draft was kept. Review the refreshed entry, then try again.",
      );
      return;
    }
    if (caught instanceof ApiRequestError && caught.status === 404) {
      await refreshBoard().catch(() => undefined);
      setError(
        "This entry is no longer available to change. Nothing was changed; the Blackboard has been refreshed.",
      );
      return;
    }
    setError(fallback);
  }

  async function saveDraft() {
    if (!draft.title.trim()) {
      setError("Give this reference a title.");
      return;
    }
    if (draft.category === "image_map" && !draft.sourceArtifactId) {
      setError("Choose a shared map or image.");
      return;
    }
    if (draft.category !== "image_map" && !draft.text.trim()) {
      setError(
        draft.category === "clue_fact"
          ? "Write the clue or fact to share."
          : draft.category === "document_text"
            ? "Add the document text to share."
            : "Add the approved recap text.",
      );
      return;
    }

    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const saved =
        composerMode === "correct" && selectedEntry
          ? await reviseBlackboardEntry({
              campaignId,
              content: {
                ...buildCreateContent(draft),
                changeKind: revisionKind,
                expectedEntryVersion: selectedEntry.entryVersion,
              },
              entryId: selectedEntry.id,
            })
          : await createBlackboardEntry({ campaignId, content: buildCreateContent(draft) });
      await refreshBoard();
      setSelectedId(saved.id);
      setComposerMode(undefined);
      setHistory(undefined);
      setNotice(
        composerMode === "correct"
          ? revisionKind === "correction"
            ? "Correction shared. Earlier shared text remains in History."
            : "Replacement shared. Earlier shared text remains in History."
          : "Reference shared with the Campaign.",
      );
    } catch (caught) {
      await handleConflict(caught, "The reference could not be saved. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshImageSnapshot() {
    if (!selectedEntry || selectedEntry.category !== "image_map") return;
    setBusy(true);
    setError(undefined);
    try {
      await reviseBlackboardEntry({
        campaignId,
        content: {
          category: "image_map",
          changeKind: "refresh",
          expectedEntryVersion: selectedEntry.entryVersion,
        },
        entryId: selectedEntry.id,
      });
      await refreshBoard();
      setHistory(undefined);
      setNotice("The shared map or image reference was refreshed explicitly.");
    } catch (caught) {
      await handleConflict(caught, "The shared reference could not be refreshed. Nothing changed.");
    } finally {
      setBusy(false);
    }
  }

  async function retractSelected() {
    if (!selectedEntry) return;
    setBusy(true);
    setError(undefined);
    try {
      await retractBlackboardEntry({
        campaignId,
        entryId: selectedEntry.id,
        expectedEntryVersion: selectedEntry.entryVersion,
      });
      await refreshBoard();
      setHistory(undefined);
      setConfirmRetract(false);
      setNotice("Reference removed. Its former content is no longer available on the Blackboard.");
    } catch (caught) {
      await handleConflict(caught, "The reference could not be removed. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  async function showHistory() {
    if (!selectedEntry) return;
    setHistoryLoading(true);
    setError(undefined);
    try {
      const result = await loadBlackboardHistory({ campaignId, entryId: selectedEntry.id });
      if ("revisions" in result) {
        setHistory(result);
      } else {
        await refreshBoard();
        setHistory(undefined);
        setError("This reference was removed. Its former content is no longer available.");
      }
    } catch {
      setError("History could not be loaded. The current shared reference is unchanged.");
    } finally {
      setHistoryLoading(false);
    }
  }

  async function runLayout(action: () => Promise<BlackboardCommonDto>, success: string) {
    setBusy(true);
    setError(undefined);
    try {
      setBoard(await action());
      setNotice(success);
    } catch (caught) {
      await handleConflict(caught, "The shared board layout could not be changed.");
    } finally {
      setBusy(false);
    }
  }

  function pinSelected() {
    if (!board || !selectedEntry) return;
    const index = board.layout.placements.length;
    void runLayout(
      () =>
        pinBlackboardEntry({
          campaignId,
          entryId: selectedEntry.id,
          expectedLayoutVersion: board.layout.version,
          height: 180,
          layer: Math.min(10000, index + 1),
          width: 260,
          x: (index % 3) * 280,
          y: Math.floor(index / 3) * 200,
        }),
      "Reference pinned to the shared board.",
    );
  }

  function unpin(placement: BlackboardPlacementDto) {
    if (!board) return;
    void runLayout(
      () =>
        unpinBlackboardEntry({
          campaignId,
          expectedLayoutVersion: board.layout.version,
          placement,
        }),
      "Reference unpinned. The catalogue entry remains available.",
    );
  }

  function move(placement: BlackboardPlacementDto, x: number, y: number) {
    if (!board) return;
    void runLayout(
      () =>
        moveBlackboardEntry({
          campaignId,
          expectedLayoutVersion: board.layout.version,
          placement,
          x,
          y,
        }),
      "Shared board arrangement updated.",
    );
  }

  if (loading) {
    return (
      <section aria-busy="true" aria-live="polite" className={styles.panel}>
        Loading the Campaign Blackboard…
      </section>
    );
  }

  if (!board) {
    return (
      <section className={styles.panel}>
        <div className={styles.error} role="alert">
          {error ?? "The Blackboard is unavailable."}
        </div>
        <button
          onClick={() => {
            setLoading(true);
            setError(undefined);
            void refreshBoard()
              .catch(() => setError("The Blackboard is still unavailable. Nothing was changed."))
              .finally(() => setLoading(false));
          }}
          type="button"
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className={styles.workspace}>
      <header className={styles.intro}>
        <div>
          <h2>Blackboard</h2>
          <p>Shared clues, documents, maps, images, and approved recaps for this Campaign.</p>
        </div>
        <button onClick={beginCreate} type="button">
          Share a reference
        </button>
      </header>

      {error ? (
        <div className={styles.error} role="alert">
          {error}
        </div>
      ) : null}
      {notice ? (
        <div className={styles.success} role="status">
          {notice}
        </div>
      ) : null}
      {artifactNotice ? (
        <div className={styles.notice} role="status">
          {artifactNotice}
        </div>
      ) : null}

      <section aria-label="Pinned Blackboard references" className={styles.board}>
        {pinnedRecords.length === 0 ? (
          <div className={styles.boardEmpty}>
            <strong>Nothing is pinned yet.</strong>
            <span>Choose a catalogue reference and pin it for the group.</span>
          </div>
        ) : (
          pinnedRecords.map(({ entry, placement, tombstone }) => (
            <article
              className={styles.pin}
              key={placement.entryId}
              style={{
                height: placement.height,
                left: placement.x + 16,
                top: placement.y + 16,
                width: placement.width,
                zIndex: placement.layer,
              }}
            >
              <button
                aria-label={`Open ${entry?.title ?? "removed reference"}`}
                className={styles.catalogueButton}
                onClick={() => selectEntry(placement.entryId)}
                type="button"
              >
                <span className={styles.pinTitle}>{entry?.title ?? "Removed reference"}</span>
                <span>
                  {entry ? categoryLabels[entry.category] : (tombstone?.state ?? "Removed")}
                </span>
                <span>
                  {entry ? entrySummary(entry).slice(0, 120) : "The shared content was removed."}
                </span>
              </button>
              <div aria-label="Arrange pinned reference" className={styles.moveRow}>
                <button
                  aria-label="Move left"
                  disabled={busy}
                  onClick={() => move(placement, placement.x - 40, placement.y)}
                  type="button"
                >
                  ←
                </button>
                <button
                  aria-label="Move up"
                  disabled={busy}
                  onClick={() => move(placement, placement.x, placement.y - 40)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label="Move down"
                  disabled={busy}
                  onClick={() => move(placement, placement.x, placement.y + 40)}
                  type="button"
                >
                  ↓
                </button>
                <button
                  aria-label="Move right"
                  disabled={busy}
                  onClick={() => move(placement, placement.x + 40, placement.y)}
                  type="button"
                >
                  →
                </button>
                <button disabled={busy} onClick={() => unpin(placement)} type="button">
                  Unpin
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {composerMode ? (
        <section className={styles.composer}>
          <div className={styles.headingRow}>
            <h3>{composerMode === "create" ? "Share a reference" : "Correct this reference"}</h3>
            <button onClick={() => setComposerMode(undefined)} type="button">
              Cancel
            </button>
          </div>
          <div className={styles.fields}>
            {composerMode === "correct" ? (
              <label>
                Change
                <select
                  onChange={(event) =>
                    setRevisionKind(event.target.value as "correction" | "replacement")
                  }
                  value={revisionKind}
                >
                  <option value="correction">Correct shared details</option>
                  <option value="replacement">Replace shared presentation</option>
                </select>
              </label>
            ) : null}
            <label>
              Kind
              <select
                disabled={composerMode === "correct"}
                onChange={(event) => {
                  const category = event.target.value as BlackboardCategory;
                  setDraft({
                    ...emptyDraft,
                    category,
                    sourceArtifactId: category === "image_map" ? (artifacts[0]?.id ?? "") : "",
                  });
                }}
                value={draft.category}
              >
                <option value="clue_fact">Clue</option>
                <option value="document_text">Document</option>
                <option value="image_map">Map or image</option>
                {isGameMaster ? <option value="recap">Approved recap</option> : null}
              </select>
            </label>
            <label>
              Title
              <input
                maxLength={200}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                value={draft.title}
              />
            </label>
            {draft.category === "image_map" ? (
              <>
                <label className={styles.fullField}>
                  Shared map or image
                  <select
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, sourceArtifactId: event.target.value }))
                    }
                    value={draft.sourceArtifactId}
                  >
                    <option value="">Choose a shared visual</option>
                    {artifacts.map((artifact) => (
                      <option key={artifact.id} value={artifact.id}>
                        {artifact.title} — {artifact.artifactKind}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.fullField}>
                  Caption or context (optional)
                  <textarea
                    maxLength={2000}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, context: event.target.value }))
                    }
                    value={draft.context}
                  />
                </label>
              </>
            ) : (
              <>
                <label className={styles.fullField}>
                  {draft.category === "clue_fact"
                    ? "Clue or fact"
                    : draft.category === "document_text"
                      ? "Document text"
                      : "Approved recap"}
                  <textarea
                    maxLength={draft.category === "clue_fact" ? 4000 : 20000}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, text: event.target.value }))
                    }
                    value={draft.text}
                  />
                </label>
                {draft.category !== "recap" ? (
                  <label className={styles.fullField}>
                    Context (optional)
                    <textarea
                      maxLength={2000}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, context: event.target.value }))
                      }
                      value={draft.context}
                    />
                  </label>
                ) : null}
              </>
            )}
          </div>
          <div className={styles.actionRow}>
            <span className={styles.muted}>
              Sharing adds a player reference only. It does not change Characters, Items, or play.
            </span>
            <button disabled={busy} onClick={() => void saveDraft()} type="button">
              {busy
                ? "Saving…"
                : composerMode === "create"
                  ? "Share reference"
                  : "Share correction"}
            </button>
          </div>
        </section>
      ) : null}

      <div className={styles.workspaceGrid} data-detail-open={Boolean(selectedId)}>
        <section className={styles.panel}>
          <div className={styles.headingRow}>
            <h3>Shared catalogue</h3>
            <span>{board.catalogue.length} current</span>
          </div>
          {board.catalogue.length === 0 ? (
            <p>No references have been shared yet.</p>
          ) : (
            <ul className={styles.catalogue}>
              {board.catalogue.map((entry) => (
                <li key={entry.id}>
                  <button
                    aria-current={selectedId === entry.id}
                    className={styles.catalogueButton}
                    onClick={() => selectEntry(entry.id)}
                    ref={(element) => {
                      if (element) catalogueButtons.current.set(entry.id, element);
                      else catalogueButtons.current.delete(entry.id);
                    }}
                    type="button"
                  >
                    <span className={styles.headingRow}>
                      <strong>{entry.title}</strong>
                      <span className={styles.category}>{categoryLabels[entry.category]}</span>
                    </span>
                    <span>{entrySummary(entry).slice(0, 150)}</span>
                    <span className={styles.muted}>{entry.state}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {board.tombstones.length > 0 ? (
            <>
              <h4>Removed</h4>
              <ul className={styles.tombstones}>
                {board.tombstones.map((entry) => (
                  <li key={entry.id}>
                    <button
                      className={styles.catalogueButton}
                      onClick={() => selectEntry(entry.id)}
                      ref={(element) => {
                        if (element) catalogueButtons.current.set(entry.id, element);
                        else catalogueButtons.current.delete(entry.id);
                      }}
                      type="button"
                    >
                      <strong>Removed reference</strong>
                      <span>Removed by {entry.removedByLabel}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className={styles.detail}>
          {selectedEntry ? (
            <>
              <button className={styles.narrowBack} onClick={returnToList} type="button">
                Back to shared catalogue
              </button>
              <header className={styles.detailHeader}>
                <div>
                  <span className={styles.category}>{categoryLabels[selectedEntry.category]}</span>
                  <h3 ref={detailHeadingRef} tabIndex={-1}>
                    {selectedEntry.title}
                  </h3>
                </div>
                <span className={styles.state}>{selectedEntry.state}</span>
              </header>
              <div className={styles.bodyText}>{entrySummary(selectedEntry)}</div>
              {selectedEntry.category === "clue_fact" && selectedEntry.context ? (
                <div className={styles.notice}>{selectedEntry.context}</div>
              ) : null}
              {selectedEntry.category === "document_text" && selectedEntry.context ? (
                <div className={styles.notice}>{selectedEntry.context}</div>
              ) : null}
              {selectedEntry.category === "image_map" ? (
                <>
                  {selectedEntry.sourceStatus === "source_unavailable" ? (
                    <div className={styles.notice} role="status">
                      This visual is no longer available. The shared title, caption, and description
                      remain as they were when posted.
                    </div>
                  ) : (
                    <img
                      alt={selectedEntry.artifact.altText}
                      className={styles.image}
                      src={artifactContentUrl(campaignId, selectedEntry.content!.artifactId)}
                    />
                  )}
                  {selectedEntry.sourceStatus === "source_changed" ? (
                    <div className={styles.notice} role="status">
                      The source details changed after this reference was shared. The Blackboard
                      still shows the shared snapshot until an authorized poster refreshes it.
                      <button
                        disabled={busy}
                        onClick={() => void refreshImageSnapshot()}
                        type="button"
                      >
                        Refresh shared reference
                      </button>
                    </div>
                  ) : null}
                </>
              ) : null}
              {selectedEntry.category === "recap" ? (
                <div className={styles.muted}>
                  Approved by {selectedEntry.approvedByLabel} on{" "}
                  {displayDate(selectedEntry.approvedAt)}
                </div>
              ) : null}
              <div className={styles.muted}>
                {selectedEntry.state === "Corrected" ? "Corrected" : "Shared"} by{" "}
                {selectedEntry.updatedByLabel} on {displayDate(selectedEntry.updatedAt)}
              </div>
              <div className={styles.actionRow}>
                {selectedPlacement ? (
                  <button disabled={busy} onClick={() => unpin(selectedPlacement)} type="button">
                    Unpin from board
                  </button>
                ) : (
                  <button disabled={busy} onClick={pinSelected} type="button">
                    Pin to board
                  </button>
                )}
                <button disabled={historyLoading} onClick={() => void showHistory()} type="button">
                  {historyLoading ? "Loading history…" : "History"}
                </button>
                {isGameMaster || selectedEntry.category !== "recap" ? (
                  <>
                    <button onClick={beginCorrection} type="button">
                      Correct this entry
                    </button>
                    <button onClick={() => setConfirmRetract(true)} type="button">
                      Remove this entry
                    </button>
                  </>
                ) : null}
              </div>
              {!isGameMaster && selectedEntry.category !== "recap" ? (
                <p className={styles.muted}>
                  You can correct or remove entries you posted. Other entries remain unchanged.
                </p>
              ) : null}
              {confirmRetract ? (
                <div className={styles.notice} role="alertdialog" aria-label="Remove reference">
                  <strong>Remove this shared reference?</strong>
                  <p>
                    Its content will disappear from the catalogue and History. A safe removed marker
                    will remain until the GM archives it.
                  </p>
                  <div className={styles.actionRow}>
                    <button onClick={() => setConfirmRetract(false)} type="button">
                      Keep reference
                    </button>
                    <button disabled={busy} onClick={() => void retractSelected()} type="button">
                      {busy ? "Removing…" : "Remove reference"}
                    </button>
                  </div>
                </div>
              ) : null}
              {history ? (
                <section aria-label="Reference history">
                  <h4>History</h4>
                  <ol className={styles.historyList}>
                    {[...history.revisions].reverse().map((revision) => (
                      <li className={styles.historyItem} key={revision.revisionNumber}>
                        <strong>
                          {revision.revisionNumber === history.currentEntryVersion
                            ? "Current shared version"
                            : `Earlier shared version ${revision.revisionNumber}`}
                          {` · ${
                            revision.changeKind === "initial"
                              ? "Shared"
                              : revision.changeKind === "correction"
                                ? "Corrected"
                                : revision.changeKind === "replacement"
                                  ? "Replaced"
                                  : "Refreshed"
                          }`}
                        </strong>
                        <span className={styles.bodyText}>{historySummary(revision)}</span>
                        <span className={styles.muted}>
                          {revision.changedByLabel} · {displayDate(revision.changedAt)}
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null}
            </>
          ) : selectedTombstone ? (
            <>
              <button className={styles.narrowBack} onClick={returnToList} type="button">
                Back to shared catalogue
              </button>
              <h3 ref={detailHeadingRef} tabIndex={-1}>
                Removed reference
              </h3>
              <div className={styles.notice}>
                This reference was removed by {selectedTombstone.removedByLabel} on{" "}
                {displayDate(selectedTombstone.removedAt)}. Its former content and history are no
                longer shared.
              </div>
              {selectedPlacement ? (
                <button disabled={busy} onClick={() => unpin(selectedPlacement)} type="button">
                  Unpin removed marker
                </button>
              ) : null}
            </>
          ) : (
            <>
              <h3>Choose a shared reference</h3>
              <p>
                Select an entry to read it, inspect its shared history, or pin it for the group.
              </p>
            </>
          )}
        </section>
      </div>
    </section>
  );
}
