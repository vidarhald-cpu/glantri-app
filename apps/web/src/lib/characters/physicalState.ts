import type { CombatEffect, CombatEffectsState } from "@glantri/domain";

export interface HitLocationDefinition {
  id: string;
  label: string;
  weightDenominator: 11;
  weightNumerator: 4 | 6;
}

export interface HitpointRowView {
  current: number;
  damage: number;
  original: number;
}

export interface HitLocationView extends HitLocationDefinition, HitpointRowView {}

export interface DamageByTypeView {
  currentEffect: number | string;
  id: "general" | "obSkill" | "db" | "other" | "bleed" | "special";
  label: string;
}

export interface HitLogEntryView {
  damage: number;
  duration: string;
  generalDamage: number;
  id: string;
  location: string;
  roundNumber: number | string;
  source: string;
  specialEffects: string;
  status?: string;
  type: string;
}

export interface CharacterPhysicalStateView {
  damageByType: DamageByTypeView[];
  hitLog: HitLogEntryView[];
  hitpoints: {
    general: HitpointRowView;
    locations: HitLocationView[];
  };
}

export const HIT_LOCATION_DEFINITIONS: HitLocationDefinition[] = [
  { id: "head", label: "Head", weightDenominator: 11, weightNumerator: 4 },
  { id: "leftArm", label: "Left arm", weightDenominator: 11, weightNumerator: 4 },
  { id: "rightArm", label: "Right arm", weightDenominator: 11, weightNumerator: 4 },
  { id: "chestBack", label: "Chest/back", weightDenominator: 11, weightNumerator: 6 },
  {
    id: "abdomenLowerBack",
    label: "Abdomen/lower back",
    weightDenominator: 11,
    weightNumerator: 6,
  },
  {
    id: "upperLeftLeg",
    label: "Upper left leg",
    weightDenominator: 11,
    weightNumerator: 4,
  },
  {
    id: "lowerLeftLeg",
    label: "Lower left leg",
    weightDenominator: 11,
    weightNumerator: 4,
  },
  {
    id: "upperRightLeg",
    label: "Upper right leg",
    weightDenominator: 11,
    weightNumerator: 4,
  },
  {
    id: "lowerRightLeg",
    label: "Lower right leg",
    weightDenominator: 11,
    weightNumerator: 4,
  },
];

const DEFAULT_DAMAGE_BY_TYPE: DamageByTypeView[] = [
  { currentEffect: 0, id: "general", label: "General" },
  { currentEffect: 0, id: "obSkill", label: "OB/Skill" },
  { currentEffect: 0, id: "db", label: "DB" },
  { currentEffect: 0, id: "other", label: "Other" },
  { currentEffect: 0, id: "bleed", label: "Bleed" },
  { currentEffect: "—", id: "special", label: "Special" },
];

const EMPTY_COMBAT_EFFECTS: CombatEffectsState = {
  effects: [],
  events: [],
};

function isActiveEffect(effect: CombatEffect): boolean {
  return effect.status === "active";
}

function getEffectMagnitude(effect: CombatEffect): number {
  if (effect.modifierValue != null) {
    return effect.modifierValue;
  }

  if (effect.damage !== 0) {
    return effect.damage;
  }

  return effect.generalDamage;
}

function buildLocationDamageById(
  combatEffects: CombatEffectsState,
): Partial<Record<string, number>> {
  return combatEffects.effects
    .filter((effect) => isActiveEffect(effect) && effect.type === "physical_damage")
    .reduce<Partial<Record<string, number>>>((damageById, effect) => {
      if (!effect.location) {
        return damageById;
      }

      damageById[effect.location] = (damageById[effect.location] ?? 0) + effect.damage;
      return damageById;
    }, {});
}

function buildDamageByType(
  combatEffects: CombatEffectsState,
): Partial<Record<DamageByTypeView["id"], number | string>> {
  const activeEffects = combatEffects.effects.filter(isActiveEffect);
  const specialCount = activeEffects.filter((effect) => effect.effectGroup === "special").length;

  return {
    bleed: activeEffects
      .filter((effect) => effect.effectGroup === "bleed")
      .reduce((total, effect) => total + getEffectMagnitude(effect), 0),
    db: activeEffects
      .filter((effect) => effect.effectGroup === "db")
      .reduce((total, effect) => total + getEffectMagnitude(effect), 0),
    general: activeEffects
      .filter((effect) => effect.effectGroup === "general")
      .reduce((total, effect) => total + getEffectMagnitude(effect), 0),
    obSkill: activeEffects
      .filter((effect) => effect.effectGroup === "obSkill")
      .reduce((total, effect) => total + getEffectMagnitude(effect), 0),
    other: activeEffects
      .filter((effect) => effect.effectGroup === "other")
      .reduce((total, effect) => total + getEffectMagnitude(effect), 0),
    special: specialCount > 0 ? specialCount : "—",
  };
}

function buildHitLog(combatEffects: CombatEffectsState): HitLogEntryView[] {
  const eventsById = new Map(
    combatEffects.events.map((event) => [
      event.id,
      {
        roundNumber: event.roundNumber,
        source: event.sourceLabel || event.description || "Combat effect",
      },
    ]),
  );

  return combatEffects.effects.map((effect) => ({
    damage: effect.damage,
    duration: effect.duration ?? "",
    generalDamage: effect.generalDamage,
    id: effect.id,
    location: effect.location ?? "",
    roundNumber: effect.roundNumber ?? eventsById.get(effect.sourceEventId)?.roundNumber ?? "",
    source: eventsById.get(effect.sourceEventId)?.source ?? "Combat effect",
    specialEffects: effect.description ?? "",
    status: effect.status,
    type: effect.type,
  }));
}

export function calculateLocationHitpoints(input: {
  generalHitpoints: number;
  weightDenominator: number;
  weightNumerator: number;
}): number {
  if (input.generalHitpoints <= 0) {
    return 0;
  }

  return Math.max(
    1,
    Math.round(
      (input.generalHitpoints * input.weightNumerator) / input.weightDenominator,
    ),
  );
}

export function buildCharacterPhysicalStateView(input: {
  combatEffects?: CombatEffectsState;
  damageByType?: Partial<Record<DamageByTypeView["id"], number | string>>;
  generalDamage?: number;
  generalHitpoints?: number | null;
  hitLog?: HitLogEntryView[];
  locationDamageById?: Partial<Record<string, number>>;
}): CharacterPhysicalStateView {
  const combatEffects = input.combatEffects ?? EMPTY_COMBAT_EFFECTS;
  const originalGeneral = Math.max(0, Math.round(input.generalHitpoints ?? 0));
  const effectGeneralDamage = combatEffects.effects
    .filter(isActiveEffect)
    .reduce((total, effect) => total + effect.generalDamage, 0);
  const generalDamage = (input.generalDamage ?? 0) + effectGeneralDamage;
  const effectLocationDamageById = buildLocationDamageById(combatEffects);
  const damageByType = {
    ...buildDamageByType(combatEffects),
    ...input.damageByType,
  };
  const hitLog = input.hitLog ?? buildHitLog(combatEffects);

  return {
    damageByType: DEFAULT_DAMAGE_BY_TYPE.map((row) => ({
      ...row,
      currentEffect: damageByType[row.id] ?? row.currentEffect,
    })),
    hitLog,
    hitpoints: {
      general: {
        current: originalGeneral - generalDamage,
        damage: generalDamage,
        original: originalGeneral,
      },
      locations: HIT_LOCATION_DEFINITIONS.map((location) => {
        const original = calculateLocationHitpoints({
          generalHitpoints: originalGeneral,
          weightDenominator: location.weightDenominator,
          weightNumerator: location.weightNumerator,
        });
        const damage =
          (input.locationDamageById?.[location.id] ?? 0) +
          (effectLocationDamageById[location.id] ?? 0);

        return {
          ...location,
          current: original - damage,
          damage,
          original,
        };
      }),
    },
  };
}
