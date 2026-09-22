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
  competencyContentV2WrittenLanguageCompetencyIds,
  v2SpokenCompetencyName,
  v2WrittenCompetencyName,
  competencyContentV2DirectGrantDecisions,
  competencyContentV2DirectGrantPolicy,
  competencyContentV2RemovedGroups,
  competencyContentV2RetiredProposedGroups,
} from "../src/proposals/competencyContentV2/competencyContentV2Source";

const __dirname = dirname(fileURLToPath(import.meta.url));
const approvedCompetencyIds = new Set(fullSkillCatalogueProposal.entries.map((entry) => entry.id));
const writtenCompetencyIds = competencyContentV2WrittenLanguageCompetencyIds;
const spokenCompetencyIds = [
  ...new Set(competencyContentV2CivilizationLanguages.map((row) => row.spokenCompetencyId)),
];
const noWritingCount = competencyContentV2CivilizationLanguages.filter(
  (row) => row.writtenCompetencyId === null,
).length;
const literateCount = competencyContentV2CivilizationLanguages.length - noWritingCount;

function coreRequirementCount(row: {
  groupIds: string[];
  skillIds: string[];
  writtenLanguageChoiceCount: number;
}): number {
  return row.groupIds.length + row.skillIds.length + (row.writtenLanguageChoiceCount ? 1 : 0);
}

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

/**
 * Hard-wraps a generated paragraph to the repository's 100-column prose width.
 *
 * Prettier keeps Markdown prose as authored, so a paragraph whose width depends on a computed number
 * has to be wrapped here or it drifts out of shape the next time the number changes.
 */
const wrap = (text: string, width = 100): string[] => {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

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
    `${catalogue.manifest.removedGroups} approved groups are removed and explicitly rehoused, and ` +
    `${catalogue.manifest.retiredProposedGroups} group this proposal had itself authored is retired by ` +
    "the 2026-09-21 Learning-Group membership ruling. " +
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
groupLines.push("", "## Retired proposed groups", "");
for (const retired of competencyContentV2RetiredProposedGroups)
  groupLines.push(
    `### ${retired.id} ${retired.name} — retired`,
    "",
    `**Former membership.** ${retired.formerMembership}`,
    "",
    retired.reason,
    "",
    "| Profession | Route it had | What carries that route now |",
    "| --- | --- | --- |",
    ...retired.rehousing.map(
      (row) =>
        `| ${row.professionCode} ${
          catalogue.families.find((family) => family.code === row.professionCode)?.name ?? ""
        } | *${row.formerRoute}* | ${row.disposition} |`,
    ),
    "",
  );
groupLines.push(
  "## Membership settled by the 2026-09-21 ruling",
  "",
  "Four groups are settled at an exact fixed membership and one is retired. The build asserts each",
  "membership rather than describing it, so a later breadth argument cannot quietly add a member back,",
  "and it refuses the retired group outright.",
  "",
  "| Group | Settled membership | Removed | Where the removed competence is learned instead |",
  "| --- | --- | --- | --- |",
  "| K01 Scholarly study practice | Research, Mnemonics | Mathematics | K21 Applied calculation practice, or K03 Celestial observation practice — the cores of the two Professions that are genuinely numerate. |",
  "| M10 Arms instruction practice | Teaching, Weapon Maintenance | Athletics | F04 Running and athletic field practice, the physical-training route that genuinely teaches conditioning. |",
  "| C06 Stone workshop and quarry practice | Masonry, Sculpture | Mining | C07 Mine and quarry apprenticeship, which stays available to the Mason where the occupation wins its own stone. |",
  "| C07 Mine and quarry apprenticeship | Mining, Climbing | Survival | G04 Field travel and camp practice, reached as an ordinary route by the remote-worked mine. |",
  "| C03 Construction site practice | *retired* | Surveying, and a choose-two craft slot | An existing group or a direct Profession route per Profession — see the retired-group table above. |",
  "",
  "**No replacement Learning Group was created.** The ruling retires C03 without preserving a one-Skill",
  "group in its place, and the four retained groups lose a member without gaining one.",
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
  "parent Cooking is taught in the same group. **C03 Construction site practice** is retired on the same",
  "reasoning by the membership ruling: one fixed base Skill wrapped around a choice slot that charged a",
  "second and third craft apprenticeship for coordinating trades. It too is retired without a one-Skill",
  "survivor. The shape moves toward two as a result — four groups lose a member by ruling — and that is the",
  "intended outcome, not drift: coherence takes precedence over size, and two is explicitly valid where the",
  "competencies are genuinely learned together. No group is forced into the 3-4 centre.",
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
    `the authored content. ${
      catalogue.manifest.coreRoutesBlocked === 0
        ? "No core route is blocked on an external question any more: P65 Scribe was the last one, and the 2026-09-22 language ruling settles it."
        : `${catalogue.manifest.coreRoutesBlocked} core route(s) are recorded as partially blocked on an external question.`
    }`,
  "",
  "## Core minimality",
  "",
  "A core states what a Profession is not that Profession without — enough for identity, never a rigid",
  "class build. Every declared core route is audited against that, and the build now refuses any core that",
  `requires more than two things in total. A written-language choice counts as exactly one requirement ` +
    `however many competencies it may be satisfied from, because it is one choice the learner makes rather ` +
    `than a list the Profession dictates. Largest core in the catalogue: ` +
    `${Math.max(...catalogue.coreRoutes.map(coreRequirementCount))} requirement(s). ` +
    `${catalogue.coreRoutes.filter((row) => coreRequirementCount(row) === 1).length} of ` +
    `${catalogue.coreRoutes.length} path/core pairs require exactly one thing — ` +
    `${catalogue.coreRoutes.filter((row) => row.groupIds.length === 1 && !row.skillIds.length && !row.writtenLanguageChoiceCount).length} a single ` +
    `Learning Group and ` +
    `${catalogue.coreRoutes.filter((row) => !row.groupIds.length && row.skillIds.length === 1 && !row.writtenLanguageChoiceCount).length} a single ` +
    `direct competency route.`,
  "",
  `**The written-language core route (#113).** ${
    catalogue.coreRoutes.filter((row) => row.writtenLanguageChoiceCount > 0).length
  } path/core pair(s) additionally require the learner to hold at least one written-language competency, ` +
    `chosen freely rather than named: ` +
    `${
      catalogue.coreRoutes
        .filter((row) => row.writtenLanguageChoiceCount > 0)
        .map((row) => `${row.professionCode} (${row.writtenLanguageChoiceCount})`)
        .join(", ") || "none"
    }. This is the narrow representation extension the 2026-09-22 ruling authorizes, and it is the whole ` +
    `of it: a \`writtenLanguageChoiceCount\` on the core route. Written languages are **not** turned into ` +
    `base Skills, no core route is enumerated per Civilization, and no new path-body concept is added. ` +
    `The choice is satisfied from the ${writtenCompetencyIds.length} written competencies the Civilization ` +
    `language table authors, so it is satisfiable wherever a literate Civilization is reachable.`,
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
  "A flag here is a prompt to look at the content, never a defect and never a licence to pad. The",
  "2026-09-21 Learning-Group membership ruling deliberately narrowed five groups and retired one, and it",
  "did so knowing breadth would fall: coherent training is authored first and breadth is read afterwards.",
  "The paths below are the ones that fell under the coherence floor as a result, and each is left as the",
  "ruling leaves it rather than topped up. Three are scholarly paths that lost Mathematics with K01 —",
  "Mathematics was never part of what those occupations study, and the numerate scholarly Professions keep",
  "it through K21 and K03. Three are construction paths that lost C03 — the building designer and the",
  "shipbuilder reach every competence their occupation genuinely teaches, and the ruling forbids charging",
  "either a craft apprenticeship for coordinating trades it does not practise. **Every one of these paths",
  "still satisfies its defining core route.**",
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
  "reading roll is made against. Only the minimum canonical data is authored: identity, spoken or written",
  "type, Civilization association, route and ownership. Script histories, registers and conventions are",
  "later enrichment and deliberately wait.",
  "",
  "Naming follows the Product Owner ruling: the established Glantri name where one exists, and the",
  "appropriate **historical** name where none does. In practice this required almost no judgement, because",
  "the established names already exist — `canonicalContent.json` carries a spoken and a written language",
  "name for all sixteen Civilizations and a roster of 21 named language records. **Every name in the table",
  "below is taken verbatim from that roster, and the build fails if any name used is absent from it.** That",
  "check, not this paragraph, is what guarantees nothing here is invented.",
  "",
  "Naming shape follows the approved catalogue's own convention, set by its three existing written",
  "traditions: `Written <language> in <tradition>` where a separate tradition name is established, and",
  "`Written <language>` where none is.",
  "",
  "Two corrections to the previous revision follow from the provenance check, in opposite directions.",
  "**Lankhmaran** was introduced by the previous revision and appears nowhere else in the repository; it was",
  "derived from the Civilization's name, which is exactly the invention the ruling forbids, and it is",
  "withdrawn in favour of the established Phoenician names the approved catalogue already carries.",
  "**Royal N'kolian** and **Runic Scandian** were withdrawn by the previous revision as inventions, but both",
  "are established Glantri language records in the canonical content and are listed by name in the approved",
  "gap report; both are restored. The previous revision's genuine inventions stay withdrawn — **Kethran, Old",
  "Latian, Palace Scyrian, Kaldan and Aspardic**, and the **Harbour, Hill, Palace, Wedge and Chancery**",
  "scripts.",
  "",
  "**Olog is flagged for later correction and deliberately not corrected here:** it appears modelled from a",
  "historical stage somewhat later and more advanced than the intended Glantri Olog society. That is a",
  "separate low-priority follow-up, not part of this reconciliation.",
  "",
  `**${writtenCompetencyIds.length} distinct written competencies** serve the ${literateCount} literate Civilizations; ${noWritingCount} are authored as having no writing. ${spokenCompetencyIds.length} distinct spoken competencies serve all 16.`,
  "",
  "| Civilization | Spoken | Written | Status | Withdrawn here | Needs a Product Owner naming ruling |",
  "| --- | --- | --- | --- | --- | --- |",
  ...competencyContentV2CivilizationLanguages.map((row) => {
    const writtenName = v2WrittenCompetencyName(row);
    const spoken = `${v2SpokenCompetencyName(row)}<br>\`${row.spokenCompetencyId}\``;
    const written =
      writtenName === null || row.writtenCompetencyId === null
        ? "_authored as having no writing_"
        : `${writtenName}<br>\`${row.writtenCompetencyId}\``;
    const newIds = [row.spokenCompetencyId, row.writtenCompetencyId].filter(
      (id): id is string => id !== null && !approvedCompetencyIds.has(id),
    );
    const status = newIds.length === 0 ? "In the approved catalogue" : "Newly proposed";
    const withdrawn =
      [row.replacesProposedSpokenName, row.replacesProposedWrittenName]
        .filter(Boolean)
        .join("; ") || "—";
    return `| ${row.civilizationName} | ${spoken} | ${written} | ${status} | ${withdrawn} | ${
      row.requiresProductOwnerNamingRuling ? "Yes" : "No"
    } |`;
  }),
  "",
  "### Routes and ownership",
  "",
  "A language competency is owned by its Civilization. Neither route below is a grant: the competency is",
  "still acquired, and holding a spoken competency confers nothing written, nor the reverse. Which",
  "Civilizations a given character may reach remains the contextual availability question, unchanged here.",
  "",
  "| Route | Applies to |",
  "| --- | --- |",
  ...[
    ...new Map(
      competencyContentV2CivilizationLanguages.flatMap((row) =>
        [
          [`Spoken — ${row.spokenRoute}`, row.civilizationName] as const,
          ...(row.writtenRoute
            ? ([[`Written — ${row.writtenRoute}`, row.civilizationName]] as const)
            : []),
        ].map(([route, civ]) => [route, civ] as const),
      ),
    ).keys(),
  ].map((route) => {
    const civilizations = competencyContentV2CivilizationLanguages.filter((row) =>
      route.startsWith("Spoken — ")
        ? `Spoken — ${row.spokenRoute}` === route
        : row.writtenRoute !== undefined && `Written — ${row.writtenRoute}` === route,
    );
    const applies =
      civilizations.length === competencyContentV2CivilizationLanguages.length
        ? "Every Civilization"
        : civilizations.map((row) => row.civilizationName).join(", ");
    return `| ${route} | ${applies} |`;
  }),
  "",
  "### Civilizations authored as having no writing",
  "",
  "An absence is authored, never merely missing data. The build rejects a Civilization with no written",
  "competency and no reason, and equally rejects one authored as having no writing whose canonical record",
  "does name a written language.",
  "",
  ...competencyContentV2CivilizationLanguages
    .filter((row) => row.writtenCompetencyId === null)
    .flatMap((row) => [`- **${row.civilizationName}.** ${row.writtenAbsenceReason}`]),
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
  "The 2026-09-21 Learning-Group membership ruling then moved two grants the other way, and only two. It",
  "retires C03 Construction site practice and directs that **Surveying** be supplied through an existing",
  "group or a **direct Profession route** where setting-out is genuinely learned through the occupation.",
  "The site carpenter (**P39**) and the millwright (**P48**) are the two former C03 users with no other",
  "route to Surveying and a genuine claim on it, so each gains it as a direct route. The shipbuilder and",
  "the building designer gain nothing: the yard's lofting is not the ground measurement Surveying",
  "describes, and the building designer already reaches it through F28 and F01. **Athletics is not",
  "restored** to the Weapon Instructor, because the same ruling removed it from M10 as well.",
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

/* --- Society Level and Social Band route availability --------------------------------------- */
const availability = analysis.societyLevelAvailability;
const bandName = new Map(availability.socialBands.map((band) => [band.id, band.name]));
const professionName = new Map(catalogue.families.map((family) => [family.code, family.name]));
const availabilityLines: string[] = [
  "# Society Level and Social Band route availability (V2)",
  "",
  banner,
  "",
  "This report is the authored answer to the one question the settled availability model left open:",
  "**which individual routes a low Society Level withholds.** The model itself is settled and is not",
  "revisited here. What is authored is where each bound sits, and the consequence is measured rather",
  "than asserted.",
  "",
  "## Scope of this pass",
  "",
  ...wrap(
    "Only the **Society Level 1-2 boundary** is authored, together with the Social Band bounds that " +
      `bite inside it. A \`minSocietyLevel\` of ${availability.authoredCeiling} therefore means exactly ` +
      `"not at Society Level 1 or 2"; whether the true floor is ${availability.authoredCeiling}, 4, 5 ` +
      "or 6 is a later pass's decision, and the build refuses a higher bound so the wider claim cannot " +
      "be smuggled in here. For the same reason a Social Band bound is authored only on a route that " +
      "still exists at Society Level 1 or 2 — which is why the grid below is coarser above the " +
      "boundary than beneath it.",
  ),
  "",
  "## What the bounds are authored against",
  "",
  "`canonicalContent.json` already records, per society and per Social Band, which bodies of training",
  "that cell reaches. Read back, it gives four tiers and nothing else:",
  "",
  "| Tier | Society Level | Social Band |",
  "| --- | ---: | --- |",
  ...availability.canonicalAccessTiers.map(
    (tier) =>
      `| ${tier.name} | ${tier.minSocietyLevel} | ${tier.minSocialBand} ${bandName.get(tier.minSocialBand)} |`,
  ),
  "",
  "Two facts in that grid do real work here. The Society Level 1 society reaches the same set at",
  "**every** band — it has no trade, household or court stratum whose training differs — and a Society",
  "Level 2 society's ladder **stops at the trades tier**. Both reproduce below, from independently",
  "authored bounds rather than by construction.",
  "",
  "The grid is also coarser than this catalogue, and in one respect plainly stale: it admits scholarly,",
  "legal, fiscal and ship-command training at the Society Level 1 Common Folk cell, which the settled",
  "model would withhold. It is therefore used as corroboration for the **shape** of a restriction, never",
  "as per-group authority, and the divergence is reported rather than absorbed.",
  "",
  "## The grid",
  "",
  "Each cell counts what a learner in that society and that stratum can actually reach: Learning Groups",
  "whose own bound the cell meets, Professions with at least one satisfiable core route, and base Skills",
  "reached by the **union** of every valid route.",
  "",
  "| Society Level | Social Band | Learning Groups | Professions | Valid paths | Base Skills reached |",
  "| ---: | --- | ---: | ---: | ---: | ---: |",
  ...availability.cells.map(
    (row) =>
      `| ${row.societyLevel} | ${row.socialBand} ${bandName.get(row.socialBand)} | ${row.availableGroupIds.length} | ${row.professionCodes.length} | ${row.validPathIds.length} | ${row.reachableBaseSkillIds.length} |`,
  ),
  "",
  "## Inherent Learning Group minimums",
  "",
  ...wrap(
    `${availability.summary.unrestrictedGroups} of the ${availability.summary.groups} proposed ` +
      "Learning Groups carry no bound at all and are available at Society Level 1, Social Band L1. " +
      `${availability.summary.groupsFromSocietyLevel2} first exist at Society Level 2, and ` +
      `${availability.summary.groupsAboveSocietyLevel2} do not exist at Society Level 1 or 2.`,
  ),
  "",
  "A bound is authored here only where **the training itself** genuinely requires it. Two shapes are",
  "used: a Society Level alone, where the society must have the thing but the training is then ordinary",
  "work at any band; and a Society Level with a Social Band, where the training also belongs to a",
  "stratum.",
  "",
  "| Group | Name | Society Level | Social Band | Canonical tier | Why the training requires it |",
  "| --- | --- | ---: | --- | --- | --- |",
  ...availability.groupBounds.map(
    (row) =>
      `| ${row.groupId} | ${row.groupName} | ${row.minSocietyLevel} | ${row.minSocialBand} | ${
        availability.canonicalAccessTiers.find((tier) => tier.id === row.canonicalTierId)?.name ??
        "level only"
      } | ${row.reason} |`,
  ),
  "",
  "## Profession route restrictions",
  "",
  "The narrower tool, preferred wherever the restriction is specific to the occupational context: the",
  "curriculum exists here, but this occupation cannot reach it by this road. Each entry is one the",
  "group's own bound does not already cover.",
  "",
  "| Profession | Into | Society Level | Social Band | Why |",
  "| --- | --- | ---: | --- | --- |",
  ...availability.professionRouteBounds.map(
    (row) =>
      `| ${row.professionCode} ${professionName.get(row.professionCode) ?? ""} | ${row.groupId} | ${row.minSocietyLevel ?? 1} | ${row.minSocialBand ?? "L1"} | ${row.reason} |`,
  ),
  "",
  "## Direct route restrictions",
  "",
  "A direct route grants everything it lists as one route, so restricting it withdraws the whole grant.",
  "Each is therefore authored only where the **whole** grant belongs above the boundary. Every Skill a",
  "restriction withdraws is then either still reached by another route at that level, or is itself an",
  "absence recorded and argued below — nothing disappears unaccounted for.",
  "",
  "| Profession | Society Level | Social Band | Why |",
  "| --- | ---: | --- | --- |",
  ...availability.directRouteBounds.map(
    (row) =>
      `| ${row.professionCode} ${professionName.get(row.professionCode) ?? ""} | ${row.minSocietyLevel ?? 1} | ${row.minSocialBand ?? "L1"} | ${row.reason} |`,
  ),
  "",
  "## Flagged route gaps",
  "",
  "A route gap is a Skill that **plausibly belongs** at a low Society Level, but whose every authored",
  "route happens to require more. The settled model requires these to be flagged rather than treated as",
  "statements about the Skill, and explicitly forbids adding routes to close them — that would be adding",
  "routes to hit a coverage target, which is the thing the ruling rules out. Each flag is checked against",
  "the computed availability, so a flag that goes stale fails the build.",
  "",
  `${availability.summary.routeGaps} are flagged.`,
  "",
  ...availability.routeGaps.flatMap((gap) => [
    `### ${name(gap.skillId)} — no route at Society Level ${gap.unreachableAtSocietyLevel}`,
    "",
    gap.plausibility,
    "",
    ...gap.closedRoutes.map((route) => `- ${route}`),
    "",
  ]),
  "## Every Skill absent at Society Level 1, accounted for",
  "",
  ...wrap(
    `${availability.societyLevel1Absences.length} of the ${catalogue.coverage.baseSkills} base Skills ` +
      "have no route at Society Level 1. The set is asserted exactly, so the authored consequence of " +
      "this pass cannot drift, and each entry is either a **deliberate** statement about the society " +
      "or a flagged **route gap**.",
  ),
  "",
  "| Skill | Disposition |",
  "| --- | --- |",
  ...availability.societyLevel1Absences.map(
    (row) => `| ${name(row.skillId)} | ${row.disposition} |`,
  ),
  "",
  "## Cores and paths under restriction",
  "",
  ...wrap(
    `Every one of the ${catalogue.manifest.validPaths} valid paths still satisfies an applicable core ` +
      "route somewhere, which the build asserts: a Profession that existed nowhere would fail rather " +
      "than ship. A society that supports none of a Profession's core routes simply does not support " +
      "that Profession, which is the model working rather than a defect.",
  ),
  "",
  ...(() => {
    const scribeCells = availability.cells.filter((row) =>
      row.validPathIds.includes("profession:scribe"),
    );
    const lowest = scribeCells[0];
    return wrap(
      "**P65 Scribe and Copyist** is the case to watch, because its core is G11 plus a free choice " +
        "over the written-language set rather than a named group. G11 is a records office, which does " +
        "not exist at Society Level 1 or 2, so the Scribe first exists at Society Level " +
        `${lowest?.societyLevel ?? "—"}, band ${lowest?.socialBand ?? "—"} — at ${scribeCells.length} ` +
        `of the ${availability.cells.length} cells in all. The written-language choice is satisfiable ` +
        "at every one of them, and the build checks that directly rather than letting it surface later " +
        "as an unexplained core failure.",
    );
  })(),
  "",
  "## Specializations whose parent is not reached under restriction",
  "",
  ...(() => {
    const total = availability.cells.reduce(
      (sum, row) => sum + row.specializationsWithoutTheirParent.length,
      0,
    );
    return wrap(
      total === 0
        ? "None, at any cell. A restricted path never offers a Specialization whose parent Skill that " +
            "same path no longer reaches."
        : `${total} across all cells, reported rather than absorbed: a direct route grants everything ` +
            "it lists as one route, so the catalogue cannot always separate them.",
    );
  })(),
  "",
];
writeFileSync(join(outDir, "society-level-availability-v2.md"), availabilityLines.join("\n"));

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
      retiredProposedGroups: competencyContentV2RetiredProposedGroups,
      families: catalogue.families,
      paths: catalogue.paths,
      categories: catalogue.categories,
      civilizationLanguages: competencyContentV2CivilizationLanguages,
      societyLevelAvailability: {
        ...analysis.societyLevelAvailability,
        /* Cells are emitted compactly. The reachable Skill set is the complement of the unreachable
           one against the base-Skill catalogue, and repeating 24 copies of it would roughly double
           this file for no added fact. */
        cells: analysis.societyLevelAvailability.cells.map((row) => ({
          societyLevel: row.societyLevel,
          socialBand: row.socialBand,
          availableGroupIds: row.availableGroupIds,
          professionCodes: row.professionCodes,
          validPaths: row.validPathIds.length,
          reachableBaseSkills: row.reachableBaseSkillIds.length,
          unreachableBaseSkillIds: row.unreachableBaseSkillIds,
          reachableSpecializations: row.reachableSpecializationIds.length,
          specializationsWithoutTheirParent: row.specializationsWithoutTheirParent,
        })),
      },
    },
    null,
    2,
  ) + "\n",
);

console.log(`Written proposal report to ${outDir}`);
