// @vitest-environment happy-dom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import SkillReferencePage from "./page";

const mocks = vi.hoisted(() => ({
  loadAdminSkillReferenceFromServer: vi.fn(),
}));

vi.mock("@/lib/api/adminContentClient", () => ({
  loadAdminSkillReferenceFromServer: mocks.loadAdminSkillReferenceFromServer,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/skills/reference",
}));

const referencePayload = {
  canonical: {
    compatibility: {
      characterMigrationReviewRequired: false,
      classification: "presentation-only",
      rationale: "Read-only release slice for Admin reference."
    },
    contentVersion: "pilot-skills-content/1.0.1",
    id: "content-release:pilot-skills:1",
    manifest: {
      counts: {
        accessExceptions: 1,
        competencies: 2,
        domains: 2,
        histories: 1,
        profiles: 1,
        relationships: 1,
        scripts: 1,
      },
      packageDigest: "sha256:abc",
      serialization: "canonical-json-lexicographic-keys/v1"
    },
    provenance: ["pilot-skill-content-release/v1", "pilot-skill-rules/v1"],
    records: {
      accessExceptions: [
        {
          basis: "tradition",
          competencyIds: ["competency:pilotage"],
          explanation: "Only granted through tradition route for pilots.",
          grantsCompetence: 0,
          historyIds: ["history:voyages"],
          id: "access:exception:pilotage",
          profileId: "profile:ocean",
        },
      ],
      competencies: [
        {
          acquisitionWeight: 1,
          description: "Read vessel status and handling.",
          domainId: "domain:navigation",
          id: "competency:pilotage",
          kind: "skill",
          name: "Pilotage",
          prerequisites: [],
          shortDescription: "Vessel handling in constrained waters.",
          shortLabel: "Pilotage",
          status: "canonical",
          transfer: {
            kind: "zero-transfer",
            rationale: "Pilotage never grants transfered skills."
          },
          weight: 2,
          provenance: ["pilot-skill-content-release/v1"],
          recordVersion: "sha256:abc",
          taskEnvelope: {
            coreTasks: ["Apply pilotage in confined waters."],
            limits: ["Read-only reference."],
            methods: ["Apply bounded pilot rules."],
            useGuidance: "Do not mutate this surface."
          },
        },
        {
          description: "Written records of seamanship terms.",
          domainId: "domain:linguistics",
          id: "written:pilot",
          kind: "written-tradition",
          name: "Pilot Logs",
          prerequisites: [],
          shortDescription: "Seafaring manuscripts for reference.",
          shortLabel: "Pilot Logs",
          status: "canonical",
          weight: 1,
          provenance: ["pilot-skill-content-release/v1"],
          recordVersion: "sha256:def",
          writtenLanguageBinding: {
            scriptId: "script:sea-script",
            spokenLanguageId: "spoken:common"
          },
          taskEnvelope: {
            coreTasks: ["Interpret pilot ledgers and navigation notes."],
            limits: ["Reference only."],
            methods: ["Keep records isolated."],
            useGuidance: "Do not mutate this surface."
          },
        },
      ],
      domains: [
        {
          description: "Pilotage and navigation planning.",
          id: "domain:navigation",
          name: "Navigation"
        },
        {
          description: "Navigation writing and symbols.",
          id: "domain:linguistics",
          name: "Linguistics"
        },
      ],
      histories: [
        {
          context: "Sea voyages and docking",
          fixedCompetencyIds: ["competency:pilotage"],
          id: "history:voyages",
          selectionSlots: [
            {
              candidateCompetencyIds: ["competency:pilotage", "competency:seamanship"],
              chooseCount: 1,
              id: "slot:voyage",
              label: "Pilot voyage bonus"
            }
          ],
          name: "Sailor Voyages",
        },
      ],
      profiles: [
        {
          accessBand: "apprentice",
          developmentStage: "stable",
          id: "profile:ocean",
          name: "Ocean Captain",
          normalRoutes: [
            {
              accessBand: "apprentice",
              competencyIds: ["competency:pilotage"],
              description: "Pilotage with apprenticeship routes only.",
              id: "route:ocean"
            },
          ],
          overrides: [
            {
              attributionId: "ocean-origin",
              availability: "restricted",
              competencyIds: ["competency:pilotage"],
              explanation: "Captain-only override for long voyages.",
            },
          ],
        },
      ],
      relationships: [
        {
          id: "relationship:pilotage-to-seamanship",
          rationale: "Pilotage supports seamanship practice.",
          sourceCompetencyId: "competency:pilotage",
          strength: 50,
          targetCompetencyId: "competency:seamanship",
        },
      ],
      scripts: [
        {
          description: "Sea-route symbol binding for pilot logs.",
          domainId: "domain:linguistics",
          familyIds: ["language-family:common", "script:sea-script"],
          id: "script:sea-script",
          name: "Script Sea"
        },
      ],
    },
    rulesVersion: "pilot-skill-rules/v1",
    schemaVersion: "skill-content-release/v2",
    status: "canonical",
    title: "Pilot Skill Content Release v1",
  },
  candidate: null,
};

beforeEach(() => {
  mocks.loadAdminSkillReferenceFromServer.mockReset();
  mocks.loadAdminSkillReferenceFromServer.mockResolvedValue(referencePayload);
});

describe("Admin Skill Reference page", () => {
  it("renders canonical slice and candidate-absent notice", async () => {
    const user = userEvent.setup();
    render(<SkillReferencePage />);

    expect(await screen.findByText("Admin Skill Reference")).toBeVisible();

    await user.selectOptions(screen.getAllByRole("combobox")[0], "candidate");
    expect(
      screen.getByText(
        "Candidate contract is not available yet. Integrated pilot proposal data must be explicitly onboarded before this mode can render."
      )
    ).toBeVisible();
  });

  it("filters competencies by search text and supports row focus selection", async () => {
    const user = userEvent.setup();
    render(<SkillReferencePage />);

    expect(await screen.findByText("Pilotage")).toBeVisible();

    const search = screen.getByRole("textbox", { name: /search/i });
    await user.type(search, "Pilotage");

    expect(screen.getByText("Pilotage")).toBeVisible();
    expect(screen.queryByText("Pilot Logs")).toBeNull();

    const row = screen.getByText("Pilotage").closest("tr");
    expect(row).not.toBeNull();
    row!.focus();
    await user.keyboard("{Enter}");

    expect(screen.getByText("Competency detail: Pilotage")).toBeVisible();
    expect(screen.getByText(/Outbound relationships:/i)).toBeVisible();
  });

  it("links profile context to selected competency", async () => {
    render(<SkillReferencePage />);

    expect(await screen.findByText("Competency detail: Pilotage")).toBeVisible();

    await userEvent.setup().selectOptions(
      screen.getByRole("combobox", { name: /profile/i }),
      "profile:ocean"
    );

    const selectedProfileRow = screen.getByText("Selected profile:").closest("div");
    expect(selectedProfileRow).not.toBeNull();
    expect(selectedProfileRow).toHaveTextContent(/Ocean Captain/i);
    expect(screen.getByText("route:ocean")).toBeVisible();
  });
});
