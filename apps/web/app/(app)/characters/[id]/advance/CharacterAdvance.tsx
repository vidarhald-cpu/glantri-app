"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import {
  getAdvancementPurchaseCostForSkill,
  getPrimaryPurchaseCostForGroup,
  getSecondaryPurchaseCostForSpecialization,
  reviewCharacterAdvancement,
  spendAdvancementPoint
} from "@glantri/rules-engine";

import { saveCharacterToServer } from "../../../../../src/lib/api/localServiceClient";
import { loadLocalCharacterAdvancementContext } from "../../../../../src/lib/characters/loadLocalCharacterAdvancementContext";
import type {
  LocalCharacterDraft,
  LocalCharacterRecord
} from "../../../../../src/lib/offline/glantriDexie";
import { CharacterDraftRepository } from "../../../../../src/lib/offline/repositories/characterDraftRepository";
import { LocalCharacterRepository } from "../../../../../src/lib/offline/repositories/localCharacterRepository";

interface CharacterAdvanceProps {
  id: string;
}

const characterDraftRepository = new CharacterDraftRepository();
const localCharacterRepository = new LocalCharacterRepository();

function sortByName<T extends { name: string; sortOrder?: number }>(left: T, right: T): number {
  const leftOrder = left.sortOrder ?? 0;
  const rightOrder = right.sortOrder ?? 0;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  return left.name.localeCompare(right.name);
}

export default function CharacterAdvance({ id }: CharacterAdvanceProps) {
  const [content, setContent] = useState<
    Awaited<ReturnType<typeof loadLocalCharacterAdvancementContext>>["content"] | undefined
  >();
  const [draft, setDraft] = useState<LocalCharacterDraft>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [pointsInput, setPointsInput] = useState("0");
  const [record, setRecord] = useState<LocalCharacterRecord>();

  useEffect(() => {
    let cancelled = false;

    loadLocalCharacterAdvancementContext(id)
      .then(async (result) => {
        if (cancelled) {
          return;
        }

        setContent(result.content);
        setRecord(result.record);

        if (!result.record) {
          return;
        }

        const resolvedDraft =
          result.draft ?? (await characterDraftRepository.createFromCharacter(result.record));

        if (!cancelled) {
          setDraft(resolvedDraft);
          setPointsInput(String(resolvedDraft.advancementPointsTotal));
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
  }, [id]);

  const review = useMemo(() => {
    if (!draft || !content) {
      return undefined;
    }

    return reviewCharacterAdvancement({
      advancementPointsSpent: draft.advancementPointsSpent,
      advancementPointsTotal: draft.advancementPointsTotal,
      build: draft.build,
      content
    });
  }, [content, draft]);

  const view = review?.view;

  async function persistDraft(nextDraft: LocalCharacterDraft, message?: string) {
    const savedDraft = await characterDraftRepository.save({
      advancementPointsSpent: nextDraft.advancementPointsSpent,
      advancementPointsTotal: nextDraft.advancementPointsTotal,
      build: nextDraft.build,
      characterId: nextDraft.characterId,
      id: nextDraft.id,
      syncStatus: nextDraft.syncStatus,
      updatedAt: nextDraft.updatedAt
    });

    setDraft(savedDraft);
    if (message) {
      setFeedback(message);
    }

    return savedDraft;
  }

  async function handleUpdateAdvancementPool() {
    if (!draft) {
      return;
    }

    const parsed = Number.parseInt(pointsInput, 10);

    if (Number.isNaN(parsed) || parsed < 0) {
      setFeedback("Advancement points total must be a non-negative whole number.");
      return;
    }

    await persistDraft(
      {
        ...draft,
        advancementPointsTotal: parsed,
        updatedAt: new Date().toISOString()
      },
      "Advancement points total saved locally."
    );
  }

  async function handleSpend(targetType: "group" | "skill" | "specialization", targetId: string) {
    if (!draft || !content) {
      return;
    }

    const result = spendAdvancementPoint({
      advancementPointsSpent: draft.advancementPointsSpent,
      advancementPointsTotal: draft.advancementPointsTotal,
      build: draft.build,
      content,
      targetId,
      targetType
    });

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    await persistDraft(
      {
        ...draft,
        advancementPointsSpent: result.advancementPointsSpent,
        build: result.build,
        updatedAt: new Date().toISOString()
      },
      result.warnings.length > 0
        ? result.warnings.join(" ")
        : `Spent ${result.spentCost ?? 0} advancement point${result.spentCost === 1 ? "" : "s"}.`
    );
  }

  async function handleSaveLocally() {
    if (!draft || !record) {
      return;
    }

    const savedRecord = await localCharacterRepository.save({
      build: draft.build,
      createdAt: record.createdAt,
      finalizedAt: record.finalizedAt,
      syncStatus: "local"
    });

    setRecord(savedRecord);

    await persistDraft(
      {
        ...draft,
        syncStatus: "local",
        updatedAt: new Date().toISOString()
      },
      "Advanced character saved locally."
    );
  }

  async function handleSaveToServer() {
    if (!draft || !record) {
      return;
    }

    const savedLocalRecord = await localCharacterRepository.save({
      build: draft.build,
      createdAt: record.createdAt,
      finalizedAt: record.finalizedAt,
      syncStatus: "local"
    });

    try {
      const serverRecord = await saveCharacterToServer(savedLocalRecord.build);
      const syncedRecord = await localCharacterRepository.save({
        build: serverRecord.build,
        createdAt: savedLocalRecord.createdAt,
        finalizedAt: savedLocalRecord.finalizedAt,
        syncStatus: "synced",
        updatedAt: serverRecord.updatedAt
      });

      setRecord(syncedRecord);

      await persistDraft(
        {
          ...draft,
          build: serverRecord.build,
          syncStatus: "synced",
          updatedAt: serverRecord.updatedAt
        },
        "Advanced character saved locally and pushed to the local service."
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Character could not be saved to the server.");
    }
  }

  if (loading) {
    return <section>Loading advancement draft...</section>;
  }

  if (!record || !draft || !content || !view) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Character not found</h1>
        <Link href="/characters">Characters</Link>
      </section>
    );
  }

  const groupedSkills = [...content.skills].sort(sortByName);
  const groupedSpecializations = [...content.specializations].sort(sortByName);
  const groupedGroups = [...content.skillGroups].sort(sortByName);
  const reviewResult = review;
  const canSave = reviewResult?.canSave ?? false;

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1040 }}>
      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <Link href="/characters">Characters</Link>
        <Link href={`/characters/${record.id}`}>Character sheet</Link>
        <Link href={`/characters/${record.id}/equipment`}>Inventory</Link>
        <Link href={`/characters/${record.id}/loadout`}>Equip items</Link>
      </div>

      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Advance Character</h1>
        <p style={{ margin: 0 }}>
          This works on a local-first advancement draft. Save locally to update the Dexie record,
          or push explicitly to the local service when ready.
        </p>
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
        <h2 style={{ margin: 0 }}>Advancement points</h2>
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "grid", gap: "0.25rem" }}>
            Total available
            <input
              min="0"
              onChange={(event) => setPointsInput(event.target.value)}
              style={{ padding: "0.5rem", width: 140 }}
              type="number"
              value={pointsInput}
            />
          </label>
          <button onClick={() => void handleUpdateAdvancementPool()} type="button">
            Save pool
          </button>
        </div>
        <div>Spent in advancement draft: {view.advancementPointsSpent}</div>
        <div>Remaining: {view.advancementPointsAvailable}</div>
        <div>Total skill points invested: {view.totalSkillPointsInvested}</div>
        <div>Seniority: {view.seniority}</div>
        <div>Local draft status: {draft.syncStatus}</div>
      </section>

      {reviewResult && reviewResult.errors.length > 0 ? (
        <section
          style={{
            background: "#fff2ef",
            border: "1px solid #e0b4a8",
            borderRadius: 12,
            display: "grid",
            gap: "0.5rem",
            padding: "1rem"
          }}
        >
          <h2 style={{ margin: 0 }}>Blocking errors</h2>
          {reviewResult.errors.map((error) => (
            <div key={error}>{error}</div>
          ))}
        </section>
      ) : null}

      {reviewResult && reviewResult.warnings.length > 0 ? (
        <section
          style={{
            background: "#fff8df",
            border: "1px solid #d8c271",
            borderRadius: 12,
            display: "grid",
            gap: "0.5rem",
            padding: "1rem"
          }}
        >
          <h2 style={{ margin: 0 }}>Warnings</h2>
          {reviewResult.warnings.map((warning) => (
            <div key={warning}>{warning}</div>
          ))}
        </section>
      ) : null}

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
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.5rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Identity and education</h2>
        <div>Profile: {draft.build.profile.label}</div>
        <div>Society: {draft.build.societyLevel ?? "Not set"}</div>
        <div>Social class: {draft.build.socialClass ?? "Not set"}</div>
        <div>Profession: {draft.build.professionId ?? "Not set"}</div>
        <div>Base education: {view.draftView.education.baseEducation}</div>
        <div>Social class education value: {view.draftView.education.socialClassEducationValue}</div>
        <div>GM_int: {view.draftView.education.gmInt}</div>
        <div>Theoretical skill count: {view.draftView.education.theoreticalSkillCount}</div>
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
        <h2 style={{ margin: 0 }}>Spend on groups</h2>
        {groupedGroups.map((group) => {
          const current = view.draftView.groups.find((item) => item.groupId === group.id);
          const cost = getPrimaryPurchaseCostForGroup(draft.build.progression, group.id);

          return (
            <div key={group.id} style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}>
              <strong>{group.name}</strong>
              <div>Current group level: {current?.groupLevel ?? 0}</div>
              <div>Total ranks: {current?.totalRanks ?? 0}</div>
              <div>Cost: {cost}</div>
              <button onClick={() => void handleSpend("group", group.id)} type="button">
                {current ? "Increase group +1" : "Add new group at 1"}
              </button>
            </div>
          );
        })}
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
        <h2 style={{ margin: 0 }}>Spend on skills</h2>
        {groupedSkills.map((skill) => {
          const current = view.draftView.skills.find((item) => item.skillId === skill.id);
          const cost = getAdvancementPurchaseCostForSkill(draft.build.progression, skill);

          return (
            <div key={skill.id} style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}>
              <strong>{skill.name}</strong>
              <div>Category: {skill.category}</div>
              <div>Requires literacy: {skill.requiresLiteracy}</div>
              <div>Current specific skill level: {current?.specificSkillLevel ?? 0}</div>
              <div>Effective skill number: {current?.effectiveSkillNumber ?? 0}</div>
              <div>Total skill: {current?.totalSkill ?? 0}</div>
              <div>Cost: {cost}</div>
              <button onClick={() => void handleSpend("skill", skill.id)} type="button">
                {current ? "Increase skill +1" : "Add new skill at 1"}
              </button>
            </div>
          );
        })}
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
        <h2 style={{ margin: 0 }}>Spend on specializations</h2>
        {groupedSpecializations.map((specialization) => {
          const current = view.draftView.specializations.find(
            (item) => item.specializationId === specialization.id
          );
          const cost = getSecondaryPurchaseCostForSpecialization(
            draft.build.progression,
            specialization
          );

          return (
            <div
              key={specialization.id}
              style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}
            >
              <strong>{specialization.name}</strong>
              <div>Parent skill: {specialization.skillId}</div>
              <div>Minimum group level: {specialization.minimumGroupLevel}</div>
              <div>Current specialization level: {current?.specializationLevel ?? 0}</div>
              <div>
                Effective specialization number: {current?.effectiveSpecializationNumber ?? 0}
              </div>
              <div>Cost: {cost}</div>
              <button onClick={() => void handleSpend("specialization", specialization.id)} type="button">
                {current ? "Increase specialization +1" : "Add new specialization at 1"}
              </button>
            </div>
          );
        })}
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
        <h2 style={{ margin: 0 }}>Current results</h2>
        {view.draftView.groups.map((group) => (
          <div key={group.groupId} style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}>
            <strong>{group.name}</strong>
            <div>Group level: {group.groupLevel}</div>
            <div>Total ranks: {group.totalRanks}</div>
          </div>
        ))}
        {view.draftView.skills.map((skill) => (
          <div key={skill.skillId} style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}>
            <strong>{skill.name}</strong>
            <div>Specific skill level: {skill.specificSkillLevel}</div>
            <div>Effective skill number: {skill.effectiveSkillNumber}</div>
            <div>Total skill: {skill.totalSkill}</div>
          </div>
        ))}
        {view.draftView.specializations.map((specialization) => (
          <div
            key={specialization.specializationId}
            style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}
          >
            <strong>{specialization.name}</strong>
            <div>Specialization level: {specialization.specializationLevel}</div>
            <div>
              Effective specialization number: {specialization.effectiveSpecializationNumber}
            </div>
          </div>
        ))}
      </section>

      <section
        style={{
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          padding: "1rem"
        }}
      >
        <button disabled={!canSave} onClick={() => void handleSaveLocally()} type="button">
          Save advancement locally
        </button>
        <button disabled={!canSave} onClick={() => void handleSaveToServer()} type="button">
          Save advancement to server
        </button>
      </section>
    </section>
  );
}
