// @vitest-environment happy-dom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SkillReferenceContent } from "./SkillReferenceContent";
import SkillReferencePage from "./page";

const mocks = vi.hoisted(() => ({
  loadAdminSkillReferenceFromServer: vi.fn(),
  sessionUser: {
    currentUser: {
      displayName: "Admin",
      email: "admin@glantri.test",
      id: "admin-1",
      roles: ["admin"],
    },
    loading: false,
  },
}));

vi.mock("@/lib/api/adminContentClient", () => ({
  loadAdminSkillReferenceFromServer: mocks.loadAdminSkillReferenceFromServer,
}));

vi.mock("@/lib/auth/SessionUserContext", () => ({
  useSessionUser: () => mocks.sessionUser,
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/skills/reference",
}));

const metadata = {
  provenance: ["packages/content/src/skillContentPlatform/pilotSkillContentReleaseProposal.ts"],
  recordVersion: "2.0.0-candidate.1",
  status: "proposal" as const,
};

const candidate = {
  compatibility: {
    characterMigrationReviewRequired: false,
    classification: "mechanically-compatible" as const,
    rationale: "Authored documentation repaired without activating runtime content.",
  },
  contentVersion: "pilot-skills-content/2.0.0-candidate.1",
  id: "content-release:pilot-skills:2-candidate-1",
  manifest: {
    counts: {
      accessExceptions: 1,
      competencies: 3,
      domains: 2,
      histories: 1,
      profiles: 1,
      relationships: 1,
      scripts: 1,
    },
    packageDigest: `sha256:${"a".repeat(64)}` as const,
    semanticDigest: `sha256:${"b".repeat(64)}` as const,
    serialization: "canonical-json-lexicographic-keys/v1",
  },
  provenance: ["Forgejo #25 authored proposal"],
  records: {
    accessExceptions: [
      {
        basis: "teacher",
        competencyIds: ["skill:surgery"],
        explanation: "A named surgeon can open this otherwise restricted route.",
        grantsCompetence: 0 as const,
        historyIds: [],
        id: "access:surgeon",
        profileId: "profile:mogreb",
      },
    ],
    competencies: [
      {
        ...metadata,
        description: "Medicine covers structured diagnosis and non-operative treatment.",
        domainId: "domain:healing",
        id: "skill:medicine",
        kind: "skill" as const,
        name: "Medicine",
        prerequisites: [],
        shortDescription: "Diagnose and treat without surgery.",
        shortLabel: "Medicine",
        taskEnvelope: {
          coreTasks: ["Take a history and form a diagnosis."],
          limits: ["Does not include invasive procedures."],
          methods: ["Observation, learned texts, and remedies."],
          useGuidance: "Use for authored learned medical practice.",
        },
        weight: 3 as const,
      },
      {
        ...metadata,
        description: "Surgery covers authored invasive procedures and their immediate risks.",
        domainId: "domain:healing",
        id: "skill:surgery",
        kind: "skill" as const,
        name: "Surgery",
        prerequisites: [{ competencyId: "skill:medicine", threshold: 6 }],
        shortDescription: "Perform invasive procedures in an authored tradition.",
        shortLabel: "Surgery",
        taskEnvelope: {
          coreTasks: ["Perform authored invasive procedures."],
          limits: ["Requires the named tradition and tools."],
          methods: ["Incision, extraction, suturing, and cautery."],
          useGuidance: "Use only inside the available operative tradition.",
        },
        weight: 3 as const,
      },
      {
        ...metadata,
        description: "Written Mogrebi is a distinct language and script competence.",
        domainId: "domain:language-and-text",
        id: "written:mogrebi:sacred-mogrebi",
        kind: "written-tradition" as const,
        name: "Written Mogrebi in Sacred Mogrebi",
        prerequisites: [],
        shortDescription: "Read and write Mogrebi in the Sacred Mogrebi script.",
        shortLabel: "Written Mogrebi",
        taskEnvelope: {
          coreTasks: ["Read and compose authored Mogrebi texts."],
          limits: ["Does not imply other scripts or spoken competence."],
          methods: ["Reading and writing in Sacred Mogrebi."],
          useGuidance: "Use for the bound written tradition only.",
        },
        weight: 2 as const,
        writtenLanguageBinding: {
          scriptId: "script:sacred-mogrebi",
          spokenLanguageId: "spoken:mogrebi",
        },
      },
    ],
    domains: [
      { description: "Healing practices.", id: "domain:healing", name: "Healing" },
      {
        description: "Spoken and written traditions.",
        id: "domain:language-and-text",
        name: "Language and Text",
      },
    ],
    histories: [
      {
        context: "Temple medical practice.",
        fixedCompetencyIds: ["skill:medicine"],
        id: "history:temple-infirmary",
        name: "Temple Infirmary",
        selectionSlots: [
          {
            candidateCompetencyIds: ["skill:surgery"],
            chooseCount: 1,
            id: "slot:operative",
            label: "Operative practice",
          },
        ],
      },
    ],
    profiles: [
      {
        accessBand: "AB3",
        developmentStage: "DS3",
        id: "profile:mogreb",
        name: "Mogreb",
        normalRoutes: [
          {
            accessBand: "AB3",
            competencyIds: ["skill:medicine"],
            description: "Temple and medical-text route.",
            id: "route:mogreb-medicine",
          },
        ],
        overrides: [
          {
            attributionId: "route:mogreb-surgery",
            availability: "unavailable",
            competencyIds: ["skill:surgery"],
            explanation: "Ordinary training does not include Surgery.",
          },
        ],
      },
    ],
    relationships: [
      {
        id: "relationship:medicine-surgery",
        rationale: "Medicine supplies a bounded foundation for Surgery.",
        sourceCompetencyId: "skill:medicine",
        strength: 25 as const,
        targetCompetencyId: "skill:surgery",
      },
    ],
    scripts: [
      {
        description: "The sacred script used for this written tradition.",
        familyIds: ["script-family:mogrebi"],
        id: "script:sacred-mogrebi",
        name: "Sacred Mogrebi",
      },
    ],
  },
  rulesVersion: "pilot-skill-rules/v1",
  schemaVersion: "skill-content-release/v2",
  status: "proposal" as const,
  title: "Documentation-complete Pilot Skill v2 candidate",
};

const referencePayload = { candidate, canonical: null };

function competencyTable() {
  return screen.getByRole("heading", { name: "Competencies" }).closest("section")!;
}

beforeEach(() => {
  window.history.replaceState(null, "", "/admin/skills/reference");
  mocks.loadAdminSkillReferenceFromServer.mockReset();
  mocks.loadAdminSkillReferenceFromServer.mockResolvedValue(referencePayload);
  mocks.sessionUser.currentUser.roles = ["admin"];
});

describe("Admin Skill Reference page", () => {
  it("renders the integrated proposal identity and honest canonical absence", async () => {
    render(<SkillReferenceContent />);

    expect(await screen.findByText("pilot-skills-content/2.0.0-candidate.1")).toBeVisible();
    expect(screen.getByText(`sha256:${"a".repeat(64)}`)).toBeVisible();
    expect(screen.getByText(`sha256:${"b".repeat(64)}`)).toBeVisible();
    expect(screen.getByText("Absent")).toBeVisible();
    expect(screen.getByText(/#26 is the sole release gate/i)).toBeVisible();
    expect(await screen.findByText("Take a history and form a diagnosis.")).toBeVisible();
    expect(screen.getByText("Does not include invasive procedures.")).toBeVisible();
  });

  it("restores a stable direct link before choosing a fallback record", async () => {
    window.history.replaceState(null, "", "/admin/skills/reference#competency-skill:surgery");
    render(<SkillReferenceContent />);

    expect(await screen.findByRole("heading", { name: "Surgery" })).toBeVisible();
    expect(screen.getAllByText(/Medicine 6\+/).length).toBeGreaterThan(0);
    expect(window.location.hash).toBe("#competency-skill:surgery");
  });

  it("applies weight, prerequisite, relationship, exception, profile availability, and status filters", async () => {
    const user = userEvent.setup();
    render(<SkillReferenceContent />);
    expect(await screen.findByRole("heading", { name: "Medicine" })).toBeVisible();

    await user.selectOptions(screen.getByRole("combobox", { name: "Weight" }), "2");
    expect(within(competencyTable()).getByText("Written Mogrebi in Sacred Mogrebi")).toBeVisible();
    expect(within(competencyTable()).queryByText("Medicine")).toBeNull();

    await user.selectOptions(screen.getByRole("combobox", { name: "Weight" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Prerequisites" }), "has");
    expect(within(competencyTable()).getByText("Surgery")).toBeVisible();
    expect(within(competencyTable()).queryByText("Medicine")).toBeNull();

    await user.selectOptions(screen.getByRole("combobox", { name: "Prerequisites" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Relationships" }), "outgoing");
    expect(within(competencyTable()).getByText("Medicine")).toBeVisible();
    expect(within(competencyTable()).queryByText("Surgery")).toBeNull();

    await user.selectOptions(screen.getByRole("combobox", { name: "Relationships" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Access exceptions" }), "has");
    expect(within(competencyTable()).getByText("Surgery")).toBeVisible();

    await user.selectOptions(screen.getByRole("combobox", { name: "Access exceptions" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Profile" }), "profile:mogreb");
    await user.selectOptions(screen.getByRole("combobox", { name: "Availability" }), "unavailable");
    expect(within(competencyTable()).getByText("Surgery")).toBeVisible();
    expect(screen.getByText("Ordinary training does not include Surgery.")).toBeVisible();

    await user.selectOptions(screen.getByRole("combobox", { name: "Availability" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "canonical");
    expect(screen.getByText(/No competencies match the current search and filters/i)).toBeVisible();
  });

  it("uses readable directional relationships, histories, bindings, and keyboard focus", async () => {
    const user = userEvent.setup();
    render(<SkillReferenceContent />);
    expect(await screen.findByRole("heading", { name: "Medicine" })).toBeVisible();
    expect(screen.getByText("Contributes 25% to Surgery")).toBeVisible();
    expect(screen.getByText("Temple Infirmary")).toBeVisible();

    const surgeryRow = within(competencyTable()).getByText("Surgery").closest("tr")!;
    surgeryRow.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Surgery" })).toHaveFocus();
    expect(screen.getByText("Receives 25% from Medicine")).toBeVisible();

    await user.clear(screen.getByRole("textbox", { name: "Search competencies" }));
    await user.type(screen.getByRole("textbox", { name: "Search competencies" }), "Sacred Mogrebi");
    expect(await screen.findByRole("heading", { name: /Written Mogrebi/i })).toBeVisible();
    expect(screen.getByText("Language and script binding:").closest("div")).toHaveTextContent(
      "Mogrebi in Sacred Mogrebi",
    );
  });

  it("denies an authenticated non-admin before the reference request mounts", async () => {
    mocks.sessionUser.currentUser.roles = ["player"];
    render(<SkillReferencePage />);

    expect(screen.getByRole("heading", { name: "Admin access required" })).toBeVisible();
    expect(mocks.loadAdminSkillReferenceFromServer).not.toHaveBeenCalled();
  });

  it("shows a recoverable error state without stale reference content", async () => {
    mocks.loadAdminSkillReferenceFromServer.mockRejectedValueOnce(
      new Error("Reference unavailable"),
    );
    render(<SkillReferenceContent />);

    expect(await screen.findByText("Reference unavailable")).toBeVisible();
    expect(screen.queryByText("Medicine")).toBeNull();
  });
});
