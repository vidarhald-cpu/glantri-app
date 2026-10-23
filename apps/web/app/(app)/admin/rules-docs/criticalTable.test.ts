import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { CRITICAL_EFFECTS_TABLE } from "@glantri/domain";

/* The application's own public Critical table surface, so the page is checked against what it uses. */
const CRITICAL_RESULTS = CRITICAL_EFFECTS_TABLE.criticalResults;
const CRITICAL_EFFECT_TEMPLATES = CRITICAL_EFFECTS_TABLE.effectTemplates;

import { getRulesDocumentById, getRulesDocuments } from "@/lib/rulesDocs";
import {
  FAMILY_LABELS,
  LOCATION_LABELS,
} from "../../../../../../scripts/generateCriticalTable.mjs";
import { parseMarkdownBlocks } from "./MarkdownRenderer";

/**
 * The committed conformance gate for the Forgejo #734 Critical Table.
 *
 * The published page is generated from `CRITICAL_RESULTS` and `CRITICAL_EFFECT_TEMPLATES` by
 * `scripts/generateCriticalTable.mjs`, so there is one catalogue and this suite's job is to prove
 * the published projection still traces to it. Three failures it is built to catch:
 *
 * 1. **A result that is missing, duplicated or orphaned.** `critKey` is unique across the
 *    authoritative rows and is reconstructible from the three dimensions the page publishes
 *    (family, location, result number), so "every authoritative result exactly once" is checked as
 *    an exact set equality against live data rather than against a recorded total.
 * 2. **A published cell that no longer says what the data says.** Every expectation is read from
 *    the authoritative row at run time; nothing here restates a value by hand.
 * 3. **An excluded identifier or implementation word reaching the reader.** Asserted by scanning
 *    the document, not by trusting the generator.
 *
 * Every assertion is made against tables the reader renderer itself parsed, for the Forgejo #612
 * reason recorded in `rulesDocsConformance.test.ts`: a delimiter row the renderer refuses leaves a
 * correct table on the page as unreadable pipe text.
 */

const DOCUMENT_ID = "critical-table";

const repositoryRoot =
  path.basename(process.cwd()) === "web" && path.basename(path.dirname(process.cwd())) === "apps"
    ? path.resolve(process.cwd(), "../..")
    : path.resolve(process.cwd());

const classificationPath = path.resolve(
  repositoryRoot,
  "scripts/data/criticalTableSourceNoteClassification.json",
);

type SourceNoteDecision = "ambiguous" | "gm-note" | "play-facing" | "provenance";

const noteClassification: Record<string, SourceNoteDecision> = JSON.parse(
  fs.readFileSync(classificationPath, "utf8"),
);

function splitSourceNotes(sourceNotes: string | undefined): string[] {
  if (typeof sourceNotes !== "string") {
    return [];
  }

  return sourceNotes
    .split("|")
    .map((fragment) => fragment.trim())
    .filter((fragment) => fragment.length > 0);
}

async function readDocumentMarkdown(): Promise<string> {
  const document = await getRulesDocumentById(DOCUMENT_ID);
  return document.markdown;
}

/**
 * The authoritative row key rebuilt from the dimensions the page publishes.
 *
 * `critKey` is `family|location|NN` with the result number zero-padded to two digits, so the reader
 * never needs the key published to identify a row, and the uniqueness invariant is still checkable.
 */
function rebuildCritKey(family: string, location: string, resultNumber: number): string {
  return `${family}|${location}|${String(resultNumber).padStart(2, "0")}`;
}

/** Each section heading maps back to the family and location whose rows follow it. */
async function readSectionedRows(): Promise<
  { family: string; location: string; row: Record<string, string> }[]
> {
  const blocks = parseMarkdownBlocks(await readDocumentMarkdown());
  const headingToDimensions = new Map<string, { family: string; location: string }>();

  /*
   * Built from the generator's own reader labels, so the section headings have exactly one
   * definition and a relabelling cannot drift the page away from this check.
   */
  for (const result of CRITICAL_RESULTS) {
    const family = FAMILY_LABELS[result.family as keyof typeof FAMILY_LABELS];
    const location = LOCATION_LABELS[result.location as keyof typeof LOCATION_LABELS];

    expect(family, `family "${result.family}" has no reader label`).toBeDefined();
    expect(location, `location "${result.location}" has no reader label`).toBeDefined();

    headingToDimensions.set(`${family} - ${location}`, {
      family: result.family,
      location: result.location,
    });
  }

  const sectioned: { family: string; location: string; row: Record<string, string> }[] = [];
  let current: { family: string; location: string } | undefined;

  for (const block of blocks) {
    if (block.type === "heading" && block.level === 3) {
      current = headingToDimensions.get(block.text);
      expect(
        current,
        `heading "${block.text}" does not name a live family and location`,
      ).toBeDefined();
      continue;
    }

    if (block.type !== "table" || !current) {
      continue;
    }

    const [headers, ...body] = block.rows;

    for (const cells of body) {
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = cells[index] ?? "";
      });
      sectioned.push({ family: current.family, location: current.location, row });
    }
  }

  return sectioned;
}

describe("Critical Table publication", () => {
  it("is registered as a reader page in the Tables section with a player-inclusive audience", () => {
    const entry = getRulesDocuments().find((document) => document.id === DOCUMENT_ID);

    expect(entry).toBeDefined();
    expect(entry?.fileName).toBe("critical-table.md");
    expect(entry?.section).toBe("Tables");
    expect(entry?.title).toBe("Critical Table");

    /*
     * Forgejo #670 owns the audience taxonomy and requires existing classifications be reused, so
     * the string must already be in use on another registered page and must name players.
     */
    const otherAudiences = getRulesDocuments()
      .filter((document) => document.id !== DOCUMENT_ID)
      .map((document) => document.audience);

    expect(otherAudiences).toContain(entry?.audience);
    expect(entry?.audience).toMatch(/Players/);
  });

  it("publishes every authoritative Critical result exactly once", async () => {
    const sectioned = await readSectionedRows();

    const publishedKeys = sectioned.map(({ family, location, row }) =>
      rebuildCritKey(family, location, Number(row.Result)),
    );
    const authoritativeKeys = CRITICAL_RESULTS.map((result) => result.critKey);

    /* Uniqueness in the source is what makes this an invariant rather than a judgement. */
    expect(new Set(authoritativeKeys).size).toBe(authoritativeKeys.length);

    expect(publishedKeys.length).toBe(authoritativeKeys.length);
    expect(new Set(publishedKeys).size).toBe(publishedKeys.length);
    expect([...new Set(publishedKeys)].sort()).toEqual([...authoritativeKeys].sort());
  });

  it("publishes each row's own values from the authoritative data", async () => {
    const sectioned = await readSectionedRows();
    const byKey = new Map(
      sectioned.map(({ family, location, row }) => [
        rebuildCritKey(family, location, Number(row.Result)),
        row,
      ]),
    );

    const templatesByKey = new Map<string, (typeof CRITICAL_EFFECT_TEMPLATES)[number][]>();
    for (const effect of CRITICAL_EFFECT_TEMPLATES) {
      const existing = templatesByKey.get(effect.critKey) ?? [];
      templatesByKey.set(effect.critKey, [...existing, effect]);
    }

    /* Every authoritative row, not a sample: the whole point is that nothing drifted. */
    for (const result of CRITICAL_RESULTS) {
      const row = byKey.get(result.critKey);
      expect(row, `${result.critKey} has no published row`).toBeDefined();

      if (!row) {
        continue;
      }

      expect(row["Result title"], `${result.critKey} title`).toBe(result.title);
      expect(row["What happens"], `${result.critKey} body text`).toBe(result.bodyText);
      expect(row.Urgency, `${result.critKey} urgency`).toBe(String(result.urgency));
      expect(row["Damage floor"], `${result.critKey} damage floor`).toContain(
        String(result.minTotalDamage),
      );
      expect(row["Damage floor"], `${result.critKey} damage reason`).toContain(
        result.minDamageReason,
      );

      /* Severity, mortality and the conditions are published as words, never as their codes. */
      expect(row.Severity.toLowerCase(), `${result.critKey} band`).toBe(
        result.critBand.toLowerCase(),
      );

      for (const [key, name] of [
        ["hasStun", "Stun"],
        ["hasBalance", "Balance"],
        ["hasExternalBleed", "External bleed"],
        ["hasInternalBleed", "Internal bleed"],
        ["hasLossOfUse", "Loss of use"],
        ["hasSpecial", "Special"],
      ] as const) {
        const present = row.Conditions.split(", ").includes(name);
        expect(present, `${result.critKey} condition ${name}`).toBe(result[key] === true);
      }

      /*
       * Mortality, Treatment and Self-staunch were published but asserted by neither suite
       * (Forgejo #734 QA finding F3). Each expectation below is derived from the authoritative row
       * directly — the coded value transformed into words here, not read from the generator's label
       * maps — so a wrong label fails rather than agreeing with itself.
       */
      if (result.mortalityState === "none") {
        expect(row.Mortality, `${result.critKey} mortality`).toBe("-");
      } else {
        expect(row.Mortality.toLowerCase(), `${result.critKey} mortality`).toBe(
          result.mortalityState.replace(/_/g, " "),
        );
      }

      const hasTreatment =
        typeof result.treatmentDifficulty === "number" ||
        (typeof result.treatmentGateRaw === "string" && result.treatmentGateRaw.length > 0);

      if (!hasTreatment) {
        expect(row.Treatment, `${result.critKey} treatment`).toBe("-");
      } else {
        if (typeof result.treatmentDifficulty === "number") {
          expect(row.Treatment, `${result.critKey} treatment difficulty`).toContain(
            String(result.treatmentDifficulty),
          );
        }
        if (typeof result.treatmentGateRaw === "string" && result.treatmentGateRaw.length > 0) {
          expect(row.Treatment, `${result.critKey} treatment gate`).toContain(
            result.treatmentGateRaw,
          );
        }
      }

      const hasStaunch =
        typeof result.selfStaunchLikelihood === "string" ||
        (typeof result.selfStaunchWindow === "string" && result.selfStaunchWindow.length > 0);

      if (!hasStaunch) {
        expect(row["Self-staunch"], `${result.critKey} self-staunch`).toBe("-");
      } else {
        if (typeof result.selfStaunchLikelihood === "string") {
          expect(
            row["Self-staunch"].toLowerCase(),
            `${result.critKey} self-staunch likelihood`,
          ).toContain(result.selfStaunchLikelihood);
        }
        if (typeof result.selfStaunchWindow === "string" && result.selfStaunchWindow.length > 0) {
          expect(row["Self-staunch"], `${result.critKey} self-staunch window`).toContain(
            result.selfStaunchWindow,
          );
        }
      }

      /*
       * Every published effect must carry its kind, what it affects, its penalty and its duration.
       * Previously only the duration was asserted (F3).
       */
      const effects = templatesByKey.get(result.critKey) ?? [];
      expect(effects.length, `${result.critKey} has no effect templates`).toBeGreaterThan(0);

      for (const effect of effects) {
        expect(row.Effects, `${result.critKey} effect kind "${effect.type}"`).toContain(
          effect.type,
        );

        if (typeof effect.durationRaw === "string" && effect.durationRaw.length > 0) {
          expect(row.Effects, `${result.critKey} duration "${effect.durationRaw}"`).toContain(
            effect.durationRaw,
          );
        }

        if (typeof effect.target === "string" && effect.target.length > 0) {
          /* Targets are published as words; the underscored code must never reach the reader. */
          expect(row.Effects, `${result.critKey} effect target "${effect.target}"`).toContain(
            effect.target.replace(/_/g, " "),
          );
        }

        if (typeof effect.penaltyPct === "number") {
          expect(row.Effects, `${result.critKey} effect penalty ${effect.penaltyPct}`).toContain(
            String(effect.penaltyPct),
          );
        }
      }
    }
  });

  it("keys the source-note publication decisions to the authoritative rows, both directions", () => {
    const liveFragments = new Set(
      CRITICAL_RESULTS.flatMap((result) => splitSourceNotes(result.sourceNotes)),
    );

    const unclassified = [...liveFragments].filter((fragment) => !(fragment in noteClassification));
    const orphaned = Object.keys(noteClassification).filter(
      (fragment) => !liveFragments.has(fragment),
    );

    expect(unclassified, "source-note fragments with no publication decision").toEqual([]);
    expect(orphaned, "publication decisions matching no live source note").toEqual([]);

    for (const decision of Object.values(noteClassification)) {
      expect(["ambiguous", "gm-note", "play-facing", "provenance"]).toContain(decision);
    }
  });

  it("publishes play-facing source notes and withholds rationale and undecided ones", async () => {
    const sectioned = await readSectionedRows();
    const byKey = new Map(
      sectioned.map(({ family, location, row }) => [
        rebuildCritKey(family, location, Number(row.Result)),
        row,
      ]),
    );

    for (const result of CRITICAL_RESULTS) {
      const row = byKey.get(result.critKey);

      if (!row) {
        continue;
      }

      const cell = row["Additional effects"];

      for (const fragment of splitSourceNotes(result.sourceNotes)) {
        if (noteClassification[fragment] === "play-facing") {
          expect(cell, `${result.critKey} must publish ${JSON.stringify(fragment)}`).toContain(
            fragment,
          );
        } else {
          expect(cell, `${result.critKey} must withhold ${JSON.stringify(fragment)}`).not.toContain(
            fragment,
          );
        }
      }
    }
  });

  it("never publishes a withheld source note anywhere on the page", async () => {
    /*
     * The per-row check above only inspects the cell a fragment belongs in, so a withheld note
     * reaching any other cell would pass it. This is the document-wide form: no fragment decided
     * `provenance` or `ambiguous` may appear anywhere, in any column, on any row.
     */
    const markdown = await readDocumentMarkdown();
    /*
     * Withheld means designer rationale or a fragment still awaiting an editorial decision. The
     * `gm-note` fragments are published, into the GM notes column, so they are not withheld.
     */
    const withheld = Object.entries(noteClassification)
      .filter(([, decision]) => decision === "provenance" || decision === "ambiguous")
      .map(([fragment]) => fragment);

    expect(withheld.length).toBeGreaterThan(0);

    for (const fragment of withheld) {
      expect(
        markdown,
        `page must not publish withheld note ${JSON.stringify(fragment)}`,
      ).not.toContain(fragment);
    }
  });

  it("publishes source-note text only as the authoritative data words it", async () => {
    /*
     * This replaces an assertion that was tautological: it split `sourceNotes` into fragments and
     * then checked that `sourceNotes` contained one of them, which is true by construction and
     * could not detect the edit it was named for.
     *
     * What actually needs protecting is that the page never reworded, tightened or invented note
     * text. So both published note columns are reconstructed from the authoritative string and the
     * recorded decisions, and compared for *exact equality* with the rendered cells. A paraphrase,
     * a dropped clause, a tightened "may" or an invented sentence all fail here. Every published
     * fragment is additionally required to occur verbatim inside the row's own `sourceNotes`.
     */
    const sectioned = await readSectionedRows();
    const byKey = new Map(
      sectioned.map(({ family, location, row }) => [
        rebuildCritKey(family, location, Number(row.Result)),
        row,
      ]),
    );

    let rowsCarryingNotes = 0;
    let rowsPublishingEffects = 0;
    let rowsPublishingGmNotes = 0;

    for (const result of CRITICAL_RESULTS) {
      const row = byKey.get(result.critKey);
      expect(row, `${result.critKey} has no published row`).toBeDefined();

      if (!row) {
        continue;
      }

      const fragments = splitSourceNotes(result.sourceNotes);

      if (fragments.length > 0) {
        rowsCarryingNotes += 1;
      }

      const published = (decision: SourceNoteDecision) => [
        ...new Set(fragments.filter((fragment) => noteClassification[fragment] === decision)),
      ];

      const effects = published("play-facing");
      const gmNotes = published("gm-note");

      if (effects.length > 0) {
        rowsPublishingEffects += 1;
      }
      if (gmNotes.length > 0) {
        rowsPublishingGmNotes += 1;
      }

      expect(row["Additional effects"], `${result.critKey} additional effects`).toBe(
        effects.length > 0 ? effects.join("; ") : "-",
      );
      expect(row["GM notes"], `${result.critKey} GM notes`).toBe(
        gmNotes.length > 0 ? gmNotes.join(" ") : "-",
      );

      /* Nothing published may be text the authoritative notes do not literally contain. */
      for (const fragment of [...effects, ...gmNotes]) {
        expect(
          result.sourceNotes,
          `${result.critKey} publishes ${JSON.stringify(fragment)}, which is not verbatim in its own notes`,
        ).toContain(fragment);
      }
    }

    /*
     * Guard the instrument itself: if the corpus ever stopped reaching these branches the loop
     * above would pass by doing nothing, which is how a check comes to be aimed at nothing.
     */
    expect(rowsCarryingNotes, "no row carried source notes").toBeGreaterThan(0);
    expect(rowsPublishingEffects, "no row published an additional effect").toBeGreaterThan(0);
    expect(rowsPublishingGmNotes, "no row published a GM note").toBeGreaterThan(0);
  });

  it("never publishes an excluded identifier or implementation word", async () => {
    const markdown = await readDocumentMarkdown();
    const blocks = parseMarkdownBlocks(markdown);

    /* No row identity, provenance value or source coordinate may appear anywhere on the page. */
    for (const forbidden of [
      "critKey",
      "crit_key",
      "sourceSpecialTags",
      "source_special_tags",
      "specialFlag",
      "effectKey",
      "effectOrder",
      "sourceField",
      "sourceValue",
      "implementationNote",
      "physicalImmediateOnly",
      "treatmentGateRaw",
      "selfStaunchLikelihood",
      "selfStaunchWindow",
      "minTotalDamage",
      "minDamageReason",
      "mortalityState",
      "critBand",
      "critIndex",
      "bodyText",
      "sourceNotes",
      "CRITICAL_RESULTS",
      "CRITICAL_EFFECT_TEMPLATES",
      "criticalEffectsTableData",
      "AppFacing_Crits",
      "AppFacing_Effects",
      ".xlsx",
      "sha256",
      "manifest",
      "fixture",
      "Pilot",
      "c1-2026",
      "codex review",
    ]) {
      expect(markdown, `page must not publish ${JSON.stringify(forbidden)}`).not.toContain(
        forbidden,
      );
    }

    /* `C1` as a standalone token, without catching ordinary words that contain those letters. */
    expect(markdown, "page must not use C1 implementation vocabulary").not.toMatch(/\bC1\b/);

    /* No authoritative row key may leak in its literal `family|location|NN` form. */
    for (const result of CRITICAL_RESULTS) {
      expect(markdown, `page must not publish the row key ${result.critKey}`).not.toContain(
        result.critKey,
      );
    }

    /* The excluded fields must not have become columns under their own names either. */
    const headers = new Set(
      blocks.flatMap((block) => (block.type === "table" ? block.rows[0] : [])),
    );
    for (const header of headers) {
      expect(header).not.toMatch(/key|tag|flag|source|manifest|fixture|version|diagnostic/i);
    }
  });

  it("never publishes an underscored internal code in any cell", async () => {
    /*
     * Forgejo #747 added a guard forbidding underscored tag, flag and location values in result
     * *titles* in the authoritative data. That guard does not cover this page's other columns, and
     * two fields it publishes are underscored codes at source: `mortalityState` (108 rows carry
     * `mortally_wounded` and friends) and each effect's `target` (927 template rows carry
     * `general_action`, `lower_leg` and so on). Those reach the reader only through a label map and
     * a word transformation, so this asserts the outcome rather than trusting either.
     *
     * No authored text field in the authoritative data contains an underscore, so any underscore in
     * a rendered cell means a code leaked.
     */
    const sectioned = await readSectionedRows();

    expect(sectioned.length).toBe(CRITICAL_RESULTS.length);

    for (const { row } of sectioned) {
      for (const [column, value] of Object.entries(row)) {
        expect(
          value,
          `${column} published an underscored code: ${JSON.stringify(value)}`,
        ).not.toMatch(/_/);
      }
    }
  });

  it("gives every family and location a section and lists it in the contents", async () => {
    const markdown = await readDocumentMarkdown();
    const blocks = parseMarkdownBlocks(markdown);

    const sectionHeadings = blocks
      .filter((block) => block.type === "heading" && block.level === 3)
      .map((block) => (block.type === "heading" ? block.text : ""));

    const combinations = new Set(
      CRITICAL_RESULTS.map((result) => `${result.family}|${result.location}`),
    );

    expect(sectionHeadings.length).toBe(combinations.size);
    expect(new Set(sectionHeadings).size).toBe(sectionHeadings.length);

    /*
     * Every section must be reachable from the contents. The link targets are the renderer's own
     * heading-id contract, so a contents entry that does not match its heading would hand the
     * reader an anchor that leads nowhere.
     */
    for (const heading of sectionHeadings) {
      const slug = heading
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_ -]+/gu, "")
        .trim()
        .replace(/ /g, "-");

      expect(markdown, `contents must link to "${heading}"`).toContain(`[${heading}](#${slug})`);
    }
  });
});
