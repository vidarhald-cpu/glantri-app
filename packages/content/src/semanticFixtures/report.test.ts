import { describe, expect, it } from "vitest";

import { representativeSkillSemanticFixtures } from "./fixtures";
import { renderSkillSemanticReport } from "./report";
import { validateSkillSemanticFixtures } from "./validator";

describe("renderSkillSemanticReport", () => {
  it("renders the deterministic golden report with unresolved policy gaps", () => {
    const report = renderSkillSemanticReport(
      validateSkillSemanticFixtures(representativeSkillSemanticFixtures),
    );

    expect(report).toMatchInlineSnapshot(`
      "Skill semantic conformance report
      =================================
      Result: PASS
      Fixtures: 8 (8 passed, 0 failed)
      Errors: 0
      Policy gaps: 5

      Fixtures
      --------
      - engineering-construction: PASS — Engineering and construction
      - finance-trade: PASS — Finance and trade
      - language-literacy: PASS — Campaign-authored language and script competence
      - law-administration: PASS — Law and administration
      - medicine: PASS — Medicine, Pharmacy, and Surgery
      - navigation: PASS — Navigation
      - warfare-tactics: PASS — Warfare and tactics
      - weapon-practice: PASS — Weapon practice and provisional Longbow identity

      Policy gaps (flagged, not decided)
      ----------------------------------
      - [GROUP_ECONOMICS_UNRESOLVED] Learning-group economics, overlap behavior, repeated-rank behavior, and lifecycle remain unresolved.
      - [RELATIONSHIP_FACTORS_UNRESOLVED] Exact transfer, familiarity, learning, and reinforcement factors remain unresolved.
      - [SPECIALIZATION_CAPS_UNRESOLVED] Specialization thresholds, caps, and bounded reverse reinforcement remain unresolved.
      - [LONGBOW_CLASSIFICATION_PROVISIONAL] Longbow is represented as a provisional concrete skill; its final classification remains open.
      - [AUTHORED_CONTENT_AUTHORITY_UNRESOLVED] The authoritative authored-content format, ownership, and versioning pipeline remain unresolved.
      "
    `);
  });
});
