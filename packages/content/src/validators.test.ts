import { describe, expect, it } from "vitest";

import { defaultCanonicalContent } from "./seeds/defaultContent";
import { validateCanonicalContent } from "./validators";

describe("validateCanonicalContent", () => {
  it("accepts the default society band content", () => {
    expect(validateCanonicalContent(defaultCanonicalContent)).toEqual(defaultCanonicalContent);
  });

  it("fails clearly on duplicate society band rows", () => {
    const duplicateBandContent = {
      ...defaultCanonicalContent,
      societyLevels: [
        ...defaultCanonicalContent.societyLevels,
        {
          ...defaultCanonicalContent.societyLevels[0]
        }
      ]
    };

    expect(() => validateCanonicalContent(duplicateBandContent)).toThrow(
      'Duplicate social band row for society "Scandia" (scandia), band 1.'
    );
  });

  it("fails clearly when a society is missing a universal band", () => {
    const missingBandContent = {
      ...defaultCanonicalContent,
      societyLevels: defaultCanonicalContent.societyLevels.filter(
        (societyLevel) => societyLevel.societyLevel !== 4
      )
    };

    expect(() => validateCanonicalContent(missingBandContent)).toThrow(
      'Society "Scandia" (scandia) is missing social band(s): 4.'
    );
  });

  it("normalizes legacy label content to societyName", () => {
    const legacyLabelContent = {
      ...defaultCanonicalContent,
      societyLevels: defaultCanonicalContent.societyLevels.map((societyLevel) => ({
        ...societyLevel,
        label: societyLevel.societyName,
        societyName: undefined
      }))
    };

    const normalizedContent = validateCanonicalContent(legacyLabelContent);

    expect(
      normalizedContent.societyLevels.every(
        (societyLevel) => societyLevel.societyName === "Scandia"
      )
    ).toBe(true);
  });
});
