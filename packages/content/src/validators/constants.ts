export const EXPECTED_SOCIAL_BANDS = [1, 2, 3, 4] as const;
export const EXPECTED_SOCIETY_SCALE = [1, 2, 3, 4, 5, 6] as const;
export const MINIMUM_GROUP_SKILL_COUNT = 3;
export const MINIMUM_GROUP_SKILL_POINTS = 7;
export const MINIMUM_DESIGN_GROUP_SKILL_POINTS = 6;

export const RETIRED_SKILL_GROUP_IDS = [
  "field_soldiering",
  "officer_training",
  "trap_and_intrusion_work",
] as const;

export const COMBAT_FUNDAMENTAL_SKILL_IDS = ["dodge", "parry", "brawling"] as const;
export const MELEE_WEAPON_SKILL_IDS = [
  "one_handed_edged",
  "one_handed_concussion_axe",
  "two_handed_edged",
  "two_handed_concussion_axe",
  "polearms",
  "lance",
] as const;
export const MISSILE_WEAPON_SKILL_IDS = ["throwing", "sling", "bow", "crossbow"] as const;
export const WEAPON_SKILL_IDS = [...MELEE_WEAPON_SKILL_IDS, ...MISSILE_WEAPON_SKILL_IDS] as const;

export const ALLOWED_SMALL_SKILL_GROUP_REASONS: Partial<Record<string, string>> = {
  civic_learning: "Focused civic literacy and law foundation.",
  commercial_administration: "Focused ledger and office-administration foundation.",
  fieldcraft_stealth: "Focused stealth/camouflage fieldcraft cluster.",
  formal_performance: "Focused formal stage/oratory performance cluster.",
  healing_practice: "Focused practical healing foundation.",
  maritime_crew_training: "Focused shipboard crew baseline.",
  omen_and_ritual_practice: "Focused divination and ritual-reading cluster.",
  political_acumen: "Focused social-political reading cluster.",
  social_reading: "Focused social perception cluster.",
  stealth_group: "Broad stealth taxonomy group retained for compatibility.",
  street_theft: "Focused petty theft and concealment cluster.",
};

export const ALLOWED_WEAPON_PACKAGE_REASONS: Partial<Record<string, string>> = {
  advanced_melee_training: "Coherent melee package with Dodge, Parry, Brawling, and melee weapon choices.",
  advanced_missile_training: "Weapon-choice missile package.",
  basic_melee_training: "Coherent melee package with Dodge, Parry, Brawling, and a melee weapon choice.",
  basic_missile_training: "Weapon-choice missile package.",
  combat_group: "Broad combat taxonomy group.",
  mounted_warrior_training: "Coherent mounted combat package with Dodge, Parry, and fixed mounted weapons.",
};

export const MILITARY_SUPPORT_GROUP_IDS = ["defensive_soldiering", "veteran_soldiering"] as const;
export const OFFICER_COMMAND_SKILL_IDS = ["captaincy", "tactics"] as const;

export const CANONICAL_SKILL_GROUP_NAMES: Partial<Record<string, string>> = {
  covert_entry: "Covert Entry",
  veteran_leadership: "Veteran Leadership",
  veteran_soldiering: "Veteran Soldiering",
};

export const CANONICAL_SKILL_GROUP_MEMBERSHIPS: Partial<Record<string, string[]>> = {
  defensive_soldiering: [
    "formation_fighting",
    "battlefield_awareness",
    "perception",
    "combat_experience",
    "first_aid",
  ],
  veteran_soldiering: [
    "combat_experience",
    "battlefield_awareness",
    "perception",
    "first_aid",
    "weapon_maintenance",
  ],
};

export const REMOVED_SKILL_GROUP_IDS_BY_SKILL_ID: Partial<Record<string, string[]>> = {
  dodge: [
    "basic_missile_training",
    "advanced_missile_training",
    "defensive_soldiering",
    "veteran_soldiering",
  ],
  longbow: ["basic_missile_training", "advanced_missile_training"],
  parry: ["defensive_soldiering", "veteran_soldiering"],
};

export const CANONICAL_SELECTION_SLOT_CANDIDATES: Partial<Record<string, Record<string, string[]>>> = {
  advanced_missile_training: {
    advanced_missile_weapon_choices: [...MISSILE_WEAPON_SKILL_IDS],
  },
  basic_missile_training: {
    missile_weapon_choice: [...MISSILE_WEAPON_SKILL_IDS],
  },
};
