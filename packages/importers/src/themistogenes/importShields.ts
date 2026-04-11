import { execFileSync } from "node:child_process";
import * as path from "node:path";

import type {
  ImportedShieldSourceMetadata,
  ShieldTemplate,
  WeaponAttackMode,
} from "@glantri/domain/equipment";

const THEMISTOGENES_WORKBOOK_PATH = path.resolve(
  __dirname,
  "../../../../data/raw/glantri/Themistogenes 1.07.xlsx",
);
const THEMISTOGENES_WORKBOOK_NAME = "Themistogenes 1.07.xlsx";

const WEAPON_ONE_TARGET = "xl/worksheets/sheet14.xml";
const SHIELDS_TARGET = "xl/worksheets/sheet17.xml";

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

const SHIELDS_SOURCE_COLUMNS = {
  name: "A",
  defensiveValue: "B",
  encumbrance: "C",
  movementModifier: "D",
  offensiveWeaponName: "E",
  parry: "F",
} as const;

type SourceRow = Record<string, string>;

export interface ImportedShieldRowWarning {
  sheet: string;
  row: number;
  shieldName: string;
  warning: string;
}

export interface ImportedShieldsReport {
  workbook: string;
  importedShieldCount: number;
  sourceSheets: Array<{
    headerRow: number;
    range: string;
    sheet: string;
    sourceColumns: Record<string, string>;
  }>;
  warnings: ImportedShieldRowWarning[];
}

export interface ImportedShieldsResult {
  report: ImportedShieldsReport;
  templates: ShieldTemplate[];
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

function stableShieldId(name: string): string {
  return `shield-template-${slugify(name)}`;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!normalized || normalized.toUpperCase() === "N/A" || normalized.toUpperCase() === "VAR") {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeShieldMatchKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\bthyasian\b/g, "tyasian")
    .replace(/\bmetal\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSourceMetadata(input: {
  row: SourceRow;
  rowNumber: number;
  sheet: string;
  sourceColumns: Record<string, string>;
  sourceRangeEnd: string;
}): ImportedShieldSourceMetadata {
  return {
    workbook: THEMISTOGENES_WORKBOOK_NAME,
    sheet: input.sheet,
    row: input.rowNumber,
    sourceRange: `${input.sheet}!A${input.rowNumber}:${input.sourceRangeEnd}${input.rowNumber}`,
    sourceColumns: input.sourceColumns,
    rawRow: input.row,
  };
}

function buildShieldAttackMode(row: SourceRow, rowWarnings: string[], shieldName: string): WeaponAttackMode | null {
  const label = row.C?.trim() || null;
  const ob = parseNumber(row.D);
  const dmb = parseNumber(row.E);
  const crit = row.M?.trim() || null;
  const armorModifierRaw = row.K?.trim() || null;
  const armorModifier =
    armorModifierRaw && armorModifierRaw.toUpperCase() !== "N/A" ? armorModifierRaw : null;

  if (armorModifierRaw?.toUpperCase() === "N/A") {
    rowWarnings.push(`${shieldName}: offensive armor modifier is marked N/A in Weapon1 and stays empty.`);
  }

  return {
    id: "mode-1",
    label,
    canonicalMeleeMode: label?.toLowerCase() === "strike" ? "strike" : null,
    isPrimaryAttack: true,
    damageClass: "blunt",
    ob,
    obRaw: row.D?.trim() || null,
    dmb,
    dmbRaw: row.E?.trim() || null,
    crit,
    secondCrit: row.Q?.trim() || null,
    armorModifier,
    provenance: "imported",
    notes: null,
  };
}

function buildShieldTemplate(input: {
  defensiveRow: SourceRow;
  defensiveRowNumber: number;
  offensiveRow: SourceRow;
  offensiveRowNumber: number;
}): ShieldTemplate {
  const name = input.defensiveRow.A.trim();
  const rowWarnings: string[] = [];
  const attackMode = buildShieldAttackMode(input.offensiveRow, rowWarnings, name);
  const offensiveDefensiveValue = parseNumber(input.offensiveRow.P);
  const defensiveValue = parseNumber(input.defensiveRow.B);
  const parry = parseNumber(input.defensiveRow.F);

  if (
    offensiveDefensiveValue != null &&
    defensiveValue != null &&
    offensiveDefensiveValue !== defensiveValue
  ) {
    rowWarnings.push(
      `${name}: shield tab defensive value ${defensiveValue} overrides offensive shield-row value ${offensiveDefensiveValue}.`,
    );
  }

  const offensiveMatchName = input.defensiveRow.E?.trim() || input.offensiveRow.A.trim();
  const defaultMaterial = name.toLowerCase().includes("metal") ? "steel" : "wood";
  const subtype = slugify(name.replace(/\bshield\b/i, "").trim()) || "shield";

  return {
    id: stableShieldId(name),
    category: "shield",
    name,
    subtype,
    tags: ["shield", "themistogenes-import", defaultMaterial, offensiveMatchName.toLowerCase().includes("large") ? "large" : offensiveMatchName.toLowerCase().includes("medium") ? "medium" : "small"],
    specificityTypeDefault: "generic",
    defaultMaterial,
    baseEncumbrance: parseNumber(input.defensiveRow.C) ?? 0,
    baseValue: null,
    rulesNotes: null,
    roleplayNotes: null,
    weaponSkill: input.offensiveRow.B?.trim() || null,
    handlingClass: "one_handed",
    attackModes: attackMode ? [attackMode] : null,
    primeAttackType: input.offensiveRow.C?.trim() || null,
    primaryAttackType: input.offensiveRow.C?.trim() || null,
    secondaryAttackType: null,
    ob1: attackMode?.ob ?? null,
    dmb1: attackMode?.dmb ?? null,
    ob2: null,
    dmb2: null,
    parry,
    initiative: parseNumber(input.offensiveRow.I),
    range: input.offensiveRow.J?.trim() || null,
    armorMod1: attackMode?.armorModifier ?? null,
    armorMod2: null,
    crit1: attackMode?.crit ?? null,
    crit2: null,
    secondCrit: attackMode?.secondCrit ?? null,
    shieldBonus: defensiveValue,
    defensiveValue,
    movementModifier: parseNumber(input.defensiveRow.D),
    offensiveSourceMetadata: buildSourceMetadata({
      row: input.offensiveRow,
      rowNumber: input.offensiveRowNumber,
      sheet: "Weapon1",
      sourceColumns: WEAPON_ONE_SOURCE_COLUMNS,
      sourceRangeEnd: "Q",
    }),
    defensiveSourceMetadata: buildSourceMetadata({
      row: input.defensiveRow,
      rowNumber: input.defensiveRowNumber,
      sheet: "Shields",
      sourceColumns: SHIELDS_SOURCE_COLUMNS,
      sourceRangeEnd: "F",
    }),
    importWarnings: rowWarnings.length > 0 ? rowWarnings : null,
  };
}

export function importThemistogenesShields(
  workbookPath = THEMISTOGENES_WORKBOOK_PATH,
): ImportedShieldsResult {
  const sharedStringsXml = readZipEntryUtf8(workbookPath, "xl/sharedStrings.xml");
  const sharedStrings = parseSharedStrings(sharedStringsXml);

  const weaponOneRows = parseWorksheetRows(readZipEntryUtf8(workbookPath, WEAPON_ONE_TARGET), sharedStrings);
  const shieldRows = parseWorksheetRows(readZipEntryUtf8(workbookPath, SHIELDS_TARGET), sharedStrings);

  const offensiveRowsByName = new Map<string, { row: SourceRow; rowNumber: number }>();
  for (const row of weaponOneRows) {
    if (row.rowNumber <= 1) {
      continue;
    }

    const name = row.values.A?.trim() || "";
    if (!name.toLowerCase().includes("shield")) {
      continue;
    }

    offensiveRowsByName.set(normalizeShieldMatchKey(name), {
      row: row.values,
      rowNumber: row.rowNumber,
    });
  }

  const templates: ShieldTemplate[] = [];
  const warnings: ImportedShieldRowWarning[] = [];

  for (const row of shieldRows) {
    if (row.rowNumber <= 2) {
      continue;
    }

    const shieldName = row.values.A?.trim() || "";
    if (!shieldName) {
      continue;
    }

    const offensiveName = row.values.E?.trim() || shieldName;
    const offensiveMatch = offensiveRowsByName.get(normalizeShieldMatchKey(offensiveName));

    if (!offensiveMatch) {
      warnings.push({
        sheet: "Shields",
        row: row.rowNumber,
        shieldName,
        warning: `${shieldName}: could not match offensive shield row '${offensiveName}' from Weapon1.`,
      });
      continue;
    }

    const template = buildShieldTemplate({
      defensiveRow: row.values,
      defensiveRowNumber: row.rowNumber,
      offensiveRow: offensiveMatch.row,
      offensiveRowNumber: offensiveMatch.rowNumber,
    });

    templates.push(template);
    for (const warning of template.importWarnings ?? []) {
      warnings.push({
        sheet: "Shields",
        row: row.rowNumber,
        shieldName: template.name,
        warning,
      });
    }
  }

  return {
    templates,
    report: {
      workbook: THEMISTOGENES_WORKBOOK_NAME,
      importedShieldCount: templates.length,
      sourceSheets: [
        {
          headerRow: 1,
          range: "Weapon1!A1:Q48",
          sheet: "Weapon1",
          sourceColumns: WEAPON_ONE_SOURCE_COLUMNS,
        },
        {
          headerRow: 2,
          range: "Shields!A2:F9",
          sheet: "Shields",
          sourceColumns: SHIELDS_SOURCE_COLUMNS,
        },
      ],
      warnings,
    },
  };
}
