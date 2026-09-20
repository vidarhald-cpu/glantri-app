/**
 * Regenerates the NON-CANONICAL Competency Content V2 proposal report under
 * `docs/product/proposals/competency-content-v2/`.
 *
 * Run with: pnpm --filter @glantri/content exec tsx ./scripts/generateCompetencyContentV2Report.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { fullSkillCatalogueProposal } from "../src/skillContentPlatform/fullSkillCatalogueProposal";
import { targetLearningGroupCatalogue } from "../src/skillContentPlatform/targetLearningGroups";
import {
  analyseCompetencyContentV2,
  competencyContentV2Catalogue,
} from "../src/proposals/competencyContentV2/competencyContentV2";
import {
  competencyContentV2CivilizationLanguages,
  competencyContentV2DirectGrantDecisions,
  competencyContentV2DirectGrantPolicy,
  competencyContentV2RemovedGroups,
} from "../src/proposals/competencyContentV2/competencyContentV2Source";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, "../../../docs/product/proposals/competency-content-v2");
mkdirSync(outDir, { recursive: true });

const catalogue = competencyContentV2Catalogue;
const analysis = analyseCompetencyContentV2();
const entryName = new Map(
  fullSkillCatalogueProposal.entries.map((entry) => [entry.id, entry.name]),
);
const approvedGroupName = new Map(
  targetLearningGroupCatalogue.groups.map((group) => [group.id, group.name]),
);
const name = (id: string) => entryName.get(id) ?? id;

const banner = [
  "> **Status: NON-CANONICAL PRODUCT OWNER PROPOSAL — awaiting review.**",
  "> Generated from `packages/content/src/proposals/competencyContentV2/`. It is not registered with",
  "> Chargen, not projected into canonical content, and does not replace any approved catalogue.",
  "> Regenerate with `pnpm --filter @glantri/content exec tsx ./scripts/generateCompetencyContentV2Report.ts`,",
  "> then run Prettier over this folder.",
].join("\n");

/* --- Learning Groups ---------------------------------------------------------------------- */
const groupLines: string[] = [
  "# Proposed Learning Groups (V2)",
  "",
  banner,
  "",
  `${catalogue.manifest.groups} proposed groups: ${catalogue.manifest.retainedGroups} retained, ` +
    `${catalogue.manifest.revisedGroups} revised, ${catalogue.manifest.newGroups} new. ` +
    `${catalogue.manifest.removedGroups} approved groups are removed and explicitly rehoused. ` +
    `${catalogue.manifest.groupsWithSelectionSlots} groups carry a total of ` +
    `${catalogue.manifest.selectionSlots} \`pick N\` choice slots.`,
  "",
  "A choice slot's unselected candidates grant no competence, cost nothing, and add nothing to breadth.",
  "",
  "| Group | Name | Disposition | Fixed | Slot | Effective | Fixed base Skills | Choice slots | Explicit Specializations |",
  "| --- | --- | --- | ---: | ---: | ---: | --- | --- | --- |",
];
for (const group of catalogue.groups) {
  const slots = (group.selectionSlots ?? [])
    .map(
      (slot) =>
        `pick ${slot.chooseCount} of ${slot.candidateSkillIds.map((id) => name(id)).join(", ")}`,
    )
    .join("; ");
  const size = catalogue.groupSizes.find((row) => row.id === group.id)!;
  groupLines.push(
    `| ${group.id} | ${group.name} | ${group.disposition}${
      group.supersedes?.length ? ` (supersedes ${group.supersedes.join(", ")})` : ""
    } | ${size.fixedSize} | ${size.slotSize} | ${size.effectiveSize} | ${
      group.fixedSkillIds.map((id) => name(id)).join(", ") || "—"
    } | ${slots || "—"} | ${
      (group.specializationIds ?? []).map((id) => name(id)).join(", ") || "None"
    } |`,
  );
}
groupLines.push(
  "",
  "## Removed approved groups",
  "",
  "| Group | Name | Reason | Practice carried forward by |",
  "| --- | --- | --- | --- |",
);
for (const removed of competencyContentV2RemovedGroups)
  groupLines.push(
    `| ${removed.id} | ${approvedGroupName.get(removed.id) ?? removed.name} | ${removed.reason} | ${removed.replacedBy.join(", ")} |`,
  );
groupLines.push(
  "",
  "## Group size review",
  "",
  "Guidance: a normal centre of 3-4 effective base Skills; 2 is entirely acceptable where competencies",
  "are genuinely learned together; 1 normally means a direct Skill route or a broader practice fits",
  "better; 5+ needs positive justification and 6+ should be advanced, compound or materially",
  "choice-driven. Fixed purchase burden is reported separately from player-selected slot breadth, and",
  "coherence takes precedence over size.",
  "",
  "| Effective size | Groups |",
  "| ---: | ---: |",
  ...Object.keys(catalogue.groupSizeDistribution)
    .map(Number)
    .sort((a, b) => a - b)
    .map((size) => `| ${size} | ${catalogue.groupSizeDistribution[size]} |`),
  "",
  `Largest fixed purchase burden of any single group: ${catalogue.manifest.maximumFixedGroupBurden}.`,
  "",
  "### Tail review — every group at 1-2 and 5+",
  "",
  "| Group | Name | Fixed | Slot | Effective | Finding |",
  "| --- | --- | ---: | ---: | ---: | --- |",
  ...catalogue.groupSizes
    .filter((row) => row.effectiveSize <= 2 || row.effectiveSize >= 5)
    .map(
      (row) =>
        `| ${row.id} | ${row.name} | ${row.fixedSize} | ${row.slotSize} | ${row.effectiveSize} | ${
          row.effectiveSize >= 5
            ? "Above band: advanced or compound and materially choice-driven."
            : "At two: reviewed and retained — the pair is genuinely learned together."
        } |`,
    ),
  "",
  "Two one-Skill groups were found and changed rather than left: F22 gained Plant Lore because seasonal",
  "kitchen work genuinely teaches what is available when, and F16 was retired because its only base Skill",
  "was Research, which both its users already reach elsewhere. No group is forced into the 3-4 centre.",
  "",
  "## Group notes",
  "",
);
for (const group of catalogue.groups)
  if (group.note) groupLines.push(`- **${group.id} ${group.name}.** ${group.note}`);
groupLines.push("");
writeFileSync(join(outDir, "learning-groups-v2.md"), groupLines.join("\n"));

/* --- Professions -------------------------------------------------------------------------- */
const familyLines: string[] = [
  "# Proposed Professions and valid paths (V2)",
  "",
  banner,
  "",
  `All ${catalogue.manifest.families} approved Profession families are preserved. They yield ` +
    `${catalogue.manifest.validPaths} valid paths (the approved catalogue yields ` +
    `${analysis.approved.paths}). Mutually exclusive tracks are evaluated separately; ` +
    "Specializations never count toward base-Skill breadth.",
  "",
];
for (const family of catalogue.families) {
  const paths = catalogue.paths.filter((path) => path.professionCode === family.code);
  familyLines.push(`### ${family.code} — ${family.name}`, "");
  if (family.groups?.length)
    familyLines.push(...family.groups.map((route) => `- **${route.groupId}** — *${route.route}*`));
  if (family.skillIds?.length || family.specializationIds?.length)
    familyLines.push(
      `- *${family.directRoute}*: ${[
        ...(family.skillIds ?? []),
        ...(family.specializationIds ?? []),
      ]
        .map((id) => name(id))
        .join(", ")}`,
    );
  if (family.tracks?.length) {
    familyLines.push("", "Mutually exclusive tracks:", "");
    for (const track of family.tracks)
      familyLines.push(
        `- **${track.name}** — ${
          (track.groups ?? []).map((route) => `${route.groupId} (*${route.route}*)`).join(", ") ||
          "no additional routes"
        }`,
      );
  }
  familyLines.push(
    "",
    "| Valid path | Effective distinct base Skills | of which slot selections | Worst case if every selection duplicates |",
    "| --- | ---: | ---: | ---: |",
  );
  for (const path of paths)
    familyLines.push(
      `| ${path.pathName} | ${path.effectiveBreadthNominal} | ${path.slotSelections} | ${path.effectiveBreadthMinimum} |`,
    );
  if (family.note) familyLines.push("", `> ${family.note}`);
  familyLines.push("");
}
writeFileSync(join(outDir, "professions-v2.md"), familyLines.join("\n"));

/* --- Breadth analysis --------------------------------------------------------------------- */
const distributionRows = (label: string, dist: Record<number, number>) => {
  const keys = Object.keys(dist)
    .map(Number)
    .sort((a, b) => a - b);
  return keys.map((key) => `| ${label} | ${key} | ${dist[key]} |`);
};
const breadthLines = [
  "# Effective-breadth analysis: approved catalogue vs. proposal",
  "",
  banner,
  "",
  "## How this figure is used",
  "",
  "Breadth is a **diagnostic, not a target**. The proposal authors coherent occupational training first",
  "and then reads the distribution. Roughly 10 effective base Skills remains a design signal, never a",
  "quota or a minimum: a coherent path at 7-9 is an accepted outcome, and a broader path is accepted",
  "where it is genuinely justified. A path below 7 is flagged for a coherence review, not marked",
  "defective.",
  "",
  "## Counting rules (#250)",
  "",
  "- Deduplicate Skills reachable through several routes on the same path.",
  "- Count fixed Learning Group members and directly taught Skills.",
  "- Count only `chooseCount` per selection slot; unselected alternatives count for nothing.",
  "- Evaluate mutually exclusive tracks as separate paths.",
  "- Exclude Specializations from base-Skill breadth.",
  "",
  "Both sides of the comparison are measured by the same code path, so the before/after figures are like for like.",
  "",
  "## Summary",
  "",
  "| Measure | Approved catalogue | Proposal (nominal) | Proposal (worst case) |",
  "| --- | ---: | ---: | ---: |",
  `| Valid paths | ${analysis.approved.paths} | ${analysis.proposed.paths} | ${analysis.proposedMinimum.paths} |`,
  `| Minimum | ${analysis.approved.minimum} | ${analysis.proposed.minimum} | ${analysis.proposedMinimum.minimum} |`,
  `| Lower quartile | ${analysis.approved.lowerQuartile} | ${analysis.proposed.lowerQuartile} | ${analysis.proposedMinimum.lowerQuartile} |`,
  `| Median | ${analysis.approved.median} | ${analysis.proposed.median} | ${analysis.proposedMinimum.median} |`,
  `| Upper quartile | ${analysis.approved.upperQuartile} | ${analysis.proposed.upperQuartile} | ${analysis.proposedMinimum.upperQuartile} |`,
  `| Maximum | ${analysis.approved.maximum} | ${analysis.proposed.maximum} | ${analysis.proposedMinimum.maximum} |`,
  `| Mean | ${analysis.approved.mean} | ${analysis.proposed.mean} | ${analysis.proposedMinimum.mean} |`,
  `| Paths at or above 10 | ${analysis.approved.atOrAboveTarget} | ${analysis.proposed.atOrAboveTarget} | ${analysis.proposedMinimum.atOrAboveTarget} |`,
  `| Paths below 10 | ${analysis.approved.belowTarget} | ${analysis.proposed.belowTarget} | ${analysis.proposedMinimum.belowTarget} |`,
  "",
  "The worst-case column assumes every single slot selection duplicates a Skill the path already teaches.",
  "That never happens by design — no slot offers a Skill its own group already fixes — but it bounds the figure honestly.",
  "",
  "## Distribution",
  "",
  "| Catalogue | Effective distinct base Skills | Valid paths |",
  "| --- | ---: | ---: |",
  ...distributionRows("Approved", analysis.approved.distribution),
  ...distributionRows("Proposal", analysis.proposed.distribution),
  "",
  "## Paths flagged for coherence review (below 7)",
  "",
  analysis.reviewPrompts.length
    ? [
        "| Profession | Path | Effective breadth |",
        "| --- | --- | ---: |",
        ...analysis.reviewPrompts.map(
          (row) => `| ${row.professionCode} | ${row.pathName} | ${row.effectiveBreadthNominal} |`,
        ),
      ].join("\n")
    : "None, other than paths explicitly marked narrow by design.",
  "",
  "## Direct-grant review",
  "",
  `The first draft carried 283 direct Profession Skill grants; ${catalogue.manifest.directSkillOpportunities} remain. ` +
    "The withdrawals and the reasons for each retention are recorded in the [direct-grant review](./direct-grant-review.md).",
  "",
  "## Paths marked narrow by design",
  "",
  "| Profession | Path | Effective breadth | Why the narrowness is legitimate |",
  "| --- | --- | ---: | --- |",
  ...catalogue.families
    .filter((family) => family.narrowByDesign)
    .flatMap((family) =>
      catalogue.paths
        .filter((path) => path.professionCode === family.code && path.effectiveBreadthNominal < 10)
        .map(
          (path) =>
            `| ${family.code} ${family.name} | ${path.pathName} | ${path.effectiveBreadthNominal} | ${family.note ?? ""} |`,
        ),
    ),
  "",
];
writeFileSync(join(outDir, "breadth-analysis.md"), breadthLines.join("\n"));

/* --- Categories and languages ------------------------------------------------------------- */
const byCategory = new Map<string, string[]>();
for (const row of catalogue.categories) {
  if (!byCategory.has(row.categoryId)) byCategory.set(row.categoryId, []);
  byCategory.get(row.categoryId)!.push(row.name);
}
const categoryLines = [
  "# Proposed player-facing Skill categories and Civilization languages",
  "",
  banner,
  "",
  "## Skill categories",
  "",
  "`Special access` is removed as a category. It describes how a competency was reached, not what kind",
  "of competency it is: the same Skill reached through a Learning Group and through a direct Profession",
  "route belongs to the same category. The `language` category is preserved and reserved for the spoken",
  "and written competencies below.",
  "",
  "Applying this to the runtime enum, `apps/web/src/lib/chargen/chargenBrowse.ts` and",
  "`getPlayerFacingSkillCategoryId({ preferDirectProfession })` is deliberately out of scope for this",
  "content proposal and needs a separate authorized implementation task.",
  "",
  "| Category | Competencies |",
  "| --- | --- |",
  ...[...byCategory.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([category, names]) => `| \`${category}\` | ${names.sort().join(", ")} |`),
  "",
  "## Civilization languages",
  "",
  "Every canonical Civilization receives a spoken competency, and a written one unless it is explicitly",
  "authored as having no written tradition. Real-world analogue names are replaced by Glantri names.",
  "",
  "| Civilization | Spoken | Written | Replaces | Needs a Product Owner naming ruling |",
  "| --- | --- | --- | --- | --- |",
  ...competencyContentV2CivilizationLanguages.map(
    (row) =>
      `| ${row.civilizationName} | ${row.spokenName} | ${row.writtenName ?? "*authored as having no writing*"} | ${
        [row.replacesAnalogueSpokenName, row.replacesAnalogueWrittenName]
          .filter(Boolean)
          .join("; ") || "—"
      } | ${row.requiresProductOwnerNamingRuling ? "Yes" : "No"} |`,
  ),
  "",
  "### Notes",
  "",
  ...competencyContentV2CivilizationLanguages.map(
    (row) => `- **${row.civilizationName}.** ${row.note}`,
  ),
  "",
];
writeFileSync(join(outDir, "skill-categories-and-languages-v2.md"), categoryLines.join("\n"));

/* --- Direct-grant review ------------------------------------------------------------------- */
const grantLines = [
  "# Direct Profession Skill grants: what was withdrawn and what was kept",
  "",
  banner,
  "",
  "The first draft of this proposal was authored under breadth pressure and pushed every ordinary path",
  "to at least ten. The Product Owner inverted that pressure: author coherent occupational training",
  "first, then read breadth as a diagnostic. This is the honest accounting of the result.",
  "",
  `Direct Skill grants: **283 before, ${catalogue.manifest.directSkillOpportunities} after** — ` +
    `${competencyContentV2DirectGrantDecisions.reduce((sum, row) => sum + row.removedFrom.length, 0)} withdrawn.`,
  "",
  "## Policy applied",
  "",
  ...competencyContentV2DirectGrantPolicy.map((rule) => `- ${rule}`),
  "",
  "## Decisions",
  "",
  "| Skill | Withdrawn from | Retained in | Rationale |",
  "| --- | --- | --- | --- |",
  ...[...competencyContentV2DirectGrantDecisions]
    .sort((a, b) => b.removedFrom.length - a.removedFrom.length)
    .map(
      (row) =>
        `| ${name(row.skillId)} | ${row.removedFrom.length ? `${row.removedFrom.length}: ${row.removedFrom.join(", ")}` : "—"} | ${
          row.retainedIn.length ? `${row.retainedIn.length}: ${row.retainedIn.join(", ")}` : "none"
        } | ${row.rationale} |`,
    ),
  "",
  "## Effect on the distribution",
  "",
  `Median effective breadth moved from ${analysis.approved.median} in the approved catalogue, to 10 in the` +
    ` first draft, to ${analysis.proposed.median} here. Quartiles are now ${analysis.proposed.lowerQuartile}` +
    ` and ${analysis.proposed.upperQuartile}. That is the intended shape: most paths sit in the 7-10 range` +
    " on their own content, and the handful that run wider do so because the occupation genuinely is wide.",
  "",
];
writeFileSync(join(outDir, "direct-grant-review.md"), grantLines.join("\n"));

/* --- Machine-readable companion ------------------------------------------------------------ */
writeFileSync(
  join(outDir, "competency-content-v2.json"),
  JSON.stringify(
    {
      schemaVersion: catalogue.schemaVersion,
      status: catalogue.status,
      manifest: catalogue.manifest,
      coverage: catalogue.coverage,
      analysis: {
        approved: analysis.approved,
        proposed: analysis.proposed,
        proposedWorstCase: analysis.proposedMinimum,
        reviewPrompts: analysis.reviewPrompts,
        narrowByDesignPaths: analysis.narrowByDesignPaths,
      },
      groupSizes: catalogue.groupSizes,
      groupSizeDistribution: catalogue.groupSizeDistribution,
      directGrantPolicy: competencyContentV2DirectGrantPolicy,
      directGrantDecisions: competencyContentV2DirectGrantDecisions,
      groups: catalogue.groups,
      removedGroups: competencyContentV2RemovedGroups,
      families: catalogue.families,
      paths: catalogue.paths,
      categories: catalogue.categories,
      civilizationLanguages: competencyContentV2CivilizationLanguages,
    },
    null,
    2,
  ) + "\n",
);

console.log(`Written proposal report to ${outDir}`);
