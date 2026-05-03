"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  glantriCharacteristicLabels,
  glantriCharacteristicOrder,
  type CharacterBuild,
  type GlantriCharacteristicKey,
  type ProgressionTargetType
} from "@glantri/domain";
import {
  addCharacterProgressionCheck,
  approveCharacterProgressionCheck,
  buildCharacterProgressionView,
  grantCharacterProgressionPoints,
  removeCharacterProgressionCheck
} from "@glantri/rules-engine";

import { updateServerCharacter } from "../../../../../src/lib/api/localServiceClient";
import { useHasAnyRole } from "../../../../../src/lib/auth/SessionUserContext";
import { getPlayerFacingSkillBucket, groupRowsBySkillType } from "../../../../../src/lib/chargen/chargenBrowse";
import {
  addCharacterSkillGroup,
  buildAvailableCharacterEditSkillGroups,
  buildCharacterEditSkillGroupRows,
  buildCharacterEditSkillRows,
  buildCharacterEditSpecializationRows,
  addCharacterSkill,
  buildCharacterEditStatRows,
  getCharacterEditSheetSummary,
  removeCharacterSkill,
  setCharacterDistractionLevel,
  setCharacterCurrentStatValue,
  setCharacterOriginalStatValue,
  setCharacterSpecializationXp,
  setCharacterSkillGroupLevel,
  setCharacterSkillXp
} from "../../../../../src/lib/characters/characterEdit";
import { loadServerCharacterEditContext } from "../../../../../src/lib/characters/loadServerCharacterEditContext";
import type { LocalCharacterRecord } from "../../../../../src/lib/offline/glantriDexie";
import { LocalCharacterRepository } from "../../../../../src/lib/offline/repositories/localCharacterRepository";

interface CharacterEditPageProps {
  id: string;
}

const localCharacterRepository = new LocalCharacterRepository();
const numericInputStyle = {
  fontSize: "1rem",
  padding: "0.45rem",
  textAlign: "right" as const,
  width: 80
};

function getCharacterName(record: LocalCharacterRecord): string {
  return record.build.name.trim() || "Unnamed Character";
}

function parseWholeNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function CharacterEditPage({ id }: CharacterEditPageProps) {
  const [build, setBuild] = useState<CharacterBuild>();
  const [content, setContent] = useState<
    Awaited<ReturnType<typeof loadServerCharacterEditContext>>["content"] | undefined
  >();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<LocalCharacterRecord>();
  const [saving, setSaving] = useState(false);
  const [selectedSkillGroupId, setSelectedSkillGroupId] = useState("");
  const [selectedSkillId, setSelectedSkillId] = useState("");
  const [selectedProvisionalSkillId, setSelectedProvisionalSkillId] = useState("");
  const [pointsToGrant, setPointsToGrant] = useState("0");
  const isGameMaster = useHasAnyRole(["game_master", "admin"]);

  useEffect(() => {
    let cancelled = false;

    loadServerCharacterEditContext(id)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setContent(result.content);
        setRecord(result.localRecord);
        setBuild(result.serverRecord.build);
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

  const sheetSummary = useMemo(() => {
    if (!build || !content) {
      return undefined;
    }

    return getCharacterEditSheetSummary(build, content);
  }, [build, content]);

  const statRows = useMemo(() => {
    if (!build || !sheetSummary) {
      return [];
    }

    return buildCharacterEditStatRows(
      build,
      sheetSummary,
      glantriCharacteristicLabels,
      glantriCharacteristicOrder
    );
  }, [build, sheetSummary]);

  const skillGroupRows = useMemo(() => {
    if (!content || !sheetSummary) {
      return [];
    }

    return buildCharacterEditSkillGroupRows({
      content,
      sheetSummary
    });
  }, [content, sheetSummary]);

  const availableSkillGroups = useMemo(() => {
    if (!content || !sheetSummary) {
      return [];
    }

    return buildAvailableCharacterEditSkillGroups({
      content,
      sheetSummary
    });
  }, [content, sheetSummary]);

  const skillRows = useMemo(() => {
    if (!build || !content || !sheetSummary) {
      return [];
    }

    return buildCharacterEditSkillRows({
      build,
      content,
      sheetSummary
    });
  }, [build, content, sheetSummary]);
  const groupedSkillRows = useMemo(() => {
    if (!content) {
      return [];
    }

    return groupRowsBySkillType(
      skillRows.map((row) => {
        const skill = content.skills.find((item) => item.id === row.skillId);

        return {
          ...row,
          skillType: skill ? getPlayerFacingSkillBucket(skill) : "special-access"
        };
      })
    );
  }, [content, skillRows]);
  const specializationRows = useMemo(() => {
    if (!build || !content || !sheetSummary) {
      return [];
    }

    return buildCharacterEditSpecializationRows({
      build,
      content,
      sheetSummary
    });
  }, [build, content, sheetSummary]);
  const progressionView = useMemo(() => {
    if (!build || !content) {
      return undefined;
    }

    return buildCharacterProgressionView({
      build,
      content
    });
  }, [build, content]);

  const availableSkills = useMemo(() => {
    if (!build || !content) {
      return [];
    }

    const existingSkillIds = new Set(build.progression.skills.map((skill) => skill.skillId));

    return [...content.skills]
      .filter((skill) => !existingSkillIds.has(skill.id))
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  }, [build, content]);
  const provisionalProgressionRows = useMemo(
    () => progressionView?.rows.filter((row) => row.provisional) ?? [],
    [progressionView]
  );

  async function handleSave() {
    if (!build || !record) {
      return;
    }

    setSaving(true);

    try {
      const savedServerRecord = await updateServerCharacter({
        build,
        characterId: id
      });
      const savedLocalRecord = await localCharacterRepository.save({
        build: savedServerRecord.build,
        creatorId: savedServerRecord.ownerId ?? record.creatorId,
        createdAt: record.createdAt,
        finalizedAt: record.finalizedAt,
        syncStatus: "synced",
        updatedAt: savedServerRecord.updatedAt
      });

      setRecord(savedLocalRecord);
      setBuild(savedServerRecord.build);
      setFeedback("Character edits saved to the server.");
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : "Unable to save character edits to the server."
      );
    } finally {
      setSaving(false);
    }
  }

  function updateOriginalStat(stat: GlantriCharacteristicKey, value: string) {
    setBuild((current) =>
      current ? setCharacterOriginalStatValue(current, stat, parseWholeNumber(value)) : current
    );
  }

  function updateCurrentStat(stat: GlantriCharacteristicKey, value: string) {
    setBuild((current) =>
      current ? setCharacterCurrentStatValue(current, stat, parseWholeNumber(value)) : current
    );
  }

  function updateDistraction(value: string) {
    setBuild((current) =>
      current ? setCharacterDistractionLevel(current, parseWholeNumber(value)) : current
    );
  }

  function updateSkillGroup(groupId: string, value: string) {
    setBuild((current) =>
      current && content
        ? setCharacterSkillGroupLevel({
            build: current,
            content,
            groupId,
            level: parseWholeNumber(value)
          })
        : current
    );
  }

  function handleAddSkillGroup() {
    if (!build || !content || !selectedSkillGroupId) {
      return;
    }

    setBuild(addCharacterSkillGroup({ build, content, groupId: selectedSkillGroupId }));
    setSelectedSkillGroupId("");
  }

  function updateSkill(skillId: string, value: string) {
    if (!content) {
      return;
    }

    const definition = content.skills.find((skill) => skill.id === skillId);

    if (!definition) {
      return;
    }

    setBuild((current) =>
      current && content
        ? setCharacterSkillXp({
            build: current,
            content,
            skill: definition,
            xp: parseWholeNumber(value)
          })
        : current
    );
  }

  function handleAddSkill() {
    if (!build || !content || !selectedSkillId) {
      return;
    }

    const definition = content.skills.find((skill) => skill.id === selectedSkillId);

    if (!definition) {
      return;
    }

    setBuild(addCharacterSkill(build, definition));
    setSelectedSkillId("");
  }

  function handleRemoveSkill(skillId: string) {
    setBuild((current) => (current ? removeCharacterSkill(current, skillId) : current));
  }

  function handleGrantProgressionPoints() {
    const amount = parseWholeNumber(pointsToGrant);

    if (amount <= 0) {
      setFeedback("Progression point grant must be a positive whole number.");
      return;
    }

    setBuild((current) => current ? grantCharacterProgressionPoints({ amount, build: current }) : current);
    setPointsToGrant("0");
    setFeedback(`Granted ${amount} progression point${amount === 1 ? "" : "s"}.`);
  }

  function toggleProgressionCheck(input: {
    approved: boolean;
    provisional?: boolean;
    targetId: string;
    targetType: ProgressionTargetType;
  }) {
    if (!content) {
      return;
    }

    setBuild((current) => {
      if (!current) {
        return current;
      }

      return input.approved
        ? removeCharacterProgressionCheck({
            build: current,
            targetId: input.targetId,
            targetType: input.targetType
          })
        : approveCharacterProgressionCheck({
            build: current,
            content,
            provisional: input.provisional,
            targetId: input.targetId,
            targetType: input.targetType
          });
    });
  }

  function getProgressionRow(targetType: ProgressionTargetType, targetId: string) {
    return progressionView?.rows.find((row) => row.targetType === targetType && row.targetId === targetId);
  }

  function renderProgressionCheckControls(input: {
    label?: string;
    provisional?: boolean;
    targetId: string;
    targetType: ProgressionTargetType;
  }) {
    if (!isGameMaster || !progressionView) {
      return null;
    }

    const row = getProgressionRow(input.targetType, input.targetId);
    const approved = Boolean(row?.approved);

    return (
      <div style={{ color: "#5e5a50", display: "grid", fontSize: "0.82rem", gap: "0.25rem" }}>
        <span>Requested: {row?.requested ? "Requested" : "—"}</span>
        <label style={{ alignItems: "center", display: "inline-flex", gap: "0.25rem" }}>
          <input
            checked={approved}
            onChange={() =>
              toggleProgressionCheck({
                approved,
                provisional: input.provisional,
                targetId: input.targetId,
                targetType: input.targetType
              })
            }
            type="checkbox"
          />
          Approved
        </label>
      </div>
    );
  }

  function handleAddProvisionalSkillCheck() {
    if (!content || !selectedProvisionalSkillId) {
      return;
    }

    setBuild((current) =>
      current
        ? addCharacterProgressionCheck({
            build: current,
            content,
            provisional: true,
            targetId: selectedProvisionalSkillId,
            targetType: "skill"
          })
        : current
    );
    setSelectedProvisionalSkillId("");
  }

  function adjustSpecialization(specializationId: string, delta: number) {
    if (!content) {
      return;
    }

    const definition = content.specializations.find(
      (specialization) => specialization.id === specializationId
    );
    const currentRow = specializationRows.find(
      (specialization) => specialization.specializationId === specializationId
    );

    if (!definition || !currentRow) {
      return;
    }

    setBuild((current) => {
      if (!current) {
        return current;
      }

      const result = setCharacterSpecializationXp({
        build: current,
        content,
        specialization: definition,
        xp: currentRow.xp + delta
      });

      if (result.error) {
        setFeedback(result.error);
        return current;
      }

      setFeedback(
        delta > 0
          ? `Added 1 direct XP to ${definition.name}.`
          : `Removed 1 direct XP from ${definition.name}.`
      );
      return result.build;
    });
  }

  if (loading) {
    return <section>Loading character editor...</section>;
  }

  if (!record || !build || !content || !sheetSummary) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Character not found</h1>
        <Link href="/characters">Characters</Link>
      </section>
    );
  }

  const profession = content.professions.find((item) => item.id === build.professionId);
  const professionFamilyName = profession?.familyId
    ? content.professionFamilies.find((family) => family.id === profession.familyId)?.name
    : undefined;
  const socialClassLabel = build.socialClass ?? build.profile.socialClassResult ?? "Not set";
  const socialClassNumber = build.profile.socialClassRoll;
  const socialClassSummary =
    socialClassNumber !== undefined ? `${socialClassLabel} (${socialClassNumber})` : socialClassLabel;
  const educationLevel = sheetSummary.draftView.education.theoreticalSkillCount;

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1180 }}>
      <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0 }}>Character Edit — {getCharacterName(record)}</h1>
          <p style={{ margin: "0.5rem 0 0 0" }}>
            GM-only editing for stats, skill groups, skill XP, and specialization XP. Totals update
            from the live sheet summary as you edit.
          </p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <Link href={`/characters/${id}`}>Back to character sheet</Link>
          <button disabled={saving} onClick={() => void handleSave()} type="button">
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
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
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            order: 1,
            padding: "1rem"
          }}
        >
          <h2 style={{ margin: "0 0 0.75rem 0" }}>Summary</h2>
          <div
            style={{
              alignItems: "start",
              color: "#5e5a50",
              columnGap: "1rem",
              display: "grid",
              gridTemplateColumns: "minmax(120px, auto) minmax(0, 1fr)",
              rowGap: "0.55rem"
            }}
          >
            <strong>Name</strong>
            <div>{build.name.trim() || "Unnamed Character"}</div>
            <strong>Title</strong>
            <div>{build.profile.title?.trim() || "—"}</div>
            <strong>Society</strong>
            <div>{sheetSummary.societyLabel ?? "Not set"}</div>
            <strong>Social class</strong>
            <div>{socialClassSummary}</div>
            <strong>Profession</strong>
            <div>
              {sheetSummary.professionName ?? build.professionId ?? "Not set"}
              {professionFamilyName ? `, ${professionFamilyName}` : ""}
            </div>
            <strong>Current skill points</strong>
            <div>{sheetSummary.skillPoints.current}</div>
            <strong>Education</strong>
            <div>{educationLevel}</div>
          </div>
          <p style={{ color: "#5e5a50", fontSize: "0.9rem", margin: "0.9rem 0 0 0" }}>
            Personal information is edited on the Character Sheet. GM progression controls are
            integrated into the rows below.
          </p>
          {progressionView ? (
            <div
              style={{
                borderTop: "1px solid #e7e2d7",
                display: "grid",
                gap: "0.75rem",
                marginTop: "0.9rem",
                paddingTop: "0.9rem"
              }}
            >
              {isGameMaster ? (
                <>
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                    <strong>Available progression points: {progressionView.availablePoints}</strong>
                    <label style={{ display: "grid", gap: "0.2rem" }}>
                      <span style={{ color: "#5e5a50", fontSize: "0.82rem" }}>Points to add</span>
                      <input
                        min="0"
                        onChange={(event) => setPointsToGrant(event.target.value)}
                        style={numericInputStyle}
                        type="number"
                        value={pointsToGrant}
                      />
                    </label>
                    <button onClick={handleGrantProgressionPoints} type="button">
                      Grant points
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <select
                      onChange={(event) => setSelectedProvisionalSkillId(event.target.value)}
                      style={{ fontSize: "1rem", padding: "0.45rem" }}
                      value={selectedProvisionalSkillId}
                    >
                      <option value="">Add provisional checked skill...</option>
                      {availableSkills.map((skill) => (
                        <option key={skill.id} value={skill.id}>
                          {skill.name}
                        </option>
                      ))}
                    </select>
                    <button disabled={!selectedProvisionalSkillId} onClick={handleAddProvisionalSkillCheck} type="button">
                      Add provisional check
                    </button>
                  </div>
                </>
              ) : null}

              <div style={{ borderTop: "1px solid #e7e2d7", display: "grid", gap: "0.75rem", paddingTop: "0.75rem" }}>
                <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.5rem", justifyContent: "space-between" }}>
                  <h3 style={{ margin: 0 }}>Skill groups</h3>
                  {isGameMaster ? (
                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <select
                      onChange={(event) => setSelectedSkillGroupId(event.target.value)}
                      style={{ fontSize: "1rem", padding: "0.45rem" }}
                      value={selectedSkillGroupId}
                    >
                      <option value="">Add skill group...</option>
                      {availableSkillGroups.map((group) => (
                        <option key={group.groupId} value={group.groupId}>
                          {group.name}
                        </option>
                      ))}
                    </select>
                    <button disabled={!selectedSkillGroupId} onClick={handleAddSkillGroup} type="button">
                      Add group
                    </button>
                    </div>
                  ) : null}
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ borderCollapse: "collapse", minWidth: 520, width: "100%" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                        <th style={{ padding: "0.4rem 0.5rem 0.4rem 0" }}>Group</th>
                        <th style={{ padding: "0.4rem 0.5rem", textAlign: "right" }}>Level</th>
                        <th style={{ padding: "0.4rem 0" }}>Progression</th>
                      </tr>
                    </thead>
                    <tbody>
                      {skillGroupRows.length > 0 ? (
                        skillGroupRows.map((group) => (
                          <tr key={group.groupId} style={{ borderBottom: "1px solid #eee8dc" }}>
                            <td style={{ padding: "0.55rem 0.5rem 0.55rem 0" }}>{group.name}</td>
                            <td style={{ padding: "0.55rem 0.5rem", textAlign: "right" }}>
                              <input
                                onChange={(event) => updateSkillGroup(group.groupId, event.target.value)}
                                style={numericInputStyle}
                                type="number"
                                value={group.level}
                              />
                            </td>
                            <td style={{ padding: "0.55rem 0" }}>
                              {renderProgressionCheckControls({
                                targetId: group.groupId,
                                targetType: "skillGroup"
                              })}
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} style={{ padding: "0.75rem 0" }}>
                            No skill groups recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section
          style={{
            background: "#fbfaf5",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            order: 0,
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
                {isGameMaster ? <th style={{ padding: "0.5rem 0 0.5rem 0.75rem" }}>Progression</th> : null}
              </tr>
            </thead>
            <tbody>
              {statRows.map((row) => (
                <tr key={row.stat} style={{ borderBottom: "1px solid #eee8dc" }}>
                  <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>{row.label}</td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                    <input
                      onChange={(event) =>
                        row.stat === "distraction"
                          ? updateDistraction(event.target.value)
                          : updateOriginalStat(row.stat, event.target.value)
                      }
                      style={numericInputStyle}
                      type="number"
                      value={row.originalValue}
                    />
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                    {row.isDirectEdit ? (
                      row.currentValue
                    ) : (
                      <input
                        onChange={(event) => {
                          if (row.stat !== "distraction") {
                            updateCurrentStat(row.stat, event.target.value);
                          }
                        }}
                        style={numericInputStyle}
                        type="number"
                        value={row.currentValue}
                      />
                    )}
                  </td>
                  <td style={{ padding: "0.6rem 0", textAlign: "right" }}>{row.gmValue}</td>
                  {isGameMaster ? (
                    <td style={{ padding: "0.6rem 0 0.6rem 0.75rem" }}>
                      {row.stat === "distraction"
                        ? "—"
                        : renderProgressionCheckControls({
                            targetId: row.stat,
                            targetType: "stat"
                          })}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
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
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Skills</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
            <select
              onChange={(event) => setSelectedSkillId(event.target.value)}
              style={{ fontSize: "1rem", padding: "0.45rem" }}
              value={selectedSkillId}
            >
              <option value="">Add skill...</option>
              {availableSkills.map((skill) => (
                <option key={skill.id} value={skill.id}>
                  {skill.name}
                </option>
              ))}
            </select>
            <button disabled={!selectedSkillId} onClick={handleAddSkill} type="button">
              Add skill
            </button>
          </div>
        </div>

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
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                      <th style={{ padding: "0.5rem 0.75rem 0.5rem 1rem" }}>Skill</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Stats</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Group XP</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Skill XP</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Granted XP</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Total XP</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Total</th>
                      <th style={{ padding: "0.5rem 0", textAlign: "right" }}>Remove</th>
                      {isGameMaster ? <th style={{ padding: "0.5rem 1rem 0.5rem 0.75rem" }}>Progression</th> : null}
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((skill) => (
                      <tr key={skill.skillKey} style={{ borderBottom: "1px solid #eee8dc" }}>
                        <td style={{ padding: "0.6rem 0.75rem 0.6rem 1rem" }}>
                          <div>{skill.skillName}</div>
                          {skill.grantedSourceLabel ? (
                            <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                              {skill.grantedSourceLabel}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{skill.stats}</td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{skill.groupXp}</td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                          <input
                            onChange={(event) => updateSkill(skill.skillId, event.target.value)}
                            style={numericInputStyle}
                            type="number"
                            value={skill.xp}
                          />
                        </td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{skill.grantedXp}</td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{skill.totalXp}</td>
                        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{skill.total}</td>
                        <td style={{ padding: "0.6rem 0", textAlign: "right" }}>
                          <button
                            disabled={!skill.canRemoveDirectXp}
                            onClick={() => handleRemoveSkill(skill.skillId)}
                            type="button"
                          >
                            Remove
                          </button>
                        </td>
                        {isGameMaster ? (
                          <td style={{ padding: "0.6rem 1rem 0.6rem 0.75rem" }}>
                            {renderProgressionCheckControls({
                              targetId: skill.skillId,
                              targetType: "skill"
                            })}
                          </td>
                        ) : null}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        ) : (
          <div>No skill rows yet.</div>
        )}

        {isGameMaster && provisionalProgressionRows.length > 0 ? (
          <section style={{ border: "1px solid #e7e2d7", borderRadius: 10, display: "grid", gap: "0.5rem", padding: "1rem" }}>
            <h3 style={{ margin: 0 }}>Provisional skill checks</h3>
            {provisionalProgressionRows.map((row) => (
              <div
                key={`${row.targetType}:${row.targetId}`}
                style={{
                  alignItems: "center",
                  borderTop: "1px solid #e7e2d7",
                  display: "flex",
                  gap: "1rem",
                  justifyContent: "space-between",
                  paddingTop: "0.5rem"
                }}
              >
                <div>
                  <strong>{row.label}</strong>
                  <div style={{ color: "#8f5a00", fontSize: "0.82rem" }}>Provisional skill</div>
                </div>
                {renderProgressionCheckControls({
                  provisional: true,
                  targetId: row.targetId,
                  targetType: row.targetType
                })}
              </div>
            ))}
          </section>
        ) : null}
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
        <div style={{ display: "flex", gap: "0.75rem", justifyContent: "space-between", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0 }}>Specializations</h2>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Specialization</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Parent skill</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Owned XP</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Granted XP</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Total</th>
                <th style={{ padding: "0.5rem 0", textAlign: "right" }}>Adjust</th>
                {isGameMaster ? <th style={{ padding: "0.5rem 0 0.5rem 0.75rem" }}>Progression</th> : null}
              </tr>
            </thead>
            <tbody>
              {specializationRows.length > 0 ? (
                specializationRows.map((specialization) => (
                  <tr key={specialization.specializationId} style={{ borderBottom: "1px solid #eee8dc" }}>
                    <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>
                      <div>{specialization.specializationName}</div>
                      {specialization.grantedSourceLabel ? (
                        <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                          {specialization.grantedSourceLabel}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      <div>{specialization.parentSkillName}</div>
                      <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                        Requires level {specialization.requiredParentLevel}
                      </div>
                      <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                        Current parent level {specialization.parentSkillXp}
                      </div>
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{specialization.xp}</td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{specialization.grantedXp}</td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{specialization.total}</td>
                    <td style={{ padding: "0.6rem 0", textAlign: "right" }}>
                      <div
                        style={{
                          alignItems: "center",
                          display: "inline-flex",
                          gap: "0.4rem",
                          justifyContent: "flex-end"
                        }}
                      >
                        <button
                          disabled={!specialization.canIncreaseDirectXp}
                          onClick={() => adjustSpecialization(specialization.specializationId, 1)}
                          type="button"
                        >
                          +
                        </button>
                        <button
                          disabled={!specialization.canDecreaseDirectXp}
                          onClick={() => adjustSpecialization(specialization.specializationId, -1)}
                          type="button"
                        >
                          -
                        </button>
                      </div>
                    </td>
                    {isGameMaster ? (
                      <td style={{ padding: "0.6rem 0 0.6rem 0.75rem" }}>
                        {renderProgressionCheckControls({
                          targetId: specialization.specializationId,
                          targetType: "specialization"
                        })}
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isGameMaster ? 7 : 6} style={{ padding: "0.75rem 0" }}>
                    No specialization rows yet.
                  </td>
                </tr>
              )}
              {specializationRows.length > 0
                ? specializationRows
                    .filter((specialization) => specialization.blockingMessage)
                    .map((specialization) => (
                      <tr key={`${specialization.specializationId}-status`}>
                        <td colSpan={isGameMaster ? 7 : 6} style={{ color: "#8f5a00", fontSize: "0.85rem", padding: "0 0 0.75rem 0" }}>
                          {specialization.specializationName}: {specialization.blockingMessage}
                        </td>
                      </tr>
                    ))
                : null}
            </tbody>
          </table>
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
        <h2 style={{ margin: 0 }}>Notes</h2>
        <div
          style={{
            background: "#fffdf8",
            border: "1px solid #e7e2d7",
            borderRadius: 10,
            color: "#5e5a50",
            minHeight: 320,
            overflow: "auto",
            padding: "0.9rem",
            whiteSpace: "pre-wrap"
          }}
        >
          {build.profile.notes?.trim() || "No character notes recorded."}
        </div>
        <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
          Notes are edited on the Character Sheet so players have one clear save surface.
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
