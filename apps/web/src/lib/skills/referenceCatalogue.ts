import type {
  ReferenceAccessGrid,
  ReferenceBound,
  ReferenceLink,
  ReferenceReaderContent,
  SkillReferenceGroup,
  SkillReferenceModel,
  SkillReferenceProfession,
} from "./skillReferenceModel";

/**
 * Derived reader presentation for the canonical V2 competency catalogue.
 *
 * Everything here reflects canonical V2 data. Nothing here repairs it, fills a gap by inference, or
 * invents an availability semantic: where the canonical content stops, the returned value says so.
 *
 * THIS IS THE ONE CANONICAL PROFESSION PROJECTION. The competency reference at `/skills` and the
 * Chargen Profession experience both consume `professionTraining` and `readerProse` from here.
 * Forgejo #372 section 0.6 requires exactly one derivation of `Profession -> Learning Group ->
 * Skill`, because two interpretations of the same graph are how the two surfaces drift apart. Do
 * not add a second derivation for Chargen.
 */

/* ---------------------------------------------------------------- reader prose */

/**
 * The prose a reader actually sees, with the two published population rules handled explicitly.
 *
 * `#361` publishes `readerContent.shortDescription` only for the Learning Groups whose prose is
 * accepted, so the remainder would render an empty summary; `canonicalSummary` is the canonical
 * one-line description those rows fall back to. `full` stays `undefined` when the full prose has not
 * been authored, because section 9.7 and section 9.12 forbid presenting a one-liner as full prose.
 */
export type ReaderProse = {
  summary: string;
  full?: string;
  typicalActivities: string[];
  boundaries: string[];
};

export function readerProse(
  content: ReferenceReaderContent,
  canonicalSummary: string,
): ReaderProse {
  return {
    summary: content.shortDescription?.trim() || canonicalSummary,
    full: content.description?.trim() || undefined,
    typicalActivities: content.typicalActivities ?? [],
    boundaries: content.boundaries ?? [],
  };
}

/* ------------------------------------------------------- availability reflection */

export type EarliestAccess = { societyLevel: number; socialBand: string; bandName: string };

function bandOrder(grid: ReferenceAccessGrid): string[] {
  return grid.socialBands.map((band) => band.id);
}

/** The lowest authored Society Level and Social Band at which a predicate first holds. */
export function earliestAccess(
  grid: ReferenceAccessGrid,
  holds: (cell: ReferenceAccessGrid["cells"][number]) => boolean,
): EarliestAccess | undefined {
  const order = bandOrder(grid);
  const found = grid.cells
    .filter((cell) => cell.societyLevel <= grid.authoredCeiling && holds(cell))
    .sort(
      (a, b) =>
        a.societyLevel - b.societyLevel ||
        order.indexOf(a.socialBand) - order.indexOf(b.socialBand),
    )[0];
  if (!found) return undefined;
  return {
    societyLevel: found.societyLevel,
    socialBand: found.socialBand,
    bandName:
      grid.socialBands.find((band) => band.id === found.socialBand)?.name ?? found.socialBand,
  };
}

/** Reader wording for an earliest-access result, including the honest "no authored route" case. */
export function accessLabel(grid: ReferenceAccessGrid, access: EarliestAccess | undefined): string {
  if (!access) return "No authored route";
  const openBand = grid.socialBands[0]?.id;
  return access.socialBand === openBand
    ? `Society Level ${access.societyLevel}`
    : `Level ${access.societyLevel}, ${access.bandName}`;
}

/**
 * One pass over the authored cells, lowest Society Level and Social Band first, so every canonical
 * identifier gets its earliest authored access without rescanning the grid per row.
 */
export function earliestAccessIndex(
  grid: ReferenceAccessGrid,
  pick: (cell: ReferenceAccessGrid["cells"][number]) => string[],
): Map<string, EarliestAccess> {
  const order = bandOrder(grid);
  const index = new Map<string, EarliestAccess>();
  const authored = grid.cells
    .filter((cell) => cell.societyLevel <= grid.authoredCeiling)
    .sort(
      (a, b) =>
        a.societyLevel - b.societyLevel ||
        order.indexOf(a.socialBand) - order.indexOf(b.socialBand),
    );
  for (const cell of authored) {
    const bandName =
      grid.socialBands.find((band) => band.id === cell.socialBand)?.name ?? cell.socialBand;
    for (const id of pick(cell))
      if (!index.has(id))
        index.set(id, {
          societyLevel: cell.societyLevel,
          socialBand: cell.socialBand,
          bandName,
        });
  }
  return index;
}

export type AccessOverviewRow =
  | { societyLevel: number; authored: true; cells: { socialBand: string; label: string }[] }
  | { societyLevel: number; authored: false };

/**
 * Society Level rows by Social Band columns. Above the authored ceiling the row carries no cells at
 * all: that content is unauthored rather than absent, and a count copied down from the ceiling would
 * be an invented availability claim.
 */
export function accessOverviewRows(
  grid: ReferenceAccessGrid,
  cellLabel: (cell: ReferenceAccessGrid["cells"][number]) => string,
): AccessOverviewRow[] {
  return grid.societyLevels.map((societyLevel) => {
    if (societyLevel > grid.authoredCeiling) return { societyLevel, authored: false };
    return {
      societyLevel,
      authored: true,
      cells: grid.socialBands.map((band) => {
        const cell = grid.cells.find(
          (row) => row.societyLevel === societyLevel && row.socialBand === band.id,
        );
        return { socialBand: band.id, label: cell ? cellLabel(cell) : "No authored route" };
      }),
    };
  });
}

/* ------------------------------------------------------------- Learning Groups */

export type GroupTraining = {
  fixedBaseSkills: number;
  trainingChoices: number;
  specializations: number;
  professionRoutes: number;
};

export function groupTraining(
  group: SkillReferenceGroup,
  isSpecialization: (id: string) => boolean,
): GroupTraining {
  return {
    fixedBaseSkills: group.fixedSkills.filter((skill) => !isSpecialization(skill.id)).length,
    trainingChoices: group.selectionSlots.reduce((total, slot) => total + slot.chooseCount, 0),
    specializations: group.specializations.length,
    professionRoutes: new Set(group.professionRoutes.map((route) => route.id)).size,
  };
}

/* ----------------------------------------------------------------- Professions */

export type TrainingChoice = {
  id: string;
  label: string;
  chooseCount: number;
  candidates: ReferenceLink[];
};
export type RouteEntry = {
  id: string;
  label: string;
  group?: ReferenceLink;
  teaches: ReferenceLink[];
  specializations: ReferenceLink[];
  choices: TrainingChoice[];
  bound?: ReferenceBound;
};
export type CoreAlternative = {
  id: string;
  label: string;
  entries: RouteEntry[];
  writtenTraditionChoices: number;
  baseSkills: number;
  specializations: number;
};
export type ReachableCompetency = {
  link: ReferenceLink;
  specialization: boolean;
  reach: string;
};
export type ProfessionTraining = {
  /** Narrative order: core training first. */
  coreAlternatives: CoreAlternative[];
  /** Then alternative and additional training routes. */
  additional: RouteEntry[];
  /** Then direct training. */
  direct: RouteEntry[];
  /** Section 5.2 effective distinct base-Skill breadth. A range only when core routes differ. */
  effectiveBaseSkills: { min: number; max: number };
  effectiveSpecializations: { min: number; max: number };
  writtenTraditionChoices: number;
  /** Section 5.2's separately reportable possible reach. Never the effective breadth. */
  possibleBaseSkillReach: number;
  reachable: ReachableCompetency[];
  totalTrainingRoutes: number;
};

function entryFor(
  route: SkillReferenceProfession["routes"][number],
  groupsById: Map<string, SkillReferenceGroup>,
  isSpecialization: (id: string) => boolean,
): RouteEntry {
  const group = route.group ? groupsById.get(route.group.id) : undefined;
  return {
    id: route.id,
    label: route.label,
    group: route.group,
    teaches: group
      ? group.fixedSkills.filter((skill) => !isSpecialization(skill.id))
      : route.skills.filter((skill) => !isSpecialization(skill.id)),
    specializations: group
      ? group.specializations
      : [...route.specializations, ...route.skills.filter((skill) => isSpecialization(skill.id))],
    choices: (group?.selectionSlots ?? []).map((slot) => ({
      id: `${route.id}:${slot.id}`,
      label: slot.label,
      chooseCount: slot.chooseCount,
      candidates: slot.candidates,
    })),
    bound: route.bound,
  };
}

/**
 * Applies the settled section 5.2 counting rules: deduplicate a Skill reached through several
 * routes, count fixed Skills, count only `chooseCount` for a choice slot, exclude unselected
 * alternatives, evaluate mutually exclusive tracks separately (each canonical path is already one
 * track), and exclude Specializations from base-Skill totals.
 */
function countAlternative(
  entries: RouteEntry[],
  coreSkills: ReferenceLink[],
  isSpecialization: (id: string) => boolean,
): { baseSkills: number; specializations: number } {
  const fixed = new Set<string>();
  const specializations = new Set<string>();
  for (const entry of entries) {
    for (const skill of entry.teaches) fixed.add(skill.id);
    for (const skill of entry.specializations) specializations.add(skill.id);
  }
  for (const skill of coreSkills)
    (isSpecialization(skill.id) ? specializations : fixed).add(skill.id);
  /* Reserve concrete candidates so a Skill offered by two slots is never counted twice. */
  const reserved = new Set<string>();
  let choiceBreadth = 0;
  for (const entry of entries) {
    for (const choice of entry.choices) {
      let taken = 0;
      for (const candidate of choice.candidates) {
        if (taken >= choice.chooseCount) break;
        if (isSpecialization(candidate.id)) continue;
        if (fixed.has(candidate.id) || reserved.has(candidate.id)) continue;
        reserved.add(candidate.id);
        taken += 1;
      }
      choiceBreadth += taken;
    }
  }
  return { baseSkills: fixed.size + choiceBreadth, specializations: specializations.size };
}

export function professionTraining(
  profession: SkillReferenceProfession,
  model: Pick<SkillReferenceModel, "learningGroups" | "skills">,
): ProfessionTraining {
  const groupsById = new Map(model.learningGroups.map((group) => [group.id, group]));
  const specializationIds = new Set(
    model.skills.filter((skill) => skill.type === "Specialization").map((skill) => skill.id),
  );
  const isSpecialization = (id: string) => specializationIds.has(id);

  const coreGroupIds = new Set(
    profession.coreAlternatives.flatMap((core) => core.groups.map((group) => group.id)),
  );
  const groupRoutes = profession.routes.filter((route) => route.kind === "group");
  const direct = profession.routes
    .filter((route) => route.kind === "direct")
    .map((route) => entryFor(route, groupsById, isSpecialization));
  const additional = groupRoutes
    .filter((route) => !route.group || !coreGroupIds.has(route.group.id))
    .map((route) => entryFor(route, groupsById, isSpecialization));

  const coreAlternatives: CoreAlternative[] = profession.coreAlternatives.map((core) => {
    const ids = new Set(core.groups.map((group) => group.id));
    const entries = groupRoutes
      .filter((route) => route.group && ids.has(route.group.id))
      .map((route) => entryFor(route, groupsById, isSpecialization));
    /* Unselected alternatives are excluded; every additional and direct route always applies. */
    const counted = countAlternative(
      [...entries, ...additional, ...direct],
      core.skills,
      isSpecialization,
    );
    return {
      id: core.id,
      label: core.label,
      entries,
      writtenTraditionChoices: core.writtenChoiceCount,
      ...counted,
    };
  });

  const withoutCore = countAlternative([...additional, ...direct], [], isSpecialization);
  const baseCounts = coreAlternatives.length
    ? coreAlternatives.map((core) => core.baseSkills)
    : [withoutCore.baseSkills];
  const specCounts = coreAlternatives.length
    ? coreAlternatives.map((core) => core.specializations)
    : [withoutCore.specializations];

  /* Possible reach: the union of every alternative and every candidate pool. Reported separately. */
  const everyEntry = [
    ...coreAlternatives.flatMap((core) => core.entries),
    ...additional,
    ...direct,
  ];
  const possible = new Set<string>();
  for (const entry of everyEntry) {
    for (const skill of entry.teaches) possible.add(skill.id);
    for (const choice of entry.choices)
      for (const candidate of choice.candidates)
        if (!isSpecialization(candidate.id)) possible.add(candidate.id);
  }
  for (const core of profession.coreAlternatives)
    for (const skill of core.skills) if (!isSpecialization(skill.id)) possible.add(skill.id);

  /* The deduplicated list a player would otherwise rebuild by opening every Learning Group. */
  const single = coreAlternatives.length <= 1;
  const ranked = new Map<string, ReachableCompetency & { rank: number }>();
  const note = (link: ReferenceLink, reachText: string, rank: number) => {
    const existing = ranked.get(link.id);
    if (existing && existing.rank <= rank) return;
    ranked.set(link.id, {
      link,
      specialization: isSpecialization(link.id),
      reach: reachText,
      rank,
    });
  };
  const noteEntries = (entries: RouteEntry[], reachText: string, rank: number) => {
    for (const entry of entries) {
      for (const skill of entry.teaches) note(skill, reachText, rank);
      for (const skill of entry.specializations) note(skill, reachText, rank);
      for (const choice of entry.choices)
        for (const candidate of choice.candidates) note(candidate, `Choice: ${choice.label}`, 2);
    }
  };
  noteEntries([...additional, ...direct], "Always taught", 0);
  for (const core of coreAlternatives)
    noteEntries(core.entries, single ? "Always taught" : `With ${core.label}`, single ? 0 : 1);
  for (const core of profession.coreAlternatives)
    for (const skill of core.skills)
      note(skill, single ? "Always taught" : `With ${core.label}`, single ? 0 : 1);

  return {
    coreAlternatives,
    additional,
    direct,
    effectiveBaseSkills: { min: Math.min(...baseCounts), max: Math.max(...baseCounts) },
    effectiveSpecializations: { min: Math.min(...specCounts), max: Math.max(...specCounts) },
    writtenTraditionChoices: Math.max(
      0,
      ...profession.coreAlternatives.map((core) => core.writtenChoiceCount),
    ),
    possibleBaseSkillReach: possible.size,
    reachable: [...ranked.values()]
      .map(({ link, specialization, reach }) => ({ link, specialization, reach }))
      .sort((a, b) => a.link.name.localeCompare(b.link.name)),
    totalTrainingRoutes: profession.routes.length,
  };
}

/** Reader wording for an effective-breadth count, which may legitimately be a range. */
export function rangeLabel(range: { min: number; max: number }): string {
  return range.min === range.max ? String(range.min) : `${range.min}–${range.max}`;
}
