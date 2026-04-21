"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import {
  addScenarioParticipantFromCharacterOnServer,
  loadJoinableScenarios,
  loadServerCharacters
} from "../../../src/lib/api/localServiceClient";
import { useSessionUser } from "../../../src/lib/auth/SessionUserContext";
import {
  canBrowseAllCharacterOwners,
  buildCharacterBrowserOwnerOptions,
  buildCharacterBrowserEntries,
  filterCharacterBrowserEntries,
  type CharacterBrowserOwnerFilter,
  type CharacterBrowserSourceFilter,
  type CharacterBrowserTypeFilter
} from "../../../src/lib/characters/characterBrowser";
import { LocalCharacterRepository } from "../../../src/lib/offline/repositories/localCharacterRepository";

const localCharacterRepository = new LocalCharacterRepository();

type ServerCharacterRecord = Awaited<ReturnType<typeof loadServerCharacters>>[number];
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
  const [sourceFilter, setSourceFilter] = useState<CharacterBrowserSourceFilter>("all");
  const [typeFilter, setTypeFilter] = useState<CharacterBrowserTypeFilter>("all");
  const [joiningCharacterId, setJoiningCharacterId] = useState<string>();
  const [joiningScenarioId, setJoiningScenarioId] = useState<string>();
  const [joinableScenarios, setJoinableScenarios] = useState<JoinableScenarioOption[]>();
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState<string>();

  useEffect(() => {
    if (sessionLoading) {
      return;
    }

    let cancelled = false;

    async function hydrateCharacters() {
      setLoading(true);

      try {
        const [records, serverRecords] = await Promise.all([
          localCharacterRepository.listFinalized(),
          currentUser ? loadServerCharacters() : Promise.resolve([])
        ]);

        if (cancelled) {
          return;
        }

        setLocalCharacters(records);
        setServerCharacters(serverRecords);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setFeedback(error instanceof Error ? error.message : "Unable to load character browser.");
        setServerCharacters([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void hydrateCharacters();

    return () => {
      cancelled = true;
    };
  }, [currentUser, sessionLoading]);

  const browserEntries = useMemo(
    () =>
      buildCharacterBrowserEntries({
        currentUser,
        localRecords: localCharacters,
        serverRecords: serverCharacters ?? []
      }),
    [currentUser, localCharacters, serverCharacters]
  );
  const visibleEntries = useMemo(
    () =>
      filterCharacterBrowserEntries(browserEntries, {
        ownerFilter,
        sourceFilter,
        typeFilter
      }),
    [browserEntries, ownerFilter, sourceFilter, typeFilter]
  );
  const ownerFilterOptions = useMemo(
    () => buildCharacterBrowserOwnerOptions(browserEntries),
    [browserEntries]
  );
  const showOwnerFilter = canBrowseAllCharacterOwners(currentUser) && ownerFilterOptions.length > 1;

  useEffect(() => {
    if (!showOwnerFilter && ownerFilter !== "all") {
      setOwnerFilter("all");
    }
  }, [ownerFilter, showOwnerFilter]);

  async function handleRefreshServerCharacters() {
    if (!currentUser) {
      setFeedback("Login required before loading server-backed characters.");
      return;
    }

    try {
      const nextServerCharacters = await loadServerCharacters();
      setServerCharacters(nextServerCharacters);
      setFeedback(
        `Loaded ${nextServerCharacters.length} server-backed character${
          nextServerCharacters.length === 1 ? "" : "s"
        } into the browser.`
      );
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Unable to load server-backed characters."
      );
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

    if (!selectedEntry.canJoinScenario) {
      setFeedback(
        selectedEntry.canOpenSheet
          ? "Join scenario currently requires a server-backed character record."
          : "Join scenario is only available for characters this account can open."
      );
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
                Sorted by most recently saved first. Cards only open the character sheet when this
                account can actually access that character.
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

              {showOwnerFilter ? (
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
              ) : null}

              <label style={{ display: "grid", gap: "0.25rem" }}>
                <span>Source</span>
                <select
                  onChange={(event) =>
                    setSourceFilter(event.target.value as CharacterBrowserSourceFilter)
                  }
                  value={sourceFilter}
                >
                  <option value="all">All</option>
                  <option value="server">Server-backed</option>
                  <option value="local">Local-only</option>
                </select>
              </label>
            </div>

            {visibleEntries.length > 0 ? (
              <div style={{ display: "grid", gap: "0.75rem" }}>
                {visibleEntries.map((entry) => (
                  <div
                    key={entry.id}
                    aria-disabled={!entry.canOpenSheet}
                    aria-label={
                      entry.canOpenSheet
                        ? `Open ${entry.name}`
                        : `${entry.name} is not openable in this account`
                    }
                    onClick={
                      entry.canOpenSheet ? () => handleOpenCharacter(entry.id) : undefined
                    }
                    onKeyDown={
                      entry.canOpenSheet
                        ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              handleOpenCharacter(entry.id);
                            }
                          }
                        : undefined
                    }
                    role={entry.canOpenSheet ? "link" : undefined}
                    style={{
                      background: entry.canOpenSheet ? "#ffffff" : "#f8f7f2",
                      border: `1px solid ${entry.canOpenSheet ? "#d9ddd8" : "#d7d1c5"}`,
                      borderRadius: 12,
                      cursor: entry.canOpenSheet ? "pointer" : "default",
                      display: "grid",
                      gap: "0.6rem",
                      padding: "1rem"
                    }}
                    tabIndex={entry.canOpenSheet ? 0 : -1}
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
                        <span
                          style={{
                            background: entry.canOpenSheet ? "#edf2fb" : "#f4e8e3",
                            borderRadius: 999,
                            fontSize: "0.85rem",
                            padding: "0.15rem 0.5rem"
                          }}
                        >
                          {entry.accessLabel}
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
                          disabled={!entry.canJoinScenario}
                          type="button"
                        >
                          Join scenario
                        </button>
                      </div>

                      {!entry.canOpenSheet ? (
                        <div style={{ color: "#6a5c48" }}>
                          This character is visible in the local browser but cannot be opened by the
                          current account.
                        </div>
                      ) : null}

                      {entry.canOpenSheet && !entry.canJoinScenario ? (
                        <div style={{ color: "#6a5c48" }}>
                          Join scenario becomes available once this character has a server-backed
                          record.
                        </div>
                      ) : null}

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
                Refresh the global server-backed character list shown above without changing local
                characters or filters.
              </p>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
              <button onClick={() => void handleRefreshServerCharacters()} type="button">
                Refresh server-backed characters
              </button>
              <div>
                {serverCharacters === undefined
                  ? "Server-backed characters have not been loaded in this view yet."
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
                No server-backed characters were returned.
              </div>
            ) : null}
          </section>
        </div>
      )}
    </section>
  );
}
