import { describe, expect, it } from "vitest";

import {
  CRITICAL_STUN_CHANNELS,
  REPRESENTATIVE_CRITICAL_FIXTURES,
  buildRepresentativeCriticalRuntimeDefinition,
  isC1FiveKeyCriticalRuntimeKey,
  calculateWorkbookEncumbranceLevel,
  calculateWorkbookMovementModifier,
  deriveParryPrimaryActionModifier,
  getDexteritySizeModifier,
  getGlantriStatModifier,
  resolveCombatFeintTable,
  sumIndependentCriticalStuns,
  type CriticalStunChannel,
  type RepresentativeCriticalStun,
} from "@glantri/rules-engine";
import {
  CRITICAL_EFFECTS_TABLE,
  applySecondaryCriticalGradeReduction,
  calculateDistanceObPenalty,
  evaluateCombatExperienceResult,
  evaluatePhaseCombatExperienceResult,
  getCombatExperienceNextCheckRoundNumber,
  getCombatObservationRequiredRounds,
  getFinalCriticalRollIndexStatus,
  hitLocationSchema,
  lookupCombatCriticalModifier,
  lookupCombatToHitParryModifier,
  mapCombatHitLocationToCriticalLocation,
  mapWeaponDamageClassToCriticalFamily,
  resolveCombatAdjustDistanceStandardProposal,
  resolveCombatBreakOffTable,
  resolveCombatDisarmContactQualityModifier,
  resolveCombatDisarmResult,
  resolveCombatObservationCandidateBonus,
  resolveSecondaryCriticalGrade,
  type CombatCriticalGrade,
  type HitLocation,
} from "@glantri/domain";

import { getRulesDocumentById, getRulesDocuments } from "@/lib/rulesDocs";
import { parseMarkdownBlocks } from "./MarkdownRenderer";

/**
 * The committed half of the Forgejo #611 app-to-documentation conformance gate.
 *
 * Two failures this programme actually had are what this file exists to prevent, and it checks
 * them together on purpose:
 *
 * 1. **A published value that disagrees with the application.** Every expectation below is
 *    produced by executing the application's own helper or reading its own frozen table, never by
 *    hand-evaluating the published rule. The published cell is read back and compared to what the
 *    helper returns, so a value that drifts in either direction fails here rather than at a table.
 * 2. **A correct value a reader cannot reach.** Forgejo #612 verified 107 published cells with
 *    zero mismatches, and its flagship lookup still shipped rendering as a run-together paragraph
 *    of pipe characters, because the reader renderer's `isTableSeparator` demands at least three
 *    dashes per delimiter cell while Prettier normalises a narrow right-aligned column to `--:`.
 *    So every value assertion is made against a table the **reader renderer itself** parsed, not
 *    against the raw Markdown. A table that stops rendering therefore fails the value assertion
 *    too, and `renders every registered reader page` adds the standing structural check.
 *
 * No path here is absolute, and the documents are read through `@/lib/rulesDocs`, which resolves
 * the same `docs/rules` tree the application reads whether the suite runs from the repository root
 * or from `apps/web`.
 */

type ParsedTable = readonly (readonly string[])[];

/** Any line GFM would accept as a table delimiter row, including ones the renderer refuses. */
const PLAUSIBLE_DELIMITER_ROW = /^\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?$/;

async function readPageBlocks(id: string) {
  const document = await getRulesDocumentById(id);
  return parseMarkdownBlocks(document.markdown);
}

/**
 * A page's raw Markdown with every whitespace run collapsed to one space.
 *
 * Prose claims wrap wherever Prettier puts the line break, so a guard written against the raw text
 * pins the wrapping rather than the claim and a reflowed restatement walks straight past it. Every
 * prose claim below is matched against this flowed form instead.
 */
async function readFlowedPageText(id: string): Promise<string> {
  const document = await getRulesDocumentById(id);
  return document.markdown.replace(/\s+/g, " ");
}

async function readPageTables(id: string): Promise<ParsedTable[]> {
  const blocks = await readPageBlocks(id);
  return blocks.flatMap((block) => (block.type === "table" ? [block.rows] : []));
}

/**
 * The one table on the page whose header row starts with `headerStart` and whose body mentions
 * `bodyMarker`. Several pages carry more than one table under the same header — the Disarm and
 * Break Off result tables are both `Difference | Result` — so the marker disambiguates without
 * depending on table order.
 */
function findTable(
  tables: readonly ParsedTable[],
  headerStart: readonly string[],
  bodyMarker?: string,
): ParsedTable {
  const matches = tables.filter((table) => {
    const header = table[0] ?? [];
    const headerMatches = headerStart.every((cell, index) => header[index] === cell);

    if (!headerMatches) {
      return false;
    }

    return bodyMarker === undefined
      ? true
      : table.slice(1).some((row) => row.some((cell) => cell.includes(bodyMarker)));
  });

  expect(
    matches,
    `expected exactly one rendered table whose header starts ${JSON.stringify(headerStart)}${
      bodyMarker === undefined ? "" : ` and whose body mentions "${bodyMarker}"`
    }`,
  ).toHaveLength(1);

  return matches[0]!;
}

function tableBody(table: ParsedTable): readonly (readonly string[])[] {
  return table.slice(1);
}

/** Published cells use a Unicode minus, an en dash, backticks and a leading `+` for readability. */
function normalizeCell(cell: string): string {
  return cell.replace(/`/g, "").replace(/−/g, "-").trim();
}

function cellNumber(cell: string): number {
  const normalized = normalizeCell(cell)
    .replace(/\s*\([^)]*\)\s*/g, "")
    .replace(/^\+/, "")
    .replace(/%$/, "");
  const value = Number(normalized);

  expect(Number.isFinite(value), `published cell "${cell}" is not a number`).toBe(true);

  return value;
}

interface Band {
  readonly max: number;
  readonly min: number;
}

/**
 * A published band cell as the closed integer interval it denotes. Returns `undefined` for a cell
 * that is deliberately prose rather than a band — `Each additional 5 Dodge` is the live example —
 * so the caller decides whether that is expected rather than silently skipping it.
 */
function parseBand(cell: string): Band | undefined {
  const text = normalizeCell(cell)
    .replace(/\s*\([^)]*\)\s*/g, "")
    .replace(/%/g, "")
    .trim();

  /* "A tie, a loss, or 0-5" states one lower-unbounded band in prose. */
  const tieOrLoss = /^a tie,\s*a loss,\s*or\s*(\d+)\s*[-–]\s*(\d+)$/i.exec(text);
  if (tieOrLoss) {
    return { max: Number(tieOrLoss[2]), min: Number.NEGATIVE_INFINITY };
  }

  const single = /^(-?\d+)$/.exec(text);
  if (single) {
    const value = Number(single[1]);
    return { max: value, min: value };
  }

  const signedRange = /^([+-]?\d+)\s+to\s+([+-]?\d+)$/.exec(text);
  if (signedRange) {
    return { max: Number(signedRange[2]), min: Number(signedRange[1]) };
  }

  const dashRange = /^(\d+)\s*[-–]\s*(\d+)$/.exec(text);
  if (dashRange) {
    return { max: Number(dashRange[2]), min: Number(dashRange[1]) };
  }

  const orMore = /^([+-]?\d+)\s*(?:or more|\+)$/.exec(text);
  if (orMore) {
    return { max: Number.POSITIVE_INFINITY, min: Number(orMore[1]) };
  }

  const orLess = /^(?:<=\s*)?([+-]?\d+)(?:\s*or less)?$/.exec(text);
  if (orLess && /or less|<=/.test(text)) {
    return { max: Number(orLess[1]), min: Number.NEGATIVE_INFINITY };
  }

  const bareUpperBound = /^<=\s*([+-]?\d+)$/.exec(text);
  if (bareUpperBound) {
    return { max: Number(bareUpperBound[1]), min: Number.NEGATIVE_INFINITY };
  }

  return undefined;
}

/**
 * Sweep a closed input domain against a published banded table.
 *
 * Every value in `domain` must fall in exactly one published band — so a gap, an overlap or a
 * transcribed boundary fails — and the published cell for that band must equal what the
 * application's own helper returns for that value.
 */
function expectBandedLookupMatchesApplication(input: {
  readonly domain: readonly number[];
  readonly expected: (value: number) => string;
  readonly label: string;
  readonly table: ParsedTable;
  readonly valueColumn?: number;
}): void {
  const valueColumn = input.valueColumn ?? 1;
  const bands = tableBody(input.table).flatMap((row) => {
    const band = parseBand(row[0] ?? "");
    return band ? [{ band, published: normalizeCell(row[valueColumn] ?? "") }] : [];
  });

  expect(bands.length, `${input.label}: no parsable bands in the published table`).toBeGreaterThan(
    0,
  );

  for (const value of input.domain) {
    const matching = bands.filter(({ band }) => value >= band.min && value <= band.max);

    expect(
      matching.length,
      `${input.label}: input ${value} matches ${matching.length} published bands, expected 1`,
    ).toBe(1);

    expect(matching[0]!.published.replace(/^\+/, ""), `${input.label}: input ${value}`).toBe(
      input.expected(value).replace(/^\+/, ""),
    );
  }
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_unused, index) => from + index);
}

const CRITICAL_GRADES: readonly CombatCriticalGrade[] = ["a", "b", "c", "d", "e", "f"];

describe("rules documentation reader pages render as the elements they are meant to be", () => {
  it.each(getRulesDocuments().map((document) => [document.id, document.fileName]))(
    "renders every registered reader page: %s",
    async (id, fileName) => {
      const blocks = await readPageBlocks(id);

      /*
       * The #612 failure in its exact shape: a delimiter row GFM accepts and the reader renderer
       * refuses leaves the whole table in a paragraph block as raw pipe text. One assertion per
       * page, over every line the renderer decided was prose.
       */
      for (const block of blocks) {
        if (block.type !== "paragraph") {
          continue;
        }

        for (const line of block.lines) {
          expect(
            PLAUSIBLE_DELIMITER_ROW.test(line.trim()),
            `${fileName}: "${line.trim()}" is a table delimiter row the reader renderer refused, so its table renders as pipe text`,
          ).toBe(false);
        }
      }

      /* Every page must actually produce reader content, and every table a well-formed grid. */
      expect(
        blocks.some((block) => block.type === "heading"),
        `${fileName}: produced no heading`,
      ).toBe(true);
      expect(
        blocks.some((block) => block.type === "paragraph" || block.type === "list"),
        `${fileName}: produced no prose`,
      ).toBe(true);

      for (const block of blocks) {
        if (block.type !== "table") {
          continue;
        }

        expect(block.rows.length, `${fileName}: a table has no body rows`).toBeGreaterThan(1);

        for (const row of block.rows) {
          expect(row.length, `${fileName}: a table row has a different width to its header`).toBe(
            block.rows[0]!.length,
          );
        }
      }
    },
  );
});

/**
 * Forgejo #611's own first attempt is what this block exists to prevent.
 *
 * Every other assertion in this file goes through a published *table*, because a table has cells a
 * test can read back. The claim that failed QA was **prose**: `combat-to-hit.md` said the canonical
 * Critical rows were written for "the five C1-active Critical keys" and that "for every other
 * Critical result the stored roll ... creates no rows". The row gate is not the five-key set at all
 * — `buildRepresentativeCriticalRuntimeDefinition` returns a definition for *any* key carrying a
 * representative fixture, `encounterRoutes.ts` builds `criticalRuntime` for any `critKey`, and
 * `buildCombatRoundDamageCommitRows` emits the `c1-*` kinds whenever that runtime exists. The
 * five-key set gates the structured GM *adjudication*. 38 table assertions could not see any of it,
 * because none of it was in a table.
 *
 * So the counts and the boundary are bound here directly:
 *
 * - the active/legacy split comes from `REPRESENTATIVE_CRITICAL_FIXTURES` against the catalogue;
 * - the adjudication count comes from `isC1FiveKeyCriticalRuntimeKey`;
 * - the row boundary is executed, so narrowing row creation to the five fails this file;
 * - every published count claim is matched by a pattern that must hit an **exact** number of times,
 *   so rewording the sentence fails as loudly as changing the number.
 *
 * Forgejo #651 then moved the counts to one reader location and closed the gap the #611 repair QA
 * left open. Two things changed here, and both matter:
 *
 * 1. **Per-occurrence expected counts.** A claim that was published twice used to be guarded once,
 *    because the pattern test only required `matches.length > 0`: rewording one of the two
 *    occurrences passed. Every claim now declares how many times it must appear, so a reworded,
 *    deleted *or* newly duplicated occurrence fails.
 * 2. **One authoritative location.** `combat-critical-effects.md` carries the counts and
 *    `combat-to-hit.md` references its boundary section instead of restating them. `RETIRED_CLAIMS`
 *    holds the patterns `combat-to-hit.md` used to carry and requires **zero** matches, so the
 *    duplication cannot creep back; `AUTHORITY_FRAGMENT` requires the reference that replaced it.
 *    Relocation alone does not close gap 1 — `combat-critical-effects.md` still states the active
 *    count in four separate sentences — so the per-occurrence counts do the work, and all four are
 *    now individually guarded where previously one of them matched no pattern at all.
 */
describe("published Critical automation counts match the executed fixture and adjudication sets", () => {
  const catalogueKeys = CRITICAL_EFFECTS_TABLE.criticalResults.map((result) => result.critKey);
  const fixtureKeys = REPRESENTATIVE_CRITICAL_FIXTURES.map((fixture) => fixture.criticalKey);
  const fiveKeys = fixtureKeys.filter((key) => isC1FiveKeyCriticalRuntimeKey(key));
  const catalogueCount = new Set(catalogueKeys).size;
  const activeCount = REPRESENTATIVE_CRITICAL_FIXTURES.length;
  const legacyCount = catalogueCount - activeCount;
  const adjudicationCount = fiveKeys.length;
  const nonAdjudicationActiveCount = activeCount - adjudicationCount;

  /** Published prose spells small counts as words. */
  const NUMBER_WORDS: Record<string, number> = {
    five: 5,
    four: 4,
    one: 1,
    three: 3,
    two: 2,
  };

  function publishedNumber(captured: string): number {
    const word = NUMBER_WORDS[captured.toLowerCase()];

    return word ?? Number(captured);
  }

  /** Any published count, as digits or as one of the number words prose actually uses. */
  const COUNT = String.raw`\d+|five|four|three|two|one`;

  interface CountClaim {
    readonly expected: number;
    readonly label: string;
    /**
     * How many times this claim is published. Matching fewer times means an occurrence was
     * reworded away from its guard or deleted; matching more means a new unguarded restatement
     * appeared. Both fail.
     */
    readonly occurrences: number;
    /** Group 1 (or the first defined group) is the published count. */
    readonly pattern: RegExp;
  }

  /**
   * `combat-critical-effects.md` is the single authoritative reader location for the current-runtime
   * C1 boundary, so every count claim lives here, and each of its occurrences is guarded separately
   * rather than through one alternation that only had to hit once.
   */
  const CLAIMS: Record<string, readonly CountClaim[]> = {
    "combat-critical-effects": [
      {
        expected: activeCount,
        label: "representative C1 Critical definitions frozen",
        occurrences: 1,
        pattern: new RegExp(`freezes (${COUNT}) representative C1 Critical definitions`, "g"),
      },
      {
        expected: catalogueCount,
        label: "whole-catalogue result count",
        occurrences: 1,
        pattern: /(\d+)-result catalogue/g,
      },
      {
        expected: activeCount,
        label: "C1-active key count, fixture-activation sentence",
        occurrences: 1,
        pattern: new RegExp(`those exact (${COUNT}) keys`, "g"),
      },
      {
        expected: activeCount,
        label: "C1-active key count, specialized-family reachability sentence",
        occurrences: 1,
        pattern: new RegExp(`already addresses one of the (${COUNT}) keys`, "g"),
      },
      {
        expected: activeCount,
        label: "C1-active key count, commit-resolution sentence",
        occurrences: 1,
        pattern: new RegExp(`one of the (${COUNT})\\s*C1 keys`, "g"),
      },
      {
        expected: legacyCount,
        label: "legacy catalogue row count, fixture-activation sentence",
        occurrences: 1,
        pattern: new RegExp(`other (${COUNT}) catalogue rows`, "g"),
      },
      {
        expected: legacyCount,
        label: "legacy catalogue row count, commit-resolution sentence",
        occurrences: 1,
        pattern: new RegExp(`the (${COUNT}) inactive rows`, "g"),
      },
    ],
  };

  /**
   * The link `combat-to-hit.md` carries instead of the counts. The target is the heading on
   * `combat-critical-effects.md` that owns the boundary; the fragment is the reader renderer's own
   * heading id, and `MarkdownRenderer.component.test.tsx` renders both pages to prove the anchor
   * and the id it points at actually exist.
   */
  const AUTHORITY_FRAGMENT = "./combat-critical-effects.md#c1-representative-fixture-authority";

  /**
   * What `combat-to-hit.md` must no longer carry. Forgejo #651 made
   * `combat-critical-effects.md` the one reader location for these counts; these patterns are the
   * exact forms `combat-to-hit.md` published before that, plus bare occurrences of each executed
   * count, so a restatement in any wording fails rather than silently reintroducing a second
   * authority that can drift against the first.
   */
  const RETIRED_CLAIMS: readonly { readonly label: string; readonly pattern: RegExp }[] = [
    {
      label: "the executed fixture-carrying key count as a bare number",
      pattern: new RegExp(`\\b${activeCount}\\b`, "g"),
    },
    {
      label: "the executed legacy catalogue count as a bare number",
      pattern: new RegExp(`\\b${legacyCount}\\b`, "g"),
    },
    {
      label: "the executed non-adjudication fixture count as a bare number",
      pattern: new RegExp(`\\b${nonAdjudicationActiveCount}\\b`, "g"),
    },
    {
      label: "a count in front of the C1-active review keys",
      pattern: new RegExp(`(${COUNT})\\s*C1-active review keys`, "g"),
    },
    {
      label: "a count of the keys carrying a representative C1 fixture",
      pattern: new RegExp(`(${COUNT}) (?:Critical keys|that carry)`, "g"),
    },
    {
      label: "a count of the remaining catalogue results",
      pattern: new RegExp(`(${COUNT}) catalogue (?:results|rows)`, "g"),
    },
    {
      label: "a count of the fixture keys outside the review set",
      pattern: new RegExp(`(${COUNT}) fixture keys`, "g"),
    },
  ];

  it("builds a Critical runtime definition for every fixture key and for no other catalogue key", () => {
    expect(fixtureKeys).toHaveLength(activeCount);
    expect(new Set(fixtureKeys).size).toBe(activeCount);

    for (const key of fixtureKeys) {
      expect(
        buildRepresentativeCriticalRuntimeDefinition(key, () => 0.5),
        `${key} carries a representative fixture, so commit writes its c1-* rows`,
      ).toBeDefined();
    }

    const legacyKeys = catalogueKeys.filter((key) => !fixtureKeys.includes(key));

    expect(legacyKeys).toHaveLength(legacyCount);

    for (const key of legacyKeys) {
      expect(
        buildRepresentativeCriticalRuntimeDefinition(key, () => 0.5),
        `${key} carries no fixture, so it stays on the legacy GM-note path`,
      ).toBeUndefined();
    }
  });

  it("gates adjudication, not row creation, on the C1-active review keys", () => {
    expect(adjudicationCount).toBeLessThan(activeCount);
    expect(nonAdjudicationActiveCount).toBeGreaterThan(0);

    for (const key of fiveKeys) {
      expect(fixtureKeys).toContain(key);
    }

    /*
     * The boundary in one assertion: a key outside the five still yields a runtime definition, and
     * rejects an adjudication. Narrowing row creation to the five breaks the first expectation;
     * widening adjudication past the five breaks the second.
     */
    for (const key of fixtureKeys.filter((candidate) => !fiveKeys.includes(candidate))) {
      expect(buildRepresentativeCriticalRuntimeDefinition(key, () => 0.5)).toBeDefined();
      expect(() =>
        buildRepresentativeCriticalRuntimeDefinition(key, () => 0.5, {
          criticalKey: key,
          suppressedEffectKeys: [],
        }),
      ).toThrow(RangeError);
    }
  });

  it("publishes the C1-active review keys the adjudication set actually holds", async () => {
    const flowed = await readFlowedPageText("combat-critical-effects");
    const sentence = /The (\d+|five|four|three|two|one) active review keys are ([^.]+)\./.exec(
      flowed,
    );

    expect(sentence, "combat-critical-effects.md no longer names the active review keys").not.toBe(
      null,
    );
    expect(publishedNumber(sentence![1]!)).toBe(adjudicationCount);

    const published = [...sentence![2]!.matchAll(/`([^`]+)`/g)].map((match) => match[1]!);

    expect([...published].sort()).toStrictEqual([...fiveKeys].sort());
  });

  it.each(Object.keys(CLAIMS))("states only executed Critical counts on %s", async (id) => {
    const flowed = await readFlowedPageText(id);

    for (const claim of CLAIMS[id]!) {
      const matches = [...flowed.matchAll(claim.pattern)];

      /*
       * An exact occurrence count, not `> 0`. The #611 repair QA proved that an alternation
       * requiring one match lets a claim published twice be reworded once and still pass.
       */
      expect(
        matches.length,
        `${id}: expected the ${claim.label} to be published exactly ${claim.occurrences} time(s) but found ${matches.length}; the claim was reworded away from its guard, deleted, or restated somewhere new`,
      ).toBe(claim.occurrences);

      for (const match of matches) {
        const captured = match.slice(1).find((group) => group !== undefined)!;

        expect(
          publishedNumber(captured),
          `${id}: published ${claim.label} is "${captured}" but the application yields ${claim.expected}`,
        ).toBe(claim.expected);
      }
    }
  });

  it("keeps one authoritative reader location for the Critical automation split", async () => {
    const toHit = await readFlowedPageText("combat-to-hit");
    const criticalEffects = await readFlowedPageText("combat-critical-effects");

    /* The authority carries both executed counts. */
    expect(criticalEffects).toContain(String(activeCount));
    expect(criticalEffects).toContain(String(legacyCount));
    expect(activeCount + legacyCount).toBe(catalogueCount);

    /* The referring page carries none of them, in any wording. */
    for (const retired of RETIRED_CLAIMS) {
      expect(
        [...toHit.matchAll(retired.pattern)].map((match) => match[0]),
        `combat-to-hit.md restates ${retired.label}; combat-critical-effects.md is the single authoritative reader location for the C1 boundary counts`,
      ).toStrictEqual([]);
    }

    /* And it points the reader at the section that does carry them. */
    expect(
      toHit,
      "combat-to-hit.md no longer links to the C1 boundary authority section",
    ).toContain(AUTHORITY_FRAGMENT);
  });
});

describe("Criticals - GM Value Reference matches the executed Critical helpers", () => {
  it("publishes the critical type modifier the modifier table returns for every grade", async () => {
    const table = findTable(await readPageTables("gm-criticals"), [
      "Primary Critical grade",
      "Critical type modifier",
    ]);
    const published = tableBody(table).map((row) => [normalizeCell(row[0]!), cellNumber(row[1]!)]);

    expect(published).toEqual(
      CRITICAL_GRADES.map((grade) => [
        grade.toUpperCase(),
        lookupCombatCriticalModifier(grade).criticalTypeModifier,
      ]),
    );
  });

  it("publishes the per-grade minDamage column the page says the runtime does not read", async () => {
    const document = await getRulesDocumentById("gm-criticals");
    const first = lookupCombatCriticalModifier("a").minDamage;
    const last = lookupCombatCriticalModifier("f").minDamage;

    expect(document.markdown).toContain(`(\`A\` \`${first}\` through \`F\` \`${last}\`)`);
  });

  it("publishes the final-critical-roll index behaviour the status helper returns", async () => {
    const table = findTable(await readPageTables("gm-criticals"), [
      "Final critical roll",
      "What the app does",
    ]);
    const statuses = tableBody(table).map((row) => normalizeCell(row[0]!));

    expect(statuses).toEqual(["0 or lower", "1 through 16", "17 or higher", "Not a whole number"]);
    expect(getFinalCriticalRollIndexStatus(0).status).toBe("no_effect");
    expect(getFinalCriticalRollIndexStatus(-1).status).toBe("no_effect");
    expect(getFinalCriticalRollIndexStatus(1).status).toBe("table_lookup");
    expect(getFinalCriticalRollIndexStatus(16).status).toBe("table_lookup");
    expect(getFinalCriticalRollIndexStatus(17).status).toBe("unsupported_high");
    expect(getFinalCriticalRollIndexStatus(1.5).status).toBe("unsupported");
  });

  it("publishes the Critical family the damage-class mapper returns", async () => {
    const table = findTable(await readPageTables("gm-criticals"), [
      "Weapon damage class",
      "Critical family",
    ]);

    for (const row of tableBody(table)) {
      const damageClass = normalizeCell(row[0]!);
      const result = mapWeaponDamageClassToCriticalFamily(damageClass);

      expect(result.status, `damage class ${damageClass}`).toBe("mapped");
      expect(result.status === "mapped" ? result.value : undefined, damageClass).toBe(
        normalizeCell(row[1]!),
      );
    }
  });

  it("publishes a Critical location scope for every hit location the schema accepts", async () => {
    const table = findTable(await readPageTables("gm-criticals"), [
      "Combat hit location",
      "Critical location scope",
    ]);
    const publishedByLocation = new Map<string, string>();

    for (const row of tableBody(table)) {
      /* `(legacy)` annotates the pair, so it is dropped before the cell is split. */
      const locations = normalizeCell(row[0]!).replace(/\s*\([^)]*\)\s*/g, "");

      for (const location of locations.split(/,\s*/)) {
        publishedByLocation.set(location.trim(), normalizeCell(row[1]!));
      }
    }

    const schemaLocations = hitLocationSchema.options as readonly HitLocation[];

    expect(
      [...publishedByLocation.keys()].sort(),
      "every schema hit location must be published, and nothing else",
    ).toEqual([...schemaLocations].sort());

    for (const location of schemaLocations) {
      const result = mapCombatHitLocationToCriticalLocation(location);
      const published = publishedByLocation.get(location)!;

      if (result.status === "mapped") {
        expect(published, location).toBe(result.value);
      } else {
        /* The legacy whole-leg locations are ambiguous, and the page must say so, not guess. */
        expect(result.status, location).toBe("ambiguous");
        expect(published.toLowerCase(), location).toContain("ambiguous");
      }
    }
  });

  it("publishes the Secondary two-step grade reduction the reducer returns", async () => {
    const table = findTable(await readPageTables("gm-criticals"), [
      "Primary grade",
      "After the two-step reduction",
    ]);
    const published = tableBody(table).map((row) => [
      normalizeCell(row[0]!),
      normalizeCell(row[1]!),
    ]);

    expect(published).toEqual(
      CRITICAL_GRADES.map((grade) => [
        grade.toUpperCase(),
        applySecondaryCriticalGradeReduction(grade)?.toUpperCase() ?? "None",
      ]),
    );
  });

  it("publishes the resolved Secondary grade for every grade and Sec code combination", async () => {
    const tables = await readPageTables("gm-criticals");
    const table = tables.filter((candidate) => {
      const header = candidate[0] ?? [];
      return header[0]?.startsWith("Primary") === true && header.includes("`DC`");
    });

    expect(table, "the Secondary cap matrix must render as one table").toHaveLength(1);

    const header = table[0]![0]!;
    const secCodes = header.slice(1).map((cell) => normalizeCell(cell));

    expect(secCodes).toEqual(["AP", "AC", "AS", "BS", "CC", "DC"]);

    for (const row of tableBody(table[0]!)) {
      const primaryGrade = normalizeCell(row[0]!).toLowerCase() as CombatCriticalGrade;

      secCodes.forEach((secCode, index) => {
        const resolution = resolveSecondaryCriticalGrade({
          resolvedPrimaryCriticalGrade: primaryGrade,
          weaponSecondaryCriticalCode: secCode,
        });
        const expected =
          resolution.status === "resolved" ? resolution.secondaryCriticalGrade.toUpperCase() : "—";

        expect(normalizeCell(row[index + 1]!), `${primaryGrade.toUpperCase()} x ${secCode}`).toBe(
          expected,
        );
      });
    }
  });

  it("publishes the Stun channel totals the independent-Stun sum returns", async () => {
    const table = findTable(await readPageTables("gm-criticals"), [
      "Channel",
      "Total from both sources",
    ]);
    const stuns = [-2, -4].map(
      (modifier) =>
        ({
          channels: CRITICAL_STUN_CHANNELS,
          duration: { kind: "rounds", rounds: 1, text: "1 round" },
          modifier,
          onset: "immediate",
          severity: 2,
          sourceEffectKey: `conformance-${modifier}`,
        }) as unknown as RepresentativeCriticalStun,
    );
    const channelByLabel: Record<string, CriticalStunChannel> = {
      "DB/Parry": "db_parry",
      Initiative: "initiative",
      "OB/Skill": "ob_skill",
    };

    expect(tableBody(table)).toHaveLength(CRITICAL_STUN_CHANNELS.length);

    for (const row of tableBody(table)) {
      const label = normalizeCell(row[0]!);
      const channel = channelByLabel[label];

      expect(channel, `unexpected published Stun channel "${label}"`).toBeDefined();
      expect(cellNumber(row[1]!), label).toBe(sumIndependentCriticalStuns(stuns, channel!));
    }
  });
});

describe("Combat Round, Loadout and Actions matches the executed manoeuvre resolvers", () => {
  it("publishes the Disarm result band the Disarm resolver returns", async () => {
    const tables = await readPageTables("combat-round-and-actions");

    expectBandedLookupMatchesApplication({
      domain: range(-10, 30),
      expected: (difference) => resolveCombatDisarmResult(difference).label,
      label: "Disarm result",
      table: findTable(tables, ["Difference", "Result"], "No effect"),
    });
  });

  it("publishes the Disarm contact-quality modifier the contact-quality resolver returns", async () => {
    const tables = await readPageTables("combat-round-and-actions");

    expectBandedLookupMatchesApplication({
      domain: range(0, 30),
      expected: (margin) => String(resolveCombatDisarmContactQualityModifier(margin).modifier),
      label: "Disarm contact quality",
      table: findTable(tables, ["Successful parry margin", "Contact quality"]),
    });
  });

  it("publishes the Break Off band modifiers the Break Off table returns", async () => {
    const table = findTable(
      await readPageTables("combat-round-and-actions"),
      ["Difference", "Result"],
      "Attack continues",
    );

    expectBandedLookupMatchesApplication({
      domain: range(-40, 40),
      expected: (difference) => {
        const row = resolveCombatBreakOffTable(difference);
        const modifier = row.escaped ? row.attackerObModifier : row.defenderDbParryModifier;
        const subject = row.escaped ? "attacker OB" : "your DB/Parry";
        const outcome = row.escaped ? "You break off" : "Attack continues";

        return modifier === 0 ? outcome : `${outcome}; ${subject} ${modifier}%`;
      },
      label: "Break Off result",
      table,
    });
  });

  it("publishes both Feint outcome columns the Feint resolver returns", async () => {
    const table = findTable(await readPageTables("combat-round-and-actions"), [
      "Difference",
      "Your Phase 1 DB/Parry",
      "Their Phase 2 OB/DB",
    ]);

    expectBandedLookupMatchesApplication({
      domain: range(-40, 40),
      expected: (difference) =>
        String(resolveCombatFeintTable(difference).attackerPhase1DbParryModifier),
      label: "Feint attacker Phase 1 DB/Parry",
      table,
      valueColumn: 1,
    });
    expectBandedLookupMatchesApplication({
      domain: range(-40, 40),
      expected: (difference) => String(resolveCombatFeintTable(difference).defenderObDbModifier),
      label: "Feint defender Phase 2 OB/DB",
      table,
      valueColumn: 2,
    });
  });

  it("publishes the distance OB penalty the distance helper returns across the 0-8 domain", async () => {
    const tables = await readPageTables("combat-round-and-actions");

    /* Steps away from the nearest preferred distance, read against a weapon that prefers `0`. */
    expectBandedLookupMatchesApplication({
      domain: range(0, 8),
      expected: (steps) => String(calculateDistanceObPenalty(steps, [0])),
      label: "distance OB penalty by steps",
      table: findTable(tables, ["Steps from the nearest preferred distance", "Modifier"]),
    });

    /* And the worked rows, which are what prove "nearest", not "best", including a tie at 4. */
    const examples = findTable(tables, ["Preferred", "Actual", "Steps", "Modifier"]);

    for (const row of tableBody(examples)) {
      const preferred = normalizeCell(row[0]!)
        .split(/\s+or\s+/)
        .map((value) => Number(value));
      const actual = cellNumber(row[1]!);
      const penalty = calculateDistanceObPenalty(actual, preferred);

      expect(cellNumber(row[3]!), `preferred ${preferred.join("/")} at ${actual}`).toBe(penalty);
      expect(cellNumber(row[2]!), `steps for preferred ${preferred.join("/")} at ${actual}`).toBe(
        Math.abs(penalty) / 2,
      );
    }
  });

  it("publishes the Adjust Distance outcomes the result table carries", async () => {
    const table = findTable(await readPageTables("combat-round-and-actions"), [
      "Outcome",
      "Resulting distance",
    ]);

    expect(tableBody(table).map((row) => normalizeCell(row[1]!))).toEqual([
      "Requested distance",
      "Requested distance",
      "Current distance",
    ]);
    const resolve = (input: {
      attackerTotal?: number;
      defenderAllowed?: boolean;
      defenderTotal?: number;
    }) =>
      resolveCombatAdjustDistanceStandardProposal({
        ...input,
        currentDistance: 2,
        requestedDistance: 5,
      });

    /* Opponent allows, a margin of 1 or more, and the tie that goes to the opponent. */
    expect(resolve({ defenderAllowed: true }).proposedDistance).toBe(5);
    expect(resolve({ attackerTotal: 11, defenderTotal: 10 }).proposedDistance).toBe(5);
    expect(resolve({ attackerTotal: 10, defenderTotal: 10 }).proposedDistance).toBe(2);
    expect(resolve({ attackerTotal: 9, defenderTotal: 10 }).proposedDistance).toBe(2);
  });

  it("publishes the Observe Opponent thresholds and bonus bands the helpers return", async () => {
    const tables = await readPageTables("combat-round-and-actions");

    expectBandedLookupMatchesApplication({
      domain: range(0, 8),
      expected: (completed) => String(getCombatObservationRequiredRounds(completed)),
      label: "Observe Opponent qualifying rounds",
      table: findTable(tables, ["Completed attempts", "Qualifying rounds needed"]),
    });
    expectBandedLookupMatchesApplication({
      domain: range(-10, 30),
      expected: (margin) => `${resolveCombatObservationCandidateBonus(margin)}%`,
      label: "Observe Opponent bonus",
      table: findTable(tables, ["Margin", "Bonus"]),
    });
  });

  it("publishes one row for each Combat round step, in order", async () => {
    const table = findTable(await readPageTables("combat-round-and-actions"), [
      "Step",
      "In Player Combat",
      "The GM's action",
    ]);

    expect(tableBody(table).map((row) => cellNumber(row[0]!))).toEqual(range(1, 13));
  });
});

describe("Combat To Hit, Combat Experience and Parry match their executed lookups", () => {
  it("publishes the defender parry modifier the hit-lookup row returns", async () => {
    expectBandedLookupMatchesApplication({
      domain: range(0, 40),
      expected: (lookupTotal) => String(lookupCombatToHitParryModifier(lookupTotal)),
      label: "defender parry modifier",
      table: findTable(await readPageTables("combat-to-hit"), [
        "Hit lookup total",
        "Defender parry modifier",
      ]),
    });
  });

  it("publishes the Combat Experience result, modifier and duration the evaluator returns", async () => {
    const table = findTable(await readPageTables("combat-experience"), [
      "Effective table total",
      "Result",
      "Modifier",
    ]);

    for (const row of tableBody(table)) {
      const band = parseBand(row[0]!);

      expect(band, `unparsable Combat Experience band "${row[0]}"`).toBeDefined();

      const probe = band!.min === Number.NEGATIVE_INFINITY ? band!.max : band!.min;
      const evaluation = evaluateCombatExperienceResult(probe);

      expect(normalizeCell(row[1]!), `band ${row[0]}`).toBe(evaluation.label);
      expect(cellNumber(row[2]!), `band ${row[0]} modifier`).toBe(evaluation.modifierValue);
      expect(normalizeCell(row[4]!) === "Yes", `band ${row[0]} effect row`).toBe(
        evaluation.needsEffectRow,
      );
    }

    /* Panic's duration is the one rolled value, so only its non-rolled siblings are swept. */
    expectBandedLookupMatchesApplication({
      domain: range(6, 30),
      expected: (total) => {
        const evaluation = evaluateCombatExperienceResult(total);
        return evaluation.durationRounds === 0
          ? "0"
          : `${evaluation.durationRounds} ${evaluation.durationRounds === 1 ? "round" : "rounds"}`;
      },
      label: "Combat Experience duration",
      table,
      valueColumn: 3,
    });
  });

  /**
   * Forgejo #651, item 1. `combat-round-and-actions.md` told the reader a Combat Experience check
   * can fall due "by schedule" without ever stating the schedule, so the rule is now published on
   * `combat-experience.md` — and bound here, because an unguarded published number is exactly what
   * failed #611. Every published cell is compared to `getCombatExperienceNextCheckRoundNumber`,
   * including the top of the band: a result with no duration schedules no next check at all.
   */
  it("publishes the next-check schedule the Combat Experience scheduler returns", async () => {
    const table = findTable(await readPageTables("combat-experience"), [
      "Result rolled in round",
      "Duration",
      "Next check due",
    ]);
    const body = tableBody(table);

    expect(body.length, "no published next-check rows").toBeGreaterThan(0);

    /* The published duration cell reads as play text — "1 round", "0 (`21+`)" — not as a bare number. */
    function publishedDurationRounds(cell: string): number {
      const leading = /^(\d+)\b/.exec(normalizeCell(cell));

      expect(leading, `published duration "${cell}" does not start with a round count`).not.toBe(
        null,
      );

      return Number(leading![1]);
    }

    let unscheduledRows = 0;

    for (const row of body) {
      const roundNumber = cellNumber(row[0]!);
      const durationRounds = publishedDurationRounds(row[1]!);
      const expected = getCombatExperienceNextCheckRoundNumber({ durationRounds, roundNumber });
      const published = normalizeCell(row[2]!);

      if (expected === undefined) {
        unscheduledRows += 1;
        expect(
          published.toLowerCase(),
          `a result of duration ${durationRounds} rolled in round ${roundNumber} schedules no next check`,
        ).toBe("no next check");
        continue;
      }

      expect(
        cellNumber(row[2]!),
        `a result of duration ${durationRounds} rolled in round ${roundNumber}`,
      ).toBe(expected);
    }

    /* The top of the band must be published, not merely implied by the scheduled rows. */
    expect(unscheduledRows, "no published row states the result that never becomes due").toBe(1);

    /*
     * And the scheduled rows must cover the durations the result table itself can produce, so a
     * duration band cannot be added without the schedule example that goes with it. Panic's
     * duration is the one rolled value, so the sweep starts above its band.
     */
    const publishedDurations = new Set(body.map((row) => publishedDurationRounds(row[1]!)));

    for (const total of range(6, 25)) {
      const { durationRounds } = evaluateCombatExperienceResult(total, { difficulty: 21 });

      expect(
        publishedDurations.has(durationRounds),
        `effective table total ${total} yields a ${durationRounds}-round result, which the next-check table does not illustrate`,
      ).toBe(true);
    }
  });

  it("publishes the phase-attack outcome the phase evaluator returns", async () => {
    expectBandedLookupMatchesApplication({
      domain: range(-10, 30),
      expected: (total) => {
        const evaluation = evaluatePhaseCombatExperienceResult(total);

        if (evaluation.label === "No attack") {
          return "No attack made";
        }

        return evaluation.modifierValue === 0
          ? "Attack continues, no mod"
          : `Phase attack OB ${evaluation.modifierValue}`;
      },
      label: "phase attack outcome",
      table: findTable(await readPageTables("combat-experience"), [
        "Effective table total",
        "Phase attack result",
      ]),
    });
  });

  it("publishes the declared-Parry percentage the Parry derivation returns", async () => {
    const table = findTable(await readPageTables("player-parry"), [
      "Total Dodge",
      "Parry modifier",
    ]);
    const prose = tableBody(table).filter((row) => parseBand(row[0]!) === undefined);

    /* Exactly one deliberately prose row: the open-ended "each additional 5 Dodge" continuation. */
    expect(prose.map((row) => normalizeCell(row[0]!))).toEqual(["Each additional 5 Dodge"]);

    expectBandedLookupMatchesApplication({
      domain: range(0, 24),
      expected: (dodge) => `${deriveParryPrimaryActionModifier(dodge).percentageModifier}%`,
      label: "declared Parry percentage",
      table,
    });

    /* The continuation the prose row promises, checked past the end of the published bands. */
    for (const dodge of [25, 30, 35, 40]) {
      expect(deriveParryPrimaryActionModifier(dodge).percentageModifier).toBe(dodge / 5);
    }
  });
});

describe("Chargen, Character Sheet and Encumbrance lookups match their executed helpers", () => {
  it("publishes the Characteristic GM the stat modifier table returns over the closed 1-25 domain", async () => {
    expectBandedLookupMatchesApplication({
      domain: range(1, 25),
      expected: (value) => String(getGlantriStatModifier(value)),
      label: "Characteristic GM",
      table: findTable(await readPageTables("character-sheet-calculations"), ["Current", "GM"]),
    });
  });

  it("publishes the Size-to-DEX modifier the size helper returns over the closed 1-25 domain", async () => {
    expectBandedLookupMatchesApplication({
      domain: range(1, 25),
      expected: (size) => String(getDexteritySizeModifier(size)),
      label: "Size-to-DEX modifier",
      table: findTable(await readPageTables("chargen-calculations"), ["`SIZ`"]),
    });
  });

  it("publishes the movement modifier the workbook helper returns over encumbrance levels 0-15", async () => {
    expectBandedLookupMatchesApplication({
      domain: range(0, 15),
      expected: (encumbranceLevel) =>
        String(calculateWorkbookMovementModifier({ encumbranceLevel, shieldMovementModifier: 0 })),
      label: "movement modifier before shield",
      table: findTable(await readPageTables("equipment-encumbrance-calculations"), [
        "Encumbrance level",
        "Movement modifier before shield",
      ]),
    });
  });

  it("publishes encumbrance thresholds the level calculator actually steps at", async () => {
    const table = findTable(await readPageTables("equipment-encumbrance-calculations"), [
      "Carried percent above",
      "Encumbrance level",
    ]);

    /* With a capacity of 100 the carried percent is the carried ENC, so each threshold is probed
     * on both sides. "Above" is strict: the published percent itself must not reach the level. */
    const levelAt = (percent: number): number =>
      calculateWorkbookEncumbranceLevel({ carryCapacity: 100, totalEncumbrance: percent })!
        .encumbranceLevel;

    expect(levelAt(0)).toBe(0);

    for (const row of tableBody(table)) {
      const percent = cellNumber(row[0]!);
      const level = cellNumber(row[1]!);

      expect(levelAt(percent + 1), `just above ${percent}%`).toBe(level);
      expect(levelAt(percent), `exactly ${percent}% must not reach level ${level}`).toBe(level - 1);
    }
  });
});
