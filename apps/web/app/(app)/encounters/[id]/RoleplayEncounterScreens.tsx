"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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
  buildRoleplayCalculationPreview as buildDomainRoleplayCalculationPreview,
  compareRoleplayOpposedRolls,
  normalizeRoleplayState,
  normalizeRoleplayOtherMod,
  orderRoleplayEncounterParticipants,
  recordRoleplayGmSkillRoll,
  resolveEncounterParticipantByRollParticipantId,
  roleplayDifficultyOptions,
  rollOpenEndedRoleplayD20,
  selectAllRoleplayVisibilityForViewer,
  updateRoleplayGmMessage,
  updateRoleplayParticipantDescription,
  updateRoleplayVisibility,
} from "@glantri/domain";

import {
  resolveParticipantSkillRollProfile,
  resolveRoleplaySkillRollModifiers,
  type ParticipantSkillRollProfile,
  type ResolveParticipantSkillRollProfileInput,
} from "@glantri/rules-engine";

import {
  loadCampaignById,
  loadEncounterById,
  loadScenarioById,
  loadScenarioParticipants,
  submitPlayerRoleplayRollOnServer,
} from "@/lib/api/localServiceClient";
import { useSessionUser } from "@/lib/auth/SessionUserContext";
import RememberedCampaignWorkspaceEffect from "@/lib/campaigns/RememberedCampaignWorkspaceEffect";
import { getScenarioParticipantFallbackEncounterParticipants } from "@/lib/campaigns/encounterParticipantFallback";
import { buildPlayerGeneralEncounterView } from "@/lib/campaigns/playerGeneralEncounter";
import { buildCampaignWorkspaceHref } from "@/lib/campaigns/workspace";
import {
  getPlayerFacingSkillBucket,
  getPlayerFacingSkillBucketDefinitions,
} from "@/lib/chargen/chargenBrowse";
import { loadCanonicalContent } from "@/lib/content/loadCanonicalContent";

import { RoleplayRollBlock } from "./components/RoleplayRollBlock";
import {
  GmMessageSection,
  ParticipantDescriptionsSection,
  PlayerEncounterTopInfo,
  RankedRollResultsSection,
  RoleplayActionLogSection,
  RoleplayTopInfo,
  VisibilityGridSection,
  formatShortDateTime,
} from "./components/RoleplaySections";
import { RoleplayRollCalculationPanel } from "./components/RoleplayCalculationPanel";
import {
  compactControlStyle,
  compactInputStyle,
  compactSkillInputStyle,
  panelStyle,
  playerReadOnlyPanelStyle,
  playerRollSkillColumnsStyle,
  rollBlockShellStyle,
  rollControlRowStyle,
  rollControlsStackStyle,
  rollControlsStyle,
  rollEditorStyle,
  rollFieldRowStyle,
} from "./components/roleplayStyles";
import type {
  PlayerLocalRollDraft,
  RoleplayRollDraft,
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

function getScenarioParticipantForEncounterParticipant(input: {
  encounterParticipant?: EncounterParticipant;
  scenarioParticipants: ScenarioParticipant[];
}): ScenarioParticipant | undefined {
  return input.encounterParticipant?.scenarioParticipantId
    ? input.scenarioParticipants.find(
        (participant) => participant.id === input.encounterParticipant?.scenarioParticipantId
      )
    : undefined;
}

function getSkillRollProfile(input: {
  content?: Awaited<ReturnType<typeof loadCanonicalContent>>;
  encounterParticipant?: EncounterParticipant;
  scenarioParticipants: ScenarioParticipant[];
  skill: ResolveParticipantSkillRollProfileInput["skill"];
}): ParticipantSkillRollProfile {
  const scenarioParticipant = getScenarioParticipantForEncounterParticipant({
    encounterParticipant: input.encounterParticipant,
    scenarioParticipants: input.scenarioParticipants,
  });

  return resolveParticipantSkillRollProfile({
    build: scenarioParticipant?.snapshot.build,
    content: input.content,
    participantId: input.encounterParticipant?.id,
    participantName: input.encounterParticipant?.label,
    sheetSummary: scenarioParticipant?.snapshot.sheetSummary,
    skill: input.skill,
  });
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
      const profile = getSkillRollProfile({
        content: input.content,
        encounterParticipant: input.encounterParticipant,
        scenarioParticipants: input.scenarioParticipants,
        skill,
      });

      return {
        categoryId,
        categoryLabel: categoryLabelById.get(categoryId) ?? categoryId,
        id: skill.id,
        label: skill.name,
        profile,
        value: profile.rollBaseValue,
        warning: profile.known ? undefined : "Skill not known (-3 default). GM may adjust or forbid.",
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

function makeRollDraft(input: { id?: string; participantId?: string; skillId?: string }): RoleplayRollDraft {
  return {
    difficulty: "medium",
    id: input.id ?? `roll-draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    otherModInput: "0",
    otherModTouched: false,
    opponentBlockOpen: false,
    opponentOtherModInput: "0",
    opponentOtherModTouched: false,
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
    rollSetId: `roleplay-roll-set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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

function makePlayerLocalRollDraft(input: { skillId?: string } = {}): PlayerLocalRollDraft {
  return {
    difficulty: "medium",
    otherModInput: "0",
    otherModTouched: false,
    opponentParticipantId: "",
    skillCategoryId: "all",
    skillId: input.skillId ?? "",
    supportSkillCategoryId: "all",
    supportSkillId: "",
    useDbMod: false,
    useGenMod: false,
    useObSkillMod: false,
  };
}

function applyUnknownSkillDefaultOtherMod(input: {
  currentValue: string;
  selectedSkill?: SkillOption;
  touched: boolean;
}): string {
  if (input.touched || !input.selectedSkill?.profile) {
    return input.currentValue;
  }

  if (!input.selectedSkill.profile.known) {
    return String(input.selectedSkill.profile.unknownSkillPenalty);
  }

  return input.currentValue === "-3"
    ? "0"
    : input.currentValue;
}

function buildRoleplayCalculationPreview(
  input: Parameters<typeof buildDomainRoleplayCalculationPreview>[0]
): ReturnType<typeof buildDomainRoleplayCalculationPreview> {
  const otherMod = normalizeRoleplayOtherMod(input.otherMod);
  const modifierPipeline =
    input.modifierPipeline ??
    resolveRoleplaySkillRollModifiers({
      skillTotal: input.skillValue ?? 0,
      modifiers:
        otherMod === 0
          ? []
          : [{ bucket: "other", label: "Other", source: "manual", value: otherMod }],
    });

  return buildDomainRoleplayCalculationPreview({
    ...input,
    modifierPipeline,
    otherMod,
  });
}

function buildPlayerRollResult(input?: {
  dieResult?: number;
  openEndedD10s: number[];
  rollD20?: number;
}): RoleplayOpenEndedD20Roll | undefined {
  if (!input || input.dieResult == null || input.rollD20 == null) {
    return undefined;
  }

  return {
    dieResult: input.dieResult,
    openEndedD10s: input.openEndedD10s,
    rollD20: input.rollD20,
  };
}

function buildActionLogRollResult(
  input?: RoleplayActionLogEntry,
  side: "actor" | "opponent" = "actor"
): RoleplayOpenEndedD20Roll | undefined {
  if (!input) {
    return undefined;
  }

  if (side === "opponent") {
    return buildPlayerRollResult({
      dieResult: input.side === "opponent" ? input.dieResult : input.opponentDieResult,
      openEndedD10s: input.side === "opponent" ? input.openEndedD10s : input.opponentOpenEndedD10s,
      rollD20: input.side === "opponent" ? input.rollD20 : input.opponentRollD20,
    });
  }

  return buildPlayerRollResult(input);
}

function buildActionLogSupportRollResult(input?: RoleplayActionLogEntry): RoleplayOpenEndedD20Roll | undefined {
  return buildPlayerRollResult({
    dieResult: input?.supportDieResult,
    openEndedD10s: input?.supportOpenEndedD10s ?? [],
    rollD20: input?.supportRollD20,
  });
}

function findRoleplayResultForSide(input: {
  entries: RoleplayActionLogEntry[];
  participantId?: string;
  pendingRollId?: string;
  rollSetId?: string;
  side: "actor" | "opponent";
  skillId?: string;
}): RoleplayActionLogEntry | undefined {
  const matches = input.entries
    .filter((entry) => {
      if (entry.type !== "gm_skill_roll") {
        return false;
      }

      if (input.pendingRollId && entry.pendingRollId === input.pendingRollId) {
        return !entry.side || entry.side === input.side;
      }

      if (!input.rollSetId || entry.rollSetId !== input.rollSetId) {
        return false;
      }

      if (entry.side === input.side) {
        return entry.participantId === input.participantId && entry.skillId === input.skillId;
      }

      if (input.side === "actor" && !entry.side) {
        return entry.participantId === input.participantId && entry.skillId === input.skillId;
      }

      if (input.side === "opponent" && !entry.side) {
        return (
          (entry.opponentParticipantId === input.participantId && entry.opponentSkillId === input.skillId) ||
          (entry.participantId === input.participantId && entry.skillId === input.skillId)
        );
      }

      return false;
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (matches[0]) {
    return matches[0];
  }

  if (input.rollSetId) {
    return undefined;
  }

  const fallbackMatches = input.entries
    .filter((entry) => {
      if (entry.type !== "gm_skill_roll") {
        return false;
      }

      if (entry.side === input.side || (input.side === "actor" && !entry.side)) {
        return entry.participantId === input.participantId && entry.skillId === input.skillId;
      }

      if (input.side === "opponent" && !entry.side) {
        return (
          entry.opponentParticipantId === input.participantId &&
          entry.opponentSkillId === input.skillId
        );
      }

      return false;
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  return fallbackMatches.length === 1 ? fallbackMatches[0] : undefined;
}

function rankPlayerVisibleResults(
  entries: Array<{ id: string; participantName: string; skillLabel: string; total: number }>
) {
  return [...entries].sort((left, right) => right.total - left.total || left.participantName.localeCompare(right.participantName));
}

function mergePlayerVisibleResults(
  left: Array<{ id: string; participantName: string; skillLabel: string; total: number }>,
  right: Array<{ id: string; participantName: string; skillLabel: string; total: number }>
) {
  const byId = new Map<string, { id: string; participantName: string; skillLabel: string; total: number }>();

  for (const entry of [...left, ...right]) {
    byId.set(entry.id, entry);
  }

  return rankPlayerVisibleResults([...byId.values()]);
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
        const nextSkillId =
          filteredSkillOptions.some((skill) => skill.id === draft.skillId)
            ? draft.skillId
            : filteredSkillOptions[0]?.id ?? skillOptions[0]?.id ?? "";
        const nextSelectedSkill = skillOptions.find((skill) => skill.id === nextSkillId);
        const nextOpponentSkillId =
          !draft.opponentBlockOpen || draft.opponentSkillId === ""
            ? ""
            : filteredOpponentSkillOptions.some((skill) => skill.id === draft.opponentSkillId)
              ? draft.opponentSkillId
              : "";
        const nextSelectedOpponentSkill = opponentSkillOptions.find((skill) => skill.id === nextOpponentSkillId);

        return {
          ...draft,
          otherModInput: applyUnknownSkillDefaultOtherMod({
            currentValue: draft.otherModInput,
            selectedSkill: nextSelectedSkill,
            touched: draft.otherModTouched,
          }),
          opponentOtherModInput: applyUnknownSkillDefaultOtherMod({
            currentValue: draft.opponentOtherModInput,
            selectedSkill: nextSelectedOpponentSkill,
            touched: draft.opponentOtherModTouched,
          }),
          opponentSkillId: nextOpponentSkillId,
          opponentSupportSkillId:
            draft.opponentSupportSkillId === "" ||
            opponentSupportSkillOptions.some((skill) => skill.id === draft.opponentSupportSkillId)
              ? draft.opponentSupportSkillId
              : "",
          participantId: participant?.id ?? "",
          skillId: nextSkillId,
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
    setRollDrafts((currentDrafts) =>
      currentDrafts.map((draft) => {
        if (draft.id !== draftId) {
          return draft;
        }

        const participant = roster.find((row) => row.id === participantId);
        const nextSkillOptions = readSystemSkillOptions({
          content,
          encounterParticipant: participant,
          scenarioParticipants,
        });
        const nextSkillId = nextSkillOptions[0]?.id ?? "";

        return {
          ...draft,
          otherModInput: applyUnknownSkillDefaultOtherMod({
            currentValue: draft.otherModInput,
            selectedSkill: nextSkillOptions.find((skill) => skill.id === nextSkillId),
            touched: draft.otherModTouched,
          }),
          participantId,
          skillCategoryId: "all",
          skillId: nextSkillId,
        };
      })
    );
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
    return entries.filter((entry) => entry.mode !== "opposed").sort(
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
      supportOpenEndedD10s: [],
      supportSkillLabel: input.supportSkillLabel,
      type: "gm_skill_roll",
    };
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
    const actorOtherModInput = applyUnknownSkillDefaultOtherMod({
      currentValue: draft.otherModInput,
      selectedSkill,
      touched: draft.otherModTouched,
    });
    const opponentOtherModInput = applyUnknownSkillDefaultOtherMod({
      currentValue: draft.opponentOtherModInput,
      selectedSkill: selectedOpponentSkill,
      touched: draft.opponentOtherModTouched,
    });
    const otherMod = normalizeRoleplayOtherMod(actorOtherModInput);
    const opponentOtherMod = normalizeRoleplayOtherMod(opponentOtherModInput);
    const isOpposed = Boolean(opponent && draft.opponentBlockOpen && selectedOpponentSkill);
    const matchingPendingRollCandidates = selectedSkill
      ? [...roleplayState.pendingSkillRolls].filter((roll) => {
          const rollParticipant = resolveEncounterParticipantByRollParticipantId({
            participantId: roll.participantId,
            participants: roster,
          });

          return (
            rollParticipant?.id === participant?.id &&
            roll.skillId === selectedSkill.id &&
            roll.rollSetId === draft.rollSetId
          );
        })
      : [];
    const scorePendingRoll = (roll: (typeof matchingPendingRollCandidates)[number]) => {
      const actorResult = findRoleplayResultForSide({
        entries: roleplayState.actionLog,
        participantId: participant?.id,
        pendingRollId: roll.id,
        rollSetId: roll.rollSetId,
        side: "actor",
        skillId: selectedSkill?.id,
      });
      const opponentResult =
        opponent && selectedOpponentSkill
          ? findRoleplayResultForSide({
              entries: roleplayState.actionLog,
              participantId: opponent.id,
              rollSetId: roll.rollSetId,
              side: "opponent",
              skillId: selectedOpponentSkill.id,
            })
          : undefined;

      return Number(Boolean(actorResult)) * 4 + Number(Boolean(opponentResult)) * 2;
    };
    const matchingPendingRoll = matchingPendingRollCandidates.sort(
      (left, right) =>
        scorePendingRoll(right) - scorePendingRoll(left) ||
        right.assignedAt.localeCompare(left.assignedAt)
    )[0];
    const activeOpposedRollSetId = isOpposed ? draft.rollSetId : matchingPendingRoll?.rollSetId;
    const matchingOpponentPendingRoll =
      activeOpposedRollSetId && opponent && selectedOpponentSkill
        ? roleplayState.pendingSkillRolls.find((roll) => {
            const rollParticipant = resolveEncounterParticipantByRollParticipantId({
              participantId: roll.participantId,
              participants: roster,
            });

            return (
              roll.rollSetId === activeOpposedRollSetId &&
              (roll.side ?? (roll.mode === "opposed" ? "actor" : undefined)) === "opponent" &&
              rollParticipant?.id === opponent.id &&
              roll.skillId === selectedOpponentSkill.id
            );
          })
        : undefined;
    const matchingResult = selectedSkill && (matchingPendingRoll || activeOpposedRollSetId)
      ? findRoleplayResultForSide({
          entries: roleplayState.actionLog,
          participantId: participant?.id,
          pendingRollId: matchingPendingRoll?.id,
          rollSetId: activeOpposedRollSetId,
          side: "actor",
          skillId: selectedSkill?.id,
        })
      : undefined;
    const matchingOpponentResult =
      activeOpposedRollSetId && opponent && selectedOpponentSkill
        ? findRoleplayResultForSide({
            entries: roleplayState.actionLog,
            participantId: opponent.id,
            pendingRollId: matchingOpponentPendingRoll?.id,
            rollSetId: activeOpposedRollSetId,
            side: "opponent",
            skillId: selectedOpponentSkill.id,
          })
        : undefined;
    const actorExternalRoll = buildActionLogRollResult(matchingResult, "actor");
    const opponentExternalRoll = buildActionLogRollResult(matchingOpponentResult, "opponent");
    const actorExternalSupportRoll = buildActionLogSupportRollResult(matchingResult);
    const opponentExternalSupportRoll = buildActionLogSupportRollResult(matchingOpponentResult);
    const preview = selectedSkill
      ? buildRoleplayCalculationPreview({
          difficulty: isOpposed || draft.difficulty === "none" ? undefined : draft.difficulty,
          otherMod,
          roll: draft.actorRoll ?? actorExternalRoll,
          skillLabel: selectedSkill.label,
          skillValue: selectedSkill.value,
          useDbMod: draft.useDbMod,
          useGenMod: draft.useGenMod,
          useObSkillMod: draft.useObSkillMod,
        })
      : undefined;
    const supportPreview = selectedSupportSkill
      ? buildRoleplayCalculationPreview({
          roll: draft.actorSupportRoll ?? actorExternalSupportRoll,
          skillLabel: selectedSupportSkill.label,
          skillValue: selectedSupportSkill.value,
        })
      : undefined;
    const opponentPreview =
      opponent && selectedOpponentSkill
        ? buildRoleplayCalculationPreview({
            otherMod: opponentOtherMod,
            roll: draft.opponentRoll ?? opponentExternalRoll,
            skillLabel: selectedOpponentSkill.label,
            skillValue: selectedOpponentSkill.value,
            useDbMod: draft.opponentUseDbMod,
            useGenMod: draft.opponentUseGenMod,
            useObSkillMod: draft.opponentUseObSkillMod,
          })
        : undefined;
    const opponentSupportPreview = selectedOpponentSupportSkill
      ? buildRoleplayCalculationPreview({
          roll: draft.opponentSupportRoll ?? opponentExternalSupportRoll,
          skillLabel: selectedOpponentSupportSkill.label,
          skillValue: selectedOpponentSupportSkill.value,
        })
      : undefined;

    return {
      allOpponentSkillOptions,
      allSkillOptions,
      actorExternalResult: matchingResult,
      opponentExternalResult: matchingOpponentResult,
      isOpposed,
      actorOtherModInput,
      activeOpposedRollSetId,
      opponent,
      opponentOtherModInput,
      opponentPreview,
      matchingOpponentPendingRoll,
      opponentSupportPreview,
      opponentSupportSkillOptions,
      matchingPendingRoll,
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

  async function handleAssignSkillRoll(draft: RoleplayRollDraft, side: "actor" | "opponent" = "actor") {
    const {
      isOpposed,
      activeOpposedRollSetId,
      opponent,
      otherMod,
      opponentOtherMod,
      matchingOpponentPendingRoll,
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
    const duplicateActorAssignment =
      !assigningOpponent &&
      isOpposed &&
      roleplayState.pendingSkillRolls.some((roll) => {
        const rollParticipant = resolveEncounterParticipantByRollParticipantId({
          participantId: roll.participantId,
          participants: roster,
        });

        return (
          roll.rollSetId === activeOpposedRollSetId &&
          (roll.side ?? (roll.mode === "opposed" ? "actor" : undefined)) === "actor" &&
          rollParticipant?.id === participant.id &&
          roll.skillId === selectedSkill.id
        );
      });
    const duplicateOpponentAssignment =
      assigningOpponent &&
      Boolean(matchingOpponentPendingRoll);

    if (duplicateActorAssignment || duplicateOpponentAssignment) {
      return;
    }

    await persist(
      assignRoleplaySkillRoll({
        difficulty: assigningOpponent || isOpposed || draft.difficulty === "none" ? undefined : draft.difficulty,
        mode: assigningOpponent || isOpposed ? "opposed" : "difficulty",
        otherMod: assigningOpponent ? opponentOtherMod : otherMod,
        opponentParticipantId: !assigningOpponent && isOpposed ? opponent?.id : undefined,
        opponentParticipantName: !assigningOpponent && isOpposed ? opponent?.label : undefined,
        opponentSilent: !assigningOpponent && isOpposed ? draft.opponentSilent : undefined,
        opponentSkillId: !assigningOpponent && isOpposed ? selectedOpponentSkill?.id : undefined,
        opponentSkillLabel: !assigningOpponent && isOpposed ? selectedOpponentSkill?.label : undefined,
        opponentSkillValue: !assigningOpponent && isOpposed ? selectedOpponentSkill?.value : undefined,
        opponentSupportSkillId: !assigningOpponent && isOpposed ? selectedOpponentSupportSkill?.id : undefined,
        opponentSupportSkillLabel: !assigningOpponent && isOpposed ? selectedOpponentSupportSkill?.label : undefined,
        participantId: assigningOpponent ? opponent.id : participant.id,
        participantName: assigningOpponent ? opponent.label : participant.label,
        rollSetId: assigningOpponent || isOpposed ? activeOpposedRollSetId : undefined,
        session: encounter,
        side: assigningOpponent ? "opponent" : isOpposed ? "actor" : undefined,
        silent: assigningOpponent ? draft.opponentSilent : draft.silent,
        skillId: assigningOpponent ? selectedOpponentSkill.id : selectedSkill.id,
        skillLabel: assigningOpponent ? selectedOpponentSkill.label : selectedSkill.label,
        skillValue: assigningOpponent ? selectedOpponentSkill.value : selectedSkill.value,
        supportSkillId: assigningOpponent ? selectedOpponentSupportSkill?.id : selectedSupportSkill?.id,
        supportSkillLabel: assigningOpponent ? selectedOpponentSupportSkill?.label : selectedSupportSkill?.label,
        supportSkillValue: assigningOpponent ? selectedOpponentSupportSkill?.value : selectedSupportSkill?.value,
        useDbMod: assigningOpponent ? draft.opponentUseDbMod : draft.useDbMod,
        useGenMod: assigningOpponent ? draft.opponentUseGenMod : draft.useGenMod,
        useObSkillMod: assigningOpponent ? draft.opponentUseObSkillMod : draft.useObSkillMod,
      }),
      "Assigned roleplaying skill roll."
    );
  }

  async function handleGmRoll(draft: RoleplayRollDraft, side: "actor" | "opponent" | "both" = "actor") {
    const {
      isOpposed,
      activeOpposedRollSetId,
      opponent,
      otherMod,
      opponentOtherMod,
      matchingPendingRoll,
      matchingOpponentPendingRoll,
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
    const actorSupportRoll =
      shouldRollActor && selectedSupportSkill
        ? rollOpenEndedRoleplayD20()
        : draft.actorSupportRoll;
    const opponentSupportRoll =
      shouldRollOpponent && selectedOpponentSupportSkill
        ? rollOpenEndedRoleplayD20()
        : draft.opponentSupportRoll;

    if ((side === "actor" || side === "both") && !roll) {
      return;
    }

    if ((side === "opponent" || side === "both") && !opponentRoll) {
      return;
    }

    updateRollDraft(draft.id, {
      actorRoll: roll,
      actorSupportRoll,
      opponentRoll,
      opponentSupportRoll,
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
    const supportPreview =
      actorSupportRoll && selectedSupportSkill
        ? buildRoleplayCalculationPreview({
            roll: actorSupportRoll,
            skillLabel: selectedSupportSkill.label,
            skillValue: selectedSupportSkill.value,
          })
        : undefined;
    const opponentSupportPreview =
      opponentSupportRoll && selectedOpponentSupportSkill
        ? buildRoleplayCalculationPreview({
            roll: opponentSupportRoll,
            skillLabel: selectedOpponentSupportSkill.label,
            skillValue: selectedOpponentSupportSkill.value,
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
            opponentSupportPreview ? `support ${opponentSupportPreview.calculationText}` : undefined,
            selectedOpponentSupportSkill && !opponentSupportPreview ? `Support: ${selectedOpponentSupportSkill.label}` : undefined,
            opponentPreview.calculationText,
          ]
            .filter(Boolean)
            .join(" · "),
          achievedSuccessLevel: opponentPreview.achievedSuccessLevel,
          autoSuccess: opponentPreview.autoSuccess,
          dieResult: opponentRoll.dieResult,
          finalTotal: opponentPreview.finalTotal,
          fumble: opponentPreview.fumble,
          mode: activeOpposedRollSetId ? "opposed" : "difficulty",
          numericSubtotal: opponentPreview.numericSubtotal,
          openEndedD10s: opponentRoll.openEndedD10s,
          otherMod: opponentOtherMod,
          partial: opponentPreview.partial,
          pendingRollId: matchingOpponentPendingRoll?.id,
          participantId: opponent.id,
          roll: opponentRoll,
          rollSetId: activeOpposedRollSetId,
          session: encounter,
          side: activeOpposedRollSetId ? "opponent" : undefined,
          silent: draft.opponentSilent,
          skillId: selectedOpponentSkill.id,
          skillLabel: selectedOpponentSkill.label,
          skillValue: selectedOpponentSkill.value,
          participantName: opponent.label,
          summary: `GM rolled ${selectedOpponentSkill.label} for ${opponent.label}.`,
          supportCalculationText: opponentSupportPreview?.calculationText,
          supportNumericSubtotal: opponentSupportPreview?.numericSubtotal,
          supportRoll: opponentSupportRoll,
          supportSkillId: selectedOpponentSupportSkill?.id,
          supportSkillLabel: selectedOpponentSupportSkill?.label,
          supportSkillValue: selectedOpponentSupportSkill?.value,
          useDbMod: draft.opponentUseDbMod,
          useGenMod: draft.opponentUseGenMod,
          useObSkillMod: draft.opponentUseObSkillMod,
        }),
        "Recorded GM roleplaying skill roll."
      );
    } else if (side === "both" && opponent && selectedOpponentSkill && roll && opponentRoll && preview && opponentPreview) {
      const calculationText = [
        supportPreview ? `actor support ${supportPreview.calculationText}` : undefined,
        opponentSupportPreview ? `opponent support ${opponentSupportPreview.calculationText}` : undefined,
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
          participantName: participant.label,
          roll,
          rollSetId: activeOpposedRollSetId,
          session: encounter,
          silent: draft.silent,
          skillId: selectedSkill.id,
          skillLabel: selectedSkill.label,
          skillValue: selectedSkill.value,
          success: preview.success,
          summary: `GM rolled opposed ${selectedSkill.label} for ${participant.label} vs ${selectedOpponentSkill.label} for ${opponent.label}.`,
          supportCalculationText: supportPreview?.calculationText,
          supportNumericSubtotal: supportPreview?.numericSubtotal,
          supportRoll: actorSupportRoll,
          supportSkillId: selectedSupportSkill?.id,
          supportSkillLabel: selectedSupportSkill?.label,
          supportSkillValue: selectedSupportSkill?.value,
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
            supportPreview ? `support ${supportPreview.calculationText}` : undefined,
            selectedSupportSkill && !supportPreview ? `Support: ${selectedSupportSkill.label}` : undefined,
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
          mode: isOpposed && activeOpposedRollSetId ? "opposed" : "difficulty",
          numericSubtotal: preview.numericSubtotal,
          openEndedD10s: roll.openEndedD10s,
          otherMod,
          partial: preview.partial,
          pendingRollId: matchingPendingRoll?.id,
          participantId: participant.id,
          participantName: participant.label,
          roll,
          rollSetId: activeOpposedRollSetId,
          session: encounter,
          side: isOpposed && activeOpposedRollSetId ? "actor" : undefined,
          silent: draft.silent,
          skillId: selectedSkill.id,
          skillLabel: selectedSkill.label,
          skillValue: selectedSkill.value,
          success: preview.success,
          summary: `GM rolled ${selectedSkill.label} for ${participant.label}.`,
          supportCalculationText: supportPreview?.calculationText,
          supportNumericSubtotal: supportPreview?.numericSubtotal,
          supportRoll: actorSupportRoll,
          supportSkillId: selectedSupportSkill?.id,
          supportSkillLabel: selectedSupportSkill?.label,
          supportSkillValue: selectedSupportSkill?.value,
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
      <RoleplayTopInfo
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
                applyUnknownSkillDefaultOtherMod={applyUnknownSkillDefaultOtherMod}
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
  const [content, setContent] = useState<Awaited<ReturnType<typeof loadCanonicalContent>>>();
  const [encounter, setEncounter] = useState<EncounterSession | null>(null);
  const [feedback, setFeedback] = useState<string>();
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [scenarioParticipants, setScenarioParticipants] = useState<ScenarioParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedAssignedRollIds, setDismissedAssignedRollIds] = useState<Set<string>>(() => new Set());
  const [dismissedRankedResultIds, setDismissedRankedResultIds] = useState<Set<string>>(() => new Set());
  const [localRankedResults, setLocalRankedResults] = useState<Array<{ id: string; participantName: string; skillLabel: string; total: number }>>([]);
  const [playerLocalRollDraft, setPlayerLocalRollDraft] = useState<PlayerLocalRollDraft>(() =>
    makePlayerLocalRollDraft()
  );
  const [playerLocalRollRoundId, setPlayerLocalRollRoundId] = useState(
    () => `player-local-roll-set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  );
  const { currentUser } = useSessionUser();
  const situationRef = useRef<HTMLDivElement>(null);

  const fetchRoleplayEncounter = useCallback(
    async () => {
      const [nextEncounter, nextScenario, nextCampaign, nextParticipants, nextContent] = await Promise.all([
        loadEncounterById(encounterId),
        loadScenarioById(scenarioId),
        loadCampaignById(campaignId).catch(() => null),
        loadScenarioParticipants(scenarioId),
        loadCanonicalContent(),
      ]);

      return {
        nextCampaign,
        nextContent,
        nextEncounter,
        nextParticipants,
        nextScenario,
      };
    },
    [campaignId, encounterId, scenarioId]
  );

  useEffect(() => {
    let cancelled = false;

    async function refreshRoleplayEncounter(input: { showLoading?: boolean } = {}) {
      if (input.showLoading) {
        setLoading(true);
      }

      try {
        const nextData = await fetchRoleplayEncounter();

        if (cancelled) {
          return;
        }

        setEncounter(nextData.nextEncounter);
        setScenario(nextData.nextScenario);
        setCampaign(nextData.nextCampaign);
        setScenarioParticipants(nextData.nextParticipants);
        setContent(nextData.nextContent);
        setLoading(false);
      } catch {
        if (!cancelled && input.showLoading) {
          setLoading(false);
        }
      }
    }

    void refreshRoleplayEncounter({ showLoading: true });

    const intervalId = window.setInterval(() => {
      if (cancelled) {
        return;
      }

      void refreshRoleplayEncounter();
    }, 5000);

    function refreshOnFocus() {
      if (cancelled || document.visibilityState === "hidden") {
        return;
      }

      void refreshRoleplayEncounter();
    }

    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [fetchRoleplayEncounter]);

  useEffect(() => {
    const situationElement = situationRef.current;

    if (situationElement) {
      situationElement.scrollTop = situationElement.scrollHeight;
    }
  }, [encounter?.roleplayState?.gmMessage]);

  if (loading) {
    return <section>Loading roleplaying encounter...</section>;
  }

  if (!encounter) {
    return <section>Roleplaying encounter not found.</section>;
  }

  const playerView = buildPlayerGeneralEncounterView({
    currentUserId: currentUser?.id,
    encounter,
    scenarioParticipants,
  });
  const effectivePlayerEncounterParticipants = getScenarioParticipantFallbackEncounterParticipants({
    encounter,
    scenarioParticipants,
  });

  if (currentUser && playerView.controlledParticipantIds.length === 0) {
    return (
      <section style={{ display: "grid", gap: "1rem", maxWidth: 980 }}>
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
        <PlayerEncounterTopInfo
          campaignName={campaign?.name}
          encounter={encounter}
          scenarioName={scenario?.name}
        />
        <section style={panelStyle}>
          <strong>No player encounter is currently available.</strong>
          <div>You are in this scenario, but not assigned to this encounter.</div>
        </section>
      </section>
    );
  }

  const visibleAssignedRolls = playerView.assignedRolls.filter(
    (roll) => !dismissedAssignedRollIds.has(roll.id)
  );
  const readModelRankedResults = playerView.rankedResults.filter(
    (entry) => !dismissedRankedResultIds.has(entry.id)
  );
  const visibleRankedResults = mergePlayerVisibleResults(localRankedResults, readModelRankedResults);
  const unresolvedAssignedRolls = visibleAssignedRolls.filter((roll) => !roll.result);
  const controlledParticipant = effectivePlayerEncounterParticipants.find(
    (participant) => participant.id === playerView.controlledParticipantIds[0]
  );
  const localAllSkillOptions = readSystemSkillOptions({
    content,
    encounterParticipant: controlledParticipant,
    scenarioParticipants,
  });
  const localSkillOptions =
    playerLocalRollDraft.skillCategoryId === "all"
      ? localAllSkillOptions
      : localAllSkillOptions.filter((skill) => skill.categoryId === playerLocalRollDraft.skillCategoryId);
  const localSelectedSkill =
    localSkillOptions.find((skill) => skill.id === playerLocalRollDraft.skillId) ?? localSkillOptions[0];
  const localSupportSkillOptions =
    playerLocalRollDraft.supportSkillCategoryId === "all"
      ? localAllSkillOptions
      : localAllSkillOptions.filter((skill) => skill.categoryId === playerLocalRollDraft.supportSkillCategoryId);
  const localSelectedSupportSkill =
    playerLocalRollDraft.supportSkillId === ""
      ? undefined
      : localSupportSkillOptions.find((skill) => skill.id === playerLocalRollDraft.supportSkillId);
  const localOtherModInput = applyUnknownSkillDefaultOtherMod({
    currentValue: playerLocalRollDraft.otherModInput,
    selectedSkill: localSelectedSkill,
    touched: playerLocalRollDraft.otherModTouched,
  });
  const localOtherMod = normalizeRoleplayOtherMod(localOtherModInput);
  const localPreview = localSelectedSkill
    ? buildRoleplayCalculationPreview({
        difficulty:
          playerLocalRollDraft.difficulty === "none" || playerLocalRollDraft.opponentParticipantId
            ? undefined
            : playerLocalRollDraft.difficulty,
        otherMod: localOtherMod,
        roll: playerLocalRollDraft.roll,
        skillLabel: localSelectedSkill.label,
        skillValue: localSelectedSkill.value,
        useDbMod: playerLocalRollDraft.useDbMod,
        useGenMod: playerLocalRollDraft.useGenMod,
        useObSkillMod: playerLocalRollDraft.useObSkillMod,
      })
    : buildRoleplayCalculationPreview({
        skillLabel: "Skill",
        skillValue: 0,
      });
  const localSupportPreview = localSelectedSupportSkill
    ? buildRoleplayCalculationPreview({
        roll: playerLocalRollDraft.supportRoll,
        skillLabel: localSelectedSupportSkill.label,
        skillValue: localSelectedSupportSkill.value,
      })
    : undefined;

  function handleClearAssignedRolls() {
    if (unresolvedAssignedRolls.length > 0) {
      return;
    }

    setDismissedAssignedRollIds((currentIds) => {
      const nextIds = new Set(currentIds);

      for (const roll of visibleAssignedRolls) {
        nextIds.add(roll.id);
      }

      return nextIds;
    });
    setDismissedRankedResultIds((currentIds) => {
      const nextIds = new Set(currentIds);

      for (const entry of visibleRankedResults) {
        nextIds.add(entry.id);
      }

      return nextIds;
    });
    setLocalRankedResults([]);
    setPlayerLocalRollDraft(makePlayerLocalRollDraft({ skillId: localAllSkillOptions[0]?.id }));
    setPlayerLocalRollRoundId(`player-local-roll-set-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  }

  async function handlePlayerRoll(rollId: string) {
    const roleplayState = normalizeRoleplayState(encounter as EncounterSession);
    const pendingRoll = roleplayState.pendingSkillRolls.find((roll) => roll.id === rollId);

    if (!pendingRoll || pendingRoll.silent) {
      return;
    }

    const participant = resolveEncounterParticipantByRollParticipantId({
      participantId: pendingRoll.participantId,
      participants: effectivePlayerEncounterParticipants,
    });

    if (!encounter || !participant) {
      return;
    }

    const roll = rollOpenEndedRoleplayD20();
    const supportRoll = pendingRoll.supportSkillId ? rollOpenEndedRoleplayD20() : undefined;
    const preview = buildRoleplayCalculationPreview({
      difficulty: pendingRoll.mode === "difficulty" ? pendingRoll.difficulty : undefined,
      otherMod: pendingRoll.otherMod,
      roll,
      skillLabel: pendingRoll.skillLabel,
      skillValue: pendingRoll.skillValue,
      useDbMod: pendingRoll.useDbMod,
      useGenMod: pendingRoll.useGenMod,
      useObSkillMod: pendingRoll.useObSkillMod,
    });
    const savedEncounter = await submitPlayerRoleplayRollOnServer({
      encounterId: encounter.id,
      pendingRollId: pendingRoll.id,
      roll,
      supportRoll,
    });

    setEncounter(savedEncounter);
    if (pendingRoll.mode !== "opposed") {
      setLocalRankedResults((currentResults) =>
        mergePlayerVisibleResults(currentResults, [
          ...readModelRankedResults,
          {
            id: `player-roll-${pendingRoll.id}-${roll.rollD20}-${roll.dieResult}`,
            participantName: playerView.assignedRolls.find((entry) => entry.id === pendingRoll.id)?.participantName ?? participant.label,
            skillLabel: pendingRoll.skillLabel,
            total: preview.numericSubtotal ?? preview.finalTotal ?? 0,
          },
        ])
      );
    }
    setFeedback(`Rolled ${pendingRoll.skillLabel}: total ${preview.numericSubtotal ?? "unresolved"}.`);
  }

  async function handleLocalPlayerRoll() {
    if (!encounter || !controlledParticipant || !localSelectedSkill || playerLocalRollDraft.opponentParticipantId) {
      return;
    }

    const roll = rollOpenEndedRoleplayD20();
    const supportRoll = localSelectedSupportSkill ? rollOpenEndedRoleplayD20() : undefined;
    const preview = buildRoleplayCalculationPreview({
      difficulty: playerLocalRollDraft.difficulty === "none" ? undefined : playerLocalRollDraft.difficulty,
      otherMod: localOtherMod,
      roll,
      skillLabel: localSelectedSkill.label,
      skillValue: localSelectedSkill.value,
      useDbMod: playerLocalRollDraft.useDbMod,
      useGenMod: playerLocalRollDraft.useGenMod,
      useObSkillMod: playerLocalRollDraft.useObSkillMod,
    });
    setPlayerLocalRollDraft((currentDraft) => ({
      ...currentDraft,
      roll,
      supportRoll,
    }));
    setLocalRankedResults((currentResults) =>
      mergePlayerVisibleResults(currentResults, [
        ...readModelRankedResults,
        {
          id: `player-local-roll-${playerLocalRollRoundId}-${roll.rollD20}-${roll.dieResult}`,
          participantName: controlledParticipant.label,
          skillLabel: localSelectedSkill.label,
          total: preview.numericSubtotal ?? preview.finalTotal ?? 0,
        },
      ])
    );
    setFeedback(`Rolled ${localSelectedSkill.label}: total ${preview.numericSubtotal ?? "unresolved"}.`);
  }

  return (
    <section style={{ display: "grid", gap: "1rem", maxWidth: 980 }}>
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
      <PlayerEncounterTopInfo
        campaignName={campaign?.name}
        encounter={encounter}
        scenarioName={scenario?.name}
      />
      {feedback ? <section style={panelStyle}>{feedback}</section> : null}
      {playerView.gmMessage ? (
        <section style={panelStyle}>
          <h2 style={{ margin: 0 }}>Situation</h2>
          <div
            aria-readonly="true"
            ref={situationRef}
            role="textbox"
            style={{
              ...playerReadOnlyPanelStyle,
              maxHeight: "16rem",
              minHeight: "8rem",
              overflowY: "auto",
            }}
          >
            {playerView.gmMessage}
          </div>
        </section>
      ) : null}

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>PCs and NPCs</h2>
        {currentUser ? (
          playerView.visibleParticipants.length > 0 ? (
            <div style={{ maxHeight: "30rem", overflow: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: 720, width: "100%" }}>
                <colgroup>
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "22%" }} />
                  <col style={{ width: "56%" }} />
                </colgroup>
                <thead>
                  <tr style={{ borderBottom: "1px solid #d9ddd8", textAlign: "left" }}>
                    <th style={{ padding: "0.5rem 0.75rem 0.5rem 0" }}>Short description</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Name</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Description</th>
                  </tr>
                </thead>
                <tbody>
                  {playerView.visibleParticipants.map((participant) => (
                    <tr key={participant.id} style={{ borderBottom: "1px solid #eee8dc" }}>
                      <td style={{ padding: "0.6rem 0.75rem 0.6rem 0" }}>
                        {participant.shortDescription || "—"}
                      </td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>{participant.name}</td>
                      <td style={{ padding: "0.6rem 0.75rem" }}>
                        {participant.description || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div>No other visible participants.</div>
          )
        ) : (
          <div>Sign in to view player-visible encounter participants.</div>
        )}
      </section>

      <section style={panelStyle}>
        <div style={{ alignItems: "center", display: "flex", justifyContent: "space-between", gap: "0.75rem" }}>
          <h2 style={{ margin: 0 }}>Skill roll grid</h2>
          <button disabled={unresolvedAssignedRolls.length > 0} onClick={handleClearAssignedRolls} type="button">
            Clear
          </button>
        </div>
        {visibleAssignedRolls.length > 0 ? (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            {visibleAssignedRolls.map((roll, index) => {
              const contentSkill = content?.skills.find((skill) => skill.id === roll.skillId);
              const assignedParticipant = resolveEncounterParticipantByRollParticipantId({
                participantId: roll.participantId,
                participants: effectivePlayerEncounterParticipants,
              });
              const assignedSkillProfile =
                contentSkill && assignedParticipant
                  ? getSkillRollProfile({
                      content,
                      encounterParticipant: assignedParticipant,
                      scenarioParticipants,
                      skill: contentSkill,
                    })
                  : undefined;
              const assignedSupportSkill = content?.skills.find((skill) => skill.id === roll.supportSkillId);
              const assignedSupportSkillProfile =
                assignedSupportSkill && assignedParticipant
                  ? getSkillRollProfile({
                      content,
                      encounterParticipant: assignedParticipant,
                      scenarioParticipants,
                      skill: assignedSupportSkill,
                    })
                  : undefined;
              const categoryLabel = contentSkill
                ? getPlayerFacingSkillBucketDefinitions().find(
                    (category) => category.id === getPlayerFacingSkillBucket(contentSkill)
                  )?.label ?? "Assigned"
                : "Assigned";
              const resultRoll = buildPlayerRollResult(roll.result);
              const supportResultRoll = buildPlayerRollResult(roll.supportResult);
              const mainPreview = buildRoleplayCalculationPreview({
                difficulty: roll.mode === "difficulty" ? roll.difficulty : undefined,
                otherMod: roll.otherMod,
                roll: resultRoll,
                skillLabel: roll.skillLabel,
                skillValue: roll.skillValue,
                useDbMod: roll.useDbMod,
                useGenMod: roll.useGenMod,
                useObSkillMod: roll.useObSkillMod,
              });
              const supportPreview = roll.supportSkillLabel
                ? buildRoleplayCalculationPreview({
                    roll: supportResultRoll,
                    skillLabel: roll.supportSkillLabel,
                    skillValue: assignedSupportSkillProfile?.rollBaseValue ?? roll.supportSkillValue,
                  })
                : undefined;

              return (
                <div key={roll.id} style={rollBlockShellStyle}>
                  <strong>Assigned roll {index + 1} · {roll.participantName}</strong>
                  <section style={rollEditorStyle}>
                    <div style={rollControlsStackStyle}>
                      <section style={rollControlsStyle}>
                        <div style={rollControlRowStyle}>
                          <span>Use:</span>
                          <label>
                            <input checked={roll.useGenMod} disabled readOnly type="checkbox" /> Gen
                          </label>
                          <label>
                            <input checked={roll.useObSkillMod} disabled readOnly type="checkbox" /> OB/Skill
                          </label>
                          <label>
                            <input checked={roll.useDbMod} disabled readOnly type="checkbox" /> DB
                          </label>
                          <label style={compactControlStyle}>
                            <span>Other mod</span>
                            <input
                              readOnly
                              style={{ ...compactInputStyle, width: "4.5rem" }}
                              value={roll.otherMod}
                            />
                          </label>
                        </div>
                        <div style={rollFieldRowStyle}>
                          <div style={playerRollSkillColumnsStyle}>
                            <label style={compactControlStyle}>
                              <span>Category</span>
                              <select disabled style={compactInputStyle} value={categoryLabel}>
                                <option value={categoryLabel}>{categoryLabel}</option>
                              </select>
                            </label>
                            <label style={compactControlStyle}>
                              <span>Skill</span>
                              <select disabled style={compactSkillInputStyle} value={roll.skillId}>
                                <option value={roll.skillId}>
                                  {roll.skillLabel} ({roll.skillValue ?? 0})
                                </option>
                              </select>
                            </label>
                            <label style={compactControlStyle}>
                              <span>Support category</span>
                              <select disabled style={compactInputStyle} value="assigned">
                                <option value="assigned">{roll.supportSkillLabel ? "Assigned" : "None"}</option>
                              </select>
                            </label>
                            <label style={compactControlStyle}>
                              <span>Support</span>
                              <select disabled style={compactSkillInputStyle} value={roll.supportSkillLabel ?? ""}>
                                <option value={roll.supportSkillLabel ?? ""}>
                                  {roll.supportSkillLabel ?? "No support skill"}
                                </option>
                              </select>
                            </label>
                          </div>
                        </div>
                        <div style={rollFieldRowStyle}>
                          <label style={compactControlStyle}>
                            <span>Level</span>
                            <select disabled style={compactInputStyle} value={roll.difficultyLabel}>
                              <option value={roll.difficultyLabel}>{roll.difficultyLabel}</option>
                            </select>
                          </label>
                          <label style={compactControlStyle}>
                            <span>Opponent</span>
                            <input
                              readOnly
                              style={compactInputStyle}
                              value={roll.mode === "opposed" ? roll.opponentLabel ?? "Opposed" : "No opponent"}
                            />
                          </label>
                          <button disabled={Boolean(roll.result)} onClick={() => void handlePlayerRoll(roll.id)} type="button">
                            {roll.supportSkillLabel ? "Roll both 1d20s" : "Roll 1d20"}
                          </button>
                        </div>
                        {assignedSkillProfile && !assignedSkillProfile.known ? (
                          <div style={{ color: "#8a5a00", fontSize: "0.85rem" }}>
                            Skill not known (-3 default).
                          </div>
                        ) : null}
                        {assignedSupportSkillProfile && !assignedSupportSkillProfile.known ? (
                          <div style={{ color: "#8a5a00", fontSize: "0.85rem" }}>
                            {assignedSupportSkillProfile.skillName}: Skill not known (-3 default).
                          </div>
                        ) : null}
                      </section>
                    </div>
                    <RoleplayRollCalculationPanel
                      actorDifficulty={roll.mode === "difficulty" ? roll.difficulty : undefined}
                      actorLabel={`Actor — ${roll.participantName}`}
                      actorMainPreview={mainPreview}
                      actorPendingLabels={mainPreview.pendingModifierLabels}
                      actorSupportPreview={supportPreview}
                      cleanPendingText
                      comparison={roll.comparison}
                      opponentOpen={false}
                      showPendingLabels={false}
                    />
                  </section>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <div>No skill rolls assigned.</div>
            <div style={rollBlockShellStyle}>
              <strong>Local roll 1</strong>
              <section style={rollEditorStyle}>
                <div style={rollControlsStackStyle}>
                  <section style={rollControlsStyle}>
                    <div style={rollControlRowStyle}>
                      <span>Use:</span>
                      <label>
                        <input
                          checked={playerLocalRollDraft.useGenMod}
                          onChange={(event) =>
                            setPlayerLocalRollDraft((currentDraft) => ({
                              ...currentDraft,
                              useGenMod: event.target.checked,
                            }))
                          }
                          type="checkbox"
                        /> Gen
                      </label>
                      <label>
                        <input
                          checked={playerLocalRollDraft.useObSkillMod}
                          onChange={(event) =>
                            setPlayerLocalRollDraft((currentDraft) => ({
                              ...currentDraft,
                              useObSkillMod: event.target.checked,
                            }))
                          }
                          type="checkbox"
                        /> OB/Skill
                      </label>
                      <label>
                        <input
                          checked={playerLocalRollDraft.useDbMod}
                          onChange={(event) =>
                            setPlayerLocalRollDraft((currentDraft) => ({
                              ...currentDraft,
                              useDbMod: event.target.checked,
                            }))
                          }
                          type="checkbox"
                        /> DB
                      </label>
                      <label style={compactControlStyle}>
                        <span>Other mod</span>
                        <input
                          onChange={(event) =>
                            setPlayerLocalRollDraft((currentDraft) => ({
                              ...currentDraft,
                              otherModInput: event.target.value,
                              otherModTouched: true,
                              roll: undefined,
                            }))
                          }
                          style={{ ...compactInputStyle, width: "4.5rem" }}
                          type="number"
                          value={localOtherModInput}
                        />
                      </label>
                    </div>
                    <div style={rollFieldRowStyle}>
                      <div style={playerRollSkillColumnsStyle}>
                        <label style={compactControlStyle}>
                          <span>Category</span>
                          <select
                            onChange={(event) => {
                              const nextCategoryId = event.target.value as PlayerLocalRollDraft["skillCategoryId"];
                              const nextSkillOptions =
                                nextCategoryId === "all"
                                  ? localAllSkillOptions
                                  : localAllSkillOptions.filter((skill) => skill.categoryId === nextCategoryId);

                              setPlayerLocalRollDraft((currentDraft) => ({
                                ...currentDraft,
                                otherModInput: applyUnknownSkillDefaultOtherMod({
                                  currentValue: currentDraft.otherModInput,
                                  selectedSkill: nextSkillOptions[0],
                                  touched: currentDraft.otherModTouched,
                                }),
                                roll: undefined,
                                skillCategoryId: nextCategoryId,
                                skillId: nextSkillOptions[0]?.id ?? "",
                              }));
                            }}
                            style={compactInputStyle}
                            value={playerLocalRollDraft.skillCategoryId}
                          >
                            <option value="all">All categories</option>
                            {getPlayerFacingSkillBucketDefinitions()
                              .filter((category) => localAllSkillOptions.some((skill) => skill.categoryId === category.id))
                              .map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.label}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label style={compactControlStyle}>
                          <span>Skill</span>
                          <select
                            disabled={localSkillOptions.length === 0}
                            onChange={(event) =>
                              setPlayerLocalRollDraft((currentDraft) => ({
                                ...currentDraft,
                                otherModInput: applyUnknownSkillDefaultOtherMod({
                                  currentValue: currentDraft.otherModInput,
                                  selectedSkill: localSkillOptions.find((skill) => skill.id === event.target.value),
                                  touched: currentDraft.otherModTouched,
                                }),
                                roll: undefined,
                                skillId: event.target.value,
                              }))
                            }
                            style={compactSkillInputStyle}
                            value={localSelectedSkill?.id ?? ""}
                          >
                            {localSkillOptions.length > 0 ? (
                              localSkillOptions.map((skill) => (
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
                          <span>Support category</span>
                          <select
                            onChange={(event) =>
                              setPlayerLocalRollDraft((currentDraft) => ({
                                ...currentDraft,
                                roll: undefined,
                                supportSkillCategoryId: event.target.value as PlayerLocalRollDraft["supportSkillCategoryId"],
                                supportSkillId: "",
                              }))
                            }
                            style={compactInputStyle}
                            value={playerLocalRollDraft.supportSkillCategoryId}
                          >
                            <option value="all">All categories</option>
                            {getPlayerFacingSkillBucketDefinitions()
                              .filter((category) => localAllSkillOptions.some((skill) => skill.categoryId === category.id))
                              .map((category) => (
                                <option key={category.id} value={category.id}>
                                  {category.label}
                                </option>
                              ))}
                          </select>
                        </label>
                        <label style={compactControlStyle}>
                          <span>Support</span>
                          <select
                            onChange={(event) =>
                              setPlayerLocalRollDraft((currentDraft) => ({
                                ...currentDraft,
                                roll: undefined,
                                supportSkillId: event.target.value,
                              }))
                            }
                            style={compactSkillInputStyle}
                            value={localSelectedSupportSkill?.id ?? ""}
                          >
                            <option value="">No support skill</option>
                            {localSupportSkillOptions.map((skill) => (
                              <option key={skill.id} value={skill.id}>
                                {skill.label} ({skill.value ?? 0})
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
                    <div style={rollFieldRowStyle}>
                      <label style={compactControlStyle}>
                        <span>Level</span>
                        <select
                          onChange={(event) =>
                            setPlayerLocalRollDraft((currentDraft) => ({
                              ...currentDraft,
                              difficulty: event.target.value as PlayerLocalRollDraft["difficulty"],
                              opponentParticipantId: event.target.value === "none" ? currentDraft.opponentParticipantId : "",
                              roll: undefined,
                            }))
                          }
                          style={compactInputStyle}
                          value={playerLocalRollDraft.difficulty}
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
                          onChange={(event) =>
                            setPlayerLocalRollDraft((currentDraft) => ({
                              ...currentDraft,
                              difficulty: event.target.value ? "none" : currentDraft.difficulty,
                              opponentParticipantId: event.target.value,
                              roll: undefined,
                            }))
                          }
                          style={compactInputStyle}
                          value={playerLocalRollDraft.opponentParticipantId}
                        >
                          <option value="">No opponent</option>
                          {playerView.visibleParticipants.map((participant) => (
                            <option key={participant.id} value={participant.id}>
                              {participant.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        disabled={!controlledParticipant || !localSelectedSkill || Boolean(playerLocalRollDraft.opponentParticipantId)}
                        onClick={() => void handleLocalPlayerRoll()}
                        type="button"
                      >
                        {localSelectedSupportSkill ? "Roll both 1d20s" : "Roll 1d20"}
                      </button>
                    </div>
                    {[localSelectedSkill, localSelectedSupportSkill]
                      .filter((skill): skill is SkillOption => Boolean(skill?.profile && !skill.profile.known))
                      .map((skill) => (
                        <div key={skill.id} style={{ color: "#8a5a00", fontSize: "0.85rem" }}>
                          {skill.label}: Skill not known (-3 default).
                        </div>
                      ))}
                  </section>
                </div>
                <RoleplayRollCalculationPanel
                  actorDifficulty={
                    playerLocalRollDraft.difficulty === "none" || playerLocalRollDraft.opponentParticipantId
                      ? undefined
                      : playerLocalRollDraft.difficulty
                  }
                  actorMainPreview={localPreview}
                  actorSupportPreview={localSupportPreview}
                  cleanPendingText
                  opponentOpen={false}
                  showPendingLabels={false}
                />
              </section>
            </div>
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Ranked roll results</h2>
        {visibleRankedResults.length > 0 ? (
          <ol style={{ margin: 0, paddingLeft: "1.5rem" }}>
            {visibleRankedResults.map((entry) => (
              <li key={entry.id}>
                {entry.participantName} · {entry.skillLabel} · total {entry.total}
              </li>
            ))}
          </ol>
        ) : (
          <div>No player-visible ranked results yet.</div>
        )}
      </section>

      <section style={panelStyle}>
        <h2 style={{ margin: 0 }}>Character log</h2>
        {playerView.characterLog.length > 0 ? (
          <ul style={{ display: "grid", gap: "0.35rem", margin: 0, paddingLeft: "1.25rem" }}>
            {playerView.characterLog.map((entry) => (
              <li key={entry.id}>
                {formatShortDateTime(entry.timestamp)} · {entry.detail}
              </li>
            ))}
          </ul>
        ) : (
          <div>No character log entries yet.</div>
        )}
      </section>
    </section>
  );
}
