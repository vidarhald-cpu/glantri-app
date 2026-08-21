"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { type CharacterBuild, type ProfessionDefinition } from "@glantri/domain";
import { buildCharacterSheetSummary } from "@glantri/rules-engine";

import {
  getCurrentCharacterFromMutationConflict,
  updateServerCharacter,
} from "@/lib/api/localServiceClient";
import {
  setCharacterAge,
  setCharacterGender,
  setCharacterName,
  setCharacterNotes,
  setCharacterTitle,
} from "@/lib/characters/characterEdit";
import {
  buildCharacterSheetProfileStatRows,
  buildCharacterSheetSkillRows,
  buildCharacterSheetSpecializationRows,
  characterSheetSkillsTableColumns,
  characterSheetSpecializationsTableColumns,
  characterSheetStatsTableColumns,
} from "@/lib/characters/characterSheet";
import { loadLocalCharacterContext } from "@/lib/characters/loadLocalCharacterContext";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import type { CharacterRecoveryEnvelope, LocalCharacterRecord } from "@/lib/offline/glantriDexie";
import {
  applyCharacterRecoveryPatch,
  CharacterRecoveryRepository,
  formatCharacterRecoveryField,
} from "@/lib/offline/repositories/characterRecoveryRepository";
import {
  buildServerBackedLocalCharacterRecord,
  LocalCharacterRepository,
  requireServerCharacterRevision,
  UNNAMED_CHARACTER_PLACEHOLDER,
} from "@/lib/offline/repositories/localCharacterRepository";

interface CharacterDetailProps {
  id: string;
}

const localCharacterRepository = new LocalCharacterRepository();
const characterRecoveryRepository = new CharacterRecoveryRepository();

function getCharacterName(build: CharacterBuild): string {
  return build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER;
}

function getChargenRuleSetName(build: CharacterBuild): string {
  return build.chargenRuleSet?.name ?? "Legacy default";
}

function getProfessionFamilyName(
  content: Awaited<ReturnType<typeof loadLocalCharacterContext>>["content"],
  profession: ProfessionDefinition | undefined,
): string | null {
  if (!profession?.familyId) {
    return null;
  }

  return (
    content.professionFamilies.find((family) => family.id === profession.familyId)?.name ?? null
  );
}

export default function CharacterDetail({ id }: CharacterDetailProps) {
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [build, setBuild] = useState<CharacterBuild>();
  const [canonicalBuild, setCanonicalBuild] = useState<CharacterBuild>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<LocalCharacterRecord>();
  const [recoveryRecord, setRecoveryRecord] = useState<CharacterRecoveryEnvelope>();
  const [legacyRecoveryCount, setLegacyRecoveryCount] = useState(0);
  const [reviewingRecovery, setReviewingRecovery] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [contentState, setContentState] = useState<
    Awaited<ReturnType<typeof loadLocalCharacterContext>>["content"] | undefined
  >();

  useEffect(() => {
    let cancelled = false;

    if (sessionLoading) {
      return () => {
        cancelled = true;
      };
    }

    if (!currentUser) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    loadLocalCharacterContext(id, currentUser.id)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setContentState(result.content);
        setRecord(result.record);
        setBuild(result.record?.build);
        setCanonicalBuild(result.record?.build);
        setRecoveryRecord(result.recoveryRecord);
        setLegacyRecoveryCount(result.legacyRecoveryCount);
        setReviewingRecovery(false);
        if (result.recoveryRecord && result.record) {
          setFeedback(
            result.hasRevisionConflict
              ? "The same Character details changed elsewhere. The current Character is shown, and your unsaved changes need review."
              : "The current Character is shown, and your unsaved changes remain available on this device.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentUser, id, sessionLoading]);

  const profession = useMemo(() => {
    if (!build || !contentState) {
      return undefined;
    }

    return contentState.professions.find((item) => item.id === build.professionId);
  }, [build, contentState]);

  const sheetSummary = useMemo(() => {
    if (!build || !contentState) {
      return undefined;
    }

    return buildCharacterSheetSummary({
      build,
      content: contentState,
    });
  }, [build, contentState]);

  const profileStatRows = useMemo(() => {
    if (!build) {
      return [];
    }

    return buildCharacterSheetProfileStatRows(build);
  }, [build]);

  const groupedSkillRows = useMemo(() => {
    if (!contentState || !sheetSummary || !build) {
      return [];
    }
    return buildCharacterSheetSkillRows({
      build,
      content: contentState,
      sheetSummary,
    });
  }, [build, contentState, sheetSummary]);
  const specializationRows = useMemo(() => {
    if (!contentState || !sheetSummary) {
      return [];
    }

    return buildCharacterSheetSpecializationRows({
      content: contentState,
      sheetSummary,
    });
  }, [contentState, sheetSummary]);

  const skillGroupRows = useMemo(() => {
    if (!contentState || !sheetSummary) {
      return [];
    }

    return [...contentState.skillGroups]
      .sort((left, right) => left.sortOrder - right.sortOrder)
      .map((group) => {
        const groupView = sheetSummary.draftView.groups.find((item) => item.groupId === group.id);
        if (!groupView || groupView.groupLevel <= 0) {
          return null;
        }

        return {
          groupLevel: groupView.groupLevel,
          name: group.name,
        };
      })
      .filter(
        (
          group,
        ): group is {
          groupLevel: number;
          name: string;
        } => group !== null,
      );
  }, [contentState, sheetSummary]);

  async function persistBuild(
    nextBuild: CharacterBuild,
    successMessage: string,
    sourceAction: string,
  ) {
    if (!record || !currentUser) {
      return;
    }

    if (recoveryRecord && !reviewingRecovery) {
      setFeedback("Review or discard the existing unsaved changes before saving new changes.");
      return;
    }

    const expectedUpdatedAt = requireServerCharacterRevision(record);
    const recoveryEnvelope = await characterRecoveryRepository.createAttempt({
      account: currentUser,
      attemptedBuild: nextBuild,
      baseBuild: record.build,
      baseRevision: expectedUpdatedAt,
      characterId: id,
      sourceAction,
      sourceSurface: "Character Sheet",
    });
    setRecoveryRecord(recoveryEnvelope);

    try {
      const savedServerRecord = await updateServerCharacter({
        build: nextBuild,
        characterId: id,
        expectedUpdatedAt,
      });
      const savedLocalRecord = await localCharacterRepository.save({
        build: savedServerRecord.build,
        creatorDisplayName: record.creatorDisplayName,
        creatorEmail: record.creatorEmail,
        creatorId: savedServerRecord.ownerId ?? record.creatorId,
        createdAt: record.createdAt,
        finalizedAt: record.finalizedAt,
        serverUpdatedAt: savedServerRecord.updatedAt,
        syncStatus: "synced",
        updatedAt: savedServerRecord.updatedAt,
      });

      setRecord(savedLocalRecord);
      setCanonicalBuild(savedLocalRecord.build);
      setBuild(savedLocalRecord.build);
      if (recoveryEnvelope) {
        await characterRecoveryRepository.deleteAttempt(
          currentUser.id,
          id,
          recoveryEnvelope.saveAttempt.id,
        );
      }
      setRecoveryRecord(await characterRecoveryRepository.get(currentUser.id, id));
      setReviewingRecovery(false);
      setFeedback(successMessage);
    } catch (error) {
      const currentCharacter = getCurrentCharacterFromMutationConflict(error);

      if (currentCharacter) {
        const canonicalRecord = buildServerBackedLocalCharacterRecord(currentCharacter, record);
        await localCharacterRepository.save(canonicalRecord);
        await characterRecoveryRepository.markAttemptOutcome(
          currentUser.id,
          id,
          "conflict",
          "stale_character",
        );
        const recoveryState = await characterRecoveryRepository.reconcile(
          currentUser.id,
          id,
          currentCharacter.build,
          currentCharacter.updatedAt,
        );
        setRecord(canonicalRecord);
        setCanonicalBuild(canonicalRecord.build);
        setBuild(canonicalRecord.build);
        setRecoveryRecord(recoveryState?.envelope);
        setReviewingRecovery(false);
        setFeedback(
          "The Character changed elsewhere. The current Character is shown, and your attempted changes remain available for review.",
        );
        return;
      }

      await characterRecoveryRepository.markAttemptOutcome(
        currentUser.id,
        id,
        "failed",
        error instanceof Error ? error.name : undefined,
      );
      setBuild(canonicalBuild ?? record.build);
      setReviewingRecovery(false);
      throw error;
    }
  }

  function handleReviewRecovery() {
    if (!recoveryRecord || !canonicalBuild) {
      return;
    }

    setBuild(applyCharacterRecoveryPatch(canonicalBuild, recoveryRecord.patch));
    setReviewingRecovery(true);
    setFeedback(
      "Unsaved changes loaded for review. Nothing has been saved to the current Character yet.",
    );
  }

  function handleReturnToCanonical() {
    if (!canonicalBuild) {
      return;
    }

    setBuild(canonicalBuild);
    setReviewingRecovery(false);
    setFeedback("Current Character restored. Your unsaved changes are still available.");
  }

  async function handleDiscardRecovery() {
    if (!record || !currentUser) {
      return;
    }

    await characterRecoveryRepository.delete(currentUser.id, id);
    setCanonicalBuild(record.build);
    setBuild(record.build);
    setRecoveryRecord(undefined);
    setReviewingRecovery(false);
    setFeedback("Unsaved changes discarded. The current Character remains unchanged.");
  }

  async function handleSaveIdentity() {
    if (!build) {
      return;
    }

    setSavingIdentity(true);
    setFeedback(undefined);

    try {
      await persistBuild(build, "Identity details saved.", "Save identity details");
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? `${error.message} The current Character is shown and your attempted changes remain available for review.`
          : "Unable to save identity details. The current Character is shown and your attempted changes remain available for review.",
      );
    } finally {
      setSavingIdentity(false);
    }
  }

  async function handleSaveNotes() {
    if (!build) {
      return;
    }

    setSavingNotes(true);
    setFeedback(undefined);

    try {
      await persistBuild(build, "Character notes saved.", "Save Character notes");
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? `${error.message} The current Character is shown and your attempted changes remain available for review.`
          : "Unable to save Character notes. The current Character is shown and your attempted changes remain available for review.",
      );
    } finally {
      setSavingNotes(false);
    }
  }

  if (loading) {
    return <section>Loading character sheet...</section>;
  }

  if (!record || !build || !contentState || !sheetSummary) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Character not found</h1>
        <Link href="/characters">Characters</Link>
      </section>
    );
  }

  const professionFamilyName = getProfessionFamilyName(contentState, profession);
  const socialClassLabel = build.socialClass ?? build.profile.socialClassResult ?? "Not set";
  const socialClassNumber = build.profile.socialClassRoll;
  const socialClassSummary =
    socialClassNumber !== undefined
      ? `${socialClassLabel} (${socialClassNumber})`
      : socialClassLabel;
  const originalSkillPoints = sheetSummary.skillPoints.original;
  const successfulProgressionGains = sheetSummary.skillPoints.successfulProgressionGains;
  const currentSkillPoints = sheetSummary.skillPoints.current;
  const remainingSkillPoints =
    sheetSummary.draftView.primaryPoolAvailable + sheetSummary.draftView.secondaryPoolAvailable;
  const educationLevel = sheetSummary.draftView.education.theoreticalSkillCount;
  const notes = build.profile.notes ?? "";
  const recoveryFieldLabels = recoveryRecord
    ? [...new Set(recoveryRecord.patch.map((entry) => formatCharacterRecoveryField(entry.path)))]
    : [];
  const recoveryTime = recoveryRecord
    ? new Date(recoveryRecord.updatedAt).toLocaleString()
    : undefined;

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1180 }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <h1 style={{ margin: 0 }}>Character Sheet — {getCharacterName(build)}</h1>
      </div>

      {recoveryRecord ? (
        <section
          style={{
            background: "#fff8e8",
            border: "1px solid #d9b86c",
            borderRadius: 12,
            display: "grid",
            gap: "0.75rem",
            padding: "1rem",
          }}
        >
          <strong>
            {reviewingRecovery ? "Reviewing unsaved changes" : "Unsaved changes need review"}
          </strong>
          <span>
            {reviewingRecovery
              ? "These changes are shown for review. They have not replaced the current Character."
              : recoveryRecord.reconciliation === "conflict"
                ? "The same Character details changed elsewhere. Review your saved-on-device changes before deciding what to keep."
                : "The current Character is shown. Your unsaved changes are still available on this device."}
          </span>
          <span>
            From {recoveryRecord.sourceSurface} · {recoveryRecord.sourceAction}
            {recoveryTime ? ` · ${recoveryTime}` : ""}
          </span>
          <span>Changed: {recoveryFieldLabels.join(", ")}</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {reviewingRecovery ? (
              <button onClick={handleReturnToCanonical} type="button">
                Return to current Character
              </button>
            ) : (
              <button onClick={handleReviewRecovery} type="button">
                Review unsaved changes
              </button>
            )}
            <button onClick={() => void handleDiscardRecovery()} type="button">
              Discard unsaved changes
            </button>
          </div>
        </section>
      ) : null}

      {legacyRecoveryCount > 0 ? (
        <section
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "0.5rem",
            padding: "1rem",
          }}
        >
          <strong>Older saved-on-device changes were kept separately</strong>
          <span>
            Their account and exact origin could not be verified, so they will never replace this
            Character automatically or be shown to another account.
          </span>
        </section>
      ) : null}

      <section
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <section
          style={{
            background: "#fbfaf5",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            overflowX: "auto",
            padding: "1rem",
          }}
        >
          <h2 style={{ margin: "0 0 0.75rem 0" }}>Profile Stats</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                {characterSheetStatsTableColumns.map((column, index) => (
                  <th
                    key={column}
                    style={{
                      padding: index === 0 ? "0.5rem 0.75rem 0.5rem 0" : "0.5rem 0.75rem",
                      textAlign: index === 0 ? "left" : "right",
                    }}
                  >
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {profileStatRows.map((row) => (
                <tr key={row.stat} style={{ borderBottom: "1px solid #eee8dc" }}>
                  <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>{row.label}</td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                    {row.statsDieRollValue ?? "—"}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                    {row.originalValue}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                    {row.developedValue}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                    {row.currentValue}
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{row.gmValue}</td>
                </tr>
              ))}
              <tr style={{ borderBottom: "1px solid #eee8dc" }}>
                <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>Distraction</td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                  {sheetSummary.distractionLevel}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                  {sheetSummary.distractionLevel}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                  {sheetSummary.distractionLevel}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                  {sheetSummary.distractionLevel}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>—</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem",
          }}
        >
          <h2 style={{ margin: "0 0 0.75rem 0" }}>Summary</h2>
          <div
            style={{
              alignItems: "start",
              columnGap: "1rem",
              display: "grid",
              gridTemplateColumns: "minmax(120px, auto) minmax(0, 1fr)",
              rowGap: "0.6rem",
            }}
          >
            <strong>Character name</strong>
            <input
              id="character-sheet-name"
              onChange={(event) =>
                setBuild((current) =>
                  current ? setCharacterName(current, event.target.value) : current,
                )
              }
              style={{ fontSize: "1rem", padding: "0.55rem" }}
              type="text"
              value={build.name}
            />

            <strong>Title</strong>
            <input
              id="character-sheet-title"
              onChange={(event) =>
                setBuild((current) =>
                  current ? setCharacterTitle(current, event.target.value) : current,
                )
              }
              style={{ fontSize: "1rem", padding: "0.55rem" }}
              type="text"
              value={build.profile.title ?? ""}
            />

            <strong>Age</strong>
            <input
              id="character-sheet-age"
              onChange={(event) =>
                setBuild((current) =>
                  current ? setCharacterAge(current, event.target.value) : current,
                )
              }
              style={{ fontSize: "1rem", padding: "0.55rem" }}
              type="text"
              value={build.profile.age ?? ""}
            />

            <strong>Gender</strong>
            <select
              id="character-sheet-gender"
              onChange={(event) =>
                setBuild((current) =>
                  current
                    ? setCharacterGender(
                        current,
                        event.target.value as "" | "male" | "female" | "other",
                      )
                    : current,
                )
              }
              style={{ fontSize: "1rem", padding: "0.55rem" }}
              value={build.profile.gender ?? ""}
            >
              <option value="">---</option>
              <option value="male">male</option>
              <option value="female">female</option>
              <option value="other">other</option>
            </select>

            <strong>Society</strong>
            <div>{sheetSummary.societyLabel ?? "Not set"}</div>

            <strong>Social class</strong>
            <div>{socialClassSummary}</div>

            <strong>Profession</strong>
            <div>
              {sheetSummary.professionName ?? build.professionId ?? "Not set"}
              {professionFamilyName ? `, ${professionFamilyName}` : ""}
            </div>

            <strong>Chargen rules</strong>
            <div>{getChargenRuleSetName(build)}</div>

            <strong>Current skill points</strong>
            <div>
              <div>{currentSkillPoints}</div>
              <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                Original {originalSkillPoints} + successful progression {successfulProgressionGains}
              </div>
              <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                Chargen remaining: {remainingSkillPoints}
              </div>
            </div>

            <strong>Skill groups</strong>
            <div style={{ display: "grid", gap: "0.2rem" }}>
              {skillGroupRows.length > 0 ? (
                skillGroupRows.map((group) => (
                  <div key={group.name}>
                    {group.name} (Level {group.groupLevel})
                  </div>
                ))
              ) : (
                <div>No skill groups recorded.</div>
              )}
            </div>

            <strong>Education</strong>
            <div>{educationLevel}</div>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.75rem",
              justifyContent: "space-between",
              marginTop: "1rem",
            }}
          >
            <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
              Personal information is edited and saved here on the Character Sheet.
            </div>
            <button
              disabled={savingIdentity || Boolean(recoveryRecord && !reviewingRecovery)}
              onClick={() => void handleSaveIdentity()}
              type="button"
            >
              {savingIdentity ? "Saving..." : "Save identity"}
            </button>
          </div>
        </section>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "1rem",
          padding: "1rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Skills</h2>
        {groupedSkillRows.length > 0 ? (
          <div style={{ display: "grid", gap: "1rem" }}>
            {groupedSkillRows.map((group) => (
              <section
                key={group.bucketId}
                style={{ border: "1px solid #e7e2d7", borderRadius: 10, overflowX: "auto" }}
              >
                <div
                  style={{
                    alignItems: "center",
                    background: "#f6f5ef",
                    borderBottom: "1px solid #e7e2d7",
                    display: "flex",
                    gap: "0.5rem",
                    justifyContent: "space-between",
                    padding: "0.75rem 1rem",
                  }}
                >
                  <strong>{group.label}</strong>
                  <span style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                    {group.rows.length} skill{group.rows.length === 1 ? "" : "s"}
                  </span>
                </div>
                <div
                  style={{
                    borderBottom: "1px solid #e7e2d7",
                    color: "#5e5a50",
                    display: "grid",
                    fontSize: "0.8rem",
                    gap: "0.75rem",
                    gridTemplateColumns:
                      "minmax(180px, 2fr) minmax(120px, 1.2fr) repeat(6, minmax(72px, 88px))",
                    padding: "0.75rem 1rem",
                  }}
                >
                  {characterSheetSkillsTableColumns.map((column) => (
                    <strong key={column}>{column}</strong>
                  ))}
                </div>

                {group.rows.map((skill) => (
                  <div
                    key={skill.skillKey}
                    style={{
                      borderTop: "1px solid #f0eadf",
                      display: "grid",
                      gap: "0.75rem",
                      gridTemplateColumns:
                        "minmax(180px, 2fr) minmax(120px, 1.2fr) repeat(6, minmax(72px, 88px))",
                      padding: "0.75rem 1rem",
                    }}
                  >
                    <div>
                      <div>{skill.skillName}</div>
                      {skill.grantedSourceLabel ? (
                        <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                          {skill.grantedSourceLabel}
                        </div>
                      ) : null}
                    </div>
                    <div>{skill.stats}</div>
                    <div>{skill.avgStats}</div>
                    <div>{skill.skillGroupXp}</div>
                    <div>{skill.skillXp}</div>
                    <div>{skill.grantedXp}</div>
                    <div>{skill.totalXp}</div>
                    <div>{skill.totalSkillLevel}</div>
                  </div>
                ))}
              </section>
            ))}
          </div>
        ) : (
          <div>No current skills recorded.</div>
        )}
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "1rem",
          padding: "1rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Specializations</h2>
        {specializationRows.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <div style={{ border: "1px solid #e7e2d7", borderRadius: 10, overflow: "hidden" }}>
              <div
                style={{
                  borderBottom: "1px solid #e7e2d7",
                  color: "#5e5a50",
                  display: "grid",
                  fontSize: "0.8rem",
                  gap: "0.75rem",
                  gridTemplateColumns:
                    "minmax(180px, 2fr) minmax(140px, 1.5fr) repeat(3, minmax(72px, 88px))",
                  padding: "0.75rem 1rem",
                }}
              >
                {characterSheetSpecializationsTableColumns.map((column) => (
                  <strong key={column}>{column}</strong>
                ))}
              </div>

              {specializationRows.map((specialization) => (
                <div
                  key={specialization.specializationId}
                  style={{
                    borderTop: "1px solid #f0eadf",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns:
                      "minmax(180px, 2fr) minmax(140px, 1.5fr) repeat(3, minmax(72px, 88px))",
                    padding: "0.75rem 1rem",
                  }}
                >
                  <div>
                    <div>{specialization.specializationName}</div>
                    {specialization.grantedSourceLabel ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                        {specialization.grantedSourceLabel}
                      </div>
                    ) : null}
                  </div>
                  <div>{specialization.parentSkillName}</div>
                  <div>{specialization.xp}</div>
                  <div>{specialization.grantedXp}</div>
                  <div>{specialization.total}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>No specialization rows recorded.</div>
        )}
      </section>

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Notes</h2>
        <textarea
          onChange={(event) =>
            setBuild((current) =>
              current ? setCharacterNotes(current, event.target.value) : current,
            )
          }
          placeholder="Player notes, reminders, and character details..."
          style={{
            background: "#fffdf8",
            border: "1px solid #e7e2d7",
            borderRadius: 10,
            fontFamily: "inherit",
            fontSize: "1rem",
            minHeight: 320,
            overflow: "auto",
            padding: "0.9rem",
            resize: "vertical",
          }}
          value={notes}
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            justifyContent: "space-between",
          }}
        >
          <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
            Character notes stay separate from inventory notes.
          </div>
          <button
            disabled={savingNotes || Boolean(recoveryRecord && !reviewingRecovery)}
            onClick={() => void handleSaveNotes()}
            type="button"
          >
            {savingNotes ? "Saving..." : "Save notes"}
          </button>
        </div>
      </section>

      {feedback ? (
        <div style={{ border: "1px solid #d9ddd8", borderRadius: 12, padding: "1rem" }}>
          {feedback}
        </div>
      ) : null}
    </section>
  );
}
