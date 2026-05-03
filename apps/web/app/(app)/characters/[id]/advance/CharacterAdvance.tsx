"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { CharacterBuild, ProgressionTargetType } from "@glantri/domain";
import {
  buildCharacterProgressionView,
  buyCharacterProgressionAttempt,
  resolveCharacterProgressionAttempts
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

function formatTargetType(type: ProgressionTargetType): string {
  if (type === "skillGroup") {
    return "Skill group";
  }

  return type[0]?.toUpperCase() + type.slice(1);
}

export default function CharacterAdvance({ id }: CharacterAdvanceProps) {
  const [content, setContent] = useState<
    Awaited<ReturnType<typeof loadLocalCharacterAdvancementContext>>["content"] | undefined
  >();
  const [draft, setDraft] = useState<LocalCharacterDraft>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
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

  const progressionView = useMemo(() => {
    if (!draft || !content) {
      return undefined;
    }

    return buildCharacterProgressionView({
      build: draft.build,
      content
    });
  }, [content, draft]);

  async function persistDraft(nextBuild: CharacterBuild, message?: string) {
    if (!draft) {
      return undefined;
    }

    const savedDraft = await characterDraftRepository.save({
      advancementPointsSpent: 0,
      advancementPointsTotal: nextBuild.progressionState?.availablePoints ?? 0,
      build: nextBuild,
      characterId: draft.characterId,
      id: draft.id,
      syncStatus: draft.syncStatus,
      updatedAt: new Date().toISOString()
    });

    setDraft(savedDraft);
    if (message) {
      setFeedback(message);
    }

    return savedDraft;
  }

  async function handleBuyAttempt(targetType: ProgressionTargetType, targetId: string) {
    if (!draft || !content) {
      return;
    }

    const result = buyCharacterProgressionAttempt({
      build: draft.build,
      content,
      targetId,
      targetType
    });

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    await persistDraft(result.build, "Progression attempt purchased. Resolve checks to roll.");
  }

  async function handleResolveAttempts() {
    if (!draft || !content) {
      return;
    }

    const result = resolveCharacterProgressionAttempts({
      build: draft.build,
      content
    });
    const successes = result.history.filter((entry) => entry.success).length;

    await persistDraft(
      result.build,
      `Resolved ${result.history.length} progression attempt${result.history.length === 1 ? "" : "s"}; ${successes} succeeded.`
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
    await persistDraft(draft.build, "Progression saved locally.");
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
      await persistDraft(serverRecord.build, "Progression saved locally and pushed to the local service.");
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Character could not be saved to the server.");
    }
  }

  if (loading) {
    return <section>Loading progression draft...</section>;
  }

  if (!record || !draft || !content || !progressionView) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 720 }}>
        <h1 style={{ margin: 0 }}>Character not found</h1>
        <Link href="/characters">Characters</Link>
      </section>
    );
  }

  const checkedRows = progressionView.rows.filter((row) => row.checked);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1120 }}>
      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Progression</h1>
        <p style={{ margin: 0 }}>
          Spend GM-granted progression points on checked items. Increases apply only after the
          open-ended progression roll succeeds.
        </p>
      </div>

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
          background: "#f6f5ef",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.4rem",
          padding: "1rem"
        }}
      >
        <h2 style={{ margin: 0 }}>Progression points</h2>
        <div>Available progression points: {progressionView.availablePoints}</div>
        <div>Checks: {progressionView.checks.length}</div>
        <div>Pending attempts: {progressionView.pendingAttempts.length}</div>
        <div>Resolved history entries: {progressionView.history.length}</div>
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
        <h2 style={{ margin: 0 }}>Checked items</h2>
        {checkedRows.length > 0 ? (
          checkedRows.map((row) => {
            const canBuy =
              row.checked &&
              !row.pending &&
              row.cost !== undefined &&
              row.cost <= progressionView.availablePoints &&
              !row.disabledReason;

            return (
              <div
                key={`${row.targetType}:${row.targetId}`}
                style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}
              >
                <strong>{row.label}</strong>{" "}
                {row.provisional ? <span style={{ color: "#8f5a00" }}>Provisional</span> : null}
                <div>Type: {formatTargetType(row.targetType)}</div>
                <div>Current XP/value: {row.currentValue}</div>
                <div>Cost: {row.cost ?? "-"}</div>
                <div>Status: {row.pending ? "Pending attempt" : "Checked"}</div>
                {row.disabledReason ? <div style={{ color: "#8f3d2f" }}>{row.disabledReason}</div> : null}
                <button
                  disabled={!canBuy}
                  onClick={() => void handleBuyAttempt(row.targetType, row.targetId)}
                  type="button"
                >
                  Buy progression attempt
                </button>
              </div>
            );
          })
        ) : (
          <div>No checked items yet. A GM can add checks from Character Edit.</div>
        )}
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
        <h2 style={{ margin: 0 }}>Pending attempts</h2>
        {progressionView.pendingAttempts.length > 0 ? (
          <>
            {progressionView.pendingAttempts.map((attempt) => (
              <div key={attempt.id} style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}>
                <strong>{attempt.targetLabel}</strong>
                <div>Type: {formatTargetType(attempt.targetType)}</div>
                <div>Cost paid: {attempt.cost}</div>
              </div>
            ))}
            <button onClick={() => void handleResolveAttempts()} type="button">
              Resolve checks
            </button>
          </>
        ) : (
          <div>No pending progression attempts.</div>
        )}
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
        <h2 style={{ margin: 0 }}>History</h2>
        {progressionView.history.length > 0 ? (
          progressionView.history
            .slice()
            .reverse()
            .map((entry) => (
              <div key={entry.id} style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}>
                <strong>{entry.targetLabel}</strong> - {entry.success ? "Success" : "Failure"}
                <div>
                  Roll: d20 {entry.rollD20}
                  {entry.openEndedD10s.length > 0
                    ? ` + d10s ${entry.openEndedD10s.join(", ")}`
                    : ""}{" "}
                  = {entry.rollTotal}
                </div>
                <div>Threshold: {entry.threshold}</div>
                <div>
                  Value: {entry.beforeValue} {"->"} {entry.afterValue}
                </div>
                <div>Cost paid: {entry.cost}</div>
              </div>
            ))
        ) : (
          <div>No resolved progression attempts yet.</div>
        )}
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
        <button onClick={() => void handleSaveLocally()} type="button">
          Save progression locally
        </button>
        <button onClick={() => void handleSaveToServer()} type="button">
          Save progression to server
        </button>
      </section>
    </section>
  );
}
