import {
  accrueCombatCriticalBleed,
  addCombatCriticalExactRationals,
  combatCriticalRuntimeDefinitionSchema,
  combatCriticalCanonicalReviewSchema,
  getCriticalResultWithEffects,
  type CombatCriticalDuration,
  type CombatCriticalAdjudication,
  type CombatCriticalEndEvent,
  type CombatCriticalCanonicalReview,
  type CombatCriticalExactRational,
  type CombatCriticalRuntimeDefinition,
  type CanonicalCombatModifierDurationUnit,
  type CriticalBand,
} from "@glantri/domain";

export const REPRESENTATIVE_CRITICAL_FIXTURE_VERSION = "c1-2026-08-28" as const;
export const REPRESENTATIVE_CRITICAL_WORKBOOK_SHA256 =
  "47cde37df62c8bafd94535d194cc476b5ae6a366271e18ad94e3e1e62c41f09f" as const;

export const CRITICAL_STUN_CHANNELS = ["ob_skill", "db_parry", "initiative"] as const;

export type CriticalStunChannel = (typeof CRITICAL_STUN_CHANNELS)[number];
export type RepresentativeCriticalAuthority =
  | "canonical_approved"
  | "canonical_with_gm_adjudication";
export type RepresentativeCriticalConditionCode =
  | "collapse"
  | "function_unusable"
  | "impaired"
  | "no_action"
  | "parry_only"
  | "prone"
  | "recovery_restricted"
  | "restricted"
  | "unconscious";
export type RepresentativeCriticalOperation = "drop_held_item" | "fall_to_ground";
export type RepresentativeCriticalTreatmentSkill = "first_aid" | "medicine" | "surgery";

export type ExactRational = CombatCriticalExactRational;

/**
 * Hand-maintained structural twin of the persisted `CombatCriticalDuration`. `endEvent` mirrors the
 * canonical optional binding; `text` stays required and keeps exactly the authored source phrase.
 * `unit` references the canonical duration-unit vocabulary rather than restating its members, so
 * this twin cannot drift from it: the compiler rejects a member the canonical vocabulary does not
 * have.
 */
export interface RepresentativeCriticalDuration {
  readonly endEvent?: CombatCriticalEndEvent;
  readonly formula?: "d3" | "d4";
  readonly kind: "fixed_rounds" | "roll_once" | "until_event" | "gm_managed";
  readonly rounds?: number;
  readonly text: string;
  readonly unit?: CanonicalCombatModifierDurationUnit;
}

export interface RepresentativeCriticalStun {
  readonly channels: readonly CriticalStunChannel[];
  readonly duration: RepresentativeCriticalDuration;
  readonly modifier: -1 | -2 | -4 | -8 | null;
  readonly onset: "immediate" | "next_round";
  readonly severity: 1 | 2 | 3 | 4 | 5;
  readonly sourceEffectKey: string;
}

export interface RepresentativeCriticalCondition {
  readonly code: RepresentativeCriticalConditionCode;
  readonly duration: RepresentativeCriticalDuration;
  readonly mechanicallyActive: boolean;
  readonly onset: "immediate" | "next_round";
  readonly sourceEffectKey?: string;
  readonly target: string;
}

export interface RepresentativeCriticalBleed {
  readonly controlStates:
    | readonly ["active", "controlled", "staunched", "resolved"]
    | readonly ["active", "stabilised", "resolved"];
  readonly firstTick: "following_round_su";
  readonly kind: "external" | "internal";
  readonly onset: "immediate";
  readonly rate:
    | { readonly kind: "fixed"; readonly value: ExactRational }
    | {
        readonly divisor: number;
        readonly formula: "d4" | "d6";
        readonly kind: "roll_once";
      };
  readonly sourceEffectKey: string;
  readonly sourceRate: string;
}

export interface RepresentativeCriticalTreatmentStage {
  readonly role: "field_control" | "diagnosis_nonoperative" | "definitive_care";
  readonly skill: RepresentativeCriticalTreatmentSkill;
}

export interface RepresentativeCriticalTreatment {
  readonly equipmentOrOperation: readonly string[];
  readonly gmManaged: boolean;
  readonly guidance: string;
  readonly sourceGate?: string;
  readonly stages: readonly RepresentativeCriticalTreatmentStage[];
}

export interface RepresentativeCriticalInformation {
  readonly mechanicallyActive: false;
  readonly topic: "guidance" | "mortality" | "permanence" | "recovery" | "unresolved";
  readonly value: string;
}

export interface RepresentativeCriticalFixture {
  readonly authority: RepresentativeCriticalAuthority;
  readonly bleed: readonly RepresentativeCriticalBleed[];
  readonly canonicalName: string;
  readonly conditions: readonly RepresentativeCriticalCondition[];
  readonly criticalBand: CriticalBand;
  readonly criticalIndex: number;
  readonly criticalKey: string;
  readonly damageFloor: number;
  readonly description: string;
  readonly family: string;
  readonly familyDisplay: string;
  readonly fixtureVersion: typeof REPRESENTATIVE_CRITICAL_FIXTURE_VERSION;
  readonly information: readonly RepresentativeCriticalInformation[];
  readonly initiativeExample?: {
    readonly equalAffected: false;
    readonly equalInitiative: 7;
    readonly laterAffected: boolean;
    readonly laterInitiative: 4;
    readonly sourceInitiative: 7;
  };
  readonly location: string;
  readonly lookupSupport: "addressable_pilot_family" | "specialized_not_addressable";
  readonly operations: readonly RepresentativeCriticalOperation[];
  readonly provenance: {
    readonly acceptedRuling: "https://github.com/vidarhald-cpu/glantri-app/issues/371#issuecomment-5452750034";
    readonly effectRange: string;
    readonly resultRange: string;
    readonly workbook: "docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx";
    readonly workbookSha256: typeof REPRESENTATIVE_CRITICAL_WORKBOOK_SHA256;
  };
  readonly runtimeSupport: "representative_fixture_only";
  readonly stun?: RepresentativeCriticalStun;
  readonly treatment: RepresentativeCriticalTreatment;
}

interface FixtureSeed extends Omit<
  RepresentativeCriticalFixture,
  | "criticalBand"
  | "criticalIndex"
  | "family"
  | "familyDisplay"
  | "fixtureVersion"
  | "initiativeExample"
  | "location"
  | "lookupSupport"
  | "provenance"
  | "runtimeSupport"
> {
  readonly effectRange: string;
  readonly resultRange: string;
}

const immediate = (text: string): RepresentativeCriticalDuration => ({
  kind: "gm_managed",
  text,
});
const nextRound = (rounds = 1): RepresentativeCriticalDuration => ({
  kind: "fixed_rounds",
  rounds,
  text: `${rounds} full round${rounds === 1 ? "" : "s"} beginning next round`,
  unit: "round",
});
const rollRounds = (formula: "d3" | "d4", text: string): RepresentativeCriticalDuration => ({
  kind: "roll_once",
  formula,
  text,
  unit: "round",
});
/**
 * The authored phrase for each termination event, exactly as the accepted source words it. The
 * `satisfies Record<CombatCriticalEndEvent, string>` clause is compiler-forced: a new event member
 * with no authored phrase fails the typecheck rather than silently losing its text.
 */
const UNTIL_EVENT_TEXT = {
  appropriate_care: "until appropriate care",
  controlled_removal_and_care: "until controlled removal and care",
  extinguishing_flames: "while rolling to extinguish flames",
  flames_extinguished: "until flames extinguished",
  mapped_staunch_event: "until the mapped staunch event",
  separately_resolved: "until separately resolved",
  staunched: "until staunched",
} satisfies Record<CombatCriticalEndEvent, string>;

const until = (endEvent: CombatCriticalEndEvent): RepresentativeCriticalDuration => ({
  endEvent,
  kind: "until_event",
  text: UNTIL_EVENT_TEXT[endEvent],
});

const fixedBleed = (
  sourceEffectKey: string,
  kind: "external" | "internal",
  numerator: number,
  denominator: number,
  sourceRate: string,
): RepresentativeCriticalBleed => ({
  controlStates:
    kind === "external"
      ? ["active", "controlled", "staunched", "resolved"]
      : ["active", "stabilised", "resolved"],
  firstTick: "following_round_su",
  kind,
  onset: "immediate",
  rate: { kind: "fixed", value: { denominator, numerator } },
  sourceEffectKey,
  sourceRate,
});

const rolledBleed = (
  sourceEffectKey: string,
  kind: "external" | "internal",
  formula: "d4" | "d6",
  divisor: number,
  sourceRate: string,
): RepresentativeCriticalBleed => ({
  controlStates:
    kind === "external"
      ? ["active", "controlled", "staunched", "resolved"]
      : ["active", "stabilised", "resolved"],
  firstTick: "following_round_su",
  kind,
  onset: "immediate",
  rate: { divisor, formula, kind: "roll_once" },
  sourceEffectKey,
  sourceRate,
});

const condition = (
  code: RepresentativeCriticalConditionCode,
  target: string,
  duration: RepresentativeCriticalDuration,
  onset: "immediate" | "next_round" = "immediate",
  mechanicallyActive = true,
  sourceEffectKey?: string,
): RepresentativeCriticalCondition => ({
  code,
  duration,
  mechanicallyActive,
  onset,
  sourceEffectKey,
  target,
});

const stun = (
  sourceEffectKey: string,
  severity: 1 | 2 | 3 | 4 | 5,
  modifier: -1 | -2 | -4 | -8 | null,
  duration: RepresentativeCriticalDuration,
  onset: "immediate" | "next_round" = "immediate",
): RepresentativeCriticalStun => ({
  channels: CRITICAL_STUN_CHANNELS,
  duration,
  modifier,
  onset,
  severity,
  sourceEffectKey,
});

const info = (
  topic: RepresentativeCriticalInformation["topic"],
  value: string,
): RepresentativeCriticalInformation => ({ mechanicallyActive: false, topic, value });

const care = (
  guidance: string,
  sourceGate: string | undefined,
  stages: readonly RepresentativeCriticalTreatmentStage[] = [],
  equipmentOrOperation: readonly string[] = [],
  gmManaged = stages.length === 0,
): RepresentativeCriticalTreatment => ({
  equipmentOrOperation,
  gmManaged,
  guidance,
  sourceGate,
  stages,
});

const FIRST_AID: RepresentativeCriticalTreatmentStage = {
  role: "field_control",
  skill: "first_aid",
};
const MEDICINE: RepresentativeCriticalTreatmentStage = {
  role: "diagnosis_nonoperative",
  skill: "medicine",
};
const SURGERY: RepresentativeCriticalTreatmentStage = {
  role: "definitive_care",
  skill: "surgery",
};

const FAMILY_DISPLAY: Readonly<Record<string, string>> = {
  arrows_bolts: "arrows/bolts",
  blunt: "blunt/crush",
  falling_crushing: "falling/crushing",
  fire_energy: "fire/energy",
  firearms: "firearms",
  pointed_weapons: "pointed/puncture",
  sharp: "edged/slash",
};

function createFixture(seed: FixtureSeed): RepresentativeCriticalFixture {
  const [family, location, index] = seed.criticalKey.split("|");
  if (!family || !location || !index) {
    throw new Error(`Invalid representative Critical key '${seed.criticalKey}'.`);
  }
  const criticalIndex = Number(index);
  const source = getCriticalResultWithEffects(family, location, criticalIndex);
  if (!source || source.result.critKey !== seed.criticalKey) {
    throw new Error(`Representative Critical source '${seed.criticalKey}' is missing.`);
  }
  const immediateTiming =
    seed.stun?.onset !== "next_round" &&
    (seed.stun?.modifier != null ||
      seed.conditions.some((candidate) => candidate.mechanicallyActive));

  return Object.freeze({
    ...seed,
    criticalBand: source.result.critBand,
    criticalIndex,
    family,
    familyDisplay: FAMILY_DISPLAY[family] ?? family,
    fixtureVersion: REPRESENTATIVE_CRITICAL_FIXTURE_VERSION,
    initiativeExample:
      seed.stun || seed.conditions.length > 0
        ? ({
            equalAffected: false,
            equalInitiative: 7,
            laterAffected: Boolean(immediateTiming),
            laterInitiative: 4,
            sourceInitiative: 7,
          } as const)
        : undefined,
    location,
    lookupSupport: ["blunt", "pointed_weapons", "sharp"].includes(family)
      ? "addressable_pilot_family"
      : "specialized_not_addressable",
    provenance: {
      acceptedRuling:
        "https://github.com/vidarhald-cpu/glantri-app/issues/371#issuecomment-5452750034",
      effectRange: seed.effectRange,
      resultRange: seed.resultRange,
      workbook: "docs/source/combat/Glantri_CriticalEffects_AppFacing_v13.xlsx",
      workbookSha256: REPRESENTATIVE_CRITICAL_WORKBOOK_SHA256,
    } as const,
    runtimeSupport: "representative_fixture_only",
  });
}

const seeds: readonly FixtureSeed[] = [
  {
    authority: "canonical_approved",
    bleed: [],
    canonicalName: "Hand grazed; grip broken.",
    conditions: [condition("impaired", "hand", immediate("instant grip disruption"))],
    criticalKey: "sharp|arm|01",
    damageFloor: 0,
    description: "The arm is grazed and the struck hand opens, dropping whatever it held.",
    effectRange: "AppFacing_Effects!A2:AE3",
    information: [],
    operations: ["drop_held_item"],
    resultRange: "AppFacing_Crits!A2:X2",
    treatment: care("No authored treatment gate.", undefined),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("sharp|arm|12|03", "external", 3, 4, "1D4 HP / round")],
    canonicalName: "Hand severed at the wrist.",
    conditions: [
      condition("collapse", "whole_body", immediate("collapse; end is GM-managed")),
      condition("function_unusable", "hand", immediate("hand absent/unusable")),
    ],
    criticalKey: "sharp|arm|12",
    damageFloor: 5,
    description:
      "The hand is severed and the victim collapses in shock as blood pumps from the stump. Immediate compression or a tourniquet may control the Bleed; consciousness is not lost automatically.",
    effectRange: "AppFacing_Effects!A36:AE42",
    information: [
      info(
        "permanence",
        "Hand loss and any lasting manual deficit remain information for GM adjudication.",
      ),
      info("recovery", "Recovery and later operative consequences are not active mechanics."),
    ],
    operations: ["drop_held_item"],
    resultRange: "AppFacing_Crits!A13:X13",
    stun: stun("sharp|arm|12|02", 4, -8, immediate("collapse; fading if uncontrolled")),
    treatment: care(
      "First Aid compression or a tourniquet may control this source; later definitive consequences remain separate.",
      "immediate compression / tourniquet",
      [FIRST_AID],
      ["compression", "tourniquet"],
    ),
  },
  {
    authority: "canonical_approved",
    bleed: [],
    canonicalName: "Head cut; reeling.",
    conditions: [condition("parry_only", "general_action", rollRounds("d4", "D4 rounds"))],
    criticalKey: "sharp|head|03",
    damageFloor: 1,
    description:
      "The head cut leaves the victim able to defend only by parrying for a rolled duration.",
    effectRange: "AppFacing_Effects!A68:AE69",
    information: [],
    operations: [],
    resultRange: "AppFacing_Crits!A20:X20",
    stun: stun("sharp|head|03|02", 3, -4, rollRounds("d4", "D4 rounds")),
    treatment: care("No authored treatment gate.", undefined),
  },
  {
    authority: "canonical_approved",
    bleed: [],
    canonicalName: "Dazed by a head strike.",
    conditions: [condition("no_action", "general_action", nextRound(), "next_round")],
    criticalKey: "sharp|head|04",
    damageFloor: 2,
    description:
      "The head strike leaves the victim unable to act next round, but does not knock them unconscious.",
    effectRange: "AppFacing_Effects!A70:AE71",
    information: [],
    operations: [],
    resultRange: "AppFacing_Crits!A21:X21",
    stun: stun("sharp|head|04|02", 5, null, nextRound(), "next_round"),
    treatment: care("No authored treatment gate.", undefined),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [],
    canonicalName: "Severe concussion causes unconsciousness",
    conditions: [
      condition(
        "unconscious",
        "consciousness",
        {
          formula: "d4",
          kind: "roll_once",
          text: "1d4 hours or until appropriate care",
          unit: "hour",
        },
        "immediate",
        true,
        "sharp|head|10|02",
      ),
    ],
    criticalKey: "sharp|head|10",
    damageFloor: 3,
    description: "A heavy head wound causes a severe concussion; the target slumps unconscious.",
    effectRange: "AppFacing_Effects!A88:AE89",
    information: [info("recovery", "The alternative generic treatment end remains GM-managed.")],
    operations: [],
    resultRange: "AppFacing_Crits!A27:X27",
    treatment: care(
      "The source says treatment or time may end unconsciousness but does not identify a Skill.",
      "until treated or time passes",
    ),
  },
  {
    authority: "canonical_approved",
    bleed: [],
    canonicalName: "Pectoral slash disables attacks",
    conditions: [
      condition(
        "impaired",
        "stance",
        rollRounds("d4", "D4 rounds while regaining footing"),
        "immediate",
        true,
        "sharp|chest|04|02",
      ),
      condition(
        "parry_only",
        "general_action",
        rollRounds("d4", "D4 rounds"),
        "immediate",
        true,
        "sharp|chest|04|03",
      ),
    ],
    criticalKey: "sharp|chest|04",
    damageFloor: 2,
    description:
      "A slash tears across the weapon-side chest and shoulder; the target drops the weapon and can brace a shield but cannot drive an attack.",
    effectRange: "AppFacing_Effects!A114:AE117",
    information: [],
    operations: ["drop_held_item"],
    resultRange: "AppFacing_Crits!A37:X37",
    treatment: care("Generic treatment remains GM-managed.", "until treated"),
  },
  {
    authority: "canonical_approved",
    bleed: [],
    canonicalName: "Deep rib wound; hurled down.",
    conditions: [
      condition("impaired", "stance", rollRounds("d4", "D4 rounds")),
      condition("parry_only", "general_action", rollRounds("d4", "D4 rounds after rising")),
      condition("prone", "stance", rollRounds("d4", "D4 rounds")),
    ],
    criticalKey: "sharp|chest|05",
    damageFloor: 2,
    description:
      "The blow throws the victim down; they remain prone before recovering to parry-only action.",
    effectRange: "AppFacing_Effects!A118:AE120",
    information: [
      info("guidance", "The source displacement distance remains GM-managed narration."),
    ],
    operations: ["fall_to_ground"],
    resultRange: "AppFacing_Crits!A38:X38",
    stun: stun("sharp|chest|05|03", 4, -8, rollRounds("d4", "D4 rounds after rising")),
    treatment: care("No authored treatment gate.", undefined),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("sharp|chest|09|03", "internal", 1, 2, "1 HP / 2 rounds")],
    canonicalName: "Chest cavity wound.",
    conditions: [condition("unconscious", "consciousness", until("appropriate_care"))],
    criticalKey: "sharp|chest|09",
    damageFloor: 5,
    description:
      "A deep chest wound leaves the victim unconscious while internal bleeding continues.",
    effectRange: "AppFacing_Effects!A127:AE129",
    information: [],
    operations: [],
    resultRange: "AppFacing_Crits!A42:X42",
    stun: stun("sharp|chest|09|02", 5, null, until("appropriate_care")),
    treatment: care("Generic treatment is not enough to identify a Skill check.", "until treated"),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("sharp|lower_leg|12|03", "external", 1, 2, "1 HP / round")],
    canonicalName: "Lower leg devastated.",
    conditions: [
      condition("collapse", "whole_body", immediate("collapse; end is GM-managed")),
      condition("function_unusable", "lower_leg", until("separately_resolved")),
    ],
    criticalKey: "sharp|lower_leg|12",
    damageFloor: 4,
    description:
      "The lower leg is devastated; the victim collapses without automatically becoming unconscious and cannot bear weight.",
    effectRange: "AppFacing_Effects!A287:AE291",
    information: [
      info("permanence", "Possible limb loss is information only."),
      info("recovery", "Recovery is deferred."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A93:X93",
    stun: stun("sharp|lower_leg|12|02", 4, -8, immediate("collapse; no weight-bearing")),
    treatment: care(
      "Control bleeding first, then immobilize the leg.",
      "compression; splint after bleeding control",
      [FIRST_AID],
      ["compression", "splint"],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("blunt|arm|12|03", "external", 1, 2, "1 HP / 2 rounds")],
    canonicalName: "Hand crushed beyond use",
    conditions: [
      condition(
        "function_unusable",
        "hand",
        until("separately_resolved"),
        "immediate",
        true,
        "blunt|arm|12|04",
      ),
    ],
    criticalKey: "blunt|arm|12",
    damageFloor: 5,
    description:
      "The blow shatters the hand into torn bone and tissue; the hand is unusable and the victim drops what it held.",
    effectRange: "AppFacing_Effects!A340:AE345",
    information: [
      info("permanence", "The ruined hand and recovery remain GM-managed information."),
    ],
    operations: ["drop_held_item"],
    resultRange: "AppFacing_Crits!A109:X109",
    stun: stun("blunt|arm|12|02", 4, -4, {
      kind: "fixed_rounds",
      rounds: 1,
      text: "1 full round",
      unit: "round",
    }),
    treatment: care(
      "First Aid pressure and splinting are field stages; Surgery is the authored definitive stage.",
      "pressure dressing / splint; surgery",
      [FIRST_AID, SURGERY],
      ["pressure dressing", "splint"],
    ),
  },
  {
    authority: "canonical_approved",
    bleed: [],
    canonicalName: "Dazed by a blunt head strike.",
    conditions: [condition("no_action", "general_action", nextRound(), "next_round")],
    criticalKey: "blunt|head|04",
    damageFloor: 2,
    description:
      "The head strike prevents action next round but does not itself cause unconsciousness.",
    effectRange: "AppFacing_Effects!A367:AE368",
    information: [],
    operations: [],
    resultRange: "AppFacing_Crits!A117:X117",
    stun: stun("blunt|head|04|02", 5, null, nextRound(), "next_round"),
    treatment: care("No authored treatment gate.", undefined),
  },
  {
    authority: "canonical_approved",
    bleed: [],
    canonicalName: "Blunt-force concussion.",
    conditions: [
      condition("unconscious", "consciousness", {
        formula: "d4",
        kind: "roll_once",
        text: "D4 hours",
        unit: "hour",
      }),
    ],
    criticalKey: "blunt|head|10",
    damageFloor: 3,
    description:
      "The victim is knocked unconscious by a severe concussion for one retained D4-hour duration.",
    effectRange: "AppFacing_Effects!A384:AE385",
    information: [],
    operations: [],
    resultRange: "AppFacing_Crits!A123:X123",
    stun: stun("blunt|head|10|02", 5, null, {
      formula: "d4",
      kind: "roll_once",
      text: "D4 hours",
      unit: "hour",
    }),
    treatment: care("No authored treatment gate.", undefined),
  },
  {
    authority: "canonical_approved",
    bleed: [],
    canonicalName: "Chest impact; shield parries only.",
    conditions: [
      condition("impaired", "stance", rollRounds("d4", "D4 rounds")),
      condition("parry_only", "general_action", rollRounds("d4", "D4 rounds")),
    ],
    criticalKey: "blunt|chest|04",
    damageFloor: 2,
    description:
      "The impact drops the victim off balance and leaves only shield parries possible while recovering.",
    effectRange: "AppFacing_Effects!A411:AE414",
    information: [],
    operations: ["drop_held_item"],
    resultRange: "AppFacing_Crits!A133:X133",
    stun: stun("blunt|chest|04|03", 5, null, rollRounds("d4", "D4 rounds")),
    treatment: care("No authored treatment gate.", undefined),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("blunt|chest|09|03", "internal", 1, 2, "1 HP / 2 rounds")],
    canonicalName: "Crushing chest injury.",
    conditions: [condition("unconscious", "consciousness", until("appropriate_care"))],
    criticalKey: "blunt|chest|09",
    damageFloor: 4,
    description:
      "The crushed chest leaves the victim unconscious with continuing internal bleeding.",
    effectRange: "AppFacing_Effects!A424:AE426",
    information: [],
    operations: [],
    resultRange: "AppFacing_Crits!A138:X138",
    stun: stun("blunt|chest|09|02", 5, null, until("appropriate_care")),
    treatment: care("Generic treatment remains GM-managed.", "until treated"),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("blunt|upper_leg|12|03", "internal", 2, 3, "1D4 HP / round")],
    canonicalName: "Shattered femur with hidden blood loss.",
    conditions: [
      condition("collapse", "whole_body", immediate("collapse; rapidly weakening")),
      condition("function_unusable", "leg", until("separately_resolved")),
    ],
    criticalKey: "blunt|upper_leg|12",
    damageFloor: 5,
    description:
      "The femur shatters and the victim collapses as dangerous internal bleeding develops; unconsciousness is not automatic.",
    effectRange: "AppFacing_Effects!A528:AE532",
    information: [
      info("guidance", "Hidden blood loss remains transparent in this pilot fixture."),
      info("recovery", "Fracture recovery is deferred."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A173:X173",
    stun: stun("blunt|upper_leg|12|02", 4, -8, immediate("collapse; rapidly weakening")),
    treatment: care(
      "First Aid immobilization is a field stage; emergency Surgery is definitive care.",
      "immobilize; emergency surgery",
      [FIRST_AID, SURGERY],
      ["immobilization"],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("blunt|lower_leg|12|03", "internal", 1, 2, "1 HP / 2 rounds")],
    canonicalName: "Ankle and lower tibia crushed.",
    conditions: [
      condition("collapse", "whole_body", immediate("collapse; crawl only")),
      condition("function_unusable", "ankle", until("separately_resolved")),
    ],
    criticalKey: "blunt|lower_leg|12",
    damageFloor: 4,
    description:
      "The ankle and lower tibia are crushed; the victim collapses, remains conscious unless another result says otherwise, and can only crawl.",
    effectRange: "AppFacing_Effects!A578:AE582",
    information: [
      info(
        "permanence",
        "Catastrophic mobility loss is information, not an active permanent-stat mechanic.",
      ),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A189:X189",
    stun: stun("blunt|lower_leg|12|02", 3, -4, immediate("collapse; crawl only until treated")),
    treatment: care(
      "First Aid splinting/pressure is immediate care and Surgery is the named definitive stage.",
      "splint; pressure if bleeding; surgery",
      [FIRST_AID, SURGERY],
      ["splint", "pressure"],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("arrows_bolts|chest|11|03", "internal", 2, 3, "1D4 HP / round")],
    canonicalName: "Missile lodged in the chest.",
    conditions: [
      condition("collapse", "whole_body", immediate("collapse; end is GM-managed")),
      condition("no_action", "general_action", immediate("cannot act")),
    ],
    criticalKey: "arrows_bolts|chest|11",
    damageFloor: 5,
    description:
      "A lodged missile causes severe chest injury, collapse, and continuing internal bleeding; casual extraction may worsen it.",
    effectRange: "AppFacing_Effects!A1037:AE1042",
    information: [
      info("guidance", "The missile remains embedded and extraction risk is explicit."),
      info("unresolved", "Legacy consciousness checks are not active mechanics."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A332:X332",
    stun: stun(
      "arrows_bolts|chest|11|02",
      5,
      null,
      immediate("cannot act; consciousness GM-managed"),
    ),
    treatment: care(
      "Emergency extraction and generic treatment remain GM-managed because no Skill is named safely.",
      "emergency extraction and treatment",
      [],
      ["controlled removal"],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("firearms|lower_leg|12|03", "external", 1, 2, "1 HP / round")],
    canonicalName: "Ankle blown apart.",
    conditions: [
      condition("collapse", "whole_body", immediate("collapse; crawl only")),
      condition("function_unusable", "ankle", until("separately_resolved")),
    ],
    criticalKey: "firearms|lower_leg|12",
    damageFloor: 4,
    description:
      "The ankle is blown apart; the victim collapses and can only crawl while severe external bleeding continues.",
    effectRange: "AppFacing_Effects!A1598:AE1602",
    information: [
      info("permanence", "Lasting disability is information only."),
      info("recovery", "Reconstruction and recovery are deferred."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A477:X477",
    stun: stun("firearms|lower_leg|12|02", 4, -8, immediate("collapse; crawl only")),
    treatment: care(
      "First Aid pressure/immobilization is followed by the named Surgery stage.",
      "pressure; immobilize; surgery",
      [FIRST_AID, SURGERY],
      ["pressure", "immobilization"],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [
      rolledBleed("falling_crushing|whole_body|10|04", "external", "d4", 12, "1D4 HP / round"),
      rolledBleed("falling_crushing|whole_body|10|05", "internal", "d4", 12, "1D4 HP / round"),
    ],
    canonicalName: "Whole body horribly mangled.",
    conditions: [
      condition("impaired", "general_action", immediate("crawl only; end GM-managed")),
      condition("recovery_restricted", "stance", immediate("cannot stand normally")),
    ],
    criticalKey: "falling_crushing|whole_body|10",
    damageFloor: 4,
    description:
      "Crushing trauma mangles the whole body; the victim can only crawl while paired external and internal Bleed sources use retained roll-once rates.",
    effectRange: "AppFacing_Effects!A1643:AE1649",
    information: [
      info("permanence", "Legacy permanent characteristic loss is not active."),
      info("unresolved", "Legacy consciousness tests are not active."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A491:X491",
    stun: stun(
      "falling_crushing|whole_body|10|03",
      4,
      -8,
      immediate("crawl only; consciousness GM-managed"),
    ),
    treatment: care(
      "Generic emergency stabilisation remains GM-managed.",
      "emergency stabilisation; emergency stabilisation",
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [
      rolledBleed("falling_crushing|whole_body|12|03", "external", "d6", 12, "1D6 HP / round"),
      rolledBleed("falling_crushing|whole_body|12|04", "internal", "d6", 12, "1D6 HP / round"),
    ],
    canonicalName: "Multiple major fractures and internal injuries.",
    conditions: [
      condition("collapse", "whole_body", immediate("collapse; fading if untreated")),
      condition("no_action", "general_action", immediate("no meaningful physical action")),
    ],
    criticalKey: "falling_crushing|whole_body|12",
    damageFloor: 4,
    description:
      "Catastrophic whole-body trauma causes collapse and paired external/internal Bleed; rescue and definitive care remain urgent.",
    effectRange: "AppFacing_Effects!A1657:AE1662",
    information: [
      info(
        "mortality",
        "Mortally wounded and possible death remain information only; no death clock is active.",
      ),
      info("recovery", "Fracture recovery is deferred."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A493:X493",
    stun: stun(
      "falling_crushing|whole_body|12|02",
      4,
      -8,
      immediate("collapse; fading if untreated"),
    ),
    treatment: care(
      "First Aid immobilization is immediate support; emergency Surgery is definitive care.",
      "immobilize; emergency surgery",
      [FIRST_AID, SURGERY],
      ["immobilization"],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [],
    canonicalName: "Clothing ablaze.",
    conditions: [
      condition("restricted", "general_action", until("flames_extinguished")),
      condition("prone", "stance", until("extinguishing_flames")),
    ],
    criticalKey: "fire_energy|whole_body|06",
    damageFloor: 4,
    description:
      "The victim is prone and can only roll to smother the flames or reach nearby water until the fire is extinguished.",
    effectRange: "AppFacing_Effects!A1692:AE1696",
    information: [
      info("guidance", "Burn damage is not ordinary Bleed."),
      info("unresolved", "Conditional deafness remains GM-managed information."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A503:X503",
    stun: stun("fire_energy|whole_body|06|03", 5, null, until("flames_extinguished")),
    treatment: care(
      "Extinguishing the flames is an explicit field event, not a manufactured Skill check.",
      "extinguish flames immediately",
      [],
      ["extinguish flames"],
      false,
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [],
    canonicalName: "Horrible burns and shock.",
    conditions: [condition("no_action", "general_action", immediate("no actions; end GM-managed"))],
    criticalKey: "fire_energy|whole_body|09",
    damageFloor: 4,
    description:
      "Horrible burns leave the victim unable to act; loss of consciousness is conditional and remains GM-adjudicated.",
    effectRange: "AppFacing_Effects!A1704:AE1709",
    information: [
      info("unresolved", "The legacy toughness consciousness check is not active."),
      info("permanence", "Scarring, hearing loss, and characteristic loss are information only."),
      info("recovery", "Burn healing time is deferred."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A506:X506",
    stun: stun(
      "fire_energy|whole_body|09|02",
      5,
      null,
      immediate("no actions; consciousness GM-managed"),
    ),
    treatment: care(
      "Burn care is an explicit Medicine candidate; field control and recovery remain separate.",
      "burn care",
      [MEDICINE],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [],
    canonicalName: "Serious burns and internal injury.",
    conditions: [
      condition(
        "impaired",
        "general_action",
        immediate("action state unresolved"),
        "immediate",
        false,
      ),
    ],
    criticalKey: "fire_energy|whole_body|10",
    damageFloor: 4,
    description:
      "Serious burns and shock require urgent adjudication; the source does not safely establish unconsciousness or a global action state.",
    effectRange: "AppFacing_Effects!A1710:AE1713",
    information: [
      info("unresolved", "Action and consciousness remain GM-managed."),
      info("guidance", "Burn/shock loss is not ordinary Bleed."),
      info("permanence", "Scarring and legacy insanity mechanics are not active."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A507:X507",
    stun: stun(
      "fire_energy|whole_body|10|02",
      5,
      null,
      immediate("severe shock; action state unresolved"),
    ),
    treatment: care(
      "Generic emergency treatment does not identify First Aid, Medicine, or Surgery.",
      "emergency treatment",
    ),
  },
  {
    authority: "canonical_approved",
    bleed: [fixedBleed("pointed_weapons|arm|02|03", "external", 1, 8, "1 HP / 8 rounds")],
    canonicalName: "Hand puncture breaks the grip",
    conditions: [
      condition(
        "impaired",
        "hand",
        rollRounds("d4", "D4 rounds"),
        "immediate",
        true,
        "pointed_weapons|arm|02|04",
      ),
    ],
    criticalKey: "pointed_weapons|arm|02",
    damageFloor: 3,
    description:
      "The point passes through the fleshy hand; the fingers open and whatever was held drops.",
    effectRange: "AppFacing_Effects!A1738:AE1742",
    information: [],
    operations: ["drop_held_item"],
    resultRange: "AppFacing_Crits!A515:X515",
    stun: stun("pointed_weapons|arm|02|02", 1, -1, rollRounds("d4", "D4 rounds")),
    treatment: care(
      "First Aid bandaging is the explicit field-control candidate.",
      "bandage",
      [FIRST_AID],
      ["bandage"],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("pointed_weapons|arm|09|03", "external", 1, 3, "1 HP / 3 rounds")],
    canonicalName: "Joint puncture; arm locked.",
    conditions: [condition("function_unusable", "arm", until("appropriate_care"))],
    criticalKey: "pointed_weapons|arm|09",
    damageFloor: 3,
    description:
      "The punctured joint folds or locks painfully; the arm cannot be used, but the result does not impose global collapse.",
    effectRange: "AppFacing_Effects!A1771:AE1774",
    information: [],
    operations: [],
    resultRange: "AppFacing_Crits!A522:X522",
    stun: stun("pointed_weapons|arm|09|02", 2, -2, until("appropriate_care")),
    treatment: care(
      "The generic treatment string remains GM-managed and creates no Skill check.",
      "until treated",
    ),
  },
  {
    authority: "canonical_approved",
    bleed: [fixedBleed("pointed_weapons|arm|10|03", "external", 3, 4, "1 HP / round")],
    canonicalName: "Deep upper-arm puncture.",
    conditions: [
      condition("impaired", "general_action", until("mapped_staunch_event")),
      condition("function_unusable", "arm", until("mapped_staunch_event")),
    ],
    criticalKey: "pointed_weapons|arm|10",
    damageFloor: 5,
    description:
      "The point penetrates the upper arm and may have opened a major vessel. The arm is unusable and blood pulses from the wound until controlled.",
    effectRange: "AppFacing_Effects!A1775:AE1778",
    information: [
      info(
        "guidance",
        "Possible major-vessel injury does not manufacture internal Bleed or mortality.",
      ),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A523:X523",
    stun: stun("pointed_weapons|arm|10|02", 3, -4, until("mapped_staunch_event")),
    treatment: care("First Aid field control is the candidate staunch event.", "staunch quickly", [
      FIRST_AID,
    ]),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("pointed_weapons|arm|11|03", "external", 1, 3, "1 HP / 3 rounds")],
    canonicalName: "Hand transfixed.",
    conditions: [condition("function_unusable", "hand", until("controlled_removal_and_care"))],
    criticalKey: "pointed_weapons|arm|11",
    damageFloor: 3,
    description:
      "The hand is transfixed and unusable until the point is drawn free under controlled care; the held item is dropped.",
    effectRange: "AppFacing_Effects!A1779:AE1784",
    information: [
      info(
        "guidance",
        "Weapon removal is a separate operation/care gate, not automatically First Aid.",
      ),
    ],
    operations: ["drop_held_item"],
    resultRange: "AppFacing_Crits!A524:X524",
    stun: stun("pointed_weapons|arm|11|02", 3, -4, until("controlled_removal_and_care")),
    treatment: care(
      "Weapon removal plus generic treatment remains GM-managed.",
      "weapon removal + treatment",
      [],
      ["controlled removal"],
    ),
  },
  {
    authority: "canonical_approved",
    bleed: [fixedBleed("pointed_weapons|head|08|04", "external", 1, 2, "1D4 HP / round")],
    canonicalName: "Neck puncture with severe blood loss.",
    conditions: [
      condition("impaired", "general_action", until("staunched")),
      condition("impaired", "stance", until("staunched")),
    ],
    criticalKey: "pointed_weapons|head|08",
    damageFloor: 4,
    description:
      "Blood pulses from the neck wound and the victim can barely stay upright until the source is controlled.",
    effectRange: "AppFacing_Effects!A1840:AE1843",
    information: [],
    operations: [],
    resultRange: "AppFacing_Crits!A537:X537",
    stun: stun("pointed_weapons|head|08|03", 4, -8, until("staunched")),
    treatment: care(
      "First Aid immediate field control is explicitly justified.",
      "staunch immediately",
      [FIRST_AID],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("pointed_weapons|head|10|03", "internal", 2, 3, "1 HP / round")],
    canonicalName: "Temple or facial penetration.",
    conditions: [
      condition("unconscious", "consciousness", until("appropriate_care")),
      condition("no_action", "general_action", until("appropriate_care")),
    ],
    criticalKey: "pointed_weapons|head|10",
    damageFloor: 4,
    description:
      "The point enters the face or temple and the victim collapses unconscious while internal bleeding continues.",
    effectRange: "AppFacing_Effects!A1850:AE1853",
    information: [],
    operations: [],
    resultRange: "AppFacing_Crits!A539:X539",
    stun: stun("pointed_weapons|head|10|02", 5, null, until("appropriate_care")),
    treatment: care(
      "The source says immediate care but does not safely identify a Skill.",
      "immediate",
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("pointed_weapons|chest|07|03", "internal", 1, 4, "1 HP / 4 rounds")],
    canonicalName: "Punctured lung shortens every breath",
    conditions: [
      condition(
        "impaired",
        "breathing_and_general_action",
        until("appropriate_care"),
        "immediate",
        true,
        "pointed_weapons|chest|07|04",
      ),
    ],
    criticalKey: "pointed_weapons|chest|07",
    damageFloor: 5,
    description:
      "The point slips between the ribs and punctures a lung; breathing becomes short and blood-tinged.",
    effectRange: "AppFacing_Effects!A1901:AE1904",
    information: [
      info(
        "guidance",
        "Breathing impairment is structured but remains GM-managed beyond the accepted Stun.",
      ),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A552:X552",
    stun: stun("pointed_weapons|chest|07|02", 3, -4, until("appropriate_care")),
    treatment: care(
      "Generic immediate treatment does not identify a Skill.",
      "immediate treatment",
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("pointed_weapons|chest|12|03", "internal", 2, 3, "1D4 HP / round")],
    canonicalName: "Collapsed lung and failing breath.",
    conditions: [
      condition("collapse", "whole_body", immediate("collapse; end GM-managed")),
      condition("no_action", "general_action", immediate("no action while gasping")),
    ],
    criticalKey: "pointed_weapons|chest|12",
    damageFloor: 5,
    description:
      "The victim drops gasping, still potentially conscious, while movement or removing an embedded point may worsen the wound. Field care can stabilize posture and breathing; definitive internal treatment remains urgent.",
    effectRange: "AppFacing_Effects!A1926:AE1931",
    information: [
      info("mortality", "Rapidly dying remains information only; no death clock is active."),
      info("guidance", "Leave an embedded point in place when present; removal risk is explicit."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A557:X557",
    stun: stun(
      "pointed_weapons|chest|12|02",
      4,
      -8,
      immediate("collapse; dying prose is not a clock"),
    ),
    treatment: care(
      "First Aid stabilization is the field ceiling; definitive internal care remains GM-managed.",
      "leave embedded point if present; seal/compress; urgent care",
      [FIRST_AID],
      ["leave embedded point", "seal/compress"],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("pointed_weapons|abdomen|08|03", "internal", 1, 2, "1 HP / round")],
    canonicalName: "Weapon lodged in the abdomen.",
    conditions: [condition("impaired", "general_action", until("controlled_removal_and_care"))],
    criticalKey: "pointed_weapons|abdomen|08",
    damageFloor: 4,
    description:
      "The point lodges in the abdomen; wrenching it free may widen the wound while internal bleeding continues.",
    effectRange: "AppFacing_Effects!A1976:AE1979",
    information: [
      info("guidance", "The embedded weapon and removal risk remain separate authored facts."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A569:X569",
    stun: stun("pointed_weapons|abdomen|08|02", 3, -4, until("controlled_removal_and_care")),
    treatment: care(
      "Controlled removal is required; no Skill identity is manufactured.",
      "leave in place until controlled removal",
      [],
      ["controlled removal"],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("pointed_weapons|upper_leg|12|04", "external", 3, 4, "1D4 HP / round")],
    canonicalName: "Major thigh vessel struck.",
    conditions: [
      condition("collapse", "whole_body", immediate("collapse; fading if uncontrolled")),
      condition("function_unusable", "leg", immediate("leg unusable for mobility")),
      condition("recovery_restricted", "stance", immediate("cannot recover stance normally")),
    ],
    criticalKey: "pointed_weapons|upper_leg|12",
    damageFloor: 6,
    description:
      "A major thigh vessel is opened; the victim collapses but may remain conscious while urgent compression can still control the loss.",
    effectRange: "AppFacing_Effects!A2076:AE2081",
    information: [
      info(
        "mortality",
        "Rapidly dying remains information only and creates no active mortality mechanic.",
      ),
      info("recovery", "Long-term limb recovery is deferred."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A589:X589",
    stun: stun(
      "pointed_weapons|upper_leg|12|03",
      4,
      -8,
      immediate("collapse; fading if uncontrolled"),
    ),
    treatment: care(
      "First Aid compression or tourniquet is the explicit field-control candidate.",
      "immediate compression / tourniquet",
      [FIRST_AID],
      ["compression", "tourniquet"],
    ),
  },
  {
    authority: "canonical_with_gm_adjudication",
    bleed: [fixedBleed("pointed_weapons|lower_leg|16|04", "external", 2, 3, "1 HP / round")],
    canonicalName: "Near-severing lower-leg puncture.",
    conditions: [
      condition("no_action", "general_action", until("staunched")),
      condition("function_unusable", "leg", until("separately_resolved")),
      condition("recovery_restricted", "stance", until("staunched")),
    ],
    criticalKey: "pointed_weapons|lower_leg|16",
    damageFloor: 4,
    description:
      "The lower leg is nearly severed and cannot support movement; immediate bleeding control is essential.",
    effectRange: "AppFacing_Effects!A2176:AE2180",
    information: [
      info("permanence", "Catastrophic maiming and reconstruction remain information only."),
      info("mortality", "Survival wording creates no active death mechanic."),
    ],
    operations: [],
    resultRange: "AppFacing_Crits!A609:X609",
    stun: stun("pointed_weapons|lower_leg|16|03", 5, null, until("staunched")),
    treatment: care(
      "First Aid immediate field control is explicitly justified.",
      "staunch immediately",
      [FIRST_AID],
    ),
  },
] as const;

export const REPRESENTATIVE_CRITICAL_FIXTURES: readonly RepresentativeCriticalFixture[] =
  Object.freeze(seeds.map(createFixture));

export function getRepresentativeCriticalFixture(
  criticalKey: string,
): RepresentativeCriticalFixture | undefined {
  return REPRESENTATIVE_CRITICAL_FIXTURES.find((fixture) => fixture.criticalKey === criticalKey);
}

export function verifyRepresentativeCriticalFixtureSources(): readonly string[] {
  const failures: string[] = [];
  for (const fixture of REPRESENTATIVE_CRITICAL_FIXTURES) {
    const source = getCriticalResultWithEffects(
      fixture.family,
      fixture.location,
      fixture.criticalIndex,
    );
    if (!source || source.result.critKey !== fixture.criticalKey) {
      failures.push(`${fixture.criticalKey}: source result missing`);
      continue;
    }
    if (source.result.minTotalDamage !== fixture.damageFloor) {
      failures.push(
        `${fixture.criticalKey}: source damage floor ${source.result.minTotalDamage} does not match ${fixture.damageFloor}`,
      );
    }
    if (source.result.critBand !== fixture.criticalBand) {
      failures.push(
        `${fixture.criticalKey}: source band '${source.result.critBand}' does not match '${fixture.criticalBand}'`,
      );
    }
    const sourceEffectKeys = new Set(source.effects.map((effect) => effect.effectKey));
    const expectedEffectKeys = [
      fixture.stun?.sourceEffectKey,
      ...fixture.bleed.map((bleed) => bleed.sourceEffectKey),
    ].filter((key): key is string => key !== undefined);
    for (const effectKey of expectedEffectKeys) {
      if (!sourceEffectKeys.has(effectKey)) {
        failures.push(`${fixture.criticalKey}: source effect ${effectKey} missing`);
      }
    }
    for (const bleed of fixture.bleed) {
      const sourceBleed = source.effects.find(
        (effect) => effect.effectKey === bleed.sourceEffectKey,
      );
      const acceptedPost393RateOverride =
        fixture.criticalKey === "pointed_weapons|chest|07" &&
        bleed.sourceEffectKey === "pointed_weapons|chest|07|03" &&
        bleed.sourceRate === "1 HP / 4 rounds";
      if (sourceBleed?.rateRaw !== bleed.sourceRate && !acceptedPost393RateOverride) {
        failures.push(
          `${fixture.criticalKey}: source rate '${sourceBleed?.rateRaw}' does not match '${bleed.sourceRate}'`,
        );
      }
    }
    if (fixture.stun) {
      const sourceStun = source.effects.find(
        (effect) => effect.effectKey === fixture.stun?.sourceEffectKey,
      );
      if (sourceStun?.sourceField !== "shock_penalty") {
        failures.push(`${fixture.criticalKey}: Stun source is not the authored shock row`);
      }
    }
  }
  return failures;
}

export function isCriticalConsequenceActiveForPendingInitiative(input: {
  onset: "immediate" | "next_round";
  pendingInitiative: number;
  sourceInitiative: number;
}): boolean {
  return input.onset === "immediate" && input.pendingInitiative < input.sourceInitiative;
}

export function addExactRationals(left: ExactRational, right: ExactRational): ExactRational {
  return addCombatCriticalExactRationals(left, right);
}

export function resolveRepresentativeBleedRate(
  bleed: RepresentativeCriticalBleed,
  storedRoll?: number,
): ExactRational {
  if (bleed.rate.kind === "fixed") return bleed.rate.value;
  if (!Number.isInteger(storedRoll) || storedRoll === undefined || storedRoll < 1) {
    throw new Error(`Bleed source '${bleed.sourceEffectKey}' requires one stored positive roll.`);
  }
  const maximum = bleed.rate.formula === "d4" ? 4 : 6;
  if (storedRoll > maximum) {
    throw new Error(`Bleed source '${bleed.sourceEffectKey}' roll exceeds ${bleed.rate.formula}.`);
  }
  return { denominator: bleed.rate.divisor, numerator: storedRoll };
}

export function accrueRepresentativeBleed(input: {
  readonly activeSources: readonly {
    readonly bleed: RepresentativeCriticalBleed;
    readonly storedRoll?: number;
  }[];
  readonly previousRemainder?: ExactRational;
}): {
  readonly appliedHp: number;
  readonly remainder: ExactRational;
  readonly total: ExactRational;
} {
  return accrueCombatCriticalBleed({
    activeRates: input.activeSources.map((source) =>
      resolveRepresentativeBleedRate(source.bleed, source.storedRoll),
    ),
    previousRemainder: input.previousRemainder,
  });
}

function rollRepresentativeDuration(
  duration: RepresentativeCriticalDuration,
  rng: () => number,
): CombatCriticalDuration {
  if (duration.kind !== "roll_once" || !duration.formula) return { ...duration };
  const maximum = duration.formula === "d3" ? 3 : 4;
  const storedRoll = Math.floor(rng() * maximum) + 1;
  return { ...duration, rounds: duration.unit === "round" ? storedRoll : undefined, storedRoll };
}

export const C1_FIVE_KEY_CRITICAL_RUNTIME_VERSION = "c1-five-key-post-393-2026-09-06";

const C1_FIVE_KEY_ADJUDICATION = {
  "blunt|arm|12": {
    operationKeys: { drop_held_item: "blunt|arm|12|05" },
    suppressible: ["blunt|arm|12|02", "blunt|arm|12|03", "blunt|arm|12|04", "blunt|arm|12|05"],
  },
  "pointed_weapons|arm|02": {
    operationKeys: { drop_held_item: "pointed_weapons|arm|02|05" },
    suppressible: [
      "pointed_weapons|arm|02|02",
      "pointed_weapons|arm|02|03",
      "pointed_weapons|arm|02|04",
      "pointed_weapons|arm|02|05",
    ],
  },
  "pointed_weapons|chest|07": {
    operationKeys: {},
    suppressible: [
      "pointed_weapons|chest|07|02",
      "pointed_weapons|chest|07|03",
      "pointed_weapons|chest|07|04",
    ],
  },
  "sharp|chest|04": {
    operationKeys: { drop_held_item: "sharp|chest|04|04" },
    suppressible: ["sharp|chest|04|02", "sharp|chest|04|03", "sharp|chest|04|04"],
  },
  "sharp|head|10": {
    operationKeys: {},
    suppressible: ["sharp|head|10|02"],
  },
} as const satisfies Record<
  string,
  {
    operationKeys: Partial<Record<RepresentativeCriticalOperation, string>>;
    suppressible: readonly string[];
  }
>;

export function isC1FiveKeyCriticalRuntimeKey(criticalKey: string): boolean {
  return Object.hasOwn(C1_FIVE_KEY_ADJUDICATION, criticalKey);
}

const atom = (
  kind: CombatCriticalCanonicalReview["atoms"][number]["kind"],
  sourceEffectKey: string | undefined,
  summary: string,
  target: string,
  timing: string,
  suppressible = kind !== "damage_floor" && kind !== "information",
) => ({ kind, sourceEffectKey, summary, suppressible, target, timing });

const C1_FIVE_KEY_CANONICAL_REVIEWS: Record<string, CombatCriticalCanonicalReview> = {
  "pointed_weapons|arm|02": combatCriticalCanonicalReviewSchema.parse({
    atoms: [
      atom(
        "damage_floor",
        "pointed_weapons|arm|02|01",
        "Minimum total damage 3 HP",
        "combatant",
        "commit",
      ),
      atom(
        "modifier",
        "pointed_weapons|arm|02|02",
        "Stun -1 to OB/Skill, DB/Parry, and Initiative for retained 1d4 rounds",
        "combatant",
        "immediate",
      ),
      atom(
        "periodic_loss",
        "pointed_weapons|arm|02|03",
        "External Bleed 1/8 HP per round",
        "arm",
        "following round SU after one full 3-second interval",
      ),
      atom(
        "condition",
        "pointed_weapons|arm|02|04",
        "Hand impaired for retained 1d4 rounds",
        "hand",
        "immediate",
      ),
      atom(
        "operation",
        "pointed_weapons|arm|02|05",
        "Drop held item",
        "struck-hand item",
        "immediate",
      ),
      atom(
        "information",
        undefined,
        "First Aid bandaging is the field-control candidate; source gate: bandage",
        "GM guidance",
        "read-only",
      ),
    ],
    criticalKey: "pointed_weapons|arm|02",
    fixtureVersion: C1_FIVE_KEY_CRITICAL_RUNTIME_VERSION,
    narrative:
      "The point passes through the fleshy hand; the fingers open and whatever was held drops.",
    provenance: {
      acceptedCommentId: 5464671257,
      acceptedPart: "Part 3/4",
      effectRange: "AppFacing_Effects!A1738:AE1742",
      resultRange: "AppFacing_Crits!A515:X515",
    },
    title: "Hand puncture breaks the grip",
  }),
  "blunt|arm|12": combatCriticalCanonicalReviewSchema.parse({
    atoms: [
      atom("damage_floor", "blunt|arm|12|01", "Minimum total damage 5 HP", "combatant", "commit"),
      atom(
        "modifier",
        "blunt|arm|12|02",
        "Stun -4 to OB/Skill, DB/Parry, and Initiative for 1 full round",
        "combatant",
        "immediate",
      ),
      atom(
        "periodic_loss",
        "blunt|arm|12|03",
        "External Bleed 1/2 HP per round",
        "arm",
        "following round SU after one full 3-second interval",
      ),
      atom(
        "condition",
        "blunt|arm|12|04",
        "Hand function unusable until separately resolved",
        "hand",
        "immediate",
      ),
      atom("operation", "blunt|arm|12|05", "Drop held item", "struck-hand item", "immediate"),
      atom(
        "information",
        undefined,
        "First Aid pressure and splinting are field stages; Surgery is definitive",
        "GM guidance",
        "read-only",
      ),
      atom(
        "information",
        "blunt|arm|12|06",
        "Permanent deficit and recovery remain GM-managed",
        "GM guidance",
        "read-only",
      ),
    ],
    criticalKey: "blunt|arm|12",
    fixtureVersion: C1_FIVE_KEY_CRITICAL_RUNTIME_VERSION,
    narrative:
      "The blow shatters the hand into torn bone and tissue; the hand is unusable and the victim drops what it held.",
    provenance: {
      acceptedCommentId: 5464670911,
      acceptedPart: "Part 2/4",
      effectRange: "AppFacing_Effects!A340:AE345",
      resultRange: "AppFacing_Crits!A109:X109",
    },
    title: "Hand crushed beyond use",
  }),
  "pointed_weapons|chest|07": combatCriticalCanonicalReviewSchema.parse({
    atoms: [
      atom(
        "damage_floor",
        "pointed_weapons|chest|07|01",
        "Minimum total damage 5 HP",
        "combatant",
        "commit",
      ),
      atom(
        "modifier",
        "pointed_weapons|chest|07|02",
        "Stun -4 to OB/Skill, DB/Parry, and Initiative until appropriate care",
        "combatant",
        "immediate",
      ),
      atom(
        "periodic_loss",
        "pointed_weapons|chest|07|03",
        "Internal Bleed 1/4 HP per round",
        "chest",
        "following round SU after one full 3-second interval",
      ),
      atom(
        "condition",
        "pointed_weapons|chest|07|04",
        "Breathing and general action impaired until appropriate care",
        "breathing and general action",
        "immediate",
      ),
      atom(
        "information",
        undefined,
        "Generic immediate care identifies no Skill",
        "GM guidance",
        "read-only",
      ),
    ],
    criticalKey: "pointed_weapons|chest|07",
    fixtureVersion: C1_FIVE_KEY_CRITICAL_RUNTIME_VERSION,
    narrative:
      "The point slips between the ribs and punctures a lung; breathing becomes short and blood-tinged.",
    provenance: {
      acceptedCommentId: 5464671539,
      acceptedPart: "Part 4/4",
      effectRange: "AppFacing_Effects!A1901:AE1904",
      resultRange: "AppFacing_Crits!A552:X552",
    },
    title: "Punctured lung shortens every breath",
  }),
  "sharp|head|10": combatCriticalCanonicalReviewSchema.parse({
    atoms: [
      atom("damage_floor", "sharp|head|10|01", "Minimum total damage 3 HP", "combatant", "commit"),
      atom(
        "condition",
        "sharp|head|10|02",
        "Unconscious for retained 1d4 hours or until appropriate care",
        "consciousness",
        "immediate",
      ),
      atom(
        "information",
        undefined,
        "Generic-care end and recovery remain GM-managed; no Skill is identified",
        "GM guidance",
        "read-only",
      ),
    ],
    criticalKey: "sharp|head|10",
    fixtureVersion: C1_FIVE_KEY_CRITICAL_RUNTIME_VERSION,
    narrative: "A heavy head wound causes a severe concussion; the target slumps unconscious.",
    provenance: {
      acceptedCommentId: 5464670629,
      acceptedPart: "Part 1/4",
      effectRange: "AppFacing_Effects!A88:AE89",
      resultRange: "AppFacing_Crits!A27:X27",
    },
    title: "Severe concussion causes unconsciousness",
  }),
  "sharp|chest|04": combatCriticalCanonicalReviewSchema.parse({
    atoms: [
      atom("damage_floor", "sharp|chest|04|01", "Minimum total damage 2 HP", "combatant", "commit"),
      atom(
        "condition",
        "sharp|chest|04|02",
        "Stance impaired for retained 1d4 rounds",
        "stance",
        "immediate",
      ),
      atom(
        "condition",
        "sharp|chest|04|03",
        "General action limited to parry for retained 1d4 rounds",
        "general action",
        "immediate",
      ),
      atom(
        "operation",
        "sharp|chest|04|04",
        "Drop held weapon",
        "weapon-side held item",
        "immediate",
      ),
      atom(
        "information",
        undefined,
        "Generic treatment remains GM-managed and identifies no Skill",
        "GM guidance",
        "read-only",
      ),
    ],
    criticalKey: "sharp|chest|04",
    fixtureVersion: C1_FIVE_KEY_CRITICAL_RUNTIME_VERSION,
    narrative:
      "A slash tears across the weapon-side chest and shoulder; the target drops the weapon and can brace a shield but cannot drive an attack.",
    provenance: {
      acceptedCommentId: 5464670629,
      acceptedPart: "Part 1/4",
      effectRange: "AppFacing_Effects!A114:AE117",
      resultRange: "AppFacing_Crits!A37:X37",
    },
    title: "Pectoral slash disables attacks",
  }),
};

export function getC1FiveKeyCanonicalReview(
  criticalKey: string,
): CombatCriticalCanonicalReview | undefined {
  return C1_FIVE_KEY_CANONICAL_REVIEWS[criticalKey];
}

function validateC1FiveKeyAdjudication(
  criticalKey: string,
  adjudication?: CombatCriticalAdjudication,
): Set<string> {
  const contract = C1_FIVE_KEY_ADJUDICATION[
    criticalKey as keyof typeof C1_FIVE_KEY_ADJUDICATION
  ] as
    | {
        operationKeys: Partial<Record<RepresentativeCriticalOperation, string>>;
        suppressible: readonly string[];
      }
    | undefined;
  if (!contract) return new Set();
  if (!adjudication) return new Set();
  if (adjudication.criticalKey !== criticalKey) {
    throw new RangeError("Critical adjudication identity does not match the canonical result.");
  }
  if (
    new Set(adjudication.suppressedEffectKeys).size !== adjudication.suppressedEffectKeys.length
  ) {
    throw new RangeError("Critical adjudication contains a duplicate atom identity.");
  }
  const permitted = new Set<string>(contract.suppressible);
  for (const sourceEffectKey of adjudication.suppressedEffectKeys) {
    if (!permitted.has(sourceEffectKey)) {
      throw new RangeError(
        `Critical atom '${sourceEffectKey}' cannot be suppressed for this result.`,
      );
    }
  }
  return new Set(adjudication.suppressedEffectKeys);
}

/**
 * Resolves an accepted C1 fixture into a server-owned runtime definition. Only the five
 * post-#393 keys accept the bounded adjudication delta; the other #387 fixtures are unchanged.
 * Every authored roll-once value is retained in the returned state and is never rerolled by SU.
 */
export function buildRepresentativeCriticalRuntimeDefinition(
  criticalKey: string,
  rng: () => number = Math.random,
  adjudication?: CombatCriticalAdjudication,
): CombatCriticalRuntimeDefinition | undefined {
  const contract = C1_FIVE_KEY_ADJUDICATION[
    criticalKey as keyof typeof C1_FIVE_KEY_ADJUDICATION
  ] as
    | {
        operationKeys: Partial<Record<RepresentativeCriticalOperation, string>>;
        suppressible: readonly string[];
      }
    | undefined;
  const fixture = getRepresentativeCriticalFixture(criticalKey);
  if (!fixture) return undefined;
  if (!contract && adjudication) {
    throw new RangeError(
      "Critical adjudication is available only for the five active review keys.",
    );
  }
  const suppressed = validateC1FiveKeyAdjudication(criticalKey, adjudication);
  const stun = fixture.stun
    ? {
        ...fixture.stun,
        duration: rollRepresentativeDuration(fixture.stun.duration, rng),
        modifier: adjudication?.stunModifierOverride ?? fixture.stun.modifier,
      }
    : undefined;
  if (adjudication?.stunModifierOverride !== undefined && !stun) {
    throw new RangeError("This Critical has no Stun atom to change.");
  }

  return combatCriticalRuntimeDefinitionSchema.parse({
    bleed: fixture.bleed
      .filter((bleed) => !suppressed.has(bleed.sourceEffectKey))
      .map((bleed) => {
        const storedRoll =
          bleed.rate.kind === "roll_once"
            ? Math.floor(rng() * (bleed.rate.formula === "d4" ? 4 : 6)) + 1
            : undefined;
        return {
          allowedControlStates:
            bleed.kind === "external"
              ? ["active", "partial", "staunched_zero", "resolved"]
              : ["active", "stabilised", "resolved"],
          controlState: "active",
          currentRate: resolveRepresentativeBleedRate(bleed, storedRoll),
          firstTickRound: 1,
          kind: bleed.kind,
          rate: resolveRepresentativeBleedRate(bleed, storedRoll),
          rollFormula: bleed.rate.kind === "roll_once" ? bleed.rate.formula : undefined,
          sourceEffectKey: bleed.sourceEffectKey,
          sourceRate: bleed.sourceRate,
          storedRoll,
        };
      }),
    canonicalName: adjudication?.titleOverride ?? fixture.canonicalName,
    conditions: fixture.conditions
      .filter(
        (condition) => !condition.sourceEffectKey || !suppressed.has(condition.sourceEffectKey),
      )
      .map((condition) => ({
        ...condition,
        duration: rollRepresentativeDuration(condition.duration, rng),
      })),
    criticalKey: fixture.criticalKey,
    description: adjudication?.narrativeOverride ?? fixture.description,
    fixtureVersion: contract ? C1_FIVE_KEY_CRITICAL_RUNTIME_VERSION : fixture.fixtureVersion,
    information: fixture.information,
    operations: fixture.operations.filter((operation) => {
      const sourceEffectKey = contract?.operationKeys[operation];
      return !sourceEffectKey || !suppressed.has(sourceEffectKey);
    }),
    stun: stun && !suppressed.has(stun.sourceEffectKey) ? stun : undefined,
    treatment: fixture.treatment,
  });
}

export function sumIndependentCriticalStuns(
  stuns: readonly RepresentativeCriticalStun[],
  channel: CriticalStunChannel,
): number {
  return stuns.reduce(
    (total, activeStun) =>
      total +
      (activeStun.modifier !== null && activeStun.channels.includes(channel)
        ? activeStun.modifier
        : 0),
    0,
  );
}

export function getRepresentativeTreatmentSkillCandidates(
  fixture: RepresentativeCriticalFixture,
): readonly RepresentativeCriticalTreatmentSkill[] {
  return [...new Set(fixture.treatment.stages.map((stage) => stage.skill))];
}

export function getActiveMortalityOrPermanenceMechanics(
  fixture: RepresentativeCriticalFixture,
): readonly never[] {
  void fixture;
  return [];
}
