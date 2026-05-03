"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  glantriCharacteristicLabels,
  glantriCharacteristicOrder,
  type CharacterBuild,
  type GlantriCharacteristicKey
} from "@glantri/domain";
import {
  addCharacterProgressionCheck,
  buildCharacterProgressionView,
  grantCharacterProgressionPoints,
  removeCharacterProgressionCheck
} from "@glantri/rules-engine";

import { updateServerCharacter } from "../../../../../src/lib/api/localServiceClient";
import { useHasAnyRole } from "../../../../../src/lib/auth/SessionUserContext";
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
    checked: boolean;
    provisional?: boolean;
    targetId: string;
    targetType: "stat" | "skill" | "skillGroup" | "specialization";
  }) {
    if (!content) {
      return;
    }

    setBuild((current) => {
      if (!current) {
        return current;
      }

      return input.checked
        ? removeCharacterProgressionCheck({
            build: current,
            targetId: input.targetId,
            targetType: input.targetType
          })
        : addCharacterProgressionCheck({
            build: current,
            content,
            provisional: input.provisional,
            targetId: input.targetId,
            targetType: input.targetType
          });
    });
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
            padding: "1rem"
          }}
        >
          <h2 style={{ margin: "0 0 0.75rem 0" }}>Identity</h2>
          <div style={{ color: "#5e5a50", display: "grid", gap: "0.6rem" }}>
            <div>
              <strong>Name:</strong> {build.name.trim() || "Unnamed Character"}
            </div>
            <div>
              <strong>Title:</strong> {build.profile.title?.trim() || "—"}
            </div>
            <div>
              <strong>Age:</strong> {build.profile.age?.trim() || "—"}
            </div>
            <div>
              <strong>Gender:</strong> {build.profile.gender ?? "---"}
            </div>
            <div style={{ fontSize: "0.9rem" }}>
              Personal information is edited on the Character Sheet, not in this GM progression editor.
            </div>
          </div>
        </section>

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
                </tr>
              ))}
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
          <h2 style={{ margin: "0 0 0.75rem 0" }}>Skill Groups</h2>
          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.9rem" }}>
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
          <div
            style={{
              display: "grid",
              gap: "0.6rem",
              gridTemplateColumns: "minmax(0, 1fr) auto",
              alignItems: "center"
            }}
          >
            {skillGroupRows.map((group) => (
              <div
                key={group.groupId}
                style={{ display: "contents" }}
              >
                <div>{group.name}</div>
                <input
                  onChange={(event) => updateSkillGroup(group.groupId, event.target.value)}
                  style={numericInputStyle}
                  type="number"
                  value={group.level}
                />
              </div>
            ))}
          </div>
        </section>
      </section>

      {isGameMaster && progressionView ? (
        <section
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            display: "grid",
            gap: "1rem",
            padding: "1rem"
          }}
        >
          <div>
            <h2 style={{ margin: "0 0 0.35rem 0" }}>Progression checks and points</h2>
            <p style={{ color: "#5e5a50", margin: 0 }}>
              GM-only manual checks for later player progression. Stat checks are visible, but stat
              advancement is not enabled yet.
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
            <strong>Available progression points: {progressionView.availablePoints}</strong>
            <input
              min="0"
              onChange={(event) => setPointsToGrant(event.target.value)}
              style={numericInputStyle}
              type="number"
              value={pointsToGrant}
            />
            <button onClick={handleGrantProgressionPoints} type="button">
              Grant points
            </button>
          </div>

          <div style={{ display: "grid", gap: "0.75rem", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            <div>
              <h3 style={{ margin: "0 0 0.5rem 0" }}>Stats</h3>
              {statRows.map((row) => {
                const checked = Boolean(
                  progressionView.checks.find(
                    (check) => check.targetType === "stat" && check.targetId === row.stat
                  )
                );

                return (
                  <label key={`check-${row.stat}`} style={{ display: "block", marginBottom: "0.35rem" }}>
                    <input
                      checked={checked}
                      onChange={() =>
                        toggleProgressionCheck({
                          checked,
                          targetId: row.stat,
                          targetType: "stat"
                        })
                      }
                      type="checkbox"
                    />{" "}
                    {row.label}
                  </label>
                );
              })}
            </div>

            <div>
              <h3 style={{ margin: "0 0 0.5rem 0" }}>Skill groups</h3>
              {skillGroupRows.map((group) => {
                const checked = Boolean(
                  progressionView.checks.find(
                    (check) => check.targetType === "skillGroup" && check.targetId === group.groupId
                  )
                );

                return (
                  <label key={`check-${group.groupId}`} style={{ display: "block", marginBottom: "0.35rem" }}>
                    <input
                      checked={checked}
                      onChange={() =>
                        toggleProgressionCheck({
                          checked,
                          targetId: group.groupId,
                          targetType: "skillGroup"
                        })
                      }
                      type="checkbox"
                    />{" "}
                    {group.name}
                  </label>
                );
              })}
            </div>

            <div>
              <h3 style={{ margin: "0 0 0.5rem 0" }}>Skills</h3>
              {skillRows.map((skill) => {
                const checked = Boolean(
                  progressionView.checks.find(
                    (check) => check.targetType === "skill" && check.targetId === skill.skillId
                  )
                );

                return (
                  <label key={`check-${skill.skillKey}`} style={{ display: "block", marginBottom: "0.35rem" }}>
                    <input
                      checked={checked}
                      onChange={() =>
                        toggleProgressionCheck({
                          checked,
                          targetId: skill.skillId,
                          targetType: "skill"
                        })
                      }
                      type="checkbox"
                    />{" "}
                    {skill.skillName}
                  </label>
                );
              })}
            </div>

            <div>
              <h3 style={{ margin: "0 0 0.5rem 0" }}>Specializations</h3>
              {specializationRows.map((specialization) => {
                const checked = Boolean(
                  progressionView.checks.find(
                    (check) =>
                      check.targetType === "specialization" &&
                      check.targetId === specialization.specializationId
                  )
                );

                return (
                  <label
                    key={`check-${specialization.specializationId}`}
                    style={{ display: "block", marginBottom: "0.35rem" }}
                  >
                    <input
                      checked={checked}
                      onChange={() =>
                        toggleProgressionCheck({
                          checked,
                          targetId: specialization.specializationId,
                          targetType: "specialization"
                        })
                      }
                      type="checkbox"
                    />{" "}
                    {specialization.specializationName}
                  </label>
                );
              })}
            </div>
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
        </section>
      ) : null}

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

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Skill</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Stats</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Group XP</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Owned XP</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Granted XP</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Total XP</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Total</th>
                <th style={{ padding: "0.5rem 0", textAlign: "right" }}>Remove</th>
              </tr>
            </thead>
            <tbody>
              {skillRows.length > 0 ? (
                skillRows.map((skill) => (
                  <tr key={skill.skillKey} style={{ borderBottom: "1px solid #eee8dc" }}>
                    <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ padding: "0.75rem 0" }}>
                    No progression skill rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "0.75rem 0" }}>
                    No specialization rows yet.
                  </td>
                </tr>
              )}
              {specializationRows.length > 0
                ? specializationRows
                    .filter((specialization) => specialization.blockingMessage)
                    .map((specialization) => (
                      <tr key={`${specialization.specializationId}-status`}>
                        <td colSpan={6} style={{ color: "#8f5a00", fontSize: "0.85rem", padding: "0 0 0.75rem 0" }}>
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
