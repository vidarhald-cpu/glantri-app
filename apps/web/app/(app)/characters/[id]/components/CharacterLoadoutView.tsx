"use client";

import { useEffect, useMemo, useState } from "react";

import {
  calculateCharacterGeneralHitpoints,
  type CombatEffectsState,
  type ScenarioParticipantCombatContext,
} from "@glantri/domain";

import type { CombatEffectEditorDraft } from "@/features/equipment/components/PhysicalStateSection";
import { getEquipmentTemplateById } from "@/features/equipment/equipmentSelectors";
import {
  buildEquipmentLoadoutModuleModel,
  EquipmentLoadoutModule,
} from "@/features/equipment/loadoutModule";
import { PhysicalStateSection } from "@/features/equipment/components/PhysicalStateSection";
import { isValidLoadoutThrowingWeaponItem } from "@/features/equipment/loadoutWeaponOptions";
import type { EquipmentFeatureState } from "@/features/equipment/types";
import {
  loadCharacterEquipmentState,
  setCharacterActiveAmmunitionOnServer,
  setCharacterActiveMissileWeaponOnServer,
  setCharacterActivePrimaryWeaponOnServer,
  setCharacterActiveSecondaryWeaponOnServer,
  setCharacterReadyShieldOnServer,
  setCharacterWornArmorOnServer,
} from "@/lib/api/localServiceClient";
import {
  loadCurrentCharacterContext,
  loadLocalCharacterContext,
} from "@/lib/characters/loadLocalCharacterContext";
import { applyCombatEffectDraft, removeCombatEffect } from "@/lib/characters/combatEffectEdits";
import { buildCharacterPhysicalStateView } from "@/lib/characters/physicalState";
import { buildEncounterLiveCombatModifierSummary } from "@/lib/campaigns/liveCombatModifiers";

interface CharacterLoadoutViewProps {
  canEditCombatEffects?: boolean;
  characterId: string;
  onCombatEffectsChange?: (nextState: CombatEffectsState) => Promise<void> | void;
  onEquipmentStateChange?: (nextState: EquipmentFeatureState) => Promise<void> | void;
  physicalStateCombatContext?: ScenarioParticipantCombatContext;
  physicalStateCombatEffects?: CombatEffectsState;
  physicalStateEncounterId?: string;
  physicalStateGeneralHitpoints?: number | null;
  physicalStateCurrentRoundNumber?: number;
  physicalStateScenarioId?: string;
  physicalStateTargetParticipantId?: string;
  preferCurrentCharacterRecord?: boolean;
  showPhysicalState?: boolean;
}

type CharacterLoadoutContext =
  | Awaited<ReturnType<typeof loadCurrentCharacterContext>>
  | Awaited<ReturnType<typeof loadLocalCharacterContext>>;

function getCharacterName(name: string | undefined): string {
  return name?.trim() || "Unnamed character";
}

function isBowOrTwoHandedTemplate(
  templateId: string | null,
  state: EquipmentFeatureState,
): boolean {
  if (!templateId) {
    return false;
  }

  const template = getEquipmentTemplateById(state, templateId);
  return (
    template?.category === "weapon" &&
    (template.handlingClass === "two_handed" ||
      template.weaponClass === "bow" ||
      template.tags.includes("bow"))
  );
}

export default function CharacterLoadoutView({
  canEditCombatEffects = false,
  characterId,
  onCombatEffectsChange,
  onEquipmentStateChange,
  physicalStateCombatContext,
  physicalStateCombatEffects,
  physicalStateCurrentRoundNumber,
  physicalStateEncounterId,
  physicalStateGeneralHitpoints,
  physicalStateScenarioId,
  physicalStateTargetParticipantId,
  preferCurrentCharacterRecord = false,
  showPhysicalState = false,
}: CharacterLoadoutViewProps) {
  const [state, setState] = useState<EquipmentFeatureState | null>(null);
  const [characterContext, setCharacterContext] = useState<CharacterLoadoutContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string>();
  const [activeAmmunitionError, setActiveAmmunitionError] = useState<string>();
  const [throwingWeaponItemId, setThrowingWeaponItemId] = useState<string>("");
  const [errors, setErrors] = useState<
    Record<"armor" | "missile" | "primary" | "secondary" | "shield", string | undefined>
  >({
    armor: undefined,
    missile: undefined,
    primary: undefined,
    secondary: undefined,
    shield: undefined,
  });

  useEffect(() => {
    let cancelled = false;
    const loadCharacterContext = preferCurrentCharacterRecord
      ? loadCurrentCharacterContext
      : loadLocalCharacterContext;

    setLoading(true);
    Promise.all([loadCharacterEquipmentState(characterId), loadCharacterContext(characterId)])
      .then(([nextState, nextCharacterContext]) => {
        if (cancelled) {
          return;
        }

        setState(nextState);
        setCharacterContext(nextCharacterContext);
        setPageError(undefined);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        const message = error instanceof Error ? error.message : "Unable to load loadout.";
        setPageError(
          message === "Character not found."
            ? "Character not found or not accessible from this account."
            : message,
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [characterId, preferCurrentCharacterRecord]);

  useEffect(() => {
    if (!throwingWeaponItemId || !state) {
      return;
    }

    const selectedThrowingWeaponItem = state.itemsById[throwingWeaponItemId];
    if (
      !isValidLoadoutThrowingWeaponItem({
        item: selectedThrowingWeaponItem,
        state,
      })
    ) {
      setThrowingWeaponItemId("");
    }
  }, [state, throwingWeaponItemId]);

  const model = useMemo(() => {
    const liveCombatModifiers = showPhysicalState
      ? buildEncounterLiveCombatModifierSummary({
          combatContext: physicalStateCombatContext,
          combatEffects: physicalStateCombatEffects,
        })
      : undefined;

    return buildEquipmentLoadoutModuleModel({
      characterContext:
        characterContext?.record && characterContext.content
          ? {
              content: characterContext.content,
              record: characterContext.record,
            }
          : null,
      characterId,
      errors,
      liveCombatModifiers,
      state,
      throwingWeaponItemId,
    });
  }, [
    characterContext,
    errors,
    characterId,
    physicalStateCombatContext,
    physicalStateCombatEffects,
    showPhysicalState,
    state,
    throwingWeaponItemId,
  ]);
  const physicalStateModel = useMemo(
    () =>
      showPhysicalState
        ? buildCharacterPhysicalStateView({
            combatEffects: physicalStateCombatEffects,
            generalHitpoints:
              physicalStateGeneralHitpoints ??
              (characterContext?.record?.build
                ? calculateCharacterGeneralHitpoints(characterContext.record.build)
                : null),
          })
        : null,
    [
      characterContext?.record?.build,
      physicalStateCombatEffects,
      physicalStateGeneralHitpoints,
      showPhysicalState,
    ],
  );
  const activeLoadout = state?.activeLoadoutByCharacterId[characterId];
  const activeMissileWeapon = activeLoadout?.activeMissileWeaponItemId
    ? state?.itemsById[activeLoadout.activeMissileWeaponItemId]
    : undefined;
  const activeMissileTemplate =
    state && activeMissileWeapon
      ? getEquipmentTemplateById(state, activeMissileWeapon.templateId)
      : undefined;
  const activeAmmunitionOptions = useMemo(() => {
    const ammunitionFamily =
      activeMissileTemplate?.category === "weapon"
        ? activeMissileTemplate.missileProfile?.ammoFamily
        : undefined;
    if (!state || !ammunitionFamily) {
      return [];
    }

    return Object.values(state.itemsById)
      .filter((item) => item.characterId === characterId && item.category === "gear")
      .filter((item) => {
        const template = getEquipmentTemplateById(state, item.templateId);
        return (
          template?.category === "gear" && template.ammunitionProfile?.family === ammunitionFamily
        );
      })
      .map((item) => ({
        id: item.id,
        label:
          item.displayName ??
          getEquipmentTemplateById(state, item.templateId)?.name ??
          "Unknown item",
      }))
      .sort((left, right) => left.label.localeCompare(right.label));
  }, [activeMissileTemplate, characterId, state]);

  async function saveCombatEffect(draft: CombatEffectEditorDraft) {
    if (!physicalStateTargetParticipantId || !onCombatEffectsChange) {
      return;
    }

    await onCombatEffectsChange(
      applyCombatEffectDraft({
        combatEffects: physicalStateCombatEffects,
        draft,
        encounterId: physicalStateEncounterId,
        scenarioId: physicalStateScenarioId,
        targetParticipantId: physicalStateTargetParticipantId,
      }),
    );
  }

  async function deleteCombatEffect(effectId: string) {
    if (!onCombatEffectsChange) {
      return;
    }

    await onCombatEffectsChange(removeCombatEffect(physicalStateCombatEffects, effectId));
  }

  async function applySelection(input: {
    itemId: string | null;
    kind: "armor" | "primary" | "secondary" | "missile" | "shield";
  }) {
    if (!state) {
      return;
    }

    try {
      const currentLoadout = state.activeLoadoutByCharacterId[characterId];
      const nextSelection = {
        armor: currentLoadout?.wornArmorItemId ?? null,
        missile: currentLoadout?.activeMissileWeaponItemId ?? null,
        primary: currentLoadout?.activePrimaryWeaponItemId ?? null,
        secondary: currentLoadout?.activeSecondaryWeaponItemId ?? null,
        shield: currentLoadout?.readyShieldItemId ?? null,
      };

      nextSelection[input.kind] = input.itemId;

      if (input.kind === "shield" && input.itemId) {
        nextSelection.secondary = null;
      }

      if (input.kind === "secondary" && input.itemId) {
        nextSelection.shield = null;
      }

      const selectedWeaponTemplateId =
        input.kind === "primary" || input.kind === "secondary" || input.kind === "missile"
          ? (state.itemsById[input.itemId ?? ""]?.templateId ?? null)
          : null;

      if (
        (input.kind === "primary" || input.kind === "secondary") &&
        selectedWeaponTemplateId &&
        isBowOrTwoHandedTemplate(selectedWeaponTemplateId, state)
      ) {
        if (input.kind === "primary") {
          nextSelection.secondary = null;
        }
        if (input.kind === "secondary") {
          nextSelection.primary = null;
        }
        nextSelection.shield = null;
      }

      if (input.itemId && (input.kind === "shield" || input.kind === "secondary")) {
        const currentPrimaryTemplateId =
          state.itemsById[nextSelection.primary ?? ""]?.templateId ?? null;
        if (currentPrimaryTemplateId && isBowOrTwoHandedTemplate(currentPrimaryTemplateId, state)) {
          nextSelection.primary = null;
        }
      }

      const operations: Array<(expectedRevision: number) => Promise<EquipmentFeatureState>> = [];

      const queueOperation = (
        kind: "armor" | "primary" | "secondary" | "missile" | "shield",
        itemId: string | null,
      ) => {
        const currentValue = currentLoadout
          ? kind === "armor"
            ? (currentLoadout.wornArmorItemId ?? null)
            : kind === "shield"
              ? (currentLoadout.readyShieldItemId ?? null)
              : kind === "primary"
                ? (currentLoadout.activePrimaryWeaponItemId ?? null)
                : kind === "secondary"
                  ? (currentLoadout.activeSecondaryWeaponItemId ?? null)
                  : (currentLoadout.activeMissileWeaponItemId ?? null)
          : null;

        if (currentValue === itemId) {
          return;
        }

        operations.push((expectedRevision) =>
          kind === "armor"
            ? setCharacterWornArmorOnServer({ characterId, expectedRevision, itemId })
            : kind === "shield"
              ? setCharacterReadyShieldOnServer({ characterId, expectedRevision, itemId })
              : kind === "primary"
                ? setCharacterActivePrimaryWeaponOnServer({ characterId, expectedRevision, itemId })
                : kind === "secondary"
                  ? setCharacterActiveSecondaryWeaponOnServer({
                      characterId,
                      expectedRevision,
                      itemId,
                    })
                  : setCharacterActiveMissileWeaponOnServer({
                      characterId,
                      expectedRevision,
                      itemId,
                    }),
        );
      };

      queueOperation("secondary", nextSelection.secondary);
      queueOperation("shield", nextSelection.shield);
      queueOperation("primary", nextSelection.primary);
      queueOperation("armor", nextSelection.armor);
      queueOperation("missile", nextSelection.missile);

      let nextState = state;
      for (const operation of operations) {
        nextState = await operation(nextState.revision ?? -1);
      }

      setState(nextState);
      await onEquipmentStateChange?.(nextState);
      setErrors((current) => ({
        ...current,
        [input.kind]: undefined,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update loadout.";
      setErrors((current) => ({
        ...current,
        [input.kind]: message,
      }));
    }
  }

  async function toggleActiveAmmunition(itemId: string, selected: boolean) {
    if (!state) {
      return;
    }

    const currentItemIds = activeLoadout?.activeAmmoItemIds ?? [];
    const nextItemIds = selected
      ? [...new Set([...currentItemIds, itemId])]
      : currentItemIds.filter((currentItemId) => currentItemId !== itemId);

    try {
      const nextState = await setCharacterActiveAmmunitionOnServer({
        characterId,
        expectedRevision: state.revision ?? -1,
        itemIds: nextItemIds,
      });
      setState(nextState);
      await onEquipmentStateChange?.(nextState);
      setActiveAmmunitionError(undefined);
    } catch (error) {
      setActiveAmmunitionError(
        error instanceof Error ? error.message : "Unable to update active ammunition.",
      );
    }
  }

  const characterName = getCharacterName(characterContext?.record?.build.name);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: showPhysicalState ? 1240 : 900 }}>
      {!showPhysicalState ? (
        <div style={{ display: "grid", gap: "0.35rem" }}>
          <h1 style={{ margin: 0 }}>Equip items - {characterName}</h1>
        </div>
      ) : null}

      {loading ? (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem",
          }}
        >
          Loading loadout...
        </div>
      ) : null}

      {pageError ? (
        <div
          style={{
            background: "#fdf0ea",
            border: "1px solid #e4b9a7",
            borderRadius: 12,
            color: "#8b3a1a",
            padding: "1rem",
          }}
        >
          {pageError}
        </div>
      ) : null}

      {!loading && !pageError ? (
        <>
          <EquipmentLoadoutModule
            beforeEquipmentChoices={
              physicalStateModel ? (
                <PhysicalStateSection
                  canEditCombatEffects={canEditCombatEffects}
                  currentRoundNumber={physicalStateCurrentRoundNumber}
                  model={physicalStateModel}
                  onDeleteCombatEffect={deleteCombatEffect}
                  onSaveCombatEffect={saveCombatEffect}
                />
              ) : undefined
            }
            mode="editable"
            model={model}
            onFieldChange={(fieldId, itemId) => {
              if (fieldId === "throwing") {
                setThrowingWeaponItemId(itemId ?? "");
                return;
              }

              void applySelection({
                itemId,
                kind: fieldId,
              });
            }}
            stickyControls
          />
          <section
            aria-label="Active ammunition"
            style={{
              background: "#f6f5ef",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "0.6rem",
              padding: "1rem",
            }}
          >
            <h2 style={{ fontSize: "1rem", margin: 0 }}>Active ammunition</h2>
            {!activeMissileWeapon ? (
              <p style={{ margin: 0 }}>
                Choose an active missile weapon to select compatible ammunition.
              </p>
            ) : activeAmmunitionOptions.length === 0 ? (
              <p style={{ margin: 0 }}>No compatible ammunition is held by this Character.</p>
            ) : (
              activeAmmunitionOptions.map((option) => (
                <label
                  key={option.id}
                  style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}
                >
                  <input
                    checked={activeLoadout?.activeAmmoItemIds.includes(option.id) ?? false}
                    onChange={(event) =>
                      void toggleActiveAmmunition(option.id, event.target.checked)
                    }
                    type="checkbox"
                  />
                  {option.label}
                </label>
              ))
            )}
            {activeAmmunitionError ? (
              <p style={{ color: "#8b3a1a", margin: 0 }}>{activeAmmunitionError}</p>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  );
}
