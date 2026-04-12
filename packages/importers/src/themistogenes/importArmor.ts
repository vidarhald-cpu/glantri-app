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

function buildLocationValues(row: SourceRow): ArmorLocationValues {
  return Object.fromEntries(
    LOCATION_VALUE_COLUMNS.map(([key, columnKey]) => [key, parseNumber(row[ARMOR_SOURCE_COLUMNS[columnKey]])]),
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
      rowNumbers.map((rowNumber) => [String(rowNumber), input.rowsByNumber[rowNumber] ?? {}]),
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
  row: SourceRow;
  rowNumber: number;
  rowsByNumber: Record<number, SourceRow>;
}): ArmorComponentProfile {
  return {
    name: input.row.A?.trim() || `Armor component ${input.rowNumber}`,
    encumbranceFactor: parseNumber(input.row.B),
    movementFactor: parseNumber(input.row.C),
    generalArmor: parseNumber(input.row.M),
    perceptionModifier: parseNumber(input.row.O),
    locationValues: buildLocationValues(input.row),
    sourceMetadata: {
      workbook: THEMISTOGENES_WORKBOOK_NAME,
      sheet: "Armor",
      finishedRow: input.rowNumber,
      typeRow: null,
      componentRows: null,
      sourceRange: `Armor!A${input.rowNumber}:R${input.rowNumber}`,
      sourceColumns: ARMOR_SOURCE_COLUMNS,
      rawRows: {
        [String(input.rowNumber)]: input.rowsByNumber[input.rowNumber] ?? {},
      },
    },
  };
}

function buildArmorTemplate(input: {
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
  const componentProfiles = input.componentRows.map((rowNumber) =>
    buildComponentProfile({
      row: input.rowsByNumber[rowNumber],
      rowNumber,
      rowsByNumber: input.rowsByNumber,
    }),
  );

  return {
    id: stableArmorId(name),
    category: "armor",
    name,
    subtype,
    tags: inferTags(name, defaultMaterial),
    specificityTypeDefault: "generic",
    defaultMaterial,
    baseEncumbrance: parseNumber(input.finishedRow.B) ?? 0,
    baseValue: null,
    rulesNotes: null,
    roleplayNotes: null,
    armorRating: parseNumber(input.finishedRow.M),
    mobilityPenalty: parseNumber(input.finishedRow.C),
    armorActivityModifier: parseNumber(input.finishedRow.N),
    movementFactor: parseNumber(input.finishedRow.C),
    perceptionModifier: parseNumber(input.finishedRow.O),
    locationValues: buildLocationValues(input.finishedRow),
    locationTypes: buildLocationTypes(typeRow),
    componentProfiles: componentProfiles.length > 0 ? componentProfiles : null,
    sourceMetadata: buildSourceMetadata({
      rowsByNumber: input.rowsByNumber,
      finishedRow: input.finishedRowNumber,
      typeRow: input.typeRowNumber,
      componentRows: input.componentRows,
    }),
    importWarnings: materialWarnings.length > 0 ? materialWarnings : null,
  };
}

export function importThemistogenesArmor(
  workbookPath = THEMISTOGENES_WORKBOOK_PATH,
): ImportedArmorResult {
  const sharedStringsXml = readZipEntryUtf8(workbookPath, "xl/sharedStrings.xml");
  const sharedStrings = parseSharedStrings(sharedStringsXml);
  const rows = parseWorksheetRows(readZipEntryUtf8(workbookPath, ARMOR_TARGET), sharedStrings);
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

      if (previousName) {
        componentRows.push(previousRow);
      }
    }
    componentRows.reverse();

    const typeRowNumber =
      rowsByNumber[row.rowNumber + 1]?.A?.trim().startsWith("Type:")
        ? row.rowNumber + 1
        : null;

    const template = buildArmorTemplate({
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
