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
  damageByType?: Partial<Record<DamageByTypeView["id"], number | string>>;
  generalDamage?: number;
  generalHitpoints?: number | null;
  hitLog?: HitLogEntryView[];
  locationDamageById?: Partial<Record<string, number>>;
}): CharacterPhysicalStateView {
  const originalGeneral = Math.max(0, Math.round(input.generalHitpoints ?? 0));
  const generalDamage = input.generalDamage ?? 0;

  return {
    damageByType: DEFAULT_DAMAGE_BY_TYPE.map((row) => ({
      ...row,
      currentEffect: input.damageByType?.[row.id] ?? row.currentEffect,
    })),
    hitLog: input.hitLog ?? [],
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
        const damage = input.locationDamageById?.[location.id] ?? 0;

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
