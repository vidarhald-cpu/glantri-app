"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  CharacterEquipmentItem,
  EquipmentItemType,
  EquipmentSlot
} from "@glantri/domain";
import {
  buildCharacterSheetSummary,
  createCharacterEquipmentItem,
  removeCharacterEquipmentItem,
  setCharacterEquipmentEquipped,
  upsertCharacterEquipmentItem
} from "@glantri/rules-engine";

import { saveCharacterToServer } from "../../../../../src/lib/api/localServiceClient";
import { loadLocalCharacterAdvancementContext } from "../../../../../src/lib/characters/loadLocalCharacterAdvancementContext";
import type {
  LocalCharacterDraft,
  LocalCharacterRecord
} from "../../../../../src/lib/offline/glantriDexie";
import { CharacterDraftRepository } from "../../../../../src/lib/offline/repositories/characterDraftRepository";
import {
  LocalCharacterRepository,
  UNNAMED_CHARACTER_PLACEHOLDER
} from "../../../../../src/lib/offline/repositories/localCharacterRepository";

interface CharacterEquipmentEditorProps {
  id: string;
}

interface EquipmentFormState {
  armorLabel: string;
  armorValue: string;
  equipped: boolean;
  itemType: EquipmentItemType;
  name: string;
  notes: string;
  shieldBonus: string;
  slot: EquipmentSlot;
  weaponBonus: string;
  weaponSkillId: string;
}

const characterDraftRepository = new CharacterDraftRepository();
const localCharacterRepository = new LocalCharacterRepository();

function getCharacterName(record: LocalCharacterRecord): string {
  return record.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER;
}

function getDefaultSlot(itemType: EquipmentItemType): EquipmentSlot {
  switch (itemType) {
    case "weapon":
      return "main-hand";
    case "shield":
      return "off-hand";
    case "armor":
      return "body";
  }
}

function createEmptyFormState(): EquipmentFormState {
  return {
    armorLabel: "",
    armorValue: "0",
    equipped: false,
    itemType: "weapon",
    name: "",
    notes: "",
    shieldBonus: "0",
    slot: "main-hand",
    weaponBonus: "0",
    weaponSkillId: ""
  };
}

function createFormStateFromItem(item: CharacterEquipmentItem): EquipmentFormState {
  return {
    armorLabel: item.armorLabel ?? "",
    armorValue: String(item.armorValue ?? 0),
    equipped: item.equipped,
    itemType: item.itemType,
    name: item.name,
    notes: item.notes ?? "",
    shieldBonus: String(item.shieldBonus ?? 0),
    slot: item.slot,
    weaponBonus: String(item.weaponBonus ?? 0),
    weaponSkillId: item.weaponSkillId ?? ""
  };
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export default function CharacterEquipmentEditor({ id }: CharacterEquipmentEditorProps) {
  const [content, setContent] = useState<
    Awaited<ReturnType<typeof loadLocalCharacterAdvancementContext>>["content"] | undefined
  >();
  const [draft, setDraft] = useState<LocalCharacterDraft>();
  const [editingItemId, setEditingItemId] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [formState, setFormState] = useState<EquipmentFormState>(createEmptyFormState());
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<LocalCharacterRecord>();

  useEffect(() => {
    let cancelled = false;

    loadLocalCharacterAdvancementContext(id)
      .then(async (result) => {
        if (cancelled) {
          return;
        }

        setContent(result.content);
        setRecord(result.record);

        if (!result.record) {
          return;
        }

        const resolvedDraft =
          result.draft ?? (await characterDraftRepository.createFromCharacter(result.record));

        if (!cancelled) {
          setDraft(resolvedDraft);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const sheet = useMemo(() => {
    if (!draft || !content) {
      return undefined;
    }

    return buildCharacterSheetSummary({
      build: draft.build,
      content
    });
  }, [content, draft]);

  async function persistDraft(nextDraft: LocalCharacterDraft, message?: string) {
    const savedDraft = await characterDraftRepository.save({
      advancementPointsSpent: nextDraft.advancementPointsSpent,
      advancementPointsTotal: nextDraft.advancementPointsTotal,
      build: nextDraft.build,
      characterId: nextDraft.characterId,
      id: nextDraft.id,
      syncStatus: nextDraft.syncStatus,
      updatedAt: nextDraft.updatedAt
    });

    setDraft(savedDraft);

    if (message) {
      setFeedback(message);
    }

    return savedDraft;
  }

  function resetForm() {
    setEditingItemId(undefined);
    setFormState(createEmptyFormState());
  }

  async function handleSubmitItem() {
    if (!draft) {
      return;
    }

    if (!formState.name.trim()) {
      setFeedback("Item name is required.");
      return;
    }

    const existingItem = draft.build.equipment.items.find((item) => item.id === editingItemId);
    const item =
      existingItem !== undefined
        ? {
            ...existingItem,
            armorLabel: formState.armorLabel.trim() || undefined,
            armorValue: parseInteger(formState.armorValue),
            equipped: formState.equipped,
            itemType: formState.itemType,
            name: formState.name,
            notes: formState.notes.trim() || undefined,
            shieldBonus: parseInteger(formState.shieldBonus),
            slot: formState.slot,
            weaponBonus: parseInteger(formState.weaponBonus),
            weaponSkillId: formState.weaponSkillId.trim() || undefined
          }
        : createCharacterEquipmentItem({
            armorLabel: formState.armorLabel.trim() || undefined,
            armorValue: parseInteger(formState.armorValue),
            equipped: formState.equipped,
            itemType: formState.itemType,
            name: formState.name,
            notes: formState.notes.trim() || undefined,
            shieldBonus: parseInteger(formState.shieldBonus),
            slot: formState.slot,
            weaponBonus: parseInteger(formState.weaponBonus),
            weaponSkillId: formState.weaponSkillId.trim() || undefined
          });
    const nextBuild = upsertCharacterEquipmentItem({
      build: draft.build,
      item
    });

    await persistDraft(
      {
        ...draft,
        build: nextBuild,
        updatedAt: new Date().toISOString()
      },
      existingItem ? "Equipment item updated in local draft." : "Equipment item added to local draft."
    );
    resetForm();
  }

  async function handleRemoveItem(itemId: string) {
    if (!draft) {
      return;
    }

    const nextBuild = removeCharacterEquipmentItem({
      build: draft.build,
      itemId
    });

    await persistDraft(
      {
        ...draft,
        build: nextBuild,
        updatedAt: new Date().toISOString()
      },
      "Equipment item removed from local draft."
    );

    if (editingItemId === itemId) {
      resetForm();
    }
  }

  async function handleToggleEquip(itemId: string, equipped: boolean) {
    if (!draft) {
      return;
    }

    const nextBuild = setCharacterEquipmentEquipped({
      build: draft.build,
      equipped,
      itemId
    });

    await persistDraft(
      {
        ...draft,
        build: nextBuild,
        updatedAt: new Date().toISOString()
      },
      equipped ? "Item equipped in local draft." : "Item unequipped in local draft."
    );
  }

  async function handleSaveLocally() {
    if (!draft || !record) {
      return;
    }

    const savedRecord = await localCharacterRepository.save({
      build: draft.build,
      createdAt: record.createdAt,
      finalizedAt: record.finalizedAt,
      syncStatus: "local"
    });

    setRecord(savedRecord);

    await persistDraft(
      {
        ...draft,
        syncStatus: "local",
        updatedAt: new Date().toISOString()
      },
      "Equipment saved locally."
    );
  }

  async function handleSaveToServer() {
    if (!draft || !record) {
      return;
    }

    const savedLocalRecord = await localCharacterRepository.save({
      build: draft.build,
      createdAt: record.createdAt,
      finalizedAt: record.finalizedAt,
      syncStatus: "local"
    });

    try {
      const serverRecord = await saveCharacterToServer(savedLocalRecord.build);
      const syncedRecord = await localCharacterRepository.save({
        build: serverRecord.build,
        createdAt: savedLocalRecord.createdAt,
        finalizedAt: savedLocalRecord.finalizedAt,
        syncStatus: "synced",
        updatedAt: serverRecord.updatedAt
      });

      setRecord(syncedRecord);

      await persistDraft(
        {
          ...draft,
          build: serverRecord.build,
          syncStatus: "synced",
          updatedAt: serverRecord.updatedAt
        },
        "Equipment saved locally and pushed to the local service."
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Equipment could not be saved to the server.");
    }
  }

  if (loading) {
    return <section>Loading equipment editor...</section>;
  }

  if (!record || !draft || !content || !sheet) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Character not found</h1>
        <Link href="/characters">Back to characters</Link>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 980 }}>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/characters">Back to characters</Link>
        <Link href={`/characters/${record.id}`}>Open details</Link>
        <Link href={`/characters/${record.id}/sheet`}>Character sheet</Link>
      </div>

      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Equipment for {getCharacterName(record)}</h1>
        <p style={{ margin: 0 }}>
          This edits the local-first character draft. Save locally to apply the loadout to the
          saved character, or push explicitly to the local service when ready.
        </p>
      </div>

      {feedback ? (
        <section
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          {feedback}
        </section>
      ) : null}

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>{editingItemId ? "Edit item" : "Add item"}</h2>
        <label style={{ display: "grid", gap: "0.25rem" }}>
          Name
          <input
            onChange={(event) => setFormState((current) => ({ ...current, name: event.target.value }))}
            style={{ padding: "0.5rem" }}
            type="text"
            value={formState.name}
          />
        </label>
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
          }}
        >
          <label style={{ display: "grid", gap: "0.25rem" }}>
            Item type
            <select
              onChange={(event) => {
                const itemType = event.target.value as EquipmentItemType;
                setFormState((current) => ({
                  ...current,
                  itemType,
                  slot: getDefaultSlot(itemType)
                }));
              }}
              style={{ padding: "0.5rem" }}
              value={formState.itemType}
            >
              <option value="weapon">Weapon</option>
              <option value="shield">Shield</option>
              <option value="armor">Armor</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.25rem" }}>
            Slot
            <select
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  slot: event.target.value as EquipmentSlot
                }))
              }
              style={{ padding: "0.5rem" }}
              value={formState.slot}
            >
              <option value="main-hand">Main hand</option>
              <option value="off-hand">Off hand</option>
              <option value="body">Body</option>
              <option value="pack">Pack</option>
            </select>
          </label>

          <label style={{ display: "grid", gap: "0.25rem" }}>
            Equipped
            <input
              checked={formState.equipped}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  equipped: event.target.checked
                }))
              }
              type="checkbox"
            />
          </label>
        </div>

        {formState.itemType === "weapon" ? (
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
            }}
          >
            <label style={{ display: "grid", gap: "0.25rem" }}>
              Linked skill
              <select
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    weaponSkillId: event.target.value
                  }))
                }
                style={{ padding: "0.5rem" }}
                value={formState.weaponSkillId}
              >
                <option value="">No linked skill</option>
                {content.skills.map((skill) => (
                  <option key={skill.id} value={skill.id}>
                    {skill.name}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: "0.25rem" }}>
              Weapon bonus
              <input
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    weaponBonus: event.target.value
                  }))
                }
                style={{ padding: "0.5rem" }}
                type="number"
                value={formState.weaponBonus}
              />
            </label>
          </div>
        ) : null}

        {formState.itemType === "shield" ? (
          <label style={{ display: "grid", gap: "0.25rem" }}>
            Shield bonus
            <input
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  shieldBonus: event.target.value
                }))
              }
              style={{ padding: "0.5rem", width: 180 }}
              type="number"
              value={formState.shieldBonus}
            />
          </label>
        ) : null}

        {formState.itemType === "armor" ? (
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
            }}
          >
            <label style={{ display: "grid", gap: "0.25rem" }}>
              Armor summary label
              <input
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    armorLabel: event.target.value
                  }))
                }
                style={{ padding: "0.5rem" }}
                type="text"
                value={formState.armorLabel}
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              Armor value
              <input
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    armorValue: event.target.value
                  }))
                }
                style={{ padding: "0.5rem" }}
                type="number"
                value={formState.armorValue}
              />
            </label>
          </div>
        ) : null}

        <label style={{ display: "grid", gap: "0.25rem" }}>
          Notes
          <input
            onChange={(event) => setFormState((current) => ({ ...current, notes: event.target.value }))}
            style={{ padding: "0.5rem" }}
            type="text"
            value={formState.notes}
          />
        </label>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button onClick={() => void handleSubmitItem()} type="button">
            {editingItemId ? "Update item" : "Add item"}
          </button>
          {editingItemId ? (
            <button onClick={() => resetForm()} type="button">
              Cancel edit
            </button>
          ) : null}
        </div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.5rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Loadout summary</h2>
        <div>{sheet.equipment.readinessLabel}</div>
        <div>Armor: {sheet.equipment.armorSummary}</div>
        <div>Equipped shield bonus: {sheet.equipment.shieldBonus}</div>
        <div>Dodge with current loadout: {sheet.combat.dodge}</div>
        <div>Parry with current loadout: {sheet.combat.parry}</div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "1rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Current items</h2>
        {draft.build.equipment.items.length > 0 ? (
          draft.build.equipment.items.map((item) => (
            <div key={item.id} style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}>
              <strong>{item.name}</strong>
              <div>Type: {item.itemType}</div>
              <div>Slot: {item.slot}</div>
              <div>Status: {item.equipped ? "Equipped" : "Carried"}</div>
              {item.weaponSkillId ? <div>Linked skill: {item.weaponSkillId}</div> : null}
              {item.weaponBonus ? <div>Weapon bonus: {item.weaponBonus}</div> : null}
              {item.shieldBonus ? <div>Shield bonus: {item.shieldBonus}</div> : null}
              {item.armorLabel ? <div>Armor summary: {item.armorLabel}</div> : null}
              {item.itemType === "armor" ? <div>Armor value: {item.armorValue ?? 0}</div> : null}
              {item.notes ? <div>Notes: {item.notes}</div> : null}
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => {
                    setEditingItemId(item.id);
                    setFormState(createFormStateFromItem(item));
                  }}
                  type="button"
                >
                  Edit
                </button>
                <button onClick={() => void handleToggleEquip(item.id, !item.equipped)} type="button">
                  {item.equipped ? "Unequip" : "Equip"}
                </button>
                <button onClick={() => void handleRemoveItem(item.id)} type="button">
                  Remove
                </button>
              </div>
            </div>
          ))
        ) : (
          <div>No equipment items yet.</div>
        )}
      </section>

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <button onClick={() => void handleSaveLocally()} type="button">
          Save equipment locally
        </button>
        <button onClick={() => void handleSaveToServer()} type="button">
          Save equipment to server
        </button>
      </section>
    </section>
  );
}
