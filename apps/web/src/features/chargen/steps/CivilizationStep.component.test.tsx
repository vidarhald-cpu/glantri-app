import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CivilizationStep } from "./CivilizationStep";

/**
 * The collapsed Civilization section (Forgejo #577).
 *
 * Step 3 used to render every civilization on first arrival, because its collapsed view was gated
 * on a selection existing. It now follows the Stats step's own grammar: an always-visible header
 * toggle, a collapsed placeholder with no selection, and a collapsed summary that names the choice.
 */
const civilizations = [
  {
    historicalAnalogue: "Viking Age Scandinavia",
    id: "civilization:scandia",
    linkedSocietyId: "society:scandia",
    linkedSocietyLevel: 3,
    linkedSocietyName: "Scandia",
    motherTongueLanguageName: "Old Norse",
    name: "Scandia",
    optionalLanguageNames: [],
    shortDescription: "Northern seafaring farmsteads.",
    spokenLanguageName: "Old Norse",
  },
  {
    historicalAnalogue: "Pontic steppe",
    id: "civilization:scythians",
    linkedSocietyId: "society:scythians",
    linkedSocietyLevel: 2,
    linkedSocietyName: "Scythians",
    motherTongueLanguageName: "Scythian",
    name: "Scythians",
    optionalLanguageNames: [],
    shortDescription: "Mounted herders of the open grassland.",
    spokenLanguageName: "Scythian",
  },
];

const selectedProfile = { id: "profile-1" };

function renderStep(overrides: Record<string, unknown> = {}) {
  const props = {
    civilizations,
    handleCivilizationChange: vi.fn(),
    languageSelectionSummary: { selectableLanguages: [] },
    motherTongueSummary: { displayLabel: undefined, startingLevel: 0 },
    selectedCivilization: undefined,
    selectedCivilizationId: undefined,
    selectedProfile,
    selectedSociety: undefined,
    setShowCivilizationChooser: vi.fn(),
    showCivilizationChooser: false,
    ...overrides,
  } as unknown as Parameters<typeof CivilizationStep>[0];
  return { props, ...render(<CivilizationStep {...props} />) };
}

afterEach(cleanup);

describe("CivilizationStep", () => {
  it("collapses to a placeholder and a discoverable expand control when nothing is selected", () => {
    renderStep();

    expect(
      screen.getByText("Expand civilization to review the available civilizations."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand civilization" })).toBeInTheDocument();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });

  it("asks to reveal the chooser when the header toggle is used, and never selects for the player", async () => {
    const setShowCivilizationChooser = vi.fn();
    const handleCivilizationChange = vi.fn();
    const user = userEvent.setup();
    renderStep({ handleCivilizationChange, setShowCivilizationChooser });

    await user.click(screen.getByRole("button", { name: "Expand civilization" }));

    expect(setShowCivilizationChooser).toHaveBeenCalledTimes(1);
    /* The toggle only reveals: collapsing or expanding chooses nothing. */
    expect(handleCivilizationChange).not.toHaveBeenCalled();
    const update = setShowCivilizationChooser.mock.calls[0]![0] as (current: boolean) => boolean;
    expect(update(false)).toBe(true);
  });

  it("reveals the unchanged chooser when expanded", () => {
    renderStep({ showCivilizationChooser: true });

    expect(screen.getByRole("button", { name: "Collapse civilization" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Scandia/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Scythians/ })).toBeInTheDocument();
    expect(screen.getByText("Northern seafaring farmsteads.")).toBeInTheDocument();
    for (const radio of screen.getAllByRole("radio")) expect(radio).not.toBeChecked();
    expect(
      screen.queryByText("Expand civilization to review the available civilizations."),
    ).toBeNull();
  });

  it("names the selected civilization in the collapsed state", () => {
    renderStep({
      selectedCivilization: civilizations[0],
      selectedCivilizationId: civilizations[0]!.id,
    });

    expect(screen.getByText("Scandia")).toBeInTheDocument();
    expect(screen.getByText("Northern seafaring farmsteads.")).toBeInTheDocument();
    expect(screen.getByText(/Spoken language: Old Norse/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change civilization" })).toBeInTheDocument();
    expect(
      screen.queryByText("Expand civilization to review the available civilizations."),
    ).toBeNull();
    expect(screen.queryAllByRole("radio")).toHaveLength(0);
  });
});
