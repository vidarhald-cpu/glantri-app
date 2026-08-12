"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type {
  CanonicalEquipmentItem,
  DescriptiveItemTraitCategory,
  ItemFactVisibility,
} from "@glantri/domain/equipment";

import {
  createCampaignItemOnServer,
  loadCampaignItems,
  transferCampaignItemOnServer,
  updateCampaignItemOnServer,
  type CampaignEquipmentState,
  type CampaignItemCharacterOption,
  type CampaignItemFactDraft,
} from "@/lib/api/equipmentClient";
import { ItemFactsPresentation } from "../components/ItemFactsPresentation";

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

const emptyFacts = (): CampaignItemFactDraft => ({
  descriptiveTraits: [],
  unsupportedCapabilities: [],
});

type Draft = {
  description: string;
  displayName: string;
  facts: CampaignItemFactDraft;
  holderCharacterId: string;
  templateId: string;
};

function itemToDraft(item: CanonicalEquipmentItem): Draft {
  return {
    description: item.notes ?? "",
    displayName: item.displayName ?? "",
    facts: {
      descriptiveTraits: item.itemFacts.descriptiveTraits.map((fact) => ({ ...fact })),
      finalAttackObDelta: item.itemFacts.activeMechanics[0]
        ? { ...item.itemFacts.activeMechanics[0] }
        : null,
      initiativeOverride: item.itemFacts.templateOverrides[0]
        ? { ...item.itemFacts.templateOverrides[0] }
        : null,
      unsupportedCapabilities: item.itemFacts.unsupportedCapabilities.map((fact) => ({ ...fact })),
    },
    holderCharacterId: item.holderCharacterId ?? "",
    templateId: item.templateId,
  };
}

function VisibilitySelect({
  onChange,
  value,
}: {
  onChange: (value: ItemFactVisibility) => void;
  value: ItemFactVisibility;
}) {
  return (
    <label style={{ display: "grid", gap: "0.25rem" }}>
      <span>Player visibility</span>
      <select
        onChange={(event) => onChange(event.target.value as ItemFactVisibility)}
        value={value}
      >
        <option value="gm_only">GM only</option>
        <option value="revealed">Revealed to holder</option>
      </select>
    </label>
  );
}

function CampaignItemEditor({
  campaignId,
  characters,
  editingItem,
  onCancel,
  onSaved,
  state,
}: {
  campaignId: string;
  characters: CampaignItemCharacterOption[];
  editingItem: CanonicalEquipmentItem | null;
  onCancel: () => void;
  onSaved: (state: CampaignEquipmentState, characters: CampaignItemCharacterOption[]) => void;
  state: CampaignEquipmentState;
}) {
  const firstTemplateId =
    Object.values(state.templatesById).sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? "";
  const [draft, setDraft] = useState<Draft>(() =>
    editingItem
      ? itemToDraft(editingItem)
      : {
          description: "",
          displayName: "",
          facts: emptyFacts(),
          holderCharacterId: "",
          templateId: firstTemplateId,
        },
  );
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const selectedTemplate = state.templatesById[draft.templateId];

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  function updateFacts(change: Partial<CampaignItemFactDraft>) {
    setDraft((current) => ({ ...current, facts: { ...current.facts, ...change } }));
  }

  async function save() {
    if (!draft.templateId) {
      setError("Choose an item template.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const response = editingItem
        ? await updateCampaignItemOnServer({
            campaignId: editingItem.campaignContextId!,
            description: draft.description,
            displayName: draft.displayName,
            facts: draft.facts,
            itemId: editingItem.id,
          })
        : await createCampaignItemOnServer({
            campaignId,
            description: draft.description,
            displayName: draft.displayName,
            facts: draft.facts,
            holderCharacterId: draft.holderCharacterId || null,
            templateId: draft.templateId,
          });
      onSaved(response.state, response.characters);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label={editingItem ? "Edit item" : "Create item"} style={panelStyle}>
      <h2 ref={headingRef} style={{ margin: 0 }} tabIndex={-1}>
        {editingItem ? "Edit item" : "Create item"}
      </h2>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Template</span>
        <select
          disabled={Boolean(editingItem)}
          onChange={(event) =>
            setDraft((current) => ({ ...current, templateId: event.target.value }))
          }
          value={draft.templateId}
        >
          {Object.values(state.templatesById)
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
        </select>
      </label>
      <div
        style={{
          display: "grid",
          gap: "0.75rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        }}
      >
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Item name (optional)</span>
          <input
            onChange={(event) =>
              setDraft((current) => ({ ...current, displayName: event.target.value }))
            }
            value={draft.displayName}
          />
        </label>
        {editingItem ? (
          <div style={{ display: "grid", gap: "0.25rem" }}>
            <strong>Assignment</strong>
            <div>
              {draft.holderCharacterId
                ? `Held by ${characters.find((character) => character.id === draft.holderCharacterId)?.name ?? "Character"}`
                : "Unassigned / in campaign"}
            </div>
          </div>
        ) : (
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Initial assignment</span>
            <select
              onChange={(event) =>
                setDraft((current) => ({ ...current, holderCharacterId: event.target.value }))
              }
              value={draft.holderCharacterId}
            >
              <option value="">Unassigned / in campaign</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Description (optional)</span>
        <textarea
          rows={3}
          onChange={(event) =>
            setDraft((current) => ({ ...current, description: event.target.value }))
          }
          value={draft.description}
        />
      </label>

      {selectedTemplate?.category === "weapon" &&
      typeof selectedTemplate.initiative === "number" ? (
        <fieldset style={panelStyle}>
          <legend>Differences from standard</legend>
          <div>Standard initiative: {selectedTemplate.initiative}</div>
          <label>
            <input
              checked={Boolean(draft.facts.initiativeOverride)}
              onChange={(event) =>
                updateFacts({
                  initiativeOverride: event.target.checked
                    ? { value: selectedTemplate.initiative!, visibility: "gm_only" }
                    : null,
                })
              }
              type="checkbox"
            />{" "}
            Use a different initiative
          </label>
          {draft.facts.initiativeOverride ? (
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Actual initiative</span>
                <input
                  type="number"
                  value={draft.facts.initiativeOverride.value}
                  onChange={(event) =>
                    updateFacts({
                      initiativeOverride: {
                        ...draft.facts.initiativeOverride!,
                        value: Number(event.target.value),
                      },
                    })
                  }
                />
              </label>
              <VisibilitySelect
                value={draft.facts.initiativeOverride.visibility}
                onChange={(value) =>
                  updateFacts({
                    initiativeOverride: { ...draft.facts.initiativeOverride!, visibility: value },
                  })
                }
              />
            </div>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset style={panelStyle}>
        <legend>Active mechanics</legend>
        <label>
          <input
            checked={Boolean(draft.facts.finalAttackObDelta)}
            onChange={(event) =>
              updateFacts({
                finalAttackObDelta: event.target.checked
                  ? { value: 0, visibility: "gm_only" }
                  : null,
              })
            }
            type="checkbox"
          />{" "}
          Add final attack OB contribution
        </label>
        {draft.facts.finalAttackObDelta ? (
          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Final attack OB</span>
              <input
                type="number"
                value={draft.facts.finalAttackObDelta.value}
                onChange={(event) =>
                  updateFacts({
                    finalAttackObDelta: {
                      ...draft.facts.finalAttackObDelta!,
                      value: Number(event.target.value),
                    },
                  })
                }
              />
            </label>
            <VisibilitySelect
              value={draft.facts.finalAttackObDelta.visibility}
              onChange={(value) =>
                updateFacts({
                  finalAttackObDelta: { ...draft.facts.finalAttackObDelta!, visibility: value },
                })
              }
            />
          </div>
        ) : (
          <div>No active mechanics added.</div>
        )}
      </fieldset>

      <fieldset style={panelStyle}>
        <legend>Descriptive traits</legend>
        {draft.facts.descriptiveTraits.map((trait, index) => (
          <div
            key={trait.id ?? index}
            style={{
              display: "grid",
              gap: "0.5rem",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            }}
          >
            <select
              aria-label={`Trait ${index + 1} category`}
              value={trait.category}
              onChange={(event) =>
                updateFacts({
                  descriptiveTraits: draft.facts.descriptiveTraits.map((value, position) =>
                    position === index
                      ? { ...value, category: event.target.value as DescriptiveItemTraitCategory }
                      : value,
                  ),
                })
              }
            >
              {[
                "engraving",
                "maker_mark",
                "appearance",
                "provenance",
                "craftsmanship",
                "history",
                "material",
                "inscription",
                "other",
              ].map((category) => (
                <option key={category} value={category}>
                  {category.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <input
              aria-label={`Trait ${index + 1}`}
              value={trait.text}
              onChange={(event) =>
                updateFacts({
                  descriptiveTraits: draft.facts.descriptiveTraits.map((value, position) =>
                    position === index ? { ...value, text: event.target.value } : value,
                  ),
                })
              }
            />
            <select
              aria-label={`Trait ${index + 1} visibility`}
              value={trait.visibility}
              onChange={(event) =>
                updateFacts({
                  descriptiveTraits: draft.facts.descriptiveTraits.map((value, position) =>
                    position === index
                      ? { ...value, visibility: event.target.value as ItemFactVisibility }
                      : value,
                  ),
                })
              }
            >
              <option value="gm_only">GM only</option>
              <option value="revealed">Revealed to holder</option>
            </select>
            <button
              type="button"
              onClick={() =>
                updateFacts({
                  descriptiveTraits: draft.facts.descriptiveTraits.filter(
                    (_, position) => position !== index,
                  ),
                })
              }
            >
              Remove
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            updateFacts({
              descriptiveTraits: [
                ...draft.facts.descriptiveTraits,
                { category: "other", text: "", visibility: "gm_only" },
              ],
            })
          }
        >
          Add descriptive trait
        </button>
      </fieldset>

      <fieldset style={panelStyle}>
        <legend>Recorded capabilities</legend>
        <div>
          These are real item capabilities, but the app does not automatically calculate or track
          them.
        </div>
        {draft.facts.unsupportedCapabilities.map((capability, index) => (
          <div key={capability.id ?? index} style={{ ...panelStyle, background: "#faf9f5" }}>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Name</span>
              <input
                value={capability.name}
                onChange={(event) =>
                  updateFacts({
                    unsupportedCapabilities: draft.facts.unsupportedCapabilities.map(
                      (value, position) =>
                        position === index ? { ...value, name: event.target.value } : value,
                    ),
                  })
                }
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Rules text</span>
              <textarea
                value={capability.rulesText}
                onChange={(event) =>
                  updateFacts({
                    unsupportedCapabilities: draft.facts.unsupportedCapabilities.map(
                      (value, position) =>
                        position === index ? { ...value, rulesText: event.target.value } : value,
                    ),
                  })
                }
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              <span>Usage (optional)</span>
              <input
                value={capability.usageText ?? ""}
                onChange={(event) =>
                  updateFacts({
                    unsupportedCapabilities: draft.facts.unsupportedCapabilities.map(
                      (value, position) =>
                        position === index ? { ...value, usageText: event.target.value } : value,
                    ),
                  })
                }
              />
            </label>
            <VisibilitySelect
              value={capability.visibility}
              onChange={(value) =>
                updateFacts({
                  unsupportedCapabilities: draft.facts.unsupportedCapabilities.map(
                    (entry, position) =>
                      position === index ? { ...entry, visibility: value } : entry,
                  ),
                })
              }
            />
            <button
              type="button"
              onClick={() =>
                updateFacts({
                  unsupportedCapabilities: draft.facts.unsupportedCapabilities.filter(
                    (_, position) => position !== index,
                  ),
                })
              }
            >
              Remove capability
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            updateFacts({
              unsupportedCapabilities: [
                ...draft.facts.unsupportedCapabilities,
                { name: "", rulesText: "", usageText: "", visibility: "gm_only" },
              ],
            })
          }
        >
          Add recorded capability
        </button>
      </fieldset>

      {error ? (
        <div role="alert" style={{ color: "#8b3a1a" }}>
          {error}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button disabled={saving} onClick={() => void save()} type="button">
          {saving ? "Saving..." : editingItem ? "Save changes" : "Create item"}
        </button>
        <button disabled={saving} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </section>
  );
}

function TransferItemDialog({
  characters,
  item,
  itemName,
  onCancel,
  onTransferred,
  sourceName,
}: {
  characters: CampaignItemCharacterOption[];
  item: CanonicalEquipmentItem;
  itemName: string;
  onCancel: () => void;
  onTransferred: (
    response: { characters: CampaignItemCharacterOption[]; state: CampaignEquipmentState },
    targetName: string,
  ) => void;
  sourceName: string;
}) {
  const targets = characters.filter((character) => character.id !== item.holderCharacterId);
  const [targetCharacterId, setTargetCharacterId] = useState(targets[0]?.id ?? "");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const targetName = targets.find((character) => character.id === targetCharacterId)?.name;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function transfer() {
    if (!item.campaignContextId || !item.holderCharacterId || !targetCharacterId || !targetName) {
      setError("Choose a Character to receive this item.");
      return;
    }

    setSaving(true);
    setError(undefined);
    try {
      const response = await transferCampaignItemOnServer({
        campaignId: item.campaignContextId,
        itemId: item.id,
        sourceCharacterId: item.holderCharacterId,
        targetCharacterId,
      });
      onTransferred(response, targetName);
    } catch (caught) {
      setError(
        `Nothing changed. ${caught instanceof Error ? caught.message : "Unable to transfer this item."}`,
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && !saving) {
      onCancel();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ),
    );
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first && last) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last && first) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <section
      aria-labelledby="transfer-item-heading"
      aria-modal="true"
      onKeyDown={handleDialogKeyDown}
      role="dialog"
      style={panelStyle}
    >
      <h2 id="transfer-item-heading" ref={headingRef} style={{ margin: 0 }} tabIndex={-1}>
        Transfer {itemName}
      </h2>
      <p style={{ margin: 0 }}>
        Move this same item from {sourceName} to another Character in the campaign.
      </p>
      <label style={{ display: "grid", gap: "0.25rem" }}>
        <span>Receiving Character</span>
        <select
          disabled={saving || targets.length === 0}
          onChange={(event) => setTargetCharacterId(event.target.value)}
          value={targetCharacterId}
        >
          {targets.length === 0 ? <option value="">No other Character available</option> : null}
          {targets.map((character) => (
            <option key={character.id} value={character.id}>
              {character.name}
            </option>
          ))}
        </select>
      </label>
      {targetName ? (
        <div>
          Transfer {itemName} from {sourceName} to {targetName}. It will be On person and will not
          be equipped.
        </div>
      ) : (
        <div>Add another Character to the campaign roster before transferring this item.</div>
      )}
      {error ? (
        <div role="alert" style={{ color: "#8b3a1a" }}>
          {error}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button disabled={saving || !targetName} onClick={() => void transfer()} type="button">
          {saving ? "Transferring..." : "Transfer item"}
        </button>
        <button disabled={saving} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </section>
  );
}

export default function CampaignItemsWorkspace({ campaignId }: { campaignId: string }) {
  const [state, setState] = useState<CampaignEquipmentState>();
  const [characters, setCharacters] = useState<CampaignItemCharacterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [editingItemId, setEditingItemId] = useState<string | null>();
  const [transferringItemId, setTransferringItemId] = useState<string>();
  const transferButtonRef = useRef<HTMLButtonElement | null>(null);
  const transferTriggerItemIdRef = useRef<string | undefined>(undefined);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const editingItem = editingItemId ? (state?.itemsById[editingItemId] ?? null) : null;
  const holders = useMemo(
    () => new Map(characters.map((character) => [character.id, character.name])),
    [characters],
  );

  useEffect(() => {
    if (feedback) feedbackRef.current?.focus();
  }, [feedback]);

  function closeTransfer() {
    setTransferringItemId(undefined);
    requestAnimationFrame(() => transferButtonRef.current?.focus());
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadCampaignItems(campaignId)
      .then((response) => {
        if (cancelled) return;
        setState(response.state);
        setCharacters(response.characters);
        setError(undefined);
      })
      .catch(
        (caught) =>
          !cancelled &&
          setError(caught instanceof Error ? caught.message : "Unable to load campaign items."),
      )
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  if (loading) return <section style={panelStyle}>Loading campaign items...</section>;
  if (error || !state)
    return (
      <section role="alert" style={panelStyle}>
        {error ?? "Unable to load campaign items."}
      </section>
    );

  if (editingItemId !== undefined) {
    return (
      <CampaignItemEditor
        campaignId={campaignId}
        characters={characters}
        editingItem={editingItem}
        key={editingItem?.id ?? "create"}
        onCancel={() => setEditingItemId(undefined)}
        onSaved={(nextState, nextCharacters) => {
          setState(nextState);
          setCharacters(nextCharacters);
          setFeedback(editingItem ? "Item changes saved." : "Item created.");
          setEditingItemId(undefined);
        }}
        state={state}
      />
    );
  }

  const transferringItem = transferringItemId ? state.itemsById[transferringItemId] : undefined;
  if (transferringItem?.holderCharacterId) {
    const template = state.templatesById[transferringItem.templateId];
    const itemName = transferringItem.displayName || template?.name || "item";
    const sourceName = holders.get(transferringItem.holderCharacterId) ?? "Character";
    return (
      <TransferItemDialog
        characters={characters}
        item={transferringItem}
        itemName={itemName}
        onCancel={closeTransfer}
        onTransferred={(response, targetName) => {
          setState(response.state);
          setCharacters(response.characters);
          setFeedback(
            `${itemName} transferred from ${sourceName} to ${targetName}. It is On person and not equipped.`,
          );
          setTransferringItemId(undefined);
        }}
        sourceName={sourceName}
      />
    );
  }

  const items = Object.values(state.itemsById);
  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <header style={{ ...panelStyle, alignItems: "center", gridTemplateColumns: "1fr auto" }}>
        <div>
          <h1 style={{ margin: 0 }}>Campaign items</h1>
          <div>Create and edit actual items in this campaign.</div>
        </div>
        <button
          onClick={() => {
            setFeedback(undefined);
            setEditingItemId(null);
          }}
          type="button"
        >
          Create item
        </button>
      </header>
      {feedback ? (
        <div ref={feedbackRef} role="status" tabIndex={-1}>
          {feedback}
        </div>
      ) : null}
      {items.length === 0 ? (
        <section style={panelStyle}>
          <strong>No campaign items yet.</strong>
          <div>Create an item from an existing template.</div>
        </section>
      ) : (
        items.map((item) => {
          const template = state.templatesById[item.templateId];
          if (!template) return null;
          return (
            <article key={item.id} style={panelStyle}>
              <div
                style={{
                  alignItems: "start",
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>{item.displayName || template.name}</h2>
                  {item.displayName ? <div>{template.name}</div> : null}
                  <div>
                    {item.holderCharacterId
                      ? `Held by ${holders.get(item.holderCharacterId) ?? "Character"}`
                      : "Unassigned / in campaign"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {item.holderCharacterId ? (
                    <button
                      onClick={(event) => {
                        transferTriggerItemIdRef.current = item.id;
                        transferButtonRef.current = event.currentTarget;
                        setFeedback(undefined);
                        setTransferringItemId(item.id);
                      }}
                      ref={(button) => {
                        if (button && transferTriggerItemIdRef.current === item.id) {
                          transferButtonRef.current = button;
                        }
                      }}
                      type="button"
                    >
                      Transfer item
                    </button>
                  ) : null}
                  <button
                    onClick={() => {
                      setFeedback(undefined);
                      setEditingItemId(item.id);
                    }}
                    type="button"
                  >
                    Edit item
                  </button>
                </div>
              </div>
              {item.notes ? <p style={{ margin: 0 }}>{item.notes}</p> : null}
              <ItemFactsPresentation item={item} showVisibility template={template} />
            </article>
          );
        })
      )}
    </section>
  );
}
