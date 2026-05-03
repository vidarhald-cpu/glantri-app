import type {
  CharacterBuild,
  CharacterProgression,
  CharacterProgressionCheck,
  CharacterProgressionHistoryEntry,
  CharacterProgressionPendingAttempt,
  CharacterProgressionState,
  CharacterSkill,
  CharacterSkillGroup,
  CharacterSpecialization,
  GlantriCharacteristicKey,
  ProfessionFamilyDefinition,
  ProfessionDefinition,
  ProfessionSkillMap,
  ProgressionTargetType,
  SkillDefinition,
  SkillGroupDefinition,
  SkillSpecialization,
  SocietyLevelAccess
} from "@glantri/domain";
import { getSkillGroupIds, glantriCharacteristicKeySchema } from "@glantri/domain";

import {
  buildCharacterSheetSummary,
  type CharacterSheetSummary
} from "../sheets/buildCharacterSheetSummary";
import {
  getActiveGroupSkillPurchaseCost,
  getPrimaryPurchaseCostForSkill,
  getSecondaryPurchaseCostForSkill,
  getSecondaryPurchaseCostForSpecialization,
  normalizeChargenProgression,
  type ChargenDraftView
} from "../chargen/primaryAllocation";
import { applyRelationshipMinimumGrants } from "../skills/deriveSkillRelationships";

interface CanonicalContentShape {
  professionFamilies: ProfessionFamilyDefinition[];
  professions: ProfessionDefinition[];
  professionSkills: ProfessionSkillMap[];
  skillGroups: SkillGroupDefinition[];
  skills: SkillDefinition[];
  societyLevels: SocietyLevelAccess[];
  specializations: SkillSpecialization[];
}

export interface CharacterProgressionTargetRow {
  checked: boolean;
  checkId?: string;
  cost?: number;
  currentValue: number;
  disabledReason?: string;
  label: string;
  pending: boolean;
  provisional: boolean;
  targetId: string;
  targetType: ProgressionTargetType;
}

export interface CharacterProgressionView {
  availablePoints: number;
  checks: CharacterProgressionCheck[];
  draftView: ChargenDraftView;
  history: CharacterProgressionHistoryEntry[];
  pendingAttempts: CharacterProgressionPendingAttempt[];
  rows: CharacterProgressionTargetRow[];
  sheetSummary: CharacterSheetSummary;
}

export interface OpenEndedProgressionRoll {
  openEndedD10s: number[];
  rollD20: number;
  rollTotal: number;
}

function createEmptyProgressionState(): CharacterProgressionState {
  return {
    availablePoints: 0,
    checks: [],
    history: [],
    pendingAttempts: []
  };
}

export function getCharacterProgressionState(
  build: Pick<CharacterBuild, "progressionState">
): CharacterProgressionState {
  return build.progressionState ?? createEmptyProgressionState();
}

function createId(prefix: string): string {
  const randomSuffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2);

  return `${prefix}-${randomSuffix}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function getSkillById(
  content: CanonicalContentShape,
  skillId: string
): SkillDefinition | undefined {
  return content.skills.find((skill) => skill.id === skillId);
}

function getGroupById(
  content: CanonicalContentShape,
  groupId: string
): SkillGroupDefinition | undefined {
  return content.skillGroups.find((group) => group.id === groupId);
}

function getSpecializationById(
  content: CanonicalContentShape,
  specializationId: string
): SkillSpecialization | undefined {
  return content.specializations.find((specialization) => specialization.id === specializationId);
}

function isValidProgressionTarget(input: {
  content: CanonicalContentShape;
  targetId: string;
  targetType: ProgressionTargetType;
}): boolean {
  if (input.targetType === "skill") {
    return Boolean(getSkillById(input.content, input.targetId));
  }

  if (input.targetType === "skillGroup") {
    return Boolean(getGroupById(input.content, input.targetId));
  }

  if (input.targetType === "specialization") {
    return Boolean(getSpecializationById(input.content, input.targetId));
  }

  return glantriCharacteristicKeySchema.safeParse(input.targetId).success;
}

function findCheck(
  state: CharacterProgressionState,
  targetType: ProgressionTargetType,
  targetId: string
): CharacterProgressionCheck | undefined {
  return state.checks.find(
    (check) => check.targetType === targetType && check.targetId === targetId
  );
}

function hasPendingAttempt(
  state: CharacterProgressionState,
  targetType: ProgressionTargetType,
  targetId: string
): boolean {
  return state.pendingAttempts.some(
    (attempt) => attempt.targetType === targetType && attempt.targetId === targetId
  );
}

function getStatValue(
  build: CharacterBuild,
  stat: GlantriCharacteristicKey
): number {
  return (build.profile.resolvedStats?.[stat] ?? build.profile.rolledStats[stat] ?? 0) +
    (build.statModifiers?.[stat] ?? 0);
}

function getTargetLabel(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
  targetId: string;
  targetType: ProgressionTargetType;
}): string {
  if (input.targetType === "skill") {
    return getSkillById(input.content, input.targetId)?.name ?? input.targetId;
  }

  if (input.targetType === "skillGroup") {
    return getGroupById(input.content, input.targetId)?.name ?? input.targetId;
  }

  if (input.targetType === "specialization") {
    return getSpecializationById(input.content, input.targetId)?.name ?? input.targetId;
  }

  return input.targetId.toUpperCase();
}

function getTargetCurrentValue(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
  sheetSummary: CharacterSheetSummary;
  targetId: string;
  targetType: ProgressionTargetType;
}): number {
  if (input.targetType === "skill") {
    return input.sheetSummary.draftView.skills.find((skill) => skill.skillId === input.targetId)
      ?.effectiveSkillNumber ?? 0;
  }

  if (input.targetType === "skillGroup") {
    return input.sheetSummary.draftView.groups.find((group) => group.groupId === input.targetId)
      ?.groupLevel ?? 0;
  }

  if (input.targetType === "specialization") {
    return input.sheetSummary.draftView.specializations.find(
      (specialization) => specialization.specializationId === input.targetId
    )?.effectiveSpecializationNumber ?? 0;
  }

  return getStatValue(input.build, input.targetId as GlantriCharacteristicKey);
}

function getProgressionAttemptCost(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
  targetId: string;
  targetType: ProgressionTargetType;
}): { cost?: number; error?: string } {
  if (input.targetType === "stat") {
    return { error: "Stat advancement is not enabled yet." };
  }

  const progression = normalizeChargenProgression(input.build.progression);

  if (input.targetType === "skillGroup") {
    return getActiveGroupSkillPurchaseCost({
      content: input.content,
      groupId: input.targetId,
      progression
    });
  }

  if (input.targetType === "skill") {
    const skill = getSkillById(input.content, input.targetId);

    if (!skill) {
      return { error: "Skill definition not found." };
    }

    return {
      cost:
        skill.category === "secondary"
          ? getSecondaryPurchaseCostForSkill(progression, skill)
          : getPrimaryPurchaseCostForSkill(progression, skill)
    };
  }

  const specialization = getSpecializationById(input.content, input.targetId);

  if (!specialization) {
    return { error: "Specialization definition not found." };
  }

  return {
    cost: getSecondaryPurchaseCostForSpecialization(progression, specialization)
  };
}

function createEmptySkill(skill: SkillDefinition): CharacterSkill {
  return {
    category: skill.category,
    categoryId: skill.categoryId,
    grantedRanks: 0,
    groupId: getSkillGroupIds(skill)[0] ?? skill.groupId,
    groupIds: getSkillGroupIds(skill),
    level: 0,
    primaryRanks: 0,
    ranks: 0,
    relationshipGrantedRanks: 0,
    secondaryRanks: 0,
    skillId: skill.id
  };
}

function ensureSkillExists(
  progression: CharacterProgression,
  skill: SkillDefinition
): CharacterSkill {
  const existing = progression.skills.find((entry) => entry.skillId === skill.id);

  if (existing) {
    return existing;
  }

  const created = createEmptySkill(skill);
  progression.skills.push(created);
  return created;
}

function ensureGroupExists(
  progression: CharacterProgression,
  groupId: string
): CharacterSkillGroup {
  const existing = progression.skillGroups.find((group) => group.groupId === groupId);

  if (existing) {
    return existing;
  }

  const created: CharacterSkillGroup = {
    gms: 0,
    grantedRanks: 0,
    groupId,
    primaryRanks: 0,
    ranks: 0,
    secondaryRanks: 0
  };
  progression.skillGroups.push(created);
  return created;
}

function ensureSpecializationExists(
  progression: CharacterProgression,
  specialization: SkillSpecialization
): CharacterSpecialization {
  const existing = progression.specializations.find(
    (entry) => entry.specializationId === specialization.id
  );

  if (existing) {
    return existing;
  }

  const created: CharacterSpecialization = {
    level: 0,
    ranks: 0,
    relationshipGrantedRanks: 0,
    secondaryRanks: 0,
    skillId: specialization.skillId,
    specializationId: specialization.id
  };
  progression.specializations.push(created);
  return created;
}

function applySuccessfulIncrease(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
  targetId: string;
  targetType: ProgressionTargetType;
}): CharacterBuild {
  const build = structuredClone(input.build);
  const progression = normalizeChargenProgression(build.progression);

  if (input.targetType === "skillGroup") {
    const group = ensureGroupExists(progression, input.targetId);
    group.primaryRanks += 1;
    group.ranks = group.grantedRanks + group.primaryRanks + group.secondaryRanks;
  } else if (input.targetType === "skill") {
    const skillDefinition = getSkillById(input.content, input.targetId);

    if (!skillDefinition) {
      return input.build;
    }

    const skill = ensureSkillExists(progression, skillDefinition);

    if (skillDefinition.category === "secondary") {
      skill.secondaryRanks += 1;
    } else {
      skill.primaryRanks += 1;
    }

    skill.ranks =
      skill.grantedRanks +
      skill.primaryRanks +
      skill.secondaryRanks +
      (skill.relationshipGrantedRanks ?? 0);
  } else if (input.targetType === "specialization") {
    const specializationDefinition = getSpecializationById(input.content, input.targetId);

    if (!specializationDefinition) {
      return input.build;
    }

    const specialization = ensureSpecializationExists(progression, specializationDefinition);
    specialization.secondaryRanks += 1;
    specialization.ranks =
      specialization.secondaryRanks + (specialization.relationshipGrantedRanks ?? 0);
  }

  build.progression = normalizeChargenProgression(
    applyRelationshipMinimumGrants({
      content: input.content,
      progression
    })
  );
  return build;
}

export function rollOpenEndedProgressionD20(rng: () => number = Math.random): OpenEndedProgressionRoll {
  const rollDie = (sides: number) => Math.floor(rng() * sides) + 1;
  const rollD20 = rollDie(20);
  const openEndedD10s: number[] = [];
  let rollTotal = rollD20;

  if (rollD20 === 20) {
    let nextD10 = 0;

    do {
      nextD10 = rollDie(10);
      openEndedD10s.push(nextD10);
      rollTotal += nextD10;
    } while (nextD10 === 10);
  }

  return {
    openEndedD10s,
    rollD20,
    rollTotal
  };
}

export function grantCharacterProgressionPoints(input: {
  amount: number;
  build: CharacterBuild;
}): CharacterBuild {
  const build = structuredClone(input.build);
  const state = getCharacterProgressionState(build);

  build.progressionState = {
    ...state,
    availablePoints: Math.max(0, state.availablePoints + Math.trunc(input.amount))
  };
  return build;
}

export function addCharacterProgressionCheck(input: {
  build: CharacterBuild;
  checkedBy?: string;
  content: CanonicalContentShape;
  notes?: string;
  provisional?: boolean;
  targetId: string;
  targetType: ProgressionTargetType;
}): CharacterBuild {
  const build = structuredClone(input.build);
  const state = getCharacterProgressionState(build);
  const existing = findCheck(state, input.targetType, input.targetId);

  if (existing || !isValidProgressionTarget(input)) {
    return build;
  }

  build.progressionState = {
    ...state,
    checks: [
      ...state.checks,
      {
        checkedAt: nowIso(),
        checkedBy: input.checkedBy,
        id: createId("check"),
        notes: input.notes,
        provisional: input.provisional,
        targetId: input.targetId,
        targetLabel: getTargetLabel(input),
        targetType: input.targetType
      }
    ]
  };
  return build;
}

export function removeCharacterProgressionCheck(input: {
  build: CharacterBuild;
  targetId: string;
  targetType: ProgressionTargetType;
}): CharacterBuild {
  const build = structuredClone(input.build);
  const state = getCharacterProgressionState(build);

  build.progressionState = {
    ...state,
    checks: state.checks.filter(
      (check) => check.targetType !== input.targetType || check.targetId !== input.targetId
    )
  };
  return build;
}

export function buyCharacterProgressionAttempt(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
  purchasedBy?: string;
  targetId: string;
  targetType: ProgressionTargetType;
}): {
  attempt?: CharacterProgressionPendingAttempt;
  build: CharacterBuild;
  error?: string;
} {
  const build = structuredClone(input.build);
  const state = getCharacterProgressionState(build);
  const check = findCheck(state, input.targetType, input.targetId);

  if (!check) {
    return { build, error: "This target needs a check before buying a progression attempt." };
  }

  if (hasPendingAttempt(state, input.targetType, input.targetId)) {
    return { build, error: "This target already has a pending progression attempt." };
  }

  const costResult = getProgressionAttemptCost(input);

  if (costResult.error || costResult.cost === undefined) {
    return { build, error: costResult.error ?? "Could not price this progression attempt." };
  }

  if (state.availablePoints < costResult.cost) {
    return { build, error: "Not enough progression points for that attempt." };
  }

  const attempt: CharacterProgressionPendingAttempt = {
    checkId: check.id,
    cost: costResult.cost,
    id: createId("attempt"),
    purchasedAt: nowIso(),
    purchasedBy: input.purchasedBy,
    targetId: input.targetId,
    targetLabel: check.targetLabel,
    targetType: input.targetType
  };

  build.progressionState = {
    ...state,
    availablePoints: state.availablePoints - costResult.cost,
    pendingAttempts: [...state.pendingAttempts, attempt]
  };
  return { attempt, build };
}

export function resolveCharacterProgressionAttempts(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
  resolvedAt?: string;
  rng?: () => number;
}): { build: CharacterBuild; history: CharacterProgressionHistoryEntry[] } {
  let build = structuredClone(input.build);
  const startingState = getCharacterProgressionState(build);
  const resolvedAt = input.resolvedAt ?? nowIso();
  const resolvedHistory: CharacterProgressionHistoryEntry[] = [];
  let checks = [...startingState.checks];

  for (const attempt of startingState.pendingAttempts) {
    const sheetSummary = buildCharacterSheetSummary({
      build,
      content: input.content
    });
    const beforeValue = getTargetCurrentValue({
      build,
      content: input.content,
      sheetSummary,
      targetId: attempt.targetId,
      targetType: attempt.targetType
    });
    const roll = rollOpenEndedProgressionD20(input.rng);
    const success = attempt.targetType !== "stat" && roll.rollTotal >= beforeValue;
    const nextBuild = success
      ? applySuccessfulIncrease({
          build,
          content: input.content,
          targetId: attempt.targetId,
          targetType: attempt.targetType
        })
      : build;
    const nextSheetSummary = buildCharacterSheetSummary({
      build: nextBuild,
      content: input.content
    });
    const afterValue = success
      ? getTargetCurrentValue({
          build: nextBuild,
          content: input.content,
          sheetSummary: nextSheetSummary,
          targetId: attempt.targetId,
          targetType: attempt.targetType
        })
      : beforeValue;
    const historyEntry: CharacterProgressionHistoryEntry = {
      afterValue,
      beforeValue,
      cost: attempt.cost,
      id: createId("history"),
      openEndedD10s: roll.openEndedD10s,
      resolvedAt,
      rollD20: roll.rollD20,
      rollTotal: roll.rollTotal,
      success,
      targetId: attempt.targetId,
      targetLabel: attempt.targetLabel,
      targetType: attempt.targetType,
      threshold: beforeValue
    };

    resolvedHistory.push(historyEntry);
    checks = checks.filter((check) => check.id !== attempt.checkId);
    build = nextBuild;
  }

  build.progressionState = {
    ...getCharacterProgressionState(build),
    checks,
    history: [...startingState.history, ...resolvedHistory],
    pendingAttempts: []
  };

  return {
    build,
    history: resolvedHistory
  };
}

export function buildCharacterProgressionView(input: {
  build: CharacterBuild;
  content: CanonicalContentShape;
}): CharacterProgressionView {
  const state = getCharacterProgressionState(input.build);
  const sheetSummary = buildCharacterSheetSummary(input);
  const rowsByKey = new Map<string, CharacterProgressionTargetRow>();

  const addRow = (row: Omit<CharacterProgressionTargetRow, "checked" | "checkId" | "pending">) => {
    const check = findCheck(state, row.targetType, row.targetId);
    const pending = hasPendingAttempt(state, row.targetType, row.targetId);
    rowsByKey.set(`${row.targetType}:${row.targetId}`, {
      ...row,
      checked: Boolean(check),
      checkId: check?.id,
      pending
    });
  };

  for (const group of sheetSummary.draftView.groups) {
    const costResult = getProgressionAttemptCost({
      build: input.build,
      content: input.content,
      targetId: group.groupId,
      targetType: "skillGroup"
    });
    addRow({
      cost: costResult.cost,
      currentValue: group.groupLevel,
      disabledReason: costResult.error,
      label: group.name,
      provisional: false,
      targetId: group.groupId,
      targetType: "skillGroup"
    });
  }

  for (const skill of sheetSummary.draftView.skills) {
    const costResult = getProgressionAttemptCost({
      build: input.build,
      content: input.content,
      targetId: skill.skillId,
      targetType: "skill"
    });
    addRow({
      cost: costResult.cost,
      currentValue: skill.effectiveSkillNumber,
      disabledReason: costResult.error,
      label: skill.name,
      provisional: false,
      targetId: skill.skillId,
      targetType: "skill"
    });
  }

  for (const specialization of sheetSummary.draftView.specializations) {
    const costResult = getProgressionAttemptCost({
      build: input.build,
      content: input.content,
      targetId: specialization.specializationId,
      targetType: "specialization"
    });
    addRow({
      cost: costResult.cost,
      currentValue: specialization.effectiveSpecializationNumber,
      disabledReason: costResult.error,
      label: specialization.name,
      provisional: false,
      targetId: specialization.specializationId,
      targetType: "specialization"
    });
  }

  for (const check of state.checks) {
    const key = `${check.targetType}:${check.targetId}`;

    if (rowsByKey.has(key)) {
      continue;
    }

    const costResult = getProgressionAttemptCost({
      build: input.build,
      content: input.content,
      targetId: check.targetId,
      targetType: check.targetType
    });
    rowsByKey.set(key, {
      checked: true,
      checkId: check.id,
      cost: costResult.cost,
      currentValue:
        check.targetType === "stat"
          ? getStatValue(input.build, check.targetId as GlantriCharacteristicKey)
          : 0,
      disabledReason: costResult.error,
      label: check.targetLabel,
      pending: hasPendingAttempt(state, check.targetType, check.targetId),
      provisional: Boolean(check.provisional),
      targetId: check.targetId,
      targetType: check.targetType
    });
  }

  return {
    availablePoints: state.availablePoints,
    checks: state.checks,
    draftView: sheetSummary.draftView,
    history: state.history,
    pendingAttempts: state.pendingAttempts,
    rows: [...rowsByKey.values()].sort((left, right) =>
      left.targetType.localeCompare(right.targetType) || left.label.localeCompare(right.label)
    ),
    sheetSummary
  };
}

export function reviewCharacterAdvancement(input: {
  advancementPointsSpent?: number;
  advancementPointsTotal?: number;
  build: CharacterBuild;
  content: CanonicalContentShape;
}): {
  canSave: boolean;
  errors: string[];
  view: {
    advancementPointsAvailable: number;
    advancementPointsSpent: number;
    advancementPointsTotal: number;
    draftView: ChargenDraftView;
    seniority: number;
    totalSkillPointsInvested: number;
  };
  warnings: string[];
} {
  const progressionView = buildCharacterProgressionView(input);

  return {
    canSave: true,
    errors: [],
    view: {
      advancementPointsAvailable: progressionView.availablePoints,
      advancementPointsSpent: input.build.progressionState?.history.reduce(
        (total, entry) => total + entry.cost,
        0
      ) ?? 0,
      advancementPointsTotal:
        progressionView.availablePoints +
        (input.build.progressionState?.history.reduce((total, entry) => total + entry.cost, 0) ??
          0) +
        (input.build.progressionState?.pendingAttempts.reduce(
          (total, entry) => total + entry.cost,
          0
        ) ?? 0),
      draftView: progressionView.draftView,
      seniority: progressionView.sheetSummary.seniority,
      totalSkillPointsInvested: progressionView.sheetSummary.totalSkillPointsInvested
    },
    warnings: []
  };
}

export function spendAdvancementPoint(input: {
  advancementPointsSpent?: number;
  advancementPointsTotal?: number;
  build: CharacterBuild;
  content: CanonicalContentShape;
  targetId: string;
  targetType: "group" | "skill" | "specialization";
}): {
  advancementPointsSpent: number;
  build: CharacterBuild;
  error?: string;
  spentCost?: number;
  warnings: string[];
} {
  const mappedTargetType = input.targetType === "group" ? "skillGroup" : input.targetType;
  const result = buyCharacterProgressionAttempt({
    build: input.build,
    content: input.content,
    targetId: input.targetId,
    targetType: mappedTargetType
  });
  const state = getCharacterProgressionState(result.build);

  return {
    advancementPointsSpent: state.pendingAttempts.reduce((total, attempt) => total + attempt.cost, 0),
    build: result.build,
    error: result.error,
    spentCost: result.attempt?.cost,
    warnings: []
  };
}
