"use client";

import { useCallback, useEffect, useState } from "react";

export const REMEMBERED_SELECTION_KEYS = {
  campaignId: "campaign-id",
  characterId: "character-id",
  encounterId: "encounter-id",
  playerEncounterParticipantId: "player-encounter-participant-id",
  scenarioId: "scenario-id",
  workspaceTab: "workspace-tab",
} as const;

const STORAGE_PREFIX = "glantri.remembered-selection";

function buildStorageKey(key: string): string {
  return `${STORAGE_PREFIX}.${key}`;
}

export function readRememberedSelection(key: string): string | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }

  try {
    const value = window.localStorage.getItem(buildStorageKey(key));
    return value && value.trim().length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

export function writeRememberedSelection(key: string, value?: string | null): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const storageKey = buildStorageKey(key);

    if (!value || value.trim().length === 0) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, value);
  } catch {
    // Ignore storage availability errors in the browser fallback layer.
  }
}

export function buildRememberedScopedSelectionKey(input: {
  baseKey: string;
  scopeParts: Array<string | null | undefined>;
}): string {
  const scopedParts = input.scopeParts.filter(
    (part): part is string => typeof part === "string" && part.trim().length > 0,
  );

  return scopedParts.length > 0 ? `${input.baseKey}:${scopedParts.join(":")}` : input.baseKey;
}

export function useRememberedSelection(key: string): {
  hydrated: boolean;
  setValue: (nextValue?: string | null) => void;
  value?: string;
} {
  const [value, setValueState] = useState<string>();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setValueState(readRememberedSelection(key));
    setHydrated(true);
  }, [key]);

  const setValue = useCallback(
    (nextValue?: string | null) => {
      setValueState(nextValue ?? undefined);
      writeRememberedSelection(key, nextValue);
    },
    [key],
  );

  return {
    hydrated,
    setValue,
    value,
  };
}
