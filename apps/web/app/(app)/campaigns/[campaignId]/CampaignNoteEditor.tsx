"use client";

import { useMemo, useState } from "react";

import {
  campaignNoteAssociationKey,
  campaignNoteAssociationLimit,
  campaignNoteTagId,
  normalizeCampaignNoteTagLabel,
  type CampaignNote,
  type CampaignNoteReference,
} from "@glantri/domain";

import {
  CampaignNoteAssociationChips,
  campaignNoteAssociationGroups,
} from "./CampaignNoteAssociations";

export interface CampaignNoteEditorLabels {
  /** Accessible name of the writing area. */
  content: string;
  heading: string;
  submit: string;
}

/**
 * A Note editor with a writing area sized for real preparation notes, plus
 * multi-association selection across Campaign material and custom tags.
 */
export function CampaignNoteEditor({
  associations,
  campaignId,
  conflictNote,
  content,
  disabled,
  labels,
  onAssociationsChange,
  onCancel,
  onContentChange,
  onSubmit,
  references,
  tagSuggestions,
}: {
  associations: CampaignNoteReference[];
  campaignId: string;
  conflictNote?: CampaignNote;
  content: string;
  disabled: boolean;
  labels: CampaignNoteEditorLabels;
  onAssociationsChange: (associations: CampaignNoteReference[]) => void;
  onCancel: () => void;
  onContentChange: (content: string) => void;
  onSubmit: () => void;
  references: CampaignNoteReference[];
  tagSuggestions: CampaignNoteReference[];
}) {
  const [tagDraft, setTagDraft] = useState("");
  const selectedKeys = useMemo(
    () => new Set(associations.map(campaignNoteAssociationKey)),
    [associations],
  );
  const groups = useMemo(
    () =>
      campaignNoteAssociationGroups
        .map((group) => ({
          ...group,
          entries: references.filter((reference) => reference.type === group.type),
        }))
        .filter((group) => group.entries.length > 0),
    [references],
  );
  const atLimit = associations.length >= campaignNoteAssociationLimit;

  function toggle(reference: CampaignNoteReference) {
    const key = campaignNoteAssociationKey(reference);
    if (selectedKeys.has(key)) {
      onAssociationsChange(
        associations.filter((entry) => campaignNoteAssociationKey(entry) !== key),
      );
      return;
    }
    if (atLimit) return;
    onAssociationsChange([...associations, reference]);
  }

  function addTag(rawLabel: string) {
    const label = normalizeCampaignNoteTagLabel(rawLabel);
    if (!label || atLimit) return;
    const tag: CampaignNoteReference = { id: campaignNoteTagId(label), label, type: "tag" };
    if (!selectedKeys.has(campaignNoteAssociationKey(tag))) {
      onAssociationsChange([...associations, tag]);
    }
    setTagDraft("");
  }

  const unusedTagSuggestions = tagSuggestions.filter(
    (tag) => !selectedKeys.has(campaignNoteAssociationKey(tag)),
  );

  return (
    <div
      style={{
        background: "#fdfdfb",
        border: "1px solid #d9ddd8",
        borderRadius: 10,
        display: "grid",
        gap: "0.75rem",
        padding: "0.75rem",
      }}
    >
      <h3 style={{ fontSize: "1rem", margin: 0 }}>{labels.heading}</h3>
      <textarea
        aria-label={labels.content}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="What should you remember, prepare, or follow up on?"
        rows={10}
        style={{
          boxSizing: "border-box",
          fontFamily: "inherit",
          fontSize: "1rem",
          lineHeight: 1.5,
          minHeight: "12rem",
          padding: "0.6rem",
          resize: "vertical",
          width: "100%",
        }}
        value={content}
      />

      <div style={{ display: "grid", gap: "0.4rem" }}>
        <strong style={{ fontSize: "0.9rem" }}>Associations</strong>
        <p style={{ color: "#5d635c", fontSize: "0.8125rem", margin: 0 }}>
          Link this Note to anything it concerns. Linking is a reference only; it does not
          change who owns the Scenario, Encounter, PC, NPC, or Artifact.
        </p>
        <CampaignNoteAssociationChips associations={associations} campaignId={campaignId} />
        {atLimit ? (
          <small role="status">
            This Note already has the maximum of {campaignNoteAssociationLimit} associations.
          </small>
        ) : null}
      </div>

      {groups.map((group) => (
        <details key={group.type} style={{ border: "1px solid #e4e7e2", borderRadius: 8 }}>
          <summary style={{ cursor: "pointer", padding: "0.45rem 0.6rem" }}>
            {group.plural} (
            {group.entries.filter((entry) => selectedKeys.has(campaignNoteAssociationKey(entry)))
              .length}
            /{group.entries.length})
          </summary>
          <div
            style={{
              display: "grid",
              gap: "0.3rem",
              maxHeight: "12rem",
              overflowY: "auto",
              padding: "0 0.6rem 0.6rem",
            }}
          >
            {group.entries.map((entry) => {
              const key = campaignNoteAssociationKey(entry);
              const checked = selectedKeys.has(key);
              return (
                <label
                  key={key}
                  style={{ alignItems: "start", display: "flex", gap: "0.45rem" }}
                >
                  <input
                    checked={checked}
                    disabled={disabled || (!checked && atLimit)}
                    onChange={() => toggle(entry)}
                    type="checkbox"
                  />
                  <span>
                    {group.singular}: {entry.label}
                  </span>
                </label>
              );
            })}
          </div>
        </details>
      ))}

      <div style={{ display: "grid", gap: "0.4rem" }}>
        <label htmlFor={`${labels.heading}-tag`} style={{ fontSize: "0.9rem" }}>
          <strong>Custom tag</strong>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
          <input
            aria-label="Custom tag"
            disabled={disabled || atLimit}
            id={`${labels.heading}-tag`}
            onChange={(event) => setTagDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addTag(tagDraft);
            }}
            placeholder="prep, loose end, rumour…"
            style={{ flex: "1 1 10rem", minWidth: 0, padding: "0.4rem" }}
            value={tagDraft}
          />
          <button
            disabled={disabled || atLimit || !normalizeCampaignNoteTagLabel(tagDraft)}
            onClick={() => addTag(tagDraft)}
            type="button"
          >
            Add tag
          </button>
        </div>
        {unusedTagSuggestions.length > 0 ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
            {unusedTagSuggestions.map((tag) => (
              <button
                disabled={disabled || atLimit}
                key={tag.id}
                onClick={() => addTag(tag.label)}
                style={{ fontSize: "0.8125rem" }}
                type="button"
              >
                + #{tag.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {conflictNote ? (
        <div
          aria-label="Current saved Note"
          role="status"
          style={{
            background: "#fff8e6",
            border: "1px solid #e6d9b0",
            borderRadius: 8,
            display: "grid",
            gap: "0.35rem",
            padding: "0.6rem",
          }}
        >
          <strong>Current saved Note</strong>
          <div style={{ whiteSpace: "pre-wrap" }}>{conflictNote.content}</div>
          <CampaignNoteAssociationChips
            associations={conflictNote.associations}
            campaignId={campaignId}
          />
          <small>{conflictNote.status === "open" ? "Open" : "Resolved"}</small>
        </div>
      ) : null}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        <button disabled={disabled || !content.trim()} onClick={onSubmit} type="button">
          {labels.submit}
        </button>
        <button onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </div>
  );
}
