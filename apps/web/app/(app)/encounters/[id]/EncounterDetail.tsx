"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { EncounterSession } from "@glantri/domain";
import {
  advanceEncounterRound,
  addAdHocParticipant,
  addCharacterParticipant,
  appendEncounterAttackResolution,
  buildEncounterSessionView,
  clearEncounterDeclarations,
  clearEncounterParticipantDeclaration,
  moveEncounterParticipant,
  removeEncounterParticipant,
  resolveEncounterAttack,
  resolveEncounterCritical,
  resolveEncounterDamage,
  setEncounterCurrentTurnIndex,
  setEncounterDeclarationsLocked,
  updateEncounterAttackResolution,
  updateEncounterParticipantDeclaration,
  updateEncounterParticipantTurnData
} from "@glantri/rules-engine";

import { loadLocalEncounterContext } from "../../../../src/lib/encounters/loadLocalEncounterContext";
import { addScenarioParticipantFromEntityOnServer } from "../../../../src/lib/api/localServiceClient";
import RememberedCampaignWorkspaceEffect from "../../../../src/lib/campaigns/RememberedCampaignWorkspaceEffect";
import { buildCampaignWorkspaceHref } from "../../../../src/lib/campaigns/workspace";
import type { LocalCharacterRecord } from "../../../../src/lib/offline/glantriDexie";
import { LocalEncounterRepository } from "../../../../src/lib/offline/repositories/localEncounterRepository";
import { UNNAMED_CHARACTER_PLACEHOLDER } from "../../../../src/lib/offline/repositories/localCharacterRepository";

interface EncounterDetailProps {
  campaignId?: string;
  embedded?: boolean;
  id: string;
  scenarioId?: string;
}

const localEncounterRepository = new LocalEncounterRepository();
const ACTION_OPTIONS = [
  { label: "No declaration", value: "none" },
  { label: "Attack", value: "attack" },
  { label: "Move", value: "move" },
  { label: "Defend", value: "defend" },
  { label: "Ready", value: "ready" },
  { label: "Other", value: "other" }
] as const;
const DEFENSE_POSTURE_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Guard", value: "guard" },
  { label: "Parry", value: "parry" },
  { label: "Shield defense", value: "shield" },
  { label: "Full defense", value: "full-defense" }
] as const;
const TARGET_LOCATION_OPTIONS = [
  { label: "Any", value: "any" },
  { label: "Head", value: "head" },
  { label: "Torso", value: "torso" },
  { label: "Arm", value: "arm" },
  { label: "Leg", value: "leg" }
] as const;
const DEFENSE_FOCUS_OPTIONS = [
  { label: "None", value: "none" },
  { label: "Self", value: "self" },
  { label: "Weapon side", value: "weapon-side" },
  { label: "Shield side", value: "shield-side" }
] as const;

function getCharacterName(record: LocalCharacterRecord): string {
  return record.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER;
}

function rollPercentile(): number {
  return Math.floor(Math.random() * 100) + 1;
}

export default function EncounterDetail({
  campaignId,
  embedded = false,
  id,
  scenarioId
}: EncounterDetailProps) {
  const [adHocName, setAdHocName] = useState("");
  const [characters, setCharacters] = useState<LocalCharacterRecord[]>([]);
  const [content, setContent] = useState<
    Awaited<ReturnType<typeof loadLocalEncounterContext>>["content"] | undefined
  >();
  const [encounter, setEncounter] = useState<EncounterSession>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [selectedCharacterId, setSelectedCharacterId] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadLocalEncounterContext(id)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setCharacters(result.characters);
        setContent(result.content);
        setEncounter(result.encounter);
        setSelectedCharacterId(result.characters[0]?.id ?? "");
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

  const characterBuildsById = useMemo(
    () => Object.fromEntries(characters.map((character) => [character.id, character.build])),
    [characters]
  );

  const encounterView = useMemo(() => {
    if (!encounter || !content) {
      return undefined;
    }

    return buildEncounterSessionView({
      characterBuildsById,
      content,
      session: encounter
    });
  }, [characters, content, encounter]);

  const isNestedScenarioFlow = Boolean(campaignId && scenarioId);
  const backHref = isNestedScenarioFlow
    ? buildCampaignWorkspaceHref({
        campaignId: campaignId as string,
        scenarioId: scenarioId as string,
        tab: "scenario",
      })
    : "/encounters";
  const playerCombatHref = isNestedScenarioFlow
    ? buildCampaignWorkspaceHref({
        campaignId: campaignId as string,
        encounterId: id,
        scenarioId: scenarioId as string,
        tab: "player-encounter",
      })
    : undefined;

  async function persistEncounter(nextEncounter: EncounterSession, message?: string) {
    const savedEncounter = await localEncounterRepository.save(nextEncounter);
    setEncounter(savedEncounter);

    if (message) {
      setFeedback(message);
    }

    return savedEncounter;
  }

  async function handleAddCharacterParticipant() {
    if (!encounter || !selectedCharacterId) {
      return;
    }

    const character = characters.find((item) => item.id === selectedCharacterId);

    if (!character) {
      setFeedback("Selected character could not be found.");
      return;
    }

    await persistEncounter(
      addCharacterParticipant({
        characterId: character.id,
        label: getCharacterName(character),
        session: encounter
      }),
      `Added ${getCharacterName(character)} to the encounter.`
    );
  }

  async function handleAddAdHocParticipant() {
    if (!encounter || !adHocName.trim()) {
      return;
    }

    const trimmedName = adHocName.trim();

    if (isNestedScenarioFlow && scenarioId) {
      await addScenarioParticipantFromEntityOnServer({
        entityInput: {
          kind: "npc",
          name: trimmedName
        },
        isTemporary: true,
        joinSource: "gm_added",
        role: "npc",
        scenarioId
      });
    }

    await persistEncounter(
      addAdHocParticipant({
        label: trimmedName,
        session: encounter
      }),
      isNestedScenarioFlow
        ? `Added ${trimmedName} to the encounter and scenario participants.`
        : `Added ${trimmedName} to the encounter.`
    );
    setAdHocName("");
  }

  async function handleResolveAttack(participantId: string) {
    if (!encounter || !content) {
      return;
    }

    const participant = encounter.participants.find((entry) => entry.id === participantId);
    const attackerBuild = participant?.characterId ? characterBuildsById[participant.characterId] : undefined;
    const defender = participant?.declaration.targetParticipantId
      ? encounter.participants.find((entry) => entry.id === participant.declaration.targetParticipantId)
      : undefined;
    const parryRoll =
      defender?.declaration.defensePosture === "parry" ? rollPercentile() : undefined;
    const resolutionResult = resolveEncounterAttack({
      attackerBuild,
      attackerParticipantId: participantId,
      attackRoll: rollPercentile(),
      characterBuildsById,
      content,
      parryRoll,
      session: encounter
    });

    if (!resolutionResult.resolution) {
      setFeedback(resolutionResult.errors.join(" ") || "Attack resolution failed.");
      return;
    }

    const nextEncounter = appendEncounterAttackResolution({
      resolution: resolutionResult.resolution,
      session: encounter
    });

    await persistEncounter(
      nextEncounter,
      `Resolved attack: ${resolutionResult.resolution.outcome}.`
    );
  }

  async function handleResolveDamage(resolutionId: string) {
    if (!encounter) {
      return;
    }

    const existingResolution = encounter.actionLog.find((entry) => entry.id === resolutionId);

    if (!existingResolution) {
      setFeedback("Resolved attack record could not be found.");
      return;
    }

    const attacker = encounter.participants.find(
      (participant) => participant.id === existingResolution.attackerParticipantId
    );
    const defender = encounter.participants.find(
      (participant) => participant.id === existingResolution.defenderParticipantId
    );
    const attackerBuild = attacker?.characterId ? characterBuildsById[attacker.characterId] : undefined;
    const defenderBuild = defender?.characterId ? characterBuildsById[defender.characterId] : undefined;
    const damageResult = resolveEncounterDamage({
      attackerBuild,
      defenderBuild,
      hitLocationRoll: rollPercentile(),
      resolution: existingResolution
    });

    if (!damageResult.resolution) {
      setFeedback(damageResult.errors.join(" ") || "Damage resolution failed.");
      return;
    }

    const nextEncounter: EncounterSession = {
      ...encounter,
      actionLog: updateEncounterAttackResolution({
        resolution: damageResult.resolution,
        sessionActionLog: encounter.actionLog
      }),
      updatedAt: new Date().toISOString()
    };

    await persistEncounter(
      nextEncounter,
      `Resolved damage: ${damageResult.resolution.damage?.finalDamage ?? 0} damage.`
    );
  }

  async function handleResolveCritical(resolutionId: string) {
    if (!encounter) {
      return;
    }

    const existingResolution = encounter.actionLog.find((entry) => entry.id === resolutionId);

    if (!existingResolution) {
      setFeedback("Critical record could not be found.");
      return;
    }

    const criticalResult = resolveEncounterCritical({
      criticalRoll: rollPercentile(),
      resolution: existingResolution
    });

    if (!criticalResult.resolution) {
      setFeedback(criticalResult.errors.join(" ") || "Critical resolution failed.");
      return;
    }

    const nextEncounter: EncounterSession = {
      ...encounter,
      actionLog: updateEncounterAttackResolution({
        resolution: criticalResult.resolution,
        sessionActionLog: encounter.actionLog
      }),
      updatedAt: new Date().toISOString()
    };

    await persistEncounter(
      nextEncounter,
      `Resolved critical: ${criticalResult.resolution.critical?.effect?.summary ?? "critical resolved"}.`
    );
  }

  if (loading) {
    return <section>Loading encounter...</section>;
  }

  if (!encounter || !content || !encounterView) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Encounter not found</h1>
        <Link href={backHref}>
          {isNestedScenarioFlow ? "Back to scenario encounters" : "Back to encounters"}
        </Link>
      </section>
    );
  }

  if (
    (campaignId && encounter.campaignId && encounter.campaignId !== campaignId) ||
    (scenarioId && encounter.scenarioId && encounter.scenarioId !== scenarioId)
  ) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Encounter not found</h1>
        <div>This encounter does not belong to the current campaign/scenario flow.</div>
        <Link href={backHref}>
          {isNestedScenarioFlow ? "Back to scenario encounters" : "Back to encounters"}
        </Link>
      </section>
    );
  }

  const currentParticipant = encounterView.participants[encounterView.currentTurnIndex];

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1040 }}>
      {isNestedScenarioFlow ? (
        <RememberedCampaignWorkspaceEffect
          campaignId={campaignId as string}
          encounterId={id}
          scenarioId={scenarioId as string}
          tab="gm-encounter"
        />
      ) : null}
      {!embedded ? (
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <Link href={backHref}>
            {isNestedScenarioFlow ? "Back to scenario workspace" : "Back to encounters"}
          </Link>
          {isNestedScenarioFlow ? (
            <Link
              href={buildCampaignWorkspaceHref({
                campaignId: campaignId as string,
                scenarioId: scenarioId as string,
                tab: "scenario",
              })}
            >
              Back to scenario
            </Link>
          ) : null}
          {playerCombatHref ? <Link href={playerCombatHref}>Open player combat screen</Link> : null}
        </div>
      ) : null}

      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>{encounter.title}</h1>
        <p style={{ margin: 0 }}>
          {isNestedScenarioFlow
            ? "GM encounter management for this scenario, with round scaffolding, declarations, turn order, and the handoff point to the player combat screen."
            : "Legacy local encounter shell with participant summaries, round declarations, manual turn ordering, and position/orientation placeholders for future combat resolution work."}
        </p>
      </div>

      {feedback ? (
        <section
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          {feedback}
        </section>
      ) : null}

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Turn scaffolding</h2>
        <div>Round: {encounterView.currentRound}</div>
        <div>Turn order mode: {encounter.turnOrderMode}</div>
        <div>Current turn index: {encounterView.currentTurnIndex}</div>
        <div>Current participant: {currentParticipant?.summary.displayName ?? "None"}</div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            disabled={encounterView.currentTurnIndex <= 0}
            onClick={() =>
              void persistEncounter(
                setEncounterCurrentTurnIndex({
                  currentTurnIndex: encounterView.currentTurnIndex - 1,
                  session: encounter
                }),
                "Moved current turn backward."
              )
            }
            type="button"
          >
            Previous turn
          </button>
          <button
            disabled={encounterView.currentTurnIndex >= encounterView.participants.length - 1}
            onClick={() =>
              void persistEncounter(
                setEncounterCurrentTurnIndex({
                  currentTurnIndex: encounterView.currentTurnIndex + 1,
                  session: encounter
                }),
                "Moved current turn forward."
              )
            }
            type="button"
          >
            Next turn
          </button>
        </div>
      </section>

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Action log</h2>
        {encounterView.actionLog.length > 0 ? (
          encounterView.actionLog.map((entry) => (
            <div
              key={entry.id}
              style={{
                background: "#fbfaf5",
                border: "1px solid #d9ddd8",
                borderRadius: 10,
                display: "grid",
                gap: "0.25rem",
                padding: "0.75rem"
              }}
            >
              <strong>
                Round {entry.roundNumber}: {entry.attackerName} vs {entry.defenderName}
              </strong>
              <div>Outcome: {entry.outcome}</div>
              <div>Weapon: {entry.selectedWeaponName ?? "None"}</div>
              <div>Shield: {entry.selectedShieldName ?? "None"}</div>
              <div>
                Attack: roll {entry.attackRoll}, total {entry.attackTotal}, defense target {entry.dbValue}
              </div>
              <div>
                Parry:{" "}
                {entry.parryRoll !== undefined && entry.parryTotal !== undefined
                  ? `roll ${entry.parryRoll}, total ${entry.parryTotal}`
                  : "No parry roll"}
              </div>
              <div>Resolved location: {entry.hitLocation ?? "Pending"}</div>
              <div>Armor: {entry.armorLabel ?? "No modeled armor"} ({entry.armorValue ?? 0})</div>
              <div>Weapon/armor modifier: {entry.weaponArmorModifier ?? "Pending"}</div>
              <div>Raw damage: {entry.rawDamage ?? "Pending"}</div>
              <div>Final damage: {entry.finalDamage ?? "Pending"}</div>
              <div>Critical status: {entry.criticalStatus ?? "none"}</div>
              <div>Critical type: {entry.criticalType ?? "None"}</div>
              <div>
                Critical roll:{" "}
                {entry.criticalRoll !== undefined
                  ? `${entry.criticalRoll} + ${entry.criticalModifierTotal ?? 0}`
                  : "Pending"}
              </div>
              <div>Critical result key: {entry.criticalResultKey ?? "Pending"}</div>
              <div>Critical result row: {entry.criticalResultRow ?? "Pending"}</div>
              <div>Critical effect: {entry.criticalEffectSummary ?? "None"}</div>
              <div>
                Critical trigger threshold: {entry.criticalTriggerThreshold ?? "Provisional pending"}
              </div>
              <div>Resolved: {new Date(entry.resolvedAt).toLocaleString()}</div>
              {entry.outcome === "hit-pending-damage" ? (
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button onClick={() => void handleResolveDamage(entry.id)} type="button">
                    Resolve damage
                  </button>
                </div>
              ) : null}
              {entry.outcome === "critical-pending" ? (
                <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                  <button onClick={() => void handleResolveCritical(entry.id)} type="button">
                    Resolve critical
                  </button>
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div>No resolved combat actions yet.</div>
        )}
      </section>

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Round summary</h2>
        <div>Declarations locked: {encounterView.declarationsLocked ? "Yes" : "No"}</div>
        <div>
          Declaration status:{" "}
          {encounterView.declarationsComplete ? "All participants declared" : "Declarations pending"}
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <button
            onClick={() =>
              void persistEncounter(
                setEncounterDeclarationsLocked({
                  locked: !encounterView.declarationsLocked,
                  session: encounter
                }),
                encounterView.declarationsLocked ? "Unlocked declarations." : "Locked declarations."
              )
            }
            type="button"
          >
            {encounterView.declarationsLocked ? "Unlock declarations" : "Lock declarations"}
          </button>
          <button
            disabled={encounterView.declarationsLocked || encounterView.participants.length === 0}
            onClick={() =>
              void persistEncounter(
                clearEncounterDeclarations({
                  session: encounter
                }),
                "Cleared round declarations."
              )
            }
            type="button"
          >
            Clear declarations
          </button>
          <button
            onClick={() =>
              void persistEncounter(
                advanceEncounterRound({
                  session: encounter
                }),
                "Moved encounter to the next round."
              )
            }
            type="button"
          >
            Next round
          </button>
        </div>
        {encounterView.roundSummary.length > 0 ? (
          encounterView.roundSummary.map((entry) => (
            <div
              key={entry.participantId}
              style={{
                background: "#fbfaf5",
                border: "1px solid #d9ddd8",
                borderRadius: 10,
                display: "grid",
                gap: "0.25rem",
                padding: "0.75rem"
              }}
            >
              <strong>{entry.displayName}</strong>
              <div>Action: {entry.actionLabel}</div>
              <div>Target: {entry.selectedTargetName ?? "None"}</div>
              <div>Weapon: {entry.selectedWeaponName ?? "None"}</div>
              <div>Shield: {entry.selectedShieldName ?? "None"}</div>
              <div>Defense posture: {entry.defensePostureLabel ?? "None"}</div>
              <div>Defense focus: {entry.defenseFocusLabel ?? "None"}</div>
              <div>Status: {entry.isComplete ? "Ready" : "Incomplete"}</div>
            </div>
          ))
        ) : (
          <div>No participants yet.</div>
        )}
      </section>

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Add participants</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            Saved character
            <select
              onChange={(event) => setSelectedCharacterId(event.target.value)}
              style={{ minWidth: 220, padding: "0.5rem" }}
              value={selectedCharacterId}
            >
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {getCharacterName(character)}
                </option>
              ))}
            </select>
          </label>
          <button onClick={() => void handleAddCharacterParticipant()} type="button">
            Add character participant
          </button>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "end" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            Ad hoc participant
            <input
              onChange={(event) => setAdHocName(event.target.value)}
              placeholder="Gate guard"
              style={{ minWidth: 220, padding: "0.5rem" }}
              type="text"
              value={adHocName}
            />
          </label>
          <button onClick={() => void handleAddAdHocParticipant()} type="button">
            Add ad hoc participant
          </button>
        </div>
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Participants</h2>
        {encounterView.participants.length > 0 ? (
          encounterView.participants.map(
            ({ declarationSummary, isCurrentTurn, participant, summary }, index) => {
              const equippedWeapons = summary.sheetSummary?.equipment.equippedWeapons ?? [];
              const equippedShields = summary.sheetSummary?.equipment.equippedShields ?? [];
              const declarationTargetOptions = encounterView.participants.filter(
                (entry) => entry.participant.id !== participant.id
              );

              return (
                <div
                  key={participant.id}
                  style={{
                    background: isCurrentTurn ? "#eef5e8" : "#fbfaf5",
                    border: "1px solid #d9ddd8",
                    borderRadius: 12,
                    display: "grid",
                    gap: "0.75rem",
                    padding: "1rem"
                  }}
                >
                  <div
                    style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}
                  >
                    <strong>{summary.displayName}</strong>
                    <span>Order: {participant.order + 1}</span>
                    <span>Initiative: {participant.initiative}</span>
                    {isCurrentTurn ? <span>Current turn</span> : null}
                  </div>

                  <div style={{ display: "grid", gap: "0.35rem" }}>
                    <div>Profession: {summary.professionName ?? "Ad hoc participant"}</div>
                    <div>
                      Key stats:{" "}
                      {summary.keyStats.length > 0
                        ? summary.keyStats
                            .map((stat) => `${stat.stat.toUpperCase()} ${stat.value}`)
                            .join(", ")
                        : "Not linked"}
                    </div>
                    <div>Total GMs: {summary.gmsTotal}</div>
                    <div>Dodge: {summary.dodge}</div>
                    <div>Parry: {summary.parry}</div>
                    <div>
                      Equipped weapons:{" "}
                      {summary.equippedWeaponNames.length > 0
                        ? summary.equippedWeaponNames.join(", ")
                        : "None"}
                    </div>
                    <div>
                      Equipped shield:{" "}
                      {summary.equippedShieldNames.length > 0
                        ? summary.equippedShieldNames.join(", ")
                        : "None"}
                    </div>
                    <div>Armor: {summary.armorSummary}</div>
                    <div>
                      Combat groups:{" "}
                      {summary.combatGroups.length > 0
                        ? summary.combatGroups
                            .map((group) => `${group.name} ${group.groupLevel}`)
                            .join(", ")
                        : "None"}
                    </div>
                    <div>
                      Combat skills:{" "}
                      {summary.combatSkills.length > 0
                        ? summary.combatSkills
                            .map((skill) => `${skill.name} ${skill.totalSkill}`)
                            .join(", ")
                        : "None"}
                    </div>
                  </div>

                  <section
                    style={{
                      background: "#f6f5ef",
                      border: "1px solid #d9ddd8",
                      borderRadius: 10,
                      display: "grid",
                      gap: "0.75rem",
                      padding: "0.75rem"
                    }}
                  >
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
                      <strong>Declaration</strong>
                      <span>Status: {declarationSummary.isComplete ? "Ready" : "Incomplete"}</span>
                    </div>
                    <div>
                      Current: {declarationSummary.actionLabel}
                      {declarationSummary.selectedTargetName
                        ? ` vs ${declarationSummary.selectedTargetName}`
                        : ""}
                      {declarationSummary.selectedWeaponName
                        ? ` with ${declarationSummary.selectedWeaponName}`
                        : ""}
                      {declarationSummary.selectedShieldName
                        ? ` / ${declarationSummary.selectedShieldName}`
                        : ""}
                    </div>
                    {declarationSummary.errors.length > 0 ? (
                      <div style={{ color: "#8a2f2f" }}>
                        Errors: {declarationSummary.errors.join(" ")}
                      </div>
                    ) : null}
                    {declarationSummary.warnings.length > 0 ? (
                      <div style={{ color: "#705a1a" }}>
                        Warnings: {declarationSummary.warnings.join(" ")}
                      </div>
                    ) : null}
                    <div
                      style={{
                        display: "grid",
                        gap: "0.75rem",
                        gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))"
                      }}
                    >
                      <label style={{ display: "grid", gap: "0.25rem" }}>
                        Action
                        <select
                          disabled={encounterView.declarationsLocked}
                          onChange={(event) =>
                            void persistEncounter(
                              updateEncounterParticipantDeclaration({
                                declaration: {
                                  actionType: event.target.value as typeof participant.declaration.actionType
                                },
                                participantId: participant.id,
                                session: encounter
                              }),
                              "Updated participant declaration."
                            )
                          }
                          style={{ padding: "0.5rem" }}
                          value={participant.declaration.actionType}
                        >
                          {ACTION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: "0.25rem" }}>
                        Target
                        <select
                          disabled={encounterView.declarationsLocked}
                          onChange={(event) =>
                            void persistEncounter(
                              updateEncounterParticipantDeclaration({
                                declaration: {
                                  targetParticipantId: event.target.value || undefined
                                },
                                participantId: participant.id,
                                session: encounter
                              }),
                              "Updated declaration target."
                            )
                          }
                          style={{ padding: "0.5rem" }}
                          value={participant.declaration.targetParticipantId ?? ""}
                        >
                          <option value="">No target</option>
                          {declarationTargetOptions.map((option) => (
                            <option key={option.participant.id} value={option.participant.id}>
                              {option.summary.displayName}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: "0.25rem" }}>
                        Weapon
                        <select
                          disabled={encounterView.declarationsLocked || equippedWeapons.length === 0}
                          onChange={(event) =>
                            void persistEncounter(
                              updateEncounterParticipantDeclaration({
                                declaration: {
                                  weaponItemId: event.target.value || undefined
                                },
                                participantId: participant.id,
                                session: encounter
                              }),
                              "Updated declaration weapon."
                            )
                          }
                          style={{ padding: "0.5rem" }}
                          value={participant.declaration.weaponItemId ?? ""}
                        >
                          <option value="">No weapon</option>
                          {equippedWeapons.map((weapon) => (
                            <option key={weapon.id} value={weapon.id}>
                              {weapon.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: "0.25rem" }}>
                        Shield
                        <select
                          disabled={encounterView.declarationsLocked || equippedShields.length === 0}
                          onChange={(event) =>
                            void persistEncounter(
                              updateEncounterParticipantDeclaration({
                                declaration: {
                                  shieldItemId: event.target.value || undefined
                                },
                                participantId: participant.id,
                                session: encounter
                              }),
                              "Updated declaration shield."
                            )
                          }
                          style={{ padding: "0.5rem" }}
                          value={participant.declaration.shieldItemId ?? ""}
                        >
                          <option value="">No shield</option>
                          {equippedShields.map((shield) => (
                            <option key={shield.id} value={shield.id}>
                              {shield.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: "0.25rem" }}>
                        Defense posture
                        <select
                          disabled={encounterView.declarationsLocked}
                          onChange={(event) =>
                            void persistEncounter(
                              updateEncounterParticipantDeclaration({
                                declaration: {
                                  defensePosture: event.target.value as typeof participant.declaration.defensePosture
                                },
                                participantId: participant.id,
                                session: encounter
                              }),
                              "Updated defense posture."
                            )
                          }
                          style={{ padding: "0.5rem" }}
                          value={participant.declaration.defensePosture}
                        >
                          {DEFENSE_POSTURE_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: "0.25rem" }}>
                        Target location
                        <select
                          disabled={encounterView.declarationsLocked}
                          onChange={(event) =>
                            void persistEncounter(
                              updateEncounterParticipantDeclaration({
                                declaration: {
                                  targetLocation: event.target.value as typeof participant.declaration.targetLocation
                                },
                                participantId: participant.id,
                                session: encounter
                              }),
                              "Updated target location."
                            )
                          }
                          style={{ padding: "0.5rem" }}
                          value={participant.declaration.targetLocation}
                        >
                          {TARGET_LOCATION_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label style={{ display: "grid", gap: "0.25rem" }}>
                        Defense focus
                        <select
                          disabled={encounterView.declarationsLocked}
                          onChange={(event) =>
                            void persistEncounter(
                              updateEncounterParticipantDeclaration({
                                declaration: {
                                  defenseFocus: event.target.value as typeof participant.declaration.defenseFocus
                                },
                                participantId: participant.id,
                                session: encounter
                              }),
                              "Updated defense focus."
                            )
                          }
                          style={{ padding: "0.5rem" }}
                          value={participant.declaration.defenseFocus}
                        >
                          {DEFENSE_FOCUS_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                      <button
                        disabled={participant.declaration.actionType !== "attack"}
                        onClick={() => void handleResolveAttack(participant.id)}
                        type="button"
                      >
                        Resolve attack
                      </button>
                      <button
                        disabled={encounterView.declarationsLocked}
                        onClick={() =>
                          void persistEncounter(
                            clearEncounterParticipantDeclaration({
                              participantId: participant.id,
                              session: encounter
                            }),
                            "Cleared participant declaration."
                          )
                        }
                        type="button"
                      >
                        Clear declaration
                      </button>
                    </div>
                  </section>

                  <div
                    style={{
                      display: "grid",
                      gap: "0.75rem",
                      gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))"
                    }}
                  >
                <label style={{ display: "grid", gap: "0.25rem" }}>
                  Initiative
                  <input
                    onChange={(event) =>
                      void persistEncounter(
                        updateEncounterParticipantTurnData({
                          initiative: Number.parseInt(event.target.value, 10) || 0,
                          participantId: participant.id,
                          session: encounter
                        }),
                        "Updated participant initiative."
                      )
                    }
                    style={{ padding: "0.5rem" }}
                    type="number"
                    value={participant.initiative}
                  />
                </label>

                <label style={{ display: "grid", gap: "0.25rem" }}>
                  X
                  <input
                    onChange={(event) =>
                      void persistEncounter(
                        updateEncounterParticipantTurnData({
                          participantId: participant.id,
                          position: {
                            ...participant.position,
                            x: Number.parseInt(event.target.value, 10) || 0
                          },
                          session: encounter
                        }),
                        "Updated participant position."
                      )
                    }
                    style={{ padding: "0.5rem" }}
                    type="number"
                    value={participant.position.x}
                  />
                </label>

                <label style={{ display: "grid", gap: "0.25rem" }}>
                  Y
                  <input
                    onChange={(event) =>
                      void persistEncounter(
                        updateEncounterParticipantTurnData({
                          participantId: participant.id,
                          position: {
                            ...participant.position,
                            y: Number.parseInt(event.target.value, 10) || 0
                          },
                          session: encounter
                        }),
                        "Updated participant position."
                      )
                    }
                    style={{ padding: "0.5rem" }}
                    type="number"
                    value={participant.position.y}
                  />
                </label>

                <label style={{ display: "grid", gap: "0.25rem" }}>
                  Zone
                  <input
                    onChange={(event) =>
                      void persistEncounter(
                        updateEncounterParticipantTurnData({
                          participantId: participant.id,
                          position: {
                            ...participant.position,
                            zone: event.target.value || "center"
                          },
                          session: encounter
                        }),
                        "Updated participant position."
                      )
                    }
                    style={{ padding: "0.5rem" }}
                    type="text"
                    value={participant.position.zone}
                  />
                </label>

                <label style={{ display: "grid", gap: "0.25rem" }}>
                  Facing
                  <select
                    onChange={(event) =>
                      void persistEncounter(
                        updateEncounterParticipantTurnData({
                          facing: event.target.value as typeof participant.facing,
                          participantId: participant.id,
                          session: encounter
                        }),
                        "Updated participant facing."
                      )
                    }
                    style={{ padding: "0.5rem" }}
                    value={participant.facing}
                  >
                    <option value="north">North</option>
                    <option value="east">East</option>
                    <option value="south">South</option>
                    <option value="west">West</option>
                  </select>
                </label>

                <label style={{ display: "grid", gap: "0.25rem" }}>
                  Orientation
                  <select
                    onChange={(event) =>
                      void persistEncounter(
                        updateEncounterParticipantTurnData({
                          orientation: event.target.value as typeof participant.orientation,
                          participantId: participant.id,
                          session: encounter
                        }),
                        "Updated participant orientation."
                      )
                    }
                    style={{ padding: "0.5rem" }}
                    value={participant.orientation}
                  >
                    <option value="neutral">Neutral</option>
                    <option value="front">Front</option>
                    <option value="side">Side</option>
                    <option value="behind">Behind</option>
                  </select>
                </label>
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                    <button
                      disabled={index === 0}
                      onClick={() =>
                        void persistEncounter(
                          moveEncounterParticipant({
                            direction: "up",
                            participantId: participant.id,
                            session: encounter
                          }),
                          "Moved participant up in turn order."
                        )
                      }
                      type="button"
                    >
                      Move up
                    </button>
                    <button
                      disabled={index === encounterView.participants.length - 1}
                      onClick={() =>
                        void persistEncounter(
                          moveEncounterParticipant({
                            direction: "down",
                            participantId: participant.id,
                            session: encounter
                          }),
                          "Moved participant down in turn order."
                        )
                      }
                      type="button"
                    >
                      Move down
                    </button>
                    <button
                      onClick={() =>
                        void persistEncounter(
                          setEncounterCurrentTurnIndex({
                            currentTurnIndex: index,
                            session: encounter
                          }),
                          "Set current turn."
                        )
                      }
                      type="button"
                    >
                      Set current turn
                    </button>
                    <button
                      onClick={() =>
                        void persistEncounter(
                          removeEncounterParticipant({
                            participantId: participant.id,
                            session: encounter
                          }),
                          "Removed participant from encounter."
                        )
                      }
                      type="button"
                    >
                      Remove participant
                    </button>
                  </div>
                </div>
              );
            }
          )
        ) : (
          <div
            style={{
              background: "#f6f5ef",
              border: "1px solid #d9ddd8",
              borderRadius: 12,
              padding: "1rem"
            }}
          >
            No participants yet.
          </div>
        )}
      </section>
    </section>
  );
}
