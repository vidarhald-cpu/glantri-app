"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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

type ServerCharacterRecord = Awaited<ReturnType<typeof loadMyServerCharacters>>[number];

export default function CharactersBrowser() {
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [localCharacters, setLocalCharacters] = useState<LocalCharacterRecord[]>([]);
  const [serverCharacters, setServerCharacters] = useState<ServerCharacterRecord[]>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);

  async function refreshCharacters() {
    const records = await localCharacterRepository.listFinalized();
    setLocalCharacters(records);
  }

  useEffect(() => {
    localCharacterRepository
      .listFinalized()
      .then((records) => setLocalCharacters(records))
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function handleLoadServerCharacters() {
    if (!currentUser) {
      setFeedback("Login required before loading server characters.");
      return;
    }

    try {
      const serverCharacters = await loadMyServerCharacters();
      setServerCharacters(serverCharacters);

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
          Finalized local characters are stored in the browser first. Server-backed characters can be
          loaded separately without hiding the local list.
        </p>
      </div>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button onClick={() => void handleLoadServerCharacters()} type="button">
          Load my server characters
        </button>
        {feedback ? <div>{feedback}</div> : null}
      </div>

      {loading || sessionLoading ? (
        <div>Loading character lists...</div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          <section style={{ display: "grid", gap: "0.75rem" }}>
            <div>
              <h2 style={{ margin: "0 0 0.25rem" }}>Finalized local characters</h2>
              <p style={{ margin: 0 }}>This matches the saved local characters list shown in Chargen.</p>
            </div>

            {localCharacters.length > 0 ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {localCharacters.map((record) => (
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

          <section style={{ display: "grid", gap: "0.75rem" }}>
            <div>
              <h2 style={{ margin: "0 0 0.25rem" }}>Server-backed characters</h2>
              <p style={{ margin: 0 }}>
                Use the button above to load your current server characters into the local browser.
              </p>
            </div>

            {serverCharacters === undefined ? (
              <div
                style={{
                  background: "#f6f5ef",
                  border: "1px solid #d9ddd8",
                  borderRadius: 12,
                  padding: "1rem"
                }}
              >
                Server characters have not been loaded in this view yet.
              </div>
            ) : serverCharacters.length > 0 ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {serverCharacters.map((record) => (
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
                    <strong>{record.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER}</strong>
                    <div>Profile: {record.build.profile.label}</div>
                    <div>Profession: {record.build.professionId ?? "Not set"}</div>
                    <div>Social class: {record.build.socialClass ?? "Not set"}</div>
                    <div>Created on server: {record.createdAt}</div>
                    <div>Updated on server: {record.updatedAt}</div>
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
                No server characters were returned for this account.
              </div>
            )}
          </section>
        </div>
      )}
    </section>
  );
}
