import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(__dirname, "combatRoundManager.ts"), "utf8");

describe("initiative commit undo source conformance", () => {
  it("never persists the normalized combat round as new initiative undo facts", () => {
    const commitStart = source.indexOf(
      "export function commitCombatRoundPhaseInitiativeResolution",
    );
    const commitEnd = source.indexOf(
      "export function restoreCombatRoundPhaseInitiativeResolutionCombatContextModifiers",
      commitStart,
    );
    const commitSource = source.slice(commitStart, commitEnd);

    expect(commitStart).toBeGreaterThanOrEqual(0);
    expect(commitEnd).toBeGreaterThan(commitStart);
    expect(commitSource).not.toContain("previousState:");
    expect(commitSource).not.toContain("previousState: normalized");
    expect(commitSource).toContain("initiativeCommitUndo");
  });

  it("keeps legacy previousState parsing isolated to the undo compatibility path", () => {
    expect(source.match(/facts\.previousState/g)).toHaveLength(1);
    expect(source).toContain(
      "const previousState = combatRoundStateSchema.safeParse(command.facts.previousState);",
    );
  });
});

/**
 * #894 — the one writer of `initiativePublished` must derive the flag, not read "a roll exists".
 *
 * These are assertions about the writer's source text, and that is forced rather than preferred.
 * On every commit path the product can reach, the boundary a commit produces is strictly past the
 * initiative boundary — enumerated and asserted in
 * `combatRoundManager.test.ts`, "every reachable commit path produces a boundary strictly past the
 * initiative boundary" — so for every record the product can currently write,
 * `isCombatRoundCommittedInitiativeEntryPublished(...)` and the rejected
 * `initiativeResult !== undefined` return the same boolean. No assertion on a stored record, and no
 * assertion on any value a real commit produces, can therefore tell the correct writer from the
 * defect #894 replaced. Independent QA measured exactly that: the one-line defect restored at this
 * call site left the entire workspace suite green, 11 of 11 packages passing.
 *
 * The flag's declared value is what it prevents once take-back (#876) consumes it, so the
 * derivation is the only thing about it that can be protected today, and this is the instrument
 * class this repository already uses on this same source file, directly above.
 *
 * The alternative control — exporting `buildCombatRoundCommittedInitiativeOrder` so a test could
 * hand it a pre-commit boundary directly — would widen the production surface for a test's benefit.
 * It is not taken here; this repair changes no production file.
 */
describe("#894 committed initiative publication writer source conformance", () => {
  const writerStart = source.indexOf("function buildCombatRoundCommittedInitiativeOrder(input: {");
  const writerEnd = source.indexOf(
    "export function commitCombatRoundPhaseInitiativeResolution",
    writerStart,
  );
  const writerSource = source.slice(writerStart, writerEnd);

  it("slices the whole of the flag's computation, and nothing writes it elsewhere", () => {
    expect(writerStart).toBeGreaterThanOrEqual(0);
    expect(writerEnd).toBeGreaterThan(writerStart);
    // Two occurrences of the field in the file: its schema declaration, and the one writer sliced
    // above. A third would be a second writer outside the slice, which these assertions would not
    // see, so it fails here instead.
    expect(source.match(/initiativePublished:/g)).toHaveLength(2);
    expect(source).toContain("initiativePublished: z.boolean().default(false),");
    expect(writerSource.match(/initiativePublished:/g)).toHaveLength(1);
  });

  it("derives the flag through the publication seam", () => {
    expect(writerSource).toContain(
      "initiativePublished: isCombatRoundCommittedInitiativeEntryPublished({",
    );
  });

  it("never reads the flag off whether a roll exists", () => {
    // The exact implementation the Product Owner ruling forbids, in the forms it would be written.
    expect(writerSource).not.toMatch(/initiativePublished:\s*initiativeResult\s*!==\s*undefined/);
    expect(writerSource).not.toMatch(/initiativePublished:\s*Boolean\(/);
    expect(writerSource).not.toMatch(/initiativePublished:\s*(?:true|false)\b/);
  });

  it("hands the seam the boundary the commit produces", () => {
    // Without this the writer could call the seam and still ignore its own boundary argument,
    // which is the only input that distinguishes the two implementations.
    expect(writerSource).toContain("afterCommitBoundary: input.afterCommitBoundary,");
  });
});
