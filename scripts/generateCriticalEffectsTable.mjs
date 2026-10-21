#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { format as formatWithPrettier, resolveConfig as resolvePrettierConfig } from "prettier";

import {
  formatCriticalEffectsSummaryDiscrepancies,
  verifyCriticalEffectsSummaryBreakdowns,
} from "./lib/criticalEffectsSummaryVerification.mjs";

const GENERATOR_VERSION = "1.1.0";
const JSON_CHUNK_SIZE = 6000;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE = 0x02014b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAX_ZIP_COMMENT_LENGTH = 0xffff;

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(dirname(SCRIPT_PATH), "..");
const WORKBOOK_PATH = resolve(
  REPO_ROOT,
  "docs/source/combat/Glantri_CriticalEffects_AppFacing_v14.xlsx",
);
const DATA_PATH = resolve(REPO_ROOT, "packages/domain/src/encounter/criticalEffectsTableData.ts");
const MANIFEST_PATH = resolve(
  REPO_ROOT,
  "packages/domain/src/encounter/criticalEffectsTableManifest.json",
);

const CRITICAL_RESULTS_SOURCE = {
  sheet: "AppFacing_Crits",
  range: "A1:X609",
  headerRange: "AppFacing_Crits!A1:X1",
  dataRange: "AppFacing_Crits!A2:X609",
};
const EFFECT_TEMPLATES_SOURCE = {
  sheet: "AppFacing_Effects",
  range: "A1:AE2180",
  headerRange: "AppFacing_Effects!A1:AE1",
  dataRange: "AppFacing_Effects!A2:AE2180",
};
const WORKBOOK_ISSUES_SOURCE = {
  sheet: "AppFacing_Issues",
  range: "A1:D9",
};
const BLEED_REVIEW_SOURCE = {
  sheet: "Review Pass",
  range: "A1:G13",
};
const SUMMARY_SOURCE = {
  sheet: "AppFacing_Summary",
  range: "A1:D40",
};
/**
 * `CritSlots` is the hand-maintained sheet the AppFacing_* sheets were derived from. The generator
 * does not read it for data, but it carries the same `text_display` title strings and can be used
 * to re-derive them, so Forgejo #747 binds the two together: a re-derivation that silently restores
 * a machine-token title fails generation instead of reaching the reader.
 */
const CRIT_SLOTS_SOURCE = {
  sheet: "CritSlots",
  range: "A1:AG609",
};

const RESULT_HEADERS = [
  "crit_key",
  "family",
  "location",
  "crit_index",
  "crit_band",
  "title",
  "body_text",
  "mortality_state",
  "has_balance",
  "has_stun",
  "has_ext_bleed",
  "has_int_bleed",
  "has_loss_of_use",
  "has_special",
  "urgency",
  "treatment_difficulty",
  "treatment_gate_raw",
  "self_staunch_likelihood",
  "self_staunch_window",
  "min_total_damage",
  "min_damage_reason",
  "physical_immediate_only",
  "source_special_tags",
  "source_notes",
];

const EFFECT_HEADERS = [
  "effect_key",
  "crit_key",
  "effect_order",
  "type",
  "group",
  "subtype",
  "target",
  "severity",
  "penalty_pct",
  "action_state",
  "duration_mode",
  "duration_value",
  "duration_unit",
  "duration_roll",
  "end_trigger",
  "duration_raw",
  "rate_mode",
  "rate_value_per_round",
  "rate_roll_formula",
  "rate_raw",
  "urgency",
  "treatment_difficulty",
  "treatment_gate",
  "self_staunch_likelihood",
  "self_staunch_window",
  "min_total_damage",
  "min_damage_reason",
  "special_flag",
  "source_field",
  "source_value",
  "implementation_note",
];

const RESULT_COLUMN_MAPPING = [
  ["A", "crit_key", "critKey", "required text"],
  ["B", "family", "family", "required text"],
  ["C", "location", "location", "required text"],
  ["D", "crit_index", "critIndex", "number"],
  ["E", "crit_band", "critBand", "required text"],
  ["F", "title", "title", "required text"],
  ["G", "body_text", "bodyText", "required text"],
  ["H", "mortality_state", "mortalityState", "required text"],
  ["I", "has_balance", "hasBalance", "yes/no to boolean"],
  ["J", "has_stun", "hasStun", "yes/no to boolean"],
  ["K", "has_ext_bleed", "hasExternalBleed", "yes/no to boolean"],
  ["L", "has_int_bleed", "hasInternalBleed", "yes/no to boolean"],
  ["M", "has_loss_of_use", "hasLossOfUse", "yes/no to boolean"],
  ["N", "has_special", "hasSpecial", "yes/no to boolean"],
  ["O", "urgency", "urgency", "number"],
  ["P", "treatment_difficulty", "treatmentDifficulty", "optional number"],
  ["Q", "treatment_gate_raw", "treatmentGateRaw", "optional text"],
  ["R", "self_staunch_likelihood", "selfStaunchLikelihood", "optional text"],
  ["S", "self_staunch_window", "selfStaunchWindow", "optional text"],
  ["T", "min_total_damage", "minTotalDamage", "number"],
  ["U", "min_damage_reason", "minDamageReason", "required text"],
  ["V", "physical_immediate_only", "physicalImmediateOnly", "yes/no to boolean"],
  ["W", "source_special_tags", "sourceSpecialTags", "semicolon split; order preserved"],
  ["X", "source_notes", "sourceNotes", "optional text"],
].map(([sourceColumn, sourceHeader, outputField, transformation]) => ({
  outputField,
  sourceColumn,
  sourceHeader,
  transformation,
}));

const EFFECT_COLUMN_MAPPING = EFFECT_HEADERS.map((sourceHeader, index) => ({
  outputField: toCamelCase(sourceHeader),
  sourceColumn: columnName(index + 1),
  sourceHeader,
  transformation:
    sourceHeader === "source_value"
      ? "optional value coerced to text; authored token preserved"
      : [
            "effect_order",
            "severity",
            "penalty_pct",
            "duration_value",
            "rate_value_per_round",
            "urgency",
            "treatment_difficulty",
            "min_total_damage",
          ].includes(sourceHeader)
        ? sourceHeader === "effect_order" || sourceHeader === "urgency"
          ? "number"
          : "optional number"
        : [
              "effect_key",
              "crit_key",
              "type",
              "group",
              "subtype",
              "target",
              "duration_mode",
              "rate_mode",
            ].includes(sourceHeader)
          ? "required text"
          : "optional text",
}));

function toCamelCase(value) {
  return value.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

function columnName(index) {
  let value = index;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function columnIndex(reference) {
  const match = /^([A-Z]+)/.exec(reference);
  if (!match) {
    throw new Error(`Invalid cell reference '${reference}'.`);
  }
  let result = 0;
  for (const character of match[1]) {
    result = result * 26 + character.charCodeAt(0) - 64;
  }
  return result;
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function repoPath(path) {
  return relative(REPO_ROOT, path).replaceAll("\\", "/");
}

function decodeXmlText(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, codePoint) =>
      String.fromCodePoint(Number.parseInt(codePoint, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function parseAttributes(fragment) {
  const attributes = {};
  for (const match of fragment.matchAll(/([A-Za-z_:][A-Za-z0-9_.:-]*)="([^"]*)"/g)) {
    attributes[match[1]] = decodeXmlText(match[2]);
  }
  return attributes;
}

function findEndOfCentralDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - MAX_ZIP_COMMENT_LENGTH - 22);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }
  throw new Error("Could not find ZIP end of central directory record.");
}

function findZipEntry(buffer, entryPath) {
  const endOffset = findEndOfCentralDirectory(buffer);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);
  const normalizedEntryPath = entryPath.replaceAll("\\", "/");

  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_FILE_HEADER_SIGNATURE) {
      throw new Error("Invalid ZIP central directory file header.");
    }
    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileName = buffer.toString("utf8", fileNameStart, fileNameStart + fileNameLength);
    if (fileName === normalizedEntryPath) {
      return { compressedSize, compressionMethod, localHeaderOffset };
    }
    offset = fileNameStart + fileNameLength + extraFieldLength + fileCommentLength;
  }
  throw new Error(`Could not find ZIP entry '${entryPath}'.`);
}

function readZipEntryUtf8(buffer, entryPath) {
  const entry = findZipEntry(buffer, entryPath);
  if (buffer.readUInt32LE(entry.localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
    throw new Error(`Invalid ZIP local file header for '${entryPath}'.`);
  }
  const fileNameLength = buffer.readUInt16LE(entry.localHeaderOffset + 26);
  const extraFieldLength = buffer.readUInt16LE(entry.localHeaderOffset + 28);
  const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraFieldLength;
  const compressed = buffer.subarray(dataStart, dataStart + entry.compressedSize);
  if (entry.compressionMethod === 0) {
    return compressed.toString("utf8");
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(compressed).toString("utf8");
  }
  throw new Error(
    `Unsupported ZIP compression method ${entry.compressionMethod} for '${entryPath}'.`,
  );
}

function parseSharedStrings(xml) {
  const values = [];
  for (const match of xml.matchAll(/<(?:[A-Za-z]+:)?si\b[\s\S]*?<\/(?:[A-Za-z]+:)?si>/g)) {
    values.push(
      Array.from(match[0].matchAll(/<(?:[A-Za-z]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?t>/g))
        .map((entry) => decodeXmlText(entry[1]))
        .join(""),
    );
  }
  return values;
}

function parseSheetTargets(workbookXml, relationshipsXml) {
  const relationshipTargets = new Map();
  for (const match of relationshipsXml.matchAll(
    /<Relationship\b([^>]*)\/?>(?:<\/Relationship>)?/g,
  )) {
    const attributes = parseAttributes(match[1]);
    if (attributes.Id && attributes.Target) {
      const target = attributes.Target.replace(/^\/+/, "");
      relationshipTargets.set(attributes.Id, target.startsWith("xl/") ? target : `xl/${target}`);
    }
  }

  const sheetTargets = new Map();
  for (const match of workbookXml.matchAll(
    /<(?:[A-Za-z]+:)?sheet\b([^>]*)\/?>(?:<\/(?:[A-Za-z]+:)?sheet>)?/g,
  )) {
    const attributes = parseAttributes(match[1]);
    const relationshipId = attributes["r:id"];
    const target = relationshipTargets.get(relationshipId);
    if (attributes.name && target) {
      sheetTargets.set(attributes.name, target);
    }
  }
  return sheetTargets;
}

function parseCellValue(cellAttributes, cellBody, sharedStrings) {
  const type = cellAttributes.t;
  if (type === "inlineStr") {
    return Array.from(cellBody.matchAll(/<(?:[A-Za-z]+:)?t\b[^>]*>([\s\S]*?)<\/(?:[A-Za-z]+:)?t>/g))
      .map((entry) => decodeXmlText(entry[1]))
      .join("");
  }
  const valueMatch = /<(?:[A-Za-z]+:)?v>([\s\S]*?)<\/(?:[A-Za-z]+:)?v>/.exec(cellBody);
  if (!valueMatch) {
    return null;
  }
  const raw = decodeXmlText(valueMatch[1]);
  if (type === "s") {
    return sharedStrings[Number(raw)] ?? "";
  }
  if (type === "b") {
    return raw === "1";
  }
  if (type === "str" || type === "e") {
    return raw;
  }
  if (/^-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(raw)) {
    return Number(raw);
  }
  return raw;
}

function parseWorksheet(xml, sharedStrings) {
  const rows = new Map();
  for (const rowMatch of xml.matchAll(
    /<(?:[A-Za-z]+:)?row\b([^>]*)>([\s\S]*?)<\/(?:[A-Za-z]+:)?row>/g,
  )) {
    const rowAttributes = parseAttributes(rowMatch[1]);
    const rowNumber = Number(rowAttributes.r ?? "0");
    const cells = new Map();
    for (const cellMatch of rowMatch[2].matchAll(
      /<(?:[A-Za-z]+:)?c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/(?:[A-Za-z]+:)?c>)/g,
    )) {
      const attributes = parseAttributes(cellMatch[1]);
      if (!attributes.r) {
        continue;
      }
      const body = cellMatch[2] ?? "";
      cells.set(columnIndex(attributes.r), {
        formula: /<(?:[A-Za-z]+:)?f\b/.test(body),
        reference: attributes.r,
        value: parseCellValue(attributes, body, sharedStrings),
      });
    }
    if (rowNumber > 0) {
      rows.set(rowNumber, cells);
    }
  }
  return rows;
}

function loadWorkbook() {
  const buffer = readFileSync(WORKBOOK_PATH);
  const workbookXml = readZipEntryUtf8(buffer, "xl/workbook.xml");
  const relationshipsXml = readZipEntryUtf8(buffer, "xl/_rels/workbook.xml.rels");
  const sharedStrings = parseSharedStrings(readZipEntryUtf8(buffer, "xl/sharedStrings.xml"));
  const targets = parseSheetTargets(workbookXml, relationshipsXml);
  const sheets = new Map();
  for (const sheetName of [
    CRITICAL_RESULTS_SOURCE.sheet,
    EFFECT_TEMPLATES_SOURCE.sheet,
    WORKBOOK_ISSUES_SOURCE.sheet,
    BLEED_REVIEW_SOURCE.sheet,
    SUMMARY_SOURCE.sheet,
    CRIT_SLOTS_SOURCE.sheet,
  ]) {
    const target = targets.get(sheetName);
    if (!target) {
      throw new Error(`Workbook sheet '${sheetName}' was not found.`);
    }
    sheets.set(sheetName, parseWorksheet(readZipEntryUtf8(buffer, target), sharedStrings));
  }
  return { buffer, sheets };
}

function readTable(sheets, source, expectedHeaders) {
  const rows = sheets.get(source.sheet);
  const rangeMatch = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(source.range);
  if (!rows || !rangeMatch) {
    throw new Error(`Invalid source table ${source.sheet}!${source.range}.`);
  }
  const startColumn = columnIndex(rangeMatch[1]);
  const startRow = Number(rangeMatch[2]);
  const endColumn = columnIndex(rangeMatch[3]);
  const endRow = Number(rangeMatch[4]);
  const headerCells = rows.get(startRow) ?? new Map();
  const headers = [];
  for (let column = startColumn; column <= endColumn; column += 1) {
    headers.push(String(headerCells.get(column)?.value ?? ""));
  }
  if (JSON.stringify(headers) !== JSON.stringify(expectedHeaders)) {
    throw new Error(
      `${source.sheet} headers differ from the approved mapping.\nExpected: ${expectedHeaders.join(
        ", ",
      )}\nActual: ${headers.join(", ")}`,
    );
  }

  const records = [];
  for (let rowNumber = startRow + 1; rowNumber <= endRow; rowNumber += 1) {
    const cells = rows.get(rowNumber) ?? new Map();
    const record = { rowNumber, values: {} };
    let hasValue = false;
    for (let column = startColumn; column <= endColumn; column += 1) {
      const cell = cells.get(column);
      if (cell?.formula) {
        throw new Error(
          `${source.sheet}!${cell.reference} contains a formula; maintained generation ranges must contain resolved values only.`,
        );
      }
      const value = cell?.value ?? null;
      record.values[headers[column - startColumn]] = value;
      hasValue ||= value !== null && value !== "";
    }
    if (!hasValue) {
      throw new Error(`${source.sheet} row ${rowNumber} is unexpectedly blank.`);
    }
    records.push(record);
  }
  return records;
}

function text(value, context) {
  if (value === null || value === "") {
    throw new Error(`${context} must contain text.`);
  }
  return String(value);
}

function number(value, context) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && /^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value);
  }
  throw new Error(`${context} must contain a number.`);
}

function yesNo(value, context) {
  if (value === "yes") return true;
  if (value === "no") return false;
  throw new Error(`${context} must contain exactly 'yes' or 'no'.`);
}

function optionalText(value) {
  return value === null || value === "" ? undefined : String(value);
}

function optionalNumber(value, context) {
  return value === null || value === "" ? undefined : number(value, context);
}

function assignOptional(target, key, value) {
  if (value !== undefined) {
    target[key] = value;
  }
}

function buildCriticalResult(record) {
  const value = record.values;
  const context = `${CRITICAL_RESULTS_SOURCE.sheet} row ${record.rowNumber}`;
  const result = {
    critKey: text(value.crit_key, `${context} crit_key`),
    family: text(value.family, `${context} family`),
    location: text(value.location, `${context} location`),
    critIndex: number(value.crit_index, `${context} crit_index`),
    critBand: text(value.crit_band, `${context} crit_band`),
    title: text(value.title, `${context} title`),
    bodyText: text(value.body_text, `${context} body_text`),
    mortalityState: text(value.mortality_state, `${context} mortality_state`),
    hasBalance: yesNo(value.has_balance, `${context} has_balance`),
    hasStun: yesNo(value.has_stun, `${context} has_stun`),
    hasExternalBleed: yesNo(value.has_ext_bleed, `${context} has_ext_bleed`),
    hasInternalBleed: yesNo(value.has_int_bleed, `${context} has_int_bleed`),
    hasLossOfUse: yesNo(value.has_loss_of_use, `${context} has_loss_of_use`),
    hasSpecial: yesNo(value.has_special, `${context} has_special`),
    urgency: number(value.urgency, `${context} urgency`),
    minTotalDamage: number(value.min_total_damage, `${context} min_total_damage`),
    minDamageReason: text(value.min_damage_reason, `${context} min_damage_reason`),
    physicalImmediateOnly: yesNo(
      value.physical_immediate_only,
      `${context} physical_immediate_only`,
    ),
    sourceSpecialTags:
      optionalText(value.source_special_tags)
        ?.split(";")
        .map((tag) => tag.trim())
        .filter(Boolean) ?? [],
  };
  assignOptional(
    result,
    "treatmentDifficulty",
    optionalNumber(value.treatment_difficulty, `${context} treatment_difficulty`),
  );
  assignOptional(result, "treatmentGateRaw", optionalText(value.treatment_gate_raw));
  assignOptional(result, "selfStaunchLikelihood", optionalText(value.self_staunch_likelihood));
  assignOptional(result, "selfStaunchWindow", optionalText(value.self_staunch_window));
  assignOptional(result, "sourceNotes", optionalText(value.source_notes));
  return result;
}

function buildEffectTemplate(record) {
  const value = record.values;
  const context = `${EFFECT_TEMPLATES_SOURCE.sheet} row ${record.rowNumber}`;
  const effect = {
    effectKey: text(value.effect_key, `${context} effect_key`),
    critKey: text(value.crit_key, `${context} crit_key`),
    effectOrder: number(value.effect_order, `${context} effect_order`),
    type: text(value.type, `${context} type`),
    group: text(value.group, `${context} group`),
    subtype: text(value.subtype, `${context} subtype`),
    target: text(value.target, `${context} target`),
    durationMode: text(value.duration_mode, `${context} duration_mode`),
    rateMode: text(value.rate_mode, `${context} rate_mode`),
    urgency: number(value.urgency, `${context} urgency`),
  };
  assignOptional(effect, "severity", optionalNumber(value.severity, `${context} severity`));
  assignOptional(effect, "penaltyPct", optionalNumber(value.penalty_pct, `${context} penalty_pct`));
  assignOptional(
    effect,
    "durationValue",
    optionalNumber(value.duration_value, `${context} duration_value`),
  );
  assignOptional(
    effect,
    "rateValuePerRound",
    optionalNumber(value.rate_value_per_round, `${context} rate_value_per_round`),
  );
  assignOptional(
    effect,
    "treatmentDifficulty",
    optionalNumber(value.treatment_difficulty, `${context} treatment_difficulty`),
  );
  assignOptional(
    effect,
    "minTotalDamage",
    optionalNumber(value.min_total_damage, `${context} min_total_damage`),
  );
  assignOptional(effect, "actionState", optionalText(value.action_state));
  assignOptional(effect, "durationUnit", optionalText(value.duration_unit));
  assignOptional(effect, "durationRoll", optionalText(value.duration_roll));
  assignOptional(effect, "endTrigger", optionalText(value.end_trigger));
  assignOptional(effect, "durationRaw", optionalText(value.duration_raw));
  assignOptional(effect, "rateRollFormula", optionalText(value.rate_roll_formula));
  assignOptional(effect, "rateRaw", optionalText(value.rate_raw));
  assignOptional(effect, "treatmentGate", optionalText(value.treatment_gate));
  assignOptional(effect, "selfStaunchLikelihood", optionalText(value.self_staunch_likelihood));
  assignOptional(effect, "selfStaunchWindow", optionalText(value.self_staunch_window));
  assignOptional(effect, "minDamageReason", optionalText(value.min_damage_reason));
  assignOptional(effect, "specialFlag", optionalText(value.special_flag));
  assignOptional(effect, "sourceField", optionalText(value.source_field));
  assignOptional(effect, "sourceValue", optionalText(value.source_value));
  assignOptional(effect, "implementationNote", optionalText(value.implementation_note));
  return effect;
}

function assertUnique(values, label) {
  const duplicates = [...Map.groupBy(values, (value) => value).entries()]
    .filter(([, occurrences]) => occurrences.length > 1)
    .map(([value]) => value);
  if (duplicates.length > 0) {
    throw new Error(`${label} contains duplicate keys: ${duplicates.join(", ")}`);
  }
}

function assertRepresentativeCase(resultsByKey, effectsByCritKey, expected) {
  const result = resultsByKey.get(expected.critKey);
  const effects = effectsByCritKey.get(expected.critKey) ?? [];
  for (const [field, value] of Object.entries(expected.result)) {
    if (result?.[field] !== value) {
      throw new Error(
        `${expected.critKey} representative ${field} changed: expected ${JSON.stringify(
          value,
        )}, received ${JSON.stringify(result?.[field])}.`,
      );
    }
  }
  const actualEffectKeys = effects.map((effect) => effect.effectKey);
  if (JSON.stringify(actualEffectKeys) !== JSON.stringify(expected.effectKeys)) {
    throw new Error(
      `${expected.critKey} representative effect rows changed: ${actualEffectKeys.join(", ")}.`,
    );
  }
}

function validateTables(results, effects) {
  if (results.length !== 608 || effects.length !== 2179) {
    throw new Error(
      `Approved row counts changed (results ${results.length}/608, effects ${effects.length}/2179).`,
    );
  }
  assertUnique(
    results.map((result) => result.critKey),
    "Critical results",
  );
  assertUnique(
    effects.map((effect) => effect.effectKey),
    "Critical effects",
  );

  const resultsByKey = new Map(results.map((result) => [result.critKey, result]));
  const effectsByCritKey = Map.groupBy(effects, (effect) => effect.critKey);
  for (const result of results) {
    const expectedKey = `${result.family}|${result.location}|${String(result.critIndex).padStart(
      2,
      "0",
    )}`;
    if (result.critKey !== expectedKey || result.critIndex < 1 || result.critIndex > 16) {
      throw new Error(`Critical result key/index invariant failed for '${result.critKey}'.`);
    }
    if (!effectsByCritKey.has(result.critKey)) {
      throw new Error(`Critical result '${result.critKey}' has no effect rows.`);
    }
  }
  for (const effect of effects) {
    if (!resultsByKey.has(effect.critKey)) {
      throw new Error(`Effect '${effect.effectKey}' has no Critical result.`);
    }
    const expectedKey = `${effect.critKey}|${String(effect.effectOrder).padStart(2, "0")}`;
    if (effect.effectKey !== expectedKey) {
      throw new Error(`Effect key/order invariant failed for '${effect.effectKey}'.`);
    }
  }
  for (const [combination, combinationRows] of Map.groupBy(
    results,
    (result) => `${result.family}|${result.location}`,
  )) {
    const indexes = combinationRows.map((row) => row.critIndex).sort((a, b) => a - b);
    if (JSON.stringify(indexes) !== JSON.stringify(Array.from({ length: 16 }, (_, i) => i + 1))) {
      throw new Error(`${combination} does not contain exactly Critical indexes 1 through 16.`);
    }
  }

  const representativeCases = [
    {
      critKey: "sharp|arm|13",
      result: {
        title:
          "Amputation; forearm unusable; no action / unconscious; external bleed 1d4 hp / round",
      },
      effectKeys: Array.from(
        { length: 7 },
        (_, index) => `sharp|arm|13|${String(index + 1).padStart(2, "0")}`,
      ),
    },
    {
      critKey: "blunt|head|16",
      result: { location: "head", mortalityState: "instant_death" },
      effectKeys: ["blunt|head|16|01", "blunt|head|16|02"],
    },
    {
      critKey: "blunt|lower_leg|01",
      result: { location: "lower_leg", title: "Lower-leg bruise; stumble" },
      effectKeys: ["blunt|lower_leg|01|01", "blunt|lower_leg|01|02"],
    },
    {
      critKey: "fire_energy|whole_body|08",
      result: { critIndex: 8, location: "whole_body" },
      effectKeys: Array.from(
        { length: 5 },
        (_, index) => `fire_energy|whole_body|08|${String(index + 1).padStart(2, "0")}`,
      ),
    },
  ];
  for (const representativeCase of representativeCases) {
    assertRepresentativeCase(resultsByKey, effectsByCritKey, representativeCase);
  }

  return representativeCases;
}

/**
 * Pre-existing divergences this guard tolerates, recorded with the exact stale string so that
 * nothing else can hide behind the allowance.
 *
 * Forgejo #741 authored reader-facing titles for 15 `Fatal <family> head critical` placeholder
 * rows in `AppFacing_Crits` but did not carry them into `CritSlots`; that lane is integrated and
 * those identities are outside #747's authorized scope, so #747 records the divergence instead of
 * editing another lane's rows. Each entry passes only while `CritSlots` still holds exactly this
 * string: once the row is synchronized the titles agree and the entry stops applying, and any
 * *other* change to one of these rows fails here like any other divergence.
 */
const TOLERATED_CRIT_SLOTS_TITLE_DIVERGENCES = new Map(
  [
    ["arrows_bolts", "arrows bolts"],
    ["blunt", "blunt"],
    ["firearms", "firearms"],
    ["sharp", "sharp"],
    ["teeth_claws", "teeth claws"],
  ].flatMap(([family, prose]) => [
    [`${family}|head|13`, `Fatal ${prose} head critical; dying within rounds unless saved`],
    [`${family}|head|15`, `Fatal ${prose} head critical`],
    [`${family}|head|16`, `Fatal ${prose} head critical`],
  ]),
);

/**
 * Forgejo #747: `CritSlots` and `AppFacing_Crits` must agree on the title of every Critical
 * identity they share. Title text only — no other column is compared, and nothing is read from
 * `CritSlots` into the generated payload.
 */
function assertCritSlotTitlesMatch(results, critSlotRows) {
  const titleByCritKey = new Map(results.map((result) => [result.critKey, result.title]));
  const mismatches = [];
  const toleratedDivergences = [];
  const comparedKeys = new Set();
  for (const { rowNumber, values } of critSlotRows) {
    const family = values.family;
    const location = values.location;
    const critIndex = values["crit_index(1-16)"];
    if (!family || !location || critIndex === null || critIndex === undefined) continue;
    const index = Number(critIndex);
    if (!Number.isInteger(index)) continue;
    const critKey = `${family}|${location}|${String(index).padStart(2, "0")}`;
    const expected = titleByCritKey.get(critKey);
    if (expected === undefined) continue;
    comparedKeys.add(critKey);
    const actual = values.text_display === null ? "" : String(values.text_display);
    if (actual !== expected) {
      if (TOLERATED_CRIT_SLOTS_TITLE_DIVERGENCES.get(critKey) === actual) {
        toleratedDivergences.push(critKey);
        continue;
      }
      mismatches.push(
        `${CRIT_SLOTS_SOURCE.sheet}!E${rowNumber} ${critKey}: AppFacing_Crits has ${JSON.stringify(
          expected,
        )}, ${CRIT_SLOTS_SOURCE.sheet} has ${JSON.stringify(actual)}`,
      );
    }
  }
  if (comparedKeys.size !== results.length) {
    throw new Error(
      `${CRIT_SLOTS_SOURCE.sheet} title conformance matched ${comparedKeys.size} of ${results.length} Critical identities; the sheets no longer cover the same rows.`,
    );
  }
  if (toleratedDivergences.length > TOLERATED_CRIT_SLOTS_TITLE_DIVERGENCES.size) {
    throw new Error(
      `${CRIT_SLOTS_SOURCE.sheet} title conformance tolerated ${toleratedDivergences.length} divergences, more than the ${TOLERATED_CRIT_SLOTS_TITLE_DIVERGENCES.size} recorded.`,
    );
  }
  if (mismatches.length > 0) {
    throw new Error(
      `${CRIT_SLOTS_SOURCE.sheet} and ${CRITICAL_RESULTS_SOURCE.sheet} disagree on ${mismatches.length} title(s). A re-derivation from ${CRIT_SLOTS_SOURCE.sheet} would reintroduce them:\n- ${mismatches.join("\n- ")}`,
    );
  }
}

function readUnmappedTable(sheets, source) {
  const rows = sheets.get(source.sheet);
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(source.range);
  if (!rows || !match) throw new Error(`Invalid source ${source.sheet}!${source.range}.`);
  const startColumn = columnIndex(match[1]);
  const startRow = Number(match[2]);
  const endColumn = columnIndex(match[3]);
  const endRow = Number(match[4]);
  const headers = [];
  for (let column = startColumn; column <= endColumn; column += 1) {
    headers.push(String(rows.get(startRow)?.get(column)?.value ?? ""));
  }
  return Array.from({ length: endRow - startRow }, (_, index) => {
    const rowNumber = startRow + index + 1;
    const values = {};
    for (let column = startColumn; column <= endColumn; column += 1) {
      values[headers[column - startColumn]] = rows.get(rowNumber)?.get(column)?.value ?? null;
    }
    return { rowNumber, values };
  });
}

function renderChunks(value) {
  const chunks = [];
  for (let offset = 0; offset < value.length; offset += JSON_CHUNK_SIZE) {
    chunks.push(`  ${JSON.stringify(value.slice(offset, offset + JSON_CHUNK_SIZE))},`);
  }
  return chunks.join("\n");
}

function renderDataFile(results, effects) {
  return `import type { CriticalEffectTemplate, CriticalResult } from "./criticalEffectsTable";

export const CRITICAL_EFFECTS_TABLE_SOURCE = {
  workbook: "docs/source/combat/Glantri_CriticalEffects_AppFacing_v14.xlsx",
  criticalResultsRange: "AppFacing_Crits!A1:X609",
  effectTemplatesRange: "AppFacing_Effects!A1:AE2180",
} as const;

const CRITICAL_RESULTS_JSON = [
${renderChunks(JSON.stringify(results))}
].join("");

const CRITICAL_EFFECT_TEMPLATES_JSON = [
${renderChunks(JSON.stringify(effects))}
].join("");

export const CRITICAL_RESULTS = JSON.parse(
  CRITICAL_RESULTS_JSON,
) as readonly CriticalResult[];

export const CRITICAL_EFFECT_TEMPLATES = JSON.parse(
  CRITICAL_EFFECT_TEMPLATES_JSON,
) as readonly CriticalEffectTemplate[];
`;
}

// The generated data file is committed, so it must satisfy the repository formatting gate as
// well as byte-reproducible verification. Rendering and then formatting with the canonical
// repository Prettier configuration makes both true of the same bytes: the committed artefact is
// Prettier-clean, and --verify compares against the identical formatted output. Prettier is
// idempotent, so repeated generation is byte-stable.
async function formatGeneratedDataFile(renderedSource) {
  const repositoryOptions = (await resolvePrettierConfig(DATA_PATH)) ?? {};
  return formatWithPrettier(renderedSource, {
    ...repositoryOptions,
    filepath: DATA_PATH,
    parser: "typescript",
  });
}

function warningEntry(effect, rowNumber, fields) {
  return {
    effectKey: effect.effectKey,
    ...fields,
    sourceCells: fields.durationMode
      ? [
          `${EFFECT_TEMPLATES_SOURCE.sheet}!K${rowNumber}:P${rowNumber}`,
          `${EFFECT_TEMPLATES_SOURCE.sheet}!AC${rowNumber}:AD${rowNumber}`,
        ]
      : [`${EFFECT_TEMPLATES_SOURCE.sheet}!Q${rowNumber}:T${rowNumber}`],
  };
}

function buildManifest(input) {
  const {
    effects,
    effectsRecords,
    issuesRows,
    reviewRows,
    results,
    dataFile,
    representativeCases,
    summaryVerification,
  } = input;
  const unresolvedDurationModes = new Set(["death_timer_special", "special", "stateful_special"]);
  const unresolvedSpecialOrStatefulMappings = effects.flatMap((effect, index) =>
    unresolvedDurationModes.has(effect.durationMode)
      ? [
          warningEntry(effect, effectsRecords[index].rowNumber, {
            durationMode: effect.durationMode,
            durationRaw: effect.durationRaw ?? null,
            sourceField: effect.sourceField ?? null,
            sourceValue: effect.sourceValue ?? null,
          }),
        ]
      : [],
  );
  const fractionalRates = effects.flatMap((effect, index) =>
    typeof effect.rateValuePerRound === "number" && !Number.isInteger(effect.rateValuePerRound)
      ? [
          warningEntry(effect, effectsRecords[index].rowNumber, {
            rateMode: effect.rateMode,
            rateRaw: effect.rateRaw ?? null,
            rateValuePerRound: effect.rateValuePerRound,
            sourceValue: effect.sourceValue ?? null,
          }),
        ]
      : [],
  );
  const rollOnceRateMappings = effects.flatMap((effect, index) =>
    effect.rateMode === "roll_once_per_round_rate"
      ? [
          warningEntry(effect, effectsRecords[index].rowNumber, {
            rateMode: effect.rateMode,
            rateRaw: effect.rateRaw ?? null,
            rateRollFormula: effect.rateRollFormula ?? null,
            sourceValue: effect.sourceValue ?? null,
          }),
        ]
      : [],
  );
  const deathTimerMappings = effects.flatMap((effect, index) =>
    effect.rateMode === "death_timer"
      ? [
          warningEntry(effect, effectsRecords[index].rowNumber, {
            rateMode: effect.rateMode,
            rateRaw: effect.rateRaw ?? null,
            sourceValue: effect.sourceValue ?? null,
          }),
        ]
      : [],
  );
  const workbookWarnings = issuesRows.map(({ rowNumber, values }) => ({
    appFacingHandling: String(values["App-facing handling"] ?? ""),
    count: number(values.Count, `${WORKBOOK_ISSUES_SOURCE.sheet} row ${rowNumber} Count`),
    issue: String(values.Issue ?? ""),
    sourceRange: `${WORKBOOK_ISSUES_SOURCE.sheet}!A${rowNumber}:D${rowNumber}`,
    whyItMatters: String(values["Why it matters"] ?? ""),
  }));
  const bleedReview = reviewRows.find(({ values }) => values.Scope === "Global bleed model");
  if (!bleedReview) {
    throw new Error("Review Pass no longer contains the Global bleed model warning.");
  }

  return {
    manifestVersion: 2,
    generator: {
      path: repoPath(SCRIPT_PATH),
      version: GENERATOR_VERSION,
      generationTimestampPolicy: {
        mode: "omitted-for-byte-stability",
        rationale:
          "The manifest intentionally has no wall-clock timestamp. Git history records publication time while identical workbook input remains byte-stable.",
      },
    },
    source: {
      workbook: repoPath(WORKBOOK_PATH),
      sha256: hash(input.workbookBuffer),
      tables: {
        criticalResults: {
          ...CRITICAL_RESULTS_SOURCE,
          rowCount: results.length,
          columns: RESULT_COLUMN_MAPPING,
        },
        effectTemplates: {
          ...EFFECT_TEMPLATES_SOURCE,
          rowCount: effects.length,
          columns: EFFECT_COLUMN_MAPPING,
        },
      },
      warningRanges: [
        `${WORKBOOK_ISSUES_SOURCE.sheet}!${WORKBOOK_ISSUES_SOURCE.range}`,
        `${BLEED_REVIEW_SOURCE.sheet}!A${bleedReview.rowNumber}:G${bleedReview.rowNumber}`,
      ],
    },
    output: {
      criticalResultsCount: results.length,
      criticalResultsSemanticSha256: hash(JSON.stringify(results)),
      effectTemplatesCount: effects.length,
      effectTemplatesSemanticSha256: hash(JSON.stringify(effects)),
      file: repoPath(DATA_PATH),
      fileSha256: hash(dataFile),
      manifest: repoPath(MANIFEST_PATH),
    },
    transformations: [
      "Rows remain in workbook order and output keys remain in the maintained runtime property order.",
      "Blank optional cells are omitted; required cells fail validation when blank.",
      "Exact yes/no source tokens become booleans; any other token fails validation.",
      "Numeric cells remain numbers. source_value is converted to text so authored numeric and prose tokens retain their established runtime representation.",
      "source_special_tags is split only on semicolons, with tag order preserved.",
      "No bleed unit, duration, dice formula, Special flag, treatment gate, or stateful mapping is inferred or normalized.",
      "Compact semantic JSON is split into deterministic 6,000-code-unit TypeScript string chunks; no generation timestamp is emitted.",
    ],
    validation: {
      complete: summaryVerification.matchesPayload,
      effectKeysUnique: true,
      everyCriticalHasEffects: true,
      everyEffectHasCritical: true,
      formulaCellsInMaintainedRanges: 0,
      representativeCases: representativeCases.map((entry) => entry.critKey),
      resultKeysUnique: true,
      supportedCombinationsContainIndexes1Through16: true,
      workbookSummary: {
        declaredBreakdowns: summaryVerification.declaredBreakdowns,
        discrepancies: summaryVerification.discrepancies,
        matchesPayload: summaryVerification.matchesPayload,
        verifiedAgainstGeneratedPayload: true,
      },
    },
    warnings: {
      summary: {
        deathTimerMappings: deathTimerMappings.length,
        fractionalRatesPreserved: fractionalRates.length,
        rollOnceRateMappings: rollOnceRateMappings.length,
        unresolvedSpecialOrStatefulMappings: unresolvedSpecialOrStatefulMappings.length,
        workbookWarnings: workbookWarnings.length + 1,
      },
      workbookWarnings: [
        ...workbookWarnings,
        {
          appFacingHandling: String(bleedReview.values.Comment ?? ""),
          issue: String(bleedReview.values["Issue identified"] ?? ""),
          sourceRange: `${BLEED_REVIEW_SOURCE.sheet}!A${bleedReview.rowNumber}:G${bleedReview.rowNumber}`,
          scope: "Global bleed model",
          whyItMatters: String(bleedReview.values["Recommended edit"] ?? ""),
        },
      ],
      fractionalRates,
      rollOnceRateMappings,
      deathTimerMappings,
      unresolvedSpecialOrStatefulMappings,
    },
  };
}

function firstDifference(left, right) {
  const limit = Math.min(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) return index;
  }
  return left.length === right.length ? -1 : limit;
}

function differenceContext(left, right, offset) {
  const start = Math.max(0, offset - 120);
  const end = offset + 240;
  return `Existing: ${JSON.stringify(left.slice(start, end))}\nGenerated: ${JSON.stringify(
    right.slice(start, end),
  )}`;
}

function verifyFile(path, expected, label) {
  let actual;
  try {
    actual = readFileSync(path, "utf8");
  } catch {
    throw new Error(`${label} is missing at ${repoPath(path)}.`);
  }
  if (actual !== expected) {
    const offset = firstDifference(actual, expected);
    throw new Error(
      `${label} drift detected at byte/code-unit offset ${offset}. Run the approved generation workflow and review source semantics before accepting any data change.\n${differenceContext(
        actual,
        expected,
        offset,
      )}`,
    );
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const mode = args.has("--generate") ? "generate" : args.has("--verify") ? "verify" : null;
  if (!mode || (args.has("--generate") && args.has("--verify"))) {
    throw new Error(
      "Use exactly one mode: --verify or --generate. Data-changing generation additionally requires --accept-data-change.",
    );
  }
  const workbook = loadWorkbook();
  const resultsRecords = readTable(workbook.sheets, CRITICAL_RESULTS_SOURCE, RESULT_HEADERS);
  const effectsRecords = readTable(workbook.sheets, EFFECT_TEMPLATES_SOURCE, EFFECT_HEADERS);
  const issuesRows = readUnmappedTable(workbook.sheets, WORKBOOK_ISSUES_SOURCE);
  const reviewRows = readUnmappedTable(workbook.sheets, BLEED_REVIEW_SOURCE);
  const summaryRows = readUnmappedTable(workbook.sheets, SUMMARY_SOURCE);
  const results = resultsRecords.map(buildCriticalResult);
  const effects = effectsRecords.map(buildEffectTemplate);
  const representativeCases = validateTables(results, effects);
  assertCritSlotTitlesMatch(results, readUnmappedTable(workbook.sheets, CRIT_SLOTS_SOURCE));
  const summaryVerification = verifyCriticalEffectsSummaryBreakdowns({
    effects,
    results,
    summaryRows,
  });
  const dataFile = await formatGeneratedDataFile(renderDataFile(results, effects));
  const manifest = buildManifest({
    dataFile,
    effects,
    effectsRecords,
    issuesRows,
    representativeCases,
    results,
    reviewRows,
    summaryVerification,
    workbookBuffer: workbook.buffer,
  });
  const manifestFile = await formatWithPrettier(JSON.stringify(manifest), {
    filepath: MANIFEST_PATH,
    parser: "json",
    printWidth: 100,
  });

  if (mode === "verify") {
    verifyFile(DATA_PATH, dataFile, "Generated Critical table data");
    verifyFile(MANIFEST_PATH, manifestFile, "Critical provenance manifest");
    console.log(
      `Critical table verification passed: ${results.length} results, ${effects.length} effects, source ${manifest.source.sha256}.`,
    );
    console.log(
      `Preserved warnings: ${manifest.warnings.summary.fractionalRatesPreserved} fractional rates, ${manifest.warnings.summary.unresolvedSpecialOrStatefulMappings} unresolved special/stateful mappings, ${manifest.warnings.summary.rollOnceRateMappings} roll-once rates, ${manifest.warnings.summary.deathTimerMappings} death timers.`,
    );
    console.log(formatCriticalEffectsSummaryDiscrepancies(summaryVerification));
    return;
  }

  let existingData = null;
  try {
    existingData = readFileSync(DATA_PATH, "utf8");
  } catch {
    // A missing generated file may be created from the approved source.
  }
  if (existingData !== null && existingData !== dataFile && !args.has("--accept-data-change")) {
    const offset = firstDifference(existingData, dataFile);
    throw new Error(
      `Generated Critical data differs at byte/code-unit offset ${offset}. Refusing to change semantics without --accept-data-change and an approved rule/content decision.\n${differenceContext(
        existingData,
        dataFile,
        offset,
      )}`,
    );
  }
  writeFileSync(DATA_PATH, dataFile);
  writeFileSync(MANIFEST_PATH, manifestFile);
  console.log(
    `Generated ${repoPath(DATA_PATH)} and ${repoPath(MANIFEST_PATH)} from source ${manifest.source.sha256}.`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
