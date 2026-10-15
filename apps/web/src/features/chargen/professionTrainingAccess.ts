import {
  competencyContentV2DirectRouteAvailability,
  competencyContentV2GroupAvailability,
  competencyContentV2ProfessionRouteAvailability,
} from "@glantri/content";
import type {
  CompetencyV2Path,
  CompetencyV2Route,
  CompetencyV2Runtime,
  SkillGroupDefinition,
  SocietyDefinition,
} from "@glantri/domain";
import { resolveCompetencyV2PathAvailability } from "@glantri/rules-engine";

/**
 * Why a Profession a Character may choose has no training this Character can reach.
 *
 * This reads access state. It never changes it: the Product Owner ruling of 2026-10-15 on Forgejo
 * #635 keeps the accepted `minSocialBand` and `minSocietyLevel` behaviour exactly as it is, and
 * says the defect was the silence rather than the gating. 569 of the 5504
 * Civilization x social-class x Profession combinations reach no Profession training at all, and
 * until now the application said nothing about any of them.
 *
 * Two separate world facts produce them, and they are different sentences to a reader:
 *
 * - the society itself has nothing to be trained in (329 combinations);
 * - the training exists in the society but not for a Character of this social class (225);
 * - both at once (15).
 *
 * The explanation quotes the catalogue's own authored prose and never writes a justification of its
 * own. Where the catalogue attributes no reason, the reader gets the situation and nothing more.
 */
export type ProfessionTrainingClosure =
  | "society"
  | "social-class"
  | "society-and-social-class"
  | "unattributed";

export interface ProfessionTrainingAccess {
  /**
   * Verbatim prose from the accepted Competency Content V2 catalogue, when a bound that actually
   * closes this Profession carries one. Never composed, never paraphrased, absent when the
   * catalogue attributes none.
   */
  authoredReasons: string[];
  closedBy: ProfessionTrainingClosure;
  /** The reader-facing statement of the situation. States what is so; justifies nothing. */
  situation: string;
}

interface TrainingAccessContent {
  competencyV2?: CompetencyV2Runtime;
  skillGroups: SkillGroupDefinition[];
  societies?: SocietyDefinition[];
}

const socialBandNumber = (band?: string) => Number((band ?? "L1").slice(1));

/** Which authored bound closes a projected route here, and on which of the two dimensions. */
function readClosedRoute(
  path: CompetencyV2Path,
  route: CompetencyV2Route,
  societyLevel: number,
  socialBand: number,
) {
  const dimensions: ProfessionTrainingClosure[] = [];
  if ((route.minSocietyLevel ?? 1) > societyLevel) dimensions.push("society");
  if (socialBandNumber(route.minSocialBand) > socialBand) dimensions.push("social-class");

  /*
   * The projected route carries the combined bound, so it says *that* the route is closed but not
   * which authored record said so. The authored prose lives on the catalogue's own availability
   * records, which the runtime projection does not carry.
   */
  const authored =
    route.kind === "group" && route.groupId
      ? [
          competencyContentV2GroupAvailability[route.groupId],
          competencyContentV2ProfessionRouteAvailability.find(
            (bound) =>
              bound.professionCode === path.familyCode &&
              bound.trackId === path.trackId &&
              bound.groupId === route.groupId,
          ),
        ]
      : [
          competencyContentV2DirectRouteAvailability.find(
            (bound) => bound.professionCode === path.familyCode && bound.trackId === path.trackId,
          ),
        ];

  const reasons = authored.flatMap((bound) => {
    if (!bound?.reason?.trim()) return [];
    const closesHere =
      (bound.minSocietyLevel ?? 1) > societyLevel ||
      socialBandNumber(bound.minSocialBand) > socialBand;
    return closesHere ? [bound.reason] : [];
  });

  return { dimensions, reasons };
}

function resolveClosure(dimensions: ProfessionTrainingClosure[]): ProfessionTrainingClosure {
  const unique = new Set(dimensions);
  if (unique.has("society") && unique.has("social-class")) return "society-and-social-class";
  if (unique.has("society")) return "society";
  if (unique.has("social-class")) return "social-class";
  return "unattributed";
}

function buildSituation(closedBy: ProfessionTrainingClosure, civilizationName?: string): string {
  const people = civilizationName ? `among the ${civilizationName}` : "in this civilization";
  switch (closedBy) {
    case "society":
      return `No one ${people} trains this Profession.`;
    case "social-class":
      return "This Profession's training is not open to a Character of this social class.";
    case "society-and-social-class":
      return `No one ${people} trains this Profession, and its training is not open to a Character of this social class either.`;
    default:
      /*
       * The honest generic state. It explains the situation without justifying it, because inventing
       * a rationale the catalogue does not author is the one thing the #635 ruling forbids outright.
       */
      return "No training for this Profession is available to this Character.";
  }
}

/**
 * The explanation for a Profession with no reachable training, or `undefined` when training is
 * reachable or the draft has not yet chosen enough to say.
 */
export function buildProfessionTrainingAccess(input: {
  civilizationName?: string;
  content: TrainingAccessContent;
  professionId?: string;
  socialBand?: number;
  societyId?: string;
}): ProfessionTrainingAccess | undefined {
  const projection = input.content.competencyV2;
  if (!projection || !input.professionId || !input.societyId || input.socialBand === undefined) {
    return undefined;
  }

  const socialBand = input.socialBand;
  const path = projection.paths.find((candidate) => candidate.id === input.professionId);
  if (!path) return undefined;

  const availability = resolveCompetencyV2PathAvailability({
    content: input.content,
    professionId: input.professionId,
    socialBand,
    societyId: input.societyId,
  });
  if (!availability || availability.valid) return undefined;

  const societyLevel = input.content.societies?.find(
    (society) => society.id === input.societyId,
  )?.societyLevel;
  if (societyLevel === undefined) {
    return {
      authoredReasons: [],
      closedBy: "unattributed",
      situation: buildSituation("unattributed", input.civilizationName),
    };
  }

  const openRoutes = path.routes.filter(
    (route) =>
      (route.minSocietyLevel ?? 1) <= societyLevel &&
      socialBandNumber(route.minSocialBand) <= socialBand,
  );
  const openGroupIds = new Set(
    openRoutes.flatMap((route) => (route.groupId ? [route.groupId] : [])),
  );
  const openDirectSkillIds = new Set(
    openRoutes.filter((route) => route.kind === "direct").flatMap((route) => route.skillIds),
  );

  /*
   * Satisfying any one core route is sufficient, so the Profession is closed only when every
   * alternative is unreachable. Each unreachable requirement is traced back to the authored bound
   * that closes the route it needed.
   */
  const closed = path.coreRoutes.flatMap((core) => [
    ...core.groupIds
      .filter((groupId) => !openGroupIds.has(groupId))
      .flatMap((groupId) =>
        path.routes
          .filter((route) => route.kind === "group" && route.groupId === groupId)
          .map((route) => readClosedRoute(path, route, societyLevel, socialBand)),
      ),
    ...core.skillIds
      .filter((skillId) => !openDirectSkillIds.has(skillId))
      .flatMap((skillId) =>
        path.routes
          .filter((route) => route.kind === "direct" && route.skillIds.includes(skillId))
          .map((route) => readClosedRoute(path, route, societyLevel, socialBand)),
      ),
  ]);

  const authoredReasons = [...new Set(closed.flatMap((entry) => entry.reasons))];
  const closedBy = resolveClosure(closed.flatMap((entry) => entry.dimensions));

  return {
    authoredReasons,
    closedBy,
    situation: buildSituation(closedBy, input.civilizationName),
  };
}
