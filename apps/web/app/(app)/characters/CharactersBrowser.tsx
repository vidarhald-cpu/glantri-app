"use client";

import { hasAnyRole } from "@glantri/auth";
import type { Scenario } from "@glantri/domain";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  addScenarioParticipantFromCharacterOnServer,
  loadJoinableScenarios,
  loadMyServerCharacters
} from "../../../src/lib/api/localServiceClient";
import { useSessionUser } from "../../../src/lib/auth/SessionUserContext";
import {
  buildCharacterBrowserEntries,
  filterCharacterBrowserEntries,
  type CharacterBrowserOwnerFilter,
  type CharacterBrowserTypeFilter
} from "../../../src/lib/characters/characterBrowser";
import { LocalCharacterRepository } from "../../../src/lib/offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();

type ServerCharacterRecord = Awaited<ReturnType<typeof loadMyServerCharacters>>[number];
type JoinableScenarioOption = Awaited<ReturnType<typeof loadJoinableScenarios>>[number];

export default function CharactersBrowser() {
  const router = useRouter();
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [localCharacters, setLocalCharacters] = useState<
    Awaited<ReturnType<typeof localCharacterRepository.listFinalized>>
  >([]);
  const [serverCharacters, setServerCharacters] = useState<ServerCharacterRecord[]>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState<CharacterBrowserOwnerFilter>("all");
  const [typeFilter, setTypeFilter] = useState<CharacterBrowserTypeFilter>("all");
  const [joiningCharacterId, setJoiningCharacterId] = useState<string>();
  const [joiningScenarioId, setJoiningScenarioId] = useState<string>();
  const [joinableScenarios, setJoinableScenarios] = useState<JoinableScenarioOption[]>();
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string>();

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

  const browserEntries = useMemo(
    () => buildCharacterBrowserEntries(localCharacters, currentUser),
    [currentUser, localCharacters]
  );
  const visibleEntries = useMemo(
    () =>
      filterCharacterBrowserEntries(browserEntries, {
        currentUser,
        ownerFilter,
        typeFilter
      }),
    [browserEntries, currentUser, ownerFilter, typeFilter]
  );
  const canUseGameMasterOwnerFilter = currentUser
    ? hasAnyRole(currentUser.roles, ["game_master", "admin"])
    : false;
  const ownerFilterOptions = useMemo(() => {
    const options: Array<{ label: string; value: CharacterBrowserOwnerFilter }> = [
      { label: "All owners", value: "all" }
    ];

    if (browserEntries.some((entry) => entry.ownerCategory === "gm")) {
      options.push({ label: "GM-owned characters", value: "gm" });
    }

    if (browserEntries.some((entry) => entry.ownerCategory === "player")) {
      options.push({ label: "Player-owned characters", value: "player" });
    }

    if (
      canUseGameMasterOwnerFilter &&
      currentUser &&
      browserEntries.some((entry) => entry.record.creatorId === currentUser.id)
    ) {
      options.push({ label: "My characters", value: "mine" });
    }

    return options;
  }, [browserEntries, canUseGameMasterOwnerFilter, currentUser]);

  async function handleLoadServerCharacters() {
    if (!currentUser) {
      setFeedback("Login required before loading server characters.");
      return;
    }

    try {
      const nextServerCharacters = await loadMyServerCharacters();
      setServerCharacters(nextServerCharacters);

      for (const character of nextServerCharacters) {
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
      setFeedback(
        `Loaded ${nextServerCharacters.length} server character${
          nextServerCharacters.length === 1 ? "" : "s"
        } into the local browser.`
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to load server characters.");
    }
  }

  async function ensureJoinableScenarios(): Promise<JoinableScenarioOption[]> {
    if (joinableScenarios) {
      return joinableScenarios;
    }

    const options = (await loadJoinableScenarios()).sort((left, right) =>
      left.campaignName.localeCompare(right.campaignName)
    );

    setJoinableScenarios(options);
    return options;
  }

  async function handleToggleJoinChooser(characterId: string) {
    const selectedEntry = browserEntries.find((entry) => entry.id === characterId);

    if (!selectedEntry) {
      return;
    }

    if (joiningCharacterId === characterId) {
      setJoiningCharacterId(undefined);
      setJoiningScenarioId(undefined);
      setJoinError(undefined);
      return;
    }

    if (selectedEntry.record.syncStatus !== "synced") {
      setFeedback("Join scenario currently requires a server-backed character record.");
      setJoinError(undefined);
      return;
    }

    setJoiningCharacterId(characterId);
    setJoiningScenarioId(undefined);
    setFeedback(undefined);
    setJoinError(undefined);
    setJoinLoading(true);

    try {
      const options = await ensureJoinableScenarios();
      setJoiningScenarioId(options[0]?.scenarioId);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Unable to load scenarios.");
    } finally {
      setJoinLoading(false);
    }
  }

  async function handleJoinScenario(characterId: string) {
    if (!joiningScenarioId) {
      setJoinError("Choose a scenario first.");
      return;
    }

    const selectedScenario = joinableScenarios?.find(
      (scenario) => scenario.scenarioId === joiningScenarioId
    );

    if (!selectedScenario) {
      setJoinError("Selected scenario could not be found.");
      return;
    }

    try {
      setJoinError(undefined);
      setFeedback(undefined);
      await addScenarioParticipantFromCharacterOnServer({
        characterId,
        controlledByUserId: currentUser?.id,
        joinSource: "player_joined",
        role: "player_character",
        scenarioId: selectedScenario.scenarioId
      });
      setFeedback(`Joined ${selectedScenario.scenarioName}.`);
      setJoiningCharacterId(undefined);
      setJoiningScenarioId(undefined);
      router.push(`/campaigns/${selectedScenario.campaignId}/scenarios/${selectedScenario.scenarioId}`);
    } catch (error) {
      setJoinError(error instanceof Error ? error.message : "Unable to join scenario.");
    }
  }

  function handleOpenCharacter(characterId: string) {
    router.push(`/characters/${characterId}`);
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 920 }}>
      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Characters</h1>
        <p style={{ margin: 0 }}>
          Browse finalized local characters, filter the list, and jump straight into a scenario when
          a character is ready.
        </p>
      </div>

      {loading || sessionLoading ? (
        <div>Loading character lists...</div>
      ) : (
        <div style={{ display: "grid", gap: "1rem" }}>
          <section
            style={{
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "0.75rem",
              padding: "1rem"
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 0.25rem" }}>Browser</h2>
              <p style={{ margin: 0 }}>
                Sorted by most recently saved first, using the local record&apos;s latest update time.
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Type</span>
                <select
                  onChange={(event) => setTypeFilter(event.target.value as CharacterBrowserTypeFilter)}
                  value={typeFilter}
                >
                  <option value="all">All</option>
                  <option value="pc">PCs</option>
                  <option value="npc">NPCs</option>
                </select>
              </label>

              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Owner</span>
                <select
                  onChange={(event) =>
                    setOwnerFilter(event.target.value as CharacterBrowserOwnerFilter)
                  }
                  value={ownerFilter}
                >
                  {ownerFilterOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {visibleEntries.length > 0 ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {visibleEntries.map((entry) => (
                  <div
                    key={entry.id}
                    aria-label={`Open ${entry.name}`}
                    onClick={() => handleOpenCharacter(entry.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        handleOpenCharacter(entry.id);
                      }
                    }}
                    role="link"
                    style={{
                      border: "1px solid #d9ddd8",
                      borderRadius: 12,
                      cursor: "pointer",
                      display: "grid",
                      gap: "0.6rem",
                      padding: "1rem"
                    }}
                    tabIndex={0}
                  >
                    <div
                      style={{
                        alignItems: "center",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "0.5rem",
                        justifyContent: "space-between"
                      }}
                    >
                      <strong>{entry.name}</strong>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                        <span
                          style={{
                            background: "#f0ede2",
                            borderRadius: 999,
                            fontSize: "0.85rem",
                            padding: "0.15rem 0.5rem"
                          }}
                        >
                          {entry.type.toUpperCase()}
                        </span>
                        <span
                          style={{
                            background: "#eef5ef",
                            borderRadius: 999,
                            fontSize: "0.85rem",
                            padding: "0.15rem 0.5rem"
                          }}
                        >
                          {entry.sourceLabel}
                        </span>
                      </div>
                    </div>

                    <div style={{ color: "#4f4a40", display: "grid", gap: "0.2rem" }}>
                      <div>Profession: {entry.professionLabel}</div>
                      <div>Social class: {entry.socialClassLabel}</div>
                      <div>Owner: {entry.ownerLabel}</div>
                      <div>Last saved: {entry.lastSavedAt}</div>
                    </div>

                    <div
                      onClick={(event) => event.stopPropagation()}
                      onKeyDown={(event) => event.stopPropagation()}
                      style={{ display: "grid", gap: "0.5rem" }}
                    >
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                        <button
                          onClick={() => {
                            void handleToggleJoinChooser(entry.id);
                          }}
                          type="button"
                        >
                          Join scenario
                        </button>
                      </div>

                      {joiningCharacterId === entry.id ? (
                        <div
                          style={{
                            background: "#f6f5ef",
                            border: "1px solid #d9ddd8",
                            borderRadius: 10,
                            display: "grid",
                            gap: "0.5rem",
                            padding: "0.75rem"
                          }}
                        >
                          <strong>Join scenario</strong>
                          {joinLoading ? (
                            <div>Loading available scenarios...</div>
                          ) : joinableScenarios && joinableScenarios.length > 0 ? (
                            <>
                              <select
                                onChange={(event) => setJoiningScenarioId(event.target.value)}
                                value={joiningScenarioId}
                              >
                                {joinableScenarios.map((scenario) => (
                                  <option key={scenario.scenarioId} value={scenario.scenarioId}>
                                    {scenario.campaignName} - {scenario.scenarioName} ({scenario.kind},{" "}
                                    {scenario.status})
                                  </option>
                                ))}
                              </select>
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                                <button
                                  onClick={() => {
                                    void handleJoinScenario(entry.id);
                                  }}
                                  disabled={!joiningScenarioId}
                                  type="button"
                                >
                                  Confirm join
                                </button>
                                <button
                                  onClick={() => {
                                    setJoiningCharacterId(undefined);
                                    setJoiningScenarioId(undefined);
                                    setJoinError(undefined);
                                  }}
                                  type="button"
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <div>No active scenarios are currently available from the campaign list.</div>
                          )}

                          {joinError ? <div>{joinError}</div> : null}
                        </div>
                      ) : null}
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
                No characters match the current browser filters.
              </div>
            )}
          </section>

          <section
            style={{
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              display: "grid",
              gap: "0.75rem",
              padding: "1rem"
            }}
          >
            <div>
              <h2 style={{ margin: "0 0 0.25rem" }}>Server import</h2>
              <p style={{ margin: 0 }}>
                Load server-backed characters into the local browser without replacing the finalized
                local list.
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <button onClick={() => void handleLoadServerCharacters()} type="button">
                Load my server characters
              </button>
              <div>
                {serverCharacters === undefined
                  ? "Server characters have not been loaded in this view yet."
                  : `Last server load returned ${serverCharacters.length} character${
                      serverCharacters.length === 1 ? "" : "s"
                    }.`}
              </div>
            </div>

            {feedback ? <div>{feedback}</div> : null}
            {serverCharacters !== undefined && serverCharacters.length === 0 ? (
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
            ) : null}
          </section>
        </div>
      )}
    </section>
  );
}
