#!/usr/bin/env node
/**
 * Generates `docs/rules/critical-table.md`, the reader-facing Critical Table, from the authoritative
 * Critical data the application itself uses.
 *
 * There is exactly one Critical catalogue in this repository. This script does not hold a copy of
 * it: every row identity and every structured value below is read at generation time from
 * `packages/domain/src/encounter/criticalEffectsTableData.ts` — `CRITICAL_RESULTS` for the results
 * and `CRITICAL_EFFECT_TEMPLATES` for their effects, joined on the authoritative row key. The only
 * authored inputs are presentation labels and the source-note publication decisions in
 * `scripts/data/criticalTableSourceNoteClassification.json`, and both are keyed to values that must
 * exist in the live data or generation fails.
 *
 * Usage, mirroring `scripts/generateCriticalEffectsTable.mjs`:
 *
 * - `--generate` rewrites the document.
 * - `--verify` rebuilds it in memory and fails on any byte of drift, so a data change that is not
 *   regenerated cannot pass the gates.
 *
 * Why generation never happens at image-build time: the published document must be committed. The
 * `apps/web/Dockerfile` builder stage copies `packages/` and `apps/web/` but not `docs/`, so the
 * runtime `COPY docs/rules ./docs/rules` can only ship what the repository already contains.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { format as formatWithPrettier } from "prettier";

import * as criticalEffectsTableData from "../packages/domain/src/encounter/criticalEffectsTableData.ts";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUTPUT_PATH = resolve(repositoryRoot, "docs/rules/critical-table.md");
const CLASSIFICATION_PATH = resolve(
  repositoryRoot,
  "scripts/data/criticalTableSourceNoteClassification.json",
);

/* tsx exposes this module through its CommonJS interop, so reach the namespace either way. */
const { CRITICAL_RESULTS, CRITICAL_EFFECT_TEMPLATES } =
  criticalEffectsTableData.default ?? criticalEffectsTableData;

function fail(message) {
  console.error(`Critical Table generation failed: ${message}`);
  process.exit(1);
}

/**
 * Reader labels for the coded values.
 *
 * Every map is total over the live data: `label()` fails on a value it has never seen rather than
 * inventing a reader-facing name or silently passing an internal code through to the page. A new
 * family, location, band, mortality state or staunch likelihood therefore stops generation and asks
 * for an editorial decision, which is the intended failure.
 */
export const FAMILY_LABELS = {
  arrows_bolts: "Arrows and bolts",
  blunt: "Blunt",
  falling_crushing: "Falling and crushing",
  fire_energy: "Fire and energy",
  firearms: "Firearms",
  pointed_weapons: "Pointed weapons",
  sharp: "Sharp",
  teeth_claws: "Teeth and claws",
};

export const LOCATION_LABELS = {
  head: "Head",
  chest: "Chest",
  abdomen: "Abdomen",
  arm: "Arm",
  upper_leg: "Upper leg",
  lower_leg: "Lower leg",
  whole_body: "Whole body",
};

/** Reader order for locations, head downwards, with whole-body results last. */
const LOCATION_ORDER = ["head", "chest", "abdomen", "arm", "upper_leg", "lower_leg", "whole_body"];

const BAND_LABELS = {
  minor: "Minor",
  moderate: "Moderate",
  serious: "Serious",
  severe: "Severe",
  catastrophic: "Catastrophic",
  fatal: "Fatal",
};

const MORTALITY_LABELS = {
  none: "",
  dying: "Dying",
  mortally_wounded: "Mortally wounded",
  rapidly_dying: "Rapidly dying",
  death_countdown: "Death countdown",
  instant_death: "Instant death",
};

const STAUNCH_LIKELIHOOD_LABELS = {
  none: "None",
  low: "Low",
  moderate: "Moderate",
  high: "High",
};

/** The condition flags, in the order a reader reads them off a row. */
const CONDITION_FLAGS = [
  ["hasStun", "Stun"],
  ["hasBalance", "Balance"],
  ["hasExternalBleed", "External bleed"],
  ["hasInternalBleed", "Internal bleed"],
  ["hasLossOfUse", "Loss of use"],
  ["hasSpecial", "Special"],
];

const EMPTY_CELL = "-";

function label(map, value, what) {
  const resolved = map[value];

  if (resolved === undefined) {
    fail(`${what} "${value}" has no reader label; add one deliberately before publishing it.`);
  }

  return resolved;
}

/** An effect target such as `general_action` reads as ordinary words, not as its code. */
function formatTarget(target) {
  return typeof target === "string" && target.length > 0 ? target.replace(/_/g, " ") : "";
}

function escapeCell(value) {
  return String(value).replace(/\|/g, "\\|");
}

/**
 * The reader renderer's heading-`id` contract, reimplemented so the contents links this script
 * emits are the ids the page will actually carry. `MarkdownRenderer.tsx` owns the contract;
 * `criticalTable.test.ts` asserts the two agree on every heading in the generated document, so a
 * change there fails rather than quietly producing contents links that lead nowhere.
 */
function slugifyHeadingText(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_ -]+/gu, "")
    .trim()
    .replace(/ /g, "-");
}

function loadNoteClassification() {
  const classification = JSON.parse(readFileSync(CLASSIFICATION_PATH, "utf8"));
  const liveFragments = new Set();

  for (const result of CRITICAL_RESULTS) {
    for (const fragment of splitSourceNotes(result)) {
      liveFragments.add(fragment);
    }
  }

  const unclassified = [...liveFragments].filter((fragment) => !(fragment in classification));
  const orphaned = Object.keys(classification).filter((fragment) => !liveFragments.has(fragment));

  /*
   * Both directions are fatal on purpose. An unclassified fragment would silently withhold material
   * that may be play-facing; an orphaned decision means the data moved under a decision that was
   * made against text no longer present, and the decision must be re-made rather than carried.
   */
  if (unclassified.length > 0) {
    fail(
      `${unclassified.length} source-note fragment(s) carry no publication decision. Classify each, then regenerate:\n${unclassified
        .map((fragment) => `  - ${JSON.stringify(fragment)}`)
        .join("\n")}`,
    );
  }

  if (orphaned.length > 0) {
    fail(
      `${orphaned.length} publication decision(s) no longer match any source note in the authoritative data:\n${orphaned
        .map((fragment) => `  - ${JSON.stringify(fragment)}`)
        .join("\n")}`,
    );
  }

  for (const [fragment, decision] of Object.entries(classification)) {
    if (!["play-facing", "gm-note", "provenance", "ambiguous"].includes(decision)) {
      fail(`Source-note fragment ${JSON.stringify(fragment)} has unknown decision "${decision}".`);
    }
  }

  return classification;
}

/** The authored notes on one result, split into the fragments the source joins with `|`. */
function splitSourceNotes(result) {
  if (typeof result.sourceNotes !== "string") {
    return [];
  }

  return result.sourceNotes
    .split("|")
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length > 0);
}

/**
 * The authored notes published for one result under a given decision.
 *
 * This is a projection, never an edit: the complete `sourceNotes` string stays exactly as it is in
 * the authoritative data, and only the fragments carrying the requested decision reach the page, in
 * the authoritative order and with their authored wording untouched. Designer rationale and any
 * fragment still awaiting an editorial decision are withheld.
 *
 * Two decisions are published, into two different columns, and the split is the point:
 *
 * - `play-facing` are defined effects, and go to **Additional effects** beside the structured
 *   columns.
 * - `gm-note` are contextual guidance that may affect adjudication rather than a defined effect,
 *   and go to **GM notes**. Their qualified wording — "may", "can", "possible" — is authored
 *   hedging that carries the meaning, so it is never tightened into a guaranteed consequence and
 *   never promoted into a structured column.
 */
function publishedNotes(result, classification, decision) {
  const published = splitSourceNotes(result).filter(
    (fragment) => classification[fragment] === decision,
  );

  /* De-duplicated in first-seen order: some results join two notes that say the same thing. */
  return [...new Set(published)];
}

function formatDamageFloor(result) {
  const reason =
    typeof result.minDamageReason === "string" && result.minDamageReason.length > 0
      ? ` (${result.minDamageReason})`
      : "";

  return `${result.minTotalDamage}${reason}`;
}

function formatConditions(result) {
  const present = CONDITION_FLAGS.filter(([key]) => result[key] === true).map(([, name]) => name);

  return present.length > 0 ? present.join(", ") : EMPTY_CELL;
}

function formatTreatment(result) {
  const parts = [];

  if (typeof result.treatmentDifficulty === "number") {
    parts.push(`Difficulty ${result.treatmentDifficulty}`);
  }

  if (typeof result.treatmentGateRaw === "string" && result.treatmentGateRaw.length > 0) {
    parts.push(result.treatmentGateRaw);
  }

  return parts.length > 0 ? parts.join("; ") : EMPTY_CELL;
}

function formatSelfStaunch(result) {
  const likelihood =
    typeof result.selfStaunchLikelihood === "string"
      ? label(STAUNCH_LIKELIHOOD_LABELS, result.selfStaunchLikelihood, "Self-staunch likelihood")
      : "";
  const window =
    typeof result.selfStaunchWindow === "string" && result.selfStaunchWindow.length > 0
      ? result.selfStaunchWindow
      : "";

  if (likelihood === "" && window === "") {
    return EMPTY_CELL;
  }

  if (likelihood !== "" && window !== "") {
    return `${likelihood} (${window})`;
  }

  return likelihood !== "" ? likelihood : window;
}

/**
 * One result's effects, read from the authoritative templates joined on the result's own row key.
 *
 * Scoped to what a reader applies at the table — what kind of effect it is, what it affects, the
 * penalty, and how long it lasts. The templates' encoded and maintenance fields stay out.
 */
function formatEffects(result, templatesByKey) {
  const effects = templatesByKey.get(result.critKey) ?? [];

  if (effects.length === 0) {
    return EMPTY_CELL;
  }

  const lines = effects.map((effect) => {
    const target = formatTarget(effect.target);
    const parts = [target === "" ? effect.type : `${effect.type} (${target})`];

    if (typeof effect.penaltyPct === "number") {
      parts.push(String(effect.penaltyPct));
    }

    if (typeof effect.durationRaw === "string" && effect.durationRaw.length > 0) {
      parts.push(effect.durationRaw);
    }

    return parts.join(", ");
  });

  /*
   * Measured on this data: 166 of the 608 results carry two or more effects whose published form is
   * byte-identical because the only field that distinguishes them is the per-effect special flag —
   * `rapidly_dying` against `heart_shot` on `arrows_bolts|chest|16`, for instance. That flag is the
   * per-effect form of the source special tags, which may not be an ordinary column, so publishing
   * it is not available as a way to tell the lines apart. Repeating an identical sentence would
   * therefore show a reader noise carrying no information they can act on. The effects themselves
   * are untouched in the authoritative data; only the repeated projection is collapsed.
   */
  return [...new Set(lines)].join("; ");
}

const TABLE_HEADERS = [
  "Result",
  "Severity",
  "Result title",
  "What happens",
  "Damage floor",
  "Mortality",
  "Urgency",
  "Conditions",
  "Effects",
  "Treatment",
  "Self-staunch",
  "Additional effects",
  "GM notes",
];

function buildRow(result, templatesByKey, classification) {
  const mortality = label(MORTALITY_LABELS, result.mortalityState, "Mortality state");
  const additional = publishedNotes(result, classification, "play-facing");
  const gmNotes = publishedNotes(result, classification, "gm-note");

  return [
    String(result.critIndex),
    label(BAND_LABELS, result.critBand, "Critical band"),
    result.title,
    result.bodyText,
    formatDamageFloor(result),
    mortality === "" ? EMPTY_CELL : mortality,
    String(result.urgency),
    formatConditions(result),
    formatEffects(result, templatesByKey),
    formatTreatment(result),
    formatSelfStaunch(result),
    additional.length > 0 ? additional.join("; ") : EMPTY_CELL,
    gmNotes.length > 0 ? gmNotes.join(" ") : EMPTY_CELL,
  ].map(escapeCell);
}

function buildDocument() {
  const classification = loadNoteClassification();

  const templatesByKey = new Map();
  for (const effect of CRITICAL_EFFECT_TEMPLATES) {
    if (!templatesByKey.has(effect.critKey)) {
      templatesByKey.set(effect.critKey, []);
    }
    templatesByKey.get(effect.critKey).push(effect);
  }
  for (const effects of templatesByKey.values()) {
    effects.sort((left, right) => left.effectOrder - right.effectOrder);
  }

  /* Group by the authoritative game dimensions, and let an unlabelled value stop generation. */
  const families = [...new Set(CRITICAL_RESULTS.map((result) => result.family))].sort((a, b) =>
    label(FAMILY_LABELS, a, "Critical family").localeCompare(
      label(FAMILY_LABELS, b, "Critical family"),
    ),
  );

  const sections = [];
  for (const family of families) {
    const familyResults = CRITICAL_RESULTS.filter((result) => result.family === family);
    const locations = [...new Set(familyResults.map((result) => result.location))];

    for (const location of locations) {
      label(LOCATION_LABELS, location, "Critical location");

      if (!LOCATION_ORDER.includes(location)) {
        fail(`Critical location "${location}" has no reader order; place it deliberately.`);
      }
    }

    locations.sort((a, b) => LOCATION_ORDER.indexOf(a) - LOCATION_ORDER.indexOf(b));

    for (const location of locations) {
      sections.push({
        family,
        heading: `${label(FAMILY_LABELS, family, "Critical family")} - ${label(LOCATION_LABELS, location, "Critical location")}`,
        location,
        results: familyResults
          .filter((result) => result.location === location)
          .slice()
          .sort((left, right) => left.critIndex - right.critIndex),
      });
    }
  }

  const lines = [];
  lines.push("# Critical Table");
  lines.push("");
  lines.push(
    "Every Critical result the application currently holds, grouped by attack family and hit",
  );
  lines.push(
    "location. Find the family and location you need, then read down to the result number.",
  );
  lines.push("");
  /*
   * Product-Owner-authored boundary sentence, carried verbatim. It is the only statement this page
   * makes about how much of a result the application resolves for itself, and it is not reworded,
   * extended, or explained alongside.
   */
  lines.push(
    "This table contains the current Critical results. Some results are handled fully by the app, while others still require the GM to apply or resolve parts of the result during play.",
  );
  lines.push("");
  lines.push("## How to read a row");
  lines.push("");
  lines.push(
    `- **Result** is the result number within the family and location, from ${Math.min(...CRITICAL_RESULTS.map((result) => result.critIndex))} to ${Math.max(...CRITICAL_RESULTS.map((result) => result.critIndex))}.`,
  );
  lines.push("- **Severity** is the band the result falls in, from Minor to Fatal.");
  lines.push("- **What happens** is the result as it is read out at the table.");
  lines.push(
    "- **Damage floor** is the least total damage the result causes, with the reason for that floor.",
  );
  lines.push(
    "- **Mortality** and **Urgency** describe how the injury progresses if it is left alone; a higher urgency is more pressing.",
  );
  lines.push(
    "- **Conditions** lists the conditions the result applies: Stun, Balance, External bleed, Internal bleed, Loss of use, Special.",
  );
  lines.push(
    "- **Effects** lists each effect as its kind, what it affects, its penalty, and how long it lasts.",
  );
  lines.push(
    "- **Treatment** is how hard the injury is to treat and what treatment it needs. **Self-staunch** is whether bleeding may stop on its own, and within what window.",
  );
  lines.push(
    "- **Additional effects** carries further consequences recorded for the result beyond the columns above.",
  );
  lines.push(
    "- **GM notes** carries contextual guidance recorded for the result. It is not a defined effect: it describes what a GM may need to weigh when adjudicating this Critical, in the wording the result itself uses.",
  );
  lines.push("");
  lines.push("## Families and locations");
  lines.push("");
  for (const section of sections) {
    lines.push(`- [${section.heading}](#${slugifyHeadingText(section.heading)})`);
  }
  lines.push("");

  let currentFamily;
  for (const section of sections) {
    if (section.family !== currentFamily) {
      currentFamily = section.family;
      lines.push(`## ${label(FAMILY_LABELS, section.family, "Critical family")}`);
      lines.push("");
    }

    lines.push(`### ${section.heading}`);
    lines.push("");
    lines.push(`| ${TABLE_HEADERS.join(" | ")} |`);
    lines.push(`| ${TABLE_HEADERS.map(() => "---").join(" | ")} |`);

    for (const result of section.results) {
      lines.push(`| ${buildRow(result, templatesByKey, classification).join(" | ")} |`);
    }

    lines.push("");
  }

  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function firstDifference(left, right) {
  const shortest = Math.min(left.length, right.length);

  for (let index = 0; index < shortest; index += 1) {
    if (left[index] !== right[index]) {
      return index;
    }
  }

  return left.length === right.length ? -1 : shortest;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const generate = args.has("--generate");
  const verify = args.has("--verify");

  if (generate === verify) {
    fail("Use exactly one mode: --generate or --verify.");
  }

  /*
   * Prettier owns the final bytes. `format:check` runs over this tree, so emitting anything Prettier
   * would rewrite breaks the gate and makes the regenerate-then-diff reproducibility proof fail; and
   * Prettier's cell padding is what keeps every table delimiter above the reader renderer's
   * three-dash floor, which is the Forgejo #612 defect.
   */
  const expected = await formatWithPrettier(buildDocument(), { filepath: OUTPUT_PATH });

  if (generate) {
    writeFileSync(OUTPUT_PATH, expected, "utf8");
    console.log(
      `Wrote ${OUTPUT_PATH} from ${CRITICAL_RESULTS.length} Critical results and ${CRITICAL_EFFECT_TEMPLATES.length} effect templates.`,
    );
    return;
  }

  let actual;
  try {
    actual = readFileSync(OUTPUT_PATH, "utf8");
  } catch {
    fail(`${OUTPUT_PATH} is missing. Run pnpm critical-table:generate.`);
  }

  const offset = firstDifference(actual, expected);

  if (offset !== -1) {
    fail(
      `${OUTPUT_PATH} drifted from the authoritative Critical data at offset ${offset}.\n` +
        `  on disk: ${JSON.stringify(actual.slice(Math.max(0, offset - 60), offset + 60))}\n` +
        `  expected: ${JSON.stringify(expected.slice(Math.max(0, offset - 60), offset + 60))}\n` +
        "Run pnpm critical-table:generate and review the change.",
    );
  }

  console.log(
    `${OUTPUT_PATH} matches the authoritative Critical data (${CRITICAL_RESULTS.length} results).`,
  );
}

/*
 * Only run when invoked as a script. `criticalTable.test.ts` imports the reader labels above so the
 * published section headings have exactly one definition, and importing this module must therefore
 * never generate or verify anything.
 */
/*
 * No top-level await: this module's exported labels are imported by both the Vitest conformance
 * suite and the Playwright spec, and Playwright's CommonJS loader cannot require an ESM graph that
 * contains one.
 */
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
