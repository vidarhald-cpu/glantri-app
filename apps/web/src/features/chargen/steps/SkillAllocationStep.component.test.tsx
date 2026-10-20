import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { defaultCanonicalContent, withCompetencyContentV2 } from "@glantri/content";
import { createChargenProgression } from "@glantri/rules-engine";
import { buildProfessionTrainingAccess } from "../professionTrainingAccess";
import {
  buildTargetRuntimeContent,
  createTargetCompetencyChargenSource,
} from "../targetCompetencyContent";
import { SkillAllocationStep } from "./SkillAllocationStep";

/**
 * Step 6's Profession skills panel when the Character can reach none of the Profession's training
 * (Forgejo #635).
 *
 * Before this change the panel rendered its heading and nothing else — the 52px heading-only box
 * the #630 smoke test measured — because `coreProfessionSections.length > 0` had no alternative
 * branch. These cases hold both halves: the closed case explains itself, and a working Profession
 * on the same Civilization is untouched.
 *
 * #635 reported Scythians + Scribe and Copyist. Forgejo #731 found that pair is not closed — the
 * catalogue authors a direct writing-room route with no Society-Level bound — so the closed case is
 * now Scythians + Mathematical Practitioner, whose three authored routes are all bounded at Society
 * Level 3 and which has no direct route. Nothing the panel renders changed; only which combination
 * is the genuinely closed one.
 */
const content = withCompetencyContentV2(
  buildTargetRuntimeContent(createTargetCompetencyChargenSource(defaultCanonicalContent)),
);

/** Closed among the Scythians on the Society Level alone, at every Social Band. */
const CLOSED_PROFESSION_ID = "profession:mathematical-practitioner";
const scythians = content.civilizations.find((row) => row.id === "scythians")!;
const scythianSociety = content.societies!.find((row) => row.id === scythians.linkedSocietyId)!;

function cardFor(professionId: string, socialBand: number) {
  const profession = content.professions.find((row) => row.id === professionId)!;
  return {
    hasLiteracyFoundation: false,
    id: professionId,
    name: profession.name,
    profession,
    subtypeName: profession.name,
    trainingAccess: buildProfessionTrainingAccess({
      civilizationName: scythians.name,
      content,
      professionId,
      socialBand,
      societyId: scythianSociety.id,
    }),
  };
}

function renderStep(overrides: Record<string, unknown> = {}) {
  const state = {
    content,
    coreProfessionSections: [],
    coreRouteStatus: {
      applicableRoutes: [],
      isComplete: false,
      isSelectionValid: false,
      missingGroupIds: [],
      missingSkillIds: [],
      missingWrittenLanguageChoices: 0,
      requiresSelection: false,
    },
    draftView: { primaryPoolAvailable: 0, secondaryPoolAvailable: 0 },
    expandedAllocationSections: [],
    groupTrainingCostChange: undefined,
    handleAllocate: vi.fn(),
    handleAllocateSpecialization: vi.fn(),
    handleRemoveAllocation: vi.fn(),
    handleRemoveSpecialization: vi.fn(),
    handleSelectCoreRoute: vi.fn(),
    handleSelectGroupSlotSkill: vi.fn(),
    handleToggleLanguageSelection: vi.fn(),
    languageSelectionSummary: { selectableLanguages: [], selectedOptionalLanguageIds: [] },
    languageSkillViews: [],
    motherTongueSummary: { displayLabel: undefined, startingLevel: 0 },
    otherSkillFilterActive: false,
    otherSkillTypeOptions: [],
    professionBrowseModel: undefined,
    progression: createChargenProgression(),
    renderSkillRowsTable: () => null,
    rowActionFeedback: {},
    selectableSkillSummary: { selectionSlots: [] },
    selectedCivilization: scythians,
    /*
     * `SkillAllocationStep` renders `Profession: {selectedProfession?.name}` beside the card's
     * closure prose, so these two must name the same Profession or the fixture states one and
     * explains another. No assertion reads the name; this keeps it honest for the next reader.
     */
    selectedProfession: content.professions.find((row) => row.id === CLOSED_PROFESSION_ID),
    selectedProfessionCard: cardFor(CLOSED_PROFESSION_ID, 1),
    selectedProfile: undefined,
    selectedSociety: { id: scythianSociety.id, name: scythianSociety.name, socialBands: {} },
    selectedSocietyAccess: { professionIds: [], socialClass: "Commoner" },
    selectedSocietyBand: 1,
    setShowAllSpecializations: vi.fn(),
    setShowOtherSkills: vi.fn(),
    setShowSpecializations: vi.fn(),
    setSkillSearch: vi.fn(),
    setSkillTypeFilter: vi.fn(),
    setSkillVisibilityFilter: vi.fn(),
    setSpecializationSearch: vi.fn(),
    showAllSpecializations: false,
    showOtherSkills: false,
    showSpecializations: false,
    skillAllocationContext: undefined,
    skillDisplayGroupIds: {},
    skillRowsById: {},
    skillSearch: "",
    skillTypeFilter: "all",
    skillVisibilityFilter: "all",
    societyGrantedSkillRows: [],
    specialAccessSection: null,
    specializationFilterActive: false,
    specializationRows: [],
    specializationSearch: "",
    toggleAllocationSection: vi.fn(),
    visibleOtherSkillRows: [],
    visibleSpecializationRows: [],
    ...overrides,
  } as unknown as Parameters<typeof SkillAllocationStep>[0]["state"];
  return render(<SkillAllocationStep state={state} />);
}

/* Nothing the catalogue does not publish to a reader may reach the rendered output. */
const RAW_IDENTIFIER_PATTERNS = [
  /\b(?:profession|skill|group|society|civilization|specialization):/i,
  /\b[A-Z]\d{2}\b/,
  /[a-z]+_[a-z]+/,
];

afterEach(cleanup);

describe("Step 6 Profession skills panel with no reachable training", () => {
  it("explains the empty panel instead of rendering a heading alone", () => {
    renderStep();

    expect(screen.getByText("Learning Groups: 0")).toBeInTheDocument();
    expect(
      screen.getByText("No one among the Scythians trains this Profession."),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Applied calculation is kept accounts and measured ground reduced to figures.",
      ),
    ).toBeInTheDocument();
  });

  it("exposes no raw identifier and no implementation vocabulary", () => {
    const { container } = renderStep();
    const note = container.querySelector('[role="note"]')!;
    const text = note.textContent ?? "";

    for (const pattern of RAW_IDENTIFIER_PATTERNS)
      expect(text, `${pattern} matched ${text}`).not.toMatch(pattern);
    for (const term of ["core route", "availability", "projection", "schema", "coreRoute"])
      expect(text.toLowerCase(), term).not.toContain(term.toLowerCase());
  });

  it("falls back to the honest generic state when the catalogue attributes no reason", () => {
    renderStep({
      selectedProfessionCard: {
        ...cardFor(CLOSED_PROFESSION_ID, 1),
        trainingAccess: {
          authoredReasons: [],
          closedBy: "unattributed",
          situation: "No training for this Profession is available to this Character.",
        },
      },
    });

    expect(
      screen.getByText("No training for this Profession is available to this Character."),
    ).toBeInTheDocument();
  });

  it("renders no explanation panel for a Profession whose training is reachable", () => {
    const working = cardFor("profession:carpenter", 1);

    expect(working.trainingAccess).toBeUndefined();

    const { container } = renderStep({
      coreProfessionSections: [
        {
          definition: { description: "Working case.", id: "crafts", label: "Crafts" },
          directRows: [],
          groups: [],
        },
      ],
      expandedAllocationSections: ["core-profession-skills"],
      selectedProfession: content.professions.find((row) => row.id === "profession:carpenter"),
      selectedProfessionCard: working,
    });

    expect(screen.queryByText("Learning Groups: 0")).toBeNull();
    expect(container.querySelector('[role="note"]')).toBeNull();
    expect(screen.getByText("Profession training")).toBeInTheDocument();
  });
});
