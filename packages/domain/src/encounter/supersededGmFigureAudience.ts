/**
 * Keeping `supersededGmFigure` out of player-reachable bodies (Forgejo #931, Product Owner ruling
 * on comment 21255; authorized narrowly on comment 21269).
 *
 * The field records the figure a GM had committed when a rule event replaced it. The ruling is
 * that this is GM workflow and not table-visible game state: a player sees the resulting effective
 * defence, never "the GM entered −1 and a rule replaced it".
 *
 * `playerFacingCombatModifierEntrySchema` does not carry the field, so every read that goes
 * through that allowlist is already clean. **Two player reads do not go through it**, and a
 * by-response-key sweep measured the field reaching the controlling player on both:
 *
 * - `GET /scenarios/:id/player-projection` →
 *   `projection.controlledParticipant.combatContext.modifierBuckets.situationDb[*]`, because
 *   `buildScenarioPlayerProjection` sanitises that context with a two-field denylist that lets
 *   every other field through;
 * - `GET /encounters/:id/combat-history` →
 *   `history.activeRound.events[*].facts.involvedOutcome.phaseContexts.phase2.modifierBuckets
 *   .situationDb[*]`, because a declaration event records its phase contexts whole into an open
 *   fact bucket that an `involved` viewer receives.
 *
 * Neither general defect is this lane's to solve — the denylist's shape is filed separately and
 * the open fact bucket is #528's. What *is* this lane's is that it introduced the field, so it
 * keeps it out of buckets that already fail open rather than widening them.
 *
 * ## Why a structural removal, and why here
 *
 * The two sites have nothing in common to key on. One holds a typed combat context; the other is
 * an open `Record<string, unknown>` whose contents vary by event type, where the field sits four
 * levels down inside whichever context the writer happened to record. A path-shaped strip would
 * have to be written twice and would miss the next writer that records a context somewhere else.
 * Removing the key wherever it appears is the property the ruling actually states — *no
 * player-reachable body contains the retained figure* — expressed once.
 *
 * The alternative considered and rejected was moving the figure out of the modifier row to a
 * location the open paths do not reach. That is another change to persisted combat-round state,
 * on a shape the Product Owner has already verified (comment 21234), to fix a read-side exposure.
 *
 * This module imports nothing. It is the one definition both layers call, and it names only this
 * lane's own field: it is not a general sanitizer and must not grow into one.
 */

/** The one field name this module removes. */
export const SUPERSEDED_GM_FIGURE_FIELD = "supersededGmFigure";

/**
 * Returns `value` with every `supersededGmFigure` property removed, at any depth, in objects and
 * arrays alike. Nodes that contain none are returned by reference, so a body without the field —
 * which is every body on a surface no rule event has touched — is not rebuilt at all.
 *
 * Non-plain values (dates, class instances, functions) are returned untouched: the structures this
 * runs over are parsed JSON and schema output.
 */
export function withoutSupersededGmFigure<Value>(value: Value): Value {
  return removeField(value) as Value;
}

function removeField(node: unknown): unknown {
  if (Array.isArray(node)) {
    let changed = false;
    const next = node.map((entry) => {
      const projected = removeField(entry);
      if (projected !== entry) changed = true;
      return projected;
    });
    return changed ? next : node;
  }

  if (node === null || typeof node !== "object" || !isPlainObject(node)) {
    return node;
  }

  const source = node as Record<string, unknown>;
  let changed = Object.hasOwn(source, SUPERSEDED_GM_FIGURE_FIELD);
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(source)) {
    if (key === SUPERSEDED_GM_FIGURE_FIELD) continue;
    const projected = removeField(entry);
    if (projected !== entry) changed = true;
    next[key] = projected;
  }
  return changed ? next : node;
}

function isPlainObject(node: object): boolean {
  const prototype = Object.getPrototypeOf(node) as unknown;
  return prototype === Object.prototype || prototype === null;
}
