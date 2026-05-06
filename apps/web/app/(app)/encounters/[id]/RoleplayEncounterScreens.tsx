"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  Campaign,
  EncounterParticipant,
  EncounterSession,
  RoleplayDifficulty,
  RoleplayParticipantDescription,
  Scenario,
  ScenarioParticipant,
} from "@glantri/domain";
import {
  assignRoleplaySkillRoll,
  buildRoleplayCalculationPreview,
  compareRoleplayOpposedRolls,
  normalizeRoleplayState,
  normalizeRoleplayOtherMod,
  orderRoleplayEncounterParticipants,
  rankRoleplayGmRollResults,
  recordRoleplayGmSkillRoll,
  roleplayDifficultyOptions,
  rollOpenEndedRoleplayD20,
  selectAllRoleplayVisibilityForViewer,
  updateRoleplayGmMessage,
  updateRoleplayParticipantDescription,
  updateRoleplayVisibility,
} from "@glantri/domain";

import {
  loadCampaignById,
  loadEncounterById,
  loadScenarioById,
} from "../../../../src/lib/api/localServiceClient";
import RememberedCampaignWorkspaceEffect from "../../../../src/lib/campaigns/RememberedCampaignWorkspaceEffect";
import { buildCampaignWorkspaceHref } from "../../../../src/lib/campaigns/workspace";
import {
  getPlayerFacingSkillBucket,
  getPlayerFacingSkillBucketDefinitions,
  type PlayerFacingSkillBucketId,
} from "../../../../src/lib/chargen/chargenBrowse";
import type { loadCanonicalContent } from "../../../../src/lib/content/loadCanonicalContent";

interface RoleplayTopInfoProps {
  campaignName?: string;
  encounter: EncounterSession;
  scenarioName?: string;
}

interface GmRoleplayingEncounterScreenProps {
  campaignId?: string;
  campaignName?: string;
  content?: Awaited<ReturnType<typeof loadCanonicalContent>>;
  embedded?: boolean;
  encounter: EncounterSession;
  onPersist: (nextEncounter: EncounterSession, message?: string) => Promise<EncounterSession>;
  scenario?: Scenario | null;
  scenarioId?: string;
  scenarioParticipants: ScenarioParticipant[];
}

interface PlayerRoleplayingEncounterScreenProps {
  campaignId: string;
  embedded?: boolean;
  encounterId: string;
  scenarioId: string;
}

interface SkillOption {
  categoryId?: PlayerFacingSkillBucketId;
  categoryLabel?: string;
  id: string;
  label: string;
  value?: number;
}

interface RoleplayRollDraft {
  difficulty: "none" | RoleplayDifficulty;
  id: string;
  otherModInput: string;
  opponentParticipantId: string;
  opponentSkillCategoryId: "all" | PlayerFacingSkillBucketId;
  opponentSkillId: string;
  participantId: string;
  silent: boolean;
  skillCategoryId: "all" | PlayerFacingSkillBucketId;
  skillId: string;
  supportSkillCategoryId: "all" | PlayerFacingSkillBucketId;
  supportSkillId: string;
  useDbMod: boolean;
  useGenMod: boolean;
  useObSkillMod: boolean;
}

const panelStyle = {
  border: "1px solid #d9ddd8",
  borderRadius: 12,
  display: "grid",
  gap: "0.75rem",
  padding: "1rem",
} as const;

const compactControlStyle = {
  display: "grid",
  gap: "0.2rem",
} as const;

const compactInputStyle = {
  maxWidth: "10rem",
  minHeight: "1.9rem",
} as const;

function formatDifficulty(value: RoleplayDifficulty): string {
  return roleplayDifficultyOptions.find((option) => option.id === value)?.label ?? value;
}

function formatShortDateTime(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  return `${day}.${month} ${hours}:${minutes}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readSkillOptions(input: {
  content?: Awaited<ReturnType<typeof loadCanonicalContent>>;
  encounterParticipant?: EncounterParticipant;
  scenarioParticipants: ScenarioParticipant[];
}): SkillOption[] {
  const scenarioParticipant = input.encounterParticipant?.scenarioParticipantId
    ? input.scenarioParticipants.find(
        (participant) => participant.id === input.encounterParticipant?.scenarioParticipantId
      )
    : undefined;
  const sheetSummary = scenarioParticipant?.snapshot.sheetSummary;
  const draftView = isRecord(sheetSummary) && isRecord(sheetSummary.draftView)
    ? sheetSummary.draftView
    : undefined;
  const draftSkills = Array.isArray(draftView?.skills) ? draftView.skills : [];
  const skillsById = new Map(input.content?.skills.map((skill) => [skill.id, skill.name]) ?? []);

  return draftSkills
    .map((skill): SkillOption | undefined => {
      if (!isRecord(skill) || typeof skill.skillId !== "string") {
        return undefined;
      }

      const label =
        (typeof skill.name === "string" && skill.name.trim()) ||
        skillsById.get(skill.skillId) ||
        skill.skillId;

      return {
        id: skill.skillId,
        label,
        value: readNumber(skill.totalSkill) ?? readNumber(skill.effectiveSkillNumber),
      };
    })
    .filter((skill): skill is SkillOption => Boolean(skill))
    .sort((left, right) => left.label.localeCompare(right.label));
}

function getParticipantSkillValue(input: {
  encounterParticipant?: EncounterParticipant;
  scenarioParticipants: ScenarioParticipant[];
  skillId: string;
}): number {
  const scenarioParticipant = input.encounterParticipant?.scenarioParticipantId
    ? input.scenarioParticipants.find(
        (participant) => participant.id === input.encounterParticipant?.scenarioParticipantId
      )
    : undefined;
  const sheetSummary = scenarioParticipant?.snapshot.sheetSummary;
  const draftView = isRecord(sheetSummary) && isRecord(sheetSummary.draftView)
    ? sheetSummary.draftView
    : undefined;
  const draftSkills = Array.isArray(draftView?.skills) ? draftView.skills : [];
  const matchingSkill = draftSkills.find(
    (skill) => isRecord(skill) && skill.skillId === input.skillId
  );

  if (!isRecord(matchingSkill)) {
    return 0;
  }

  return readNumber(matchingSkill.totalSkill) ?? readNumber(matchingSkill.effectiveSkillNumber) ?? 0;
}

function readSystemSkillOptions(input: {
  content?: Awaited<ReturnType<typeof loadCanonicalContent>>;
  encounterParticipant?: EncounterParticipant;
  scenarioParticipants: ScenarioParticipant[];
}): SkillOption[] {
  const categoryDefinitions = getPlayerFacingSkillBucketDefinitions();
  const categoryLabelById = new Map(categoryDefinitions.map((category) => [category.id, category.label]));

  if (!input.content?.skills.length) {
    return readSkillOptions(input).map((skill) => ({
      ...skill,
      value: skill.value ?? 0,
    }));
  }

  return input.content.skills
    .filter(
      (skill) =>
        (skill.category === "ordinary" || skill.category === "secondary") &&
        !skill.specializationOfSkillId
    )
    .map((skill) => {
      const categoryId = getPlayerFacingSkillBucket(skill);

      return {
        categoryId,
        categoryLabel: categoryLabelById.get(categoryId) ?? categoryId,
        id: skill.id,
        label: skill.name,
        value: getParticipantSkillValue({
          encounterParticipant: input.encounterParticipant,
          scenarioParticipants: input.scenarioParticipants,
          skillId: skill.id,
        }),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

function makeRollDraft(input: { participantId?: string; skillId?: string }): RoleplayRollDraft {
  return {
    difficulty: "none",
    id: `roll-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    otherModInput: "0",
    opponentParticipantId: "",
    opponentSkillCategoryId: "all",
    opponentSkillId: "",
    participantId: input.participantId ?? "",
    silent: false,
    skillCategoryId: "all",
    skillId: input.skillId ?? "",
    supportSkillCategoryId: "all",
    supportSkillId: "",
    useDbMod: false,
    useGenMod: false,
    useObSkillMod: false,
  };
}

function getParticipantDescription(input: {
  fallbackName: string;
  participantId: string;
  state: ReturnType<typeof normalizeRoleplayState>;
}): RoleplayParticipantDescription {
  const existing = input.state.participantDescriptions[input.participantId];

  return {
    detailedDescription: existing?.detailedDescription ?? "",
    name: existing?.name ?? input.fallbackName,
    shortDescription: existing?.shortDescription ?? "",
  };
}

function RoleplayTopInfo({ campaignName, encounter, scenarioName }: RoleplayTopInfoProps) {
  return (
    <section style={panelStyle}>
      <h1 style={{ margin: 0 }}>{encounter.title}</h1>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
        <span>Type: Roleplaying</span>
        <span>Status: {encounter.status}</span>
        {encounter.timelineLabel ? <span>Timeline: {encounter.timelineLabel}</span> : null}
        {scenarioName ? <span>Scenario: {scenarioName}</span> : null}
        {campaignName ? <span>Campaign: {campaignName}</span> : null}
      </div>
      {encounter.description ? <div>{encounter.description}</div> : null}
    </section>
  );
}

export function GmRoleplayingEncounterScreen({
  campaignId,
  campaignName,
  content,
  embedded = false,
  encounter,
  onPersist,
  scenario,
  scenarioId,
  scenarioParticipants,
}: GmRoleplayingEncounterScreenProps) {
  const roleplayState = normalizeRoleplayState(encounter);
  const roster = useMemo(
    () => orderRoleplayEncounterParticipants(encounter.participants),
    [encounter.participants]
  );
  const [gmMessageDraft, setGmMessageDraft] = useState(roleplayState.gmMessage);
  const initialSkillId = useMemo(
    () =>
      readSystemSkillOptions({
        content,
        encounterParticipant: roster[0],
        scenarioParticipants,
      })[0]?.id ?? "",
    [content, roster, scenarioParticipants]
  );
  const [rollDrafts, setRollDrafts] = useState<RoleplayRollDraft[]>([
    makeRollDraft({ participantId: roster[0]?.id, skillId: initialSkillId }),
  ]);
  const rankedRollResults = rankRoleplayGmRollResults(roleplayState);

  useEffect(() => {
    setGmMessageDraft(roleplayState.gmMessage);
  }, [roleplayState.gmMessage]);

  useEffect(() => {
    setRollDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        const participant =
          roster.find((row) => row.id === draft.participantId) ?? roster[0];
        const skillOptions = readSystemSkillOptions({
          content,
          encounterParticipant: participant,
          scenarioParticipants,
        });
        const filteredSkillOptions =
          draft.skillCategoryId === "all"
            ? skillOptions
            : skillOptions.filter((skill) => skill.categoryId === draft.skillCategoryId);
        const supportSkillOptions =
          draft.supportSkillCategoryId === "all"
            ? skillOptions
            : skillOptions.filter((skill) => skill.categoryId === draft.supportSkillCategoryId);
        const opponent =
          roster.find((row) => row.id === draft.opponentParticipantId) ?? undefined;
        const opponentSkillOptions = readSystemSkillOptions({
          content,
          encounterParticipant: opponent,
          scenarioParticipants,
        });
        const filteredOpponentSkillOptions =
          draft.opponentSkillCategoryId === "all"
            ? opponentSkillOptions
            : opponentSkillOptions.filter((skill) => skill.categoryId === draft.opponentSkillCategoryId);

        return {
          ...draft,
          opponentSkillId:
            filteredOpponentSkillOptions.some((skill) => skill.id === draft.opponentSkillId)
              ? draft.opponentSkillId
              : filteredOpponentSkillOptions[0]?.id ?? opponentSkillOptions[0]?.id ?? "",
          participantId: participant?.id ?? "",
          skillId:
            filteredSkillOptions.some((skill) => skill.id === draft.skillId)
              ? draft.skillId
              : filteredSkillOptions[0]?.id ?? skillOptions[0]?.id ?? "",
          supportSkillId:
            draft.supportSkillId === "" || supportSkillOptions.some((skill) => skill.id === draft.supportSkillId)
              ? draft.supportSkillId
              : "",
        };
      })
    );
  }, [content, roster, scenarioParticipants]);

  async function persist(nextEncounter: EncounterSession, message: string) {
    await onPersist(nextEncounter, message);
  }

  async function handleSaveGmMessage() {
    await persist(
      updateRoleplayGmMessage({
        message: gmMessageDraft,
        session: encounter,
      }),
      "Updated roleplaying encounter GM message."
    );
  }

  async function handleVisibilityChange(input: {
    targetParticipantId: string;
    viewerParticipantId: string;
    visible: boolean;
  }) {
    await persist(
      updateRoleplayVisibility({
        session: encounter,
        ...input,
      }),
      "Updated roleplaying visibility."
    );
  }

  async function handleSelectAllVisibility(viewerParticipantId: string) {
    await persist(
      selectAllRoleplayVisibilityForViewer({
        participantIds: roster.map((participant) => participant.id),
        session: encounter,
        viewerParticipantId,
      }),
      "Updated roleplaying visibility row."
    );
  }

  async function handleDescriptionSave(input: {
    description: RoleplayParticipantDescription;
    participantId: string;
  }) {
    await persist(
      updateRoleplayParticipantDescription({
        description: input.description,
        participantId: input.participantId,
        session: encounter,
      }),
      "Updated roleplaying participant description."
    );
  }

  function updateRollDraft(draftId: string, patch: Partial<RoleplayRollDraft>) {
    setRollDrafts((currentDrafts) =>
      currentDrafts.map((draft) => (draft.id === draftId ? { ...draft, ...patch } : draft))
    );
  }

  function getRollDraftContext(draft: RoleplayRollDraft) {
    const participant = roster.find((row) => row.id === draft.participantId) ?? roster[0];
    const allSkillOptions = readSystemSkillOptions({
      content,
      encounterParticipant: participant,
      scenarioParticipants,
    });
    const skillOptions =
      draft.skillCategoryId === "all"
        ? allSkillOptions
        : allSkillOptions.filter((skill) => skill.categoryId === draft.skillCategoryId);
    const selectedSkill = skillOptions.find((skill) => skill.id === draft.skillId) ?? skillOptions[0];
    const supportSkillOptions =
      draft.supportSkillCategoryId === "all"
        ? allSkillOptions
        : allSkillOptions.filter((skill) => skill.categoryId === draft.supportSkillCategoryId);
    const selectedSupportSkill =
      draft.supportSkillId === ""
        ? undefined
        : supportSkillOptions.find((skill) => skill.id === draft.supportSkillId);
    const opponent =
      roster.find((row) => row.id === draft.opponentParticipantId) ?? undefined;
    const allOpponentSkillOptions = readSystemSkillOptions({
      content,
      encounterParticipant: opponent,
      scenarioParticipants,
    });
    const opponentSkillOptions =
      draft.opponentSkillCategoryId === "all"
        ? allOpponentSkillOptions
        : allOpponentSkillOptions.filter((skill) => skill.categoryId === draft.opponentSkillCategoryId);
    const selectedOpponentSkill =
      opponentSkillOptions.find((skill) => skill.id === draft.opponentSkillId) ??
      opponentSkillOptions[0];
    const otherMod = normalizeRoleplayOtherMod(draft.otherModInput);
    const isOpposed = Boolean(opponent && selectedOpponentSkill);
    const preview = selectedSkill
      ? buildRoleplayCalculationPreview({
          difficulty: isOpposed || draft.difficulty === "none" ? undefined : draft.difficulty,
          otherMod,
          skillLabel: selectedSkill.label,
          skillValue: selectedSkill.value,
          useDbMod: draft.useDbMod,
          useGenMod: draft.useGenMod,
          useObSkillMod: draft.useObSkillMod,
        })
      : undefined;
    const opponentPreview =
      opponent && selectedOpponentSkill
        ? buildRoleplayCalculationPreview({
            skillLabel: selectedOpponentSkill.label,
            skillValue: selectedOpponentSkill.value,
          })
        : undefined;

    return {
      allOpponentSkillOptions,
      allSkillOptions,
      isOpposed,
      opponent,
      opponentPreview,
      opponentSkillOptions,
      otherMod,
      participant,
      preview,
      selectedOpponentSkill,
      selectedSkill,
      selectedSupportSkill,
      skillOptions,
      supportSkillOptions,
    };
  }

  async function handleAssignSkillRoll(draft: RoleplayRollDraft) {
    const {
      isOpposed,
      opponent,
      otherMod,
      participant,
      selectedOpponentSkill,
      selectedSkill,
      selectedSupportSkill,
    } = getRollDraftContext(draft);

    if (!participant || !selectedSkill) {
      return;
    }

    await persist(
      assignRoleplaySkillRoll({
        difficulty: isOpposed || draft.difficulty === "none" ? undefined : draft.difficulty,
        mode: isOpposed ? "opposed" : "difficulty",
        opponentParticipantId: isOpposed ? opponent?.id : undefined,
        opponentParticipantName: isOpposed ? opponent?.label : undefined,
        opponentSkillId: isOpposed ? selectedOpponentSkill?.id : undefined,
        opponentSkillLabel: isOpposed ? selectedOpponentSkill?.label : undefined,
        opponentSkillValue: isOpposed ? selectedOpponentSkill?.value : undefined,
        otherMod,
        participantId: participant.id,
        session: encounter,
        silent: draft.silent,
        skillId: selectedSkill.id,
        skillLabel: selectedSkill.label,
        skillValue: selectedSkill.value,
        supportSkillId: selectedSupportSkill?.id,
        supportSkillLabel: selectedSupportSkill?.label,
        useDbMod: draft.useDbMod,
        useGenMod: draft.useGenMod,
        useObSkillMod: draft.useObSkillMod,
      }),
      "Assigned roleplaying skill roll."
    );
  }

  async function handleGmRoll(draft: RoleplayRollDraft) {
    const {
      isOpposed,
      opponent,
      otherMod,
      participant,
      selectedOpponentSkill,
      selectedSkill,
      selectedSupportSkill,
    } = getRollDraftContext(draft);

    if (!participant || !selectedSkill) {
      return;
    }

    const roll = rollOpenEndedRoleplayD20();
    const opponentRoll = isOpposed ? rollOpenEndedRoleplayD20() : undefined;
    const preview = buildRoleplayCalculationPreview({
      difficulty: isOpposed || draft.difficulty === "none" ? undefined : draft.difficulty,
      otherMod,
      roll,
      skillLabel: selectedSkill.label,
      skillValue: selectedSkill.value,
      useDbMod: draft.useDbMod,
      useGenMod: draft.useGenMod,
      useObSkillMod: draft.useObSkillMod,
    });
    const opponentPreview =
      opponentRoll && selectedOpponentSkill
        ? buildRoleplayCalculationPreview({
            roll: opponentRoll,
            skillLabel: selectedOpponentSkill.label,
            skillValue: selectedOpponentSkill.value,
          })
        : undefined;
    const opposedResult =
      isOpposed && opponent && opponentPreview
        ? compareRoleplayOpposedRolls({
            actorLabel: participant.label,
            actorPreview: preview,
            opponentLabel: opponent.label,
            opponentPreview,
          })
        : undefined;
    const calculationText = [
      selectedSupportSkill ? `Support: ${selectedSupportSkill.label} (pending support rule)` : undefined,
      isOpposed && opponentPreview
        ? `Actor: ${preview.calculationText} · VERSUS · Opponent: ${opponentPreview.calculationText} · ${opposedResult?.summary ?? "Opposed result pending."}`
        : preview.calculationText,
    ]
      .filter(Boolean)
      .join(" · ");

    await persist(
      recordRoleplayGmSkillRoll({
        calculationText,
        difficulty: isOpposed || draft.difficulty === "none" ? undefined : draft.difficulty,
        achievedSuccessLevel: preview.achievedSuccessLevel,
        autoSuccess: preview.autoSuccess,
        dieResult: roll.dieResult,
        finalTotal: preview.finalTotal,
        fumble: preview.fumble,
        mode: isOpposed ? "opposed" : "difficulty",
        numericSubtotal: preview.numericSubtotal,
        openEndedD10s: roll.openEndedD10s,
        opposedMargin: opposedResult?.margin,
        opposedResult: opposedResult?.result,
        opponentAchievedSuccessLevel: opponentPreview?.achievedSuccessLevel,
        opponentDieResult: opponentRoll?.dieResult,
        opponentFumble: opponentPreview?.fumble,
        opponentNumericSubtotal: opponentPreview?.numericSubtotal,
        opponentOpenEndedD10s: opponentRoll?.openEndedD10s,
        opponentParticipantId: isOpposed ? opponent?.id : undefined,
        opponentParticipantName: isOpposed ? opponent?.label : undefined,
        opponentRoll,
        opponentSkillId: isOpposed ? selectedOpponentSkill?.id : undefined,
        opponentSkillLabel: isOpposed ? selectedOpponentSkill?.label : undefined,
        otherMod,
        partial: preview.partial || Boolean(opponentPreview?.partial),
        participantId: participant.id,
        roll,
        session: encounter,
        silent: draft.silent,
        skillId: selectedSkill.id,
        skillLabel: selectedSkill.label,
        success: preview.success,
        supportSkillId: selectedSupportSkill?.id,
        supportSkillLabel: selectedSupportSkill?.label,
        useDbMod: draft.useDbMod,
        useGenMod: draft.useGenMod,
        useObSkillMod: draft.useObSkillMod,
      }),
      "Recorded GM roleplaying skill roll."
    );
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 1120 }}>
      {campaignId && scenarioId ? (
        <RememberedCampaignWorkspaceEffect
          campaignId={campaignId}
          encounterId={encounter.id}
          scenarioId={scenarioId}
          tab="gm-encounter"
        />
      ) : null}
      {!embedded && campaignId && scenarioId ? (
        <Link href={buildCampaignWorkspaceHref({ campaignId, scenarioId, tab: "scenario" })}>
          Back to scenario
        </Link>
      ) : null}
      <RoleplayTopInfo
        campaignName={campaignName}
        encounter={encounter}
        scenarioName={scenario?.name}
      />

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>GM message</h2>
        <textarea
          onChange={(event) => setGmMessageDraft(event.target.value)}
          placeholder="Message intended for player roleplaying screens."
          rows={4}
          value={gmMessageDraft}
        />
        <button onClick={() => void handleSaveGmMessage()} type="button">
          Save GM message
        </button>
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Visibility grid</h2>
        {roster.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "collapse", minWidth: 760, width: "100%" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                  <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Viewer</th>
                  <th style={{ padding: "0.5rem 0.75rem" }}>Row action</th>
                  {roster.map((target) => (
                    <th key={target.id} style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                      {target.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roster.map((viewer) => (
                  <tr key={viewer.id} style={{ borderBottom: "1px solid #eee8dc" }}>
                    <td style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>{viewer.label}</td>
                    <td style={{ padding: "0.5rem 0.75rem" }}>
                      <button onClick={() => void handleSelectAllVisibility(viewer.id)} type="button">
                        Select all
                      </button>
                    </td>
                    {roster.map((target) => (
                      <td key={target.id} style={{ padding: "0.5rem 0.75rem", textAlign: "center" }}>
                        <input
                          aria-label={`${viewer.label} can see ${target.label}`}
                          checked={
                            viewer.id === target.id ||
                            Boolean(roleplayState.visibility[viewer.id]?.[target.id])
                          }
                          disabled={viewer.id === target.id}
                          onChange={(event) =>
                            void handleVisibilityChange({
                              targetParticipantId: target.id,
                              viewerParticipantId: viewer.id,
                              visible: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div>Add participants to this encounter from the Scenario screen before setting visibility.</div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Roleplay roster descriptions</h2>
        {roster.length > 0 ? (
          <div style={{ display: "grid", gap: "0.75rem", maxHeight: "36rem", overflow: "auto" }}>
            {roster.map((participant) => (
              <RoleplayDescriptionRow
                description={getParticipantDescription({
                  fallbackName: participant.label,
                  participantId: participant.id,
                  state: roleplayState,
                })}
                key={participant.id}
                onSave={(description) =>
                  void handleDescriptionSave({
                    description,
                    participantId: participant.id,
                  })
                }
                participant={participant}
              />
            ))}
          </div>
        ) : (
          <div>No participants are assigned to this roleplaying encounter yet.</div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Skill roll assignment</h2>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {rollDrafts.map((draft, index) => {
            const context = getRollDraftContext(draft);
            const categoryOptions = getPlayerFacingSkillBucketDefinitions().filter((category) =>
              context.allSkillOptions.some((skill) => skill.categoryId === category.id)
            );
            const supportCategoryOptions = getPlayerFacingSkillBucketDefinitions().filter((category) =>
              context.allSkillOptions.some((skill) => skill.categoryId === category.id)
            );
            const opponentCategoryOptions = getPlayerFacingSkillBucketDefinitions().filter((category) =>
              context.allOpponentSkillOptions.some((skill) => skill.categoryId === category.id)
            );

            return (
              <div
                key={draft.id}
                style={{ border: "1px solid #eee8dc", borderRadius: 10, display: "grid", gap: "0.65rem", padding: "0.75rem" }}
              >
                <strong>Roll {index + 1}</strong>
                <div style={{ alignItems: "end", display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                  <label style={compactControlStyle}>
                    <span>Character</span>
                    <select
                      aria-label={`Roleplay roll ${index + 1} participant`}
                      onChange={(event) => {
                        const participant = roster.find((row) => row.id === event.target.value);
                        const nextSkillId = readSystemSkillOptions({
                          content,
                          encounterParticipant: participant,
                          scenarioParticipants,
                        })[0]?.id ?? "";
                        updateRollDraft(draft.id, {
                          participantId: event.target.value,
                          skillCategoryId: "all",
                          skillId: nextSkillId,
                        });
                      }}
                      style={compactInputStyle}
                      value={context.participant?.id ?? ""}
                    >
                      {roster.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={compactControlStyle}>
                    <span>Category</span>
                    <select
                      aria-label={`Roleplay roll ${index + 1} skill category`}
                      onChange={(event) => {
                        const nextCategoryId = event.target.value as RoleplayRollDraft["skillCategoryId"];
                        const nextSkillOptions =
                          nextCategoryId === "all"
                            ? context.allSkillOptions
                            : context.allSkillOptions.filter((skill) => skill.categoryId === nextCategoryId);

                        updateRollDraft(draft.id, {
                          skillCategoryId: nextCategoryId,
                          skillId: nextSkillOptions[0]?.id ?? "",
                        });
                      }}
                      style={compactInputStyle}
                      value={draft.skillCategoryId}
                    >
                      <option value="all">All categories</option>
                      {categoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={compactControlStyle}>
                    <span>Skill</span>
                    <select
                      aria-label={`Roleplay roll ${index + 1} skill`}
                      disabled={context.skillOptions.length === 0}
                      onChange={(event) => updateRollDraft(draft.id, { skillId: event.target.value })}
                      style={compactInputStyle}
                      value={context.selectedSkill?.id ?? ""}
                    >
                      {context.skillOptions.length > 0 ? (
                        context.skillOptions.map((skill) => (
                          <option key={skill.id} value={skill.id}>
                            {skill.label} ({skill.value ?? 0})
                          </option>
                        ))
                      ) : (
                        <option value="">No skills available</option>
                      )}
                    </select>
                  </label>
                  <label style={compactControlStyle}>
                    <span>Support cat.</span>
                    <select
                      aria-label={`Roleplay roll ${index + 1} support skill category`}
                      onChange={(event) => {
                        const nextCategoryId = event.target.value as RoleplayRollDraft["supportSkillCategoryId"];
                        updateRollDraft(draft.id, {
                          supportSkillCategoryId: nextCategoryId,
                          supportSkillId: "",
                        });
                      }}
                      style={compactInputStyle}
                      value={draft.supportSkillCategoryId}
                    >
                      <option value="all">All categories</option>
                      {supportCategoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={compactControlStyle}>
                    <span>Support</span>
                    <select
                      aria-label={`Roleplay roll ${index + 1} support skill`}
                      onChange={(event) => updateRollDraft(draft.id, { supportSkillId: event.target.value })}
                      style={compactInputStyle}
                      value={context.selectedSupportSkill?.id ?? ""}
                    >
                      <option value="">No support skill</option>
                      {context.supportSkillOptions.map((skill) => (
                        <option key={skill.id} value={skill.id}>
                          {skill.label} ({skill.value ?? 0})
                        </option>
                      ))}
                    </select>
                  </label>
                  <strong style={{ alignSelf: "center", paddingBottom: "0.35rem" }}>VS</strong>
                  <label style={compactControlStyle}>
                    <span>Level</span>
                    <select
                      aria-label={`Roleplay roll ${index + 1} difficulty`}
                      onChange={(event) => {
                        const nextDifficulty = event.target.value as RoleplayRollDraft["difficulty"];
                        updateRollDraft(draft.id, {
                          difficulty: nextDifficulty,
                          opponentParticipantId: nextDifficulty === "none" ? draft.opponentParticipantId : "",
                          opponentSkillCategoryId: nextDifficulty === "none" ? draft.opponentSkillCategoryId : "all",
                          opponentSkillId: nextDifficulty === "none" ? draft.opponentSkillId : "",
                        });
                      }}
                      style={compactInputStyle}
                      value={draft.difficulty}
                    >
                      <option value="none">No level</option>
                      {roleplayDifficultyOptions.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={compactControlStyle}>
                    <span>Opponent</span>
                    <select
                      aria-label={`Roleplay roll ${index + 1} opponent`}
                      onChange={(event) => {
                        const opponent = roster.find((row) => row.id === event.target.value);
                        const nextOpponentSkillId = readSystemSkillOptions({
                          content,
                          encounterParticipant: opponent,
                          scenarioParticipants,
                        })[0]?.id ?? "";
                        updateRollDraft(draft.id, {
                          difficulty: "none",
                          opponentParticipantId: event.target.value,
                          opponentSkillCategoryId: "all",
                          opponentSkillId: event.target.value ? nextOpponentSkillId : "",
                        });
                      }}
                      style={compactInputStyle}
                      value={context.opponent?.id ?? ""}
                    >
                      <option value="">No opponent</option>
                      {roster.map((participant) => (
                        <option key={participant.id} value={participant.id}>
                          {participant.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={compactControlStyle}>
                    <span>Opp. cat.</span>
                    <select
                      aria-label={`Roleplay roll ${index + 1} opponent skill category`}
                      disabled={!context.opponent}
                      onChange={(event) => {
                        const nextCategoryId = event.target.value as RoleplayRollDraft["opponentSkillCategoryId"];
                        const nextSkillOptions =
                          nextCategoryId === "all"
                            ? context.allOpponentSkillOptions
                            : context.allOpponentSkillOptions.filter((skill) => skill.categoryId === nextCategoryId);

                        updateRollDraft(draft.id, {
                          opponentSkillCategoryId: nextCategoryId,
                          opponentSkillId: nextSkillOptions[0]?.id ?? "",
                        });
                      }}
                      style={compactInputStyle}
                      value={draft.opponentSkillCategoryId}
                    >
                      <option value="all">All categories</option>
                      {opponentCategoryOptions.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={compactControlStyle}>
                    <span>Opp. skill</span>
                    <select
                      aria-label={`Roleplay roll ${index + 1} opponent skill`}
                      disabled={!context.opponent || context.opponentSkillOptions.length === 0}
                      onChange={(event) => updateRollDraft(draft.id, { opponentSkillId: event.target.value })}
                      style={compactInputStyle}
                      value={context.selectedOpponentSkill?.id ?? ""}
                    >
                      {context.opponentSkillOptions.length > 0 ? (
                        context.opponentSkillOptions.map((skill) => (
                          <option key={skill.id} value={skill.id}>
                            {skill.label} ({skill.value ?? 0})
                          </option>
                        ))
                      ) : (
                        <option value="">No opponent skill</option>
                      )}
                    </select>
                  </label>
                  <label style={compactControlStyle}>
                    <span>Other</span>
                    <input
                      aria-label={`Roleplay roll ${index + 1} Other mod`}
                      onChange={(event) => updateRollDraft(draft.id, { otherModInput: event.target.value })}
                      step={1}
                      style={{ ...compactInputStyle, width: "4.5rem" }}
                      type="number"
                      value={draft.otherModInput}
                    />
                  </label>
                </div>
                <div style={{ alignItems: "center", display: "flex", flexWrap: "wrap", gap: "0.55rem" }}>
                  <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                    <input
                      checked={draft.silent}
                      onChange={(event) => updateRollDraft(draft.id, { silent: event.target.checked })}
                      type="checkbox"
                    />
                    Silent
                  </label>
                  <span>Use:</span>
                  <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                    <input
                      checked={draft.useGenMod}
                      onChange={(event) => updateRollDraft(draft.id, { useGenMod: event.target.checked })}
                      type="checkbox"
                    />
                    Gen
                  </label>
                  <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                    <input
                      checked={draft.useObSkillMod}
                      onChange={(event) => updateRollDraft(draft.id, { useObSkillMod: event.target.checked })}
                      type="checkbox"
                    />
                    OB/Skill
                  </label>
                  <label style={{ alignItems: "center", display: "flex", gap: "0.35rem" }}>
                    <input
                      checked={draft.useDbMod}
                      onChange={(event) => updateRollDraft(draft.id, { useDbMod: event.target.checked })}
                      type="checkbox"
                    />
                    DB
                  </label>
                </div>
                {context.preview ? (
                  <div style={{ color: "#5e5a50" }}>
                    <div>{context.isOpposed ? `Actor: ${context.preview.calculationText}` : context.preview.calculationText}</div>
                    {context.isOpposed && context.opponentPreview ? (
                      <div>Opponent: {context.opponentPreview.calculationText}</div>
                    ) : null}
                    {context.preview.pendingModifierLabels.length > 0 ? (
                      <div>Pending modifiers: {context.preview.pendingModifierLabels.join(", ")}</div>
                    ) : null}
                    {context.selectedSupportSkill ? (
                      <div>Support: {context.selectedSupportSkill.label} — pending support rule</div>
                    ) : null}
                  </div>
                ) : null}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
                  <button
                    disabled={!context.participant || !context.selectedSkill}
                    onClick={() => void handleAssignSkillRoll(draft)}
                    type="button"
                  >
                    Assign
                  </button>
                  <button
                    disabled={!context.participant || !context.selectedSkill}
                    onClick={() => void handleGmRoll(draft)}
                    type="button"
                  >
                    {context.isOpposed ? "GM Roll both" : "GM Roll"}
                  </button>
                </div>
              </div>
            );
          })}
          <button
            onClick={() =>
              setRollDrafts((currentDrafts) => [
                ...currentDrafts,
                makeRollDraft({ participantId: roster[0]?.id, skillId: initialSkillId }),
              ])
            }
            type="button"
          >
            Add roll
          </button>
        </div>
        <div style={{ color: "#5e5a50" }}>
          GM Roll uses the roleplay open-ended d20 table for non-opposed skill rolls.
          Gen, OB/Skill, and DB flags remain visible placeholder modifiers until numeric sources are defined.
        </div>
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Ranked roll results</h2>
        {rankedRollResults.length > 0 ? (
          <div style={{ display: "grid", gap: "0.35rem" }}>
            {rankedRollResults.map((entry, index) => {
              const participantLabel =
                roster.find((participant) => participant.id === entry.participantId)?.label ??
                entry.participantId ??
                "Unknown participant";

              return (
                <div key={entry.id}>
                  {index + 1}. {entry.mode === "opposed" ? (
                    <>
                      {participantLabel} {entry.skillLabel ?? "Unknown skill"}{" "}
                      {entry.numericSubtotal == null ? "unresolved" : entry.numericSubtotal} vs{" "}
                      {entry.opponentParticipantName ?? "Unknown opponent"}{" "}
                      {entry.opponentSkillLabel ?? "Unknown skill"}{" "}
                      {entry.opponentNumericSubtotal == null ? "unresolved" : entry.opponentNumericSubtotal} —{" "}
                      {entry.opposedResult === "win"
                        ? `actor wins by ${entry.opposedMargin ?? 0}`
                        : entry.opposedResult === "loss"
                          ? `opponent wins by ${entry.opposedMargin ?? 0}`
                          : entry.opposedResult === "tie"
                            ? "tie"
                            : "pending"}
                    </>
                  ) : (
                    <>
                      {participantLabel} · {entry.skillLabel ?? "Unknown skill"} ·{" "}
                      {entry.fumble ? "FUMBLE" : entry.numericSubtotal == null ? "unresolved" : `total ${entry.numericSubtotal}`} ·{" "}
                      {entry.achievedSuccessLevelLabel ?? "No level"} · modifier{" "}
                      {entry.resultModifier == null ? "—" : `${entry.resultModifier >= 0 ? "+" : ""}${entry.resultModifier}`} ·{" "}
                      {entry.difficulty ? formatDifficulty(entry.difficulty) : "No difficulty"} ·{" "}
                      {entry.success == null ? "level only" : entry.success ? "SUCCESS" : "NOT SUCCESSFUL"}
                    </>
                  )}
                  {entry.partial ? " · Partial" : ""}
                  {entry.silent ? " · Silent" : ""} ·{" "}
                  {formatShortDateTime(entry.createdAt)}
                </div>
              );
            })}
          </div>
        ) : (
          <div>No GM roll results recorded yet.</div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Action log</h2>
        {roleplayState.actionLog.length > 0 ? (
          <div style={{ display: "grid", gap: "0.35rem" }}>
            {roleplayState.actionLog.map((entry) => (
              <div key={entry.id}>
                {formatShortDateTime(entry.createdAt)} · {entry.summary}
                {entry.skillLabel ? ` · ${entry.skillLabel}` : ""}
                {entry.supportSkillLabel ? ` · Support ${entry.supportSkillLabel}` : ""}
                {entry.difficulty ? ` · ${formatDifficulty(entry.difficulty)}` : ""}
                {entry.rollD20 == null ? "" : ` · d20 ${entry.rollD20}`}
                {entry.openEndedD10s.length > 0 ? ` · d10s ${entry.openEndedD10s.join(", ")}` : ""}
                {entry.dieResult == null ? "" : ` · die ${entry.dieResult}`}
                {entry.numericSubtotal == null ? "" : ` · total ${entry.numericSubtotal}`}
                {entry.opponentSkillLabel ? ` · VERSUS ${entry.opponentParticipantName ?? "Opponent"} ${entry.opponentSkillLabel}` : ""}
                {entry.opponentRollD20 == null ? "" : ` · opponent d20 ${entry.opponentRollD20}`}
                {entry.opponentOpenEndedD10s.length > 0 ? ` · opponent d10s ${entry.opponentOpenEndedD10s.join(", ")}` : ""}
                {entry.opponentDieResult == null ? "" : ` · opponent die ${entry.opponentDieResult}`}
                {entry.opponentNumericSubtotal == null ? "" : ` · opponent total ${entry.opponentNumericSubtotal}`}
                {entry.opponentAchievedSuccessLevelLabel ? ` · opponent ${entry.opponentAchievedSuccessLevelLabel}` : ""}
                {entry.opposedResult ? ` · opposed ${entry.opposedResult}` : ""}
                {entry.opposedMargin == null ? "" : ` · margin ${entry.opposedMargin}`}
                {entry.achievedSuccessLevelLabel ? ` · ${entry.achievedSuccessLevelLabel}` : ""}
                {entry.resultModifier == null ? "" : ` · modifier ${entry.resultModifier >= 0 ? "+" : ""}${entry.resultModifier}`}
                {entry.success == null ? "" : entry.success ? " · SUCCESS" : " · NOT SUCCESSFUL"}
                {entry.fumble ? " · FUMBLE" : ""}
                {entry.partial ? " · Partial" : ""}
                {entry.useGenMod ? " · Gen mod" : ""}
                {entry.useObSkillMod ? " · OB/Skill mod" : ""}
                {entry.useDbMod ? " · DB mod" : ""}
                {entry.otherMod ? ` · Other ${entry.otherMod > 0 ? "+" : ""}${entry.otherMod}` : ""}
                {entry.silent ? " · Silent" : ""}
                {entry.calculationText ? ` · ${entry.calculationText}` : ""}
              </div>
            ))}
          </div>
        ) : (
          <div>No roleplaying actions logged yet.</div>
        )}
      </section>
    </section>
  );
}

function RoleplayDescriptionRow(input: {
  description: RoleplayParticipantDescription;
  onSave: (description: RoleplayParticipantDescription) => void;
  participant: EncounterParticipant;
}) {
  const [name, setName] = useState(input.description.name ?? input.participant.label);
  const [shortDescription, setShortDescription] = useState(input.description.shortDescription);
  const [detailedDescription, setDetailedDescription] = useState(input.description.detailedDescription);

  useEffect(() => {
    setName(input.description.name ?? input.participant.label);
    setShortDescription(input.description.shortDescription);
    setDetailedDescription(input.description.detailedDescription);
  }, [input.description, input.participant.label]);

  return (
    <details style={{ border: "1px solid #eee8dc", borderRadius: 10, padding: "0.75rem" }}>
      <summary>
        <strong>{input.participant.label}</strong>
      </summary>
      <div style={{ display: "grid", gap: "0.5rem", marginTop: "0.75rem" }}>
        <input
          aria-label={`${input.participant.label} encounter-facing name`}
          onChange={(event) => setName(event.target.value)}
          placeholder="Encounter-facing name"
          value={name}
        />
        <input
          aria-label={`${input.participant.label} short description`}
          onChange={(event) => setShortDescription(event.target.value)}
          placeholder="Short description"
          value={shortDescription}
        />
        <textarea
          aria-label={`${input.participant.label} detailed description`}
          onChange={(event) => setDetailedDescription(event.target.value)}
          placeholder="Detailed GM description"
          rows={3}
          value={detailedDescription}
        />
        <button
          onClick={() =>
            input.onSave({
              detailedDescription,
              name: name.trim() || input.participant.label,
              shortDescription,
            })
          }
          type="button"
        >
          Save description
        </button>
      </div>
    </details>
  );
}

export function PlayerRoleplayingEncounterScreen({
  campaignId,
  embedded = false,
  encounterId,
  scenarioId,
}: PlayerRoleplayingEncounterScreenProps) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [encounter, setEncounter] = useState<EncounterSession | null>(null);
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadRoleplayEncounter() {
      const [nextEncounter, nextScenario, nextCampaign] = await Promise.all([
        loadEncounterById(encounterId),
        loadScenarioById(scenarioId),
        loadCampaignById(campaignId).catch(() => null),
      ]);

      if (cancelled) {
        return;
      }

      setEncounter(nextEncounter);
      setScenario(nextScenario);
      setCampaign(nextCampaign);
      setLoading(false);
    }

    void loadRoleplayEncounter();

    return () => {
      cancelled = true;
    };
  }, [campaignId, encounterId, scenarioId]);

  if (loading) {
    return <section>Loading roleplaying encounter...</section>;
  }

  if (!encounter) {
    return <section>Roleplaying encounter not found.</section>;
  }

  const roleplayState = normalizeRoleplayState(encounter);

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 900 }}>
      <RememberedCampaignWorkspaceEffect
        campaignId={campaignId}
        encounterId={encounterId}
        scenarioId={scenarioId}
        tab="player-encounter"
      />
      {!embedded ? (
        <Link href={buildCampaignWorkspaceHref({ campaignId, scenarioId, tab: "scenario" })}>
          Back to scenario
        </Link>
      ) : null}
      <RoleplayTopInfo
        campaignName={campaign?.name}
        encounter={encounter}
        scenarioName={scenario?.name}
      />
      {roleplayState.gmMessage ? (
        <section style={panelStyle}>
          <h2 style={{ margin: 0 }}>GM message</h2>
          <div>{roleplayState.gmMessage}</div>
        </section>
      ) : null}
      <section style={panelStyle}>
        Roleplaying encounter player tools will appear here.
      </section>
    </section>
  );
}
