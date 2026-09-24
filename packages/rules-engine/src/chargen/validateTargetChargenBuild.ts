import { applyRelationshipMinimumGrants } from "../skills/deriveSkillRelationships";
import { getExclusiveProfessionGroupErrors } from "./exclusiveProfessionGroups";
import type { CharacterBuild } from "@glantri/domain";
import type { CanonicalContentShape } from "./primaryAllocation/_helpers";
import { buildChargenSkillAccessSummary } from "./primaryAllocation/access";
import { evaluateSkillSelection } from "../skills/evaluateSkillSelection";
import { buildChargenMotherTongueSummary } from "./selectionStructure";
import { getActiveGroupSkillCost, getOrdinaryPoolTotal } from "./primaryAllocation/costs";
import { buildChargenCoreRouteStatus } from "./coreRouteSelection";

/** Validate target Chargen purchases against server-resolved content, never caller packages. */
export function validateTargetChargenBuild(
  build: CharacterBuild,
  content: CanonicalContentShape,
): string[] {
  if (
    !build.targetChargen &&
    !build.professionId?.startsWith("profession:") &&
    !build.progression.skillGroups.some((g) =>
      content.chargenCatalogue?.groupIds?.includes(g.groupId),
    )
  )
    return [];
  const errors: string[] = getExclusiveProfessionGroupErrors({
    content,
    professionId: build.professionId,
    progression: build.progression,
  });
  const profession = content.professions.find((p) => p.id === build.professionId);
  if (!profession) return ["Unknown target Profession or track."];
  const expected = {
    familyId: profession.familyId,
    trackId: profession.id === profession.familyId ? undefined : profession.id,
    professionName: profession.name,
    sourceDigest: content.chargenCatalogue?.professionSourceDigest,
    groupSourceDigest: content.chargenCatalogue?.groupSourceDigest,
  };
  if (
    build.targetChargen &&
    Object.entries(expected).some(
      ([k, v]) => build.targetChargen?.[k as keyof typeof build.targetChargen] !== v,
    )
  )
    errors.push("Profession family, track or source metadata does not match the approved package.");
  const access = buildChargenSkillAccessSummary({
    content,
    professionId: profession.id,
    societyId: build.societyId,
    societyLevel: build.societyLevel ?? 1,
  });
  const coreRouteStatus = buildChargenCoreRouteStatus({
    content,
    professionId: profession.id,
    progression: build.progression,
    societyId: build.societyId,
    socialBand: build.societyLevel ?? 1,
  });
  if (!coreRouteStatus.isSelectionValid)
    errors.push("Invalid or missing Profession core-route selection.");
  else if (coreRouteStatus.effectiveRoute && !coreRouteStatus.isComplete)
    errors.push(`Incomplete Profession core route: ${coreRouteStatus.effectiveRoute.label}.`);
  let ordinaryEligibleCost = 0,
    flexibleOnlyCost = 0;
  const p = build.progression;
  // Derived grants are recomputed from purchases using the existing relationship engine.
  // Submitted derived ranks and attribution cannot seed or amplify that computation.
  const purchases = structuredClone(p);
  for (const row of [...purchases.skills, ...purchases.specializations]) {
    row.relationshipGrantedRanks = 0;
    delete row.relationshipGrantSourceName;
    delete row.relationshipGrantSourceSkillId;
    delete row.relationshipGrantSourceType;
    if ("primaryRanks" in row) {
      if (row.sourceTag !== "mother-tongue") row.grantedRanks = 0;
      row.ranks = row.grantedRanks + row.primaryRanks + row.secondaryRanks;
    } else row.ranks = row.secondaryRanks;
  }
  const derived = applyRelationshipMinimumGrants({
    content: {
      ...content,
      skills: content.skills.filter(
        (s) =>
          content.chargenCatalogue!.skillIds.includes(s.id) ||
          p.skills.some((row) => row.skillId === s.id),
      ),
      specializations: content.specializations.filter(
        (s) =>
          content.chargenCatalogue!.specializationIds.includes(s.id) ||
          p.specializations.some((row) => row.specializationId === s.id),
      ),
    },
    progression: purchases,
  });
  const grantKeys = [
    "relationshipGrantedRanks",
    "relationshipGrantSourceName",
    "relationshipGrantSourceSkillId",
    "relationshipGrantSourceType",
  ] as const;
  for (const expected of [...derived.skills, ...derived.specializations]) {
    const id =
      "skillId" in expected && !("specializationId" in expected)
        ? expected.skillId
        : expected.specializationId;
    const actual =
      "specializationId" in expected
        ? p.specializations.find((s) => s.specializationId === id)
        : p.skills.find((s) => s.skillId === id && s.languageName === expected.languageName);
    if (
      grantKeys.some((key) =>
        key === "relationshipGrantedRanks"
          ? (actual?.[key] ?? 0) !== (expected[key] ?? 0)
          : actual?.[key] !== expected[key],
      )
    )
      errors.push(`Invalid derived relationship grant: ${id}.`);
  }
  for (const group of p.skillGroups) {
    const approved = content.skillGroups.find((g) => g.id === group.groupId);
    if (
      group.targetDefinition &&
      JSON.stringify(group.targetDefinition) !== JSON.stringify(approved)
    )
      errors.push(`Forged Learning Group metadata: ${group.groupId}.`);
    if (!access.normalSkillGroupIds.includes(group.groupId))
      errors.push(`No Profession access to Learning Group ${group.groupId}.`);
    if (group.grantedRanks !== 0 || group.ranks !== group.primaryRanks + group.secondaryRanks)
      errors.push(`Invalid unpurchased group ranks: ${group.groupId}.`);
    const quote = getActiveGroupSkillCost({ content, groupId: group.groupId, progression: p });
    if (quote.cost === undefined) errors.push(quote.error ?? "Invalid group quote.");
    else {
      if (group.secondaryRanks > 0)
        errors.push(`Invalid flexible-rank attribution for Learning Group ${group.groupId}.`);
      ordinaryEligibleCost += (group.primaryRanks + group.secondaryRanks) * quote.cost;
    }
  }
  for (const skill of p.skills) {
    if (skill.sourceTag === "mother-tongue") {
      const mother = buildChargenMotherTongueSummary({
        content,
        civilizationId: build.civilizationId,
        educationLevel: p.educationPoints,
      });
      if (
        skill.skillId !== "language" ||
        !mother.skill ||
        skill.languageName !== mother.languageName ||
        skill.grantedRanks !== mother.startingLevel ||
        skill.ranks !== skill.grantedRanks + skill.primaryRanks + skill.secondaryRanks
      )
        errors.push("Invalid mother-tongue grant.");
      ordinaryEligibleCost += skill.primaryRanks * 2;
      flexibleOnlyCost += skill.secondaryRanks * 2;
      continue;
    }
    if (
      skill.grantedRanks !== 0 ||
      skill.ranks !==
        skill.primaryRanks + skill.secondaryRanks + (skill.relationshipGrantedRanks ?? 0)
    )
      errors.push(`Invalid unpurchased competency ranks: ${skill.skillId}.`);
    if (!content.chargenCatalogue?.skillIds.includes(skill.skillId)) {
      errors.push(`Unknown target competency ${skill.skillId}.`);
      continue;
    }
    const definition = content.skills.find((s) => s.id === skill.skillId);
    if (definition)
      errors.push(
        ...evaluateSkillSelection({
          content,
          progression: p,
          target: { targetType: "skill", skill: definition },
        }).blockingReasons.map((r) => r.message),
      );
    const ordinary = access.normalSkillIds.includes(skill.skillId);
    const purchasedRanks = skill.primaryRanks + skill.secondaryRanks;
    if (ordinary) {
      if (purchasedRanks > 0 && (skill.secondaryRanks > 0 || skill.category !== "ordinary"))
        errors.push(`Invalid ordinary-rank attribution for ${skill.skillId}.`);
      ordinaryEligibleCost += purchasedRanks * 2;
    } else {
      if (purchasedRanks > 0 && (skill.primaryRanks > 0 || skill.category !== "secondary"))
        errors.push(`Invalid flexible-rank attribution for ${skill.skillId}.`);
      flexibleOnlyCost += purchasedRanks;
    }
  }
  for (const spec of p.specializations) {
    if (spec.ranks !== spec.secondaryRanks + (spec.relationshipGrantedRanks ?? 0))
      errors.push(`Invalid unpurchased Specialization ranks: ${spec.specializationId}.`);
    if (!content.chargenCatalogue?.specializationIds.includes(spec.specializationId))
      errors.push(`Unknown target Specialization ${spec.specializationId}.`);
    const definition = content.specializations.find((s) => s.id === spec.specializationId);
    if (definition)
      errors.push(
        ...evaluateSkillSelection({
          content,
          progression: p,
          target: { targetType: "specialization", specialization: definition },
        }).blockingReasons.map((r) => r.message),
      );
    flexibleOnlyCost += spec.secondaryRanks > 0 ? 4 + (spec.secondaryRanks - 1) * 2 : 0;
  }
  const primary = Math.min(getOrdinaryPoolTotal(p), ordinaryEligibleCost);
  const secondary = flexibleOnlyCost + Math.max(0, ordinaryEligibleCost - primary);
  if (p.primaryPoolSpent !== primary || p.secondaryPoolSpent !== secondary)
    errors.push("Recorded Chargen spending does not match authoritative purchase prices.");
  if (
    new Set(p.skillGroups.map((g) => g.groupId)).size !== p.skillGroups.length ||
    new Set(p.skills.map((s) => s.skillId)).size !== p.skills.length ||
    new Set(p.specializations.map((s) => s.specializationId)).size !== p.specializations.length
  )
    errors.push("Duplicate target purchase identity.");
  return errors;
}
