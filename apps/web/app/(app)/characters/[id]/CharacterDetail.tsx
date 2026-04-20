"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  getCharacterSkillKey,
  getSkillGroupIds,
  glantriCharacteristicLabels,
  glantriCharacteristicOrder,
  type GlantriCharacteristicKey,
  type ProfessionDefinition,
  type SkillDefinition
} from "@glantri/domain";
import {
  buildCharacterSheetSummary
} from "../../../../../../packages/rules-engine/src/sheets/buildCharacterSheetSummary";
import { selectBestSkillGroupContribution } from "../../../../../../packages/rules-engine/src/skills/selectBestSkillGroupContribution";
import { getCharacteristicGm } from "../../../../../../packages/rules-engine/src/stats/characteristicGms";

import {
  getPlayerFacingSkillBucket,
  groupRowsBySkillType
} from "../../../../src/lib/chargen/chargenBrowse";
import { loadLocalCharacterContext } from "../../../../src/lib/characters/loadLocalCharacterContext";
import type { LocalCharacterRecord } from "../../../../src/lib/offline/glantriDexie";
import { UNNAMED_CHARACTER_PLACEHOLDER } from "../../../../src/lib/offline/repositories/localCharacterRepository";

interface CharacterDetailProps {
  id: string;
}

interface CharacterSheetSkillRow {
  avgStats: number;
  skillGroupXp: number;
  skillId: string;
  skillKey: string;
  skillName: string;
  skillType: ReturnType<typeof getPlayerFacingSkillBucket>;
  skillXp: number;
  stats: string;
  totalSkillLevel: number;
  totalXp: number;
}

function getCharacterName(record: LocalCharacterRecord): string {
  return record.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER;
}

function sortSkills(skills: SkillDefinition[]): SkillDefinition[] {
  return [...skills].sort((left, right) => left.sortOrder - right.sortOrder);
}

function formatSkillStats(skill: SkillDefinition): string {
  return [...new Set(skill.linkedStats)].map((stat) => stat.toUpperCase()).join(" / ");
}

function getSkillLinkedStatAverage(
  profile: LocalCharacterRecord["build"]["profile"],
  skill: SkillDefinition
): number {
  const total = skill.linkedStats.reduce(
    (sum, stat) => sum + (profile.rolledStats[stat as GlantriCharacteristicKey] ?? 0),
    0
  );

  return Math.floor(total / skill.linkedStats.length);
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
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<LocalCharacterRecord>();
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
    if (!record || !contentState) {
      return undefined;
    }

    return contentState.professions.find((item) => item.id === record.build.professionId);
  }, [contentState, record]);

  const sheetSummary = useMemo(() => {
    if (!record || !contentState) {
      return undefined;
    }

    return buildCharacterSheetSummary({
      build: record.build,
      content: contentState
    });
  }, [contentState, record]);

  const profileStatRows = useMemo(() => {
    if (!record || !sheetSummary) {
      return [];
    }

    return glantriCharacteristicOrder.map((stat) => {
      const originalValue = record.build.profile.rolledStats[stat];
      const currentValue = sheetSummary.adjustedStats[stat] ?? originalValue;
      const gmValue = getCharacteristicGm(stat, {
        ...record.build.profile.rolledStats,
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
  }, [record, sheetSummary]);

  const groupedSkillRows = useMemo(() => {
    if (!contentState || !sheetSummary || !record) {
      return [];
    }

    const rows = sortSkills(contentState.skills)
      .flatMap((skill) => {
        const matchingViews = sheetSummary.draftView.skills.filter((item) => item.skillId === skill.id);
        const bestContributingGroup = selectBestSkillGroupContribution(
          getSkillGroupIds(skill)
            .map((groupId) => {
              const groupView = sheetSummary.draftView.groups.find((group) => group.groupId === groupId);
              const groupDefinition = contentState.skillGroups.find((group) => group.id === groupId);

              if (!groupView || groupView.groupLevel <= 0) {
                return null;
              }

              return {
                groupId,
                groupLevel: groupView.groupLevel,
                name: groupDefinition?.name ?? groupId,
                sortOrder: groupDefinition?.sortOrder ?? Number.MAX_SAFE_INTEGER
              };
            })
            .filter((group): group is NonNullable<typeof group> => group !== null)
        );

        return matchingViews
          .map((skillView) => {
            const skillGroupXp = bestContributingGroup?.groupLevel ?? skillView.groupLevel ?? 0;
            const skillXp = skillView.specificSkillLevel ?? 0;
            const totalXp = skillGroupXp + skillXp;

            if (totalXp <= 0) {
              return null;
            }

            return {
              avgStats:
                skillView.linkedStatAverage ?? getSkillLinkedStatAverage(record.build.profile, skill),
              skillGroupXp,
              skillId: skill.id,
              skillKey: getCharacterSkillKey({
                languageName: skillView.languageName,
                skillId: skill.id
              }),
              skillName: skillView.languageName ? `${skill.name} (${skillView.languageName})` : skill.name,
              skillType: getPlayerFacingSkillBucket(skill),
              skillXp,
              stats: formatSkillStats(skill),
              totalSkillLevel:
                skillView.totalSkill ??
                getSkillLinkedStatAverage(record.build.profile, skill) + totalXp,
              totalXp
            } satisfies CharacterSheetSkillRow;
          })
          .filter((row): row is CharacterSheetSkillRow => row !== null);
      })

    return groupRowsBySkillType(rows);
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

  if (loading) {
    return <section>Loading character sheet...</section>;
  }

  if (!record || !contentState || !sheetSummary) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Character not found</h1>
        <Link href="/characters">Characters</Link>
      </section>
    );
  }

  const professionFamilyName = getProfessionFamilyName(contentState, profession);
  const socialClassLabel =
    record.build.socialClass ?? record.build.profile.socialClassResult ?? "Not set";
  const socialClassNumber = record.build.profile.socialClassRoll;
  const socialClassSummary =
    socialClassNumber !== undefined ? `${socialClassLabel} (${socialClassNumber})` : socialClassLabel;
  const spentSkillPoints = sheetSummary.totalSkillPointsInvested;
  const remainingSkillPoints =
    sheetSummary.draftView.primaryPoolAvailable + sheetSummary.draftView.secondaryPoolAvailable;

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1180 }}>
      <div>
        <h1 style={{ margin: 0 }}>Character Sheet — {getCharacterName(record)}</h1>
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
            <strong>Name</strong>
            <div>{getCharacterName(record)}</div>

            <strong>Society</strong>
            <div>{sheetSummary.societyLabel ?? "Not set"}</div>

            <strong>Social class</strong>
            <div>{socialClassSummary}</div>

            <strong>Profession</strong>
            <div>
              {sheetSummary.professionName ?? record.build.professionId ?? "Not set"}
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
                      "minmax(180px, 2fr) minmax(120px, 1.2fr) repeat(5, minmax(72px, 88px))",
                    padding: "0.75rem 1rem"
                  }}
                >
                  <strong>Skill</strong>
                  <strong>Stats</strong>
                  <strong>Avg stats</strong>
                  <strong>Skill group XP</strong>
                  <strong>Skill XP</strong>
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
                        "minmax(180px, 2fr) minmax(120px, 1.2fr) repeat(5, minmax(72px, 88px))",
                      padding: "0.75rem 1rem"
                    }}
                  >
                    <div>{skill.skillName}</div>
                    <div>{skill.stats}</div>
                    <div>{skill.avgStats}</div>
                    <div>{skill.skillGroupXp}</div>
                    <div>{skill.skillXp}</div>
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
    </section>
  );
}
