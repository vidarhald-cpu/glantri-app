"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { LocalCharacterRecord } from "../../../src/lib/offline/glantriDexie";
import { loadMyServerCharacters } from "../../../src/lib/api/localServiceClient";
import { useSessionUser } from "../../../src/lib/auth/SessionUserContext";
import {
  LocalCharacterRepository,
  UNNAMED_CHARACTER_PLACEHOLDER
} from "../../../src/lib/offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();

function getCharacterName(record: LocalCharacterRecord): string {
  return record.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER;
}

export default function CharactersBrowser() {
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [characters, setCharacters] = useState<LocalCharacterRecord[]>([]);
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);

  async function refreshCharacters() {
    const records = await localCharacterRepository.list();
    setCharacters(records);
  }

  useEffect(() => {
    localCharacterRepository
      .list()
      .then((records) => setCharacters(records))
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const visibleCharacters = useMemo(
    () =>
      currentUser
        ? characters.filter((record) => record.creatorId === currentUser.id)
        : [],
    [characters, currentUser],
  );

  async function handleLoadServerCharacters() {
    if (!currentUser) {
      setFeedback("Login required before loading server characters.");
      return;
    }

    try {
      const serverCharacters = await loadMyServerCharacters();

      for (const character of serverCharacters) {
        await localCharacterRepository.save({
          build: character.build,
          createdAt: character.createdAt,
          creatorDisplayName: currentUser.displayName,
          creatorEmail: currentUser.email,
          creatorId: currentUser.id,
          finalizedAt: character.createdAt,
          syncStatus: "synced",
          updatedAt: character.updatedAt
        });
      }

      await refreshCharacters();
      setFeedback(`Loaded ${serverCharacters.length} server character${serverCharacters.length === 1 ? "" : "s"} into the local browser.`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to load server characters.");
    }
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 840 }}>
      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Characters</h1>
        <p style={{ margin: 0 }}>
          Finalized characters are stored locally first and can be reopened later for character sheet review
          or future progression work.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button onClick={() => void handleLoadServerCharacters()} type="button">
          Load my server characters
        </button>
        {feedback ? <div>{feedback}</div> : null}
      </div>

      {loading || sessionLoading ? (
        <div>Loading local characters...</div>
      ) : visibleCharacters.length > 0 ? (
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {visibleCharacters.map((record) => (
            <div
              key={record.id}
              style={{
                border: "1px solid #d9ddd8",
                borderRadius: 12,
                display: "grid",
                gap: "0.35rem",
                padding: "1rem"
              }}
            >
              <strong>{getCharacterName(record)}</strong>
              <div>Profile: {record.build.profile.label}</div>
              <div>Profession: {record.build.professionId ?? "Not set"}</div>
              <div>Social class: {record.build.socialClass ?? "Not set"}</div>
              <div>Finalized: {record.finalizedAt}</div>
              <div>Storage status: {record.syncStatus}</div>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <Link href={`/characters/${record.id}`}>Character sheet</Link>
                <Link href={`/characters/${record.id}/equipment`}>Inventory by location</Link>
                <Link href={`/characters/${record.id}/weapons-shields-armor`}>
                  Weapons/Shields/Armor
                </Link>
                <Link href={`/characters/${record.id}/loadout`}>Equip items</Link>
                <Link href={`/characters/${record.id}/advance`}>Advance Character</Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          No finalized local characters yet.
        </div>
      )}
    </section>
  );
}
