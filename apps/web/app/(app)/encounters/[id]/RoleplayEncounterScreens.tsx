"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type {
  Campaign,
  EncounterParticipant,
  EncounterSession,
  RoleplayActionLogEntry,
  RoleplayCalculationPreview,
  RoleplayOpenEndedD20Roll,
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
  recordRoleplayGmSkillRoll,
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
} from "@/lib/api/localServiceClient";
import RememberedCampaignWorkspaceEffect from "@/lib/campaigns/RememberedCampaignWorkspaceEffect";
import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";
import {
  getPlayerFacingSkillBucket,
  getPlayerFacingSkillBucketDefinitions,
} from "@/lib/chargen/chargenBrowse";
import type { loadCanonicalContent } from "@/lib/content/loadCanonicalContent";

import { RoleplayRollBlock } from "./components/RoleplayRollBlock";
import {
  EncounterInfoCard,
  GmMessageSection,
  ParticipantDescriptionsSection,
  PlayerRoleplayEncounterView,
  RankedRollResultsSection,
  RoleplayActionLogSection,
  VisibilityGridSection,
} from "./components/RoleplaySections";
import { panelStyle } from "./components/roleplayStyles";
import type {
  RoleplayRollAssignSide,
  RoleplayRollContext,
  RoleplayRollDraft,
  RoleplayRollGmSide,
  SkillOption,
} from "./components/roleplayRollTypes";

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

function makeRollDraft(input: { id?: string; participantId?: string; skillId?: string }): RoleplayRollDraft {
  return {
    difficulty: "medium",
    id: input.id ?? `roll-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    otherModInput: "0",
    opponentBlockOpen: false,
    opponentOtherModInput: "0",
    opponentParticipantId: "",
    opponentSkillCategoryId: "all",
    opponentSkillId: "",
    opponentSilent: false,
    opponentSupportSkillCategoryId: "all",
    opponentSupportSkillId: "",
    opponentUseDbMod: false,
    opponentUseGenMod: false,
    opponentUseObSkillMod: false,
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
  const [currentRankedRollResults, setCurrentRankedRollResults] = useState<RoleplayActionLogEntry[]>([]);

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
        const opponentSupportSkillOptions =
          draft.opponentSupportSkillCategoryId === "all"
            ? opponentSkillOptions
            : opponentSkillOptions.filter((skill) => skill.categoryId === draft.opponentSupportSkillCategoryId);

        return {
          ...draft,
          opponentSkillId:
            !draft.opponentBlockOpen || draft.opponentSkillId === ""
              ? ""
              : filteredOpponentSkillOptions.some((skill) => skill.id === draft.opponentSkillId)
                ? draft.opponentSkillId
                : "",
          opponentSupportSkillId:
            draft.opponentSupportSkillId === "" ||
            opponentSupportSkillOptions.some((skill) => skill.id === draft.opponentSupportSkillId)
              ? draft.opponentSupportSkillId
              : "",
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

  function handleActorParticipantChange(draftId: string, participantId: string) {
    const participant = roster.find((row) => row.id === participantId);
    const nextSkillId = readSystemSkillOptions({
      content,
      encounterParticipant: participant,
      scenarioParticipants,
    })[0]?.id ?? "";

    updateRollDraft(draftId, {
      participantId,
      skillCategoryId: "all",
      skillId: nextSkillId,
    });
  }

  function resetRollDrafts() {
    setRollDrafts([
      makeRollDraft({
        participantId: roster[0]?.id,
        skillId: initialSkillId,
      }),
    ]);
    setCurrentRankedRollResults([]);
  }

  function rankVisibleRollResults(entries: RoleplayActionLogEntry[]): RoleplayActionLogEntry[] {
    return [...entries].sort(
      (left, right) =>
        Number(Boolean(left.fumble)) - Number(Boolean(right.fumble)) ||
        (right.numericSubtotal ?? Number.NEGATIVE_INFINITY) -
          (left.numericSubtotal ?? Number.NEGATIVE_INFINITY) ||
        right.createdAt.localeCompare(left.createdAt)
    );
  }

  function replaceDraftRankedRollResults(draftId: string, entries: RoleplayActionLogEntry[]) {
    const draftPrefix = `local-roll-${draftId}-`;
    setCurrentRankedRollResults((currentEntries) =>
      rankVisibleRollResults([
        ...entries,
        ...currentEntries.filter((entry) => !entry.id.startsWith(draftPrefix)),
      ])
    );
  }

  function makeLocalRankedRollEntry(input: {
    draftId: string;
    idSuffix: string;
    participantId: string;
    preview: RoleplayCalculationPreview;
    roll: RoleplayOpenEndedD20Roll;
    silent: boolean;
    skillId: string;
    skillLabel: string;
    supportSkillLabel?: string;
  }): RoleplayActionLogEntry {
    return {
      achievedSuccessLevelId: input.preview.achievedSuccessLevel?.id,
      achievedSuccessLevelLabel: input.preview.achievedSuccessLevel?.label,
      autoSuccess: input.preview.autoSuccess,
      calculationText: input.preview.calculationText,
      createdAt: new Date().toISOString(),
      dieResult: input.roll.dieResult,
      difficulty: undefined,
      finalTotal: input.preview.finalTotal,
      fumble: input.preview.fumble,
      id: `local-roll-${input.draftId}-${input.idSuffix}`,
      mode: "difficulty",
      numericSubtotal: input.preview.numericSubtotal,
      openEndedD10s: input.roll.openEndedD10s,
      opponentFumble: false,
      opponentOpenEndedD10s: [],
      opponentSilent: false,
      partial: input.preview.partial,
      participantId: input.participantId,
      resultModifier: input.preview.achievedSuccessLevel?.resultModifier,
      roll: input.roll.rollD20,
      rollD20: input.roll.rollD20,
      silent: input.silent,
      skillId: input.skillId,
      skillLabel: input.skillLabel,
      success: input.preview.success,
      summary: `GM rolled ${input.skillLabel}.`,
      supportSkillLabel: input.supportSkillLabel,
      type: "gm_skill_roll",
    };
  }

  function getRollDraftContext(draft: RoleplayRollDraft): RoleplayRollContext {
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
      draft.opponentBlockOpen
        ? opponentSkillOptions.find((skill) => skill.id === draft.opponentSkillId)
        : undefined;
    const opponentSupportSkillOptions =
      draft.opponentSupportSkillCategoryId === "all"
        ? allOpponentSkillOptions
        : allOpponentSkillOptions.filter((skill) => skill.categoryId === draft.opponentSupportSkillCategoryId);
    const selectedOpponentSupportSkill =
      draft.opponentSupportSkillId === ""
        ? undefined
        : opponentSupportSkillOptions.find((skill) => skill.id === draft.opponentSupportSkillId);
    const otherMod = normalizeRoleplayOtherMod(draft.otherModInput);
    const opponentOtherMod = normalizeRoleplayOtherMod(draft.opponentOtherModInput);
    const isOpposed = Boolean(opponent && draft.opponentBlockOpen && selectedOpponentSkill);
    const preview = selectedSkill
      ? buildRoleplayCalculationPreview({
          difficulty: isOpposed || draft.difficulty === "none" ? undefined : draft.difficulty,
          otherMod,
          roll: draft.actorRoll,
          skillLabel: selectedSkill.label,
          skillValue: selectedSkill.value,
          useDbMod: draft.useDbMod,
          useGenMod: draft.useGenMod,
          useObSkillMod: draft.useObSkillMod,
        })
      : undefined;
    const supportPreview = selectedSupportSkill
      ? buildRoleplayCalculationPreview({
          roll: draft.actorRoll,
          skillLabel: selectedSupportSkill.label,
          skillValue: selectedSupportSkill.value,
        })
      : undefined;
    const opponentPreview =
      opponent && selectedOpponentSkill
        ? buildRoleplayCalculationPreview({
            otherMod: opponentOtherMod,
            roll: draft.opponentRoll,
            skillLabel: selectedOpponentSkill.label,
            skillValue: selectedOpponentSkill.value,
            useDbMod: draft.opponentUseDbMod,
            useGenMod: draft.opponentUseGenMod,
            useObSkillMod: draft.opponentUseObSkillMod,
          })
        : undefined;
    const opponentSupportPreview = selectedOpponentSupportSkill
      ? buildRoleplayCalculationPreview({
          roll: draft.opponentRoll,
          skillLabel: selectedOpponentSupportSkill.label,
          skillValue: selectedOpponentSupportSkill.value,
        })
      : undefined;

    return {
      allOpponentSkillOptions,
      allSkillOptions,
      isOpposed,
      opponent,
      opponentPreview,
      opponentSupportPreview,
      opponentSupportSkillOptions,
      opponentSkillOptions,
      otherMod,
      opponentOtherMod,
      participant,
      preview,
      selectedOpponentSkill,
      selectedOpponentSupportSkill,
      selectedSkill,
      selectedSupportSkill,
      skillOptions,
      supportPreview,
      supportSkillOptions,
    };
  }

  async function handleAssignSkillRoll(draft: RoleplayRollDraft, side: RoleplayRollAssignSide = "actor") {
    const {
      isOpposed,
      opponent,
      otherMod,
      opponentOtherMod,
      participant,
      selectedOpponentSkill,
      selectedOpponentSupportSkill,
      selectedSkill,
      selectedSupportSkill,
    } = getRollDraftContext(draft);

    if (!participant || !selectedSkill || (side === "opponent" && (!opponent || !selectedOpponentSkill))) {
      return;
    }

    const assigningOpponent = side === "opponent" && opponent && selectedOpponentSkill;

    await persist(
      assignRoleplaySkillRoll({
        difficulty: assigningOpponent || isOpposed || draft.difficulty === "none" ? undefined : draft.difficulty,
        mode: "difficulty",
        otherMod: assigningOpponent ? opponentOtherMod : otherMod,
        participantId: assigningOpponent ? opponent.id : participant.id,
        session: encounter,
        silent: assigningOpponent ? draft.opponentSilent : draft.silent,
        skillId: assigningOpponent ? selectedOpponentSkill.id : selectedSkill.id,
        skillLabel: assigningOpponent ? selectedOpponentSkill.label : selectedSkill.label,
        skillValue: assigningOpponent ? selectedOpponentSkill.value : selectedSkill.value,
        supportSkillId: assigningOpponent ? selectedOpponentSupportSkill?.id : selectedSupportSkill?.id,
        supportSkillLabel: assigningOpponent ? selectedOpponentSupportSkill?.label : selectedSupportSkill?.label,
        useDbMod: assigningOpponent ? draft.opponentUseDbMod : draft.useDbMod,
        useGenMod: assigningOpponent ? draft.opponentUseGenMod : draft.useGenMod,
        useObSkillMod: assigningOpponent ? draft.opponentUseObSkillMod : draft.useObSkillMod,
      }),
      "Assigned roleplaying skill roll."
    );
  }

  async function handleGmRoll(draft: RoleplayRollDraft, side: RoleplayRollGmSide = "actor") {
    const {
      isOpposed,
      opponent,
      otherMod,
      opponentOtherMod,
      participant,
      selectedOpponentSkill,
      selectedOpponentSupportSkill,
      selectedSkill,
      selectedSupportSkill,
    } = getRollDraftContext(draft);

    if (!participant || !selectedSkill) {
      return;
    }

    if ((side === "opponent" || side === "both") && (!opponent || !selectedOpponentSkill)) {
      return;
    }

    const shouldRollActor = side === "actor" || side === "both";
    const shouldRollOpponent = side === "opponent" || side === "both";
    const roll = shouldRollActor ? rollOpenEndedRoleplayD20() : draft.actorRoll;
    const opponentRoll = shouldRollOpponent ? rollOpenEndedRoleplayD20() : draft.opponentRoll;

    if ((side === "actor" || side === "both") && !roll) {
      return;
    }

    if ((side === "opponent" || side === "both") && !opponentRoll) {
      return;
    }

    updateRollDraft(draft.id, {
      actorRoll: roll,
      opponentRoll,
    });
    const preview =
      roll
        ? buildRoleplayCalculationPreview({
            difficulty: isOpposed || draft.difficulty === "none" ? undefined : draft.difficulty,
            otherMod,
            roll,
            skillLabel: selectedSkill.label,
            skillValue: selectedSkill.value,
            useDbMod: draft.useDbMod,
            useGenMod: draft.useGenMod,
            useObSkillMod: draft.useObSkillMod,
          })
        : undefined;
    const opponentPreview =
      opponentRoll && selectedOpponentSkill
        ? buildRoleplayCalculationPreview({
            otherMod: opponentOtherMod,
            roll: opponentRoll,
            skillLabel: selectedOpponentSkill.label,
            skillValue: selectedOpponentSkill.value,
            useDbMod: draft.opponentUseDbMod,
            useGenMod: draft.opponentUseGenMod,
            useObSkillMod: draft.opponentUseObSkillMod,
          })
        : undefined;
    const opposedResult =
      isOpposed && opponent && preview && opponentPreview
        ? compareRoleplayOpposedRolls({
            actorLabel: participant.label,
            actorPreview: preview,
            opponentLabel: opponent.label,
            opponentPreview,
          })
        : undefined;

    if (side === "opponent" && opponent && selectedOpponentSkill && opponentRoll && opponentPreview) {
      await persist(
        recordRoleplayGmSkillRoll({
          calculationText: [
            selectedOpponentSupportSkill ? `Support: ${selectedOpponentSupportSkill.label}` : undefined,
            opponentPreview.calculationText,
          ]
            .filter(Boolean)
            .join(" · "),
          achievedSuccessLevel: opponentPreview.achievedSuccessLevel,
          autoSuccess: opponentPreview.autoSuccess,
          dieResult: opponentRoll.dieResult,
          finalTotal: opponentPreview.finalTotal,
          fumble: opponentPreview.fumble,
          mode: "difficulty",
          numericSubtotal: opponentPreview.numericSubtotal,
          openEndedD10s: opponentRoll.openEndedD10s,
          otherMod: opponentOtherMod,
          partial: opponentPreview.partial,
          participantId: opponent.id,
          roll: opponentRoll,
          session: encounter,
          silent: draft.opponentSilent,
          skillId: selectedOpponentSkill.id,
          skillLabel: selectedOpponentSkill.label,
          supportSkillId: selectedOpponentSupportSkill?.id,
          supportSkillLabel: selectedOpponentSupportSkill?.label,
          useDbMod: draft.opponentUseDbMod,
          useGenMod: draft.opponentUseGenMod,
          useObSkillMod: draft.opponentUseObSkillMod,
        }),
        "Recorded GM roleplaying skill roll."
      );
    } else if (side === "both" && opponent && selectedOpponentSkill && roll && opponentRoll && preview && opponentPreview) {
      const calculationText = [
        selectedSupportSkill ? `Support: ${selectedSupportSkill.label}` : undefined,
        selectedOpponentSupportSkill ? `Opponent support: ${selectedOpponentSupportSkill.label}` : undefined,
        `Actor: ${preview.calculationText} · VERSUS · Opponent: ${opponentPreview.calculationText} · ${opposedResult?.summary ?? "Opposed result pending."}`,
      ]
        .filter(Boolean)
        .join(" · ");

      await persist(
        recordRoleplayGmSkillRoll({
          calculationText,
          achievedSuccessLevel: preview.achievedSuccessLevel,
          autoSuccess: preview.autoSuccess,
          dieResult: roll.dieResult,
          finalTotal: preview.finalTotal,
          fumble: preview.fumble,
          mode: "opposed",
          numericSubtotal: preview.numericSubtotal,
          openEndedD10s: roll.openEndedD10s,
          opposedMargin: opposedResult?.margin,
          opposedResult: opposedResult?.result,
          opponentAchievedSuccessLevel: opponentPreview.achievedSuccessLevel,
          opponentDieResult: opponentRoll.dieResult,
          opponentFumble: opponentPreview.fumble,
          opponentNumericSubtotal: opponentPreview.numericSubtotal,
          opponentOpenEndedD10s: opponentRoll.openEndedD10s,
          opponentParticipantId: opponent.id,
          opponentParticipantName: opponent.label,
          opponentRoll,
          opponentSilent: draft.opponentSilent,
          opponentSkillId: selectedOpponentSkill.id,
          opponentSkillLabel: selectedOpponentSkill.label,
          opponentSupportSkillId: selectedOpponentSupportSkill?.id,
          opponentSupportSkillLabel: selectedOpponentSupportSkill?.label,
          otherMod,
          partial: preview.partial || opponentPreview.partial,
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
    } else if (roll && preview) {
      await persist(
        recordRoleplayGmSkillRoll({
          calculationText: [
            selectedSupportSkill ? `Support: ${selectedSupportSkill.label}` : undefined,
            preview.calculationText,
          ]
            .filter(Boolean)
            .join(" · "),
          difficulty: isOpposed || draft.difficulty === "none" ? undefined : draft.difficulty,
          achievedSuccessLevel: preview.achievedSuccessLevel,
          autoSuccess: preview.autoSuccess,
          dieResult: roll.dieResult,
          finalTotal: preview.finalTotal,
          fumble: preview.fumble,
          mode: "difficulty",
          numericSubtotal: preview.numericSubtotal,
          openEndedD10s: roll.openEndedD10s,
          otherMod,
          partial: preview.partial,
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

    if (opponent) {
      replaceDraftRankedRollResults(draft.id, []);
    } else if (preview && roll) {
      replaceDraftRankedRollResults(draft.id, [
        makeLocalRankedRollEntry({
          draftId: draft.id,
          idSuffix: "actor",
          participantId: participant.id,
          preview,
          roll,
          silent: draft.silent,
          skillId: selectedSkill.id,
          skillLabel: selectedSkill.label,
          supportSkillLabel: selectedSupportSkill?.label,
        }),
      ]);
    }
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
      <EncounterInfoCard
        campaignName={campaignName}
        encounter={encounter}
        scenarioName={scenario?.name}
      />

      <GmMessageSection
        gmMessageDraft={gmMessageDraft}
        onChange={setGmMessageDraft}
        onSave={handleSaveGmMessage}
      />

      <VisibilityGridSection
        onSelectAllVisibility={handleSelectAllVisibility}
        onVisibilityChange={handleVisibilityChange}
        roster={roster}
        state={roleplayState}
      />

      <ParticipantDescriptionsSection
        onSave={handleDescriptionSave}
        roster={roster}
        state={roleplayState}
      />

      <section style={panelStyle}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>Skill roll assignment</h2>
          <button onClick={resetRollDrafts} type="button">
            Clear
          </button>
        </div>
        <div style={{ display: "grid", gap: "0.75rem" }}>
          {rollDrafts.map((draft, index) => {
            const context = getRollDraftContext(draft);
            const comparison =
              context.preview && context.opponentPreview
                ? compareRoleplayOpposedRolls({
                    actorLabel: context.participant?.label ?? "Actor",
                    actorPreview: context.preview,
                    opponentLabel: context.opponent?.label ?? "Opponent",
                    opponentPreview: context.opponentPreview,
                  }).summary
                : undefined;

            return (
              <RoleplayRollBlock
                comparison={comparison}
                context={context}
                draft={draft}
                index={index}
                key={draft.id}
                onActorParticipantChange={handleActorParticipantChange}
                onAssignSkillRoll={handleAssignSkillRoll}
                onGmRoll={handleGmRoll}
                onUpdateRollDraft={updateRollDraft}
                roster={roster}
              />
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

      <RankedRollResultsSection entries={currentRankedRollResults} roster={roster} />

      <RoleplayActionLogSection entries={roleplayState.actionLog} />
    </section>
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
      <PlayerRoleplayEncounterView
        campaign={campaign}
        encounter={encounter}
        gmMessage={roleplayState.gmMessage}
        scenario={scenario}
      />
    </section>
  );
}
