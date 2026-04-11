import { execFileSync } from "node:child_process";
import * as path from "node:path";

import {
  getCanonicalMeleeModeFromAttackLabel,
  getCanonicalMeleeModeFromCrit,
  getCanonicalMeleeModeLabel,
} from "@glantri/domain";
import type {
  WeaponAttackMode,
  WeaponDamageClass,
  WeaponHandlingClass,
  WeaponTemplate,
} from "@glantri/domain/equipment";

const THEMISTOGENES_WORKBOOK_PATH = path.resolve(
  __dirname,
  "../../../../data/raw/glantri/Themistogenes 1.07.xlsx",
);
const THEMISTOGENES_WORKBOOK_NAME = "Themistogenes 1.07.xlsx";

const WEAPON_ONE_TARGET = "xl/worksheets/sheet14.xml";
const WEAPON_TWO_TARGET = "xl/worksheets/sheet15.xml";

const WEAPON_ONE_SOURCE_COLUMNS = {
  name: "A",
  skill: "B",
  primaryAttackLabel: "C",
  ob1: "D",
  dmb1: "E",
  ob2: "F",
  dmb2: "G",
  parry: "H",
  initiative: "I",
  range: "J",
  armorMod1: "K",
  armorMod2: "L",
  crit1: "M",
  crit2: "N",
  encumbrance: "O",
  defensiveValue: "P",
  secondCrit: "Q",
} as const;

const WEAPON_TWO_SOURCE_COLUMNS = {
  name: "A",
  skill: "B",
  ob1: "C",
  dmb1: "D",
  parry: "E",
  initiative: "F",
  range: "G",
  armorMod1: "H",
  crit1: "I",
  encumbrance: "J",
  ammoEncumbrance: "K",
} as const;

type SourceRow = Record<string, string>;

export interface ImportedWeaponRowWarning {
  sheet: string;
  row: number;
  weaponName: string;
  warning: string;
}

export interface ImportedWeaponsReport {
  workbook: string;
  importedWeaponCount: number;
  skippedRows: Array<{
    reason: string;
    row: number;
    sheet: string;
    weaponName?: string;
  }>;
  warnings: ImportedWeaponRowWarning[];
  sourceSheets: Array<{
    headerRow: number;
    range: string;
    sheet: string;
    sourceColumns: Record<string, string>;
  }>;
}

export interface ImportedWeaponsResult {
  report: ImportedWeaponsReport;
  templates: WeaponTemplate[];
}

function readZipEntryUtf8(workbookPath: string, entryPath: string): string {
  return execFileSync("unzip", ["-p", workbookPath, entryPath], {
    encoding: "utf8",
  });
}

function decodeXmlText(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseAttributes(fragment: string): Record<string, string> {
  const attributes: Record<string, string> = {};

  for (const match of fragment.matchAll(/([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXmlText(match[2]);
  }

  return attributes;
}

function parseSharedStrings(xml: string): string[] {
  const values: string[] = [];

  for (const match of xml.matchAll(/<si\b[\s\S]*?<\/si>/g)) {
    const text = Array.from(match[0].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g))
      .map((entry) => decodeXmlText(entry[1]))
      .join("");
    values.push(text);
  }

  return values;
}

function parseWorksheetRows(xml: string, sharedStrings: string[]): Array<{ rowNumber: number; values: SourceRow }> {
  const rows: Array<{ rowNumber: number; values: SourceRow }> = [];

  for (const rowMatch of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)) {
    const rowAttributes = parseAttributes(rowMatch[1]);
    const rowNumber = Number(rowAttributes.r ?? "0");
    const values: SourceRow = {};
    const body = rowMatch[2];

    for (const cellMatch of body.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const cellAttributes = parseAttributes(cellMatch[1]);
      const reference = cellAttributes.r;
      if (!reference) {
        continue;
      }

      const columnMatch = /^([A-Z]+)/.exec(reference);
      if (!columnMatch) {
        continue;
      }

      const column = columnMatch[1];
      const cellBody = cellMatch[2] ?? "";
      const type = cellAttributes.t;

      let text = "";

      if (type === "inlineStr") {
        const inline = /<t\b[^>]*>([\s\S]*?)<\/t>/.exec(cellBody);
        text = inline ? decodeXmlText(inline[1]) : "";
      } else {
        const valueMatch = /<v>([\s\S]*?)<\/v>/.exec(cellBody);
        const raw = valueMatch ? decodeXmlText(valueMatch[1]) : "";
        text = type === "s" ? sharedStrings[Number(raw)] ?? "" : raw;
      }

      values[column] = text;
    }

    if (rowNumber > 0 && Object.values(values).some((value) => value.trim().length > 0)) {
      rows.push({ rowNumber, values });
    }
  }

  return rows;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function stableWeaponId(name: string): string {
  const aliasMap: Record<string, string> = {
    "dagger": "weapon-template-dagger",
    "long sword": "weapon-template-longsword",
    "mace": "weapon-template-mace",
    "2-h spear": "weapon-template-spear",
    "short bow": "weapon-template-bow",
  };

  return aliasMap[name.toLowerCase()] ?? `weapon-template-${slugify(name)}`;
}

function deriveHandlingClass(input: { name: string; range: string | null; skill: string; sheet: string }): WeaponHandlingClass {
  const lowerName = input.name.toLowerCase();
  const lowerSkill = input.skill.toLowerCase();
  const lowerRange = (input.range ?? "").toLowerCase();

  if (input.sheet === "Weapon2") {
    if (lowerSkill.includes("throw")) {
      return "thrown";
    }
    return "missile";
  }

  if (lowerSkill.includes("2-h")) {
    return "two_handed";
  }
  if (lowerSkill.includes("fencing")) {
    return "paired";
  }
  if (lowerSkill.includes("polearm") || lowerSkill.includes("lance")) {
    return "polearm";
  }
  if (lowerName.includes("knife") || lowerName.includes("dagger") || lowerName.includes("main gauche") || lowerName.includes("swordbreaker")) {
    return "light";
  }
  if (lowerRange.includes("&")) {
    return "polearm";
  }
  return "one_handed";
}

function deriveWeaponClass(input: { name: string; skill: string }): string {
  const lowerName = input.name.toLowerCase();
  const lowerSkill = input.skill.toLowerCase();

  if (lowerName.includes("sword") || lowerName.includes("sabre") || lowerName.includes("scimitar") || lowerName.includes("rapier")) {
    return "sword";
  }
  if (lowerName.includes("dagger") || lowerName.includes("knife") || lowerName.includes("dirk") || lowerName.includes("main gauche")) {
    return "knife";
  }
  if (lowerName.includes("mace") || lowerName.includes("maul") || lowerName.includes("club")) {
    return "mace";
  }
  if (lowerName.includes("axe") || lowerName.includes("hatchet")) {
    return "axe";
  }
  if (lowerName.includes("spear") || lowerName.includes("javelin") || lowerName.includes("lance") || lowerName.includes("halberd") || lowerName.includes("pole")) {
    return "polearm";
  }
  if (lowerName.includes("bow")) {
    return "bow";
  }
  if (lowerName.includes("crossbow") || lowerName.includes("ballista")) {
    return "crossbow";
  }
  if (lowerSkill.includes("firearms") || lowerName.includes("musket") || lowerName.includes("pistol") || lowerName.includes("cannon") || lowerName.includes("arquebus") || lowerName.includes("rifle")) {
    return "firearm";
  }
  if (lowerSkill.includes("throw")) {
    return "thrown";
  }
  if (lowerSkill.includes("sling")) {
    return "sling";
  }
  return slugify(input.skill);
}

function deriveDamageClassFromText(input: string | null | undefined): WeaponDamageClass | null {
  if (!input) {
    return null;
  }

  const value = input.toLowerCase();

  if (value.includes("thrust") || value.includes("pierce") || value.includes("puncture") || value.includes("strangle")) {
    return "pointed";
  }
  if (value.includes("slash") || value.includes("cut")) {
    return "edged";
  }
  if (value.includes("strike") || value.includes("bash") || value.includes("blunt") || value.includes("crush")) {
    return "blunt";
  }

  return null;
}

function deriveDamageClassFromCrit(input: string | null | undefined): WeaponDamageClass | null {
  if (!input) {
    return null;
  }

  const upper = input.toUpperCase();

  if (upper.includes("P")) {
    return "pointed";
  }
  if (upper.includes("S")) {
    return "edged";
  }
  if (upper.includes("C")) {
    return "blunt";
  }

  return null;
}

function parseNumber(input: string | undefined): number | null {
  if (!input) {
    return null;
  }

  const trimmed = input.trim();
  if (!/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    return null;
  }

  return Number(trimmed);
}

function parseLeadingNumber(input: string | undefined): number | null {
  if (!input) {
    return null;
  }

  const match = /^-?\d+(?:\.\d+)?/.exec(input.trim());
  return match ? Number(match[0]) : null;
}

function buildTags(input: {
  name: string;
  handlingClass: WeaponHandlingClass;
  range: string | null;
  skill: string;
  attackModes: WeaponAttackMode[];
  sheet: string;
}): string[] {
  const tags = new Set<string>();
  const name = input.name.toLowerCase();
  const skill = input.skill.toLowerCase();

  tags.add("themistogenes-import");
  tags.add(input.sheet === "Weapon2" ? "missile" : "melee");
  tags.add(input.handlingClass.replace(/_/g, "-"));

  if ((input.range ?? "").includes("&")) {
    tags.add("variable-reach");
  }

  if (name.includes("bow")) {
    tags.add("bow");
  }
  if (name.includes("crossbow") || name.includes("ballista")) {
    tags.add("crossbow");
  }
  if (name.includes("gun") || name.includes("musket") || name.includes("pistol") || name.includes("rifle") || name.includes("arquebus") || name.includes("cannon")) {
    tags.add("firearm");
  }
  if (skill.includes("throw")) {
    tags.add("thrown");
  }

  for (const mode of input.attackModes) {
    if (mode.damageClass) {
      tags.add(mode.damageClass);
    }
  }

  return Array.from(tags);
}

function buildAttackMode(input: {
  armorModifier: string | undefined;
  canonicalMeleeMode?: WeaponAttackMode["canonicalMeleeMode"];
  crit: string | undefined;
  dmb: string | undefined;
  id: string;
  isPrimaryAttack?: boolean | null;
  label: string | null;
  rowWarnings: string[];
  sheet: string;
  secondCrit?: string | null;
  weaponName: string;
  ob: string | undefined;
}): WeaponAttackMode | null {
  const hasSignal = [input.armorModifier, input.crit, input.dmb, input.label, input.ob].some(
    (value) => (value ?? "").trim().length > 0,
  );
  if (!hasSignal) {
    return null;
  }

  const damageClass =
    deriveDamageClassFromText(input.label) ??
    deriveDamageClassFromCrit(input.crit);

  if (!damageClass) {
    input.rowWarnings.push(
      `${input.weaponName} ${input.id}: unresolved damage class from source label/crit.`,
    );
  }

  if (input.sheet === "Weapon1" && input.id === "mode-2" && !input.label && hasSignal) {
    input.rowWarnings.push(
      `${input.weaponName} mode-2: source table has no explicit secondary attack label column.`,
    );
  }

  if (input.sheet === "Weapon2" && !input.label) {
    input.rowWarnings.push(
      `${input.weaponName} mode-1: source table has no explicit attack label column on Weapon2.`,
    );
  }

  const numericDmb = parseNumber(input.dmb);
  if (input.dmb && numericDmb == null) {
    input.rowWarnings.push(
      `${input.weaponName} ${input.id}: DMB '${input.dmb}' preserved as raw source text.`,
    );
  }

  return {
    id: input.id,
    label: input.label,
    canonicalMeleeMode: input.canonicalMeleeMode ?? null,
    isPrimaryAttack: input.isPrimaryAttack ?? null,
    damageClass,
    ob: parseNumber(input.ob),
    obRaw: input.ob?.trim() ? input.ob : null,
    dmb: numericDmb,
    dmbRaw: input.dmb?.trim() ? input.dmb : null,
    crit: input.crit?.trim() ? input.crit : null,
    secondCrit: input.secondCrit ?? null,
    armorModifier: input.armorModifier?.trim() ? input.armorModifier : null,
    provenance: "imported",
    notes: null,
  };
}

function buildWeaponTemplate(input: {
  row: SourceRow;
  rowNumber: number;
  sheet: "Weapon1" | "Weapon2";
  sourceColumns: Record<string, string>;
}): WeaponTemplate {
  const name = input.row.A.trim();
  const skill = input.row.B.trim();
  const rowWarnings: string[] = [];
  const primaryAttackType = input.sheet === "Weapon1" ? input.row.C?.trim() || null : null;
  const primaryModeFamily = getCanonicalMeleeModeFromAttackLabel(primaryAttackType);
  const secondaryModeFamily =
    input.sheet === "Weapon1"
      ? getCanonicalMeleeModeFromCrit(input.row.N?.trim() || null)
      : null;
  const secondCrit = input.sheet === "Weapon1" ? input.row.Q?.trim() || null : null;

  const mode1 = buildAttackMode({
    armorModifier: input.row[input.sheet === "Weapon1" ? "K" : "H"],
    canonicalMeleeMode:
      input.sheet === "Weapon1"
        ? primaryModeFamily ?? getCanonicalMeleeModeFromCrit(input.row.M?.trim() || null)
        : null,
    crit: input.row[input.sheet === "Weapon1" ? "M" : "I"],
    dmb: input.row[input.sheet === "Weapon1" ? "E" : "D"],
    id: "mode-1",
    isPrimaryAttack: input.sheet === "Weapon1" ? true : null,
    label: input.sheet === "Weapon1" ? input.row.C?.trim() || null : null,
    ob: input.row[input.sheet === "Weapon1" ? "D" : "C"],
    rowWarnings,
    sheet: input.sheet,
    secondCrit,
    weaponName: name,
  });
  const mode2 =
    input.sheet === "Weapon1"
      ? buildAttackMode({
          armorModifier: input.row.L,
          canonicalMeleeMode: secondaryModeFamily,
          crit: input.row.N,
          dmb: input.row.G,
          id: "mode-2",
          isPrimaryAttack: false,
          label: getCanonicalMeleeModeLabel(secondaryModeFamily),
          ob: input.row.F,
          rowWarnings,
          sheet: input.sheet,
          weaponName: name,
        })
      : null;

  const attackModes = [mode1, mode2].filter((mode): mode is WeaponAttackMode => mode != null);

  const range = input.row[input.sheet === "Weapon1" ? "J" : "G"]?.trim() || null;
  const encumbranceRaw = input.row[input.sheet === "Weapon1" ? "O" : "J"]?.trim() || "";
  const baseEncumbrance = parseLeadingNumber(encumbranceRaw) ?? 0;
  if (encumbranceRaw && parseNumber(encumbranceRaw) == null) {
    rowWarnings.push(`${name}: encumbrance '${encumbranceRaw}' reduced to compatibility number ${baseEncumbrance}.`);
  }

  const ammoEncumbranceRaw = input.sheet === "Weapon2" ? input.row.K?.trim() || null : null;
  const ammoEncumbrance =
    ammoEncumbranceRaw && parseNumber(ammoEncumbranceRaw) != null ? parseNumber(ammoEncumbranceRaw) : null;
  if (ammoEncumbranceRaw && ammoEncumbrance == null) {
    rowWarnings.push(`${name}: ammo encumbrance '${ammoEncumbranceRaw}' preserved as raw source text.`);
  }

  const parrySource = input.row[input.sheet === "Weapon1" ? "H" : "E"]?.trim() || "";
  const parry = parrySource.toUpperCase() === "N/A" ? null : parseNumber(parrySource);
  if (parrySource && parrySource.toUpperCase() !== "N/A" && parry == null) {
    rowWarnings.push(`${name}: parry '${parrySource}' could not be parsed as a number.`);
  }

  const secondaryAttackType = mode2 ? mode2.label ?? null : null;
  const handlingClass = deriveHandlingClass({
    name,
    range,
    skill,
    sheet: input.sheet,
  });

  return {
    id: stableWeaponId(name),
    category: "weapon",
    name,
    subtype: deriveWeaponClass({ name, skill }),
    tags: buildTags({
      attackModes,
      handlingClass,
      name,
      range,
      sheet: input.sheet,
      skill,
    }),
    specificityTypeDefault: "generic",
    defaultMaterial: skill.toLowerCase().includes("bow") || name.toLowerCase().includes("staff") || name.toLowerCase().includes("club")
      ? "wood"
      : "steel",
    baseEncumbrance,
    baseValue: null,
    rulesNotes: null,
    roleplayNotes: null,
    weaponClass: deriveWeaponClass({ name, skill }),
    weaponSkill: skill,
    handlingClass,
    attackModes,
    primaryAttackType,
    secondaryAttackType,
    ob1: mode1?.ob ?? null,
    dmb1: mode1?.dmb ?? null,
    ob2: mode2?.ob ?? null,
    dmb2: mode2?.dmb ?? null,
    parry,
    initiative: parseNumber(input.row[input.sheet === "Weapon1" ? "I" : "F"]),
    range,
    armorMod1: mode1?.armorModifier ?? null,
    armorMod2: mode2?.armorModifier ?? null,
    crit1: mode1?.crit ?? null,
    crit2: input.sheet === "Weapon1" ? input.row.N?.trim() || null : null,
    secondCrit,
    defensiveValue: parseNumber(input.row.P),
    ammoEncumbrance,
    ammoEncumbranceRaw,
    sourceMetadata: {
      workbook: THEMISTOGENES_WORKBOOK_NAME,
      sheet: input.sheet,
      row: input.rowNumber,
      sourceRange: `${input.sheet}!A${input.rowNumber}:${input.sheet === "Weapon1" ? "Q" : "K"}${input.rowNumber}`,
      sourceColumns: input.sourceColumns,
      rawRow: input.row,
    },
    importWarnings: rowWarnings.length > 0 ? rowWarnings : null,
    durabilityProfile: null,
  };
}

function shouldSkipWeaponOneRow(row: SourceRow): string | null {
  const name = row.A?.trim() ?? "";
  if (!name) {
    return "blank";
  }
  if (name === "Movement" || name === "Action") {
    return "non-weapon action row";
  }
  if (name.toLowerCase().includes("shield")) {
    return "shield row";
  }
  if (name === "Punch" || name === "Kick" || name === "Garotte") {
    return "brawling row";
  }
  return null;
}

function shouldSkipWeaponTwoRow(row: SourceRow): string | null {
  const name = row.A?.trim() ?? "";
  return name ? null : "blank";
}

export function importThemistogenesWeapons(workbookPath = THEMISTOGENES_WORKBOOK_PATH): ImportedWeaponsResult {
  const sharedStringsXml = readZipEntryUtf8(workbookPath, "xl/sharedStrings.xml");
  const sharedStrings = parseSharedStrings(sharedStringsXml);

  const weaponOneRows = parseWorksheetRows(readZipEntryUtf8(workbookPath, WEAPON_ONE_TARGET), sharedStrings);
  const weaponTwoRows = parseWorksheetRows(readZipEntryUtf8(workbookPath, WEAPON_TWO_TARGET), sharedStrings);

  const templates: WeaponTemplate[] = [];
  const warnings: ImportedWeaponRowWarning[] = [];
  const skippedRows: ImportedWeaponsReport["skippedRows"] = [];

  for (const row of weaponOneRows) {
    if (row.rowNumber === 1) {
      continue;
    }
    const skipReason = shouldSkipWeaponOneRow(row.values);
    if (skipReason) {
      skippedRows.push({
        reason: skipReason,
        row: row.rowNumber,
        sheet: "Weapon1",
        weaponName: row.values.A?.trim() || undefined,
      });
      continue;
    }
    const template = buildWeaponTemplate({
      row: row.values,
      rowNumber: row.rowNumber,
      sheet: "Weapon1",
      sourceColumns: WEAPON_ONE_SOURCE_COLUMNS,
    });
    templates.push(template);
    for (const warning of template.importWarnings ?? []) {
      warnings.push({
        sheet: "Weapon1",
        row: row.rowNumber,
        weaponName: template.name,
        warning,
      });
    }
  }

  for (const row of weaponTwoRows) {
    if (row.rowNumber === 1) {
      continue;
    }
    const skipReason = shouldSkipWeaponTwoRow(row.values);
    if (skipReason) {
      skippedRows.push({
        reason: skipReason,
        row: row.rowNumber,
        sheet: "Weapon2",
      });
      continue;
    }
    const template = buildWeaponTemplate({
      row: row.values,
      rowNumber: row.rowNumber,
      sheet: "Weapon2",
      sourceColumns: WEAPON_TWO_SOURCE_COLUMNS,
    });
    templates.push(template);
    for (const warning of template.importWarnings ?? []) {
      warnings.push({
        sheet: "Weapon2",
        row: row.rowNumber,
        weaponName: template.name,
        warning,
      });
    }
  }

  return {
    templates,
    report: {
      workbook: THEMISTOGENES_WORKBOOK_NAME,
      importedWeaponCount: templates.length,
      skippedRows,
      warnings,
      sourceSheets: [
        {
          headerRow: 1,
          range: "Weapon1!A1:Q48",
          sheet: "Weapon1",
          sourceColumns: WEAPON_ONE_SOURCE_COLUMNS,
        },
        {
          headerRow: 1,
          range: "Weapon2!A1:K30",
          sheet: "Weapon2",
          sourceColumns: WEAPON_TWO_SOURCE_COLUMNS,
        },
      ],
    },
  };
}
