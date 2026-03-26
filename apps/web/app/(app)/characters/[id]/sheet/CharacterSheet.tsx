"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { glantriCharacteristicLabels, glantriCharacteristicOrder } from "@glantri/domain";
import { buildCharacterSheetSummary } from "@glantri/rules-engine";

import { loadLocalCharacterContext } from "../../../../../src/lib/characters/loadLocalCharacterContext";
import type { LocalCharacterRecord } from "../../../../../src/lib/offline/glantriDexie";
import { UNNAMED_CHARACTER_PLACEHOLDER } from "../../../../../src/lib/offline/repositories/localCharacterRepository";

interface CharacterSheetProps {
  id: string;
}

function getCharacterName(record: LocalCharacterRecord): string {
  return record.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER;
}

export default function CharacterSheet({ id }: CharacterSheetProps) {
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

  if (loading) {
    return <section>Loading character sheet...</section>;
  }

  if (!record || !contentState) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Character not found</h1>
        <Link href="/characters">Back to characters</Link>
      </section>
    );
  }

  const sheet = buildCharacterSheetSummary({
    build: record.build,
    content: contentState
  });

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 980 }}>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/characters">Back to characters</Link>
        <Link href={`/characters/${record.id}`}>Open details</Link>
        <Link href={`/characters/${record.id}/equipment`}>Equipment</Link>
        <Link href={`/characters/${record.id}/advance`}>Advance character</Link>
      </div>

      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>{getCharacterName(record)}</h1>
        <p style={{ margin: 0 }}>
          Local-first in-play character sheet summary based on the saved character record and
          canonical content.
        </p>
      </div>

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.5rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Identity</h2>
        <div>Profession: {sheet.professionName ?? record.build.professionId ?? "Not set"}</div>
        <div>Society: {sheet.societyLabel ?? record.build.societyLevel ?? "Not set"}</div>
        <div>Social class: {record.build.socialClass ?? "Not set"}</div>
        <div>Profile: {record.build.profile.label}</div>
        <div>Distraction level: {sheet.distractionLevel}</div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Stats</h2>
        <div
          style={{
            display: "grid",
            gap: "0.75rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))"
          }}
        >
          {glantriCharacteristicOrder.map((stat) => (
            <div
              key={stat}
              style={{ border: "1px solid #d9ddd8", borderRadius: 10, padding: "0.75rem" }}
            >
              <div style={{ fontSize: "0.85rem" }}>{glantriCharacteristicLabels[stat]}</div>
              <div>Raw: {record.build.profile.rolledStats[stat]}</div>
              <div>Adjusted: {sheet.adjustedStats[stat] ?? record.build.profile.rolledStats[stat]}</div>
            </div>
          ))}
        </div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.5rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Education and seniority</h2>
        <div>Base education: {sheet.draftView.education.baseEducation}</div>
        <div>Social class education value: {sheet.draftView.education.socialClassEducationValue}</div>
        <div>GM_int: {sheet.draftView.education.gmInt}</div>
        <div>Theoretical skill count: {sheet.draftView.education.theoreticalSkillCount}</div>
        <div>Total skill points invested: {sheet.totalSkillPointsInvested}</div>
        <div>Seniority: {sheet.seniority}</div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.5rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Equipment and loadout</h2>
        <div>{sheet.equipment.readinessLabel}</div>
        <div>Armor: {sheet.equipment.armorSummary}</div>
        <div>Shield bonus: {sheet.equipment.shieldBonus}</div>
        <div>
          Equipped weapons:{" "}
          {sheet.equipment.equippedWeapons.length > 0
            ? sheet.equipment.equippedWeapons.map((item) => item.name).join(", ")
            : "None"}
        </div>
        <div>
          Equipped shields:{" "}
          {sheet.equipment.equippedShields.length > 0
            ? sheet.equipment.equippedShields.map((item) => item.name).join(", ")
            : "None"}
        </div>
        <div>
          Carried items:{" "}
          {sheet.equipment.carriedItems.length > 0
            ? sheet.equipment.carriedItems.map((item) => item.name).join(", ")
            : "None"}
        </div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Combat summary</h2>
        <div>Dodge: {sheet.combat.dodge}</div>
        <div>Parry: {sheet.combat.parry}</div>
        <div>Shield equipped: {sheet.combat.hasShield ? "Yes" : "No"}</div>
        <div>Total GMs: {sheet.gms.total}</div>
        {sheet.gms.byGroup.length > 0 ? (
          <div style={{ display: "grid", gap: "0.35rem" }}>
            {sheet.gms.byGroup.map((group) => (
              <div key={group.groupId}>
                {group.name}: {group.gms} GM
              </div>
            ))}
          </div>
        ) : (
          <div>No GMs recorded.</div>
        )}
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <strong>Combat-related groups</strong>
          {sheet.combat.combatGroups.length > 0 ? (
            sheet.combat.combatGroups.map((group) => (
              <div key={group.groupId}>
                {group.name}: level {group.groupLevel}
              </div>
            ))
          ) : (
            <div>No combat groups present.</div>
          )}
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          <strong>Equipped weapon skills</strong>
          {sheet.combat.weaponSkills.length > 0 ? (
            sheet.combat.weaponSkills.map((skill) => (
              <div key={skill.skillId} style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}>
                <div>{skill.name}</div>
                <div>Effective skill number: {skill.effectiveSkillNumber}</div>
                <div>Total skill: {skill.totalSkill}</div>
                <div>Base OB: {skill.baseOb}</div>
                <div>Parry value: {skill.parryValue}</div>
                <div>
                  Specializations: {skill.specializationNames.length > 0 ? skill.specializationNames.join(", ") : "None"}
                </div>
              </div>
            ))
          ) : (
            <div>No weapon-related skills present.</div>
          )}
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
        <h2 style={{ margin: 0 }}>Groups</h2>
        {sheet.draftView.groups.length > 0 ? (
          sheet.draftView.groups.map((group) => (
            <div key={group.groupId} style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}>
              <strong>{group.name}</strong>
              <div>Group level: {group.groupLevel}</div>
              <div>Primary ranks: {group.primaryRanks}</div>
              <div>GMs: {group.gms}</div>
            </div>
          ))
        ) : (
          <div>No groups recorded.</div>
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
        <h2 style={{ margin: 0 }}>Skills</h2>
        {sheet.draftView.skills.length > 0 ? (
          sheet.draftView.skills.map((skill) => (
            <div key={skill.skillId} style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}>
              <strong>{skill.name}</strong>
              <div>Category: {skill.category}</div>
              <div>Group level: {skill.groupLevel}</div>
              <div>Specific skill level: {skill.specificSkillLevel}</div>
              <div>Effective skill number: {skill.effectiveSkillNumber}</div>
              <div>Linked stat average: {skill.linkedStatAverage}</div>
              <div>Total skill: {skill.totalSkill}</div>
            </div>
          ))
        ) : (
          <div>No skills recorded.</div>
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
        {sheet.draftView.specializations.length > 0 ? (
          sheet.draftView.specializations.map((specialization) => (
            <div
              key={specialization.specializationId}
              style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}
            >
              <strong>{specialization.name}</strong>
              <div>Parent skill: {specialization.parentSkillName}</div>
              <div>Specialization level: {specialization.specializationLevel}</div>
              <div>
                Effective specialization number: {specialization.effectiveSpecializationNumber}
              </div>
            </div>
          ))
        ) : (
          <div>No specializations recorded.</div>
        )}
      </section>
    </section>
  );
}
