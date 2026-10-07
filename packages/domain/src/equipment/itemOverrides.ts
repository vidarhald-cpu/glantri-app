import { z } from "zod";
import type { ArmorComponentProfile, ArmorLocationValues, EquipmentTemplate } from "./types";

export const armorLocationKeys = [
  "head",
  "frontArm",
  "chest",
  "backArm",
  "abdomen",
  "frontThigh",
  "frontFoot",
  "backThigh",
  "backFoot",
] as const;
const numericProperty = z.enum([
  "baseEncumbrance",
  "initiative",
  "parry",
  "defensiveValue",
  "movementModifier",
  "armorActivityModifier",
  "perceptionModifier",
  "movementFactor",
  "encumbranceFactor",
]);
const common = { visibility: z.enum(["gm_only", "revealed"]).default("gm_only") };
export const ItemMechanicalOverrideSchema = z.discriminatedUnion("kind", [
  z
    .object({
      ...common,
      kind: z.literal("input"),
      property: numericProperty,
      value: z.number().finite(),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal("attack"),
      modeId: z.string().min(1),
      property: z.enum([
        "ob",
        "dmb",
        "initiative",
        "numericValue",
        "diceCount",
        "diceSides",
        "flatModifier",
      ]),
      value: z.number().finite(),
    })
    .strict(),
  z
    .object({
      ...common,
      kind: z.literal("armor"),
      componentKey: z.string().nullable(),
      property: z.enum(["encumbranceFactor", ...armorLocationKeys]),
      value: z.number().finite().nonnegative(),
    })
    .strict(),
]);
export const ItemMechanicalOverridesSchema = z.array(ItemMechanicalOverrideSchema).max(100);
export type ItemMechanicalOverride = z.infer<typeof ItemMechanicalOverrideSchema>;

export function itemOverrideKey(entry: ItemMechanicalOverride): string {
  if (entry.kind === "attack") return `attack:${entry.modeId}:${entry.property}`;
  if (entry.kind === "armor") return `armor:${entry.componentKey ?? "whole"}:${entry.property}`;
  return `input:${entry.property}`;
}

/**
 * Source identity survives component reordering; duplicate identities are not editable. A component
 * that carries its identity explicitly (`componentKey`, set where its `sourceMetadata` was removed)
 * keeps it, so an override stored against the source identity still finds it.
 */
export function armorComponentKey(component: ArmorComponentProfile): string {
  if (component.componentKey) return component.componentKey;
  const source = component.sourceMetadata;
  return source
    ? `${source.workbook}:${source.sheet}:${source.finishedRow}`
    : `name:${component.name}`;
}

export interface ItemOverrideChoice {
  entry: ItemMechanicalOverride;
  label: string;
  templateValue: number;
}

/** The allowlist follows authoritative inputs, never arbitrary paths or result aliases. */
export function getItemOverrideChoices(template: EquipmentTemplate): ItemOverrideChoice[] {
  const choices: ItemOverrideChoice[] = [];
  const add = (entry: ItemMechanicalOverride, label: string, value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value))
      choices.push({ entry: { ...entry, value }, label, templateValue: value });
  };
  const input = (property: z.infer<typeof numericProperty>, label: string, value: unknown) =>
    add({ kind: "input", property, value: 0, visibility: "gm_only" }, label, value);
  if (template.category !== "armor") input("baseEncumbrance", "Base ENC", template.baseEncumbrance);
  if (template.category === "weapon" || template.category === "shield") {
    input("initiative", "Equipment initiative", template.initiative);
    input("parry", "Equipment parry", template.parry);
    input("defensiveValue", "Equipment defense", template.defensiveValue);
    if (template.category === "shield")
      input("movementModifier", "Shield movement modifier", template.movementModifier);
    for (const mode of template.attackModes ?? []) {
      if (template.attackModes?.filter((candidate) => candidate.id === mode.id).length !== 1)
        continue;
      const attack = (
        property: Extract<ItemMechanicalOverride, { kind: "attack" }>["property"],
        label: string,
        value: unknown,
      ) =>
        add(
          { kind: "attack", modeId: mode.id, property, value: 0, visibility: "gm_only" },
          `${mode.label ?? mode.id} · ${label}`,
          value,
        );
      attack("ob", "OB input", mode.ob);
      attack("initiative", "Initiative input", mode.initiative);
      if (mode.dmbFormula?.kind === "numeric")
        attack("numericValue", "DMB input", mode.dmbFormula.numericValue);
      else if (mode.dmbFormula?.kind === "dice") {
        attack("diceCount", "DMB dice count", mode.dmbFormula.diceCount);
        attack("diceSides", "DMB dice sides", mode.dmbFormula.diceSides);
        attack("flatModifier", "DMB flat modifier", mode.dmbFormula.flatModifier);
      } else if (!mode.dmbFormula) attack("dmb", "DMB input", mode.dmb);
    }
  }
  if (template.category === "armor") {
    input("armorActivityModifier", "Armor activity modifier", template.armorActivityModifier);
    input("perceptionModifier", "Perception modifier", template.perceptionModifier);
    input("movementFactor", "Armor movement factor", template.movementFactor);
    const components = template.componentProfiles?.length ? template.componentProfiles : [null];
    for (const component of components) {
      const componentKey = component ? armorComponentKey(component) : null;
      if (
        component &&
        components.filter((candidate) => candidate && armorComponentKey(candidate) === componentKey)
          .length !== 1
      )
        continue;
      const source = component ?? template;
      const prefix = component ? `${component.name} · ` : "";
      for (const property of ["encumbranceFactor", ...armorLocationKeys] as const) {
        add(
          { kind: "armor", componentKey, property, value: 0, visibility: "gm_only" },
          `${prefix}${property === "encumbranceFactor" ? "ENC factor" : property + " protection"}`,
          property === "encumbranceFactor"
            ? source.encumbranceFactor
            : source.locationValues?.[property],
        );
      }
    }
  }
  return choices;
}

// Themistogenes 1.07.xlsx, Crit Mod!A2:B22. Exact-key lookup, as importArmor.ts.
const armorCriticalModifiers = [0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 7, 8, 8, 8];
function armorCritical(value: number): number | null {
  return armorCriticalModifiers[Number(value.toFixed(9))] ?? null;
}
function armorDerived(values: ArmorLocationValues) {
  const generalArmor =
    armorLocationKeys.reduce((sum, key) => sum + (values[key] ?? 0), 0) / armorLocationKeys.length;
  const generalArmorRounded = Math.round(generalArmor);
  return {
    generalArmor,
    generalArmorRounded,
    criticalModifierGeneral: armorCritical(generalArmorRounded),
    criticalModifierByArea: Object.fromEntries(
      armorLocationKeys.map((key) => [key, armorCritical(values[key] ?? 0)]),
    ),
  };
}

/** Pure live inheritance: no registry mutation and no synthetic descriptive-only Template. */
export function resolveEffectiveItemTemplate(
  item: { templateId: string | null; mechanicalOverrides?: readonly ItemMechanicalOverride[] },
  templates: Readonly<Record<string, EquipmentTemplate>>,
): EquipmentTemplate | undefined {
  if (item.templateId === null) {
    if (item.mechanicalOverrides?.length)
      throw new Error("Descriptive-only items cannot have Equipment overrides.");
    return undefined;
  }
  const template = templates[item.templateId];
  if (!template) return undefined;
  const overrides = ItemMechanicalOverridesSchema.parse(item.mechanicalOverrides ?? []);
  if (!overrides.length) return template;
  const allowed = new Set(
    getItemOverrideChoices(template).map((choice) => itemOverrideKey(choice.entry)),
  );
  const seen = new Set<string>();
  const result = structuredClone(template);
  for (const entry of overrides) {
    const key = itemOverrideKey(entry);
    if (!allowed.has(key) || seen.has(key))
      throw new Error("This Equipment input cannot be overridden.");
    seen.add(key);
    if (entry.kind === "input") {
      if (entry.property === "baseEncumbrance" && entry.value < 0)
        throw new Error("Base ENC cannot be negative.");
      Object.assign(result, { [entry.property]: entry.value });
      if (
        result.category === "weapon" &&
        entry.property === "baseEncumbrance" &&
        result.baseEncumbranceFormula?.kind === "numeric"
      )
        result.baseEncumbranceFormula = {
          ...result.baseEncumbranceFormula,
          numericValue: entry.value,
          raw: String(entry.value),
        };
    } else if (
      entry.kind === "attack" &&
      (result.category === "weapon" || result.category === "shield")
    ) {
      const mode = result.attackModes!.find((candidate) => candidate.id === entry.modeId)!;
      if (["numericValue", "diceCount", "diceSides", "flatModifier"].includes(entry.property)) {
        if (
          (entry.property === "diceCount" || entry.property === "diceSides") &&
          (!Number.isInteger(entry.value) || entry.value <= 0)
        )
          throw new Error("DMB dice inputs must be positive whole numbers.");
        Object.assign(mode.dmbFormula!, { [entry.property]: entry.value });
        mode.dmb = mode.dmbFormula!.kind === "numeric" ? mode.dmbFormula!.numericValue : null;
        mode.dmbFormula!.raw =
          mode.dmbFormula!.kind === "numeric"
            ? String(mode.dmb)
            : `${mode.dmbFormula!.diceCount}d${mode.dmbFormula!.diceSides}${(mode.dmbFormula!.flatModifier ?? 0) >= 0 ? "+" : ""}${mode.dmbFormula!.flatModifier ?? 0}`;
        mode.dmbRaw = mode.dmbFormula!.raw;
      } else {
        Object.assign(mode, { [entry.property]: entry.value });
        if (entry.property === "ob") mode.obRaw = String(entry.value);
        if (entry.property === "dmb") mode.dmbRaw = String(entry.value);
      }
    } else if (entry.kind === "armor" && result.category === "armor") {
      const target =
        entry.componentKey === null
          ? result
          : result.componentProfiles!.find(
              (component) => armorComponentKey(component) === entry.componentKey,
            )!;
      if (entry.property === "encumbranceFactor") target.encumbranceFactor = entry.value;
      else target.locationValues = { ...target.locationValues, [entry.property]: entry.value };
    }
  }
  if (result.category === "shield") result.shieldBonus = result.defensiveValue;
  if (
    (result.category === "weapon" || result.category === "shield") &&
    result.attackModes?.length
  ) {
    for (const [index, mode] of result.attackModes.slice(0, 2).entries())
      Object.assign(result, { [`ob${index + 1}`]: mode.ob, [`dmb${index + 1}`]: mode.dmb });
  }
  if (result.category === "armor") {
    if (result.componentProfiles?.length) {
      for (const component of result.componentProfiles)
        Object.assign(component, armorDerived(component.locationValues ?? {}));
      result.locationValues = Object.fromEntries(
        armorLocationKeys.map((key) => [
          key,
          result.componentProfiles!.reduce(
            (sum, component) => sum + (component.locationValues?.[key] ?? 0),
            0,
          ),
        ]),
      );
      result.encumbranceFactor = result.componentProfiles.reduce(
        (sum, component) => sum + (component.encumbranceFactor ?? 0),
        0,
      );
    }
    const derived = armorDerived(result.locationValues ?? {});
    result.armorRating = derived.generalArmor;
    result.generalArmorRounded = derived.generalArmorRounded;
    result.criticalModifierByArea = derived.criticalModifierByArea;
    result.criticalModifierGeneral = derived.criticalModifierGeneral;
    result.baseEncumbrance = result.encumbranceFactor ?? result.baseEncumbrance;
    result.mobilityPenalty = result.movementFactor;
  }
  return result;
}
