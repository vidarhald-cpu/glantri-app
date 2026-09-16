import {
  professionDefinitionSchema,
  professionFamilyDefinitionSchema,
  professionSkillMapSchema,
  skillGroupDefinitionSchema,
  targetRuntimeSkillDefinitionSchema,
} from "@glantri/domain";
import { sha256, canonicalJsonSha256 } from "./integrity/canonicalSha256";
import { targetProfessionSource } from "./targetProfessionSource";
import { fullSkillCatalogueProposal } from "./full-skill-catalogue-proposal";
import { targetLearningGroupCatalogue } from "./skillContentPlatform/targetLearningGroups";
import type { CanonicalContent } from "./types";

export const TARGET_PROFESSION_SOURCE_DIGEST =
  "548a81ec323321609fb7af1a2a78459450556dc32a4df5818965c10b2b48def6";
export interface TargetProfessionOpportunity {
  id: string;
  familyId: string;
  kind: "group" | "skill" | "specialization";
  targetId: string;
  route: string;
  description: string;
  sourceLine: number;
}
export interface TargetProfessionTrack {
  id: string;
  familyId: string;
  name: string;
  opportunityIds: string[];
  sourceLine: number;
}
export interface TargetProfessionFamily {
  id: string;
  code: string;
  name: string;
  description: string;
  sourceText: string;
  sourceLine: number;
  opportunities: TargetProfessionOpportunity[];
  tracks: TargetProfessionTrack[];
}
const fail = (message: string): never => {
  throw new Error(`Invalid approved Profession source: ${message}`);
};
const slug = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function buildTargetProfessionCatalogue() {
  if (sha256(targetProfessionSource) !== TARGET_PROFESSION_SOURCE_DIGEST) fail("digest mismatch");
  const groups = new Set(targetLearningGroupCatalogue.groups.map((g) => g.id));
  const competencies = new Map(fullSkillCatalogueProposal.entries.map((e) => [e.id, e]));
  const headings = [...targetProfessionSource.matchAll(/^### (P\d{2}) — (.+)$/gm)];
  const families: TargetProfessionFamily[] = headings.map((h, i) => {
    const block = targetProfessionSource
      .slice(h.index, headings[i + 1]?.index)
      .split('\n<a id="b"')[0]!;
    const id = block.match(/\*\*Working ID:\*\* `([^`]+)`/)?.[1] ?? fail("family ID");
    const opportunities: TargetProfessionOpportunity[] = [];
    const access =
      block.split("**Learning Group access")[1]?.split("**Society-Level")[0] ?? fail(id);
    for (const line of access.split("\n")) {
      const group = line.match(/^- \*\*([GF]\d{2}) — .+?\*\* — \*([^*]+)\* (.+)$/);
      const direct = line.match(
        /^- `([^`]+)` — \*\*.+?\*\* \((Skill|Specialization)\); \*([^*]+)\* (.+)$/,
      );
      if (!group && !direct) continue;
      const targetId = group?.[1] ?? direct![1]!;
      if (group ? !groups.has(targetId!) : !competencies.has(targetId!))
        fail(`unknown target ${targetId}`);
      const kind = group ? "group" : direct![2] === "Skill" ? "skill" : "specialization";
      opportunities.push({
        id: `${h[1]}-${group ? "LG" : "D"}-${targetId}`,
        familyId: id,
        kind,
        targetId: targetId!,
        route: (group?.[2] ?? direct![3]!).replace(/\.$/, ""),
        description: group?.[3] ?? direct![4]!,
        sourceLine: targetProfessionSource.slice(0, h.index! + block.indexOf(line)).split("\n")
          .length,
      });
    }
    return {
      id,
      code: h[1]!,
      name: h[2]!,
      description: block.match(/\*\*Short description:\*\* ([^\n]+)/)?.[1] ?? fail(id),
      sourceText: block.trim(),
      sourceLine: targetProfessionSource.slice(0, h.index).split("\n").length,
      opportunities,
      tracks: [],
    };
  });
  // Section G explicitly defines complete military compositions. Review route labels elsewhere
  // are not selectable tracks; PO ruling 6056 makes those opportunities additive family menus.
  const military =
    targetProfessionSource.split("## G.")[1]?.split('<a id="h"')[0] ?? fail("military section");
  for (const line of military.split("\n").filter((l) => /^\| \[P\d+ .*? — /.test(l))) {
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const code = cells[0]!.match(/\[(P\d+)/)![1];
    const family = families.find((f) => f.code === code) ?? fail(`military family ${code}`);
    const name = cells[0]!.split(" — ")[1]!;
    const groupIds = new Set(
      [...`${cells[2]} ${cells[3]}`.matchAll(/\b[GF]\d{2}\b/g)].map((m) => m[0]),
    );
    // Explicit optional support courses are access opportunities, not automatically purchased.
    if (code === "P26") groupIds.add("F06");
    if (code === "P27") groupIds.add("G09");
    if (code === "P28") groupIds.add("F28");
    const opportunityIds = family.opportunities
      .filter((o) =>
        o.kind === "group"
          ? groupIds.has(o.targetId)
          : o.targetId !== "longbow" || name === "Military longbow specialist",
      )
      .map((o) => o.id);
    for (const groupId of groupIds)
      if (!family.opportunities.some((o) => o.kind === "group" && o.targetId === groupId))
        fail(`${code} track group ${groupId}`);
    family.tracks.push({
      id: `${family.id}:${slug(name)}`,
      familyId: family.id,
      name,
      opportunityIds,
      sourceLine: targetProfessionSource.slice(0, targetProfessionSource.indexOf(line)).split("\n")
        .length,
    });
  }
  const opportunities = families.flatMap((f) => f.opportunities);
  if (
    families.length !== 84 ||
    opportunities.filter((o) => o.kind === "group").length !== 115 ||
    opportunities.filter((o) => o.kind !== "group").length !== 88 ||
    new Set(opportunities.map((o) => o.id)).size !== 203 ||
    families.flatMap((f) => f.tracks).length !== 21
  )
    fail("inventory");
  return {
    families,
    opportunities,
    sourceDigest: TARGET_PROFESSION_SOURCE_DIGEST,
    manifest: {
      families: 84,
      groupOpportunities: 115,
      directOpportunities: 88,
      explicitMilitaryTracks: 21,
      digest: canonicalJsonSha256(families),
    },
  };
}
export const targetProfessionCatalogue = buildTargetProfessionCatalogue();

/** One unbound Chargen projection; legacy payload remains available only to historical readers. */
export function withTargetLearningGroupsAndProfessions(
  content: CanonicalContent,
): CanonicalContent {
  const families = targetProfessionCatalogue.families;
  const groups = targetLearningGroupCatalogue.groups;
  const targetSkillIds = new Set(content.chargenCatalogue!.skillIds);
  return {
    ...content,
    professionFamilies: families.map((f) => professionFamilyDefinitionSchema.parse(f)),
    professions: families.flatMap((f) =>
      f.tracks.length
        ? f.tracks.map((t) =>
            professionDefinitionSchema.parse({
              id: t.id,
              familyId: f.id,
              name: `${f.name} — ${t.name}`,
              subtypeName: t.name,
              description: f.description,
            }),
          )
        : [
            professionDefinitionSchema.parse({
              id: f.id,
              familyId: f.id,
              name: f.name,
              subtypeName: f.name,
              description: f.description,
            }),
          ],
    ),
    professionSkills: families.flatMap((f) => {
      const maps = (
        opportunities: TargetProfessionOpportunity[],
        professionId: string,
        scope: "family" | "profession",
      ) =>
        opportunities.map((o) =>
          professionSkillMapSchema.parse({
            professionId,
            scope,
            grantType: o.kind === "group" ? "group" : "ordinary-skill",
            skillGroupId: o.kind === "group" ? o.targetId : undefined,
            skillId: o.kind === "skill" ? o.targetId : undefined,
            specializationId: o.kind === "specialization" ? o.targetId : undefined,
            isCore: false,
            ranks: 0,
          }),
        );
      if (!f.tracks.length) return maps(f.opportunities, f.id, "family");
      const common = f.opportunities.filter((o) =>
        f.tracks.every((t) => t.opportunityIds.includes(o.id)),
      );
      return [
        ...maps(common, f.id, "family"),
        ...f.tracks.flatMap((t) =>
          maps(
            f.opportunities.filter((o) => t.opportunityIds.includes(o.id) && !common.includes(o)),
            t.id,
            "profession",
          ),
        ),
      ];
    }),
    skillGroups: groups.map((g, sortOrder) =>
      skillGroupDefinitionSchema.parse({
        id: g.id,
        name: g.name,
        description: g.description,
        sortOrder,
        specializationIds: g.members
          .filter((m) => m.kind === "specialization")
          .map((m) => m.competencyId),
        skillMemberships: g.members
          .filter((m) => m.kind === "base-skill")
          .map((m) => ({ skillId: m.competencyId, relevance: "core" })),
      }),
    ),
    skills: content.skills.map((s) => {
      if (!targetSkillIds.has(s.id) || !("catalogueSource" in s)) return s;
      const groupIds = groups
        .filter((g) => g.members.some((m) => m.kind === "base-skill" && m.competencyId === s.id))
        .map((g) => g.id);
      return targetRuntimeSkillDefinitionSchema.parse({ ...s, groupId: groupIds[0], groupIds });
    }),
    chargenCatalogue: {
      ...content.chargenCatalogue!,
      professionSourceDigest: TARGET_PROFESSION_SOURCE_DIGEST,
      groupSourceDigest: targetLearningGroupCatalogue.manifest.digest,
      professionIds: families.flatMap((f) =>
        f.tracks.length ? f.tracks.map((t) => t.id) : [f.id],
      ),
      groupIds: groups.map((g) => g.id),
    },
  };
}
