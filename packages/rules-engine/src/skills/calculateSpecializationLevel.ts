/**
 * A Specialization's effective XP.
 *
 * Rule decision 0010 ruling 3 settles for V1 that a genuine Specialization listed in a Learning
 * Group receives an acquisition and training route only. Clause 1 keeps Group cost and Group XP
 * on the Group's base Skills; clauses 4, 5 and 6 make the Specialization separately acquired and
 * progressed, with no retroactive Group-XP catch-up and nothing added by further Group purchases.
 *
 * No Learning Group level is therefore an input to this value, and this function deliberately
 * does not accept one. The retired arithmetic added `floor(groupLevel / 2)`, drawn from the
 * strongest active Learning Group of the Specialization's parent Skill — so a Group that taught
 * the parent paid Specialization XP whether or not it taught the Specialization at all.
 *
 * Clause 7 keeps competency relationships as non-additive minima. `relationshipGrantedXp` is the
 * shortfall the shared calculation in `deriveSkillRelationships` resolves against owned XP
 * (`resolveRelationshipMinimumGrants`), so adding the two terms yields the minimum floor rather
 * than a bonus on top of it. The floor is never recomputed here.
 */
export interface CalculateSpecializationLevelInput {
  /** XP the Character purchased in this Specialization. */
  ownedSpecializationXp: number;
  /**
   * Shortfall that raises owned XP to a relationship minimum, from
   * `resolveRelationshipMinimumGrants`. Never an additive bonus.
   */
  relationshipGrantedXp?: number;
}

export function calculateSpecializationLevel(input: CalculateSpecializationLevelInput): number {
  return input.ownedSpecializationXp + (input.relationshipGrantedXp ?? 0);
}
