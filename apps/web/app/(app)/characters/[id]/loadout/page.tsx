"use client";

import { use, useEffect, useMemo, useState } from "react";

import { getEquipmentTemplateById } from "../../../../../src/features/equipment/equipmentSelectors";
import {
  buildEquipmentLoadoutModuleModel,
  EquipmentLoadoutModule
} from "../../../../../src/features/equipment/loadoutModule";
import { isValidLoadoutThrowingWeaponItem } from "../../../../../src/features/equipment/loadoutWeaponOptions";
import type { EquipmentFeatureState } from "../../../../../src/features/equipment/types";
import {
  loadCharacterEquipmentState,
  setCharacterActiveMissileWeaponOnServer,
  setCharacterActivePrimaryWeaponOnServer,
  setCharacterActiveSecondaryWeaponOnServer,
  setCharacterReadyShieldOnServer,
  setCharacterWornArmorOnServer
} from "../../../../../src/lib/api/localServiceClient";
import { loadLocalCharacterContext } from "../../../../../src/lib/characters/loadLocalCharacterContext";

interface CharacterLoadoutPageProps {
  params: Promise<{
    id: string;
  }>;
}

function getCharacterName(name: string | undefined): string {
  return name?.trim() || "Unnamed character";
}

function isBowOrTwoHandedTemplate(templateId: string | null, state: EquipmentFeatureState): boolean {
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

export default function CharacterLoadoutPage({ params }: CharacterLoadoutPageProps) {
  const { id } = use(params);
  const [state, setState] = useState<EquipmentFeatureState | null>(null);
  const [characterContext, setCharacterContext] = useState<
    Awaited<ReturnType<typeof loadLocalCharacterContext>> | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string>();
  const [throwingWeaponItemId, setThrowingWeaponItemId] = useState<string>("");
  const [errors, setErrors] = useState<
    Record<"armor" | "missile" | "primary" | "secondary" | "shield", string | undefined>
  >({
    armor: undefined,
    missile: undefined,
    primary: undefined,
    secondary: undefined,
    shield: undefined
  });

  useEffect(() => {
    let cancelled = false;

    Promise.all([loadCharacterEquipmentState(id), loadLocalCharacterContext(id)])
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
            : message
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
  }, [id]);

  useEffect(() => {
    if (!throwingWeaponItemId || !state) {
      return;
    }

    const selectedThrowingWeaponItem = state.itemsById[throwingWeaponItemId];
    if (
      !isValidLoadoutThrowingWeaponItem({
        item: selectedThrowingWeaponItem,
        state
      })
    ) {
      setThrowingWeaponItemId("");
    }
  }, [state, throwingWeaponItemId]);

  const model = useMemo(
    () =>
      buildEquipmentLoadoutModuleModel({
        characterContext:
          characterContext?.record && characterContext.content
            ? {
                content: characterContext.content,
                record: characterContext.record
              }
            : null,
        characterId: id,
        errors,
        state,
        throwingWeaponItemId
      }),
    [characterContext, errors, id, state, throwingWeaponItemId]
  );

  async function applySelection(input: {
    itemId: string | null;
    kind: "armor" | "primary" | "secondary" | "missile" | "shield";
  }) {
    if (!state) {
      return;
    }

    try {
      const currentLoadout = state.activeLoadoutByCharacterId[id];
      const nextSelection = {
        armor: currentLoadout?.wornArmorItemId ?? null,
        missile: currentLoadout?.activeMissileWeaponItemId ?? null,
        primary: currentLoadout?.activePrimaryWeaponItemId ?? null,
        secondary: currentLoadout?.activeSecondaryWeaponItemId ?? null,
        shield: currentLoadout?.readyShieldItemId ?? null
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
          ? state.itemsById[input.itemId ?? ""]?.templateId ?? null
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
        const currentPrimaryTemplateId = state.itemsById[nextSelection.primary ?? ""]?.templateId ?? null;
        if (currentPrimaryTemplateId && isBowOrTwoHandedTemplate(currentPrimaryTemplateId, state)) {
          nextSelection.primary = null;
        }
      }

      const operations: Array<() => Promise<EquipmentFeatureState>> = [];

      const queueOperation = (
        kind: "armor" | "primary" | "secondary" | "missile" | "shield",
        itemId: string | null
      ) => {
        const currentValue = currentLoadout
          ? kind === "armor"
            ? currentLoadout.wornArmorItemId ?? null
            : kind === "shield"
              ? currentLoadout.readyShieldItemId ?? null
              : kind === "primary"
                ? currentLoadout.activePrimaryWeaponItemId ?? null
                : kind === "secondary"
                  ? currentLoadout.activeSecondaryWeaponItemId ?? null
                  : currentLoadout.activeMissileWeaponItemId ?? null
          : null;

        if (currentValue === itemId) {
          return;
        }

        operations.push(() =>
          kind === "armor"
            ? setCharacterWornArmorOnServer({ characterId: id, itemId })
            : kind === "shield"
              ? setCharacterReadyShieldOnServer({ characterId: id, itemId })
              : kind === "primary"
                ? setCharacterActivePrimaryWeaponOnServer({ characterId: id, itemId })
                : kind === "secondary"
                  ? setCharacterActiveSecondaryWeaponOnServer({ characterId: id, itemId })
                  : setCharacterActiveMissileWeaponOnServer({ characterId: id, itemId })
        );
      };

      queueOperation("secondary", nextSelection.secondary);
      queueOperation("shield", nextSelection.shield);
      queueOperation("primary", nextSelection.primary);
      queueOperation("armor", nextSelection.armor);
      queueOperation("missile", nextSelection.missile);

      let nextState = state;
      for (const operation of operations) {
        nextState = await operation();
      }

      setState(nextState);
      setErrors((current) => ({
        ...current,
        [input.kind]: undefined
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update loadout.";
      setErrors((current) => ({
        ...current,
        [input.kind]: message
      }));
    }
  }

  const characterName = getCharacterName(characterContext?.record?.build.name);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 900 }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <h1 style={{ margin: 0 }}>Equip items - {characterName}</h1>
      </div>

      {loading ? (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
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
            padding: "1rem"
          }}
        >
          {pageError}
        </div>
      ) : null}

      {!loading && !pageError ? (
        <EquipmentLoadoutModule
          mode="editable"
          model={model}
          onFieldChange={(fieldId, itemId) => {
            if (fieldId === "throwing") {
              setThrowingWeaponItemId(itemId ?? "");
              return;
            }

            void applySelection({
              itemId,
              kind: fieldId
            });
          }}
          stickyControls
        />
      ) : null}
    </section>
  );
}
