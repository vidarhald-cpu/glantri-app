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
  "Product Owner ruling: **3-4 effective base Skills is the preferred centre**. 2 is valid where the",
  "competencies are genuinely learned together. 1 normally requires reconsideration. 5+ requires positive",
  "justification — **except for combat, which the Product Owner has made an explicit exception**: a larger,",
  "choice-heavy combat group is *desirable*, because it makes broad investment in one narrow competence",
  "domain economically viable. The three groups at five are therefore not tolerated, they are intended, and",
  "the build refuses any other group that grows to five. Fixed purchase burden is reported separately from",
  "player-selected slot breadth, and coherence takes precedence over size. Learning Groups are coherent",
  "taught or practised curricula, not collections of Skills that happen to be useful to the same Profession.",
  "",
  `Shape: ${catalogue.manifest.groupsInPreferredCentre} in the 3-4 centre, ` +
    `${catalogue.manifest.groupsAtTwo} at two, ` +
    `${catalogue.manifest.groupsNeedingReconsideration} at one, ` +
    `${catalogue.manifest.groupsAtFiveOrMore} at five or more.`,
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
  "### Tail review — every group at 1 and at 5+",
  "",
  "| Group | Name | Fixed | Slot | Effective | Shape | Justification |",
  "| --- | --- | ---: | ---: | ---: | --- | --- |",
  ...catalogue.groupSizes
    .filter((row) => row.shape === "reconsider" || row.shape === "justified-large")
    .map(
      (row) =>
        `| ${row.id} | ${row.name} | ${row.fixedSize} | ${row.slotSize} | ${row.effectiveSize} | ${row.shape} | ${row.justification ?? ""} |`,
    ),
  "",
  "No group teaches one effective base Skill. The two that did are retired by ruling: **F16 Lineage",
  "investigation apprenticeship** and **F22 Seasonal kitchen and preservation practice** were both a single",
  "base Skill wrapped around Specialization access. Their Specialization routes are preserved — Genealogy",
  "through P67 and P76, whose parent History comes from K10, and Food Preservation through C10, whose",
  "parent Cooking is taught in the same group. No group is forced into the 3-4 centre.",
  "",
  "## Combat group structure",
  "",
  "Focused and broad combat groups coexist, and the overlap between them is intentional: a Profession's",
  "breadth is deduplicated, so a Profession that reaches the same weapon family by two routes pays once.",
  "",
  "- **Focused.** M01 is the package the ruling describes — Dodge, Parry and one chosen melee weapon",
  "  family. M04 is its missile counterpart. F30 stays fixed because the tradition is defined by its weapon.",
  "  M11 (Riding, Mounted Combat) and M12 (Lance, Formation Fighting) are the two focused practices that",
  "  replace the oversized F32; a mounted Profession reaches its sidearm through M01 like anyone else.",
  "- **Broad.** M02, M03 and M05 are large and choice-heavy under the Product Owner's explicit combat",
  "  exception. Each was re-examined under that exception rather than defended against the 5+ rule: none",
  "  had been trimmed to reach a number, and none is now apologised for. Their pools are context-specific",
  "  and **cross category**: M02 offers Brawling and Throwing beside the melee families, because a",
  "  close-quarters school genuinely teaches the grapple and the thrown weapon; M03 offers Throwing and the",
  "  Sling, because a close-order unit issues skirmishing arms alongside the line weapon. The exception is",
  "  enforced as an allowlist, so it cannot silently spread to a non-combat group.",
  "- **Brawling is no longer fixed in any weapon course.** It sits in the broad pool, where a learner takes",
  "  it because the school teaches it, not as an unexamined surcharge on every melee curriculum.",
  "- **Combat Experience is out of every instruction group.** It is experiential competence from credible",
  "  real combat or field exposure, and it comes only from M06 Campaign service experience and K23",
  "  Coercive service practice. A Weapon Instructor who has never been in a fight does not acquire it. The",
  "  containment is enforced: the build refuses any other group that teaches it, and refuses either of",
  "  those two if it stops doing so. The route audit is in the [Professions report](./professions-v2.md).",
  "",
  "## Group notes",
  "",
);
for (const group of catalogue.groups)
  if (group.note) groupLines.push(`- **${group.id} ${group.name}.** ${group.note}`);
groupLines.push("");
writeFileSync(join(outDir, "learning-groups-v2.md"), groupLines.join("\n"));

/* --- Professions -------------------------------------------------------------------------- */
/**
 * Track dispositions under the 2026-09-21 Profession-tracks ruling. Held as data so the retired count
 * is derived from the table rather than asserted beside it, and so the retained/retired set is a single
 * reviewable record. The "after" column is cross-checked against the built catalogue below.
 */
const TRACK_DISPOSITIONS: { profession: string; before: number; after: number; why: string }[] = [
  {
    profession: "P09 Sailor and Boat Worker",
    before: 2,
    after: 2,
    why: "Kept. Inshore boat work and rigged-vessel deck service have different defining training — N01 against F09 — so each track carries its own core.",
  },
  {
    profession: "P31 Surgeon",
    before: 2,
    after: 2,
    why: "Kept. The civil operative surgeon and the field surgeon are defined by different apprenticeships, G18 against F29, and only the field surgeon has an authored route to combat exposure.",
  },
  {
    profession: "P14 Guard, Watcher and Escort",
    before: 2,
    after: 0,
    why: "Retired. The tracks differed only in which combat group the guard bought; M01 and F30 are now both openly available routes.",
  },
  {
    profession: "P22 Soldier",
    before: 4,
    after: 0,
    why: "Retired. All four differed only in which combat Learning Group they bought — contingent drill, formation drill, the issued missile arm, the longbow tradition. The Soldier is one identity whose core is being drilled to arms, stated as the alternative core routes M01, M03 and M04 rather than as tracks.",
  },
  {
    profession: "P24 Military Scout",
    before: 2,
    after: 0,
    why: "Retired. Foot and mounted scouting differed only by whether the scout was given a horse, which G05 already says.",
  },
  {
    profession: "P25 Military Commander",
    before: 3,
    after: 0,
    why: "Retired. Foot, mounted and communal command differed only in the combat groups shared with the command.",
  },
  {
    profession: "P26 Military Quartermaster",
    before: 2,
    after: 0,
    why: "Retired. Neither refined the defining core; G12 and M01 state the difference themselves.",
  },
  {
    profession: "P82 Weapon Instructor",
    before: 3,
    after: 0,
    why: "Retired. The subject an arms master teaches is a weapon choice, already expressed by M02, M05 and F30. The narrow-by-design exemption the one-tradition fencing track needed is gone with it.",
  },
];

/* The table is the record; the build is the truth. They must agree. */
{
  const declared = TRACK_DISPOSITIONS.reduce((sum, row) => sum + row.after, 0);
  const built = catalogue.families.reduce((sum, family) => sum + (family.tracks?.length ?? 0), 0);
  if (declared !== built)
    throw new Error(
      `track disposition table records ${declared} retained tracks; the catalogue builds ${built}`,
    );
}

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
familyLines.push(
  "Every Profession declares at least one **defining core route**: the training it is not that Profession",
  "without. A path is valid only when it satisfies one of its applicable core routes; a track's own core",
  "routes refine or replace its parent's. This is an annotation over Learning Groups and directly taught",
  "Skills that already exist, not a separate mechanism, and it needs no GM override.",
  "",
  `Every valid path satisfies an applicable core route. ${catalogue.manifest.coreRoutes} path/core-route ` +
    `pairs are declared and ${catalogue.coreRoutes.filter((row) => row.satisfied).length} are satisfied by ` +
    `the authored content; ${catalogue.manifest.coreRoutesBlocked} core route is recorded as partially ` +
    `blocked on an external question.`,
  "",
  "## Core minimality",
  "",
  "A core states what a Profession is not that Profession without — enough for identity, never a rigid",
  "class build. Every declared core route is audited against that, and the build now refuses any core that",
  `requires more than two things in total. Largest core in the catalogue: ` +
    `${Math.max(...catalogue.coreRoutes.map((row) => row.groupIds.length + row.skillIds.length))} requirement(s). ` +
    `${catalogue.coreRoutes.filter((row) => row.groupIds.length + row.skillIds.length === 1).length} of ` +
    `${catalogue.coreRoutes.length} path/core pairs require exactly one thing — ` +
    `${catalogue.coreRoutes.filter((row) => row.groupIds.length === 1 && !row.skillIds.length).length} a single ` +
    `Learning Group and ` +
    `${catalogue.coreRoutes.filter((row) => !row.groupIds.length && row.skillIds.length === 1).length} a single ` +
    `direct competency route.`,
  "",
  "**A core is a necessary defining training route, not a unique classification key.** The",
  '"PRODUCT OWNER RULING — Profession cores (settled)" comment recorded on',
  "[issue #266](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/266) on 2026-09-21 rejects the",
  "assumption that a core must discriminate one Profession from every other. **Several Professions may",
  "share the same core Learning Group where that training is genuinely defining for each**, and a shared",
  "core is therefore correct content rather than a defect to be designed away. G10 is the core of the Envoy,",
  "the Mediator and the Political Agent; G11 of the Clerk and the Scribe; F24 of the Smith and the Smelter;",
  "M07 of the Quartermaster and the Campaign Planner; F04 of the Athlete and the foot Courier. **No Learning",
  "Group is invented to manufacture a unique core.**",
  "",
  "The same ruling settles that a core requirement may name **an existing Learning Group route or an",
  "existing direct competency route**. That is an annotation over routes the Profession already has, not a",
  "new primitive. Three Professions are defined by a direct route rather than by a group: the Cook by",
  "Cooking, the Wild Plant Gatherer by Plant Lore, and the Carpenter by Carpentry. In each case the group",
  "that previously held the core — C10, G02 and F27 — remains an ordinary optional route, and because",
  "overlapping routes are charged once, moving the core changes no breadth figure.",
  "",
  `A Profession may declare a small set of **alternative core routes**, of which one must be satisfied. ` +
    `${[...new Set(catalogue.coreRoutes.map((row) => row.pathId))].filter((pathId) => catalogue.coreRoutes.filter((row) => row.pathId === pathId).length > 1).length} ` +
    `paths use them today.`,
  "",
  "- **P12 Courier and Messenger** — one of F04, G05 or F06: the foot, mounted and vehicle courier are the",
  "  same occupation practised three ways, and any one of them makes the courier.",
  "- **P22 Soldier** — one of M01, M03 or M04: a soldier is made by being drilled to arms. **M06 Campaign",
  "  service experience is not core.** It stays an ordinary route, because Combat Experience is experiential",
  "  competence earned by real service — available to the soldier who sees it, not required of the one who",
  "  does not.",
  "",
  "Both are stated as alternatives rather than as tracks, which the cores ruling requires explicitly and the",
  "track-discipline ruling below independently demands.",
  "",
  "## Track discipline",
  "",
  "A track is a **named player-visible curriculum variant representing a materially different form of the",
  "occupation** — not a weapon, Skill or equipment choice, and not a restatement of something the Learning",
  "Groups already say. The audit applies one mechanisable test: **a track must declare a core route of its",
  "own.** If the defining training does not differ, the variant is a route choice and belongs in the",
  "Profession's own group list. The build refuses a track that declares no core.",
  "",
  '**Settled by Product Owner ruling.** The "PRODUCT OWNER RULING — Profession tracks (settled)" comment',
  "recorded on [issue #266](http://127.0.0.1:3001/recovery-admin/glantri-app/issues/266) on 2026-09-21",
  "approves this retirement outcome as authoritative settled input, not merely this proposal's own internal",
  'audit: **"A Profession track exists only where it changes the defining core curriculum of the',
  "occupation. If the difference can be expressed through Learning Groups, choice slots, equipment,",
  'Society/cultural availability, or optional routes, do not create a track."** The mechanisable build test',
  "above — a track must declare a core route of its own — is how that governing rule is enforced in this",
  "catalogue; the two are the same discipline stated once as product policy and once as an executable check.",
  "",
  "The same ruling settles two dispositions by name, so neither is an open track question:",
  "",
  "- **Soldier longbow identity** is represented through the appropriate longbow/combat Learning Group (F41,",
  "  reachable through the retired track's former route) plus contextual/cultural availability, **not**",
  "  through a Profession track.",
  "- **Communal/militia command** (the former P25 communal-command track) remains a route/context",
  "  distinction, **not** a track, unless future content demonstrates a materially different defining",
  "  curriculum.",
  "",
  "**No further track investigation is required.** The result below is final for this reconciliation, not",
  "pending further Product Owner review. The 2026-09-21 Profession-cores ruling does not reopen it: P12 and",
  "P22 gain **alternative core routes**, never tracks, and the retained/retired set below is unchanged.",
  "",
  `Result: ${catalogue.families.filter((family) => family.tracks?.length).length} of ` +
    `${catalogue.manifest.families} Professions keep tracks, carrying ` +
    `${catalogue.families.reduce((sum, family) => sum + (family.tracks?.length ?? 0), 0)} tracks between them ` +
    `(${TRACK_DISPOSITIONS.reduce((sum, row) => sum + row.before - row.after, 0)} retired). ` +
    `Valid paths fall to ${catalogue.manifest.validPaths}.`,
  "",
  "| Profession | Tracks before | Tracks after | Why |",
  "| --- | ---: | ---: | --- |",
  ...TRACK_DISPOSITIONS.map(
    (row) => `| ${row.profession} | ${row.before} | ${row.after} | ${row.why} |`,
  ),
  "",
  "The Soldier collapse is the ruling applied at its sharpest, and it is deliberate: breadth that used to be",
  "split across four near-identical tracks is now what the breadth ruling actually asks for — one identity",
  "with access to several coherent Learning Groups. The cores ruling completes it. Where a difference really",
  "is a difference in defining training but not in occupational identity — the mounted courier against the",
  "foot courier — the answer is an alternative core route, not a track. Tracks remain reserved for a",
  "materially different occupational form, which is why only the Sailor and the Surgeon keep any.",
  "",
  "## Combat Experience route audit",
  "",
  "Combat Experience is experiential competence from credible real combat or field exposure. Weapon",
  "instruction, fencing, drill and advanced combat training do not grant it. It is reachable only through",
  "M06 Campaign service experience and K23 Coercive service practice, and a Profession may expose it only",
  "through an authored experiential route that explains the exposure. Every path that reaches it is listed",
  "here; there are no others, and the build enforces that.",
  "",
  "| Path | Route group | Authored route |",
  "| --- | --- | --- |",
  ...catalogue.paths
    .filter((path) => path.fixedSkillIds.includes("combat_experience"))
    .map((path) => {
      const family = catalogue.families.find(
        (candidate) => candidate.code === path.professionCode,
      )!;
      const bodies = [family, ...(family.tracks ?? [])];
      const route = bodies
        .flatMap((body) => body.groups ?? [])
        .find((candidate) => candidate.groupId === "M06" || candidate.groupId === "K23")!;
      return `| ${family.code} ${family.name} — ${path.pathName} | ${route.groupId} | *${route.route}* |`;
    }),
  "",
  "Professions that train hard and fight rarely are the point of the audit: the Weapon Instructor, the",
  "Guard, the Military Quartermaster and the civil Surgeon reach no Combat Experience by any route.",
  "",
  "## Cost invariants",
  "",
  "Overlapping routes never require duplicate payment for the same competency, and final cost does not",
  "depend on purchase order. Across all valid paths the routes name a competency more than once on",
  `${catalogue.costInvariants.reduce((sum, row) => sum + row.duplicatesAvoided, 0)} occasions; every one is ` +
    "charged exactly once. Accumulating each path's routes in reverse order yields the identical charged",
  "set, which is what order-independence means here. Both properties are enforced by the build, not asserted",
  "in prose: a catalogue that broke either would fail to build.",
  "",
);
for (const family of catalogue.families) {
  const paths = catalogue.paths.filter((path) => path.professionCode === family.code);
  familyLines.push(`### ${family.code} — ${family.name}`, "");
  const cores = catalogue.coreRoutes.filter((row) => row.professionCode === family.code);
  const distinctCores = [...new Map(cores.map((row) => [row.coreRouteId, row])).values()];
  for (const core of distinctCores)
    familyLines.push(
      `- **Core route** — *${core.label}*: ${[...core.groupIds, ...core.skillIds.map((id) => name(id))].join(", ")}${
        core.blockedBy ? ` — **blocked:** ${core.blockedBy}` : ""
      }`,
    );
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
const approvedGroupSizeDistribution: Record<number, number> = {};
for (const group of targetLearningGroupCatalogue.groups) {
  const size = group.members.filter((member) => member.kind === "base-skill").length;
  approvedGroupSizeDistribution[size] = (approvedGroupSizeDistribution[size] ?? 0) + 1;
}

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
    : "None. Every valid path is at or above the coherence-review floor of seven.",
  "",
  "## Group-size distribution, before and after",
  "",
  "The approved catalogue is measured by counting each approved group's base-Skill members; the proposal is",
  "measured as fixed members plus slot selections.",
  "",
  "| Effective size | Approved groups | Proposed groups |",
  "| ---: | ---: | ---: |",
  ...[
    ...new Set([
      ...Object.keys(approvedGroupSizeDistribution).map(Number),
      ...Object.keys(catalogue.groupSizeDistribution).map(Number),
    ]),
  ]
    .sort((a, b) => a - b)
    .map(
      (size) =>
        `| ${size} | ${approvedGroupSizeDistribution[size] ?? 0} | ${catalogue.groupSizeDistribution[size] ?? 0} |`,
    ),
  "",
  `Approved: ${targetLearningGroupCatalogue.groups.length} groups. Proposal: ${catalogue.manifest.groups} groups — ` +
    `${catalogue.manifest.groupsInPreferredCentre} in the 3-4 preferred centre, ${catalogue.manifest.groupsAtTwo} at two, ` +
    `${catalogue.manifest.groupsNeedingReconsideration} at one, ${catalogue.manifest.groupsAtFiveOrMore} at five or more. ` +
    `Largest fixed purchase burden of any one group: ${catalogue.manifest.maximumFixedGroupBurden}.`,
  "",
  "## Direct-grant review",
  "",
  `The first draft carried 283 direct Profession Skill grants; ${catalogue.manifest.directSkillOpportunities} remain. ` +
    "The withdrawals and the reasons for each retention are recorded in the [direct-grant review](./direct-grant-review.md).",
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
  "Skill categories are **broad, semantically predictable human browse categories**. They describe **what",
  "the competency is**, never where or how it was learned. Two consequences follow, and both are applied",
  "here: placement must be predictable enough that a player looking for a competency guesses the right",
  "category first, and narrow categories must not proliferate — fourteen categories cover all 157",
  "competencies.",
  "",
  "The roster is **simplified** under the ruling's new latitude, which releases it from preserving awkward",
  "current categories for compatibility. `Mental` held only Meditation and Mnemonics: two members is",
  "proliferation, and neither name points a player at the word. Meditation joins `mystical` beside the",
  "contemplative competencies; Mnemonics joins `knowledge`. `High society` described a milieu — who has",
  "access — rather than what a competency is: Heraldry joins `knowledge` as the body of lore it is, and",
  "Politics and Courtly Protocol join `social`. One arbitrary placement is corrected: Agriculture &",
  "Husbandry defaulted to `trade`, which split the living-animal competencies between two categories, so",
  "it now defaults to `fieldcraft`, with Cart Driving overridden back to `trade` as the transport trade it",
  "is. The build refuses a retired category, and refuses any category that falls below four competencies.",
  "",
  "`Special access` is therefore removed as a category. It describes how a competency was reached, not what",
  "kind of competency it is: the same Skill reached through a Learning Group and through a direct Profession",
  "route belongs to the same category. The `language` category is preserved and reserved for the spoken and",
  "written competencies below.",
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
  "Every canonical Civilization receives a **rollable spoken competency**, and a **rollable written**",
  "competency unless it is explicitly authored as having no written tradition. Written competence is what a",
  "reading roll is made against.",
  "",
  "Naming follows the Product Owner ruling: the canonical Glantri name where one is established, and the",
  "appropriate **historical** name where none is. No Glantri name is invented and no linguistic descent is",
  "asserted. The previous revision's invented names are withdrawn — **Kethran, Old Latian, Palace Scyrian,",
  "Kaldan and Aspardic**, and the **Harbour, Hill, Palace, Wedge and Chancery** scripts. Where a written",
  "tradition has an established Glantri language name but no established script name, the competency is named",
  "for the language alone rather than given an invented script.",
  "",
  "**Olog is flagged for later correction and deliberately not corrected here:** it appears modelled from a",
  "historical stage somewhat later and more advanced than the intended Glantri Olog society. That is a",
  "separate follow-up, not part of this reconciliation.",
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
  "This revision applies a second ruling on top of it: **direct Profession Skills are exceptional**",
  "**occupational training routes, not a mechanism for reaching the breadth signal**, and high direct-Skill",
  "counts are to be reviewed — a coherent cluster belongs in a Learning Group. Four such clusters were found",
  "and moved: the Guard's watch duty into **K24**, the Thief's street theft into **K25**, the Diviner's and",
  "Religious Practitioner's contemplative discipline into **K22**, and the Weapon Instructor's salle into",
  "**M10**.",
  "",
  (() => {
    const counts = catalogue.families.map((family) => ({
      code: family.code,
      name: family.name,
      count:
        (family.skillIds?.length ?? 0) +
        (family.tracks ?? []).reduce((sum, track) => sum + (track.skillIds?.length ?? 0), 0),
    }));
    const high = counts.filter((row) => row.count >= 3).sort((a, b) => b.count - a.count);
    return (
      `Highest remaining direct-Skill count: ${Math.max(...counts.map((row) => row.count))}. ` +
      (high.length
        ? `${high.length} Profession(s) still carry three or more — ${high
            .map((row) => `${row.code} ${row.name} (${row.count})`)
            .join(", ")} — and each is argued in the table below rather than trimmed to a number.`
        : "No Profession carries three or more.")
    );
  })(),
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
