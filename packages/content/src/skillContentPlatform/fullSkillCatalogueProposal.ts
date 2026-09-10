import { canonicalJsonSha256, sha256 } from "../integrity/canonicalSha256";
import { fullSkillCatalogueProposalSourceMarkdown } from "./fullSkillCatalogueProposalSource";

export const FULL_SKILL_CATALOGUE_PROPOSAL_SCHEMA_VERSION =
  "full-skill-catalogue-proposal/v1" as const;
export const FULL_SKILL_CATALOGUE_SOURCE_SHA256 =
  "0bedd313d7d49b3cf4846008b75bf126cf956a985f8d1cc9dcab1ef9446b8376" as const;
export const FULL_SKILL_CATALOGUE_SOURCE_SIZE = 355_963;

export type FullSkillCatalogueCompetencyType =
  | "base-skill"
  | "specialization"
  | "spoken-language"
  | "written-tradition";

export interface FullSkillCatalogueEntry {
  archSkillAnnotation: string;
  boundaries: readonly string[];
  compatibilityNote?: string;
  competencyType: FullSkillCatalogueCompetencyType;
  context: string;
  description: string;
  domain: string;
  id: string;
  idStatus: string;
  learningGroupAnnotation: string;
  name: string;
  parent?: {
    id: string;
    name: string;
    note?: string;
  };
  provenance: string;
  shortDescription: string;
  typicalUses: readonly string[];
}

export interface FullSkillCatalogueSupportScript {
  id: string;
  name: string;
  status: string;
  writtenAssociation: string;
}

export interface FullSkillCatalogueUnresolvedBinding {
  evidence: string;
  name: string;
  sourceIdentity: string;
  unresolvedItem: string;
}

export interface FullSkillCatalogueLearningGroup {
  id: string;
  membershipStatus: string;
  name: string;
  participantIds: readonly string[];
  participantNames: readonly string[];
}

export interface FullSkillCataloguePilotLearningGroup {
  id: string;
  name: string;
  skillIds: readonly string[];
  skillNames: readonly string[];
}

export interface FullSkillCatalogueArchSkill {
  description: string;
  id: string;
  name: string;
  participantIds: readonly string[];
  participantNames: readonly string[];
}

export interface FullSkillCatalogueException {
  effect: string;
  item: string;
  unresolved: string;
}

export interface FullSkillCatalogueProposal {
  archSkills: readonly FullSkillCatalogueArchSkill[];
  entries: readonly FullSkillCatalogueEntry[];
  exceptions: readonly FullSkillCatalogueException[];
  learningGroups: readonly FullSkillCatalogueLearningGroup[];
  manifest: {
    archSkills: number;
    baseSkills: number;
    competencies: number;
    learningGroups: number;
    pilotLearningGroups: number;
    pilotLearningGroupLinks: number;
    proposalDigest: `sha256:${string}`;
    specializations: number;
    spokenLanguages: number;
    supportScripts: number;
    unresolvedBindings: number;
    writtenTraditions: number;
  };
  pilotLearningGroups: readonly FullSkillCataloguePilotLearningGroup[];
  schemaVersion: typeof FULL_SKILL_CATALOGUE_PROPOSAL_SCHEMA_VERSION;
  source: {
    byteSize: number;
    path: string;
    sha256: typeof FULL_SKILL_CATALOGUE_SOURCE_SHA256;
  };
  status: "proposal";
  supportScripts: readonly FullSkillCatalogueSupportScript[];
  title: string;
  unresolvedBindings: readonly FullSkillCatalogueUnresolvedBinding[];
}

interface MarkdownTable {
  headers: readonly string[];
  rows: readonly (readonly string[])[];
}

function fail(message: string): never {
  throw new Error(`Invalid full Skill catalogue proposal source: ${message}`);
}

function section(markdown: string, title: string, nextTitle?: string): string {
  const startMarker = `## ${title}`;
  const start = markdown.indexOf(startMarker);
  if (start < 0) fail(`missing section "${title}".`);
  const bodyStart = start + startMarker.length;
  const end = nextTitle ? markdown.indexOf(`## ${nextTitle}`, bodyStart) : markdown.length;
  if (end < 0) fail(`missing section boundary "${nextTitle}".`);
  return markdown.slice(bodyStart, end).trim();
}

function sectionText(block: string, label: string, nextLabel: string): string {
  const startMarker = `**${label}**`;
  const endMarker = `**${nextLabel}**`;
  const start = block.indexOf(startMarker);
  const end = block.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) fail(`missing ${label} or ${nextLabel} section in an entry.`);
  return block.slice(start + startMarker.length, end).trim();
}

function listSection(block: string, label: string, nextLabel: string): string[] {
  const value = sectionText(block, label, nextLabel);
  const items = value
    .split("\n")
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim());
  if (items.length === 0) fail(`empty ${label} list.`);
  return items;
}

function inlineField(block: string, label: string, optional = false): string | undefined {
  const marker = `**${label}:**`;
  const start = block.indexOf(marker);
  if (start < 0) {
    if (optional) return undefined;
    fail(`missing ${label} field.`);
  }
  const valueStart = start + marker.length;
  const tail = block.slice(valueStart);
  const nextField = tail.search(/\n(?:\n)?\*\*[^*\n]+\*\*/);
  return (nextField < 0 ? tail : tail.slice(0, nextField)).trim();
}

function parseEntryBlocks(markdown: string): { heading: string; block: string }[] {
  const heading = /^(#{3,4}) ([^\n]+)\n\n\*\*ID:\*\* `[^`]+`/gm;
  const matches = [...markdown.matchAll(heading)];
  return matches.map((match) => {
    const level = match[1]!.length;
    const laterHeading = /^#{2,4} /gm;
    laterHeading.lastIndex = match.index! + match[0].length;
    let end = markdown.length;
    for (
      let candidate = laterHeading.exec(markdown);
      candidate;
      candidate = laterHeading.exec(markdown)
    ) {
      const candidateLevel = candidate[0]!.indexOf(" ");
      if (candidateLevel <= level) {
        end = candidate.index;
        break;
      }
    }
    return { heading: match[2]!, block: markdown.slice(match.index, end).trim() };
  });
}

function competencyType(value: string): FullSkillCatalogueCompetencyType {
  const types: Record<string, FullSkillCatalogueCompetencyType> = {
    "Base Skill": "base-skill",
    Specialization: "specialization",
    "Spoken language": "spoken-language",
    "Written tradition": "written-tradition",
  };
  return types[value.trim()] ?? fail(`unknown competency type "${value}".`);
}

function parseEntry(heading: string, block: string): FullSkillCatalogueEntry {
  const idMatch = block.match(/\*\*ID:\*\* `([^`]+)`/);
  const name = inlineField(block, "Name")!;
  const parentValue = inlineField(block, "Parent", true);
  const parentMatch = parentValue?.match(/^(.+?) — `([^`]+)`(?: \((.+)\))?$/);
  if (parentValue && !parentMatch) fail(`invalid parent declaration for ${name}.`);
  if (name !== heading) fail(`heading/name mismatch for ${name}.`);
  return {
    archSkillAnnotation: inlineField(block, "Arch Skills")!,
    boundaries: listSection(block, "Boundaries", "Review annotations"),
    compatibilityNote: inlineField(block, "Ruling / compatibility note", true),
    competencyType: competencyType(inlineField(block, "Competency type")!),
    context: inlineField(block, "Context")!,
    description: sectionText(block, "Full description", "Typical uses"),
    domain: inlineField(block, "Domain")!,
    id: idMatch?.[1] ?? fail(`missing ID for ${name}.`),
    idStatus: inlineField(block, "ID status")!,
    learningGroupAnnotation: inlineField(block, "Learning Groups")!,
    name,
    parent: parentMatch
      ? { id: parentMatch[2]!, name: parentMatch[1]!, note: parentMatch[3] }
      : undefined,
    provenance: inlineField(block, "Provenance")!,
    shortDescription: sectionText(block, "Short description", "Full description"),
    typicalUses: listSection(block, "Typical uses", "Boundaries"),
  };
}

function tableCells(line: string): string[] {
  return line
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
}

function parseTables(markdown: string): MarkdownTable[] {
  const lines = markdown.split("\n");
  const tables: MarkdownTable[] = [];
  for (let index = 0; index < lines.length - 1; index += 1) {
    const line = lines[index]!;
    const separator = lines[index + 1]!;
    if (!line.startsWith("|") || !/^\|(?:\s*:?-+:?\s*\|)+$/.test(separator)) continue;
    const headers = tableCells(line);
    const rows: string[][] = [];
    index += 2;
    while (index < lines.length && lines[index]!.startsWith("|")) {
      const row = tableCells(lines[index]!);
      if (row.length !== headers.length) fail(`table row does not match ${headers.join(", ")}.`);
      rows.push(row);
      index += 1;
    }
    tables.push({ headers, rows });
  }
  return tables;
}

function namesAndIds(entries: readonly FullSkillCatalogueEntry[]) {
  const byName = new Map(entries.map((entry) => [entry.name, entry.id]));
  return (cell: string) => {
    const names = cell.split(";").map((name) => name.trim());
    const ids = names.map((name) => byName.get(name) ?? fail(`unknown participant "${name}".`));
    return { names, ids };
  };
}

function buildProposal(): FullSkillCatalogueProposal {
  const markdown = fullSkillCatalogueProposalSourceMarkdown;
  const digest = sha256(markdown);
  const byteSize = new TextEncoder().encode(markdown).length;
  if (digest !== FULL_SKILL_CATALOGUE_SOURCE_SHA256)
    fail(`source digest ${digest} does not match ${FULL_SKILL_CATALOGUE_SOURCE_SHA256}.`);
  if (byteSize !== FULL_SKILL_CATALOGUE_SOURCE_SIZE)
    fail(`source size ${byteSize} does not match ${FULL_SKILL_CATALOGUE_SOURCE_SIZE}.`);

  const entries = parseEntryBlocks(markdown).map(({ heading, block }) =>
    parseEntry(heading, block),
  );
  const uniqueIds = new Set(entries.map(({ id }) => id));
  if (entries.length !== 172 || uniqueIds.size !== 172)
    fail(`expected 172 unique competency IDs, found ${entries.length}/${uniqueIds.size}.`);
  if (entries.some(({ name }) => name === "Heart Surgery")) fail("Heart Surgery must be excluded.");
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));
  entries.forEach((entry) => {
    if (entry.competencyType === "specialization" && !entry.parent)
      fail(`Specialization ${entry.id} has no parent.`);
    if (entry.parent && !entriesById.has(entry.parent.id))
      fail(`Specialization ${entry.id} has unknown parent ${entry.parent.id}.`);
  });

  const scriptTables = parseTables(
    section(
      markdown,
      "Script support and unresolved language bindings",
      "Learning Group preservation and full-catalogue annotations",
    ),
  );
  const supportScripts =
    scriptTables[0]?.rows.map(([id, name, writtenAssociation, status]) => ({
      id: id!,
      name: name!,
      status: status!,
      writtenAssociation: writtenAssociation!,
    })) ?? fail("missing support-script table.");
  const unresolvedBindings =
    scriptTables[1]?.rows.map(([sourceIdentity, name, unresolvedItem, evidence]) => ({
      evidence: evidence!,
      name: name!,
      sourceIdentity: sourceIdentity!,
      unresolvedItem: unresolvedItem!,
    })) ?? fail("missing unresolved-binding table.");

  const groupTables = parseTables(
    section(
      markdown,
      "Learning Group preservation and full-catalogue annotations",
      "Arch-Skill reference and coverage",
    ),
  );
  const pilotLearningGroups =
    groupTables[0]?.rows.map(([id, name, memberships]) => {
      const matches = [...memberships!.matchAll(/(?:^|;)\s*(.*?) \(`([^`]+)`\)/g)];
      return {
        id: id!,
        name: name!,
        skillIds: matches.map((match) => match[2]!),
        skillNames: matches.map((match) => match[1]!),
      };
    }) ?? fail("missing Pilot Learning Group table.");
  const resolveParticipants = namesAndIds(entries);
  const learningGroups =
    groupTables[1]?.rows.map(([id, name, participants, membershipStatus]) => {
      const resolved = resolveParticipants(participants!);
      return {
        id: id!,
        membershipStatus: membershipStatus!,
        name: name!,
        participantIds: resolved.ids,
        participantNames: resolved.names,
      };
    }) ?? fail("missing future Learning Group table.");

  const archTables = parseTables(
    section(markdown, "Arch-Skill reference and coverage", "Exception list"),
  );
  const archSkills =
    archTables[0]?.rows.map(([id, name, description, participants]) => {
      const resolved = resolveParticipants(participants!);
      return {
        description: description!,
        id: id!,
        name: name!,
        participantIds: resolved.ids,
        participantNames: resolved.names,
      };
    }) ?? fail("missing Arch-Skill table.");

  const exceptionTables = parseTables(section(markdown, "Exception list", "Consistency audit"));
  const exceptions =
    exceptionTables[0]?.rows.map(([item, unresolved, effect]) => ({
      effect: effect!,
      item: item!,
      unresolved: unresolved!,
    })) ?? fail("missing exception table.");

  const counts = (type: FullSkillCatalogueCompetencyType) =>
    entries.filter((entry) => entry.competencyType === type).length;
  const pilotLearningGroupLinks = pilotLearningGroups.reduce(
    (total, group) => total + group.skillIds.length,
    0,
  );
  const proposalWithoutDigest = {
    archSkills,
    entries,
    exceptions,
    learningGroups,
    pilotLearningGroups,
    schemaVersion: FULL_SKILL_CATALOGUE_PROPOSAL_SCHEMA_VERSION,
    source: {
      byteSize,
      path: "/Users/vidarhald/Documents/Glantri local/Glantri_Complete_Competency_Catalogue_Reader_Prose.md",
      sha256: FULL_SKILL_CATALOGUE_SOURCE_SHA256,
    },
    status: "proposal" as const,
    supportScripts,
    title: "Full competency catalogue — reader prose proposal",
    unresolvedBindings,
  };
  const manifest = {
    archSkills: archSkills.length,
    baseSkills: counts("base-skill"),
    competencies: entries.length,
    learningGroups: learningGroups.length,
    pilotLearningGroups: pilotLearningGroups.length,
    pilotLearningGroupLinks,
    proposalDigest: canonicalJsonSha256(proposalWithoutDigest),
    specializations: counts("specialization"),
    spokenLanguages: counts("spoken-language"),
    supportScripts: supportScripts.length,
    unresolvedBindings: unresolvedBindings.length,
    writtenTraditions: counts("written-tradition"),
  };
  if (
    manifest.baseSkills !== 131 ||
    manifest.specializations !== 26 ||
    manifest.spokenLanguages !== 12 ||
    manifest.writtenTraditions !== 3 ||
    manifest.supportScripts !== 3 ||
    manifest.unresolvedBindings !== 9 ||
    manifest.pilotLearningGroups !== 18 ||
    manifest.pilotLearningGroupLinks !== 46 ||
    manifest.learningGroups !== 21 ||
    manifest.archSkills !== 46
  ) {
    fail(`manifest does not match the authored inventory: ${JSON.stringify(manifest)}.`);
  }
  return { ...proposalWithoutDigest, manifest };
}

export const fullSkillCatalogueProposal = buildProposal();
