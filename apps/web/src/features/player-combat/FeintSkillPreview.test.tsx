// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { combatSkillContestPreviewSchema } from "@glantri/domain";

import { FeintSkillPreview } from "./FeintSkillPreview";

describe("FeintSkillPreview", () => {
  it("uses the compact shared calculation grammar", () => {
    render(
      <FeintSkillPreview
        preview={combatSkillContestPreviewSchema.parse({
          baseSkill: 22,
          completeness: "complete",
          contestType: "movement_feint",
          derivedIntegerAdjustment: -4,
          governingStat: { id: "dex", label: "Dexterity", value: 16 },
          participantId: "participant-1",
          percentageContributions: [
            {
              category: "general_fatigue",
              id: "ce",
              label: "Combat Experience",
              value: -2,
            },
          ],
          preDieTotal: 18,
          role: "movement_feint_initiator",
          schemaVersion: 1,
          skill: { id: "dodge", label: "Dodge", totalXp: 6 },
          totalPercentageAdjustment: -2,
        })}
      />,
    );

    expect(screen.getByText("Dodge")).toBeInTheDocument();
    expect(screen.getByText("DEX 16 + XP 6 = 22")).toBeInTheDocument();
    expect(screen.getByText("Modifiers −2% → −4")).toBeInTheDocument();
    expect(screen.getByText("Effective skill 18")).toBeInTheDocument();
  });

  it("does not guess when canonical profile facts are unavailable", () => {
    render(
      <FeintSkillPreview
        preview={combatSkillContestPreviewSchema.parse({
          completeness: "unavailable",
          contestType: "weapon_feint",
          missingFacts: ["participant_skill_profile"],
          participantId: "participant-1",
          role: "weapon_feint_initiator",
          schemaVersion: 1,
        })}
      />,
    );
    expect(screen.getByText("Effective skill unavailable")).toBeInTheDocument();
  });
});
