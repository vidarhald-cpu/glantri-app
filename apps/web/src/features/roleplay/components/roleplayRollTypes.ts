import type {
  EncounterParticipant,
  RoleplayActionLogEntry,
  RoleplayCalculationPreview,
  RoleplayDifficulty,
  RoleplayOpenEndedD20Roll,
} from "@glantri/domain";

import type { ParticipantSkillRollProfile } from "@glantri/rules-engine";

import type { PlayerFacingSkillBucketId } from "@/lib/chargen/chargenBrowse";

export interface SkillOption {
  categoryId?: PlayerFacingSkillBucketId;
  categoryLabel?: string;
  id: string;
  label: string;
  profile?: ParticipantSkillRollProfile;
  value?: number;
  warning?: string;
}

export interface RoleplayRollDraft {
  actorRoll?: RoleplayOpenEndedD20Roll;
  actorSupportRoll?: RoleplayOpenEndedD20Roll;
  difficulty: "none" | RoleplayDifficulty;
  id: string;
  otherModInput: string;
  otherModTouched: boolean;
  opponentBlockOpen: boolean;
  opponentOtherModInput: string;
  opponentOtherModTouched: boolean;
  opponentParticipantId: string;
  opponentRoll?: RoleplayOpenEndedD20Roll;
  opponentSupportRoll?: RoleplayOpenEndedD20Roll;
  opponentSilent: boolean;
  opponentSkillCategoryId: "all" | PlayerFacingSkillBucketId;
  opponentSkillId: string;
  opponentSupportSkillCategoryId: "all" | PlayerFacingSkillBucketId;
  opponentSupportSkillId: string;
  opponentUseDbMod: boolean;
  opponentUseGenMod: boolean;
  opponentUseObSkillMod: boolean;
  participantId: string;
  rollSetId: string;
  silent: boolean;
  skillCategoryId: "all" | PlayerFacingSkillBucketId;
  skillId: string;
  supportSkillCategoryId: "all" | PlayerFacingSkillBucketId;
  supportSkillId: string;
  useDbMod: boolean;
  useGenMod: boolean;
  useObSkillMod: boolean;
}

export interface RoleplayRollContext {
  actorExternalResult?: RoleplayActionLogEntry;
  actorOtherModInput: string;
  allOpponentSkillOptions: SkillOption[];
  allSkillOptions: SkillOption[];
  activeRollSetId?: string;
  activeOpposedRollSetId?: string;
  isOpposed: boolean;
  matchingOpponentPendingRoll?: unknown;
  matchingPendingRoll?: unknown;
  opponent?: EncounterParticipant;
  opponentExternalResult?: RoleplayActionLogEntry;
  opponentOtherMod: number;
  opponentOtherModInput: string;
  opponentPreview?: RoleplayCalculationPreview;
  opponentSupportPreview?: RoleplayCalculationPreview;
  opponentSupportSkillOptions: SkillOption[];
  opponentSkillOptions: SkillOption[];
  otherMod: number;
  participant?: EncounterParticipant;
  preview?: RoleplayCalculationPreview;
  selectedOpponentSkill?: SkillOption;
  selectedOpponentSupportSkill?: SkillOption;
  selectedSkill?: SkillOption;
  selectedSupportSkill?: SkillOption;
  skillOptions: SkillOption[];
  supportPreview?: RoleplayCalculationPreview;
  supportSkillOptions: SkillOption[];
}

export interface PlayerLocalRollDraft {
  difficulty: "none" | RoleplayDifficulty;
  otherModInput: string;
  otherModTouched: boolean;
  opponentParticipantId: string;
  roll?: RoleplayOpenEndedD20Roll;
  supportRoll?: RoleplayOpenEndedD20Roll;
  skillCategoryId: "all" | PlayerFacingSkillBucketId;
  skillId: string;
  supportSkillCategoryId: "all" | PlayerFacingSkillBucketId;
  supportSkillId: string;
  useDbMod: boolean;
  useGenMod: boolean;
  useObSkillMod: boolean;
}

export type RoleplayRollAssignSide = "actor" | "opponent";
export type RoleplayRollGmSide = RoleplayRollAssignSide | "both";
