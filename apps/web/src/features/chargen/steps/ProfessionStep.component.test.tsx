import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultCanonicalContent, withCompetencyContentV2 } from "@glantri/content";
import { buildSkillReferenceModel } from "@/lib/skills/skillReferenceModel";
import {
  buildTargetRuntimeContent,
  createTargetCompetencyChargenSource,
} from "../targetCompetencyContent";
import type { ProfessionBrowseCard } from "../chargenWizardHelpers";
import { ProfessionStep } from "./ProfessionStep";

/**
 * Acceptance for the Chargen Profession chooser (Forgejo #372 sections 1 and 3).
 *
 * Built on the catalogue Chargen actually loads and on the one canonical Profession projection, so
 * what these cases assert is what a player sees.
 */
const content = withCompetencyContentV2(
  buildTargetRuntimeContent(createTargetCompetencyChargenSource(defaultCanonicalContent)),
);
const model = buildSkillReferenceModel();

function card(professionId: string): ProfessionBrowseCard {
  const profession = content.professions.find((row) => row.id === professionId)!;
  const browse = model.professions.find((row) => row.id === professionId)!;
  return {
    browse,
    categoryId: browse.browsingCategory?.id,
    categoryName: browse.browsingCategory?.name,
    description: browse.readerContent.shortDescription ?? profession.description,
    familyName: profession.name,
    hasLiteracyFoundation: false,
    id: professionId,
    name: profession.name,
    profession,
    subtypeName: profession.name,
  };
}

const cards = [card("profession:thief"), card("profession:soldier")];

function renderStep(overrides: Partial<Parameters<typeof ProfessionStep>[0]> = {}) {
  const props = {
    activeProfessionPreviewId: undefined,
    availableProfessions: content.professions,
    handleProfessionChange: vi.fn(),
    professionBrowseModel: model,
    professionCategoryFilter: "all",
    professionCategoryOptions: model.professionCategories.map((category) => ({
      count: 1,
      ...category,
    })),
    professionSearch: "",
    selectedProfessionCard: undefined,
    selectedProfessionId: undefined,
    selectedSociety: { id: "society", name: "Society", socialBands: {} },
    selectedSocietyAccess: { professionIds: [], socialClass: "Free" },
    setProfessionCategoryFilter: vi.fn(),
    setProfessionSearch: vi.fn(),
    setShowProfessionChooser: vi.fn(),
    showProfessionChooser: true,
    toggleProfessionPreview: vi.fn(),
    visibleProfessionCards: cards,
    ...overrides,
  } as unknown as Parameters<typeof ProfessionStep>[0];
  return { props, ...render(<ProfessionStep {...props} />) };
}

const FORBIDDEN_LABELS = [
  "Core reach",
  "Favored reach",
  "Included training packages",
  "Special access",
  "Choice slots",
];

afterEach(cleanup);

describe("Profession chooser", () => {
  it("offers the approved sixteen browsing categories instead of a Profession-family filter", () => {
    renderStep();
    const select = screen.getByLabelText("Kind of work") as HTMLSelectElement;

    expect(screen.queryByLabelText("Family")).toBeNull();
    /* 16 approved categories plus the unfiltered option. */
    expect(select.options).toHaveLength(17);
    expect([...select.options].map((option) => option.text)).toContain(
      "Covert and Illicit Work (1)",
    );
  });

  it("shows the category's own scope statement once a category is chosen", () => {
    renderStep({ professionCategoryFilter: "covert-and-illicit-work" });

    expect(
      screen.getByText(
        "Work whose method depends on concealment, pretence, or evading a controller.",
      ),
    ).toBeInTheDocument();
  });

  it("changes the filter rather than the Profession when a category is picked", async () => {
    const setProfessionCategoryFilter = vi.fn();
    renderStep({ setProfessionCategoryFilter });

    await userEvent.selectOptions(screen.getByLabelText("Kind of work"), "military-service");

    expect(setProfessionCategoryFilter).toHaveBeenCalledWith("military-service");
  });

  it("carries no forbidden label on a Profession card", () => {
    const { container } = renderStep();
    const text = container.textContent ?? "";

    for (const label of FORBIDDEN_LABELS) expect(text, label).not.toContain(label);
    /* A card leads with the occupation, not with a count of anything. */
    expect(text).toContain(
      model.professions.find((row) => row.id === "profession:thief")!.readerContent
        .shortDescription!,
    );
  });

  it("explains the selected Profession before it exposes any acquisition control", () => {
    const { container } = renderStep({
      selectedProfessionCard: cards[0],
      selectedProfessionId: "profession:thief",
      showProfessionChooser: false,
    });
    const text = container.textContent ?? "";

    for (const label of FORBIDDEN_LABELS) expect(text, label).not.toContain(label);
    /* Explanation, then what it can train, then how it trains it. */
    const description = cards[0]!.browse!.readerContent.description!;
    expect(text.indexOf(description)).toBeGreaterThanOrEqual(0);
    expect(text.indexOf(description)).toBeLessThan(text.indexOf("What can I learn?"));
    expect(text.indexOf("What can I learn?")).toBeLessThan(text.indexOf("How am I trained?"));
    /* Choosing a Profession is not a purchase, and the step says so. */
    expect(text).toContain("Choosing a Profession grants no ranks and spends no points");
  });
});
