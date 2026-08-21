"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { CharacterBuild, ProgressionTargetType } from "@glantri/domain";
import {
  buildCharacterProgressionView,
  buyCharacterProgressionAttempt,
  type CharacterProgressionTargetRow,
  removeCharacterProgressionCheck,
  requestCharacterProgressionCheck,
  resolveCharacterProgressionAttempts,
} from "@glantri/rules-engine";

import {
  getCurrentCharacterFromMutationConflict,
  updateServerCharacter,
} from "@/lib/api/localServiceClient";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import { getPlayerFacingSkillBucket, groupRowsBySkillType } from "@/lib/chargen/chargenBrowse";
import { buildCharacterSheetProfileStatRows } from "@/lib/characters/characterSheet";
import {
  formatCharacterRecoveryCompetition,
  resolveCharacterRecoverySaveFailure,
} from "@/lib/characters/characterRecoverySaveFailure";
import { CharacterRecoveryCandidateList } from "@/lib/characters/CharacterRecoveryCandidateList";
import { loadLocalCharacterAdvancementContext } from "@/lib/characters/loadLocalCharacterAdvancementContext";
import type {
  CharacterRecoveryEnvelope,
  LocalCharacterDraft,
  LocalCharacterRecord,
} from "@/lib/offline/glantriDexie";
import { CharacterDraftRepository } from "@/lib/offline/repositories/characterDraftRepository";
import {
  CharacterRecoveryRepository,
  formatCharacterRecoveryField,
} from "@/lib/offline/repositories/characterRecoveryRepository";
import {
  buildServerBackedLocalCharacterRecord,
  LocalCharacterRepository,
  requireServerCharacterRevision,
} from "@/lib/offline/repositories/localCharacterRepository";

interface CharacterAdvanceProps {
  id: string;
}

const characterDraftRepository = new CharacterDraftRepository();
const characterRecoveryRepository = new CharacterRecoveryRepository();
const localCharacterRepository = new LocalCharacterRepository();

function formatTargetType(type: ProgressionTargetType): string {
  if (type === "skillGroup") {
    return "Skill group";
  }

  return type[0]?.toUpperCase() + type.slice(1);
}

function getCharacterName(build: CharacterBuild): string {
  return build.name.trim() || "Unnamed Character";
}

function formatHistoryDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "--.-- --:--";
  }

  return `${date.getDate().toString().padStart(2, "0")}.${(date.getMonth() + 1)
    .toString()
    .padStart(2, "0")} ${date.getHours().toString().padStart(2, "0")}:${date
    .getMinutes()
    .toString()
    .padStart(2, "0")}`;
}

function formatProgressionRoll(input: {
  openEndedD10s: number[];
  rollD20: number;
  rollTotal: number;
}): string {
  if (input.openEndedD10s.length === 0) {
    return `roll ${input.rollD20}`;
  }

  return `roll ${[input.rollD20, ...input.openEndedD10s].join("+")}=${input.rollTotal}`;
}

function formatValueChange(input: {
  afterValue: number;
  beforeValue: number;
  success: boolean;
}): string {
  if (!input.success || input.beforeValue === input.afterValue) {
    return `value stayed ${input.beforeValue}`;
  }

  return `value ${input.beforeValue} to ${input.afterValue}`;
}

function formatSkillStats(stats: string[]): string {
  return [...new Set(stats)].map((stat) => stat.toUpperCase()).join(" / ");
}

export default function CharacterAdvance({ id }: CharacterAdvanceProps) {
  const { currentUser, loading: sessionLoading } = useSessionUser();
  const [content, setContent] = useState<
    Awaited<ReturnType<typeof loadLocalCharacterAdvancementContext>>["content"] | undefined
  >();
  const [canonicalDraft, setCanonicalDraft] = useState<LocalCharacterDraft>();
  const [competingRecovery, setCompetingRecovery] = useState(false);
  const [draft, setDraft] = useState<LocalCharacterDraft>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<LocalCharacterRecord>();
  const [recoveryDraft, setRecoveryDraft] = useState<LocalCharacterDraft>();
  const [recoveryRecord, setRecoveryRecord] = useState<CharacterRecoveryEnvelope>();
  const [recoveryRequired, setRecoveryRequired] = useState(false);
  const [reviewingRecovery, setReviewingRecovery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedProvisionalSkillId, setSelectedProvisionalSkillId] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (sessionLoading) {
      return () => {
        cancelled = true;
      };
    }

    if (!currentUser) {
      setLoading(false);
      return () => {
        cancelled = true;
      };
    }

    loadLocalCharacterAdvancementContext(id, currentUser.id)
      .then((result) => {
        if (cancelled) {
          return;
        }

        setContent(result.content);
        setRecord(result.record);
        setRecoveryDraft(result.recoveryDraft);
        setRecoveryRecord(result.recoveryRecord);
        setRecoveryRequired(Boolean(result.recoveryDraft || result.recoveryRecord));
        setCompetingRecovery(false);
        setReviewingRecovery(false);

        if (!result.record) {
          return;
        }

        const resolvedDraft = result.draft;

        if (!cancelled && resolvedDraft) {
          setCanonicalDraft(resolvedDraft);
          setDraft(resolvedDraft);
          if (result.recoveryDraft || result.recoveryRecord) {
            setFeedback(
              result.hasRevisionConflict
                ? "The same progression details changed elsewhere. The current Character is shown, and your unsaved progression needs review."
                : "The current Character is shown, and your unsaved progression remains available on this device.",
            );
          }
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
  }, [currentUser, id, sessionLoading]);

  const progressionView = useMemo(() => {
    if (!draft || !content) {
      return undefined;
    }

    return buildCharacterProgressionView({
      build: draft.build,
      content,
    });
  }, [content, draft]);
  const availableProvisionalSkills = useMemo(() => {
    if (!content || !draft || !progressionView) {
      return [];
    }

    const existingSkillIds = new Set(draft.build.progression.skills.map((skill) => skill.skillId));
    const existingProgressionRowSkillIds = new Set(
      progressionView.rows.filter((row) => row.targetType === "skill").map((row) => row.targetId),
    );

    return [...content.skills]
      .filter(
        (skill) =>
          !skill.specializationOfSkillId &&
          !existingSkillIds.has(skill.id) &&
          !existingProgressionRowSkillIds.has(skill.id),
      )
      .sort(
        (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
      );
  }, [content, draft, progressionView]);

  async function persistDraft(
    nextBuild: CharacterBuild,
    message?: string,
    sync?: { serverUpdatedAt: string; status: "synced" },
  ) {
    if (!draft || !record || !currentUser) {
      return undefined;
    }

    if (recoveryRequired && !reviewingRecovery) {
      setFeedback("Review or discard the existing unsaved progression before making new changes.");
      return undefined;
    }

    const updatedAt = new Date().toISOString();
    const savedDraft: LocalCharacterDraft = sync
      ? await characterDraftRepository.save({
          advancementPointsSpent: 0,
          advancementPointsTotal: nextBuild.progressionState?.availablePoints ?? 0,
          build: nextBuild,
          characterId: draft.characterId,
          id: draft.id,
          serverUpdatedAt: sync.serverUpdatedAt,
          syncStatus: sync.status,
          updatedAt,
        })
      : {
          ...draft,
          advancementPointsSpent: 0,
          advancementPointsTotal: nextBuild.progressionState?.availablePoints ?? 0,
          build: nextBuild,
          serverUpdatedAt: requireServerCharacterRevision(record),
          syncStatus: "local",
          updatedAt,
        };

    if (!sync) {
      const envelope = await characterRecoveryRepository.createAttempt({
        account: currentUser,
        attemptedBuild: nextBuild,
        baseBuild: record.build,
        baseRevision: requireServerCharacterRevision(record),
        characterId: id,
        expectedAttemptId: recoveryRecord?.saveAttempt.id,
        sourceAction: "Edit progression",
        sourceSurface: "Character Progression",
      });
      setRecoveryDraft(savedDraft);
      setRecoveryRecord(envelope);
      setRecoveryRequired(Boolean(envelope));
      setReviewingRecovery(Boolean(envelope));
    }

    setDraft(savedDraft);
    if (message) {
      setFeedback(message);
    }

    return savedDraft;
  }

  function handleReviewRecovery() {
    if (!recoveryDraft) {
      return;
    }

    setDraft(recoveryDraft);
    setCompetingRecovery(false);
    setReviewingRecovery(true);
    setFeedback(
      "Unsaved progression loaded for review. Nothing has been saved to the current Character yet.",
    );
  }

  function handleReturnToCanonical() {
    if (!canonicalDraft) {
      return;
    }

    setDraft(canonicalDraft);
    setCompetingRecovery(false);
    setReviewingRecovery(false);
    setFeedback("Current progression restored. Your unsaved progression is still available.");
  }

  async function handleDiscardRecovery() {
    if (!canonicalDraft || !record || !currentUser) {
      return;
    }

    const serverUpdatedAt = requireServerCharacterRevision(record);
    const savedDraft = await characterDraftRepository.save({
      advancementPointsSpent: canonicalDraft.advancementPointsSpent,
      advancementPointsTotal: canonicalDraft.advancementPointsTotal,
      build: canonicalDraft.build,
      characterId: canonicalDraft.characterId,
      id: canonicalDraft.id,
      serverUpdatedAt,
      syncStatus: "synced",
      updatedAt: record.updatedAt,
    });
    await characterRecoveryRepository.deleteAttempt(
      currentUser.id,
      id,
      recoveryRecord?.saveAttempt.id ?? "",
    );
    const remainingRecovery = await characterRecoveryRepository.get(currentUser.id, id);

    setCanonicalDraft(savedDraft);
    setDraft(savedDraft);
    setRecoveryDraft(undefined);
    setRecoveryRecord(remainingRecovery);
    setRecoveryRequired(Boolean(remainingRecovery));
    setCompetingRecovery(false);
    setReviewingRecovery(false);
    setFeedback(
      remainingRecovery
        ? "The selected recovery was discarded. Another retained attempt now needs review."
        : "Unsaved progression discarded. The current Character remains unchanged.",
    );
  }

  async function handleBuyAttempt(targetType: ProgressionTargetType, targetId: string) {
    if (!draft || !content) {
      return;
    }

    const result = buyCharacterProgressionAttempt({
      build: draft.build,
      content,
      targetId,
      targetType,
    });

    if (result.error) {
      setFeedback(result.error);
      return;
    }

    await persistDraft(result.build, "Progression attempt purchased. Resolve checks to roll.");
  }

  async function handleToggleRequestCheck(row: CharacterProgressionTargetRow) {
    if (!draft || !content || row.approved || row.pending) {
      return;
    }

    const nextBuild = row.requested
      ? removeCharacterProgressionCheck({
          build: draft.build,
          targetId: row.targetId,
          targetType: row.targetType,
        })
      : requestCharacterProgressionCheck({
          build: draft.build,
          content,
          targetId: row.targetId,
          targetType: row.targetType,
        });

    await persistDraft(
      nextBuild,
      row.requested
        ? "Check request removed. Save progression to share it with the GM."
        : "Check requested. Save progression to share it with the GM.",
    );
  }

  async function handleRequestProvisionalSkillCheck() {
    if (!draft || !content || !selectedProvisionalSkillId) {
      return;
    }

    const nextBuild = requestCharacterProgressionCheck({
      build: draft.build,
      content,
      provisional: true,
      targetId: selectedProvisionalSkillId,
      targetType: "skill",
    });

    setSelectedProvisionalSkillId("");
    await persistDraft(
      nextBuild,
      "Provisional skill check requested. Save progression to share it with the GM.",
    );
  }

  async function handleResolveAttempts() {
    if (!draft || !content || !record) {
      return;
    }

    if (recoveryRequired && !reviewingRecovery) {
      setFeedback("Review or discard the existing unsaved progression before resolving attempts.");
      return;
    }

    const result = resolveCharacterProgressionAttempts({
      build: draft.build,
      content,
    });
    const successes = result.history.filter((entry) => entry.success).length;
    await persistDraft(
      result.build,
      `Resolved ${result.history.length} progression attempt${result.history.length === 1 ? "" : "s"}; ${successes} succeeded. Unsaved progression is kept on this device until you save.`,
    );
  }

  async function handleSaveChanges() {
    if (!draft || !record || !currentUser) {
      return;
    }

    if (recoveryRecord?.competingCandidates?.length) {
      setFeedback("Resolve or discard every rejected recovery candidate before saving.");
      return;
    }

    if (recoveryRequired && !reviewingRecovery) {
      setFeedback("Review or discard the existing unsaved progression before saving.");
      return;
    }

    setSaving(true);

    const expectedUpdatedAt = requireServerCharacterRevision(record);
    let recoveryEnvelope: CharacterRecoveryEnvelope | undefined;

    try {
      recoveryEnvelope = await characterRecoveryRepository.createAttempt({
        account: currentUser,
        attemptedBuild: draft.build,
        baseBuild: record.build,
        baseRevision: expectedUpdatedAt,
        characterId: id,
        expectedAttemptId: recoveryRecord?.saveAttempt.id,
        sourceAction: "Save progression",
        sourceSurface: "Character Progression",
      });
      setCompetingRecovery(false);
      if (recoveryEnvelope) {
        setRecoveryRecord(recoveryEnvelope);
      }

      const serverRecord = await updateServerCharacter({
        build: draft.build,
        characterId: id,
        expectedUpdatedAt,
      });
      const syncedRecord = await localCharacterRepository.save({
        build: serverRecord.build,
        createdAt: record.createdAt,
        creatorDisplayName: record.creatorDisplayName,
        creatorEmail: record.creatorEmail,
        creatorId: serverRecord.ownerId ?? record.creatorId,
        finalizedAt: record.finalizedAt,
        serverUpdatedAt: serverRecord.updatedAt,
        syncStatus: "synced",
        updatedAt: serverRecord.updatedAt,
      });

      setRecord(syncedRecord);
      const syncedDraft = await persistDraft(serverRecord.build, "Changes saved to server.", {
        serverUpdatedAt: serverRecord.updatedAt,
        status: "synced",
      });
      if (syncedDraft) {
        const remainingRecovery = recoveryEnvelope
          ? await characterRecoveryRepository.completeAttempt(
              currentUser.id,
              id,
              recoveryEnvelope.saveAttempt.id,
              serverRecord.build,
              serverRecord.updatedAt,
            )
          : await characterRecoveryRepository.get(currentUser.id, id);
        setCanonicalDraft(syncedDraft);
        if (!remainingRecovery) {
          setRecoveryDraft(undefined);
        }
        setRecoveryRecord(remainingRecovery);
        setRecoveryRequired(Boolean(remainingRecovery));
        setCompetingRecovery(false);
        setReviewingRecovery(false);
      }
    } catch (error) {
      const recoveryFailure = resolveCharacterRecoverySaveFailure(
        error,
        draft,
        canonicalDraft ?? draft,
      );

      if (recoveryFailure.competingAttempt) {
        const retainedRecovery = await characterRecoveryRepository.get(currentUser.id, id);
        setDraft(recoveryFailure.displayedValue);
        setRecoveryRecord(retainedRecovery);
        setRecoveryRequired(Boolean(retainedRecovery));
        setCompetingRecovery(true);
        setReviewingRecovery(false);
        setFeedback(formatCharacterRecoveryCompetition(Boolean(retainedRecovery)));
        return;
      }

      const currentCharacter = getCurrentCharacterFromMutationConflict(error);

      if (currentCharacter) {
        const canonicalRecord = buildServerBackedLocalCharacterRecord(currentCharacter, record);
        await localCharacterRepository.save(canonicalRecord);
        const markedRecovery = recoveryEnvelope
          ? await characterRecoveryRepository.markAttemptOutcome(
              currentUser.id,
              id,
              recoveryEnvelope.saveAttempt.id,
              "conflict",
              "stale_character",
            )
          : undefined;
        const recoveryState = markedRecovery
          ? await characterRecoveryRepository.reconcile(
              currentUser.id,
              id,
              currentCharacter.build,
              currentCharacter.updatedAt,
              markedRecovery.saveAttempt.id,
            )
          : undefined;
        const retainedRecovery =
          recoveryState?.envelope ?? (await characterRecoveryRepository.get(currentUser.id, id));
        const currentDraft: LocalCharacterDraft = {
          ...draft,
          advancementPointsSpent: 0,
          advancementPointsTotal: canonicalRecord.build.progressionState?.availablePoints ?? 0,
          build: canonicalRecord.build,
          serverUpdatedAt: currentCharacter.updatedAt,
          syncStatus: "synced",
          updatedAt: currentCharacter.updatedAt,
        };
        setRecord(canonicalRecord);
        setCanonicalDraft(currentDraft);
        setDraft(currentDraft);
        setRecoveryDraft(draft);
        setRecoveryRecord(retainedRecovery);
        setRecoveryRequired(Boolean(retainedRecovery));
        setReviewingRecovery(false);
        setFeedback(
          "The Character changed elsewhere. Current progression is shown, and your attempted changes remain available for review.",
        );
      } else {
        const failedRecovery = recoveryEnvelope
          ? await characterRecoveryRepository.markAttemptOutcome(
              currentUser.id,
              id,
              recoveryEnvelope.saveAttempt.id,
              "failed",
              error instanceof Error ? error.name : undefined,
            )
          : undefined;
        const retainedRecovery =
          failedRecovery ?? (await characterRecoveryRepository.get(currentUser.id, id));
        if (canonicalDraft) {
          setRecord(record);
          setDraft(recoveryFailure.displayedValue);
        }
        setRecoveryDraft(draft);
        setRecoveryRecord(retainedRecovery);
        setRecoveryRequired(Boolean(retainedRecovery));
        setReviewingRecovery(false);
        setFeedback(
          error instanceof Error
            ? `${error.message} The last confirmed progression is shown and your attempted changes remain available for review.`
            : "The Character could not be confirmed. The last confirmed progression is shown and your attempted changes remain available for review.",
        );
      }
    } finally {
      setSaving(false);
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

  const rowsByType = progressionView.rows.reduce(
    (groups, row) => {
      groups[row.targetType].push(row);
      return groups;
    },
    {
      skill: [],
      skillGroup: [],
      specialization: [],
      stat: [],
    } as Record<ProgressionTargetType, typeof progressionView.rows>,
  );
  const characterName = getCharacterName(draft.build);
  const profession = content.professions.find((item) => item.id === draft.build.professionId);
  const professionFamilyName = profession?.familyId
    ? content.professionFamilies.find((family) => family.id === profession.familyId)?.name
    : undefined;
  const socialClassLabel =
    draft.build.socialClass ?? draft.build.profile.socialClassResult ?? "Not set";
  const socialClassNumber = draft.build.profile.socialClassRoll;
  const socialClassSummary =
    socialClassNumber !== undefined
      ? `${socialClassLabel} (${socialClassNumber})`
      : socialClassLabel;
  const profileStatRows = buildCharacterSheetProfileStatRows(draft.build);
  const educationLevel = progressionView.draftView.education.theoreticalSkillCount;
  const requestedCheckCount = progressionView.checks.filter(
    (check) => check.status === "requested",
  ).length;
  const approvedCheckCount = progressionView.checks.filter(
    (check) => (check.status ?? "approved") === "approved",
  ).length;
  const availableProgressionPoints = progressionView.availablePoints;
  const recoveryFieldLabels = recoveryRecord
    ? [...new Set(recoveryRecord.patch.map((entry) => formatCharacterRecoveryField(entry.path)))]
    : [];
  const groupedSkillRows = groupRowsBySkillType(
    rowsByType.skill.map((row) => {
      const skill = content.skills.find((item) => item.id === row.targetId);
      const skillView = progressionView.draftView.skills.find(
        (item) => item.skillId === row.targetId,
      );

      return {
        ...row,
        stats: skill ? formatSkillStats(skill.linkedStats) : "—",
        skillName: row.label,
        skillType: skill ? getPlayerFacingSkillBucket(skill) : "special-access",
        totalSkillLevel: skillView?.totalSkill ?? row.currentValue,
      };
    }),
  );

  function formatApprovedState(row: CharacterProgressionTargetRow): string {
    if (row.approved) {
      return "Approved";
    }

    if (row.requested) {
      return "Awaiting GM";
    }

    return "—";
  }

  function canBuyProgression(row: CharacterProgressionTargetRow): boolean {
    return Boolean(
      row.approved &&
      !row.pending &&
      row.cost !== undefined &&
      row.cost <= availableProgressionPoints &&
      !row.disabledReason,
    );
  }

  function renderRequestCheckbox(row: CharacterProgressionTargetRow) {
    const canRequest = !row.requested && !row.approved && !row.pending;

    return (
      <input
        aria-label={`${row.label} requested check`}
        checked={row.requested}
        disabled={row.approved || row.pending || (!row.requested && !canRequest)}
        onChange={() => void handleToggleRequestCheck(row)}
        type="checkbox"
      />
    );
  }

  function renderProgressionRow(row: CharacterProgressionTargetRow) {
    const canBuy = canBuyProgression(row);

    return (
      <tr key={`${row.targetType}:${row.targetId}`} style={{ borderBottom: "1px solid #eee8dc" }}>
        <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>
          <div>{row.label}</div>
          {row.provisional ? (
            <div style={{ color: "#8f5a00", fontSize: "0.82rem" }}>Provisional</div>
          ) : null}
          {row.disabledReason ? (
            <div style={{ color: "#8f3d2f", fontSize: "0.82rem" }}>{row.disabledReason}</div>
          ) : null}
        </td>
        <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>{row.currentValue}</td>
        <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
          {renderRequestCheckbox(row)}
        </td>
        <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
          {formatApprovedState(row)}
        </td>
        <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>{row.cost ?? "—"}</td>
        <td style={{ padding: "0.6rem 0", textAlign: "center" }}>
          {canBuy ? (
            <button
              onClick={() => void handleBuyAttempt(row.targetType, row.targetId)}
              type="button"
            >
              Buy
            </button>
          ) : (
            "—"
          )}
        </td>
      </tr>
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1120 }}>
      <div>
        <h1 style={{ marginBottom: "0.5rem" }}>Progression — {characterName}</h1>
        <p style={{ margin: 0 }}>
          Spend GM-granted progression points on checked items. Increases apply only after the
          open-ended progression roll succeeds.
        </p>
      </div>

      {recoveryRequired && recoveryRecord ? (
        <section
          style={{
            background: "#fff8e8",
            border: "1px solid #d9b86c",
            borderRadius: 12,
            display: "grid",
            gap: "0.75rem",
            padding: "1rem",
          }}
        >
          <strong>
            {competingRecovery || Boolean(recoveryRecord.competingCandidates?.length)
              ? "Competing unsaved changes need review"
              : reviewingRecovery
                ? "Reviewing unsaved progression"
                : "Unsaved progression needs review"}
          </strong>
          <span>
            {competingRecovery
              ? "Another tab's primary recovery is listed below. Your newer progression remains visible here and is also retained as a separate rejected candidate."
              : recoveryRecord.competingCandidates?.length
                ? "The primary recovery and additional rejected candidates are retained separately. Review candidates on the Character Sheet before retrying here."
                : reviewingRecovery
                  ? "These progression changes are visible for review. Saving remains a separate action."
                  : recoveryRecord.reconciliation === "conflict"
                    ? "The same progression details changed elsewhere. Review your saved-on-device changes before deciding what to keep."
                    : "The current Character is shown. Your unsaved progression remains available on this device."}
          </span>
          <span>
            From {recoveryRecord.sourceSurface} · {recoveryRecord.sourceAction} ·{" "}
            {new Date(recoveryRecord.saveAttempt.attemptedAt).toLocaleString()} · Changed:{" "}
            {recoveryFieldLabels.join(", ")}
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
            {competingRecovery ? (
              <Link href={`/characters/${id}`}>Review competing recovery on Character Sheet</Link>
            ) : reviewingRecovery ? (
              <button onClick={handleReturnToCanonical} type="button">
                Return to current progression
              </button>
            ) : (
              <button onClick={handleReviewRecovery} type="button">
                Review unsaved progression
              </button>
            )}
            <button onClick={() => void handleDiscardRecovery()} type="button">
              Discard unsaved progression
            </button>
          </div>
          <CharacterRecoveryCandidateList
            envelope={recoveryRecord}
            reviewHref={`/characters/${id}`}
          />
        </section>
      ) : null}

      {feedback ? (
        <section
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem",
          }}
        >
          {feedback}
        </section>
      ) : null}

      <section
        style={{
          alignItems: "center",
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          boxShadow: "0 8px 18px rgba(43, 37, 26, 0.08)",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          padding: "0.75rem 1rem",
          position: "sticky",
          top: "3rem",
          zIndex: 5,
        }}
      >
        <strong>Progression</strong>
        <span>Available points: {progressionView.availablePoints}</span>
        <span>Requested: {requestedCheckCount}</span>
        <span>Approved: {approvedCheckCount}</span>
        <span>Pending: {progressionView.pendingAttempts.length}</span>
        <span>History: {progressionView.history.length}</span>
        <button
          disabled={
            saving ||
            Boolean(
              recoveryRequired &&
              (!reviewingRecovery || recoveryRecord?.competingCandidates?.length),
            )
          }
          onClick={() => void handleSaveChanges()}
          type="button"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </section>

      <section
        style={{
          display: "grid",
          gap: "1rem",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
        }}
      >
        <section
          style={{
            background: "#fbfaf5",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            overflowX: "auto",
            padding: "1rem",
          }}
        >
          <h2 style={{ margin: "0 0 0.75rem 0" }}>Profile Stats</h2>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Stat</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Original</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Developed</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Current</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Requested</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Approved</th>
              </tr>
            </thead>
            <tbody>
              {profileStatRows.map((statRow) => {
                const progressionRow = rowsByType.stat.find((row) => row.targetId === statRow.stat);

                return (
                  <tr key={statRow.stat} style={{ borderBottom: "1px solid #eee8dc" }}>
                    <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>{statRow.label}</td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                      {statRow.originalValue}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                      {statRow.developedValue}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                      {statRow.currentValue}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                      {progressionRow ? renderRequestCheckbox(progressionRow) : "—"}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      {progressionRow ? formatApprovedState(progressionRow) : "—"}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderBottom: "1px solid #eee8dc" }}>
                <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>Distraction</td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                  {progressionView.sheetSummary.distractionLevel}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                  {progressionView.sheetSummary.distractionLevel}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                  {progressionView.sheetSummary.distractionLevel}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>—</td>
                <td style={{ padding: "0.6rem 0.75rem" }}>—</td>
              </tr>
            </tbody>
          </table>
          <p style={{ color: "#5e5a50", fontSize: "0.85rem", margin: "0.75rem 0 0 0" }}>
            Stat checks can be requested, but stat advancement is not enabled in v1.
          </p>
        </section>

        <section
          style={{
            background: "#f6f5ef",
            border: "1px solid #d9ddd8",
            borderRadius: 12,
            padding: "1rem",
          }}
        >
          <h2 style={{ margin: "0 0 0.75rem 0" }}>Summary</h2>
          <div
            style={{
              alignItems: "start",
              columnGap: "1rem",
              display: "grid",
              gridTemplateColumns: "minmax(120px, auto) minmax(0, 1fr)",
              rowGap: "0.55rem",
            }}
          >
            <strong>Character name</strong>
            <div>{characterName}</div>
            <strong>Title</strong>
            <div>{draft.build.profile.title?.trim() || "—"}</div>
            <strong>Society</strong>
            <div>{progressionView.sheetSummary.societyLabel ?? "Not set"}</div>
            <strong>Social class</strong>
            <div>{socialClassSummary}</div>
            <strong>Profession</strong>
            <div>
              {progressionView.sheetSummary.professionName ?? draft.build.professionId ?? "Not set"}
              {professionFamilyName ? `, ${professionFamilyName}` : ""}
            </div>
            <strong>Current skill points</strong>
            <div>
              <div>{progressionView.sheetSummary.skillPoints.current}</div>
              <div style={{ color: "#5e5a50", fontSize: "0.85rem" }}>
                Original {progressionView.sheetSummary.skillPoints.original} + successful
                progression {progressionView.sheetSummary.skillPoints.successfulProgressionGains}
              </div>
            </div>
            <strong>Education</strong>
            <div>{educationLevel}</div>
          </div>

          <div
            style={{
              borderTop: "1px solid #e7e2d7",
              display: "grid",
              gap: "0.75rem",
              marginTop: "0.9rem",
              paddingTop: "0.9rem",
            }}
          >
            <h3 style={{ margin: 0 }}>Skill groups</h3>
            <div style={{ overflowX: "auto" }}>
              {rowsByType.skillGroup.length > 0 ? (
                <table style={{ borderCollapse: "collapse", minWidth: 520, width: "100%" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                      <th style={{ padding: "0.4rem 0.5rem 0.4rem 0" }}>Group</th>
                      <th style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>Level</th>
                      <th style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>Requested</th>
                      <th style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>Approved</th>
                      <th style={{ padding: "0.4rem 0.5rem", textAlign: "center" }}>Cost</th>
                      <th style={{ padding: "0.4rem 0", textAlign: "center" }}>Buy</th>
                    </tr>
                  </thead>
                  <tbody>{rowsByType.skillGroup.map((row) => renderProgressionRow(row))}</tbody>
                </table>
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
          padding: "1rem",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>Skills</h2>
          <p style={{ color: "#5e5a50", margin: "0.35rem 0 0 0" }}>
            Request checks for things your character used. A GM-approved check is required before
            spending progression points.
          </p>
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
                    padding: "0.75rem 1rem",
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
                      <th style={{ padding: "0.5rem 0.75rem" }}>Stats</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Total XP</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                        Total skill level
                      </th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Requested</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Approved</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Cost</th>
                      <th style={{ padding: "0.5rem 1rem 0.5rem 0", textAlign: "center" }}>Buy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => {
                      const canBuy = canBuyProgression(row);

                      return (
                        <tr
                          key={`${row.targetType}:${row.targetId}`}
                          style={{ borderBottom: "1px solid #eee8dc" }}
                        >
                          <td style={{ padding: "0.6rem 0.75rem 0.6rem 1rem" }}>
                            <div>{row.label}</div>
                            {row.provisional ? (
                              <div style={{ color: "#8f5a00", fontSize: "0.82rem" }}>
                                Provisional
                              </div>
                            ) : null}
                            {row.disabledReason ? (
                              <div style={{ color: "#8f3d2f", fontSize: "0.82rem" }}>
                                {row.disabledReason}
                              </div>
                            ) : null}
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem" }}>{row.stats}</td>
                          <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                            {row.currentValue}
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                            {row.totalSkillLevel}
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                            {renderRequestCheckbox(row)}
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                            {formatApprovedState(row)}
                          </td>
                          <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                            {row.cost ?? "—"}
                          </td>
                          <td style={{ padding: "0.6rem 1rem 0.6rem 0", textAlign: "center" }}>
                            {canBuy ? (
                              <button
                                onClick={() => void handleBuyAttempt(row.targetType, row.targetId)}
                                type="button"
                              >
                                Buy
                              </button>
                            ) : (
                              "—"
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            ))}
          </div>
        ) : (
          <div>No skill progression rows yet.</div>
        )}

        <div
          style={{
            borderTop: "1px solid #e7e2d7",
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
            paddingTop: "0.75rem",
          }}
        >
          <select
            onChange={(event) => setSelectedProvisionalSkillId(event.target.value)}
            style={{ fontSize: "1rem", padding: "0.45rem" }}
            value={selectedProvisionalSkillId}
          >
            <option value="">Request provisional skill...</option>
            {availableProvisionalSkills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <button
            disabled={!selectedProvisionalSkillId}
            onClick={() => void handleRequestProvisionalSkillCheck()}
            type="button"
          >
            Request provisional skill
          </button>
        </div>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "1rem",
          padding: "1rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Specializations</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Specialization</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Parent skill</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Total</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Requested</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Approved</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>Cost</th>
                <th style={{ padding: "0.5rem 0", textAlign: "center" }}>Buy</th>
              </tr>
            </thead>
            <tbody>
              {rowsByType.specialization.length > 0 ? (
                rowsByType.specialization.map((row) => {
                  const specializationView = progressionView.draftView.specializations.find(
                    (item) => item.specializationId === row.targetId,
                  );
                  const canBuy = canBuyProgression(row);

                  return (
                    <tr
                      key={`${row.targetType}:${row.targetId}`}
                      style={{ borderBottom: "1px solid #eee8dc" }}
                    >
                      <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>
                        <div>{row.label}</div>
                        {row.disabledReason ? (
                          <div style={{ color: "#8f3d2f", fontSize: "0.82rem" }}>
                            {row.disabledReason}
                          </div>
                        ) : null}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        {specializationView?.parentSkillName ?? "—"}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                        {row.currentValue}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                        {renderRequestCheckbox(row)}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                        {formatApprovedState(row)}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem", textAlign: "center" }}>
                        {row.cost ?? "—"}
                      </td>
                      <td style={{ padding: "0.6rem 0", textAlign: "center" }}>
                        {canBuy ? (
                          <button
                            onClick={() => void handleBuyAttempt(row.targetType, row.targetId)}
                            type="button"
                          >
                            Buy
                          </button>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: "0.75rem 0" }}>
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
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "grid",
          gap: "0.75rem",
          padding: "1rem",
        }}
      >
        <h2 style={{ margin: 0 }}>Pending attempts</h2>
        {progressionView.pendingAttempts.length > 0 ? (
          <>
            {progressionView.pendingAttempts.map((attempt) => (
              <div
                key={attempt.id}
                style={{ borderTop: "1px solid #e7e2d7", paddingTop: "0.75rem" }}
              >
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
          padding: "1rem",
        }}
      >
        <h2 style={{ margin: 0 }}>History</h2>
        {progressionView.history.length > 0 ? (
          progressionView.history
            .slice()
            .reverse()
            .map((entry) => (
              <div
                key={entry.id}
                style={{
                  borderTop: "1px solid #e7e2d7",
                  paddingTop: "0.6rem",
                  whiteSpace: "nowrap",
                  overflowX: "auto",
                }}
              >
                {formatHistoryDateTime(entry.resolvedAt)} · {entry.targetLabel} ·{" "}
                {entry.success ? "Success" : "Fail"} ·{" "}
                {formatProgressionRoll({
                  openEndedD10s: entry.openEndedD10s,
                  rollD20: entry.rollD20,
                  rollTotal: entry.rollTotal,
                })}{" "}
                vs {entry.threshold} ·{" "}
                {formatValueChange({
                  afterValue: entry.afterValue,
                  beforeValue: entry.beforeValue,
                  success: entry.success,
                })}{" "}
                · cost {entry.cost}
              </div>
            ))
        ) : (
          <div>No resolved progression attempts yet.</div>
        )}
      </section>
    </section>
  );
}
