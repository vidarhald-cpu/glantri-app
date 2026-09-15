import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "@glantri/content";
import {
  buildChargenSkillAccessSummary,
  resolveEffectiveProfessionPackage,
} from "@glantri/rules-engine";

import {
  bindLegacySocietyChargenContext,
  createLegacyCanonicalChargenSource,
  getLegacySocietyChargenContext,
  UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT,
} from "./chargenContentContextSource";

describe("Chargen content/context source", () => {
  it("projects the current canonical catalogue without changing its content", () => {
    const source = createLegacyCanonicalChargenSource(defaultCanonicalContent);

    expect(source.catalogue.identity).toEqual({
      projectionVersion: 1,
      sourceId: "legacy-canonical",
    });
    expect(source.catalogue.content).toBe(defaultCanonicalContent);
    expect(source.catalogue.content).toEqual(defaultCanonicalContent);
  });

  it("preserves legacy Profession composition and Society access calculations", () => {
    const source = createLegacyCanonicalChargenSource(defaultCanonicalContent);
    const societyAccess = defaultCanonicalContent.societyLevels.find(
      (candidate) => candidate.professionIds.length > 0,
    );
    const professionId = societyAccess?.professionIds[0];

    expect(societyAccess).toBeDefined();
    expect(professionId).toBeDefined();

    if (!societyAccess || !professionId) {
      throw new Error("Expected legacy content to include a selectable Profession");
    }

    const input = {
      professionId,
      societyId: societyAccess.societyId,
      societyLevel: societyAccess.societyLevel,
    };

    expect(
      buildChargenSkillAccessSummary({
        content: source.catalogue.content,
        ...input,
      }),
    ).toEqual(
      buildChargenSkillAccessSummary({
        content: defaultCanonicalContent,
        ...input,
      }),
    );
    expect(
      resolveEffectiveProfessionPackage({
        content: source.catalogue.content,
        subtypeId: professionId,
      }),
    ).toEqual(
      resolveEffectiveProfessionPackage({
        content: defaultCanonicalContent,
        subtypeId: professionId,
      }),
    );
  });

  it("keeps historical Society identity separate from the selected Social Band", () => {
    const source = bindLegacySocietyChargenContext(
      createLegacyCanonicalChargenSource(defaultCanonicalContent),
      {
        socialBand: 3,
        societyId: "renaissance_city_state",
      },
    );

    expect(getLegacySocietyChargenContext(source)).toEqual({
      kind: "legacy-society",
      socialBand: 3,
      societyId: "renaissance_city_state",
    });
    expect(source.acquisitionContext).not.toHaveProperty("societyLevel");
  });

  it("represents an unbound general context without activating availability rules", () => {
    expect(UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT).toEqual({
      kind: "unbound",
      scope: "general",
    });
    expect(UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT).not.toHaveProperty("availability");
    expect(UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT).not.toHaveProperty("societyId");
    expect(UNBOUND_GENERAL_CHARGEN_ACQUISITION_CONTEXT).not.toHaveProperty("socialBand");
  });
});
