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

export const rulesDocumentsRegistry: RulesDocumentRegistryEntry[] = [
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
    audience: "Players, GMs, and rules reviewers",
    description:
      "Canonical Pilot v1 reference for Skill weights, learning histories, relationships, Specializations, DS/AB access, budgets, language finalization, and Gate A golden Characters.",
    fileName: "pilot-skill-rules-v1.md",
    id: "pilot-skill-rules-v1",
    order: 7,
    section: "Skills",
    title: "Pilot Skill Rules v1",
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
];

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
