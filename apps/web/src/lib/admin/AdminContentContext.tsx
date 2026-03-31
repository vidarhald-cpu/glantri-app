"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren
} from "react";

import {
  defaultCanonicalContent,
  type CanonicalContent,
  validateCanonicalContent
} from "@glantri/content";
import type { ContentSnapshotSource, RevisionedContentSnapshot } from "@glantri/shared";

import {
  ApiRequestError,
  isAdminContentConflictPayload,
  loadAdminCanonicalContentFromServer,
  saveAdminCanonicalContentToServer
} from "../api/localServiceClient";
import { ContentCacheRepository } from "../offline/repositories/contentCacheRepository";

const PUBLISHED_CONTENT_CACHE_KEY = "canonical-content";
const ADMIN_DRAFT_CACHE_KEY = "canonical-content-admin-draft";

const contentCacheRepository = new ContentCacheRepository();

type AdminContentSyncState = "draft" | "error" | "loading" | "saving" | "synced" | "conflict";
type AdminSaveState = "failed" | "idle" | "saving" | "succeeded" | "conflict";

interface AdminContentContextValue {
  content: CanonicalContent;
  discardLocalDraft: () => Promise<void>;
  feedback?: string;
  hasDraftChanges: boolean;
  hasLocalDraft: boolean;
  hasRevisionConflict: boolean;
  isLoading: boolean;
  isSaving: boolean;
  keepLocalDraft: () => void;
  lastDraftSavedAt?: string;
  lastPublishedUpdatedAt?: string;
  lastSaveFailed: boolean;
  lastSaveState: AdminSaveState;
  loadedSource: ContentSnapshotSource | "cached-database";
  publishedRevision: number;
  reloadFromServer: () => Promise<void>;
  replaceContent: (nextContent: CanonicalContent, feedback: string) => Promise<void>;
  revision: number;
  syncState: AdminContentSyncState;
}

const AdminContentContext = createContext<AdminContentContextValue | null>(null);

function parseRevisionFromVersion(version: string | undefined, prefix: "draft" | "server"): number {
  if (!version?.startsWith(`${prefix}:`)) {
    return 0;
  }

  const parsed = Number(version.slice(prefix.length + 1));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function savePublishedSnapshot(snapshot: RevisionedContentSnapshot<CanonicalContent>): Promise<void> {
  await contentCacheRepository.save(
    PUBLISHED_CONTENT_CACHE_KEY,
    snapshot.content,
    `server:${snapshot.revision}`
  );
}

async function saveDraftSnapshot(content: CanonicalContent, baseRevision: number): Promise<void> {
  await contentCacheRepository.save(ADMIN_DRAFT_CACHE_KEY, content, `draft:${baseRevision}`);
}

function contentMatches(left: CanonicalContent, right: CanonicalContent): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function AdminContentProvider({ children }: PropsWithChildren) {
  const [content, setContent] = useState<CanonicalContent>(defaultCanonicalContent);
  const [feedback, setFeedback] = useState<string>();
  const [hasLocalDraft, setHasLocalDraft] = useState(false);
  const [hasRevisionConflict, setHasRevisionConflict] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastDraftSavedAt, setLastDraftSavedAt] = useState<string>();
  const [lastPublishedUpdatedAt, setLastPublishedUpdatedAt] = useState<string>();
  const [lastSaveState, setLastSaveState] = useState<AdminSaveState>("idle");
  const [loadedSource, setLoadedSource] = useState<ContentSnapshotSource | "cached-database">(
    "seed"
  );
  const [publishedContent, setPublishedContent] = useState<CanonicalContent>(defaultCanonicalContent);
  const [publishedRevision, setPublishedRevision] = useState(0);
  const [revision, setRevision] = useState(0);
  const [syncState, setSyncState] = useState<AdminContentSyncState>("loading");

  async function hydrateFromServer(options?: { discardLocalDraft?: boolean }): Promise<void> {
    const [draftRecord, publishedRecord] = await Promise.all([
      contentCacheRepository.get(ADMIN_DRAFT_CACHE_KEY),
      contentCacheRepository.get(PUBLISHED_CONTENT_CACHE_KEY)
    ]);

    const cachedPublishedSnapshot = publishedRecord
      ? {
          content: validateCanonicalContent(publishedRecord.value),
          revision: parseRevisionFromVersion(publishedRecord.version, "server"),
          source: "database" as const,
          updatedAt: publishedRecord.updatedAt
        }
      : undefined;

    try {
      const serverSnapshot = await loadAdminCanonicalContentFromServer();

      await savePublishedSnapshot(serverSnapshot);

      if (options?.discardLocalDraft) {
        await contentCacheRepository.delete(ADMIN_DRAFT_CACHE_KEY);
      }

      const usableDraft = options?.discardLocalDraft ? undefined : draftRecord;

      if (usableDraft) {
        const draftContent = validateCanonicalContent(usableDraft.value);
        const draftRevision = parseRevisionFromVersion(usableDraft.version, "draft");

        setContent(draftContent);
        setHasLocalDraft(true);
        setHasRevisionConflict(draftRevision !== serverSnapshot.revision);
        setLastDraftSavedAt(usableDraft.updatedAt);
        setLastPublishedUpdatedAt(serverSnapshot.updatedAt);
        setLoadedSource(serverSnapshot.source);
        setPublishedContent(serverSnapshot.content);
        setPublishedRevision(serverSnapshot.revision);
        setRevision(draftRevision);
        setLastSaveState(draftRevision === serverSnapshot.revision ? "idle" : "conflict");

        if (draftRevision === serverSnapshot.revision) {
          setFeedback(`Loaded local admin draft based on server revision ${serverSnapshot.revision}.`);
          setSyncState("draft");
          return;
        }

        setFeedback(
          `Loaded local draft based on revision ${draftRevision}, but the server is now at revision ${serverSnapshot.revision}. Save will conflict until you reload or discard the local draft.`
        );
        setSyncState("conflict");
        return;
      }

      setContent(serverSnapshot.content);
      setFeedback(`Loaded canonical content from server revision ${serverSnapshot.revision}.`);
      setHasLocalDraft(false);
      setHasRevisionConflict(false);
      setLastDraftSavedAt(undefined);
      setLastPublishedUpdatedAt(serverSnapshot.updatedAt);
      setLoadedSource(serverSnapshot.source);
      setPublishedContent(serverSnapshot.content);
      setPublishedRevision(serverSnapshot.revision);
      setRevision(serverSnapshot.revision);
      setLastSaveState("idle");
      setSyncState("synced");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load canonical content from the server.";
      const fallbackDraft =
        !options?.discardLocalDraft && draftRecord
          ? {
              content: validateCanonicalContent(draftRecord.value),
              revision: parseRevisionFromVersion(draftRecord.version, "draft"),
              updatedAt: draftRecord.updatedAt
            }
          : undefined;

      if (fallbackDraft) {
        setContent(fallbackDraft.content);
        setFeedback(`${message} Using local admin draft.`);
        setHasLocalDraft(true);
        setHasRevisionConflict(false);
        setLastDraftSavedAt(fallbackDraft.updatedAt);
        setLastPublishedUpdatedAt(cachedPublishedSnapshot?.updatedAt);
        setLoadedSource(cachedPublishedSnapshot?.source ?? "seed");
        setPublishedContent(cachedPublishedSnapshot?.content ?? defaultCanonicalContent);
        setPublishedRevision(cachedPublishedSnapshot?.revision ?? fallbackDraft.revision);
        setRevision(fallbackDraft.revision);
        setLastSaveState("failed");
        setSyncState("draft");
        return;
      }

      if (cachedPublishedSnapshot) {
        setContent(cachedPublishedSnapshot.content);
        setFeedback(`${message} Using cached server content.`);
        setHasLocalDraft(false);
        setHasRevisionConflict(false);
        setLastDraftSavedAt(undefined);
        setLastPublishedUpdatedAt(cachedPublishedSnapshot.updatedAt);
        setLoadedSource("cached-database");
        setPublishedContent(cachedPublishedSnapshot.content);
        setPublishedRevision(cachedPublishedSnapshot.revision);
        setRevision(cachedPublishedSnapshot.revision);
        setLastSaveState("failed");
        setSyncState("error");
        return;
      }

      setContent(defaultCanonicalContent);
      setFeedback(`${message} Falling back to seed content.`);
      setHasLocalDraft(false);
      setHasRevisionConflict(false);
      setLastDraftSavedAt(undefined);
      setLastPublishedUpdatedAt(undefined);
      setLoadedSource("seed");
      setPublishedContent(defaultCanonicalContent);
      setPublishedRevision(0);
      setRevision(0);
      setLastSaveState("failed");
      setSyncState("error");
    }
  }

  useEffect(() => {
    let isMounted = true;

    async function loadContent() {
      try {
        await hydrateFromServer();
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadContent();

    return () => {
      isMounted = false;
    };
  }, []);

  const value: AdminContentContextValue = {
    content,
    async discardLocalDraft() {
      await contentCacheRepository.delete(ADMIN_DRAFT_CACHE_KEY);
      setHasLocalDraft(false);
      setHasRevisionConflict(false);
      setSyncState("loading");
      await hydrateFromServer({ discardLocalDraft: true });
    },
    feedback,
    hasDraftChanges: hasLocalDraft && !contentMatches(content, publishedContent),
    hasLocalDraft,
    hasRevisionConflict,
    isLoading,
    isSaving,
    keepLocalDraft() {
      if (hasRevisionConflict) {
        setFeedback(
          `Keeping the preserved local draft from revision ${revision}. Reload the latest server content or discard the draft before attempting another save.`
        );
        setLastSaveState("conflict");
        return;
      }

      setFeedback(
        `Keeping the preserved local draft locally. You can continue editing and try saving again later.`
      );
      setLastSaveState("failed");
    },
    lastDraftSavedAt,
    lastPublishedUpdatedAt,
    lastSaveFailed: lastSaveState === "failed" || lastSaveState === "conflict",
    lastSaveState,
    loadedSource,
    publishedRevision,
    async reloadFromServer() {
      setSyncState("loading");
      await hydrateFromServer();
    },
    async replaceContent(nextContent, nextFeedback) {
      let validated: CanonicalContent;

      try {
        validated = validateCanonicalContent(nextContent);
      } catch (error) {
        setFeedback(
          error instanceof Error ? error.message : "Unable to validate admin content locally."
        );
        setLastSaveState("failed");
        setSyncState("error");
        return;
      }

      try {
        setIsSaving(true);
        setLastSaveState("saving");
        setSyncState("saving");

        const savedSnapshot = await saveAdminCanonicalContentToServer({
          content: validated,
          expectedRevision: revision
        });

        await Promise.all([
          savePublishedSnapshot(savedSnapshot),
          contentCacheRepository.delete(ADMIN_DRAFT_CACHE_KEY)
        ]);

        setContent(savedSnapshot.content);
        setFeedback(nextFeedback);
        setHasLocalDraft(false);
        setHasRevisionConflict(false);
        setLastDraftSavedAt(undefined);
        setLastPublishedUpdatedAt(savedSnapshot.updatedAt);
        setLoadedSource(savedSnapshot.source);
        setPublishedContent(savedSnapshot.content);
        setPublishedRevision(savedSnapshot.revision);
        setRevision(savedSnapshot.revision);
        setLastSaveState("succeeded");
        setSyncState("synced");
      } catch (error) {
        await saveDraftSnapshot(validated, revision);

        setContent(validated);
        setHasLocalDraft(true);
        setLastDraftSavedAt(new Date().toISOString());

        if (
          error instanceof ApiRequestError &&
          error.status === 409 &&
          isAdminContentConflictPayload(error.payload)
        ) {
          const currentSnapshot = error.payload.current;

          await savePublishedSnapshot(currentSnapshot);

          setFeedback(
            `${error.message} The server moved to revision ${currentSnapshot.revision}, and your attempted save was preserved locally as a draft.`
          );
          setHasRevisionConflict(true);
          setLastPublishedUpdatedAt(currentSnapshot.updatedAt);
          setLoadedSource(currentSnapshot.source);
          setPublishedContent(currentSnapshot.content);
          setPublishedRevision(currentSnapshot.revision);
          setLastSaveState("conflict");
          setSyncState("conflict");
        } else {
          setFeedback(
            `${error instanceof Error ? error.message : "Unable to save admin content to the server."} Your local draft has been preserved.`
          );
          setHasRevisionConflict(false);
          setLastSaveState("failed");
          setSyncState("draft");
        }
      } finally {
        setIsSaving(false);
      }
    },
    revision,
    syncState
  };

  return <AdminContentContext.Provider value={value}>{children}</AdminContentContext.Provider>;
}

export function useAdminContent(): AdminContentContextValue {
  const context = useContext(AdminContentContext);

  if (!context) {
    throw new Error("useAdminContent must be used within an AdminContentProvider.");
  }

  return context;
}
