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

function referenceKey(reference: CampaignNoteReference): string {
  return `${reference.type}:${reference.id}`;
}

function isAuthorizationLoss(error: unknown): boolean {
  return error instanceof ApiRequestError && [401, 403, 404].includes(error.status);
}

export function CampaignNotesPanel({
  campaignId,
  notes,
  onAuthorizationLoss,
  onNotesChanged,
  references,
}: {
  campaignId: string;
  notes: CampaignNote[];
  onAuthorizationLoss: () => void;
  onNotesChanged: (notes: CampaignNote[]) => void;
  references: CampaignNoteReference[];
}) {
  const [content, setContent] = useState("");
  const [error, setError] = useState<string>();
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string>();
  const [editingContent, setEditingContent] = useState("");
  const [editingReference, setEditingReference] = useState("");
  const [conflictCurrentNote, setConflictCurrentNote] = useState<CampaignNote>();
  const referenceByKey = useMemo(
    () => new Map(references.map((entry) => [referenceKey(entry), entry])),
    [references],
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
      createCampaignNoteOnServer({
        campaignId,
        content,
        reference: reference ? referenceByKey.get(reference) : undefined,
      }),
    );
    if (note) {
      setContent("");
      setReference("");
    }
  }

  async function saveEdit(noteId: string, expectedRevision: string) {
    const note = await runMutation(() =>
      updateCampaignNoteOnServer({
        campaignId,
        content: editingContent,
        expectedRevision,
        noteId,
        reference: editingReference ? referenceByKey.get(editingReference) : undefined,
      }),
    );
    if (note) setEditingId(undefined);
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
      <textarea
        aria-label="New Campaign Note"
        onChange={(event) => setContent(event.target.value)}
        placeholder="What should you remember or prepare?"
        rows={3}
        value={content}
      />
      <select
        aria-label="New Note reference"
        onChange={(event) => setReference(event.target.value)}
        value={reference}
      >
        <option value="">No linked Campaign material</option>
        {references.map((entry) => (
          <option key={referenceKey(entry)} value={referenceKey(entry)}>
            {entry.type}: {entry.label}
          </option>
        ))}
      </select>
      <div>
        <button
          disabled={saving || !content.trim()}
          onClick={() => void createNote()}
          type="button"
        >
          Add Note
        </button>
      </div>
      {error ? <div role="alert">{error}</div> : null}
      {notes.length === 0 ? (
        <p style={{ margin: 0 }}>No Campaign Notes yet.</p>
      ) : (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {notes.map((note) => {
            const editing = editingId === note.id;
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
                  <>
                    <textarea
                      aria-label={`Edit Note ${note.content}`}
                      onChange={(event) => setEditingContent(event.target.value)}
                      rows={3}
                      value={editingContent}
                    />
                    <select
                      aria-label="Edit Note reference"
                      onChange={(event) => setEditingReference(event.target.value)}
                      value={editingReference}
                    >
                      <option value="">No linked Campaign material</option>
                      {references.map((entry) => (
                        <option key={referenceKey(entry)} value={referenceKey(entry)}>
                          {entry.type}: {entry.label}
                        </option>
                      ))}
                    </select>
                    {conflictCurrentNote?.id === note.id ? (
                      <div aria-label="Current saved Note" role="status">
                        <strong>Current saved Note</strong>
                        <div>{conflictCurrentNote.content}</div>
                        <small>
                          {conflictCurrentNote.status === "open" ? "Open" : "Resolved"}
                          {conflictCurrentNote.reference
                            ? ` · ${conflictCurrentNote.reference.label}`
                            : ""}
                        </small>
                      </div>
                    ) : null}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <button
                        disabled={saving || !editingContent.trim()}
                        onClick={() => void saveEdit(note.id, note.updatedAt)}
                        type="button"
                      >
                        Save Note
                      </button>
                      <button onClick={() => setEditingId(undefined)} type="button">
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>{note.content}</div>
                    <small>
                      {note.status === "open" ? "Open" : "Resolved"}
                      {note.reference ? ` · ${note.reference.label}` : ""}
                    </small>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                      <button
                        onClick={() => {
                          setEditingId(note.id);
                          setConflictCurrentNote(undefined);
                          setEditingContent(note.content);
                          setEditingReference(note.reference ? referenceKey(note.reference) : "");
                        }}
                        type="button"
                      >
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
