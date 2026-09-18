import {
  EquipmentItemFactsV1Schema,
  getItemMechanicalFactState,
  isItemMechanicalFactActive,
  type ArmorLocation,
  type CanonicalEquipmentItem,
  type DescriptiveItemTraitCategory,
  type EquipmentTemplate,
  type ItemCharacteristicFact,
  type ItemFactSourceProvenance,
  type ItemFactVisibility,
  type ShieldTemplate,
  type WeaponDamageModifierFormula,
  type WeaponInitiativeOverrideFact,
  type WeaponTemplate,
} from "@glantri/domain";

export type EffectiveItemProjectionAudience = "gm" | "player";

export type EffectiveItemCharacteristicKind =
  | "attack_mode_ob"
  | "attack_mode_dmb"
  | "attack_mode_initiative"
  | "fallback_initiative"
  | "weapon_parry"
  | "weapon_defensive_value"
  | "shield_parry"
  | "shield_defensive_value"
  | "armor_location_value"
  | "armor_general"
  | "armor_general_rounded"
  | "armor_location_critical_modifier"
  | "armor_general_critical_modifier"
  | "armor_activity_modifier"
  | "armor_perception_modifier"
  | "maximum_durability"
  | "base_encumbrance"
  | "base_value"
  | "final_attack_ob_delta"
  | "attack_mode_range"
  | "attack_mode_critical_code"
  | "attack_mode_second_critical_code"
  | "attack_mode_armor_modifier"
  | "legacy_range"
  | "legacy_critical_code"
  | "legacy_armor_modifier"
  | "shield_bonus_alias"
  | "shield_movement_modifier"
  | "armor_location_type"
  | "armor_mobility_penalty"
  | "armor_movement_factor"
  | "armor_encumbrance_factor";

export type EffectiveItemCharacteristicScope =
  | { attackModeId: string; kind: "attack_mode" }
  | { kind: "armor_location"; location: ArmorLocation }
  | { kind: "equipment" }
  | { kind: "legacy_field"; field: string };

export type EffectiveItemCharacteristicValue = WeaponDamageModifierFormula | number | string | null;

export interface EffectiveItemContribution {
  activationState: "hidden_dormant" | "revealed_inactive" | "revealed_active";
  applied: boolean;
  composition: "add" | "replace";
  factId: string;
  itemId: string;
  originalValue?: number;
  provenance?: ItemFactSourceProvenance | null;
  sourceKind:
    | ItemCharacteristicFact["kind"]
    | "legacy_weapon_initiative_override"
    | "item_field_override"
    | "final_attack_ob_delta";
  value: number;
  visibility: ItemFactVisibility;
}

export interface EffectiveItemProvenance {
  fieldPath: string;
  origin: "derived" | "item" | "legacy_compatibility" | "template";
  sourceId: string;
}

export interface EffectiveItemCharacteristic {
  activationState: "hidden_dormant" | "inherited" | "revealed_inactive" | "revealed_active";
  authorable: boolean;
  calculationStage: "final_attack_ob" | "template_projection";
  contributions: EffectiveItemContribution[];
  derived: boolean;
  effectiveValue: EffectiveItemCharacteristicValue;
  kind: EffectiveItemCharacteristicKind;
  provenance: EffectiveItemProvenance[];
  scope: EffectiveItemCharacteristicScope;
  templateValue: EffectiveItemCharacteristicValue;
  unit: string;
  unsupportedReason?: string;
  visibility: "revealed";
}

export interface ProjectedDescriptiveItemTrait {
  category: DescriptiveItemTraitCategory;
  factId: string;
  itemId: string;
  supportState: "descriptive_only";
  text: string;
  visibility: ItemFactVisibility;
}

export interface ProjectedUnsupportedItemCapability {
  factId: string;
  itemId: string;
  name: string;
  rulesText: string;
  supportState: "not_calculated_by_app";
  usageText: string | null;
  visibility: ItemFactVisibility;
}

export interface EffectiveEquipmentItemProjection {
  audience: EffectiveItemProjectionAudience;
  characteristics: EffectiveItemCharacteristic[];
  descriptiveTraits: ProjectedDescriptiveItemTrait[];
  effectiveTemplate: EquipmentTemplate;
  itemId: string;
  mutableState: { durabilityCurrent: number | null };
  schemaVersion: 2;
  templateId: string;
  unsupportedCapabilities: ProjectedUnsupportedItemCapability[];
}

const ARMOR_LOCATIONS: ArmorLocation[] = [
  "head",
  "frontArm",
  "chest",
  "backArm",
  "abdomen",
  "frontThigh",
  "frontFoot",
  "backThigh",
  "backFoot",
];

function scopeKey(scope: EffectiveItemCharacteristicScope): string {
  switch (scope.kind) {
    case "attack_mode":
      return `attack_mode:${scope.attackModeId}`;
    case "armor_location":
      return `armor_location:${scope.location}`;
    case "legacy_field":
      return `legacy_field:${scope.field}`;
    case "equipment":
      return "equipment";
  }
}

function characteristicKey(
  kind: EffectiveItemCharacteristicKind,
  scope: EffectiveItemCharacteristicScope,
): string {
  return `${kind}:${scopeKey(scope)}`;
}

function contributionState(
  contributions: EffectiveItemContribution[],
): EffectiveItemCharacteristic["activationState"] {
  if (contributions.length === 0) return "inherited";
  if (contributions.some((contribution) => contribution.activationState === "revealed_active")) {
    return "revealed_active";
  }
  if (contributions.some((contribution) => contribution.activationState === "revealed_inactive")) {
    return "revealed_inactive";
  }
  return "hidden_dormant";
}

function makeCharacteristic(input: {
  authorable: boolean;
  calculationStage?: EffectiveItemCharacteristic["calculationStage"];
  contributions?: EffectiveItemContribution[];
  derived?: boolean;
  effectiveValue: EffectiveItemCharacteristicValue;
  fieldPath: string;
  kind: EffectiveItemCharacteristicKind;
  scope: EffectiveItemCharacteristicScope;
  template: EquipmentTemplate;
  templateValue: EffectiveItemCharacteristicValue;
  unit: string;
  unsupportedReason?: string;
}): EffectiveItemCharacteristic {
  const contributions = input.contributions ?? [];
  return {
    activationState: contributionState(contributions),
    authorable: input.authorable,
    calculationStage: input.calculationStage ?? "template_projection",
    contributions,
    derived: input.derived ?? false,
    effectiveValue: input.effectiveValue,
    kind: input.kind,
    provenance: [
      { fieldPath: input.fieldPath, origin: "template", sourceId: input.template.id },
      ...contributions.map((contribution) => ({
        fieldPath: contribution.factId,
        origin:
          contribution.sourceKind === "legacy_weapon_initiative_override"
            ? ("legacy_compatibility" as const)
            : ("item" as const),
        sourceId: contribution.itemId,
      })),
    ],
    scope: input.scope,
    templateValue: input.templateValue,
    unit: input.unit,
    ...(input.unsupportedReason ? { unsupportedReason: input.unsupportedReason } : {}),
    visibility: "revealed",
  };
}

function isVisibleToAudience(
  fact: { visibility: ItemFactVisibility },
  audience: EffectiveItemProjectionAudience,
): boolean {
  return audience === "gm" || fact.visibility === "revealed";
}

function factContribution(
  item: CanonicalEquipmentItem,
  fact: ItemCharacteristicFact,
): EffectiveItemContribution {
  return {
    activationState: getItemMechanicalFactState(fact),
    applied: isItemMechanicalFactActive(fact),
    composition: "add",
    factId: fact.id,
    itemId: item.id,
    provenance: fact.provenance,
    sourceKind: fact.kind,
    value: fact.value,
    visibility: fact.visibility,
  };
}

function fieldContribution(
  item: CanonicalEquipmentItem,
  field: "durabilityMax" | "encumbranceOverride" | "valueOverride",
  value: number,
): EffectiveItemContribution {
  return {
    activationState: "revealed_active",
    applied: true,
    composition: "replace",
    factId: `item:${field}`,
    itemId: item.id,
    sourceKind: "item_field_override",
    value,
    visibility: "revealed",
  };
}

function legacyInitiativeContribution(input: {
  delta: number;
  fact: WeaponInitiativeOverrideFact;
  item: CanonicalEquipmentItem;
}): EffectiveItemContribution {
  return {
    activationState: getItemMechanicalFactState(input.fact),
    applied: isItemMechanicalFactActive(input.fact),
    composition: "add",
    factId: input.fact.id,
    itemId: input.item.id,
    originalValue: input.fact.value,
    provenance: input.fact.provenance,
    sourceKind: "legacy_weapon_initiative_override",
    value: input.delta,
    visibility: input.fact.visibility,
  };
}

function addDelta(base: number, contribution: EffectiveItemContribution | undefined): number {
  return contribution?.applied ? base + contribution.value : base;
}

function findCharacteristicFact(
  facts: ItemCharacteristicFact[],
  kind: ItemCharacteristicFact["kind"],
  scope: EffectiveItemCharacteristicScope,
): ItemCharacteristicFact | undefined {
  return facts.find(
    (fact) => fact.kind === kind && JSON.stringify(fact.scope) === JSON.stringify(scope),
  );
}

function projectDmb(input: {
  contribution?: EffectiveItemContribution;
  formula?: WeaponDamageModifierFormula | null;
  numeric?: number | null;
}): {
  authorable: boolean;
  effective: EffectiveItemCharacteristicValue;
  template: EffectiveItemCharacteristicValue;
  unsupportedReason?: string;
} {
  if (typeof input.numeric === "number") {
    return {
      authorable: true,
      effective: addDelta(input.numeric, input.contribution),
      template: input.numeric,
    };
  }
  const formula = input.formula;
  if (formula?.kind === "numeric" && typeof formula.numericValue === "number") {
    const effective = structuredClone(formula);
    if (input.contribution?.applied) {
      effective.numericValue = formula.numericValue + input.contribution.value;
    }
    return { authorable: true, effective, template: formula };
  }
  if (formula?.kind === "dice") {
    const effective = structuredClone(formula);
    if (input.contribution?.applied) {
      effective.flatModifier = (formula.flatModifier ?? 0) + input.contribution.value;
    }
    return { authorable: true, effective, template: formula };
  }
  return {
    authorable: false,
    effective: formula ?? null,
    template: formula ?? null,
    unsupportedReason: formula
      ? `${formula.kind} DMB formulas are inherited but not Item-authorable.`
      : "The attack mode has no numeric or dice-backed DMB.",
  };
}

function validateFactTarget(fact: ItemCharacteristicFact, template: EquipmentTemplate): void {
  const attackModeKinds: ItemCharacteristicFact["kind"][] = [
    "attack_mode_ob_delta",
    "attack_mode_dmb_delta",
    "attack_mode_initiative_delta",
  ];
  if (attackModeKinds.includes(fact.kind)) {
    if (template.category !== "weapon" && template.category !== "shield") {
      throw new Error(`${fact.kind} requires a weapon or shield template.`);
    }
    const mode = template.attackModes?.find(
      (candidate) => fact.scope.kind === "attack_mode" && candidate.id === fact.scope.attackModeId,
    );
    if (!mode) throw new Error(`${fact.kind} targets an unknown attack mode.`);
    if (fact.kind === "attack_mode_ob_delta" && typeof mode.ob !== "number") {
      throw new Error("attack_mode_ob_delta requires a numeric template OB.");
    }
    if (
      fact.kind === "attack_mode_initiative_delta" &&
      typeof (mode.initiative ?? template.initiative) !== "number"
    ) {
      throw new Error("attack_mode_initiative_delta requires an exact or fallback initiative.");
    }
    if (fact.kind === "attack_mode_dmb_delta") {
      const dmb = projectDmb({ formula: mode.dmbFormula, numeric: mode.dmb });
      if (!dmb.authorable) throw new Error(dmb.unsupportedReason);
    }
    return;
  }

  const categoryByKind: Partial<
    Record<ItemCharacteristicFact["kind"], EquipmentTemplate["category"]>
  > = {
    armor_activity_modifier_delta: "armor",
    armor_general_critical_modifier_delta: "armor",
    armor_location_critical_modifier_delta: "armor",
    armor_location_value_delta: "armor",
    armor_perception_modifier_delta: "armor",
    shield_defensive_value_delta: "shield",
    shield_parry_delta: "shield",
    weapon_defensive_value_delta: "weapon",
    weapon_parry_delta: "weapon",
  };
  const expectedCategory = categoryByKind[fact.kind];
  if (expectedCategory && template.category !== expectedCategory) {
    throw new Error(`${fact.kind} requires a ${expectedCategory} template.`);
  }
  if (
    fact.kind === "fallback_initiative_delta" &&
    template.category !== "weapon" &&
    template.category !== "shield"
  ) {
    throw new Error("fallback_initiative_delta requires a weapon or shield template.");
  }

  if (fact.scope.kind === "armor_location" && template.category === "armor") {
    const value =
      fact.kind === "armor_location_value_delta"
        ? template.locationValues?.[fact.scope.location]
        : template.criticalModifierByArea?.[fact.scope.location];
    if (typeof value !== "number")
      throw new Error(`${fact.kind} requires a numeric location value.`);
    return;
  }
  const base =
    template.category === "armor"
      ? fact.kind === "armor_activity_modifier_delta"
        ? template.armorActivityModifier
        : fact.kind === "armor_general_critical_modifier_delta"
          ? template.criticalModifierGeneral
          : fact.kind === "armor_perception_modifier_delta"
            ? template.perceptionModifier
            : undefined
      : template.category === "weapon" || template.category === "shield"
        ? fact.kind === "fallback_initiative_delta"
          ? template.initiative
          : fact.kind === "shield_defensive_value_delta" ||
              fact.kind === "weapon_defensive_value_delta"
            ? template.defensiveValue
            : fact.kind === "shield_parry_delta" || fact.kind === "weapon_parry_delta"
              ? template.parry
              : undefined
        : undefined;
  if (typeof base !== "number") {
    throw new Error(`${fact.kind} requires a numeric template value.`);
  }
}

export function projectEquipmentItem(
  item: CanonicalEquipmentItem,
  template: EquipmentTemplate,
  options: { audience?: EffectiveItemProjectionAudience } = {},
): EffectiveEquipmentItemProjection {
  if (item.templateId !== template.id || item.category !== template.category) {
    throw new Error("Item template does not match the requested projection template.");
  }

  const audience = options.audience ?? "gm";
  const facts = EquipmentItemFactsV1Schema.parse(item.itemFacts);
  const allCharacteristicFacts = facts.characteristics ?? [];
  allCharacteristicFacts.forEach((fact) => validateFactTarget(fact, template));
  const visibleFacts = allCharacteristicFacts.filter((fact) => isVisibleToAudience(fact, audience));
  const effectiveTemplate = structuredClone(template);
  const characteristics: EffectiveItemCharacteristic[] = [];

  const legacyInitiative = facts.templateOverrides.find(
    (fact): fact is WeaponInitiativeOverrideFact => fact.kind === "weapon_initiative_override",
  );
  if (legacyInitiative && template.category !== "weapon") {
    throw new Error("weapon_initiative_override requires a weapon item and template.");
  }
  const templateInitiative =
    template.category === "weapon" || template.category === "shield"
      ? template.initiative
      : undefined;
  if (legacyInitiative && typeof templateInitiative !== "number") {
    throw new Error("weapon_initiative_override requires a numeric template initiative.");
  }
  const legacySourceValue = legacyInitiative
    ? (legacyInitiative.provenance?.sourceTemplateValue ?? templateInitiative)
    : undefined;
  if (legacyInitiative && typeof legacySourceValue !== "number") {
    throw new Error("weapon_initiative_override lacks a numeric source template value.");
  }
  const legacyDelta = legacyInitiative ? legacyInitiative.value - legacySourceValue! : undefined;
  const visibleLegacy =
    legacyInitiative && isVisibleToAudience(legacyInitiative, audience)
      ? legacyInitiativeContribution({ delta: legacyDelta!, fact: legacyInitiative, item })
      : undefined;

  if (template.category === "weapon" || template.category === "shield") {
    const effectiveOffensiveTemplate = effectiveTemplate as WeaponTemplate | ShieldTemplate;
    for (const [index, mode] of (template.attackModes ?? []).entries()) {
      const effectiveMode = effectiveOffensiveTemplate.attackModes?.[index];
      const scope = { attackModeId: mode.id, kind: "attack_mode" } as const;
      const obFact = findCharacteristicFact(visibleFacts, "attack_mode_ob_delta", scope);
      const obContribution = obFact ? factContribution(item, obFact) : undefined;
      if (typeof mode.ob === "number") {
        const effectiveOb = addDelta(mode.ob, obContribution);
        if (effectiveMode) effectiveMode.ob = effectiveOb;
        characteristics.push(
          makeCharacteristic({
            authorable: true,
            contributions: obContribution ? [obContribution] : [],
            effectiveValue: effectiveOb,
            fieldPath: `attackModes.${mode.id}.ob`,
            kind: "attack_mode_ob",
            scope,
            template,
            templateValue: mode.ob,
            unit: "ob_points",
          }),
        );
      }

      const dmbFact = findCharacteristicFact(visibleFacts, "attack_mode_dmb_delta", scope);
      const dmbContribution = dmbFact ? factContribution(item, dmbFact) : undefined;
      const dmb = projectDmb({
        contribution: dmbContribution,
        formula: mode.dmbFormula,
        numeric: mode.dmb,
      });
      if (effectiveMode && dmbContribution?.applied) {
        if (typeof dmb.effective === "number") effectiveMode.dmb = dmb.effective;
        else effectiveMode.dmbFormula = dmb.effective as WeaponDamageModifierFormula;
      }
      characteristics.push(
        makeCharacteristic({
          authorable: dmb.authorable,
          contributions: dmbContribution ? [dmbContribution] : [],
          effectiveValue: dmb.effective,
          fieldPath: `attackModes.${mode.id}.dmb`,
          kind: "attack_mode_dmb",
          scope,
          template,
          templateValue: dmb.template,
          unit: "dmb_formula",
          unsupportedReason: dmb.unsupportedReason,
        }),
      );

      const initiativeFact = findCharacteristicFact(
        visibleFacts,
        "attack_mode_initiative_delta",
        scope,
      );
      const initiativeContribution = initiativeFact
        ? factContribution(item, initiativeFact)
        : visibleLegacy;
      const initiativeBase = mode.initiative ?? template.initiative ?? null;
      if (typeof initiativeBase === "number") {
        const effectiveInitiative = addDelta(initiativeBase, initiativeContribution);
        if (effectiveMode && initiativeContribution?.applied) {
          effectiveMode.initiative = effectiveInitiative;
        }
        characteristics.push(
          makeCharacteristic({
            authorable: true,
            contributions: initiativeContribution ? [initiativeContribution] : [],
            effectiveValue: effectiveInitiative,
            fieldPath:
              typeof mode.initiative === "number"
                ? `attackModes.${mode.id}.initiative`
                : "initiative",
            kind: "attack_mode_initiative",
            scope,
            template,
            templateValue: initiativeBase,
            unit: "initiative_points",
          }),
        );
      }

      for (const inherited of [
        [
          "range",
          "attack_mode_range",
          "Free-form range remains inherited until #306 defines a structured range contract.",
        ],
        [
          "crit",
          "attack_mode_critical_code",
          "Critical codes remain inherited until #306 defines the closed vocabulary.",
        ],
        [
          "secondCrit",
          "attack_mode_second_critical_code",
          "Secondary Critical codes remain inherited until #306 defines their authority.",
        ],
        [
          "armorModifier",
          "attack_mode_armor_modifier",
          "Free-form armor modifiers remain inherited until #306 defines their semantics.",
        ],
      ] as const) {
        const [field, kind, reason] = inherited;
        characteristics.push(
          makeCharacteristic({
            authorable: false,
            effectiveValue: mode[field] ?? null,
            fieldPath: `attackModes.${mode.id}.${field}`,
            kind,
            scope,
            template,
            templateValue: mode[field] ?? null,
            unit: "source_compatibility_text",
            unsupportedReason: reason,
          }),
        );
      }
    }

    const equipmentScope = { kind: "equipment" } as const;
    if (typeof template.initiative === "number") {
      const fallbackFact = findCharacteristicFact(
        visibleFacts,
        "fallback_initiative_delta",
        equipmentScope,
      );
      const contribution = fallbackFact ? factContribution(item, fallbackFact) : visibleLegacy;
      const effective = addDelta(template.initiative, contribution);
      effectiveOffensiveTemplate.initiative = effective;
      characteristics.push(
        makeCharacteristic({
          authorable: true,
          contributions: contribution ? [contribution] : [],
          effectiveValue: effective,
          fieldPath: "initiative",
          kind: "fallback_initiative",
          scope: equipmentScope,
          template,
          templateValue: template.initiative,
          unit: "initiative_points",
        }),
      );
    }

    for (const numeric of [
      ["parry", `${template.category}_parry`, `${template.category}_parry_delta`, "parry_points"],
      [
        "defensiveValue",
        `${template.category}_defensive_value`,
        `${template.category}_defensive_value_delta`,
        "defensive_value_points",
      ],
    ] as const) {
      const [field, effectiveKind, factKind, unit] = numeric;
      const base = template[field];
      if (typeof base !== "number") continue;
      const fact = findCharacteristicFact(
        visibleFacts,
        factKind as ItemCharacteristicFact["kind"],
        equipmentScope,
      );
      const contribution = fact ? factContribution(item, fact) : undefined;
      const effective = addDelta(base, contribution);
      effectiveOffensiveTemplate[field] = effective;
      characteristics.push(
        makeCharacteristic({
          authorable: true,
          contributions: contribution ? [contribution] : [],
          effectiveValue: effective,
          fieldPath: field,
          kind: effectiveKind as EffectiveItemCharacteristicKind,
          scope: equipmentScope,
          template,
          templateValue: base,
          unit,
        }),
      );
    }

    for (const [field, kind, reason] of [
      ["range", "legacy_range", "Free-form range is read-only pending #306."],
      ["crit1", "legacy_critical_code", "Legacy Critical aliases are read-only pending #306."],
      ["crit2", "legacy_critical_code", "Legacy Critical aliases are read-only pending #306."],
      ["secondCrit", "legacy_critical_code", "Legacy Critical aliases are read-only pending #306."],
      ["armorMod1", "legacy_armor_modifier", "Legacy armor aliases are read-only pending #306."],
      ["armorMod2", "legacy_armor_modifier", "Legacy armor aliases are read-only pending #306."],
    ] as const) {
      characteristics.push(
        makeCharacteristic({
          authorable: false,
          effectiveValue: template[field] ?? null,
          fieldPath: field,
          kind,
          scope: { field, kind: "legacy_field" },
          template,
          templateValue: template[field] ?? null,
          unit: "source_compatibility_text",
          unsupportedReason: reason,
        }),
      );
    }

    if (template.category === "shield") {
      characteristics.push(
        makeCharacteristic({
          authorable: false,
          effectiveValue: template.shieldBonus ?? null,
          fieldPath: "shieldBonus",
          kind: "shield_bonus_alias",
          scope: equipmentScope,
          template,
          templateValue: template.shieldBonus ?? null,
          unit: "unsettled_alias",
          unsupportedReason: "shieldBonus is an ambiguous legacy alias pending #306.",
        }),
        makeCharacteristic({
          authorable: false,
          effectiveValue: template.movementModifier ?? null,
          fieldPath: "movementModifier",
          kind: "shield_movement_modifier",
          scope: equipmentScope,
          template,
          templateValue: template.movementModifier ?? null,
          unit: "unsettled_movement_modifier",
          unsupportedReason: "Shield movementModifier semantics remain unsettled pending #306.",
        }),
      );
    }
  }

  if (template.category === "armor" && effectiveTemplate.category === "armor") {
    let activeLocationDelta = false;
    for (const location of ARMOR_LOCATIONS) {
      const scope = { kind: "armor_location", location } as const;
      const base = template.locationValues?.[location] ?? null;
      const fact = findCharacteristicFact(visibleFacts, "armor_location_value_delta", scope);
      const contribution = fact ? factContribution(item, fact) : undefined;
      const effective = typeof base === "number" ? addDelta(base, contribution) : base;
      if (contribution?.applied) activeLocationDelta = true;
      if (effectiveTemplate.locationValues && typeof effective === "number") {
        effectiveTemplate.locationValues[location] = effective;
      }
      characteristics.push(
        makeCharacteristic({
          authorable: typeof base === "number",
          contributions: contribution ? [contribution] : [],
          effectiveValue: effective,
          fieldPath: `locationValues.${location}`,
          kind: "armor_location_value",
          scope,
          template,
          templateValue: base,
          unit: "armor_points",
          unsupportedReason:
            typeof base === "number" ? undefined : "This armor location has no numeric value.",
        }),
      );

      const criticalBase = template.criticalModifierByArea?.[location] ?? null;
      const criticalFact = findCharacteristicFact(
        visibleFacts,
        "armor_location_critical_modifier_delta",
        scope,
      );
      const criticalContribution = criticalFact ? factContribution(item, criticalFact) : undefined;
      const criticalEffective =
        typeof criticalBase === "number"
          ? addDelta(criticalBase, criticalContribution)
          : criticalBase;
      if (effectiveTemplate.criticalModifierByArea && typeof criticalEffective === "number") {
        effectiveTemplate.criticalModifierByArea[location] = criticalEffective;
      }
      characteristics.push(
        makeCharacteristic({
          authorable: typeof criticalBase === "number",
          contributions: criticalContribution ? [criticalContribution] : [],
          effectiveValue: criticalEffective,
          fieldPath: `criticalModifierByArea.${location}`,
          kind: "armor_location_critical_modifier",
          scope,
          template,
          templateValue: criticalBase,
          unit: "critical_modifier_points",
          unsupportedReason:
            typeof criticalBase === "number"
              ? undefined
              : "This armor location has no numeric Critical modifier.",
        }),
        makeCharacteristic({
          authorable: false,
          effectiveValue: template.locationTypes?.[location] ?? null,
          fieldPath: `locationTypes.${location}`,
          kind: "armor_location_type",
          scope,
          template,
          templateValue: template.locationTypes?.[location] ?? null,
          unit: "source_compatibility_text",
          unsupportedReason: "Armor location type vocabulary remains read-only pending #306.",
        }),
      );
    }

    if (activeLocationDelta && effectiveTemplate.locationValues) {
      effectiveTemplate.armorRating =
        ARMOR_LOCATIONS.reduce(
          (total, location) => total + (effectiveTemplate.locationValues?.[location] ?? 0),
          0,
        ) / ARMOR_LOCATIONS.length;
      effectiveTemplate.generalArmorRounded = Math.round(effectiveTemplate.armorRating);
    }
    characteristics.push(
      makeCharacteristic({
        authorable: false,
        derived: true,
        effectiveValue: effectiveTemplate.armorRating ?? null,
        fieldPath: "armorRating",
        kind: "armor_general",
        scope: { kind: "equipment" },
        template,
        templateValue: template.armorRating ?? null,
        unit: "armor_points",
        unsupportedReason: "General armor is derived from the nine canonical location values.",
      }),
      makeCharacteristic({
        authorable: false,
        derived: true,
        effectiveValue: effectiveTemplate.generalArmorRounded ?? null,
        fieldPath: "generalArmorRounded",
        kind: "armor_general_rounded",
        scope: { kind: "equipment" },
        template,
        templateValue: template.generalArmorRounded ?? null,
        unit: "rounded_armor_points",
        unsupportedReason: "Rounded general armor is derived and cannot be overridden directly.",
      }),
    );

    for (const [field, effectiveKind, factKind, unit] of [
      [
        "criticalModifierGeneral",
        "armor_general_critical_modifier",
        "armor_general_critical_modifier_delta",
        "critical_modifier_points",
      ],
      [
        "armorActivityModifier",
        "armor_activity_modifier",
        "armor_activity_modifier_delta",
        "activity_modifier_points",
      ],
      [
        "perceptionModifier",
        "armor_perception_modifier",
        "armor_perception_modifier_delta",
        "perception_modifier_points",
      ],
    ] as const) {
      const base = template[field] ?? null;
      const scope = { kind: "equipment" } as const;
      const fact = findCharacteristicFact(visibleFacts, factKind, scope);
      const contribution = fact ? factContribution(item, fact) : undefined;
      const effective = typeof base === "number" ? addDelta(base, contribution) : base;
      if (typeof effective === "number") effectiveTemplate[field] = effective;
      characteristics.push(
        makeCharacteristic({
          authorable: typeof base === "number",
          contributions: contribution ? [contribution] : [],
          effectiveValue: effective,
          fieldPath: field,
          kind: effectiveKind,
          scope,
          template,
          templateValue: base,
          unit,
          unsupportedReason:
            typeof base === "number" ? undefined : `Armor ${field} has no numeric value.`,
        }),
      );
    }

    for (const [field, kind, reason] of [
      [
        "mobilityPenalty",
        "armor_mobility_penalty",
        "Armor mobility units and calculation stage remain unsettled pending #306.",
      ],
      [
        "movementFactor",
        "armor_movement_factor",
        "Armor movement units and calculation stage remain unsettled pending #306.",
      ],
      [
        "encumbranceFactor",
        "armor_encumbrance_factor",
        "Armor factor semantics remain read-only pending #306.",
      ],
    ] as const) {
      characteristics.push(
        makeCharacteristic({
          authorable: false,
          effectiveValue: template[field] ?? null,
          fieldPath: field,
          kind,
          scope: { kind: "equipment" },
          template,
          templateValue: template[field] ?? null,
          unit: "unsettled_numeric_input",
          unsupportedReason: reason,
        }),
      );
    }
  }

  const equipmentScope = { kind: "equipment" } as const;
  const baseDurability =
    template.category === "weapon"
      ? (template.durabilityProfile?.maxDurabilityDefault ?? null)
      : null;
  const durabilityContribution =
    item.durabilityMax != null && item.durabilityMax !== baseDurability
      ? fieldContribution(item, "durabilityMax", item.durabilityMax)
      : undefined;
  characteristics.push(
    makeCharacteristic({
      authorable: baseDurability != null || item.durabilityMax != null,
      contributions: durabilityContribution ? [durabilityContribution] : [],
      effectiveValue: item.durabilityMax ?? baseDurability,
      fieldPath: "durabilityProfile.maxDurabilityDefault",
      kind: "maximum_durability",
      scope: equipmentScope,
      template,
      templateValue: baseDurability,
      unit: "durability_points",
      unsupportedReason:
        baseDurability == null && item.durabilityMax == null
          ? "This template has no maximum-durability profile."
          : undefined,
    }),
  );

  const encumbranceContribution =
    item.encumbranceOverride != null
      ? fieldContribution(item, "encumbranceOverride", item.encumbranceOverride)
      : undefined;
  const encumbranceIsUnambiguous =
    template.category !== "weapon" ||
    template.baseEncumbranceFormula == null ||
    template.baseEncumbranceFormula.kind === "numeric";
  if (encumbranceContribution?.applied)
    effectiveTemplate.baseEncumbrance = encumbranceContribution.value;
  characteristics.push(
    makeCharacteristic({
      authorable: encumbranceIsUnambiguous,
      contributions: encumbranceContribution ? [encumbranceContribution] : [],
      effectiveValue: item.encumbranceOverride ?? template.baseEncumbrance,
      fieldPath: "baseEncumbrance",
      kind: "base_encumbrance",
      scope: equipmentScope,
      template,
      templateValue: template.baseEncumbrance,
      unit: "encumbrance_points",
      unsupportedReason: encumbranceIsUnambiguous
        ? undefined
        : "Formula-backed encumbrance is projected read-only; only its existing compatibility override is preserved.",
    }),
  );

  const valueContribution =
    item.valueOverride != null
      ? fieldContribution(item, "valueOverride", item.valueOverride)
      : undefined;
  if (valueContribution?.applied) effectiveTemplate.baseValue = valueContribution.value;
  characteristics.push(
    makeCharacteristic({
      authorable: true,
      contributions: valueContribution ? [valueContribution] : [],
      effectiveValue: item.valueOverride ?? template.baseValue ?? null,
      fieldPath: "baseValue",
      kind: "base_value",
      scope: equipmentScope,
      template,
      templateValue: template.baseValue ?? null,
      unit: "value_points",
    }),
  );

  const finalFact = facts.activeMechanics[0];
  const visibleFinal =
    finalFact && isVisibleToAudience(finalFact, audience) ? finalFact : undefined;
  const finalContribution = visibleFinal
    ? ({
        activationState: getItemMechanicalFactState(visibleFinal),
        applied: isItemMechanicalFactActive(visibleFinal),
        composition: "add",
        factId: visibleFinal.id,
        itemId: item.id,
        provenance: visibleFinal.provenance,
        sourceKind: "final_attack_ob_delta",
        value: visibleFinal.value,
        visibility: visibleFinal.visibility,
      } satisfies EffectiveItemContribution)
    : undefined;
  characteristics.push(
    makeCharacteristic({
      authorable: false,
      calculationStage: "final_attack_ob",
      contributions: finalContribution ? [finalContribution] : [],
      effectiveValue: finalContribution?.applied ? finalContribution.value : 0,
      fieldPath: "final_attack_ob_delta",
      kind: "final_attack_ob_delta",
      scope: equipmentScope,
      template,
      templateValue: 0,
      unit: "ob_points",
      unsupportedReason:
        "This compatibility mechanic is applied once immediately before attack roll/table lookup, never as ordinary attack-mode OB.",
    }),
  );

  characteristics.sort((left, right) =>
    characteristicKey(left.kind, left.scope).localeCompare(
      characteristicKey(right.kind, right.scope),
    ),
  );
  return {
    audience,
    characteristics,
    descriptiveTraits: facts.descriptiveTraits
      .filter((fact) => isVisibleToAudience(fact, audience))
      .map((fact) => ({
        category: fact.category,
        factId: fact.id,
        itemId: item.id,
        supportState: "descriptive_only" as const,
        text: fact.text,
        visibility: fact.visibility,
      }))
      .sort((left, right) => left.factId.localeCompare(right.factId)),
    effectiveTemplate,
    itemId: item.id,
    mutableState: { durabilityCurrent: item.durabilityCurrent ?? null },
    schemaVersion: 2,
    templateId: template.id,
    unsupportedCapabilities: facts.unsupportedCapabilities
      .filter((fact) => isVisibleToAudience(fact, audience))
      .map((fact) => ({
        factId: fact.id,
        itemId: item.id,
        name: fact.name,
        rulesText: fact.rulesText,
        supportState: "not_calculated_by_app" as const,
        usageText: fact.usageText ?? null,
        visibility: fact.visibility,
      }))
      .sort((left, right) => left.factId.localeCompare(right.factId)),
  };
}

export function getEffectiveItemCharacteristic(
  projection: EffectiveEquipmentItemProjection,
  kind: EffectiveItemCharacteristicKind,
  scope: EffectiveItemCharacteristicScope,
): EffectiveItemCharacteristic | undefined {
  const key = characteristicKey(kind, scope);
  return projection.characteristics.find(
    (characteristic) => characteristicKey(characteristic.kind, characteristic.scope) === key,
  );
}

/** Consumer boundary for the distinct late-stage contribution; callers apply the returned value once. */
export function getFinalAttackObDelta(projection: EffectiveEquipmentItemProjection): number {
  const characteristic = getEffectiveItemCharacteristic(projection, "final_attack_ob_delta", {
    kind: "equipment",
  });
  return typeof characteristic?.effectiveValue === "number" ? characteristic.effectiveValue : 0;
}
