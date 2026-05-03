"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { CharacterBuild, ProgressionTargetType } from "@glantri/domain";
import {
  buildCharacterProgressionView,
  buyCharacterProgressionAttempt,
  type CharacterProgressionTargetRow,
  requestCharacterProgressionCheck,
  resolveCharacterProgressionAttempts
} from "@glantri/rules-engine";

import { saveCharacterToServer } from "../../../../../src/lib/api/localServiceClient";
import { getPlayerFacingSkillBucket, groupRowsBySkillType } from "../../../../../src/lib/chargen/chargenBrowse";
import {
  buildCharacterSheetProfileStatRows,
  characterSheetStatsTableColumns
} from "../../../../../src/lib/characters/characterSheet";
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

function getCharacterName(build: CharacterBuild): string {
  return build.name.trim() || "Unnamed Character";
}

export default function CharacterAdvance({ id }: CharacterAdvanceProps) {
  const [content, setContent] = useState<
    Awaited<ReturnType<typeof loadLocalCharacterAdvancementContext>>["content"] | undefined
  >();
  const [draft, setDraft] = useState<LocalCharacterDraft>();
  const [feedback, setFeedback] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [record, setRecord] = useState<LocalCharacterRecord>();
  const [selectedProvisionalSkillId, setSelectedProvisionalSkillId] = useState("");

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
  const availableProvisionalSkills = useMemo(() => {
    if (!content || !draft || !progressionView) {
      return [];
    }

    const existingSkillIds = new Set(draft.build.progression.skills.map((skill) => skill.skillId));
    const existingProgressionRowSkillIds = new Set(
      progressionView.rows
        .filter((row) => row.targetType === "skill")
        .map((row) => row.targetId)
    );

    return [...content.skills]
      .filter(
        (skill) =>
          !skill.specializationOfSkillId &&
          !existingSkillIds.has(skill.id) &&
          !existingProgressionRowSkillIds.has(skill.id)
      )
      .sort((left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name));
  }, [content, draft, progressionView]);

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

  async function handleRequestCheck(targetType: ProgressionTargetType, targetId: string) {
    if (!draft || !content) {
      return;
    }

    const nextBuild = requestCharacterProgressionCheck({
      build: draft.build,
      content,
      targetId,
      targetType
    });

    await persistDraft(nextBuild, "Check requested. Save progression to share it with the GM.");
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
      targetType: "skill"
    });

    setSelectedProvisionalSkillId("");
    await persistDraft(nextBuild, "Provisional skill check requested. Save progression to share it with the GM.");
  }

  async function handleResolveAttempts() {
    if (!draft || !content || !record) {
      return;
    }

    const result = resolveCharacterProgressionAttempts({
      build: draft.build,
      content
    });
    const successes = result.history.filter((entry) => entry.success).length;
    const savedRecord = await localCharacterRepository.save({
      build: result.build,
      createdAt: record.createdAt,
      finalizedAt: record.finalizedAt,
      syncStatus: "local"
    });

    setRecord(savedRecord);
    await persistDraft(
      result.build,
      `Resolved ${result.history.length} progression attempt${result.history.length === 1 ? "" : "s"}; ${successes} succeeded. Progression saved locally.`
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

  const rowsByType = progressionView.rows.reduce(
    (groups, row) => {
      groups[row.targetType].push(row);
      return groups;
    },
    {
      skill: [],
      skillGroup: [],
      specialization: [],
      stat: []
    } as Record<ProgressionTargetType, typeof progressionView.rows>
  );
  const characterName = getCharacterName(draft.build);
  const profession = content.professions.find((item) => item.id === draft.build.professionId);
  const professionFamilyName = profession?.familyId
    ? content.professionFamilies.find((family) => family.id === profession.familyId)?.name
    : undefined;
  const socialClassLabel = draft.build.socialClass ?? draft.build.profile.socialClassResult ?? "Not set";
  const socialClassNumber = draft.build.profile.socialClassRoll;
  const socialClassSummary =
    socialClassNumber !== undefined ? `${socialClassLabel} (${socialClassNumber})` : socialClassLabel;
  const profileStatRows = buildCharacterSheetProfileStatRows(draft.build);
  const skillGroupSummaryRows = [...content.skillGroups]
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map((group) => {
      const groupView = progressionView.draftView.groups.find((item) => item.groupId === group.id);

      if (!groupView || groupView.groupLevel <= 0) {
        return null;
      }

      return {
        groupLevel: groupView.groupLevel,
        name: group.name
      };
    })
    .filter((group): group is { groupLevel: number; name: string } => group !== null);
  const educationLevel = progressionView.draftView.education.theoreticalSkillCount;
  const requestedCheckCount = progressionView.checks.filter((check) => check.status === "requested").length;
  const approvedCheckCount = progressionView.checks.filter(
    (check) => (check.status ?? "approved") === "approved"
  ).length;
  const availableProgressionPoints = progressionView.availablePoints;
  const groupedSkillRows = groupRowsBySkillType(
    rowsByType.skill.map((row) => {
      const skill = content.skills.find((item) => item.id === row.targetId);

      return {
        ...row,
        skillName: row.label,
        skillType: skill ? getPlayerFacingSkillBucket(skill) : "special-access"
      };
    })
  );

  function renderProgressionRow(row: CharacterProgressionTargetRow) {
    const canRequest = !row.requested && !row.approved && !row.pending;
    const canBuy =
      row.approved &&
      !row.pending &&
      row.cost !== undefined &&
      row.cost <= availableProgressionPoints &&
      !row.disabledReason;

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
        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{row.currentValue}</td>
        <td style={{ padding: "0.6rem 0.75rem" }}>
          {row.requested ? "Awaiting GM approval" : row.approved ? "Approved by GM" : "Not requested"}
        </td>
        <td style={{ padding: "0.6rem 0.75rem" }}>{row.approved ? "Approved" : "No"}</td>
        <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{row.cost ?? "-"}</td>
        <td style={{ padding: "0.6rem 0" }}>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <button
              disabled={!canRequest}
              onClick={() => void handleRequestCheck(row.targetType, row.targetId)}
              type="button"
            >
              Request check
            </button>
            <button
              disabled={!canBuy}
              onClick={() => void handleBuyAttempt(row.targetType, row.targetId)}
              type="button"
            >
              Buy attempt
            </button>
          </div>
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
                {characterSheetStatsTableColumns.map((column, index) => (
                  <th
                    key={column}
                    style={{
                      padding: index === 0 ? "0.5rem 0.75rem 0.5rem 0" : "0.5rem 0.75rem",
                      textAlign: index === 0 ? "left" : "right"
                    }}
                  >
                    {column}
                  </th>
                ))}
                <th style={{ padding: "0.5rem 0.75rem" }}>Requested</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Approved</th>
                <th style={{ padding: "0.5rem 0" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {profileStatRows.map((statRow) => {
                const progressionRow = rowsByType.stat.find((row) => row.targetId === statRow.stat);
                const canRequest =
                  progressionRow &&
                  !progressionRow.requested &&
                  !progressionRow.approved &&
                  !progressionRow.pending;

                return (
                  <tr key={statRow.stat} style={{ borderBottom: "1px solid #eee8dc" }}>
                    <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>{statRow.label}</td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                      {statRow.statsDieRollValue}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                      {statRow.originalValue}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                      {statRow.currentValue}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>{statRow.gmValue}</td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>
                      {progressionRow?.requested ? "Awaiting GM" : progressionRow?.approved ? "Approved" : "No"}
                    </td>
                    <td style={{ padding: "0.6rem 0.75rem" }}>{progressionRow?.approved ? "Approved" : "No"}</td>
                    <td style={{ padding: "0.6rem 0" }}>
                      <button
                        disabled={!canRequest}
                        onClick={() =>
                          progressionRow
                            ? void handleRequestCheck(progressionRow.targetType, progressionRow.targetId)
                            : undefined
                        }
                        type="button"
                      >
                        Request
                      </button>
                    </td>
                  </tr>
                );
              })}
              <tr style={{ borderBottom: "1px solid #eee8dc" }}>
                <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>Distraction</td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                  {progressionView.sheetSummary.distractionLevel}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                  {progressionView.sheetSummary.distractionLevel}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>
                  {progressionView.sheetSummary.distractionLevel}
                </td>
                <td style={{ padding: "0.6rem 0.75rem", textAlign: "right" }}>—</td>
                <td colSpan={3} style={{ color: "#5e5a50", padding: "0.6rem 0.75rem" }}>
                  No progression check
                </td>
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
              rowGap: "0.55rem"
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
                Original {progressionView.sheetSummary.skillPoints.original} + successful progression{" "}
                {progressionView.sheetSummary.skillPoints.successfulProgressionGains}
              </div>
            </div>
            <strong>Skill groups</strong>
            <div style={{ display: "grid", gap: "0.2rem" }}>
              {skillGroupSummaryRows.length > 0 ? (
                skillGroupSummaryRows.map((group) => (
                  <div key={group.name}>
                    {group.name} (Level {group.groupLevel})
                  </div>
                ))
              ) : (
                <div>No skill groups recorded.</div>
              )}
            </div>
            <strong>Education</strong>
            <div>{educationLevel}</div>
          </div>
        </section>
      </section>

      <section
        style={{
          background: "#fbfaf5",
          border: "1px solid #d9ddd8",
          borderRadius: 12,
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          position: "sticky",
          top: "0.75rem",
          zIndex: 5,
          alignItems: "center",
          padding: "1rem"
        }}
      >
        <strong>Progression</strong>
        <span>Available points: {progressionView.availablePoints}</span>
        <span>Requested: {requestedCheckCount}</span>
        <span>Approved: {approvedCheckCount}</span>
        <span>Pending: {progressionView.pendingAttempts.length}</span>
        <span>History: {progressionView.history.length}</span>
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
          Request provisional
        </button>
        <button onClick={() => void handleSaveLocally()} type="button">
          Save locally
        </button>
        <button onClick={() => void handleSaveToServer()} type="button">
          Save to server
        </button>
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
              <section key={group.bucketId} style={{ border: "1px solid #e7e2d7", borderRadius: 10, overflowX: "auto" }}>
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
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Current</th>
                      <th style={{ padding: "0.5rem 0.75rem" }}>Requested check</th>
                      <th style={{ padding: "0.5rem 0.75rem" }}>Approved check</th>
                      <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Cost</th>
                      <th style={{ padding: "0.5rem 1rem 0.5rem 0" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>{group.rows.map((row) => renderProgressionRow(row))}</tbody>
                </table>
              </section>
            ))}
          </div>
        ) : (
          <div>No skill progression rows yet.</div>
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
        <h2 style={{ margin: 0 }}>Skill Groups</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Skill group</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Current</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Requested check</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Approved check</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Cost</th>
                <th style={{ padding: "0.5rem 0" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rowsByType.skillGroup.length > 0 ? (
                rowsByType.skillGroup.map((row) => renderProgressionRow(row))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "0.75rem 0" }}>
                    No skill groups recorded.
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
        <h2 style={{ margin: 0 }}>Specializations</h2>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Specialization</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Current</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Requested check</th>
                <th style={{ padding: "0.5rem 0.75rem" }}>Approved check</th>
                <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Cost</th>
                <th style={{ padding: "0.5rem 0" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rowsByType.specialization.length > 0 ? (
                rowsByType.specialization.map((row) => renderProgressionRow(row))
              ) : (
                <tr>
                  <td colSpan={6} style={{ padding: "0.75rem 0" }}>
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
    </section>
  );
}
