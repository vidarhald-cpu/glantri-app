import type {
  EncounterParticipant,
  RoleplayCalculationPreview,
  RoleplayDifficulty,
  RoleplayOpenEndedD20Roll,
} from "@glantri/domain";

import type { PlayerFacingSkillBucketId } from "@/lib/chargen/chargenBrowse";

export interface SkillOption {
  categoryId?: PlayerFacingSkillBucketId;
  categoryLabel?: string;
  id: string;
  label: string;
  value?: number;
}

export interface RoleplayRollDraft {
  actorRoll?: RoleplayOpenEndedD20Roll;
  difficulty: "none" | RoleplayDifficulty;
  id: string;
  otherModInput: string;
  opponentBlockOpen: boolean;
  opponentOtherModInput: string;
  opponentParticipantId: string;
  opponentRoll?: RoleplayOpenEndedD20Roll;
  opponentSilent: boolean;
  opponentSkillCategoryId: "all" | PlayerFacingSkillBucketId;
  opponentSkillId: string;
  opponentSupportSkillCategoryId: "all" | PlayerFacingSkillBucketId;
  opponentSupportSkillId: string;
  opponentUseDbMod: boolean;
  opponentUseGenMod: boolean;
  opponentUseObSkillMod: boolean;
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

export interface RoleplayRollContext {
  allOpponentSkillOptions: SkillOption[];
  allSkillOptions: SkillOption[];
  isOpposed: boolean;
  opponent?: EncounterParticipant;
  opponentPreview?: RoleplayCalculationPreview;
  opponentSupportPreview?: RoleplayCalculationPreview;
  opponentSupportSkillOptions: SkillOption[];
  opponentSkillOptions: SkillOption[];
  otherMod: number;
  opponentOtherMod: number;
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

export type RoleplayRollAssignSide = "actor" | "opponent";
export type RoleplayRollGmSide = RoleplayRollAssignSide | "both";
