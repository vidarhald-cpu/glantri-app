// @vitest-environment happy-dom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CombatDisarmDeclarationControls } from "./CombatDisarmDeclarationControls";

const options = {
  actors: [
    {
      items: [
        {
          category: "weapon",
          id: "technical-main-gauche-id",
          label: "Main gauche",
          operations: ["drop" as const],
          revision: "2026-08-17T10:00:00.000Z",
          state: "equipped" as const,
          templateId: "weapon-template-main-gauche",
          weaponDisarm: {
            capability: "trap" as const,
            controlRating: 2,
            gripClass: "one_handed" as const,
            parryModifier: 2,
          },
        },
        {
          category: "weapon",
          id: "technical-sword-id",
          label: "Ordinary sword",
          operations: ["drop" as const],
          revision: "2026-08-17T10:00:00.000Z",
          state: "equipped" as const,
          templateId: "weapon-template-sword",
          weaponDisarm: {
            capability: "none" as const,
            controlRating: 3,
            gripClass: "one_handed" as const,
            parryModifier: 0,
          },
        },
      ],
      label: "Aster",
      participantId: "actor-id",
    },
  ],
  disarmTargets: [
    {
      items: [
        {
          category: "weapon",
          id: "technical-spear-id",
          label: "Heavy spear",
          operations: ["drop" as const],
          revision: "2026-08-17T10:00:00.000Z",
          state: "held" as const,
          templateId: "weapon-template-spear",
          weaponDisarm: {
            capability: "none" as const,
            controlRating: 4,
            gripClass: "two_handed" as const,
            parryModifier: -1,
          },
        },
      ],
      label: "Bram",
      participantId: "target-id",
    },
  ],
  presentItems: [],
  recipients: [],
};

describe("CombatDisarmDeclarationControls", () => {
  it("shows only capable acting weapons, canonical control ratings, and no technical ids", () => {
    const { container } = render(
      <CombatDisarmDeclarationControls
        actingParticipantId="actor-id"
        method="proactive"
        onChange={vi.fn()}
        options={options}
        selection={{
          actingItemId: "technical-main-gauche-id",
          phase: "phase1",
          targetItemId: "technical-spear-id",
          targetParticipantId: "target-id",
        }}
      />,
    );

    expect(screen.getByRole("option", { name: "Main gauche · control 2" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Ordinary sword/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Heavy spear · control 4" })).toBeInTheDocument();
    expect(container.textContent).not.toContain("technical-");
  });

  it("clears the exact target weapon when the opponent changes", () => {
    const onChange = vi.fn();
    render(
      <CombatDisarmDeclarationControls
        actingParticipantId="actor-id"
        method="reactive_parry"
        onChange={onChange}
        options={options}
        selection={{
          actingItemId: "technical-main-gauche-id",
          phase: "phase2",
          targetItemId: "technical-spear-id",
          targetParticipantId: "target-id",
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Opponent"), { target: { value: "target-id" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ targetItemId: "", targetParticipantId: "target-id" }),
    );
  });
});
