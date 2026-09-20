"use client";

import { useMemo, useState } from "react";

import type { CampaignNote, CampaignNoteReference } from "@glantri/domain";

import { ApiRequestError } from "@/lib/api/apiClient";
import {
  createCampaignNoteOnServer,
  getCurrentCampaignNoteFromMutationConflict,
  setCampaignNoteStatusOnServer,
  updateCampaignNoteOnServer,
} from "@/lib/api/campaignClient";

import { CampaignNoteAssociationChips } from "./CampaignNoteAssociations";
import { CampaignNoteEditor } from "./CampaignNoteEditor";

/** Characters of a Note shown in the compact list before the reader expands it. */
const previewLength = 140;

function isAuthorizationLoss(error: unknown): boolean {
  return error instanceof ApiRequestError && [401, 403, 404].includes(error.status);
}

/** Compact list presentation: first line, shortened, with whether anything is hidden. */
function notePreview(content: string): { preview: string; truncated: boolean } {
  const firstLine = (content.split("\n", 1)[0] ?? "").trim();
  const shortened = firstLine.length > previewLength;
  return {
    preview: shortened ? `${firstLine.slice(0, previewLength).trimEnd()}…` : firstLine,
    truncated: shortened || content.trim() !== firstLine,
  };
}

export function CampaignNotesPanel({
  campaignId,
  notes,
  onAuthorizationLoss,
  onNotesChanged,
  references,
  tags = [],
}: {
  campaignId: string;
  notes: CampaignNote[];
  onAuthorizationLoss: () => void;
  onNotesChanged: (notes: CampaignNote[]) => void;
  references: CampaignNoteReference[];
  tags?: CampaignNoteReference[];
}) {
  const [composing, setComposing] = useState(false);
  const [content, setContent] = useState("");
  const [draftAssociations, setDraftAssociations] = useState<CampaignNoteReference[]>([]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [editingContent, setEditingContent] = useState("");
  const [editingAssociations, setEditingAssociations] = useState<CampaignNoteReference[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState<string>();
  const [conflictCurrentNote, setConflictCurrentNote] = useState<CampaignNote>();

  /**
   * Tag suggestions come from the Campaign overview plus any tag already on a loaded
   * Note, so a tag becomes reusable immediately after it is first used.
   */
  const tagSuggestions = useMemo(() => {
    const byId = new Map(tags.map((tag) => [tag.id, tag]));
    for (const note of notes) {
      for (const association of note.associations) {
        if (association.type === "tag" && !byId.has(association.id)) {
          byId.set(association.id, association);
        }
      }
    }
    return [...byId.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [notes, tags]);

  const activeTag = tagFilter ? tagSuggestions.find((tag) => tag.id === tagFilter) : undefined;
  const visibleNotes = useMemo(
    () =>
      tagFilter
        ? notes.filter((note) =>
            note.associations.some(
              (association) => association.type === "tag" && association.id === tagFilter,
            ),
          )
        : notes,
    [notes, tagFilter],
  );

  async function runMutation(action: () => Promise<CampaignNote>) {
    setSaving(true);
    setError(undefined);
    try {
      const note = await action();
      setConflictCurrentNote(undefined);
      onNotesChanged(
        notes.some((entry) => entry.id === note.id)
          ? notes.map((entry) => (entry.id === note.id ? note : entry))
          : [note, ...notes],
      );
      return note;
    } catch (caughtError) {
      if (isAuthorizationLoss(caughtError)) onAuthorizationLoss();
      const currentNote = getCurrentCampaignNoteFromMutationConflict(caughtError);
      if (currentNote) {
        setConflictCurrentNote(currentNote);
        onNotesChanged(notes.map((entry) => (entry.id === currentNote.id ? currentNote : entry)));
        setError(
          editingId === currentNote.id
            ? "This Note changed elsewhere. The current saved Note is shown below; your attempted edit remains in the editor for deliberate review."
            : "This Note changed elsewhere. The latest saved Note is now shown; review it before trying that status change again.",
        );
      } else {
        setError(caughtError instanceof Error ? caughtError.message : "Unable to save this Note.");
      }
      return undefined;
    } finally {
      setSaving(false);
    }
  }

  async function createNote() {
    const note = await runMutation(() =>
      createCampaignNoteOnServer({ associations: draftAssociations, campaignId, content }),
    );
    if (note) {
      setContent("");
      setDraftAssociations([]);
      setComposing(false);
    }
  }

  async function saveEdit(noteId: string, expectedRevision: string) {
    const note = await runMutation(() =>
      updateCampaignNoteOnServer({
        associations: editingAssociations,
        campaignId,
        content: editingContent,
        expectedRevision,
        noteId,
      }),
    );
    if (note) setEditingId(undefined);
  }

  function startEditing(note: CampaignNote) {
    setEditingId(note.id);
    setConflictCurrentNote(undefined);
    setEditingContent(note.content);
    setEditingAssociations(note.associations);
    setComposing(false);
  }

  function toggleExpanded(noteId: string) {
    setExpandedIds((current) =>
      current.includes(noteId) ? current.filter((entry) => entry !== noteId) : [...current, noteId],
    );
  }

  return (
    <section
      aria-label="Private GM Notes"
      id="campaign-notes"
      style={{
        border: "1px solid #d9ddd8",
        borderRadius: 12,
        display: "grid",
        gap: "0.75rem",
        padding: "1rem",
      }}
    >
      <div>
        <h2 style={{ margin: 0 }}>Private GM Notes</h2>
        <p style={{ marginBottom: 0 }}>
          Operational reminders for this Campaign. Notes are not Story, player content, or runtime
          history.
        </p>
      </div>

      {composing ? (
        <CampaignNoteEditor
          associations={draftAssociations}
          campaignId={campaignId}
          content={content}
          disabled={saving}
          labels={{ content: "New Campaign Note", heading: "New Note", submit: "Save Note" }}
          onAssociationsChange={setDraftAssociations}
          onCancel={() => {
            setComposing(false);
            setError(undefined);
          }}
          onContentChange={setContent}
          onSubmit={() => void createNote()}
          references={references}
          tagSuggestions={tagSuggestions}
        />
      ) : (
        <div>
          <button
            onClick={() => {
              setComposing(true);
              setEditingId(undefined);
              setError(undefined);
            }}
            type="button"
          >
            New note
          </button>
        </div>
      )}

      {error ? <div role="alert">{error}</div> : null}

      {activeTag ? (
        <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
          <span>
            Showing Notes tagged <strong>#{activeTag.label}</strong>
          </span>
          <button onClick={() => setTagFilter(undefined)} type="button">
            Show all Notes
          </button>
        </div>
      ) : null}

      {notes.length === 0 ? (
        <p style={{ margin: 0 }}>No Campaign Notes yet.</p>
      ) : visibleNotes.length === 0 ? (
        <p style={{ margin: 0 }}>No Campaign Notes carry this tag.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          {visibleNotes.map((note) => {
            const editing = editingId === note.id;
            const expanded = expandedIds.includes(note.id);
            const { preview, truncated } = notePreview(note.content);
            return (
              <article
                key={note.id}
                style={{
                  background: note.status === "open" ? "#fffaf0" : "#f6f5ef",
                  borderRadius: 10,
                  display: "grid",
                  gap: "0.5rem",
                  padding: "0.75rem",
                }}
              >
                {editing ? (
                  <CampaignNoteEditor
                    associations={editingAssociations}
                    campaignId={campaignId}
                    conflictNote={
                      conflictCurrentNote?.id === note.id ? conflictCurrentNote : undefined
                    }
                    content={editingContent}
                    disabled={saving}
                    labels={{
                      content: `Edit Note ${note.content}`,
                      heading: "Edit Note",
                      submit: "Save Note",
                    }}
                    onAssociationsChange={setEditingAssociations}
                    onCancel={() => setEditingId(undefined)}
                    onContentChange={setEditingContent}
                    onSubmit={() => void saveEdit(note.id, note.updatedAt)}
                    references={references}
                    tagSuggestions={tagSuggestions}
                  />
                ) : (
                  <>
                    <div style={{ whiteSpace: expanded ? "pre-wrap" : "normal" }}>
                      {expanded ? note.content : preview}
                    </div>
                    <CampaignNoteAssociationChips
                      associations={note.associations}
                      campaignId={campaignId}
                      onSelectTag={setTagFilter}
                    />
                    <small>{note.status === "open" ? "Open" : "Resolved"}</small>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      {truncated || expanded ? (
                        <button
                          aria-expanded={expanded}
                          onClick={() => toggleExpanded(note.id)}
                          type="button"
                        >
                          {expanded ? "Collapse Note" : "Expand Note"}
                        </button>
                      ) : null}
                      <button onClick={() => startEditing(note)} type="button">
                        Edit
                      </button>
                      <button
                        disabled={saving}
                        onClick={() =>
                          void runMutation(() =>
                            setCampaignNoteStatusOnServer({
                              campaignId,
                              expectedRevision: note.updatedAt,
                              noteId: note.id,
                              status: note.status === "open" ? "resolved" : "open",
                            }),
                          )
                        }
                        type="button"
                      >
                        {note.status === "open" ? "Resolve" : "Reopen"}
                      </button>
                    </div>
                    {conflictCurrentNote?.id === note.id ? (
                      <div aria-label="Current saved Note" role="status">
                        <strong>Current saved Note</strong>
                        <div style={{ whiteSpace: "pre-wrap" }}>{conflictCurrentNote.content}</div>
                        <small>
                          {conflictCurrentNote.status === "open" ? "Open" : "Resolved"}
                          {conflictCurrentNote.associations.length > 0
                            ? ` · ${conflictCurrentNote.associations
                                .map((association) => association.label)
                                .join(", ")}`
                            : ""}
                        </small>
                      </div>
                    ) : null}
                  </>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
