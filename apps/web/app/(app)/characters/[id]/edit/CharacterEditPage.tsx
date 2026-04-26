"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  glantriCharacteristicLabels,
  glantriCharacteristicOrder,
  type CharacterBuild,
  type GlantriCharacteristicKey
} from "@glantri/domain";

import { updateServerCharacter } from "../../../../../src/lib/api/localServiceClient";
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
    if (!sheetSummary) {
      return [];
    }

    return buildCharacterEditSpecializationRows({
      content,
      sheetSummary
    });
  }, [content, sheetSummary]);

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
      current ? setCharacterSkillGroupLevel(current, groupId, parseWholeNumber(value)) : current
    );
  }

  function handleAddSkillGroup() {
    if (!build || !selectedSkillGroupId) {
      return;
    }

    setBuild(addCharacterSkillGroup(build, selectedSkillGroupId));
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
      current ? setCharacterSkillXp(current, definition, parseWholeNumber(value)) : current
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
            GM-only editing for stats, skill groups, and skill XP. Totals update from the live
            sheet summary as you edit.
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
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Derived XP</th>
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
                      {skill.derivedSourceLabel ? (
                        <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                          {skill.derivedSourceLabel}
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
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{skill.derivedXp}</td>
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
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Derived XP</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {specializationRows.length > 0 ? (
                specializationRows.map((specialization) => (
                  <tr key={specialization.specializationId} style={{ borderBottom: "1px solid #eee8dc" }}>
                    <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>
                      <div>{specialization.specializationName}</div>
                      {specialization.derivedSourceLabel ? (
                        <div style={{ color: "#5e5a50", fontSize: "0.82rem" }}>
                          {specialization.derivedSourceLabel}
                        </div>
                      ) : null}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{specialization.parentSkillName}</td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{specialization.xp}</td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{specialization.derivedXp}</td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{specialization.total}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: "0.75rem 0" }}>
                    No specialization rows yet.
                  </td>
                </tr>
              )}
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
