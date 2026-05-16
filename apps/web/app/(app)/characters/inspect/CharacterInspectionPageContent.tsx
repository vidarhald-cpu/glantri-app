"use client";

import { useEffect, useMemo, useState } from "react";

import { loadServerCharacters, type ServerCharacterRecord } from "@/lib/api/localServiceClient";
import { useHasAnyRole } from "@/lib/auth/SessionUserContext";

import CharacterLoadoutView from "../[id]/components/CharacterLoadoutView";

function getCharacterLabel(character: ServerCharacterRecord): string {
  return character.build.name?.trim() || character.name || "Unnamed character";
}

export default function CharacterInspectionPageContent() {
  const isGameMaster = useHasAnyRole(["admin", "game_master"]);
  const [characters, setCharacters] = useState<ServerCharacterRecord[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!isGameMaster) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);
    loadServerCharacters()
      .then((nextCharacters) => {
        if (cancelled) {
          return;
        }

        const sortedCharacters = [...nextCharacters].sort((left, right) =>
          getCharacterLabel(left).localeCompare(getCharacterLabel(right))
        );
        setCharacters(sortedCharacters);
        setSelectedCharacterId((current) => current || sortedCharacters[0]?.id || "");
        setError(undefined);
      })
      .catch((caughtError) => {
        if (cancelled) {
          return;
        }

        setError(caughtError instanceof Error ? caughtError.message : "Unable to load characters.");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isGameMaster]);

  const selectedIndex = useMemo(
    () => characters.findIndex((character) => character.id === selectedCharacterId),
    [characters, selectedCharacterId]
  );
  const selectedCharacter = selectedIndex >= 0 ? characters[selectedIndex] : undefined;

  function selectRelativeCharacter(offset: number) {
    if (characters.length === 0) {
      return;
    }

    const currentIndex = selectedIndex >= 0 ? selectedIndex : 0;
    const nextIndex = (currentIndex + offset + characters.length) % characters.length;
    setSelectedCharacterId(characters[nextIndex]?.id ?? "");
  }

  if (!isGameMaster) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 900 }}>
        <h1 style={{ margin: 0 }}>Character</h1>
        <div>Character inspection is available to GMs.</div>
      </section>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem" }}>
      <header
        style={{
          alignItems: "end",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          justifyContent: "space-between",
          maxWidth: 900
        }}
      >
        <h1 style={{ margin: 0 }}>Character</h1>
        <div style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}>
          <button
            disabled={characters.length <= 1}
            onClick={() => selectRelativeCharacter(-1)}
            type="button"
          >
            Previous
          </button>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            <span>Select character to inspect</span>
            <select
              disabled={characters.length === 0}
              onChange={(event) => setSelectedCharacterId(event.target.value)}
              value={selectedCharacterId}
            >
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {getCharacterLabel(character)}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={characters.length <= 1}
            onClick={() => selectRelativeCharacter(1)}
            type="button"
          >
            Next
          </button>
        </div>
      </header>

      {loading ? <div>Loading characters...</div> : null}
      {error ? <div>{error}</div> : null}
      {!loading && !error && characters.length === 0 ? <div>No characters available.</div> : null}
      {selectedCharacter ? <CharacterLoadoutView characterId={selectedCharacter.id} /> : null}
    </section>
  );
}
