import {
  getSkillGroupIds,
  type CharacterBuild,
  type ProfessionDefinition,
  type ProfessionFamilyDefinition,
  type ProfessionSkillMap,
  type SkillDefinition,
  type SkillGroupDefinition,
  type SkillSpecialization,
  type SocietyLevelAccess,
} from "@glantri/domain";

import { getResolvedProfileStats } from "../chargen/statResolution";
import { buildCharacterSheetSummary } from "../sheets/buildCharacterSheetSummary";
import { selectBestSkillGroupContribution } from "../skills/selectBestSkillGroupContribution";

export interface ParticipantSkillRollProfile {
  avgStats: number;
  derivedXP: number;
  groupXP: number;
  known: boolean;
  linkedStats: string[];
  participantId?: string;
  participantName?: string;
  rollBaseValue: number;
  skillId: string;
  skillName: string;
  skillXP: number;
  sourceQuality: "full" | "snapshot" | "missing";
  totalSkillLevel: number;
  totalXP: number;
  unknownSkillPenalty: number;
  warning?: string;
}

export interface ResolveParticipantSkillRollProfileInput {
  build?: unknown;
  content?: {
    professionFamilies: ProfessionFamilyDefinition[];
    professions: ProfessionDefinition[];
    professionSkills: ProfessionSkillMap[];
    skillGroups: SkillGroupDefinition[];
    skills: SkillDefinition[];
    societyLevels: SocietyLevelAccess[];
    specializations: SkillSpecialization[];
  };
  participantId?: string;
  participantName?: string;
  sheetSummary?: unknown;
  skill: Pick<SkillDefinition, "groupId" | "groupIds" | "id" | "linkedStats" | "name">;
}

const UNKNOWN_SKILL_WARNING =
  "Skill not known: using linked stat average with -3 default modifier. GM may adjust or forbid.";
const NO_STATS_WARNING = "No stats available for this actor.";
const PARTIAL_STATS_WARNING = "Stats unavailable; using stored skill value only.";

const STAT_KEY_ALIASES: Record<string, string> = {
  charisma: "cha",
  cha: "cha",
  com: "com",
  comeliness: "com",
  con: "con",
  constitution: "con",
  dex: "dex",
  dexterity: "dex",
  health: "health",
  hp: "health",
  int: "int",
  intelligence: "int",
  lck: "lck",
  luck: "lck",
  pow: "pow",
  power: "pow",
  siz: "siz",
  size: "siz",
  str: "str",
  strength: "str",
  will: "will",
  willpower: "will",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readStatsFromRecord(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const entries = Object.entries(value).flatMap(([key, entry]) => {
    const numeric = readNumber(entry);
    const normalizedKey = STAT_KEY_ALIASES[key.trim().toLowerCase()] ?? key.trim().toLowerCase();
    return numeric == null ? [] : ([[normalizedKey, numeric]] as const);
  });

  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

function readProfileStats(build: unknown): Record<string, number> | undefined {
  if (!isRecord(build) || !isRecord(build.profile)) {
    return undefined;
  }

  const resolvedStats = getResolvedProfileStats(build.profile as Parameters<typeof getResolvedProfileStats>[0]);
  return readStatsFromRecord(resolvedStats);
}

function readSheetStats(sheetSummary: unknown): Record<string, number> | undefined {
  if (!isRecord(sheetSummary)) {
    return undefined;
  }

  return (
    readStatsFromRecord(sheetSummary.adjustedStats) ??
    (isRecord(sheetSummary.draftView) ? readStatsFromRecord(sheetSummary.draftView.adjustedStats) : undefined)
  );
}

function readStatsBlock(value: unknown): Record<string, number> | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  return readStatsFromRecord(value.final) ?? readStatsFromRecord(value.base) ?? readStatsFromRecord(value);
}

function readSnapshotStats(snapshot: unknown): Record<string, number> | undefined {
  if (!isRecord(snapshot)) {
    return undefined;
  }

  return (
    (isRecord(snapshot.generatedHumanoidNpc) ? readStatsBlock(snapshot.generatedHumanoidNpc.stats) : undefined) ??
    (isRecord(snapshot.humanoidNpcArchetype) ? readStatsBlock(snapshot.humanoidNpcArchetype.stats) : undefined) ??
    readStatsBlock(snapshot.stats)
  );
}

function getLinkedStatAverage(input: {
  linkedStats: readonly string[];
  stats?: Record<string, number>;
}): number | undefined {
  if (!input.stats || input.linkedStats.length === 0) {
    return undefined;
  }

  const values = input.linkedStats.map((stat) => input.stats?.[stat]).filter((value): value is number => value != null);

  if (values.length !== input.linkedStats.length) {
    return undefined;
  }

  return Math.floor(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function findSkillView(input: {
  sheetSummary?: unknown;
  skillId: string;
}): Record<string, unknown> | undefined {
  if (!isRecord(input.sheetSummary) || !isRecord(input.sheetSummary.draftView)) {
    return undefined;
  }

  const skills = input.sheetSummary.draftView.skills;

  if (!Array.isArray(skills)) {
    return undefined;
  }

  return skills.find(
    (skill): skill is Record<string, unknown> =>
      isRecord(skill) && readString(skill.skillId) === input.skillId
  );
}

function readSnapshotSkillView(input: {
  snapshot?: unknown;
  skillId: string;
}): Record<string, unknown> | undefined {
  if (!isRecord(input.snapshot)) {
    return undefined;
  }

  const skillLists = [
    isRecord(input.snapshot.generatedHumanoidNpc) ? input.snapshot.generatedHumanoidNpc.skills : undefined,
    isRecord(input.snapshot.humanoidNpcArchetype) ? input.snapshot.humanoidNpcArchetype.skills : undefined,
    input.snapshot.skills,
  ];

  for (const skills of skillLists) {
    if (!Array.isArray(skills)) {
      continue;
    }

    const skill = skills.find(
      (entry): entry is Record<string, unknown> =>
        isRecord(entry) && readString(entry.skillId) === input.skillId
    );

    if (skill) {
      return skill;
    }
  }

  return undefined;
}

function readSnapshotFinalSkill(skillView: Record<string, unknown> | undefined): number | undefined {
  return readNumber(skillView?.totalSkill) ?? readNumber(skillView?.totalSkillLevel);
}

function readSnapshotSkillContribution(skillView: Record<string, unknown> | undefined): number | undefined {
  // Generated/template NPC `targetLevel` values come from seniority bands and represent
  // skill contribution/ranks. Explicit totalSkill fields, when present, are final totals.
  return (
    readNumber(skillView?.effectiveSkillNumber) ??
    readNumber(skillView?.skillXP) ??
    readNumber(skillView?.skillXp) ??
    readNumber(skillView?.ranks) ??
    readNumber(skillView?.targetLevel) ??
    readNumber(skillView?.level)
  );
}

function hasDraftViewSkills(sheetSummary: unknown): boolean {
  return (
    isRecord(sheetSummary) &&
    isRecord(sheetSummary.draftView) &&
    Array.isArray(sheetSummary.draftView.skills)
  );
}

function buildSheetSummaryFromSnapshot(input: ResolveParticipantSkillRollProfileInput): unknown {
  if (hasDraftViewSkills(input.sheetSummary) || !input.content || !input.build) {
    return input.sheetSummary;
  }

  try {
    return buildCharacterSheetSummary({
      build: input.build as CharacterBuild,
      content: input.content,
    });
  } catch {
    return input.sheetSummary;
  }
}

function readBestGroupXp(input: {
  sheetSummary?: unknown;
  skill: Pick<SkillDefinition, "groupId" | "groupIds" | "id">;
}): number | undefined {
  if (!isRecord(input.sheetSummary) || !isRecord(input.sheetSummary.draftView)) {
    return undefined;
  }

  const groups = input.sheetSummary.draftView.groups;

  if (!Array.isArray(groups)) {
    return undefined;
  }

  const groupContributions = getSkillGroupIds(input.skill)
    .map((groupId) => {
      const groupView = groups.find(
        (group): group is Record<string, unknown> =>
          isRecord(group) && readString(group.groupId) === groupId
      );
      const groupLevel = readNumber(groupView?.groupLevel);

      if (!groupView || groupLevel == null || groupLevel <= 0) {
        return null;
      }

      return {
        groupId,
        groupLevel,
        name: readString(groupView.name) ?? groupId,
        sortOrder: readNumber(groupView.sortOrder) ?? Number.MAX_SAFE_INTEGER,
      };
    })
    .filter((group): group is NonNullable<typeof group> => group !== null);

  return selectBestSkillGroupContribution(groupContributions)?.groupLevel;
}

export function resolveParticipantSkillRollProfile(
  input: ResolveParticipantSkillRollProfileInput
): ParticipantSkillRollProfile {
  const sheetSummary = buildSheetSummaryFromSnapshot(input);
  const skillView = findSkillView({
    sheetSummary,
    skillId: input.skill.id,
  });
  const snapshotSkillView = readSnapshotSkillView({
    snapshot: input.build,
    skillId: input.skill.id,
  });
  const stats = readProfileStats(input.build) ?? readSheetStats(sheetSummary) ?? readSnapshotStats(input.build);
  const avgStats =
    readNumber(skillView?.linkedStatAverage) ??
    getLinkedStatAverage({ linkedStats: input.skill.linkedStats, stats }) ??
    0;
  const snapshotFinalSkill = readSnapshotFinalSkill(snapshotSkillView);
  const snapshotSkillContribution = readSnapshotSkillContribution(snapshotSkillView);
  const hasStats = Boolean(stats);
  const groupXP = readBestGroupXp({ sheetSummary, skill: input.skill }) ?? readNumber(skillView?.groupLevel) ?? 0;
  const skillXP =
    readNumber(skillView?.specificSkillLevel) ??
    (snapshotFinalSkill == null
      ? snapshotSkillContribution ?? 0
      : Math.max(0, snapshotFinalSkill - avgStats));
  const derivedXP = readNumber(skillView?.relationshipGrantedSkillLevel) ?? 0;
  const totalXP =
    readNumber(skillView?.effectiveSkillNumber) ??
    (snapshotFinalSkill == null ? groupXP + skillXP + derivedXP : Math.max(0, snapshotFinalSkill - avgStats));
  const totalSkillLevel = readNumber(skillView?.totalSkill) ?? snapshotFinalSkill ?? avgStats + totalXP;
  const known =
    (Boolean(skillView) && totalXP > 0) ||
    (snapshotFinalSkill != null && snapshotFinalSkill > 0) ||
    (snapshotSkillContribution != null && snapshotSkillContribution > 0);
  const sourceQuality: ParticipantSkillRollProfile["sourceQuality"] = skillView
    ? "full"
    : stats || snapshotSkillView
      ? "snapshot"
      : "missing";
  const warning = known
    ? !hasStats && snapshotFinalSkill == null && snapshotSkillContribution != null
      ? PARTIAL_STATS_WARNING
      : undefined
    : sourceQuality === "missing"
      ? NO_STATS_WARNING
      : UNKNOWN_SKILL_WARNING;

  return {
    avgStats,
    derivedXP,
    groupXP,
    known,
    linkedStats: [...input.skill.linkedStats],
    participantId: input.participantId,
    participantName: input.participantName,
    rollBaseValue: known ? totalSkillLevel : avgStats,
    skillId: input.skill.id,
    skillName: input.skill.name,
    skillXP,
    sourceQuality,
    totalSkillLevel: known ? totalSkillLevel : avgStats,
    totalXP: known ? totalXP : 0,
    unknownSkillPenalty: known ? 0 : -3,
    warning,
  };
}
