"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { loadServerCharacters } from "../../../../src/lib/api/localServiceClient";
import { useSessionUser } from "../../../../src/lib/auth/SessionUserContext";
import {
  REMEMBERED_SELECTION_KEYS,
  useRememberedSelection,
} from "../../../../src/lib/browser/rememberedSelection";
import { buildCharacterBrowserEntries } from "../../../../src/lib/characters/characterBrowser";
import { LocalCharacterRepository } from "../../../../src/lib/offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();

type ServerCharacterRecord = Awaited<ReturnType<typeof loadServerCharacters>>[number];

export default function CharactersResumePageContent() {
  const router = useRouter();
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const restoreAttemptedRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [localCharacters, setLocalCharacters] = useState<
    Awaited<ReturnType<typeof localCharacterRepository.listFinalized>>
  >([]);
  const [serverCharacters, setServerCharacters] = useState<ServerCharacterRecord[]>([]);
  const rememberedCharacterSelection = useRememberedSelection(
    REMEMBERED_SELECTION_KEYS.characterId,
  );

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    let cancelled = false;

    async function loadCharacters() {
      setLoading(true);

      try {
        const [localRecords, serverRecords] = await Promise.all([
          localCharacterRepository.listFinalized(),
          currentUser ? loadServerCharacters() : Promise.resolve([]),
        ]);

        if (cancelled) {
          return;
        }

        setLocalCharacters(localRecords);
        setServerCharacters(serverRecords);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCharacters();

    return () => {
      cancelled = true;
    };
  }, [currentUser, sessionLoading]);

  const browserEntries = useMemo(
    () =>
      buildCharacterBrowserEntries({
        currentUser,
        localRecords: localCharacters,
        serverRecords: serverCharacters,
      }),
    [currentUser, localCharacters, serverCharacters],
  );

  useEffect(() => {
    if (
      loading ||
      sessionLoading ||
      !rememberedCharacterSelection.hydrated ||
      restoreAttemptedRef.current
    ) {
      return;
    }

    restoreAttemptedRef.current = true;

    const rememberedCharacterId = rememberedCharacterSelection.value;
    const rememberedEntry = browserEntries.find((entry) => entry.id === rememberedCharacterId);

    if (rememberedEntry?.canOpenSheet) {
      router.replace(`/characters/${rememberedEntry.id}`);
      return;
    }

    if (rememberedCharacterId) {
      rememberedCharacterSelection.setValue(undefined);
    }

    router.replace("/characters");
  }, [browserEntries, loading, rememberedCharacterSelection, router, sessionLoading]);

  return <section>Opening characters...</section>;
}
