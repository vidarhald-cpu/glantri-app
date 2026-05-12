import type { SkillDefinition } from "@glantri/domain";

import { getResolvedProfileStats } from "../chargen/statResolution";

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
  participantId?: string;
  participantName?: string;
  sheetSummary?: unknown;
  skill: Pick<SkillDefinition, "id" | "linkedStats" | "name">;
}

const UNKNOWN_SKILL_WARNING =
  "Skill not known: using linked stat average with -3 default modifier. GM may adjust or forbid.";

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
    return numeric == null ? [] : ([[key, numeric]] as const);
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

export function resolveParticipantSkillRollProfile(
  input: ResolveParticipantSkillRollProfileInput
): ParticipantSkillRollProfile {
  const skillView = findSkillView({
    sheetSummary: input.sheetSummary,
    skillId: input.skill.id,
  });
  const stats = readProfileStats(input.build) ?? readSheetStats(input.sheetSummary);
  const avgStats =
    readNumber(skillView?.linkedStatAverage) ??
    getLinkedStatAverage({ linkedStats: input.skill.linkedStats, stats }) ??
    0;
  const groupXP = readNumber(skillView?.groupLevel) ?? 0;
  const skillXP = readNumber(skillView?.specificSkillLevel) ?? 0;
  const derivedXP = readNumber(skillView?.relationshipGrantedSkillLevel) ?? 0;
  const totalXP = readNumber(skillView?.effectiveSkillNumber) ?? groupXP + skillXP + derivedXP;
  const totalSkillLevel = readNumber(skillView?.totalSkill) ?? avgStats + totalXP;
  const known = Boolean(skillView) && totalXP > 0;
  const sourceQuality: ParticipantSkillRollProfile["sourceQuality"] = skillView
    ? "full"
    : stats
      ? "snapshot"
      : "missing";

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
    warning: known
      ? undefined
      : sourceQuality === "missing"
        ? `${UNKNOWN_SKILL_WARNING} Linked stats could not be resolved.`
        : UNKNOWN_SKILL_WARNING,
  };
}
