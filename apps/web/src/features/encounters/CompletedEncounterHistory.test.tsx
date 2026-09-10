// @vitest-environment happy-dom

import "@testing-library/jest-dom/vitest";

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { EncounterSession } from "@glantri/domain";

import { CompletedEncounterHistory } from "./CompletedEncounterHistory";

const encounter: EncounterSession = {
  actionLog: [],
  createdAt: "2026-09-10T08:00:00.000Z",
  currentRound: 1,
  currentTurnIndex: 0,
  declarationsLocked: false,
  description: "The party secured the eastern gate.",
  gmPrivateClosingNote: "The rival escaped unseen.",
  id: "encounter-1",
  kind: "roleplay",
  participants: [],
  playerOutcome: "The gate is safe for now.",
  scenarioId: "scenario-1",
  status: "completed",
  title: "The Eastern Gate",
  turnOrderMode: "manual",
  updatedAt: "2026-09-10T09:00:00.000Z",
};

describe("CompletedEncounterHistory", () => {
  it("shows public history without private GM notes or interactive controls to a player", () => {
    render(<CompletedEncounterHistory encounter={encounter} viewerMode="player" />);

    expect(screen.getByText("The gate is safe for now.")).toBeInTheDocument();
    expect(screen.queryByText("The rival escaped unseen.")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("shows the private closing note only in the GM history projection", () => {
    render(<CompletedEncounterHistory encounter={encounter} viewerMode="gm" />);

    expect(screen.getByText("The rival escaped unseen.")).toBeInTheDocument();
    expect(screen.getByText("Read-only history")).toBeInTheDocument();
  });
});
