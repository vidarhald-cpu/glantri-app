"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";

import type {
  ArtifactBlackboardCandidate,
  BlackboardCategory,
  BlackboardCommonDto,
  BlackboardCommonEntry,
  BlackboardPlacementDto,
  BlackboardSearchResult,
  BlackboardViewerCapabilities,
} from "@glantri/domain";

import { fetchArtifactBlob } from "@/lib/api/artifactClient";
import { ApiRequestError } from "@/lib/api/apiClient";
import {
  createBlackboardEntry,
  loadBlackboard,
  loadBlackboardCapabilities,
  loadBlackboardArtifactCandidates,
  loadBlackboardHistory,
  moveBlackboardEntry,
  pinBlackboardEntry,
  retractBlackboardEntry,
  reviseBlackboardEntry,
  searchBlackboard,
  unpinBlackboardEntry,
  type BlackboardSafeHistory,
} from "@/lib/api/blackboardClient";

import { FullViewportInspection } from "@/features/artifacts/inspection";

import { ArtifactInspectionViewport } from "./ArtifactInspectionViewport";
import styles from "./BlackboardWorkspace.module.css";
import { buildFocusedBlackboardHref } from "./blackboardInspectionRoute";

interface BlackboardWorkspaceProps {
  artifactInspection?: boolean;
  campaignId: string;
  isGameMaster: boolean;
  onExitArtifact?: () => void;
  onExitFocused?: () => void;
  onInspectArtifact?: (entryId: string) => void;
  onRouteChange?: (route: BlackboardRouteState) => void;
  presentation?: "embedded" | "focused";
  routeCategory?: string | null;
  routeEntryId?: string | null;
  routePinned?: string | null;
  routeQuery?: string | null;
}

interface BlackboardRouteState {
  category?: BlackboardCategory;
  entryId?: string;
  pinned?: "pinned" | "unpinned";
  query: string;
}

interface EntryDraft {
  category: BlackboardCategory;
  context: string;
  sourceArtifactId: string;
  text: string;
  title: string;
}

type ArtifactViewState =
  | { status: "idle" | "loading" | "operational_unavailable" | "source_unavailable" }
  | { objectUrl: string; status: "ready" };

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

function routeCategory(value?: string | null): BlackboardCategory | undefined {
  return value && value in categoryLabels ? (value as BlackboardCategory) : undefined;
}

function routePinned(value?: string | null): "pinned" | "unpinned" | undefined {
  return value === "pinned" || value === "unpinned" ? value : undefined;
}

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

export function BlackboardWorkspace({
  artifactInspection = false,
  campaignId,
  isGameMaster,
  onExitArtifact,
  onExitFocused,
  onInspectArtifact,
  onRouteChange,
  presentation = "embedded",
  routeCategory: routeCategoryValue,
  routeEntryId,
  routePinned: routePinnedValue,
  routeQuery,
}: BlackboardWorkspaceProps) {
  const initialSearch = {
    category: routeCategory(routeCategoryValue),
    pinned: routePinned(routePinnedValue),
    query: routeQuery?.trim() ?? "",
  };
  const [board, setBoard] = useState<BlackboardCommonDto>();
  const [capabilities, setCapabilities] = useState<BlackboardViewerCapabilities>({ entries: [] });
  const [artifacts, setArtifacts] = useState<ArtifactBlackboardCandidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | undefined>(routeEntryId || undefined);
  const [appliedSearch, setAppliedSearch] = useState<BlackboardRouteState>(initialSearch);
  const [searchDraft, setSearchDraft] = useState<BlackboardRouteState>(initialSearch);
  const [searchResult, setSearchResult] = useState<BlackboardSearchResult>({ results: [] });
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string>();
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
  const [capabilityNotice, setCapabilityNotice] = useState<string>();
  const [artifactView, setArtifactView] = useState<ArtifactViewState>({ status: "idle" });
  const [artifactRetry, setArtifactRetry] = useState(0);
  const [confirmRetract, setConfirmRetract] = useState(false);
  const detailHeadingRef = useRef<HTMLHeadingElement>(null);
  const composerHeadingRef = useRef<HTMLHeadingElement>(null);
  const createTriggerRef = useRef<HTMLButtonElement>(null);
  const correctTriggerRef = useRef<HTMLButtonElement>(null);
  const composerReturnFocusRef = useRef<HTMLElement | null>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRequestIdRef = useRef(0);
  const detailReturnFocusRef = useRef<HTMLElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const sourceArtifactSelectRef = useRef<HTMLSelectElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);
  const catalogueButtons = useRef(new Map<string, HTMLButtonElement>());

  const refreshCapabilities = useCallback(async () => {
    try {
      const nextCapabilities = await loadBlackboardCapabilities(campaignId);
      setCapabilities(nextCapabilities);
      setCapabilityNotice(undefined);
      return nextCapabilities;
    } catch {
      setCapabilities({ entries: [] });
      setCapabilityNotice(
        "Entry actions are temporarily unavailable. Reload the Blackboard to try again.",
      );
      return undefined;
    }
  }, [campaignId]);

  const hasActiveSearch = Boolean(
    appliedSearch.query || appliedSearch.category || appliedSearch.pinned,
  );

  const refreshSearch = useCallback(async () => {
    const requestId = ++searchRequestIdRef.current;
    if (!appliedSearch.query && !appliedSearch.category && !appliedSearch.pinned) {
      setSearchResult({ results: [] });
      setSearchError(undefined);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    setSearchError(undefined);
    setSearchResult({ results: [] });
    try {
      const result = await searchBlackboard(campaignId, {
        category: appliedSearch.category,
        pinned: appliedSearch.pinned,
        q: appliedSearch.query,
      });
      if (requestId === searchRequestIdRef.current) setSearchResult(result);
    } catch {
      if (requestId === searchRequestIdRef.current) {
        setSearchResult({ results: [] });
        setSearchError("Search is temporarily unavailable. The shared catalogue is unchanged.");
      }
    } finally {
      if (requestId === searchRequestIdRef.current) setSearchLoading(false);
    }
  }, [appliedSearch.category, appliedSearch.pinned, appliedSearch.query, campaignId]);

  const refreshBoard = useCallback(async () => {
    const [nextBoard] = await Promise.all([
      loadBlackboard(campaignId),
      refreshCapabilities(),
      refreshSearch(),
    ]);
    setBoard(nextBoard);
    return nextBoard;
  }, [campaignId, refreshCapabilities, refreshSearch]);

  useEffect(() => {
    setSelectedId(routeEntryId || undefined);
  }, [routeEntryId]);

  useEffect(() => {
    const next = {
      category: routeCategory(routeCategoryValue),
      pinned: routePinned(routePinnedValue),
      query: routeQuery?.trim() ?? "",
    };
    setAppliedSearch(next);
    setSearchDraft(next);
  }, [routeCategoryValue, routePinnedValue, routeQuery]);

  useEffect(() => {
    void refreshSearch();
  }, [refreshSearch]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(undefined);
    void Promise.all([
      loadBlackboard(campaignId),
      loadBlackboardCapabilities(campaignId).catch(() => {
        if (!cancelled) {
          setCapabilityNotice(
            "Entry actions are temporarily unavailable. Reload the Blackboard to try again.",
          );
        }
        return { entries: [] };
      }),
      loadBlackboardArtifactCandidates(campaignId).catch(() => {
        if (!cancelled) {
          setArtifactNotice(
            "Maps and images are temporarily unavailable. Other Blackboard entries still work.",
          );
        }
        return [];
      }),
    ])
      .then(([nextBoard, nextCapabilities, nextArtifacts]) => {
        if (cancelled) return;
        setBoard(nextBoard);
        setCapabilities(nextCapabilities);
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
  const selectedCapability = capabilities.entries.find((entry) => entry.entryId === selectedId);
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
  }, [board, selectedId]);

  useEffect(() => {
    if (!composerMode) return;
    const frame = window.requestAnimationFrame(() => composerHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [composerMode]);

  useEffect(() => {
    if (
      !selectedEntry ||
      selectedEntry.category !== "image_map" ||
      selectedEntry.sourceStatus === "source_unavailable" ||
      !selectedEntry.content
    ) {
      setArtifactView({ status: "idle" });
      return;
    }

    let cancelled = false;
    let objectUrl: string | undefined;
    setArtifactView({ status: "loading" });
    void fetchArtifactBlob(campaignId, selectedEntry.content.artifactId)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setArtifactView({ objectUrl, status: "ready" });
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        setArtifactView({
          status:
            caught instanceof ApiRequestError && caught.status < 500
              ? "source_unavailable"
              : "operational_unavailable",
        });
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [artifactInspection, artifactRetry, campaignId, selectedEntry]);

  useEffect(() => {
    if (presentation !== "focused") return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (artifactInspection) onExitArtifact?.();
      else onExitFocused?.();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [artifactInspection, onExitArtifact, onExitFocused, presentation]);

  function selectEntry(entryId: string, returnFocus?: HTMLElement | null) {
    detailReturnFocusRef.current = returnFocus ?? null;
    setComposerMode(undefined);
    setConfirmRetract(false);
    setHistory(undefined);
    setSelectedId(entryId);
    onRouteChange?.({ ...appliedSearch, entryId });
  }

  function returnToList() {
    const previousId = selectedId;
    setSelectedId(undefined);
    setComposerMode(undefined);
    setConfirmRetract(false);
    onRouteChange?.({ ...appliedSearch, entryId: undefined });
    window.requestAnimationFrame(() => {
      if (detailReturnFocusRef.current) detailReturnFocusRef.current.focus();
      else if (previousId) catalogueButtons.current.get(previousId)?.focus();
      else searchInputRef.current?.focus();
    });
  }

  function applySearch() {
    const next = {
      category: searchDraft.category,
      pinned: searchDraft.pinned,
      query: searchDraft.query.trim(),
    };
    setAppliedSearch(next);
    setSelectedId(undefined);
    onRouteChange?.({ ...next, entryId: undefined });
  }

  function clearSearch() {
    const next = { query: "" };
    setSearchDraft(next);
    setAppliedSearch(next);
    setSelectedId(undefined);
    setSearchError(undefined);
    onRouteChange?.({ query: "", entryId: undefined });
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }

  function beginCreate() {
    composerReturnFocusRef.current = createTriggerRef.current;
    setDraft({ ...emptyDraft, sourceArtifactId: artifacts[0]?.id ?? "" });
    setComposerMode("create");
    setRevisionKind("correction");
    setSelectedId(undefined);
    setHistory(undefined);
    setConfirmRetract(false);
    setError(undefined);
  }

  function beginCorrection() {
    if (!selectedEntry || !selectedCapability?.canCorrect) return;
    composerReturnFocusRef.current = correctTriggerRef.current;
    setDraft(draftFromEntry(selectedEntry));
    setComposerMode("correct");
    setRevisionKind("correction");
    setConfirmRetract(false);
    setError(undefined);
  }

  function closeComposer() {
    const returnTarget = composerReturnFocusRef.current;
    setComposerMode(undefined);
    setError(undefined);
    window.requestAnimationFrame(() => returnTarget?.focus());
  }

  function focusError(message: string) {
    setError(message);
    window.requestAnimationFrame(() => errorRef.current?.focus());
  }

  async function handleConflict(caught: unknown, fallback: string) {
    if (caught instanceof ApiRequestError && caught.status === 409) {
      await refreshBoard().catch(() => undefined);
      focusError(
        "The Blackboard changed elsewhere. Your draft was kept. Review the refreshed entry, then try again.",
      );
      return;
    }
    if (caught instanceof ApiRequestError && caught.status === 404) {
      await refreshBoard().catch(() => undefined);
      focusError(
        "This entry is no longer available to change. Nothing was changed; the Blackboard has been refreshed.",
      );
      return;
    }
    focusError(fallback);
  }

  async function saveDraft() {
    if (!draft.title.trim()) {
      focusError("Give this reference a title.");
      window.requestAnimationFrame(() => titleInputRef.current?.focus());
      return;
    }
    if (draft.category === "image_map" && !draft.sourceArtifactId) {
      focusError("Choose a shared map or image.");
      window.requestAnimationFrame(() => sourceArtifactSelectRef.current?.focus());
      return;
    }
    if (draft.category !== "image_map" && !draft.text.trim()) {
      focusError(
        draft.category === "clue_fact"
          ? "Write the clue or fact to share."
          : draft.category === "document_text"
            ? "Add the document text to share."
            : "Add the approved recap text.",
      );
      window.requestAnimationFrame(() => textInputRef.current?.focus());
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
      onRouteChange?.({ ...appliedSearch, entryId: saved.id });
      setComposerMode(undefined);
      setHistory(undefined);
      setNotice(
        composerMode === "correct"
          ? revisionKind === "correction"
            ? "Correction shared. Earlier shared text remains in History."
            : "Replacement shared. Earlier shared text remains in History."
          : "Reference shared with the Campaign.",
      );
      window.requestAnimationFrame(() => detailHeadingRef.current?.focus());
    } catch (caught) {
      await handleConflict(caught, "The reference could not be saved. Nothing was changed.");
    } finally {
      setBusy(false);
    }
  }

  async function refreshImageSnapshot() {
    if (!selectedEntry || selectedEntry.category !== "image_map" || !selectedCapability?.canCorrect)
      return;
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
    if (!selectedEntry || !selectedCapability?.canRemove) return;
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

  async function reloadArtifactReference() {
    setBusy(true);
    setError(undefined);
    try {
      await refreshBoard();
      setArtifactRetry((current) => current + 1);
    } catch {
      focusError("The Blackboard could not be reloaded. The shared reference is unchanged.");
    } finally {
      setBusy(false);
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

  // Pointer drag reuses move() unchanged: one PATCH on drop, same payload as the arrow buttons.
  const dragOrigin = useRef<{ x: number; y: number } | null>(null);
  const [drag, setDrag] = useState<{ dx: number; dy: number; entryId: string } | null>(null);

  function beginDrag(event: ReactPointerEvent<HTMLDivElement>, placement: BlackboardPlacementDto) {
    if (busy || event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragOrigin.current = { x: event.clientX, y: event.clientY };
    setDrag({ dx: 0, dy: 0, entryId: placement.entryId });
  }

  function dragTo(event: ReactPointerEvent<HTMLDivElement>, placement: BlackboardPlacementDto) {
    const origin = dragOrigin.current;
    if (!origin || drag?.entryId !== placement.entryId) return;
    setDrag({
      dx: event.clientX - origin.x,
      dy: event.clientY - origin.y,
      entryId: placement.entryId,
    });
  }

  function endDrag(
    event: ReactPointerEvent<HTMLDivElement>,
    placement: BlackboardPlacementDto,
    commit: boolean,
  ) {
    const origin = dragOrigin.current;
    dragOrigin.current = null;
    setDrag(null);
    if (!origin || !commit) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;
    move(
      placement,
      Math.max(0, Math.round(placement.x + dx)),
      Math.max(0, Math.round(placement.y + dy)),
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
      <section aria-busy="true" aria-live="polite" className={`${styles.panel} glantri-panel`}>
        Loading the Campaign Blackboard…
      </section>
    );
  }

  if (!board) {
    return (
      <section className={`${styles.panel} glantri-panel`}>
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

  if (presentation === "focused" && artifactInspection) {
    const inspectableEntry =
      selectedEntry?.category === "image_map" && selectedEntry.content ? selectedEntry : undefined;
    return (
      <FullViewportInspection
        closeOnEscape={false}
        exitLabel="Back to Blackboard"
        onExit={() => onExitArtifact?.()}
        presentation="page"
        subtitle="Artifact"
        title={inspectableEntry?.title ?? "Artifact unavailable"}
      >
        {inspectableEntry && artifactView.status === "ready" ? (
          <ArtifactInspectionViewport
            alt={inspectableEntry.artifact.altText}
            src={artifactView.objectUrl}
          />
        ) : (
          <div className={styles.inspectionMessage}>
            {inspectableEntry && artifactView.status === "loading" ? (
              <div className={styles.notice} role="status">
                Loading the Artifact…
              </div>
            ) : inspectableEntry && artifactView.status === "operational_unavailable" ? (
              <div className={styles.error} role="status">
                <strong>The Artifact could not be loaded right now.</strong>
                <p>The Blackboard reference remains available. Try loading the Artifact again.</p>
                <button onClick={() => setArtifactRetry((current) => current + 1)} type="button">
                  Retry Artifact
                </button>
              </div>
            ) : (
              <div className={styles.notice} role="status">
                This Artifact was removed or is not available in this Campaign.
              </div>
            )}
          </div>
        )}
      </FullViewportInspection>
    );
  }

  return (
    <section className={styles.workspace} data-presentation={presentation}>
      <header className={`${styles.intro} glantri-panel`}>
        <div>
          <h2>Blackboard</h2>
          <p>Shared clues, documents, maps, images, and approved recaps for this Campaign.</p>
        </div>
        <div className={`${styles.actionRow} glantri-actions`}>
          {presentation === "focused" ? (
            <button onClick={onExitFocused} type="button">
              Back to Campaign
            </button>
          ) : (
            <>
              <a
                className={styles.linkButton}
                href={buildFocusedBlackboardHref(campaignId, {
                  ...appliedSearch,
                  entryId: selectedId,
                })}
              >
                Open focused Blackboard
              </a>
              <button onClick={beginCreate} ref={createTriggerRef} type="button">
                Share a reference
              </button>
            </>
          )}
        </div>
      </header>

      {error ? (
        <div className={styles.error} ref={errorRef} role="alert" tabIndex={-1}>
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
      {capabilityNotice ? (
        <div className={styles.notice} role="status">
          {capabilityNotice}
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
              style={
                {
                  "--pin-height": `${placement.height}px`,
                  "--pin-width": `${placement.width}px`,
                  left: placement.x + 16,
                  top: placement.y + 16,
                  transform:
                    drag?.entryId === placement.entryId
                      ? `translate(${drag.dx}px, ${drag.dy}px)`
                      : undefined,
                  zIndex: placement.layer,
                } as CSSProperties
              }
            >
              {presentation === "embedded" ? (
                <div
                  aria-hidden="true"
                  className={styles.dragHandle}
                  onPointerCancel={(event) => endDrag(event, placement, false)}
                  onPointerDown={(event) => beginDrag(event, placement)}
                  onPointerMove={(event) => dragTo(event, placement)}
                  onPointerUp={(event) => endDrag(event, placement, true)}
                  title="Drag to arrange. The arrow buttons below do the same."
                >
                  ⠿ Drag to arrange
                </div>
              ) : null}
              <button
                aria-label={`Open ${entry?.title ?? "removed reference"}`}
                className={styles.catalogueButton}
                onClick={(event) => selectEntry(placement.entryId, event.currentTarget)}
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
              {presentation === "embedded" ? (
                <div aria-label="Arrange pinned reference" className={styles.moveRow}>
                  {/* Hidden by CSS (display: none) at <=720px, where pins are static and a
                      stored position has no visible effect. */}
                  <span className={styles.moveArrows}>
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
                  </span>
                  <button disabled={busy} onClick={() => unpin(placement)} type="button">
                    Unpin
                  </button>
                </div>
              ) : null}
            </article>
          ))
        )}
      </section>

      {composerMode ? (
        <section className={`${styles.composer} glantri-panel`}>
          <div className={styles.headingRow}>
            <h3 className="glantri-section-heading" ref={composerHeadingRef} tabIndex={-1}>
              {composerMode === "create" ? "Share a reference" : "Correct this reference"}
            </h3>
            <button onClick={closeComposer} type="button">
              Cancel
            </button>
          </div>
          <div className={styles.fields}>
            {composerMode === "correct" ? (
              <label className="glantri-field-label">
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
            <label className="glantri-field-label">
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
            <label className="glantri-field-label">
              Title
              <input
                maxLength={200}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                ref={titleInputRef}
                value={draft.title}
              />
            </label>
            {draft.category === "image_map" ? (
              <>
                <label className={`${styles.fullField} glantri-field-label`}>
                  Shared map or image
                  <select
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, sourceArtifactId: event.target.value }))
                    }
                    ref={sourceArtifactSelectRef}
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
                <label className={`${styles.fullField} glantri-field-label`}>
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
                <label className={`${styles.fullField} glantri-field-label`}>
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
                    ref={textInputRef}
                    value={draft.text}
                  />
                </label>
                {draft.category !== "recap" ? (
                  <label className={`${styles.fullField} glantri-field-label`}>
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
          <div className={`${styles.actionRow} glantri-actions`}>
            <span className={`${styles.muted} glantri-helper-text`}>
              Sharing immediately exposes this reference to everyone in the Campaign. It does not
              change Characters, Items, or play.
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
        <section className={`${styles.panel} glantri-panel`}>
          <form
            className={styles.searchForm}
            onSubmit={(event) => {
              event.preventDefault();
              applySearch();
            }}
          >
            <label className="glantri-field-label">
              Search shared references
              <input
                maxLength={200}
                onChange={(event) =>
                  setSearchDraft((current) => ({ ...current, query: event.target.value }))
                }
                placeholder="Title or shared text"
                ref={searchInputRef}
                type="search"
                value={searchDraft.query}
              />
            </label>
            <label className="glantri-field-label">
              Kind
              <select
                onChange={(event) =>
                  setSearchDraft((current) => ({
                    ...current,
                    category: routeCategory(event.target.value),
                  }))
                }
                value={searchDraft.category ?? ""}
              >
                <option value="">All kinds</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="glantri-field-label">
              Board
              <select
                onChange={(event) =>
                  setSearchDraft((current) => ({
                    ...current,
                    pinned: routePinned(event.target.value),
                  }))
                }
                value={searchDraft.pinned ?? ""}
              >
                <option value="">Pinned and unpinned</option>
                <option value="pinned">Pinned</option>
                <option value="unpinned">Unpinned</option>
              </select>
            </label>
            <div className={`${styles.searchActions} glantri-actions`}>
              <button disabled={searchLoading} type="submit">
                {searchLoading ? "Searching…" : "Search"}
              </button>
              {hasActiveSearch ? (
                <button onClick={clearSearch} type="button">
                  Clear
                </button>
              ) : null}
            </div>
          </form>
          {searchError ? (
            <div className={styles.notice} role="status">
              {searchError}
            </div>
          ) : null}
          {hasActiveSearch && !searchError ? (
            <section aria-busy={searchLoading} aria-label="Blackboard search results">
              <div className={styles.headingRow}>
                <h4>Search results</h4>
                <span>{searchResult.results.length} found</span>
              </div>
              {searchResult.results.length === 0 && !searchLoading ? (
                <p>No shared references match this search and filters.</p>
              ) : (
                <ul className={styles.catalogue}>
                  {searchResult.results.map((result) => (
                    <li key={result.entryId}>
                      <button
                        aria-current={selectedId === result.entryId}
                        className={styles.catalogueButton}
                        onClick={(event) => selectEntry(result.entryId, event.currentTarget)}
                        type="button"
                      >
                        <span className={styles.headingRow}>
                          <strong>{result.title}</strong>
                          <span className={styles.category}>{categoryLabels[result.category]}</span>
                        </span>
                        <span className={`${styles.muted} glantri-helper-text`}>
                          {result.pinned ? "Pinned to the board" : "Not pinned"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ) : null}
          <div className={styles.headingRow}>
            <h3 className="glantri-section-heading">Shared catalogue</h3>
            <span>{board.catalogue.length} shared</span>
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
                    onClick={(event) => selectEntry(entry.id, event.currentTarget)}
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
                    <span className={`${styles.muted} glantri-helper-text`}>{entry.state}</span>
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
                      onClick={(event) => selectEntry(entry.id, event.currentTarget)}
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

        <section className={`${styles.detail} glantri-panel`}>
          {selectedEntry ? (
            <>
              <button className={styles.narrowBack} onClick={returnToList} type="button">
                Back to shared catalogue
              </button>
              <header className={styles.detailHeader}>
                <div>
                  <span className={styles.category}>{categoryLabels[selectedEntry.category]}</span>
                  <h3 className="glantri-section-heading" ref={detailHeadingRef} tabIndex={-1}>
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
                  ) : artifactView.status === "ready" ? (
                    <img
                      alt={selectedEntry.artifact.altText}
                      className={styles.image}
                      src={artifactView.objectUrl}
                    />
                  ) : artifactView.status === "loading" ? (
                    <div className={styles.notice} role="status">
                      Loading the shared visual…
                    </div>
                  ) : artifactView.status === "operational_unavailable" ? (
                    <div className={styles.error} role="status">
                      <strong>The shared visual could not be loaded right now.</strong>
                      <p>
                        The Blackboard reference is still available. Try loading the visual again.
                      </p>
                      <button
                        onClick={() => setArtifactRetry((current) => current + 1)}
                        type="button"
                      >
                        Retry shared visual
                      </button>
                    </div>
                  ) : artifactView.status === "source_unavailable" ? (
                    <div className={styles.notice} role="status">
                      <strong>This visual is no longer available.</strong>
                      <p>
                        The shared title, caption, and description remain available. Reload the
                        Blackboard to check the current reference.
                      </p>
                      <button
                        disabled={busy}
                        onClick={() => void reloadArtifactReference()}
                        type="button"
                      >
                        Reload Blackboard
                      </button>
                    </div>
                  ) : null}
                  {selectedEntry.sourceStatus === "source_changed" ? (
                    <div className={styles.notice} role="status">
                      The source details changed after this reference was shared. The Blackboard
                      still shows the shared snapshot until an authorized poster refreshes it.
                      {selectedCapability?.canCorrect ? (
                        <button
                          disabled={busy}
                          onClick={() => void refreshImageSnapshot()}
                          type="button"
                        >
                          Refresh shared reference
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : null}
              {selectedEntry.category === "recap" ? (
                <div className={`${styles.muted} glantri-helper-text`}>
                  Approved by {selectedEntry.approvedByLabel} on{" "}
                  {displayDate(selectedEntry.approvedAt)}
                </div>
              ) : null}
              <div className={`${styles.muted} glantri-helper-text`}>
                {selectedEntry.state === "Corrected" ? "Corrected" : "Shared"} by{" "}
                {selectedEntry.updatedByLabel} on {displayDate(selectedEntry.updatedAt)}
              </div>
              <div className={`${styles.actionRow} glantri-actions`}>
                {presentation === "focused" &&
                selectedEntry.category === "image_map" &&
                selectedEntry.content ? (
                  <button onClick={() => onInspectArtifact?.(selectedEntry.id)} type="button">
                    Inspect Artifact
                  </button>
                ) : null}
                {presentation === "embedded" ? (
                  selectedPlacement ? (
                    <button disabled={busy} onClick={() => unpin(selectedPlacement)} type="button">
                      Unpin from board
                    </button>
                  ) : (
                    <button disabled={busy} onClick={pinSelected} type="button">
                      Pin to board
                    </button>
                  )
                ) : null}
                <button disabled={historyLoading} onClick={() => void showHistory()} type="button">
                  {historyLoading ? "Loading history…" : "History"}
                </button>
                {presentation === "embedded" && selectedCapability?.canCorrect ? (
                  <button onClick={beginCorrection} ref={correctTriggerRef} type="button">
                    Correct this entry
                  </button>
                ) : null}
                {presentation === "embedded" && selectedCapability?.canRemove ? (
                  <button onClick={() => setConfirmRetract(true)} type="button">
                    Remove this entry
                  </button>
                ) : null}
              </div>
              {presentation === "embedded" && !isGameMaster && selectedCapability?.canCorrect ? (
                <p className={`${styles.muted} glantri-helper-text`}>
                  You can correct or remove this entry because you posted it.
                </p>
              ) : null}
              {confirmRetract ? (
                <div className={styles.notice} role="alertdialog" aria-label="Remove reference">
                  <strong>Remove this shared reference?</strong>
                  <p>
                    Its content will disappear from the catalogue and History. A safe removed marker
                    will remain until the GM archives it.
                  </p>
                  <div className={`${styles.actionRow} glantri-actions`}>
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
                        <span className={`${styles.muted} glantri-helper-text`}>
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
              <h3 className="glantri-section-heading" ref={detailHeadingRef} tabIndex={-1}>
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
          ) : selectedId ? (
            <>
              <button className={styles.narrowBack} onClick={returnToList} type="button">
                Back to shared catalogue
              </button>
              <h3 className="glantri-section-heading" ref={detailHeadingRef} tabIndex={-1}>
                Reference unavailable
              </h3>
              <div className={styles.notice}>
                This shared reference was removed or is not available in this Campaign.
              </div>
            </>
          ) : (
            <>
              <h3 className="glantri-section-heading">Choose a shared reference</h3>
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
