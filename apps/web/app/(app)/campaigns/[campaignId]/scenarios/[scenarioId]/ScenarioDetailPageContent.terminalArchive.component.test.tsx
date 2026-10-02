import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Scenario } from "@glantri/domain";

import ScenarioDetailPageContent from "./ScenarioDetailPageContent";

/**
 * Wave 2 Lane B (#186) acceptance coverage.
 *
 * The lane exposes the one lifecycle step the domain, the service, the API and
 * persistence already permit and the client alone refused: `completed -> archived`.
 *
 * The hazard is that the fix is implemented by loosening the terminal-state branch
 * instead of adding a control inside it. A loosening would regress roughly a dozen
 * refusals at once, and a green suite would not notice, because nothing asserted the
 * ABSENCE of those affordances in a terminal Scenario.
 *
 * So every test here asserts BOTH directions:
 *   - the archive control exists in `completed` and performs a status-only update;
 *   - the live-session affordances are still absent in `completed` - and the same
 *     assertions are re-run against a `live` Scenario, where they must all FAIL to
 *     be absent. That live counter-case is what keeps the absence assertions from
 *     being vacuous: if the component stopped rendering those sections entirely,
 *     the live case breaks instead of silently passing.
 */

const mocks = vi.hoisted(() => ({
  loadScenarioById: vi.fn(),
  updateScenarioOnServer: vi.fn(),
}));

/**
 * The session surfaces are mocked, so only `revision` (used as a React key) has to
 * be real. What matters is that a session EXISTS for every status, because that is
 * what makes the presence of session-state management a live-only affordance rather
 * than an accident of missing data.
 */
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
  addScenarioParticipantFromCharacterOnServer: vi.fn(),
  addScenarioParticipantFromEntityOnServer: vi.fn(),
  createEncounterOnServer: vi.fn(),
  loadAuthUsers: vi.fn().mockResolvedValue([]),
  loadCampaignEntities: vi.fn().mockResolvedValue([]),
  loadCampaignRoster: vi.fn().mockResolvedValue([]),
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
  updateScenarioOnServer: mocks.updateScenarioOnServer,
  updateScenarioParticipantMetadataOnServer: vi.fn(),
  updateScenarioSessionOnServer: vi.fn(),
}));

const CAMPAIGN_ID = "campaign-1";
const SCENARIO_ID = "scenario-1";

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

/**
 * Limb 3 of the reachability declaration: the operations that must remain invalid
 * in `completed`. Each entry is a live-session affordance whose presence in a
 * terminal Scenario would mean a refusal had been converted into an offer.
 */
const LIVE_SESSION_AFFORDANCES: { find: () => unknown; label: string }[] = [
  // Scenario metadata writes (name / description).
  {
    find: () => screen.getByRole("textbox", { name: "Name" }).hasAttribute("disabled") === false,
    label: "an editable Scenario name",
  },
  {
    find: () =>
      screen.getByRole("textbox", { name: "Description" }).hasAttribute("disabled") === false,
    label: "an editable Scenario description",
  },
  // Encounter creation and Encounter lifecycle control.
  {
    find: () => screen.getByRole("heading", { name: "Encounters" }),
    label: "the Encounters section",
  },
  {
    find: () => screen.getByRole("button", { name: "Create encounter" }),
    label: "Encounter creation",
  },
  // Encounter participant assignment.
  {
    find: () => screen.getByRole("heading", { name: "Encounter Assignment" }),
    label: "the Encounter Assignment section",
  },
  // Participant add / remove from the campaign roster.
  {
    find: () => screen.getByRole("heading", { name: "Add from campaign roster" }),
    label: "the campaign roster picker",
  },
  // Temporary actor creation from templates.
  {
    find: () => screen.getByRole("heading", { name: "Template sources" }),
    label: "the template sources section",
  },
  // Session-state writes.
  { find: () => screen.getByText("SESSION_MANAGEMENT_MOUNTED"), label: "session-state management" },
];

describe("ScenarioDetailPageContent terminal-state archive control", () => {
  beforeEach(() => {
    mocks.loadScenarioById.mockReset();
    mocks.updateScenarioOnServer.mockReset();
    mocks.updateScenarioOnServer.mockImplementation(async () => buildScenario("archived"));
  });

  afterEach(() => cleanup());

  describe("the archive control is present and works in a completed Scenario", () => {
    it("offers exactly Closed and Archived as the reachable lifecycle steps", async () => {
      await renderScenario("completed");

      const statusSelect = screen.getByRole("combobox", { name: "Status" });
      const offered = Array.from(statusSelect.querySelectorAll("option")).map(
        (option) => (option as HTMLOptionElement).value,
      );

      // Limb 4: `completed -> archived` is the ONLY exit. Nothing else is offered.
      expect(offered).toEqual(["completed", "archived"]);
      expect(screen.getByRole("button", { name: "Update scenario" })).toBeEnabled();
    });

    it("archives the Scenario with a status-only update", async () => {
      await renderScenario("completed");

      fireEvent.change(screen.getByRole("combobox", { name: "Status" }), {
        target: { value: "archived" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Update scenario" }));

      await waitFor(() => {
        expect(mocks.updateScenarioOnServer).toHaveBeenCalledTimes(1);
      });

      // The service refuses a status change that arrives with a field mutation, so
      // the client must send status alone.
      expect(mocks.updateScenarioOnServer).toHaveBeenCalledWith({
        description: undefined,
        name: undefined,
        scenarioId: SCENARIO_ID,
        status: "archived",
      });
    });

    it("keeps the read-only history framing while offering the archive step", async () => {
      await renderScenario("completed");

      expect(screen.getByText("Read-only Scenario history")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "Scenario summary" })).toBeInTheDocument();
    });
  });

  describe("an archived Scenario offers no mutation at all", () => {
    it("renders the absorbing status as a readout with no lifecycle control", async () => {
      await renderScenario("archived");

      // Limb 4: `archived: []` is absorbing - there is no onward transition, so no
      // lifecycle control may be offered.
      expect(screen.queryByRole("combobox", { name: "Status" })).not.toBeInTheDocument();
      expect(screen.getByLabelText("Scenario status")).toHaveTextContent("Archived");
      expect(screen.getByRole("button", { name: "Update scenario" })).toBeDisabled();
    });
  });

  describe("limb 3: the operations that must remain invalid in a terminal Scenario", () => {
    it.each(["completed", "archived"] as const)(
      "refuses every live-session affordance in a %s Scenario",
      async (status) => {
        await renderScenario(status);

        for (const affordance of LIVE_SESSION_AFFORDANCES) {
          let offered: unknown;
          try {
            offered = affordance.find();
          } catch {
            offered = false;
          }

          expect(
            Boolean(offered),
            `${affordance.label} must NOT be offered in a ${status} Scenario`,
          ).toBe(false);
        }
      },
    );

    it("still offers every one of those affordances in a live Scenario", async () => {
      await renderScenario("live");

      // This is the counter-case. Without it, the refusal assertions above would
      // also pass if the sections were deleted or renamed, and the suite would stop
      // guarding the terminal branch without saying so.
      for (const affordance of LIVE_SESSION_AFFORDANCES) {
        let offered: unknown;
        try {
          offered = affordance.find();
        } catch {
          offered = false;
        }

        expect(
          Boolean(offered),
          `${affordance.label} must still be offered in a live Scenario`,
        ).toBe(true);
      }
    });

    it("does not offer the live lifecycle steps from a terminal Scenario", async () => {
      await renderScenario("completed");

      const statusSelect = screen.getByRole("combobox", { name: "Status" });
      const offered = Array.from(statusSelect.querySelectorAll("option")).map(
        (option) => (option as HTMLOptionElement).value,
      );

      // Limb 1 must not be relaxed from the other side either: a terminal Scenario
      // may not be reopened into `live`, `paused` or `draft`.
      expect(offered).not.toContain("live");
      expect(offered).not.toContain("paused");
      expect(offered).not.toContain("draft");
    });
  });
});
