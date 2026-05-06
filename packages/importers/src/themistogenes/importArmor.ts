import { execFileSync } from "node:child_process";
import * as path from "node:path";

import type {
  ArmorComponentProfile,
  ArmorLocationTypes,
  ArmorLocationValues,
  ArmorTemplate,
  ImportedArmorSourceMetadata,
  MaterialType,
} from "@glantri/domain/equipment";

const THEMISTOGENES_WORKBOOK_PATH = path.resolve(
  __dirname,
  "../../../../data/raw/glantri/Themistogenes 1.07.xlsx",
);
const THEMISTOGENES_WORKBOOK_NAME = "Themistogenes 1.07.xlsx";
const ARMOR_TARGET = "xl/worksheets/sheet16.xml";
const CRIT_MOD_TARGET = "xl/worksheets/sheet23.xml";

const ARMOR_SOURCE_COLUMNS = {
  name: "A",
  encumbranceFactor: "B",
  movementFactor: "C",
  head: "D",
  frontArm: "E",
  chest: "F",
  backArm: "G",
  abdomen: "H",
  frontThigh: "I",
  frontFoot: "J",
  backThigh: "K",
  backFoot: "L",
  generalArmor: "M",
  armorActivityModifier: "N",
  perceptionModifier: "O",
  dropdown: "R",
} as const;

type SourceRow = Record<string, string>;
type NumericLookup = Map<number, number>;

export interface ImportedArmorRowWarning {
  row: number;
  armorName: string;
  warning: string;
}

export interface ImportedArmorReport {
  workbook: string;
  importedArmorCount: number;
  sourceSheets: Array<{
    headerRow: number;
    range: string;
    sheet: string;
    sourceColumns: Record<string, string>;
  }>;
  warnings: ImportedArmorRowWarning[];
}

export interface ImportedArmorResult {
  report: ImportedArmorReport;
  templates: ArmorTemplate[];
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

function parseWorksheetRows(
  xml: string,
  sharedStrings: string[],
): Array<{ rowNumber: number; values: SourceRow }> {
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

function stableArmorId(name: string): string {
  return `armor-template-${slugify(name)}`;
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

const LOCATION_VALUE_COLUMNS: Array<[keyof ArmorLocationValues, keyof typeof ARMOR_SOURCE_COLUMNS]> = [
  ["head", "head"],
  ["frontArm", "frontArm"],
  ["chest", "chest"],
  ["backArm", "backArm"],
  ["abdomen", "abdomen"],
  ["frontThigh", "frontThigh"],
  ["frontFoot", "frontFoot"],
  ["backThigh", "backThigh"],
  ["backFoot", "backFoot"],
];

const ARMOR_DATA_COLUMNS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "R",
] as const;

function buildLocationValues(row: SourceRow): ArmorLocationValues {
  return Object.fromEntries(
    LOCATION_VALUE_COLUMNS.map(([key, columnKey]) => [key, parseNumber(row[ARMOR_SOURCE_COLUMNS[columnKey]])]),
  ) as ArmorLocationValues;
}

function pickArmorSourceColumns(row: SourceRow): SourceRow {
  return Object.fromEntries(
    ARMOR_DATA_COLUMNS.map((column) => [column, row[column] ?? ""]),
  );
}

function hasArmorWorkbookData(row: SourceRow | undefined): boolean {
  if (!row) {
    return false;
  }

  return ARMOR_DATA_COLUMNS.some((column) => (row[column] ?? "").trim().length > 0);
}

function sumLocationValues(values: Array<ArmorLocationValues | null | undefined>): ArmorLocationValues {
  const entries = LOCATION_VALUE_COLUMNS.map(([key]) => {
    const total = values.reduce((sum, current) => sum + (current?.[key] ?? 0), 0);
    return [key, total];
  });

  return Object.fromEntries(entries) as ArmorLocationValues;
}

function averageLocationValues(values: ArmorLocationValues): number {
  const total = LOCATION_VALUE_COLUMNS.reduce((sum, [key]) => sum + (values[key] ?? 0), 0);
  return total / LOCATION_VALUE_COLUMNS.length;
}

function roundWorkbookGeneralArmor(value: number): number {
  return Math.round(value);
}

function normalizeNumericKey(value: number): number {
  return Number(value.toFixed(9));
}

function buildNumericLookup(rows: Array<{ rowNumber: number; values: SourceRow }>, keyColumn: string, valueColumn: string): NumericLookup {
  const lookup = new Map<number, number>();

  for (const row of rows) {
    const key = parseNumber(row.values[keyColumn]);
    const value = parseNumber(row.values[valueColumn]);

    if (key === null || value === null) {
      continue;
    }

    lookup.set(normalizeNumericKey(key), value);
  }

  return lookup;
}

function lookupNumericValue(lookup: NumericLookup, value: number): number | null {
  return lookup.get(normalizeNumericKey(value)) ?? null;
}

function buildCriticalModifierByArea(values: ArmorLocationValues, lookup: NumericLookup): ArmorLocationValues {
  return Object.fromEntries(
    LOCATION_VALUE_COLUMNS.map(([key]) => [key, lookupNumericValue(lookup, values[key] ?? 0)]),
  ) as ArmorLocationValues;
}

function buildLocationTypes(row: SourceRow | null): ArmorLocationTypes | null {
  if (!row) {
    return null;
  }

  const result = Object.fromEntries(
    LOCATION_VALUE_COLUMNS.map(([key, columnKey]) => [key, row[ARMOR_SOURCE_COLUMNS[columnKey]]?.trim() || null]),
  ) as ArmorLocationTypes;
  result.generalArmor = row.M?.trim() || null;
  return result;
}

function buildSourceMetadata(input: {
  rowsByNumber: Record<number, SourceRow>;
  finishedRow: number;
  typeRow: number | null;
  componentRows: number[];
}): ImportedArmorSourceMetadata {
  const startRow = input.componentRows[0] ?? input.finishedRow;
  const endRow = input.typeRow ?? input.finishedRow;
  const rowNumbers = [input.finishedRow, ...(input.typeRow ? [input.typeRow] : []), ...input.componentRows]
    .sort((left, right) => left - right);

  return {
    workbook: THEMISTOGENES_WORKBOOK_NAME,
    sheet: "Armor",
    finishedRow: input.finishedRow,
    typeRow: input.typeRow,
    componentRows: input.componentRows.length > 0 ? input.componentRows : null,
    sourceRange: `Armor!A${startRow}:R${endRow}`,
    sourceColumns: ARMOR_SOURCE_COLUMNS,
    rawRows: Object.fromEntries(
      rowNumbers.map((rowNumber) => [String(rowNumber), pickArmorSourceColumns(input.rowsByNumber[rowNumber] ?? {})]),
    ),
  };
}

function inferMaterial(name: string): { defaultMaterial: MaterialType; warnings: string[] } {
  if (name === "Leather/Cloth") {
    return {
      defaultMaterial: "other",
      warnings: ["Leather/Cloth: workbook name spans more than one material family, so default material stays 'other'."],
    };
  }

  if (/Leather|Studded/i.test(name)) {
    return { defaultMaterial: "leather", warnings: [] };
  }

  if (/Cloth|Cloak/i.test(name)) {
    return { defaultMaterial: "cloth", warnings: [] };
  }

  if (/Mail|Plate|Breastplate|Helmet|Thyasian|Legionnaire|Officer/i.test(name)) {
    return { defaultMaterial: "steel", warnings: [] };
  }

  return {
    defaultMaterial: "other",
    warnings: [`${name}: no explicit workbook material column was found, so default material stays 'other'.`],
  };
}

function inferTags(name: string, defaultMaterial: MaterialType): string[] {
  const tags = ["armor", "themistogenes-import", defaultMaterial];
  const normalized = name.toLowerCase();

  if (/jerkin|cloak|shirt|coat|armor/.test(normalized)) {
    tags.push("set");
  }

  if (/mail/.test(normalized)) {
    tags.push("mail");
  }

  if (/scale/.test(normalized)) {
    tags.push("scale");
  }

  if (/plate|breastplate/.test(normalized)) {
    tags.push("plate");
  }

  if (/leather|studded/.test(normalized)) {
    tags.push("leather");
  }

  if (/cloth|cloak/.test(normalized)) {
    tags.push("cloth");
  }

  return Array.from(new Set(tags));
}

function buildComponentProfile(input: {
  armorCritModifierLookup: NumericLookup;
  row: SourceRow;
  rowNumber: number;
  rowsByNumber: Record<number, SourceRow>;
  warnings: string[];
}): ArmorComponentProfile {
  const locationValues = buildLocationValues(input.row);
  const generalArmor = parseNumber(input.row.M);
  const name = input.row.A?.trim();

  if (!name) {
    input.warnings.push(
      `Armor row ${input.rowNumber}: workbook component row has no label, so it is preserved as an unnamed component row.`,
    );
  }

  return {
    name: name || `Unnamed component (row ${input.rowNumber})`,
    encumbranceFactor: parseNumber(input.row.B),
    movementFactor: parseNumber(input.row.C),
    generalArmor,
    generalArmorRounded: generalArmor === null ? null : roundWorkbookGeneralArmor(generalArmor),
    armorActivityModifier: parseNumber(input.row.N),
    perceptionModifier: parseNumber(input.row.O),
    locationValues,
    criticalModifierByArea: buildCriticalModifierByArea(locationValues, input.armorCritModifierLookup),
    criticalModifierGeneral:
      generalArmor === null
        ? null
        : lookupNumericValue(input.armorCritModifierLookup, roundWorkbookGeneralArmor(generalArmor)),
    sourceMetadata: {
      workbook: THEMISTOGENES_WORKBOOK_NAME,
      sheet: "Armor",
      finishedRow: input.rowNumber,
      typeRow: null,
      componentRows: null,
      sourceRange: `Armor!A${input.rowNumber}:R${input.rowNumber}`,
      sourceColumns: ARMOR_SOURCE_COLUMNS,
      rawRows: {
        [String(input.rowNumber)]: pickArmorSourceColumns(input.rowsByNumber[input.rowNumber] ?? {}),
      },
    },
  };
}

function buildArmorTemplate(input: {
  armorCritModifierLookup: NumericLookup;
  componentRows: number[];
  finishedRow: SourceRow;
  finishedRowNumber: number;
  rowsByNumber: Record<number, SourceRow>;
  typeRowNumber: number | null;
}): ArmorTemplate {
  const name = input.finishedRow.A.trim();
  const { defaultMaterial, warnings: materialWarnings } = inferMaterial(name);
  const subtype = slugify(name);
  const typeRow = input.typeRowNumber ? input.rowsByNumber[input.typeRowNumber] ?? null : null;
  const warnings = [...materialWarnings];
  const componentProfiles = input.componentRows.map((rowNumber) =>
    buildComponentProfile({
      armorCritModifierLookup: input.armorCritModifierLookup,
      row: input.rowsByNumber[rowNumber],
      rowNumber,
      rowsByNumber: input.rowsByNumber,
      warnings,
    }),
  );
  const derivedLocationValues =
    componentProfiles.length > 0
      ? sumLocationValues(componentProfiles.map((profile) => profile.locationValues))
      : buildLocationValues(input.finishedRow);
  const finishedLocationValues = buildLocationValues(input.finishedRow);
  const generalArmorRaw = averageLocationValues(derivedLocationValues);
  const generalArmorRounded = roundWorkbookGeneralArmor(generalArmorRaw);
  const workbookArmorRating = parseNumber(input.finishedRow.M);
  const derivedEncumbranceFactor =
    componentProfiles.length > 0
      ? componentProfiles.reduce((sum, profile) => sum + (profile.encumbranceFactor ?? 0), 0)
      : parseNumber(input.finishedRow.B);

  for (const [key] of LOCATION_VALUE_COLUMNS) {
    const derivedValue = derivedLocationValues[key] ?? 0;
    const workbookValue = finishedLocationValues[key] ?? 0;

    if (Math.abs(derivedValue - workbookValue) > 1e-9) {
      warnings.push(
        `${name}: derived ${String(key)} protection ${derivedValue} does not match workbook row value ${workbookValue}.`,
      );
    }
  }

  if (workbookArmorRating !== null && Math.abs(workbookArmorRating - generalArmorRaw) > 1e-9) {
    warnings.push(
      `${name}: derived general armor ${generalArmorRaw} does not match workbook row value ${workbookArmorRating}.`,
    );
  }

  const workbookEncumbranceFactor = parseNumber(input.finishedRow.B);
  if (
    derivedEncumbranceFactor !== null
    && workbookEncumbranceFactor !== null
    && Math.abs(derivedEncumbranceFactor - workbookEncumbranceFactor) > 1e-9
  ) {
    warnings.push(
      `${name}: derived encumbrance factor ${derivedEncumbranceFactor} does not match workbook row value ${workbookEncumbranceFactor}.`,
    );
  }

  return {
    id: stableArmorId(name),
    category: "armor",
    name,
    subtype,
    tags: inferTags(name, defaultMaterial),
    specificityTypeDefault: "generic",
    defaultMaterial,
    baseEncumbrance: derivedEncumbranceFactor ?? 0,
    encumbranceFactor: derivedEncumbranceFactor,
    baseValue: null,
    rulesNotes: null,
    roleplayNotes: null,
    armorRating: generalArmorRaw,
    generalArmorRounded,
    mobilityPenalty: parseNumber(input.finishedRow.C),
    armorActivityModifier: parseNumber(input.finishedRow.N),
    movementFactor: parseNumber(input.finishedRow.C),
    perceptionModifier: parseNumber(input.finishedRow.O),
    locationValues: derivedLocationValues,
    locationTypes: buildLocationTypes(typeRow),
    criticalModifierByArea: buildCriticalModifierByArea(derivedLocationValues, input.armorCritModifierLookup),
    criticalModifierGeneral: lookupNumericValue(input.armorCritModifierLookup, generalArmorRounded),
    componentProfiles: componentProfiles.length > 0 ? componentProfiles : null,
    sourceMetadata: buildSourceMetadata({
      rowsByNumber: input.rowsByNumber,
      finishedRow: input.finishedRowNumber,
      typeRow: input.typeRowNumber,
      componentRows: input.componentRows,
    }),
    importWarnings: warnings.length > 0 ? warnings : null,
  };
}

export function importThemistogenesArmor(
  workbookPath = THEMISTOGENES_WORKBOOK_PATH,
): ImportedArmorResult {
  const sharedStringsXml = readZipEntryUtf8(workbookPath, "xl/sharedStrings.xml");
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = parseWorksheetRows(readZipEntryUtf8(workbookPath, ARMOR_TARGET), sharedStrings);
  const critModifierRows = parseWorksheetRows(readZipEntryUtf8(workbookPath, CRIT_MOD_TARGET), sharedStrings);
  const armorCritModifierLookup = buildNumericLookup(critModifierRows, "A", "B");
  const rowsByNumber = Object.fromEntries(rows.map((row) => [row.rowNumber, row.values]));

  const templates: ArmorTemplate[] = [];
  const warnings: ImportedArmorRowWarning[] = [];

  for (const row of rows) {
    if (row.rowNumber <= 1) {
      continue;
    }

    const name = row.values.A?.trim() || "";
    const dropdownName = row.values.R?.trim() || "";

    if (!name || !dropdownName) {
      continue;
    }

    const componentRows: number[] = [];
    for (let previousRow = row.rowNumber - 1; previousRow > 1; previousRow -= 1) {
      const previous = rowsByNumber[previousRow];
      const previousName = previous?.A?.trim() || "";
      const previousDropdown = previous?.R?.trim() || "";

      if (!previous) {
        continue;
      }

      if (previousName.startsWith("Type:") || previousDropdown) {
        break;
      }

      if (hasArmorWorkbookData(previous)) {
        componentRows.push(previousRow);
      }
    }
    componentRows.reverse();

    const typeRowNumber =
      rowsByNumber[row.rowNumber + 1]?.A?.trim().startsWith("Type:")
        ? row.rowNumber + 1
        : null;

    const template = buildArmorTemplate({
      armorCritModifierLookup,
      componentRows,
      finishedRow: row.values,
      finishedRowNumber: row.rowNumber,
      rowsByNumber,
      typeRowNumber,
    });

    templates.push(template);
    for (const warning of template.importWarnings ?? []) {
      warnings.push({
        row: row.rowNumber,
        armorName: template.name,
        warning,
      });
    }
  }

  return {
    templates,
    report: {
      workbook: THEMISTOGENES_WORKBOOK_NAME,
      importedArmorCount: templates.length,
      sourceSheets: [
        {
          headerRow: 1,
          range: "Armor!A1:R117",
          sheet: "Armor",
          sourceColumns: ARMOR_SOURCE_COLUMNS,
        },
      ],
      warnings,
    },
  };
}
