import type { TargetLearningGroup, TargetLearningGroupCatalogue } from "@glantri/shared";
import { canonicalJsonSha256, sha256 } from "../integrity/canonicalSha256";
import { fullSkillCatalogueProposal } from "./fullSkillCatalogueProposal";
import {
  fullLearningGroupsSource,
  martialLearningGroupsSource,
} from "./targetLearningGroupsSource";

const sourceDefinitions = [
  {
    markdown: fullLearningGroupsSource,
    path: "docs/source/learning-groups/Glantri_Full_Catalogue_Learning_Groups_PO_Proposal.md.txt",
    sha256: "35b1441dbc99e217a02ae20f84e28548c8e0f6a6a8036cfa6b9ae270f682f4ae",
  },
  {
    markdown: martialLearningGroupsSource,
    path: "docs/source/learning-groups/Glantri_Learning_Groups_Martial_Revision_PO_Proposal.md.txt",
    sha256: "4008a7af299d65933238a45150056c684ce051893cd79f007af9cebb89e228d1",
  },
] as const;

function fail(message: string): never {
  throw new Error(`Invalid target Learning Group source: ${message}`);
}

const shortDescriptionMarker = "**Short description.**";

/**
 * The next `**Label**` marker opening a line, matching the boundary `sectionText` and `inlineField`
 * already use in `fullSkillCatalogueProposal.ts`.
 */
const nextLabelMarker = /\n\*\*[^*\n]+\*\*/;

/**
 * Split the authored prose that follows `**Short description.**` into the short-description
 * paragraph and the remaining description paragraphs. The region ends at the next `**Label**`
 * marker rather than at the first newline or the first blank line, so a description holds and
 * preserves multi-paragraph authored text without the surrounding positional parse of member rows,
 * boundaries and provenance depending on where paragraph breaks fall.
 */
function parseDescriptionSections(
  block: string,
  groupId: string,
): { shortDescription: string; description: string } {
  const start = block.indexOf(shortDescriptionMarker);
  if (start < 0) fail(`missing short description in ${groupId}`);
  const tail = block.slice(start + shortDescriptionMarker.length);
  const nextLabel = tail.search(nextLabelMarker);
  const sections = (nextLabel < 0 ? tail : tail.slice(0, nextLabel)).trim();
  const paragraphBreak = sections.search(/\n[ \t]*\n/);
  const shortDescription = (
    paragraphBreak < 0 ? sections : sections.slice(0, paragraphBreak)
  ).trim();
  if (!shortDescription) fail(`missing short description in ${groupId}`);
  return {
    shortDescription,
    description: paragraphBreak < 0 ? "" : sections.slice(paragraphBreak).trim(),
  };
}

/** Parse only explicit group pages; reverse indexes and historical assertions are not memberships. */
export function parseTargetLearningGroupPages(
  markdown: string,
  sourcePath: string,
  sourceSha256: string,
): TargetLearningGroup[] {
  const headings = [...markdown.matchAll(/^### ([GF]\d{2}) — (.+)$/gm)];
  const entries = new Map(fullSkillCatalogueProposal.entries.map((entry) => [entry.id, entry]));
  return headings.map((heading, index) => {
    const start = heading.index!;
    const tail = markdown.slice(start, headings[index + 1]?.index ?? markdown.length);
    const block = tail
      .split(/\n## /)[0]!
      .replace(/\n<a id="[^"\n]+"><\/a>\s*$/, "")
      .trim();
    const { shortDescription, description } = parseDescriptionSections(block, heading[1]!);
    const boundaryMarker = block.includes("**Exclusions and boundaries**")
      ? "**Exclusions and boundaries**"
      : "**Explicit exclusions**";
    const boundarySection =
      block.split(boundaryMarker)[1]?.split("**Provenance / review annotation.**")[0] ??
      fail(`missing boundaries in ${heading[1]}`);
    const annotation =
      block.split("**Provenance / review annotation.**")[1]?.trim() ??
      fail(`missing provenance in ${heading[1]}`);
    const rows = block.split("\n").filter((line) => line.startsWith("| `"));
    const members: TargetLearningGroup["members"] = rows.map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      if (cells.length !== 4) fail(`invalid member row in ${heading[1]}`);
      const identity =
        cells[0]!.match(/^`([^`]+)` — (.+)$/) ?? fail(`invalid member identity in ${heading[1]}`);
      const entry = entries.get(identity[1]!) ?? fail(`unknown competency ${identity[1]}`);
      const kind =
        cells[1] === "Base Skill"
          ? "base-skill"
          : cells[1]!.startsWith("Specialization;")
            ? "specialization"
            : fail(`unknown type ${cells[1]}`);
      const parentId =
        kind === "specialization"
          ? (cells[1]!.match(/parent:? `([^`]+)`/)?.[1] ?? fail(`missing parent for ${entry.id}`))
          : undefined;
      if (
        entry.competencyType !== kind ||
        entry.name !== identity[2] ||
        entry.parent?.id !== parentId
      )
        fail(`identity/type/parent mismatch for ${entry.id}`);
      return {
        competencyId: entry.id,
        name: entry.name,
        kind,
        parentId,
        practice: cells[2]!,
        sourceStatus: cells[3]!,
      };
    });
    if (
      !description ||
      !members.length ||
      new Set(members.map((member) => member.competencyId)).size !== members.length
    )
      fail(`empty/duplicate group ${heading[1]}`);
    return {
      id: heading[1]!,
      name: heading[2]!,
      shortDescription,
      description,
      equipment: block.match(/\*\*Equipment and taught practice\.\*\* ([^\n]+)/)?.[1],
      boundaries: boundarySection
        .split("\n")
        .filter((line) => line.startsWith("- "))
        .map((line) => line.slice(2)),
      members,
      provenance: {
        annotation,
        sourcePath,
        sourceSha256,
        startLine: markdown.slice(0, start).split("\n").length,
        endLine: markdown.slice(0, start + block.length).split("\n").length,
      },
    };
  });
}

export function buildTargetLearningGroupCatalogue(): TargetLearningGroupCatalogue {
  const sources = sourceDefinitions.map((source) => {
    if (sha256(source.markdown) !== source.sha256) fail(`hash mismatch for ${source.path}`);
    return {
      path: source.path,
      sha256: source.sha256,
      byteSize: new TextEncoder().encode(source.markdown).length,
    };
  });
  const pages = sourceDefinitions.map((source) =>
    parseTargetLearningGroupPages(source.markdown, source.path, source.sha256),
  );
  const groupsById = new Map(pages[0]!.map((group) => [group.id, group]));
  const replacements = new Set(["G08", "F30", "F31", "F32"]);
  const additions = new Set(["F35", "F36", "F37", "F38", "F39", "F40", "F41"]);
  if (groupsById.size !== 52 || pages[1]!.length !== 11) fail("unexpected source roster");
  for (const group of pages[1]!) {
    if (groupsById.has(group.id) ? !replacements.has(group.id) : !additions.has(group.id))
      fail(`unapproved replacement/addition ${group.id}`);
    groupsById.set(group.id, group);
  }
  const groups = [...groupsById.values()];
  const members = groups.flatMap((group) => group.members);
  const baseMembers = members.filter((member) => member.kind === "base-skill");
  const groupedBaseIds = new Set(baseMembers.map((member) => member.competencyId));
  const grouplessBaseSkillIds = fullSkillCatalogueProposal.entries
    .filter((entry) => entry.competencyType === "base-skill" && !groupedBaseIds.has(entry.id))
    .map((entry) => entry.id);
  // Independently parse the supplied Pilot snapshot and verify every exact link against the integrated snapshot.
  const pilotSection = fullLearningGroupsSource
    .split("### Preserved groups and exact original memberships")[1]!
    .split("### Source identities and target display")[0]!;
  const pilotLearningGroups = pilotSection
    .split("\n")
    .filter((line) => /^\| G\d{2} \|/.test(line))
    .map((line) => {
      const cells = line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim());
      const matches = [...cells[2]!.matchAll(/`([^`]+)` — ([^;]+)/g)];
      return {
        id: cells[0]!,
        name: cells[1]!,
        skillIds: matches.map((match) => match[1]!),
        skillNames: matches.map((match) => match[2]!.trim()),
      };
    });
  if (
    canonicalJsonSha256(pilotLearningGroups) !==
    canonicalJsonSha256(fullSkillCatalogueProposal.pilotLearningGroups)
  )
    fail("Pilot snapshot differs from integrated provenance");
  const catalogue = {
    schemaVersion: "target-learning-groups/v1" as const,
    status: "approved-reference" as const,
    groups,
    grouplessBaseSkillIds,
    pilotLearningGroups,
    sources,
  };
  const manifest = {
    groups: groups.length,
    baseMemberships: baseMembers.length,
    specializationMemberships: members.length - baseMembers.length,
    totalMemberships: members.length,
    groupedBaseSkills: groupedBaseIds.size,
    grouplessBaseSkills: grouplessBaseSkillIds.length,
    pilotGroups: pilotLearningGroups.length,
    pilotLinks: pilotLearningGroups.reduce((sum, group) => sum + group.skillIds.length, 0),
    digest: canonicalJsonSha256(catalogue),
  };
  if (
    manifest.groups !== 59 ||
    manifest.baseMemberships !== 153 ||
    manifest.specializationMemberships !== 7 ||
    manifest.groupedBaseSkills !== 92 ||
    manifest.grouplessBaseSkills !== 41 ||
    manifest.pilotGroups !== 18 ||
    manifest.pilotLinks !== 46
  )
    fail("catalogue inventory mismatch");
  return { ...catalogue, manifest };
}

/** Reference export only: no Chargen/runtime registration. */
export const targetLearningGroupCatalogue = buildTargetLearningGroupCatalogue();
