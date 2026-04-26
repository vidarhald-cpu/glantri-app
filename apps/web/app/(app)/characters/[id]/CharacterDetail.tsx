"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  type CharacterBuild,
  glantriCharacteristicLabels,
  glantriCharacteristicOrder,
  type ProfessionDefinition,
} from "@glantri/domain";
import {
  buildCharacterSheetSummary,
  getCharacteristicGm,
} from "@glantri/rules-engine";

import { updateServerCharacter } from "../../../../src/lib/api/localServiceClient";
import {
  setCharacterAge,
  setCharacterGender,
  setCharacterName,
  setCharacterNotes,
  setCharacterTitle
} from "../../../../src/lib/characters/characterEdit";
import {
  buildCharacterSheetSkillRows,
  buildCharacterSheetSpecializationRows
} from "../../../../src/lib/characters/characterSheet";
import { loadLocalCharacterContext } from "../../../../src/lib/characters/loadLocalCharacterContext";
import type { LocalCharacterRecord } from "../../../../src/lib/offline/glantriDexie";
import {
  LocalCharacterRepository,
  UNNAMED_CHARACTER_PLACEHOLDER
} from "../../../../src/lib/offline/repositories/localCharacterRepository";

interface CharacterDetailProps {
  id: string;
}

const localCharacterRepository = new LocalCharacterRepository();

function getCharacterName(build: CharacterBuild): string {
  return build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER;
}

function getProfessionFamilyName(
  content: Awaited<ReturnType<typeof loadLocalCharacterContext>>["content"],
  profession: ProfessionDefinition | undefined
): string | null {
  if (!profession?.familyId) {
    return null;
  }

  return content.professionFamilies.find((family) => family.id === profession.familyId)?.name ?? null;
}

export default function CharacterDetail({ id }: CharacterDetailProps) {
  const [build, setBuild] = useState<CharacterBuild>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<LocalCharacterRecord>();
  const [savingIdentity, setSavingIdentity] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [contentState, setContentState] = useState<
    Awaited<ReturnType<typeof loadLocalCharacterContext>>["content"] | undefined
  >();

  useEffect(() => {
    let cancelled = false;

    loadLocalCharacterContext(id)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setContentState(result.content);
        setRecord(result.record);
        setBuild(result.record?.build);
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
      content: contentState
    });
  }, [build, contentState]);

  const profileStatRows = useMemo(() => {
    if (!build || !sheetSummary) {
      return [];
    }

    return glantriCharacteristicOrder.map((stat) => {
      const originalValue = build.profile.rolledStats[stat];
      const currentValue = sheetSummary.adjustedStats[stat] ?? originalValue;
      const gmValue = getCharacteristicGm(stat, {
        ...build.profile.rolledStats,
        ...sheetSummary.adjustedStats
      });

      return {
        currentValue,
        gmValue,
        label: glantriCharacteristicLabels[stat],
        stat,
        originalValue
      };
    });
  }, [build, sheetSummary]);

  const groupedSkillRows = useMemo(() => {
    if (!contentState || !sheetSummary || !build) {
      return [];
    }
    return buildCharacterSheetSkillRows({
      build,
      content: contentState,
      sheetSummary
    });
  }, [build, contentState, sheetSummary]);
  const specializationRows = useMemo(() => {
    if (!contentState || !sheetSummary) {
      return [];
    }

    return buildCharacterSheetSpecializationRows({
      content: contentState,
      sheetSummary
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
          name: group.name
        };
      })
      .filter(
        (
          group
        ): group is {
          groupLevel: number;
          name: string;
        } => group !== null
      );
  }, [contentState, sheetSummary]);

  async function persistBuild(nextBuild: CharacterBuild, successMessage: string) {
    if (!record) {
      return;
    }

    const savedServerRecord = await updateServerCharacter({
      build: nextBuild,
      characterId: id
    });
    const savedLocalRecord = await localCharacterRepository.save({
      build: savedServerRecord.build,
      creatorDisplayName: record.creatorDisplayName,
      creatorEmail: record.creatorEmail,
      creatorId: savedServerRecord.ownerId ?? record.creatorId,
      createdAt: record.createdAt,
      finalizedAt: record.finalizedAt,
      syncStatus: "synced",
      updatedAt: savedServerRecord.updatedAt
    });

    setRecord(savedLocalRecord);
    setBuild(savedLocalRecord.build);
    setFeedback(successMessage);
  }

  async function handleSaveIdentity() {
    if (!build) {
      return;
    }

    setSavingIdentity(true);
    setFeedback(undefined);

    try {
      await persistBuild(build, "Identity details saved.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to save identity details.");
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
      await persistBuild(build, "Character notes saved.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to save character notes.");
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
  const socialClassLabel =
    build.socialClass ?? build.profile.socialClassResult ?? "Not set";
  const socialClassNumber = build.profile.socialClassRoll;
  const socialClassSummary =
    socialClassNumber !== undefined ? `${socialClassLabel} (${socialClassNumber})` : socialClassLabel;
  const spentSkillPoints = sheetSummary.totalSkillPointsInvested;
  const remainingSkillPoints =
    sheetSummary.draftView.primaryPoolAvailable + sheetSummary.draftView.secondaryPoolAvailable;
  const educationLevel = sheetSummary.draftView.education.theoreticalSkillCount;
  const notes = build.profile.notes ?? "";

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1180 }}>
      <div style={{ display: "grid", gap: "0.35rem" }}>
        <h1 style={{ margin: 0 }}>Character Sheet — {getCharacterName(build)}</h1>
      </div>

      <section
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))"
        }}
      >
        <section
          style={{
            background: "#fbfaf5",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            overflowX: "auto",
            padding: "1rem"
          }}
        >
          <h2 style={{ margin: "0 0 0.75rem 0" }}>Profile Stats</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Stat</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Original</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Current</th>
                <th style={{ padding: "0.5rem 0", textAlign: "right" }}>GM</th>
              </tr>
            </thead>
            <tbody>
              {profileStatRows.map((row) => (
                <tr key={row.stat} style={{ borderBottom: "1px solid #eee8dc" }}>
                  <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>{row.label}</td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{row.originalValue}</td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{row.currentValue}</td>
                  <td style={{ padding: "0.6rem 0", textAlign: "right" }}>{row.gmValue}</td>
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
                <td style={{ padding: "0.6rem 0", textAlign: "right" }}>—</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem"
          }}
        >
          <h2 style={{ margin: "0 0 0.75rem 0" }}>Summary</h2>
          <div
            style={{
              alignItems: "start",
              columnGap: "1rem",
              display: "grid",
              gridTemplateColumns: "minmax(120px, auto) minmax(0, 1fr)",
              rowGap: "0.6rem"
            }}
          >
            <strong>Character name</strong>
            <input
              id="character-sheet-name"
              onChange={(event) =>
                setBuild((current) => (current ? setCharacterName(current, event.target.value) : current))
              }
              style={{ fontSize: "1rem", padding: "0.55rem" }}
              type="text"
              value={build.name}
            />

            <strong>Title</strong>
            <input
              id="character-sheet-title"
              onChange={(event) =>
                setBuild((current) => (current ? setCharacterTitle(current, event.target.value) : current))
              }
              style={{ fontSize: "1rem", padding: "0.55rem" }}
              type="text"
              value={build.profile.title ?? ""}
            />

            <strong>Age</strong>
            <input
              id="character-sheet-age"
              onChange={(event) =>
                setBuild((current) => (current ? setCharacterAge(current, event.target.value) : current))
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
                        event.target.value as "" | "male" | "female" | "other"
                      )
                    : current
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

            <strong>Skill points</strong>
            <div>
              {spentSkillPoints} spent / {remainingSkillPoints} remaining
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
              marginTop: "1rem"
            }}
          >
            <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
              Personal information is edited and saved here on the Character Sheet.
            </div>
            <button disabled={savingIdentity} onClick={() => void handleSaveIdentity()} type="button">
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
          padding: "1rem"
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
                    padding: "0.75rem 1rem"
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
                    padding: "0.75rem 1rem"
                  }}
                >
                  <strong>Skill</strong>
                  <strong>Stats</strong>
                  <strong>Avg stats</strong>
                  <strong>Skill group XP</strong>
                  <strong>Owned XP</strong>
                  <strong>Derived XP</strong>
                  <strong>Total XP</strong>
                  <strong>Total skill level</strong>
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
                      padding: "0.75rem 1rem"
                    }}
                  >
                    <div>
                      <div>{skill.skillName}</div>
                      {skill.derivedSourceLabel ? (
                        <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                          {skill.derivedSourceLabel}
                        </div>
                      ) : null}
                    </div>
                    <div>{skill.stats}</div>
                    <div>{skill.avgStats}</div>
                    <div>{skill.skillGroupXp}</div>
                    <div>{skill.skillXp}</div>
                    <div>{skill.derivedXp}</div>
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
          padding: "1rem"
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
                  gridTemplateColumns: "minmax(180px, 2fr) minmax(140px, 1.5fr) repeat(3, minmax(72px, 88px))",
                  padding: "0.75rem 1rem"
                }}
              >
                <strong>Specialization</strong>
                <strong>Parent skill</strong>
                <strong>Owned XP</strong>
                <strong>Derived XP</strong>
                <strong>Total</strong>
              </div>

              {specializationRows.map((specialization) => (
                <div
                  key={specialization.specializationId}
                  style={{
                    borderTop: "1px solid #f0eadf",
                    display: "grid",
                    gap: "0.75rem",
                    gridTemplateColumns: "minmax(180px, 2fr) minmax(140px, 1.5fr) repeat(3, minmax(72px, 88px))",
                    padding: "0.75rem 1rem"
                  }}
                >
                  <div>
                    <div>{specialization.specializationName}</div>
                    {specialization.derivedSourceLabel ? (
                      <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                        {specialization.derivedSourceLabel}
                      </div>
                    ) : null}
                  </div>
                  <div>{specialization.parentSkillName}</div>
                  <div>{specialization.xp}</div>
                  <div>{specialization.derivedXp}</div>
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
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Notes</h2>
        <textarea
          onChange={(event) =>
            setBuild((current) => (current ? setCharacterNotes(current, event.target.value) : current))
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
            resize: "vertical"
          }}
          value={notes}
        />
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", justifyContent: "space-between" }}>
          <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
            Character notes stay separate from inventory notes.
          </div>
          <button disabled={savingNotes} onClick={() => void handleSaveNotes()} type="button">
            {savingNotes ? "Saving..." : "Save notes"}
          </button>
        </div>
      </section>

      {feedback ? (
        <div style={{ border: "1px solid #d9ddd8", borderRadius: 12, padding: "1rem" }}>{feedback}</div>
      ) : null}
    </section>
  );
}
