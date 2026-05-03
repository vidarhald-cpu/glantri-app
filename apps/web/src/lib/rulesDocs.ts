import fs from "node:fs/promises";
import path from "node:path";

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
    description: "Manual reference for the main Character Sheet values, skill XP columns, characteristics, and chargen-rule displays.",
    fileName: "character-sheet-calculations.md",
    id: "character-sheet-calculations",
    order: 10,
    section: "Character",
    title: "Character Sheet Calculations"
  },
  {
    audience: "Players and GM reviewers",
    description: "Manual reference for profile rolls, stat resolution, social class, education, skill points, skill-group costs, choices, and finalization.",
    fileName: "chargen-calculations.md",
    id: "chargen-calculations",
    order: 15,
    section: "Chargen",
    title: "Chargen Calculations"
  },
  {
    audience: "Players and GM reviewers",
    description: "Manual reference for item ENC, carried load, inventory location, material/quality modifiers, and encumbrance effects.",
    fileName: "equipment-encumbrance-calculations.md",
    id: "equipment-encumbrance-calculations",
    order: 20,
    section: "Equipment",
    title: "Equipment & Encumbrance Calculations"
  },
  {
    audience: "Players and GM reviewers",
    description: "Manual reference for equipped items, weapon rows, armor modifiers, carried load, movement, and combat values.",
    fileName: "combat-loadout-calculations.md",
    id: "combat-loadout-calculations",
    order: 30,
    section: "Combat / Equipment",
    title: "Equip Items Calculations"
  }
];

function getRulesDocsDirectory(): string {
  const cwd = process.cwd();

  if (path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps") {
    return path.resolve(cwd, "../../docs/rules");
  }

  return path.resolve(cwd, "docs/rules");
}

export function getRulesDocuments(): RulesDocumentRegistryEntry[] {
  return [...rulesDocumentsRegistry].sort((left, right) => left.order - right.order);
}

export function getRulesDocumentEntryById(
  id: string | undefined
): RulesDocumentRegistryEntry {
  const documents = getRulesDocuments();
  return documents.find((document) => document.id === id) ?? documents[0];
}

export async function readRulesDocumentMarkdown(
  entry: RulesDocumentRegistryEntry
): Promise<string> {
  const filePath = path.join(getRulesDocsDirectory(), entry.fileName);
  return fs.readFile(filePath, "utf8");
}

export async function getRulesDocumentById(id: string | undefined): Promise<RulesDocument> {
  const entry = getRulesDocumentEntryById(id);

  return {
    ...entry,
    markdown: await readRulesDocumentMarkdown(entry)
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
    selectedDocument
  };
}
