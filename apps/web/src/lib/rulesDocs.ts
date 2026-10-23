import fs from "node:fs/promises";
import path from "node:path";

import {
  expandClosedDieRuleTable,
  HIT_LOCATION_RULE_TABLE,
  type ClosedDieRuleTable,
} from "@glantri/domain";

export interface RulesDocumentRegistryEntry {
  audience: string;
  description: string;
  fileName: string;
  id: string;
  order: number;
  section: string;
  title: string;
}

export interface RulesDocument extends RulesDocumentRegistryEntry {
  markdown: string;
}

/**
 * Why a `docs/rules` page is deliberately absent from the reader registry below.
 *
 * - `bulk-reference`: a large generated catalogue reached from a registered page, not read linearly.
 * - `embedded`: its canonical table is rendered into registered pages by a `{{rule-table:...}}`
 *   directive, so the standalone page would duplicate reader-visible content.
 * - `historical`: retained provenance or a superseded baseline; kept in the repository, not
 *   presented as current reader material.
 * - `index`: a navigation or compatibility page, not a rules page.
 * - `internal`: source coordinates, workbook provenance, implementation mapping or open questions.
 *   Per `docs/rules/README.md` these stay out of the Player and GM routes.
 * - `non-runtime`: a settled reconciliation or candidate catalogue that authorizes no runtime
 *   behaviour, so it describes nothing a reader can currently do in the app.
 * - `unrouted`: current table-facing material whose reader route is not settled. Classification is
 *   owned by the audience-taxonomy work (Forgejo #589) and the consolidation lane (Forgejo #609);
 *   it is **not** resolved by registering the page here.
 */
export type UnregisteredRulesDocumentReason =
  | "bulk-reference"
  | "embedded"
  | "historical"
  | "index"
  | "internal"
  | "non-runtime"
  | "unrouted";

/**
 * Every `docs/rules/**\/*.md` page that is intentionally not reader-exposed, keyed by its path
 * relative to `docs/rules`.
 *
 * This list exists so registry drift fails a test instead of review: `rulesDocs.test.ts` asserts
 * that the pages on disk are exactly the registered pages plus these, so a new or renamed page
 * cannot land unclassified and a deleted page cannot leave a stale entry behind.
 *
 * Adding a page here does not publish it, and a page must never be registered merely to satisfy
 * an accessibility check (`docs/process/task-contract.md:195-198`).
 */
export const unregisteredRulesDocuments: Record<string, UnregisteredRulesDocumentReason> = {
  "README.md": "index",
  "ambiguity-log.md": "internal",
  "armor-workbook.md": "internal",
  "combat-action-rule-inventory.md": "internal",
  "combat-attack-and-defense.md": "internal",
  "combat-declarations.md": "unrouted",
  "combat-distance.md": "unrouted",
  "combat-hit-location.md": "embedded",
  "combat-initiative-workbook.md": "internal",
  "combat-modifier-calculation.md": "internal",
  "combat-ob-dmb-workbook.md": "internal",
  "competency-reference/README.md": "index",
  "competency-reference/gaps-and-exceptions.md": "bulk-reference",
  "competency-reference/learning-groups.md": "bulk-reference",
  "competency-reference/profession-learning-group-skills.md": "bulk-reference",
  "competency-reference/professions.md": "bulk-reference",
  "competency-reference/skills.md": "bulk-reference",
  "competency-reference/societies.md": "bulk-reference",
  "encumbrance-and-movement-workbook.md": "internal",
  "internal/parry-notes.md": "internal",
  "observe-opponent.md": "unrouted",
  "offensive-parry.md": "unrouted",
  "parry.md": "index",
  "pilot-skill-content-release-v1.md": "historical",
  "pilot-skill-rules-v1.md": "historical",
  "secondary-critical-sec-grammar-decision-memo.md": "historical",
  "secondary-critical-sec-grammar.md": "non-runtime",
  "source-mapping.md": "internal",
  "target-critical-catalogue-v1.md": "non-runtime",
};

export const rulesDocumentsRegistry: RulesDocumentRegistryEntry[] = [
  {
    audience: "Players, GMs, and rules reviewers",
    description:
      "Current Competency authority: how Skills, Learning Groups, and Professions relate, availability by Society Level and Social Band, and what chargen grants.",
    fileName: "competency-rules.md",
    id: "competency-rules",
    order: 7,
    section: "Skills",
    title: "Competency Rules",
  },
  {
    audience: "Players, GMs, admins, and rules reviewers",
    description:
      "Canonical retained Character authority for acquisition events, effective Skills, headless finalization, Campaign exclusivity, migration lineage, snapshots, and provenance privacy.",
    fileName: "retained-character-ledger.md",
    id: "retained-character-ledger",
    order: 9,
    section: "Character",
    title: "Retained Character Ledger and Headless Chargen",
  },
  {
    audience: "Players and GM reviewers",
    description:
      "Manual reference for profile rolls, stat resolution, social class, education, skill points, skill-group costs, choices, and finalization.",
    fileName: "chargen-calculations.md",
    id: "chargen-calculations",
    order: 5,
    section: "Chargen",
    title: "Chargen Calculations",
  },
  {
    audience: "Players and GM reviewers",
    description:
      "Manual reference for the main Character Sheet values, skill XP columns, characteristics, and chargen-rule displays.",
    fileName: "character-sheet-calculations.md",
    id: "character-sheet-calculations",
    order: 10,
    section: "Character",
    title: "Character Sheet Calculations",
  },
  {
    audience: "Players and GM reviewers",
    description:
      "Manual reference for checks, progression points, attempts, open-ended advancement rolls, thresholds, and progression history.",
    fileName: "character-progression-calculations.md",
    id: "character-progression-calculations",
    order: 15,
    section: "Character",
    title: "Character Progression Calculations",
  },
  {
    audience: "Players and GM reviewers",
    description:
      "Manual reference for item ENC, carried load, inventory location, material/quality modifiers, and encumbrance effects.",
    fileName: "equipment-encumbrance-calculations.md",
    id: "equipment-encumbrance-calculations",
    order: 20,
    section: "Equipment",
    title: "Equipment & Encumbrance Calculations",
  },
  {
    audience: "Players and GM reviewers",
    description:
      "Manual reference for equipped items, weapon rows, armor modifiers, carried load, movement, and combat values.",
    fileName: "combat-loadout-calculations.md",
    id: "combat-loadout-calculations",
    order: 30,
    section: "Combat / Equipment",
    title: "Equip Items Calculations",
  },
  {
    audience: "Players and GM reviewers",
    description:
      "Reader guide to a Combat round as it currently runs: the round steps, the declarable primary and secondary actions, explicit attack-source declaration including intrinsic Punch and Kick, the committed Scenario equipment projection and its reconciliation, Item interactions, distance, and the manoeuvres.",
    fileName: "combat-round-and-actions.md",
    id: "combat-round-and-actions",
    order: 32,
    section: "Combat",
    title: "Combat Round, Loadout and Actions",
  },
  {
    audience: "Players and GM reviewers",
    description: "Manual reference for the canonical combat to-hit hit/miss/grazing lookup.",
    fileName: "combat-to-hit.md",
    id: "combat-to-hit",
    order: 35,
    section: "Combat",
    title: "Glantri Combat To Hit / Damage",
  },
  {
    audience: "GM reviewers",
    description:
      "Manual reference for table-driven Critical results, the frozen C1 representative fixture rules, exact Stun/Bleed timing, and current runtime boundaries.",
    fileName: "combat-critical-effects.md",
    id: "combat-critical-effects",
    order: 40,
    section: "Combat",
    title: "Glantri Critical Effects",
  },
  {
    audience: "GM reviewers",
    description:
      "Manual reference for combat-start Combat Experience rolls, result bands, modifiers, durations, and current implementation boundaries.",
    fileName: "combat-experience.md",
    id: "combat-experience",
    order: 45,
    section: "Combat",
    title: "Combat Experience",
  },
  {
    audience: "Players and GM reviewers",
    description:
      "Player and GM reference for declaring Parry, the Dodge-derived declaration modifier, and the defender-owned open-ended incoming-attack Parry check.",
    fileName: "player/parry.md",
    id: "player-parry",
    order: 50,
    section: "Combat",
    title: "Parry — Player Rules",
  },
  {
    audience: "GM reviewers",
    description:
      "Ordered GM procedure for validating a Parry declaration, proxying or reviewing an incoming Parry check, clear/continue behavior, and current operational boundaries.",
    fileName: "gm/parry.md",
    id: "gm-parry",
    order: 55,
    section: "Combat",
    title: "Parry — GM Procedure",
  },
  {
    audience: "GM reviewers",
    description:
      "Critical values and effects the current application produces, including the critical roll with its subtracted armor critical modifier, per-grade modifiers, and the derivation of every value.",
    fileName: "gm/criticals.md",
    id: "gm-criticals",
    order: 60,
    section: "Combat",
    title: "Criticals — GM Value Reference",
  },
  {
    /*
     * An existing player-inclusive audience string, reused verbatim rather than invented: Forgejo
     * #670 owns the audience taxonomy and requires existing classifications be reused. `audience`
     * is usefulness, not confidentiality, and this is read-only rules reference material.
     */
    audience: "Players, GMs, and rules reviewers",
    description:
      "Every current Critical result, grouped by attack family and hit location and listed by result number, with its effects, damage floor, conditions, treatment, additional effects, and GM notes.",
    fileName: "critical-table.md",
    id: "critical-table",
    order: 65,
    section: "Tables",
    title: "Critical Table",
  },
];

/**
 * What the reader surface may do with one Markdown link target found inside a rules document.
 *
 * `document` and `fragment` carry a destination a reader can actually reach. `unrouted` means no
 * reader route exists for the target, so the surface renders the visible label as text instead of
 * handing the reader an anchor that leads nowhere. A page is never registered merely to turn an
 * `unrouted` target into a link — see `unregisteredRulesDocuments` above.
 */
export type RulesDocumentLinkResolution =
  | { href: string; kind: "document" | "external" | "fragment" }
  | { kind: "unrouted" };

/**
 * Resolve a `docs/rules`-relative link target against the directory of the document it was written
 * in, returning the path relative to `docs/rules`.
 *
 * `undefined` means the target climbs out of `docs/rules` entirely — `../decisions/...`,
 * `../audits/...` and `../recovery/...` all do — and so cannot name a reader page.
 */
function resolveDocsRulesRelativePath(
  sourceFileName: string,
  targetPath: string,
): string | undefined {
  const segments = sourceFileName.split("/").slice(0, -1);

  for (const segment of targetPath.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (segments.length === 0) {
        return undefined;
      }

      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.length > 0 ? segments.join("/") : undefined;
}

/**
 * Where a Markdown link inside a rules document should point on the reader surface.
 *
 * The registry above is the single source of truth for what is reader-routed; there is no second
 * list. A relative `.md` target is resolved against `sourceFileName`'s directory and matched
 * against the registered `fileName`s, so the same resolution covers `./combat-to-hit.md` from the
 * root, `./gm/criticals.md` into a subdirectory, and `../combat-round-and-actions.md` back out of
 * one. A registered match becomes the reader route the sidebar already uses today,
 * `/admin/rules-docs?doc=<id>`, keeping any `#fragment` the author wrote.
 *
 * `sourceFileName` may be omitted when the containing document is not known. Fragments and
 * ordinary web addresses still resolve; a relative target cannot, so it stays `unrouted` rather
 * than being guessed at.
 */
export function resolveRulesDocumentLink(
  target: string,
  sourceFileName?: string,
): RulesDocumentLinkResolution {
  if (target.startsWith("#")) {
    return { href: target, kind: "fragment" };
  }

  if (/^(https?|mailto):/i.test(target)) {
    return { href: target, kind: "external" };
  }

  /* Any other scheme, and any root-relative app path, is not a rules-document reference. */
  if (/^([a-z][a-z0-9+.-]*):/i.test(target) || target.startsWith("/")) {
    return { kind: "unrouted" };
  }

  const fragmentIndex = target.indexOf("#");
  const targetPath = fragmentIndex === -1 ? target : target.slice(0, fragmentIndex);
  const fragment = fragmentIndex === -1 ? "" : target.slice(fragmentIndex);

  if (!targetPath.endsWith(".md") || !sourceFileName) {
    return { kind: "unrouted" };
  }

  const resolvedPath = resolveDocsRulesRelativePath(sourceFileName, targetPath);

  if (!resolvedPath) {
    return { kind: "unrouted" };
  }

  const entry = rulesDocumentsRegistry.find((document) => document.fileName === resolvedPath);

  if (!entry) {
    return { kind: "unrouted" };
  }

  return {
    href: `/admin/rules-docs?doc=${encodeURIComponent(entry.id)}${fragment}`,
    kind: "document",
  };
}

const structuredRuleTables: Record<string, ClosedDieRuleTable> = {
  [HIT_LOCATION_RULE_TABLE.id]: HIT_LOCATION_RULE_TABLE,
};

function getRulesDocsDirectory(): string {
  const cwd = process.cwd();

  if (path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps") {
    return path.resolve(cwd, "../../docs/rules");
  }

  return path.resolve(cwd, "docs/rules");
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

export function renderClosedDieRuleTableMarkdown(table: ClosedDieRuleTable): string {
  const rows = expandClosedDieRuleTable(table);
  const notes = table.notes?.length ? ["", ...table.notes.map((note) => `- ${note}`)] : [];

  return [
    `| Roll | ${table.title} | Short | Key |`,
    "| ---: | --- | --- | --- |",
    ...rows
      .map((row) =>
        [
          row.roll.toString(),
          escapeMarkdownTableCell(row.fullLabel),
          escapeMarkdownTableCell(row.shortLabel),
          `\`${row.key}\``,
        ].join(" | "),
      )
      .map((row) => `| ${row} |`),
    ...notes,
  ].join("\n");
}

export function expandStructuredRuleTableDirectives(markdown: string): string {
  return markdown.replace(/\{\{rule-table:([a-z0-9-]+)\}\}/g, (directive, tableId: string) => {
    const table = structuredRuleTables[tableId];

    if (!table) {
      throw new Error(`Unknown structured rule table directive: ${directive}`);
    }

    return renderClosedDieRuleTableMarkdown(table);
  });
}

export function getRulesDocuments(): RulesDocumentRegistryEntry[] {
  return [...rulesDocumentsRegistry].sort((left, right) => left.order - right.order);
}

export function getRulesDocumentEntryById(id: string | undefined): RulesDocumentRegistryEntry {
  const documents = getRulesDocuments();
  return documents.find((document) => document.id === id) ?? documents[0];
}

export async function readRulesDocumentMarkdown(
  entry: RulesDocumentRegistryEntry,
): Promise<string> {
  const filePath = path.join(getRulesDocsDirectory(), entry.fileName);
  return expandStructuredRuleTableDirectives(await fs.readFile(filePath, "utf8"));
}

export async function getRulesDocumentById(id: string | undefined): Promise<RulesDocument> {
  const entry = getRulesDocumentEntryById(id);

  return {
    ...entry,
    markdown: await readRulesDocumentMarkdown(entry),
  };
}

export async function getRulesDocumentationPageModel(input?: {
  selectedDocumentId?: string;
}): Promise<{
  documents: RulesDocumentRegistryEntry[];
  selectedDocument: RulesDocument;
}> {
  const documents = getRulesDocuments();
  const selectedDocument = await getRulesDocumentById(input?.selectedDocumentId);

  return {
    documents,
    selectedDocument,
  };
}
