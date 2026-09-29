import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ScenarioSessionView } from "@glantri/domain";

const mocks = vi.hoisted(() => ({ loadArtifacts: vi.fn() }));

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/lib/api/localServiceClient", async (loadOriginal) => ({
  ...(await loadOriginal()),
  artifactContentUrl: (_campaignId: string, artifactId: string) => `/content/${artifactId}`,
  loadArtifacts: mocks.loadArtifacts,
}));

import { ScenarioSituationView } from "./ScenarioSituationView";

function buildSession(overrides: Partial<ScenarioSessionView> = {}): ScenarioSessionView {
  return {
    availableObjects: [
      {
        canPickUp: true,
        description: "A dented iron lantern.",
        id: "availability-1",
        name: "Iron lantern",
        referenceType: "Item",
        sourceKind: "campaign_item",
      },
    ],
    blackboard: {
      availableObjectIds: ["availability-1"],
      campaignId: "campaign-1",
      scenarioId: "scenario-1",
    },
    encounters: [
      {
        id: "encounter-1",
        kind: "combat",
        status: "active",
        title: "Gatehouse ambush",
        updatedAt: "2026-09-29T10:00:00.000Z",
      },
    ],
    history: [
      {
        createdAt: "2026-09-29T10:01:00.000Z",
        eventKind: "attack_resolution",
        id: "event-1",
        scenarioId: "scenario-1",
        sequence: 1,
        summary: "Sergeant attacks Test Hunter — PARRIED",
        type: "encounter_combat_outcome",
      },
    ],
    participants: [
      {
        displayName: "Test Hunter",
        equipment: { canReconcile: true, message: "Scenario equipment is stale.", status: "stale" },
        id: "participant-1",
        isControlledByViewer: true,
        presence: { kind: "scenario" },
        role: "player_character",
        sourceType: "character",
      },
      {
        displayName: "Sergeant Varro",
        id: "participant-2",
        isControlledByViewer: false,
        presence: {
          encounterId: "encounter-1",
          encounterName: "Gatehouse ambush",
          kind: "encounter",
        },
        role: "npc",
        sourceType: "entity",
      },
    ],
    revision: "2026-09-29T10:02:00.000Z",
    scenario: {
      campaignId: "campaign-1",
      description: "Rain beats on the gatehouse roof.",
      id: "scenario-1",
      name: "The gatehouse",
      status: "live",
    },
    viewerMode: "player",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.loadArtifacts.mockResolvedValue({
    artifacts: [
      {
        altText: "A mountain pass",
        artifactKind: "map",
        campaignId: "campaign-1",
        description: "The northern approach.",
        id: "artifact-1",
        mediaType: "image/png",
        title: "Northern pass",
      },
    ],
    mode: "viewer",
  });
});

async function renderView(props: Partial<Parameters<typeof ScenarioSituationView>[0]> = {}) {
  const view = render(
    <ScenarioSituationView campaignId="campaign-1" session={buildSession()} {...props} />,
  );
  await screen.findByRole("button", { name: /Northern pass/ });
  return view;
}

describe("ScenarioSituationView", () => {
  it("renders the three selector rails, the Inspector and full-width Activity", async () => {
    await renderView();

    expect(screen.getByRole("heading", { name: "People" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Items" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Artifacts" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Activity" })).toBeInTheDocument();
    expect(screen.getByText("Sergeant attacks Test Hunter — PARRIED")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open encounter" })).toHaveAttribute(
      "href",
      expect.stringContaining("encounterId=encounter-1"),
    );
  });

  it("fills the Inspector for a person, an Item and an Artifact", async () => {
    const user = userEvent.setup();
    await renderView();
    const inspector = screen.getByRole("region", { name: "Inspector" });

    await user.click(screen.getByRole("button", { name: /Sergeant Varro/ }));
    expect(within(inspector).getByRole("heading", { name: "Sergeant Varro" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Iron lantern/ }));
    expect(within(inspector).getByText("A dented iron lantern.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Northern pass/ }));
    expect(within(inspector).getByRole("heading", { name: "Northern pass" })).toBeInTheDocument();
    expect(within(inspector).getByRole("button", { name: "Open full view" })).toBeInTheDocument();
  });

  it("opens the canonical full-viewport inspection from the Inspector", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("button", { name: /Northern pass/ }));
    await user.click(screen.getByRole("button", { name: "Open full view" }));

    expect(await screen.findByRole("button", { name: "Close inspection" })).toBeInTheDocument();
  });

  it("keeps pickup on the same availability and participant contract", async () => {
    const user = userEvent.setup();
    const onPickUp = vi.fn();
    await renderView({ onPickUp });

    await user.click(screen.getByRole("button", { name: /Iron lantern/ }));
    await user.click(screen.getByRole("button", { name: "Pick up as Test Hunter" }));

    expect(onPickUp).toHaveBeenCalledWith("availability-1", "participant-1");
  });

  it("suppresses pickup when the caller withholds the pickup handler", async () => {
    const user = userEvent.setup();
    await renderView({ onPickUp: undefined });

    await user.click(screen.getByRole("button", { name: /Iron lantern/ }));

    expect(screen.queryByRole("button", { name: /^Pick up as/ })).not.toBeInTheDocument();
  });

  it("keeps the equipment status message and its reconcile control reachable", async () => {
    const user = userEvent.setup();
    const onReconcileEquipment = vi.fn();
    await renderView({ onReconcileEquipment });

    await user.click(screen.getByRole("button", { name: /Test Hunter/ }));
    expect(screen.getByText("Scenario equipment is stale.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Update Scenario equipment" }));

    expect(onReconcileEquipment).toHaveBeenCalledWith("participant-1");
  });

  it("filters People by PCs and NPCs and searches each rail", async () => {
    const user = userEvent.setup();
    await renderView();

    await user.click(screen.getByRole("button", { name: "NPCs" }));
    expect(screen.queryByRole("button", { name: /Test Hunter/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Sergeant Varro/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "PCs" }));
    expect(screen.getByRole("button", { name: /Test Hunter/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Sergeant Varro/ })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Search Artifacts"), "southern");
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: /Northern pass/ })).not.toBeInTheDocument(),
    );
  });

  it("presents only what the session view carries and adds no visibility flag", async () => {
    await renderView({
      session: buildSession({ availableObjects: [], history: [], participants: [] }),
    });

    expect(screen.getByText("No visible participants are present.")).toBeInTheDocument();
    expect(screen.getByText("No Items are available to you right now.")).toBeInTheDocument();
    expect(
      screen.getByText("No objective Scenario history has been recorded yet."),
    ).toBeInTheDocument();
  });
});
