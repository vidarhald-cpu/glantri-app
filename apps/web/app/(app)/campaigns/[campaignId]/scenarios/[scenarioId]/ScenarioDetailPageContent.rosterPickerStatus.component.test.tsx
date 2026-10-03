import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CampaignRosterEntry, Scenario } from "@glantri/domain";

import ScenarioDetailPageContent from "./ScenarioDetailPageContent";

/**
 * Wave 3 Lane B (#185) acceptance coverage - Direction A.
 *
 * The defect: the branch that renders `ScenarioCampaignRosterPickerSection` is
 * reached by `draft`, `live` and `paused`, because the read-only early return above
 * it refuses only `isScenarioReadOnly` (`completed || archived`). The server admits
 * `live` ALONE - `participantRoutes.ts` returns 400 for a GM unless
 * `isScenarioLiveInteractive(scenario.status)`. So on a Draft or Paused Scenario the
 * GM was offered a participant control and the write then failed.
 *
 * These tests assert the AFFORDANCE, not a predicate's return value:
 *   - in `draft` and `paused` the picker's controls are absent from the document;
 *   - in `live` every one of them is still present. That live counter-case is what
 *     keeps the absence assertions from being vacuous - if the picker stopped
 *     rendering at all, the live case breaks rather than silently passing.
 *
 * They also assert the mirror-image hazard inherited from #186: the reconciliation
 * must be LOCAL to the picker. Every other non-terminal affordance must still be
 * offered in `draft` and `paused`, so a fix that broadened `isScenarioReadOnly` or
 * restructured the terminal branch would fail here instead of quietly regressing
 * roughly a dozen unrelated gates.
 */

const mocks = vi.hoisted(() => ({
  addScenarioParticipantFromCharacterOnServer: vi.fn(),
  addScenarioParticipantFromEntityOnServer: vi.fn(),
  loadCampaignRoster: vi.fn(),
  loadScenarioById: vi.fn(),
}));

const SCENARIO_SESSION_VIEW = vi.hoisted(() => ({ revision: "2026-02-01T00:00:00.000Z" }));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/campaigns/RememberedCampaignWorkspaceEffect", () => ({
  default: () => null,
}));

vi.mock("@/features/scenarios/ScenarioSessionManagement", () => ({
  ScenarioSessionManagement: () => <div>SESSION_MANAGEMENT_MOUNTED</div>,
}));

vi.mock("@/features/scenarios/ScenarioSessionPanel", () => ({
  ScenarioSessionPanel: () => <div>SESSION_PANEL_MOUNTED</div>,
}));

vi.mock("@/lib/api/equipmentClient", () => ({
  loadCampaignItems: vi.fn().mockResolvedValue({ state: { itemsById: {}, templatesById: {} } }),
}));

vi.mock("@/lib/api/scenarioClient", () => ({
  refreshScenarioParticipantEquipmentOnServer: vi.fn(),
}));

vi.mock("@/lib/api/localServiceClient", () => ({
  addScenarioParticipantFromCharacterOnServer: mocks.addScenarioParticipantFromCharacterOnServer,
  addScenarioParticipantFromEntityOnServer: mocks.addScenarioParticipantFromEntityOnServer,
  createEncounterOnServer: vi.fn(),
  loadAuthUsers: vi.fn().mockResolvedValue([]),
  loadCampaignEntities: vi.fn().mockResolvedValue([]),
  loadCampaignRoster: mocks.loadCampaignRoster,
  loadEncounterById: vi.fn(),
  loadScenarioById: mocks.loadScenarioById,
  loadScenarioEncounterManagementProjections: vi.fn().mockResolvedValue([]),
  loadScenarioEventLogs: vi.fn().mockResolvedValue([]),
  loadScenarioParticipants: vi.fn().mockResolvedValue([]),
  loadScenarioSession: vi.fn().mockResolvedValue(SCENARIO_SESSION_VIEW),
  loadServerCharacters: vi.fn().mockResolvedValue([]),
  loadTemplates: vi.fn().mockResolvedValue([]),
  updateEncounterParticipantsOnServer: vi.fn(),
  updateEncounterStatusOnServer: vi.fn(),
  updateScenarioOnServer: vi.fn(),
  updateScenarioParticipantMetadataOnServer: vi.fn(),
  updateScenarioSessionOnServer: vi.fn(),
}));

const CAMPAIGN_ID = "campaign-1";
const SCENARIO_ID = "scenario-1";
const CANDIDATE_NAME = "Hilda Thornwatch";

/**
 * One concrete, non-template roster entry, so the picker has something to offer in
 * the `live` counter-case. Without a candidate the picker renders its own empty
 * state and every control would be absent for a reason unrelated to status.
 */
const ROSTER_ENTRY: CampaignRosterEntry = {
  campaignId: CAMPAIGN_ID,
  category: "npc",
  createdAt: "2026-01-01T00:00:00.000Z",
  id: "roster-1",
  labelSnapshot: CANDIDATE_NAME,
  sourceId: "entity-1",
  sourceType: "reusableEntity",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function buildScenario(status: Scenario["status"]): Scenario {
  return {
    campaignId: CAMPAIGN_ID,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: "The siege of the winter gate.",
    id: SCENARIO_ID,
    kind: "mixed",
    name: "The Northern March",
    status,
    updatedAt: "2026-02-01T00:00:00.000Z",
  };
}

async function renderScenario(status: Scenario["status"]) {
  mocks.loadScenarioById.mockResolvedValue(buildScenario(status));
  render(<ScenarioDetailPageContent campaignId={CAMPAIGN_ID} scenarioId={SCENARIO_ID} />);
  await waitFor(() => {
    expect(screen.queryByText("Loading scenario...")).not.toBeInTheDocument();
  });
}

function queried(find: () => unknown): boolean {
  try {
    return Boolean(find());
  } catch {
    return false;
  }
}

/**
 * The participant-add affordances the server refuses outside `live`. The checkbox is
 * the actual write trigger; the filters and the search box exist only to drive it,
 * so leaving them behind would still present Draft cast assembly as available.
 */
const ROSTER_PICKER_CONTROLS: { find: () => unknown; label: string }[] = [
  {
    find: () =>
      screen.getByRole("checkbox", { name: `Toggle ${CANDIDATE_NAME} scenario participation` }),
    label: "the roster participant toggle",
  },
  {
    find: () => screen.getByRole("combobox", { name: "Campaign roster type filter" }),
    label: "the roster type filter",
  },
  {
    find: () => screen.getByRole("combobox", { name: "Campaign roster controller filter" }),
    label: "the roster controller filter",
  },
  {
    find: () => screen.getByRole("combobox", { name: "Campaign roster civilization filter" }),
    label: "the roster civilization filter",
  },
  {
    find: () => screen.getByRole("combobox", { name: "Campaign roster profession filter" }),
    label: "the roster profession filter",
  },
  {
    find: () => screen.getByRole("combobox", { name: "Campaign roster skill group filter" }),
    label: "the roster skill group filter",
  },
  {
    find: () => screen.getByRole("searchbox", { name: "Search campaign roster candidates" }),
    label: "the roster search box",
  },
];

/**
 * Non-terminal affordances that have nothing to do with the participant picker. They
 * are asserted PRESENT in `draft` and `paused`: this lane reconciles one affordance
 * and must not narrow the branch that carries the others.
 */
const OTHER_NON_TERMINAL_AFFORDANCES: { find: () => unknown; label: string }[] = [
  {
    find: () => screen.getByRole("heading", { name: "Encounters" }),
    label: "the Encounters section",
  },
  {
    find: () => screen.getByRole("button", { name: "Create encounter" }),
    label: "Encounter creation",
  },
  {
    find: () => screen.getByRole("heading", { name: "Encounter Assignment" }),
    label: "the Encounter Assignment section",
  },
  {
    find: () => screen.getByRole("heading", { name: "Template sources" }),
    label: "the template sources section",
  },
  { find: () => screen.getByText("SESSION_MANAGEMENT_MOUNTED"), label: "session-state management" },
];

describe("ScenarioDetailPageContent campaign roster picker status reconciliation", () => {
  beforeEach(() => {
    mocks.loadScenarioById.mockReset();
    mocks.addScenarioParticipantFromCharacterOnServer.mockReset();
    mocks.addScenarioParticipantFromEntityOnServer.mockReset();
    mocks.loadCampaignRoster.mockReset();
    mocks.loadCampaignRoster.mockResolvedValue([ROSTER_ENTRY]);
  });

  afterEach(() => cleanup());

  describe("the control the server refuses is no longer offered", () => {
    it.each(["draft", "paused"] as const)(
      "offers no campaign roster participant control in a %s Scenario",
      async (status) => {
        await renderScenario(status);

        // The picker's own empty state is not the reason: a candidate IS loaded.
        expect(mocks.loadCampaignRoster).toHaveBeenCalledWith(CAMPAIGN_ID);
        expect(screen.queryByText(CANDIDATE_NAME)).not.toBeInTheDocument();

        for (const control of ROSTER_PICKER_CONTROLS) {
          expect(
            queried(control.find),
            `${control.label} must NOT be offered in a ${status} Scenario`,
          ).toBe(false);
        }
      },
    );

    it.each(["draft", "paused"] as const)(
      "explains the absence instead of letting the section vanish in a %s Scenario",
      async (status) => {
        await renderScenario(status);

        expect(
          screen.getByRole("heading", { name: "Add from campaign roster" }),
        ).toBeInTheDocument();
        expect(
          screen.getByText(/Set the Scenario live to add campaign roster members to it\./),
        ).toBeInTheDocument();
      },
    );

    it.each(["draft", "paused"] as const)(
      "reaches no participant write path in a %s Scenario",
      async (status) => {
        await renderScenario(status);

        // No control exists to trigger them, so neither add path can be reached. This
        // lane adds no Draft mutation capability of any kind.
        expect(mocks.addScenarioParticipantFromEntityOnServer).not.toHaveBeenCalled();
        expect(mocks.addScenarioParticipantFromCharacterOnServer).not.toHaveBeenCalled();
      },
    );
  });

  describe("the live counter-case", () => {
    it("still offers every roster participant control in a live Scenario", async () => {
      await renderScenario("live");

      for (const control of ROSTER_PICKER_CONTROLS) {
        expect(
          queried(control.find),
          `${control.label} must still be offered in a live Scenario`,
        ).toBe(true);
      }

      expect(screen.getByText(CANDIDATE_NAME)).toBeInTheDocument();
      expect(
        screen.queryByText(/Set the Scenario live to add campaign roster members to it\./),
      ).not.toBeInTheDocument();
    });
  });

  describe("the reconciliation is local to the picker", () => {
    it.each(["draft", "paused", "live"] as const)(
      "leaves every other non-terminal affordance offered in a %s Scenario",
      async (status) => {
        await renderScenario(status);

        for (const affordance of OTHER_NON_TERMINAL_AFFORDANCES) {
          expect(
            queried(affordance.find),
            `${affordance.label} must still be offered in a ${status} Scenario`,
          ).toBe(true);
        }

        // The terminal read-only branch is still reserved for `completed`/`archived`.
        expect(screen.queryByText("Read-only Scenario history")).not.toBeInTheDocument();
      },
    );

    it.each(["completed", "archived"] as const)(
      "leaves the terminal read-only branch untouched for a %s Scenario",
      async (status) => {
        await renderScenario(status);

        expect(screen.getByText("Read-only Scenario history")).toBeInTheDocument();

        // Neither form of the roster section is reachable from the terminal branch.
        expect(
          screen.queryByRole("heading", { name: "Add from campaign roster" }),
        ).not.toBeInTheDocument();
        for (const affordance of OTHER_NON_TERMINAL_AFFORDANCES) {
          expect(
            queried(affordance.find),
            `${affordance.label} must NOT be offered in a ${status} Scenario`,
          ).toBe(false);
        }
      },
    );
  });
});
