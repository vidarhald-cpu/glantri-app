"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { supportsEquipmentQuantity } from "@glantri/domain/equipment";
import type {
  CanonicalEquipmentItem,
  ItemMechanicalOverride,
  DescriptiveItemTraitCategory,
  ItemFactVisibility,
} from "@glantri/domain/equipment";

import {
  assignCampaignItemOnServer,
  createCampaignItemOnServer,
  loadCharacterEquipmentState,
  loadCampaignItems,
  transferCampaignItemOnServer,
  unassignCampaignItemOnServer,
  updateCampaignItemOnServer,
  type CampaignEquipmentState,
  type CampaignItemCharacterOption,
  type CampaignItemFactDraft,
} from "@/lib/api/equipmentClient";
import { ItemFactsPresentation } from "../components/ItemFactsPresentation";

import { ItemOverrideEditor } from "./ItemOverrideEditor";

const panelStyle = {
  minWidth: 0,
  overflowWrap: "anywhere",
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

const emptyFacts = (): CampaignItemFactDraft => ({
  descriptiveTraits: [],
  templateOverrides: [],
  unsupportedCapabilities: [],
});

type Draft = {
  mechanicalOverrides: ItemMechanicalOverride[];
  physicalBaseEncumbrance: string;
  quantity: string;
  description: string;
  displayName: string;
  facts: CampaignItemFactDraft;
  holderCharacterId: string;
  templateId: string;
};

function itemToDraft(item: CanonicalEquipmentItem): Draft {
  return {
    quantity: String(item.quantity),
    description: item.notes ?? "",
    displayName: item.displayName ?? "",
    facts: {
      descriptiveTraits: item.itemFacts.descriptiveTraits.map((fact) => ({ ...fact })),
      finalAttackObDelta: item.itemFacts.activeMechanics[0]
        ? { ...item.itemFacts.activeMechanics[0] }
        : null,
      initiativeOverride: item.itemFacts.templateOverrides.find(
        (override) => override.kind === "weapon_initiative_override",
      )
        ? {
            ...item.itemFacts.templateOverrides.find(
              (override) => override.kind === "weapon_initiative_override",
            )!,
          }
        : null,
      templateOverrides: item.itemFacts.templateOverrides
        .filter((override) => override.kind !== "weapon_initiative_override")
        .map((override) => ({ ...override })),
      unsupportedCapabilities: item.itemFacts.unsupportedCapabilities.map((fact) => ({ ...fact })),
    },
    holderCharacterId: item.holderCharacterId ?? "",
    templateId: item.templateId ?? "",
    mechanicalOverrides: item.mechanicalOverrides ?? [],
    physicalBaseEncumbrance:
      item.physicalBaseEncumbrance == null ? "" : String(item.physicalBaseEncumbrance),
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
  initialHolderCharacterId,
  editingItem,
  onCancel,
  onSaved,
  state,
}: {
  campaignId: string;
  initialHolderCharacterId?: string;
  characters: CampaignItemCharacterOption[];
  editingItem: CanonicalEquipmentItem | null;
  onCancel: () => void;
  onSaved: (
    state: CampaignEquipmentState,
    characters: CampaignItemCharacterOption[],
    createAnother?: boolean,
  ) => void;
  state: CampaignEquipmentState;
}) {
  const firstTemplateId =
    Object.values(state.templatesById)
      .filter((template) => template.selectableForNewItems !== false)
      .sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? "";
  const [draft, setDraft] = useState<Draft>(() =>
    editingItem
      ? itemToDraft(editingItem)
      : {
          mechanicalOverrides: [],
          physicalBaseEncumbrance: "",
          quantity: "1",
          description: "",
          displayName: "",
          facts: emptyFacts(),
          holderCharacterId: initialHolderCharacterId ?? "",
          templateId: firstTemplateId,
        },
  );
  const [templateQuery, setTemplateQuery] = useState("");
  const [templateCategory, setTemplateCategory] = useState("");
  const [expectedItemRevision, setExpectedItemRevision] = useState(editingItem?.revision);
  const [createdNotice, setCreatedNotice] = useState<string>();
  const [latestItem, setLatestItem] = useState<CanonicalEquipmentItem>();
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

  async function save(createAnother = false) {
    if (!draft.templateId && !draft.displayName.trim()) {
      setError("Enter a name for this descriptive-only item.");
      return;
    }
    const quantity = Number(draft.quantity);
    if (
      (!editingItem || quantity !== editingItem.quantity) &&
      (!Number.isInteger(quantity) || quantity <= 0)
    ) {
      setError("Enter a positive whole number for quantity.");
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
            expectedItemRevision: expectedItemRevision ?? "",
            quantity: editingItem.quantity === 0 && quantity === 0 ? undefined : quantity,
            mechanicalOverrides: draft.mechanicalOverrides,
            physicalBaseEncumbrance:
              draft.physicalBaseEncumbrance === "" ? null : Number(draft.physicalBaseEncumbrance),
          })
        : await createCampaignItemOnServer({
            campaignId,
            description: draft.description,
            displayName: draft.displayName,
            facts: draft.facts,
            holderCharacterId: draft.holderCharacterId || null,
            quantity,
            templateId: draft.templateId || null,
            mechanicalOverrides: draft.mechanicalOverrides,
            physicalBaseEncumbrance:
              draft.physicalBaseEncumbrance === "" ? null : Number(draft.physicalBaseEncumbrance),
          });
      onSaved(response.state, response.characters, createAnother);
      if (createAnother) {
        setCreatedNotice(
          `${draft.displayName || selectedTemplate?.name} created. Ready for the next Item.`,
        );
        setDraft((current) => ({ ...current, displayName: "", description: "" }));
      }
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
      {!editingItem ? (
        <div style={{ display: "grid", gap: "0.5rem" }}>
          <label>
            Search Templates{" "}
            <input
              value={templateQuery}
              onChange={(event) => setTemplateQuery(event.target.value)}
            />
          </label>
          <label>
            Template category{" "}
            <select
              value={templateCategory}
              onChange={(event) => setTemplateCategory(event.target.value)}
            >
              <option value="">All categories</option>
              {["weapon", "armor", "shield", "gear", "valuables"].map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <label style={{ display: "grid", gap: "0.25rem" }}>
        {templateQuery &&
        !Object.values(state.templatesById).some(
          (template) =>
            template.selectableForNewItems !== false &&
            (!templateCategory || template.category === templateCategory) &&
            template.name.toLowerCase().includes(templateQuery.toLowerCase()),
        ) ? (
          <span>
            No matching Templates. Change the search or category; your current selection is
            retained.
          </span>
        ) : null}
        <span>Template</span>
        <select
          disabled={Boolean(editingItem)}
          onChange={(event) =>
            setDraft((current) => ({
              ...current,
              templateId: event.target.value,
              quantity: "1",
              mechanicalOverrides: [],
              physicalBaseEncumbrance: "",
              facts: emptyFacts(),
            }))
          }
          value={draft.templateId}
        >
          <option value="">Descriptive-only · no Equipment Template</option>
          {Object.values(state.templatesById)
            .filter(
              (template) =>
                template.id === draft.templateId ||
                (template.selectableForNewItems !== false &&
                  (!templateCategory || template.category === templateCategory) &&
                  template.name.toLowerCase().includes(templateQuery.toLowerCase())),
            )
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
        </select>
      </label>
      {selectedTemplate ? (
        <section style={panelStyle}>
          <strong>
            {selectedTemplate.name} · {selectedTemplate.category}
          </strong>
          <div>Base ENC: {selectedTemplate.baseEncumbrance}</div>
          {selectedTemplate.rulesNotes ? <p>{selectedTemplate.rulesNotes}</p> : null}
          {selectedTemplate.roleplayNotes ? <p>{selectedTemplate.roleplayNotes}</p> : null}
          {"attackModes" in selectedTemplate
            ? selectedTemplate.attackModes?.map((mode) => (
                <div key={mode.id}>
                  {mode.label ?? mode.id}: OB {mode.ob ?? "—"} · DMB{" "}
                  {mode.dmb ?? mode.dmbFormula?.raw ?? "—"}
                </div>
              ))
            : null}
          {"sourceMetadata" in selectedTemplate && selectedTemplate.sourceMetadata ? (
            <small>
              Source: {selectedTemplate.sourceMetadata.workbook} ·{" "}
              {selectedTemplate.sourceMetadata.sourceRange}
            </small>
          ) : null}
          {selectedTemplate.category === "weapon" ? (
            <fieldset style={panelStyle}>
              <legend>Disarm inputs</legend>
              <label>
                Disarm capability{" "}
                <select
                  value={
                    draft.facts.templateOverrides.find(
                      (entry) => entry.kind === "weapon_disarm_capability_override",
                    )?.value ?? "inherit"
                  }
                  onChange={(event) =>
                    updateFacts({
                      templateOverrides: [
                        ...draft.facts.templateOverrides.filter(
                          (entry) => entry.kind !== "weapon_disarm_capability_override",
                        ),
                        ...(event.target.value === "inherit"
                          ? []
                          : [
                              {
                                id: "item-disarm-capability",
                                kind: "weapon_disarm_capability_override" as const,
                                scope: "all_attack_modes" as const,
                                value: event.target.value as "none" | "trap",
                                visibility: "gm_only" as const,
                              },
                            ]),
                      ],
                    })
                  }
                >
                  <option value="inherit">
                    Inherit ({selectedTemplate.disarmCapability ?? "none"})
                  </option>
                  <option value="none">None</option>
                  <option value="trap">Trap</option>
                </select>
              </label>
              <label>
                Disarm control rating{" "}
                <select
                  value={
                    draft.facts.templateOverrides.find(
                      (entry) => entry.kind === "weapon_disarm_control_override",
                    )?.value ?? "inherit"
                  }
                  onChange={(event) =>
                    updateFacts({
                      templateOverrides: [
                        ...draft.facts.templateOverrides.filter(
                          (entry) => entry.kind !== "weapon_disarm_control_override",
                        ),
                        ...(event.target.value === "inherit"
                          ? []
                          : [
                              {
                                id: "item-disarm-control",
                                kind: "weapon_disarm_control_override" as const,
                                scope: "all_attack_modes" as const,
                                unit: "control_rating" as const,
                                value: Number(event.target.value),
                                visibility: "gm_only" as const,
                              },
                            ]),
                      ],
                    })
                  }
                >
                  <option value="inherit">Inherit / derive from Equipment</option>
                  {[1, 2, 3, 4, 5, 6].map((rating) => (
                    <option key={rating}>{rating}</option>
                  ))}
                </select>
              </label>
              <small>
                Overrides are GM only. Removing an override restores the existing Template/control
                calculation.
              </small>
            </fieldset>
          ) : null}
          <ItemOverrideEditor
            template={selectedTemplate}
            value={draft.mechanicalOverrides}
            onChange={(mechanicalOverrides) =>
              setDraft((current) => ({ ...current, mechanicalOverrides }))
            }
          />
        </section>
      ) : (
        <div>
          <p>Descriptive-only item · no weapon, armor, shield or ammunition mechanics.</p>
          <label>
            Physical base ENC (optional){" "}
            <input
              type="number"
              min="0"
              step="any"
              value={draft.physicalBaseEncumbrance}
              onChange={(event) =>
                setDraft((current) => ({ ...current, physicalBaseEncumbrance: event.target.value }))
              }
            />
          </label>
        </div>
      )}
      {selectedTemplate && supportsEquipmentQuantity(selectedTemplate) ? (
        <label style={{ display: "grid", gap: "0.25rem" }}>
          <span>Quantity</span>
          <input
            type="number"
            min="1"
            step="1"
            value={draft.quantity}
            onChange={(event) =>
              setDraft((current) => ({ ...current, quantity: event.target.value }))
            }
          />
        </label>
      ) : null}
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
          <legend>Recorded initiative — reference only</legend>
          <div>Standard initiative: {selectedTemplate.initiative}</div>
          <div>The app records this value but does not apply it to initiative.</div>
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
            Record a different initiative
          </label>
          {draft.facts.initiativeOverride ? (
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Recorded initiative</span>
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

      {selectedTemplate ? (
        <fieldset style={panelStyle}>
          <legend>Recorded final attack OB — reference only</legend>
          <div>The app records this value but does not apply it to attack OB.</div>
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
            Record final attack OB
          </label>
          {draft.facts.finalAttackObDelta ? (
            <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Recorded final attack OB</span>
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
            <div>No recorded final attack OB.</div>
          )}
        </fieldset>
      ) : null}

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
      {createdNotice ? <p role="status">{createdNotice}</p> : null}
      {error && editingItem ? (
        <button
          type="button"
          disabled={saving}
          onClick={() =>
            void loadCampaignItems(campaignId)
              .then((response) => setLatestItem(response.state.itemsById[editingItem.id]))
              .catch(() => setError("Unable to reload. Your draft is preserved."))
          }
        >
          Load latest Item for comparison
        </button>
      ) : null}
      {latestItem ? (
        <section style={panelStyle}>
          <strong>Latest saved Item</strong>
          <p>
            {latestItem.displayName || selectedTemplate?.name} ·{" "}
            {latestItem.notes || "No Item notes"}
          </p>
          <p>
            Quantity: {latestItem.quantity} · Holder:{" "}
            {characters.find((character) => character.id === latestItem.holderCharacterId)?.name ??
              "Unassigned"}
          </p>
          <ItemFactsPresentation item={latestItem} showVisibility template={selectedTemplate} />
          <p>Your draft is still in the editor. Review before reapplying it.</p>
          <button
            type="button"
            onClick={() => {
              setExpectedItemRevision(latestItem.revision);
              setLatestItem(undefined);
              setError(undefined);
            }}
          >
            Keep my draft and reapply against this version
          </button>
          <button
            type="button"
            onClick={() => {
              setDraft(itemToDraft(latestItem));
              setExpectedItemRevision(latestItem.revision);
              setLatestItem(undefined);
              setError(undefined);
            }}
          >
            Replace draft with latest Item
          </button>
        </section>
      ) : null}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button disabled={saving} onClick={() => void save()} type="button">
          {saving ? "Saving..." : editingItem ? "Save changes" : "Create item"}
        </button>
        {!editingItem ? (
          <button disabled={saving} onClick={() => void save(true)} type="button">
            Create and add another
          </button>
        ) : null}
        <button disabled={saving} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </section>
  );
}

function useEquipmentRevisions(characterIds: Array<string | null>): Record<string, number> {
  const key = [...new Set(characterIds.filter((id): id is string => Boolean(id)))].sort().join("|");
  const [snapshot, setSnapshot] = useState<{ key: string; revisions: Record<string, number> }>({
    key: "",
    revisions: {},
  });
  useEffect(() => {
    let cancelled = false;
    void Promise.all(
      key
        .split("|")
        .filter(Boolean)
        .map(async (id) => [id, (await loadCharacterEquipmentState(id)).revision ?? -1] as const),
    )
      .then((entries) => {
        if (!cancelled) setSnapshot({ key, revisions: Object.fromEntries(entries) });
      })
      .catch(() => {
        if (!cancelled) setSnapshot({ key, revisions: {} });
      });
    return () => {
      cancelled = true;
    };
  }, [key]);
  return snapshot.key === key ? snapshot.revisions : {};
}

function CampaignItemAssignmentDialog({
  characters,
  item,
  itemName,
  onCancel,
  onSaved,
  sourceName,
}: {
  characters: CampaignItemCharacterOption[];
  item: CanonicalEquipmentItem;
  itemName: string;
  onCancel: () => void;
  onSaved: (
    response: {
      characters: CampaignItemCharacterOption[];
      state: CampaignEquipmentState;
    },
    message: string,
  ) => void;
  sourceName?: string;
}) {
  const isUnassigning = Boolean(item.holderCharacterId);
  const [targetCharacterId, setTargetCharacterId] = useState(characters[0]?.id ?? "");
  const revisions = useEquipmentRevisions([
    isUnassigning ? item.holderCharacterId : targetCharacterId,
  ]);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const targetName = characters.find((character) => character.id === targetCharacterId)?.name;

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  async function save() {
    if (!item.campaignContextId) return;
    const characterId = isUnassigning ? item.holderCharacterId : targetCharacterId;
    if (!characterId) {
      setError("Choose a Character to receive this item.");
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      const expectedRevision = revisions[characterId];
      if (expectedRevision === undefined)
        throw new Error(
          "Equipment is still loading. Close and reopen this dialog if it could not load.",
        );
      const response = isUnassigning
        ? await unassignCampaignItemOnServer({
            campaignId: item.campaignContextId,
            itemId: item.id,
            expectedItemRevision: item.revision ?? "",
            sourceCharacterId: characterId,
            sourceExpectedRevision: expectedRevision,
          })
        : await assignCampaignItemOnServer({
            campaignId: item.campaignContextId,
            itemId: item.id,
            expectedItemRevision: item.revision ?? "",
            targetCharacterId: characterId,
            targetExpectedRevision: expectedRevision,
          });
      onSaved(
        response,
        isUnassigning
          ? `${itemName} returned from ${sourceName ?? "the Character"} to the campaign.`
          : `${itemName} assigned to ${targetName ?? "the Character"}. It is On person and not equipped.`,
      );
    } catch (caught) {
      setError(
        `Nothing changed. ${caught instanceof Error ? caught.message : "Unable to change this assignment."}`,
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
        'button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
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
    <section aria-modal="true" onKeyDown={handleDialogKeyDown} role="dialog" style={panelStyle}>
      <h2 ref={headingRef} style={{ margin: 0 }} tabIndex={-1}>
        {isUnassigning ? `Return ${itemName} to campaign` : `Assign ${itemName}`}
      </h2>
      {isUnassigning ? (
        <p style={{ margin: 0 }}>
          Remove this same item from {sourceName ?? "the Character"}’s equipment and keep it
          unassigned in the campaign. Any loadout selection for it will be cleared.
        </p>
      ) : (
        <>
          <p style={{ margin: 0 }}>
            Give this same campaign item to a Character. It will be On person and not equipped.
          </p>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Receiving Character</span>
            <select
              disabled={saving || characters.length === 0}
              onChange={(event) => setTargetCharacterId(event.target.value)}
              value={targetCharacterId}
            >
              {characters.length === 0 ? <option value="">No Character available</option> : null}
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
      {error ? (
        <div role="alert" style={{ color: "#8b3a1a" }}>
          {error}
        </div>
      ) : null}
      <div style={{ display: "flex", gap: "0.75rem" }}>
        <button
          disabled={
            saving ||
            (!isUnassigning && !targetName) ||
            revisions[isUnassigning ? item.holderCharacterId! : targetCharacterId] === undefined
          }
          onClick={() => void save()}
          type="button"
        >
          {saving
            ? isUnassigning
              ? "Returning..."
              : "Assigning..."
            : isUnassigning
              ? "Return to campaign"
              : "Assign item"}
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
  const revisions = useEquipmentRevisions([item.holderCharacterId, targetCharacterId]);
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
      if (
        revisions[item.holderCharacterId] === undefined ||
        revisions[targetCharacterId] === undefined
      )
        throw new Error(
          "Equipment is still loading. Close and reopen this dialog if it could not load.",
        );
      const response = await transferCampaignItemOnServer({
        campaignId: item.campaignContextId,
        itemId: item.id,
        expectedItemRevision: item.revision ?? "",
        sourceExpectedRevision: revisions[item.holderCharacterId],
        sourceCharacterId: item.holderCharacterId,
        targetCharacterId,
        targetExpectedRevision: revisions[targetCharacterId],
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
        <button
          disabled={
            saving ||
            !targetName ||
            revisions[item.holderCharacterId!] === undefined ||
            revisions[targetCharacterId] === undefined
          }
          onClick={() => void transfer()}
          type="button"
        >
          {saving ? "Transferring..." : "Transfer item"}
        </button>
        <button disabled={saving} onClick={onCancel} type="button">
          Cancel
        </button>
      </div>
    </section>
  );
}

export default function CampaignItemsWorkspace({
  campaignId,
  initialHolderCharacterId,
  initialItemId,
  createRequested = false,
}: {
  campaignId: string;
  initialHolderCharacterId?: string;
  initialItemId?: string;
  createRequested?: boolean;
}) {
  const [returnHolderId, setReturnHolderId] = useState(initialHolderCharacterId);
  useEffect(() => {
    if (initialHolderCharacterId) setReturnHolderId(initialHolderCharacterId);
  }, [initialHolderCharacterId]);
  const [state, setState] = useState<CampaignEquipmentState>();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [holderFilter, setHolderFilter] = useState("");
  useEffect(() => {
    const saved = sessionStorage.getItem(`campaign-items:${campaignId}`);
    if (saved) {
      try {
        const filters = JSON.parse(saved);
        setQuery(filters.query ?? "");
        setCategoryFilter(filters.categoryFilter ?? "");
        setHolderFilter(filters.holderFilter ?? "");
      } catch {
        /* Discard invalid local filter preferences. */
      }
    }
  }, [campaignId]);
  function rememberFilters(next: { query: string; categoryFilter: string; holderFilter: string }) {
    setQuery(next.query);
    setCategoryFilter(next.categoryFilter);
    setHolderFilter(next.holderFilter);
    sessionStorage.setItem(`campaign-items:${campaignId}`, JSON.stringify(next));
  }

  const [characters, setCharacters] = useState<CampaignItemCharacterOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();
  const [feedback, setFeedback] = useState<string>();
  const [assignmentItemId, setAssignmentItemId] = useState<string>();
  const [editingItemId, setEditingItemId] = useState<string | null | undefined>(
    initialItemId ?? (createRequested ? null : undefined),
  );
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

  const [loadAttempt, setLoadAttempt] = useState(0);
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
  }, [campaignId, loadAttempt]);

  if (loading) return <section style={panelStyle}>Loading campaign items...</section>;
  if (error || !state)
    return (
      <section role="alert" style={panelStyle}>
        {error ?? "Unable to load campaign items."}
        <button type="button" onClick={() => setLoadAttempt((attempt) => attempt + 1)}>
          Retry loading Items
        </button>
      </section>
    );

  if (editingItemId !== undefined) {
    return (
      <CampaignItemEditor
        campaignId={campaignId}
        initialHolderCharacterId={initialHolderCharacterId}
        characters={characters}
        editingItem={editingItem}
        key={editingItem?.id ?? "create"}
        onCancel={() => setEditingItemId(undefined)}
        onSaved={(nextState, nextCharacters, createAnother) => {
          setState(nextState);
          setCharacters(nextCharacters);
          setFeedback(editingItem ? "Item changes saved." : "Item created.");
          if (!createAnother) setEditingItemId(undefined);
        }}
        state={state}
      />
    );
  }

  const transferringItem = transferringItemId ? state.itemsById[transferringItemId] : undefined;
  if (transferringItem?.holderCharacterId) {
    const template =
      transferringItem.templateId === null
        ? undefined
        : state.templatesById[transferringItem.templateId];
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

  const assignmentItem = assignmentItemId ? state.itemsById[assignmentItemId] : undefined;
  if (assignmentItem) {
    const template =
      assignmentItem.templateId === null
        ? undefined
        : state.templatesById[assignmentItem.templateId];
    const itemName = assignmentItem.displayName || template?.name || "item";
    return (
      <CampaignItemAssignmentDialog
        characters={characters}
        item={assignmentItem}
        itemName={itemName}
        onCancel={() => setAssignmentItemId(undefined)}
        onSaved={(response, message) => {
          setState(response.state);
          setCharacters(response.characters);
          setFeedback(message);
          setAssignmentItemId(undefined);
        }}
        sourceName={
          assignmentItem.holderCharacterId
            ? (holders.get(assignmentItem.holderCharacterId) ?? "Character")
            : undefined
        }
      />
    );
  }

  const allItems = Object.values(state.itemsById);
  const items = allItems.filter((item) => {
    const template = item.templateId === null ? undefined : state.templatesById[item.templateId];
    const visibleName = `${item.displayName ?? ""} ${template?.name ?? ""}`.toLowerCase();
    return (
      visibleName.includes(query.toLowerCase()) &&
      (!categoryFilter || (item.category ?? "descriptive") === categoryFilter) &&
      (!holderFilter ||
        (holderFilter === "unassigned"
          ? item.holderCharacterId === null
          : item.holderCharacterId === holderFilter))
    );
  });
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
      {returnHolderId ? (
        <a href={`/characters/${returnHolderId}/equipment`}>Return to Character inventory</a>
      ) : null}
      {feedback ? (
        <div ref={feedbackRef} role="status" tabIndex={-1}>
          {feedback}
        </div>
      ) : null}
      <div style={{ ...panelStyle, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <label>
          Find Items{" "}
          <input
            value={query}
            onChange={(event) =>
              rememberFilters({ query: event.target.value, categoryFilter, holderFilter })
            }
          />
        </label>
        <label>
          Item category{" "}
          <select
            aria-label="Item category"
            value={categoryFilter}
            onChange={(event) =>
              rememberFilters({ query, categoryFilter: event.target.value, holderFilter })
            }
          >
            <option value="">All categories</option>
            {["weapon", "armor", "shield", "gear", "valuables", "descriptive"].map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <label>
          Holder{" "}
          <select
            aria-label="Holder"
            value={holderFilter}
            onChange={(event) =>
              rememberFilters({ query, categoryFilter, holderFilter: event.target.value })
            }
          >
            <option value="">All holders</option>
            <option value="unassigned">Unassigned</option>
            {characters.map((character) => (
              <option key={character.id} value={character.id}>
                {character.name}
              </option>
            ))}
          </select>
        </label>
        <span aria-live="polite">
          {items.length} of {allItems.length} Items
        </span>
      </div>
      {items.length === 0 ? (
        <section style={panelStyle}>
          <strong>
            {allItems.length ? "No Items match these filters." : "No campaign items yet."}
          </strong>
          <div>
            {allItems.length
              ? "Change or clear the filters to find your Items."
              : "Create an item from a Template or a descriptive-only item."}
          </div>
        </section>
      ) : (
        items.map((item) => {
          const template =
            item.templateId === null ? undefined : state.templatesById[item.templateId];

          return (
            <article key={item.id} style={panelStyle}>
              <div
                style={{
                  alignItems: "start",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "1rem",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h2 style={{ margin: 0 }}>
                    {item.displayName || template?.name || "Unavailable Template"}
                  </h2>
                  {item.displayName ? <div>{template?.name ?? "Descriptive-only item"}</div> : null}
                  <div>
                    {item.holderCharacterId
                      ? `Held by ${holders.get(item.holderCharacterId) ?? "Character"}`
                      : "Unassigned / in campaign"}
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  {item.holderCharacterId ? (
                    <>
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
                      <button
                        onClick={() => {
                          setFeedback(undefined);
                          setAssignmentItemId(item.id);
                        }}
                        type="button"
                      >
                        Return to campaign
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => {
                        setFeedback(undefined);
                        setAssignmentItemId(item.id);
                      }}
                      type="button"
                    >
                      Assign item
                    </button>
                  )}
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
              {item.holderCharacterId ? (
                <a
                  href={`/characters/${item.holderCharacterId}/equipment?campaignId=${encodeURIComponent(campaignId)}`}
                >
                  Open inventory · move or equip
                </a>
              ) : null}
              <div>
                Quantity: {item.quantity} · {item.category ?? "Descriptive-only"} ·{" "}
                {item.storageAssignment?.carryMode === "equipped" ? "Equipped" : "Not equipped"}
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
