"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  glantriCharacteristicLabels,
  glantriCharacteristicOrder,
  type CharacterBuild,
  type GlantriCharacteristicKey
} from "@glantri/domain";

import { loadLocalCharacterContext } from "../../../../../src/lib/characters/loadLocalCharacterContext";
import {
  addCharacterSkill,
  buildCharacterEditStatRows,
  getCharacterEditSheetSummary,
  removeCharacterSkill,
  setCharacterCurrentStatValue,
  setCharacterOriginalStatValue,
  setCharacterSkillGroupLevel,
  setCharacterSkillXp
} from "../../../../../src/lib/characters/characterEdit";
import type { LocalCharacterRecord } from "../../../../../src/lib/offline/glantriDexie";
import { LocalCharacterRepository } from "../../../../../src/lib/offline/repositories/localCharacterRepository";

interface CharacterEditPageProps {
  id: string;
}

interface EditableSkillGroupRow {
  groupId: string;
  level: number;
  name: string;
}

interface EditableSkillRow {
  skillId: string;
  skillName: string;
  stats: number;
  total: number;
  xp: number;
}

const localCharacterRepository = new LocalCharacterRepository();

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
    Awaited<ReturnType<typeof loadLocalCharacterContext>>["content"] | undefined
  >();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<LocalCharacterRecord>();
  const [saving, setSaving] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState("");

  useEffect(() => {
    let cancelled = false;

    loadLocalCharacterContext(id)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setContent(result.content);
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

  const skillGroupRows = useMemo<EditableSkillGroupRow[]>(() => {
    if (!content || !sheetSummary) {
      return [];
    }

    const groupLevels = new Map(
      sheetSummary.draftView.groups.map((group) => [group.groupId, group.groupLevel] as const)
    );

    return [...content.skillGroups]
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name))
      .map((group) => ({
        groupId: group.id,
        level: groupLevels.get(group.id) ?? 0,
        name: group.name
      }));
  }, [content, sheetSummary]);

  const skillRows = useMemo<EditableSkillRow[]>(() => {
    if (!build || !content || !sheetSummary) {
      return [];
    }

    return build.progression.skills
      .map((entry) => {
        const definition = content.skills.find((skill) => skill.id === entry.skillId);
        const skillView = sheetSummary.draftView.skills.find((skill) => skill.skillId === entry.skillId);

        if (!definition || !skillView) {
          return null;
        }

        return {
          skillId: definition.id,
          skillName: definition.name,
          stats: skillView.linkedStatAverage,
          total: skillView.totalSkill,
          xp: skillView.specificSkillLevel
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null)
      .sort((left, right) => left.skillName.localeCompare(right.skillName));
  }, [build, content, sheetSummary]);

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
      const saved = await localCharacterRepository.save({
        build,
        createdAt: record.createdAt,
        finalizedAt: record.finalizedAt,
        syncStatus: "local"
      });

      setRecord(saved);
      setBuild(saved.build);
      setFeedback("Character edits saved locally.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to save character edits.");
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

  function updateSkillGroup(groupId: string, value: string) {
    setBuild((current) =>
      current ? setCharacterSkillGroupLevel(current, groupId, parseWholeNumber(value)) : current
    );
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
                      onChange={(event) => updateOriginalStat(row.stat, event.target.value)}
                      style={{ padding: "0.35rem", textAlign: "right", width: 72 }}
                      type="number"
                      value={row.originalValue}
                    />
                  </td>
                  <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                    <input
                      onChange={(event) => updateCurrentStat(row.stat, event.target.value)}
                      style={{ padding: "0.35rem", textAlign: "right", width: 72 }}
                      type="number"
                      value={row.currentValue}
                    />
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
                  style={{ padding: "0.35rem", textAlign: "right", width: 72 }}
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
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>XP</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Total</th>
                <th style={{ padding: "0.5rem 0", textAlign: "right" }}>Remove</th>
              </tr>
            </thead>
            <tbody>
              {skillRows.length > 0 ? (
                skillRows.map((skill) => (
                  <tr key={skill.skillId} style={{ borderBottom: "1px solid #eee8dc" }}>
                    <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>{skill.skillName}</td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{skill.stats}</td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                      <input
                        onChange={(event) => updateSkill(skill.skillId, event.target.value)}
                        style={{ padding: "0.35rem", textAlign: "right", width: 72 }}
                        type="number"
                        value={skill.xp}
                      />
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{skill.total}</td>
                    <td style={{ padding: "0.6rem 0", textAlign: "right" }}>
                      <button onClick={() => handleRemoveSkill(skill.skillId)} type="button">
                        Remove
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ padding: "0.75rem 0" }}>
                    No progression skill rows yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
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
