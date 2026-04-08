"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { glantriCharacteristicLabels, glantriCharacteristicOrder } from "@glantri/domain";
import { buildCharacterSheetSummary, buildChargenDraftView } from "@glantri/rules-engine";

import { saveCharacterToServer } from "../../../../src/lib/api/localServiceClient";
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

function getCharacterName(record: LocalCharacterRecord): string {
  return record.build.name.trim() || UNNAMED_CHARACTER_PLACEHOLDER;
}

export default function CharacterDetail({ id }: CharacterDetailProps) {
  const [loading, setLoading] = useState(true);
  const [nameInput, setNameInput] = useState("");
  const [record, setRecord] = useState<LocalCharacterRecord>();
  const [feedback, setFeedback] = useState<string>();
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
        setNameInput(result.record?.build.name ?? "");
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
    return <section>Loading character...</section>;
  }

  if (!record || !contentState) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Character not found</h1>
        <Link href="/characters">Back to characters</Link>
      </section>
    );
  }

  const profession = contentState.professions.find(
    (item) => item.id === record.build.professionId
  );
  const hasPersistedServerCharacter = record.syncStatus === "synced";
  const detailView = buildChargenDraftView({
    content: contentState,
    professionId: record.build.professionId,
    profile: record.build.profile,
    progression: record.build.progression,
    societyId: record.build.societyId,
    societyLevel: record.build.societyLevel
  });
  const sheetSummary = buildCharacterSheetSummary({
    build: record.build,
    content: contentState
  });

  async function handleSaveName() {
    if (!record) {
      setFeedback("Character could not be updated.");
      return;
    }

    const updated = await localCharacterRepository.updateName(record.id, nameInput);

    if (!updated) {
      setFeedback("Character could not be updated.");
      return;
    }

    setRecord(updated);
    setNameInput(updated.build.name);
    setFeedback("Character name saved locally.");
  }

  async function handleSaveToServer() {
    if (!record) {
      setFeedback("Character could not be saved to the server.");
      return;
    }

    try {
      const serverRecord = await saveCharacterToServer({
        ...record.build,
        name: nameInput.trim() || record.build.name
      });

      const syncedRecord = await localCharacterRepository.save({
        build: serverRecord.build,
        createdAt: serverRecord.createdAt,
        finalizedAt: record.finalizedAt,
        syncStatus: "synced",
        updatedAt: serverRecord.updatedAt
      });

      setRecord(syncedRecord);
      setNameInput(syncedRecord.build.name);
      setFeedback("Character saved to the local service and database.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Character could not be saved to the server.");
    }
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 900 }}>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/characters">Back to characters</Link>
        <Link href={`/characters/${record.id}/sheet`}>Character sheet</Link>
        {hasPersistedServerCharacter ? (
          <Link href={`/characters/${record.id}/equipment`}>Equipment</Link>
        ) : null}
        {hasPersistedServerCharacter ? (
          <Link href={`/characters/${record.id}/loadout`}>Loadout</Link>
        ) : null}
        <Link href={`/characters/${record.id}/resume`}>Resume character</Link>
        <Link href={`/characters/${record.id}/advance`}>Advance character</Link>
      </div>

      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>{getCharacterName(record)}</h1>
        <p style={{ margin: 0 }}>Finalized local character record stored in IndexedDB.</p>
      </div>

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
        <h2 style={{ margin: 0 }}>Name</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            onChange={(event) => setNameInput(event.target.value)}
            style={{ minWidth: 260, padding: "0.5rem" }}
            type="text"
            value={nameInput}
          />
          <button onClick={() => void handleSaveName()} type="button">
            Save name
          </button>
          <button onClick={() => void handleSaveToServer()} type="button">
            Save to server
          </button>
        </div>
        {feedback ? <div>{feedback}</div> : null}
        <div>Storage status: {record.syncStatus}</div>
        {!hasPersistedServerCharacter ? (
          <div style={{ color: "#5e5a50", fontSize: "0.9rem" }}>
            Save this character to the server before opening persisted Equipment or Loadout.
          </div>
        ) : null}
      </section>

      <section style={{ display: "grid", gap: "0.75rem" }}>
        <h2 style={{ margin: 0 }}>Profile summary</h2>
        <div>Profile: {record.build.profile.label}</div>
        <div
          style={{
            display: "grid",
            gap: "0.5rem",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))"
          }}
        >
          {glantriCharacteristicOrder.map((stat) => (
            <div
              key={stat}
              style={{ border: "1px solid #d9ddd8", borderRadius: 10, padding: "0.75rem" }}
            >
              <div style={{ fontSize: "0.85rem" }}>{glantriCharacteristicLabels[stat]}</div>
              <strong>{record.build.profile.rolledStats[stat]}</strong>
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
        <h2 style={{ margin: 0 }}>Identity</h2>
        <div>Society: {record.build.societyLevel ?? "Not set"}</div>
        <div>Social class: {record.build.socialClass ?? "Not set"}</div>
        <div>Profession: {profession?.name ?? record.build.professionId ?? "Not set"}</div>
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
        <h2 style={{ margin: 0 }}>Equipment</h2>
        <div>{sheetSummary.equipment.readinessLabel}</div>
        <div>
          Equipped weapons:{" "}
          {sheetSummary.equipment.equippedWeapons.length > 0
            ? sheetSummary.equipment.equippedWeapons.map((item) => item.name).join(", ")
            : "None"}
        </div>
        <div>
          Equipped shields:{" "}
          {sheetSummary.equipment.equippedShields.length > 0
            ? sheetSummary.equipment.equippedShields.map((item) => item.name).join(", ")
            : "None"}
        </div>
        <div>Armor: {sheetSummary.equipment.armorSummary}</div>
        <div>Carried items: {sheetSummary.equipment.carriedItems.length}</div>
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
        <h2 style={{ margin: 0 }}>Education</h2>
        <div>Base education: {detailView.education.baseEducation}</div>
        <div>Social class education value: {detailView.education.socialClassEducationValue}</div>
        <div>GM_int: {detailView.education.gmInt}</div>
        <div>Theoretical skill count: {detailView.education.theoreticalSkillCount}</div>
        <div>Total skill points invested: {detailView.totalSkillPointsInvested}</div>
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
        {detailView.groups.length > 0 ? (
          detailView.groups.map((group) => (
            <div key={group.groupId} style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}>
              <strong>{group.name}</strong>
              <div>Primary ranks: {group.primaryRanks}</div>
              <div>Group level: {group.groupLevel}</div>
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
        {detailView.skills.length > 0 ? (
          detailView.skills.map((skill) => (
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
        {detailView.specializations.length > 0 ? (
          detailView.specializations.map((specialization) => (
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
