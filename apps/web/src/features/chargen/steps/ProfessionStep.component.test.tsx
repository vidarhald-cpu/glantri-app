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

/**
 * The collapsed Profession section (Forgejo #577).
 *
 * First arrival at step 5 used to render the search box, the kind-of-work filter and all 86 radios.
 * It now follows the Stats step's own grammar instead: an always-visible header toggle, a collapsed
 * placeholder with no selection, and a collapsed summary that names the chosen Profession.
 */
describe("Collapsed Profession section", () => {
  it("collapses to a placeholder and a discoverable expand control when nothing is selected", () => {
    renderStep({ showProfessionChooser: false });

    expect(
      screen.getByText("Expand profession to review the available professions."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand profession" })).toBeInTheDocument();
    /* Neither the chooser's controls nor its rows are rendered while the section is collapsed. */
    expect(screen.queryByLabelText("Search professions")).toBeNull();
    expect(screen.queryByLabelText("Kind of work")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("asks to reveal the chooser when the header toggle is used, and never selects for the player", async () => {
    const setShowProfessionChooser = vi.fn();
    const handleProfessionChange = vi.fn();
    renderStep({ handleProfessionChange, setShowProfessionChooser, showProfessionChooser: false });

    await userEvent.click(screen.getByRole("button", { name: "Expand profession" }));

    expect(setShowProfessionChooser).toHaveBeenCalledTimes(1);
    expect(handleProfessionChange).not.toHaveBeenCalled();
    const update = setShowProfessionChooser.mock.calls[0]![0] as (current: boolean) => boolean;
    expect(update(false)).toBe(true);
  });

  it("reveals the unchanged chooser when expanded", () => {
    renderStep();

    expect(screen.getByRole("button", { name: "Collapse profession" })).toBeInTheDocument();
    expect(screen.getByLabelText("Search professions")).toBeInTheDocument();
    expect(screen.getByLabelText("Kind of work")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(cards.length);
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
    expect(screen.queryByText("Expand profession to review the available professions.")).toBeNull();
  });

  it("names the selected Profession in the collapsed state", () => {
    renderStep({
      selectedProfessionCard: cards[0],
      selectedProfessionId: "profession:thief",
      showProfessionChooser: false,
    });

    expect(screen.getByText(cards[0]!.subtypeName)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change profession" })).toBeInTheDocument();
    expect(screen.queryByText("Expand profession to review the available professions.")).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("offers no expand control when there is nothing to choose yet", () => {
    renderStep({ availableProfessions: [], showProfessionChooser: false });

    expect(screen.getByText("Select a rolled profile and civilization first.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Expand profession" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Collapse profession" })).toBeNull();
  });
});

/**
 * A Profession this Character can reach no training for (Forgejo #635).
 *
 * The Product Owner ruling of 2026-10-15 keeps the accepted access behaviour unchanged and asks for
 * the existing authored reason to be surfaced here. It warns and never prevents: filtering the
 * target Professions by availability is forbidden by `chargen-target-professions.md` section 10, so
 * the radio stays enabled and the reader is simply told.
 */
describe("Profession with no reachable training", () => {
  const closed = {
    ...card("profession:scribe"),
    trainingAccess: {
      authoredReasons: ["A records office is a standing bureaucracy keeping written record."],
      closedBy: "society" as const,
      situation: "No one among the Scythians trains this Profession.",
    },
  };

  it("warns on the chooser row and leaves the Profession selectable", async () => {
    const handleProfessionChange = vi.fn();
    renderStep({ handleProfessionChange, visibleProfessionCards: [closed, cards[1]!] });

    expect(screen.getByText("No training available here")).toBeInTheDocument();
    expect(
      screen.getByText("No one among the Scythians trains this Profession."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("A records office is a standing bureaucracy keeping written record."),
    ).toBeInTheDocument();
    expect(screen.getByText("You may still choose it.")).toBeInTheDocument();

    const radios = screen.getAllByRole("radio");
    expect(radios[0]).not.toBeDisabled();
    await userEvent.click(radios[0]!);
    expect(handleProfessionChange).toHaveBeenCalledWith("profession:scribe");
  });

  it("repeats the explanation on the selected Profession, without the invitation to choose", () => {
    renderStep({
      selectedProfessionCard: closed,
      selectedProfessionId: "profession:scribe",
      showProfessionChooser: false,
    });

    expect(screen.getByText("No training available here")).toBeInTheDocument();
    expect(
      screen.getByText("No one among the Scythians trains this Profession."),
    ).toBeInTheDocument();
    expect(screen.queryByText("You may still choose it.")).toBeNull();
  });

  it("exposes no raw identifier and no implementation vocabulary in the notice", () => {
    const { container } = renderStep({ visibleProfessionCards: [closed] });
    const text = container.querySelector('[role="note"]')!.textContent ?? "";

    for (const pattern of [
      /\b(?:profession|skill|group|society|civilization|specialization):/i,
      /\b[A-Z]\d{2}\b/,
      /[a-z]+_[a-z]+/,
    ])
      expect(text, `${pattern}`).not.toMatch(pattern);
    for (const term of ["core route", "availability", "projection", "schema"])
      expect(text.toLowerCase(), term).not.toContain(term);
  });

  it("adds nothing at all to a Profession whose training is reachable", () => {
    const { container } = renderStep();

    expect(container.querySelector('[role="note"]')).toBeNull();
    expect(screen.queryByText("No training available here")).toBeNull();
    expect(screen.getAllByRole("radio")).toHaveLength(cards.length);
  });
});
