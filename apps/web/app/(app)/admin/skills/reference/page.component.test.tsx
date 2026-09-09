// @vitest-environment happy-dom

import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SkillReferenceContent } from "./SkillReferenceContent";
import { SkillReferenceAuditContent } from "./audit/SkillReferenceAuditContent";
import SkillReferenceAuditPage from "./audit/page";
import SkillReferencePage from "./page";
import SkillSystemReferencePage from "./system/page";

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

const referenceMetadata = {
  archSkills: [
    {
      description: "Healing navigation context.",
      id: "arch-skill:healing",
      mechanics: "none" as const,
      metadata: {
        recordVersion: "1",
        status: "proposal" as const,
        provenance: { kind: "proposal" as const, reference: "test" },
      },
      membershipMeaning: "navigation-only" as const,
      name: "Healing",
      skillMemberships: [{ placement: "primary" as const, skillId: "skill:medicine" }],
    },
  ],
  archSocieties: [],
  historicalAvailability: [],
  skillSocietyFloors: [],
  societyApplicability: [],
  learningGroups: [],
  learningHistories: [],
  manifestations: [],
  professionReferences: [],
  schemaVersion: "skill-reference-metadata/v1",
  societyLevelBandMatrix: {
    cells: [
      {
        historicalAvailabilityIds: [],
        socialBand: "L1" as const,
        societyLevel: 1 as const,
        status: "unresolved" as const,
      },
      {
        historicalAvailabilityIds: [],
        socialBand: "L2" as const,
        societyLevel: 1 as const,
        status: "context-dependent" as const,
      },
    ],
    socialBands: [
      { id: "L1" as const, label: "Social Band L1" },
      { id: "L2" as const, label: "Social Band L2" },
    ],
    societyLevels: [{ label: "Society Level 1", level: 1 as const }],
  },
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
      accessExceptions: 2,
      competencies: 4,
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
  referenceMetadata,
  records: {
    accessExceptions: [
      {
        basis: "teacher",
        competencyIds: ["skill:surgery"],
        explanation:
          "Named temple surgeon Neseret opens only Surgery training and grants zero ranks.",
        grantsCompetence: 0 as const,
        historyIds: [],
        id: "access:surgeon",
        profileId: "profile:mogreb",
      },
      {
        basis: "biography",
        competencyIds: ["skill:surgery"],
        explanation:
          "This fallback route implementation provides Surgery access while granting no competence.",
        grantsCompetence: 0 as const,
        historyIds: [],
        id: "access:surgery-biography",
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
      {
        ...metadata,
        acquisitionWeight: 1 as const,
        description: "Diagnostic Medicine applies learned medical practice to difficult diagnoses.",
        domainId: "domain:healing",
        id: "specialization:diagnostic-medicine",
        kind: "specialization" as const,
        name: "Diagnostic Medicine",
        parentCompetencyId: "skill:medicine",
        prerequisites: [{ competencyId: "skill:medicine", threshold: 6 }],
        shortDescription: "Diagnose unusually difficult illnesses.",
        shortLabel: "Diagnostic Medicine",
        taskEnvelope: {
          coreTasks: ["Resolve an unusually difficult diagnosis."],
          limits: ["Requires explicit acquisition after meeting the prerequisite."],
          methods: ["Structured comparison of symptoms and learned cases."],
          useGuidance: "Use for difficult diagnoses beyond ordinary practice.",
        },
        transfer: {
          kind: "zero-transfer" as const,
          rationale: "No transfer relationship is authored for this candidate example.",
        },
        weight: 1 as const,
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

function skillList() {
  return screen.getByRole("list", { name: "Skills" });
}

async function openMedicine(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole("list", { name: "Skills" });
  await user.click(within(skillList()).getByText("Medicine").closest("a")!);
}

beforeEach(() => {
  window.history.replaceState(null, "", "/admin/skills/reference");
  mocks.loadAdminSkillReferenceFromServer.mockReset();
  mocks.loadAdminSkillReferenceFromServer.mockResolvedValue(referencePayload);
  mocks.sessionUser.currentUser.roles = ["admin"];
});

describe("Admin Skill Reference page", () => {
  it("renders proposal context, separate history/profession facts, and unresolved availability", async () => {
    const user = userEvent.setup();
    render(<SkillReferenceContent />);
    await openMedicine(user);

    expect(screen.getByRole("heading", { name: "Reference context" })).toBeVisible();
    expect(screen.getAllByText("Arch Skills").length).toBeGreaterThan(0);
    expect(screen.getByText("Healing", { selector: "li" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Society Level × Social Band" })).toBeVisible();
    expect(screen.getByText("Unresolved")).toBeVisible();
    expect(screen.getByText("Context-dependent")).toBeVisible();
    expect(
      screen.getByText("No Learning Group placement is recorded for this Skill."),
    ).toBeVisible();
    expect(
      screen.getByText("No separate profession references are supplied for this proposal."),
    ).toBeVisible();
  });

  it("leads with reader-facing identity, descriptions, and compact rules", async () => {
    const user = userEvent.setup();
    render(<SkillReferenceContent />);
    await openMedicine(user);

    expect(screen.getByRole("heading", { name: "Medicine" })).toBeVisible();
    expect(screen.getAllByText("Diagnose and treat without surgery.").length).toBeGreaterThan(0);
    expect(
      screen.getByText("Medicine covers structured diagnosis and non-operative treatment."),
    ).toBeVisible();
    expect(screen.getByText("Each rank costs 3 points.")).toBeVisible();
    expect(screen.getByRole("link", { name: "Healing" })).toHaveAttribute(
      "href",
      "/admin/skills/reference/audit#domain-domain%3Ahealing",
    );
    expect(screen.getByText("Take a history and form a diagnosis.")).toBeVisible();
    expect(screen.getByText("Does not include invasive procedures.")).toBeVisible();
    expect(screen.queryByText("Observation, learned texts, and remedies.")).toBeNull();
    expect(screen.getByText(/Candidate for review/)).toBeVisible();
    expect(screen.getByText(/awaits Product Owner calibration in #26/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Technical and audit details" })).toHaveAttribute(
      "href",
      "/admin/skills/reference/audit",
    );
    expect(screen.queryByText(`sha256:${"a".repeat(64)}`)).toBeNull();
    expect(screen.queryByText("pilot-skills-content/2.0.0-candidate.1")).toBeNull();
    expect(screen.queryByRole("heading", { name: "Record provenance" })).toBeNull();
    expect(screen.queryByText("skill-content-release/v2")).toBeNull();

    const detail = screen.getByRole("heading", { name: "Medicine" }).closest("article")!;
    const orderedContent = [
      within(detail).getByRole("heading", { name: "Medicine" }),
      within(detail).getByText("Diagnose and treat without surgery."),
      within(detail).getByText("Medicine covers structured diagnosis and non-operative treatment."),
      within(detail).getByRole("heading", { name: "Rules at a glance" }),
      within(detail).getByRole("heading", { name: "Typical uses and boundaries" }),
      within(detail).getByRole("heading", { name: "Relationships" }),
    ];
    for (let index = 1; index < orderedContent.length; index += 1) {
      expect(
        orderedContent[index - 1]!.compareDocumentPosition(orderedContent[index]!) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).not.toBe(0);
    }
  });

  it("describes normal availability without exposing its technical route", async () => {
    const user = userEvent.setup();
    render(<SkillReferenceContent />);
    await openMedicine(user);

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Availability society" }),
      "profile:mogreb",
    );

    const detail = screen.getByRole("heading", { name: "Medicine" }).closest("article")!;
    expect(within(detail).getByText("available")).toBeVisible();
    expect(within(detail).getByText("for Mogreb.")).toBeVisible();
    expect(within(detail).queryByText(/route|DS3|AB3|zero competence|no ranks/i)).toBeNull();
  });

  it("restores a stable direct link before choosing a fallback record", async () => {
    window.history.replaceState(null, "", "/admin/skills/reference#competency-skill:surgery");
    render(<SkillReferenceContent />);

    expect(await screen.findByRole("heading", { name: "Surgery" })).toBeVisible();
    expect(
      screen.getAllByText((_, element) => element?.textContent?.trim() === "Medicine 6+").length,
    ).toBeGreaterThan(0);
    expect(window.location.hash).toBe("#competency-skill:surgery");
  });

  it("filters the bounded catalogue and resolves genuine profile access", async () => {
    const user = userEvent.setup();
    render(<SkillReferenceContent />);
    await openMedicine(user);

    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "written-tradition");
    expect(within(skillList()).getByText("Written Mogrebi in Sacred Mogrebi")).toBeVisible();
    expect(within(skillList()).queryByText("Medicine")).toBeNull();

    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "all");
    await user.type(screen.getByRole("textbox", { name: "Search Skills" }), "invasive");
    expect(within(skillList()).getByText("Surgery")).toBeVisible();
    expect(within(skillList()).queryByText("Medicine")).toBeNull();

    await user.selectOptions(
      screen.getByRole("combobox", { name: "Availability society" }),
      "profile:mogreb",
    );
    expect(screen.getByText("Ordinary training does not include Surgery.")).toBeVisible();
    expect(screen.getByText("unavailable")).toBeVisible();
    expect(screen.getByText("for Mogreb.")).toBeVisible();
    expect(screen.getByText(/Teacher exception/)).toBeVisible();
    expect(
      screen.getByText(/Named temple surgeon Neseret opens only Surgery training/),
    ).toBeVisible();
    expect(screen.getByText(/This alternative way to learn provides Surgery access/)).toBeVisible();
    expect(screen.getAllByText(/Access still requires learning the Skill/)).toHaveLength(2);
    expect(
      screen.queryByText(
        /DS3|AB3|fallback|route|implementation|zero[- ]ranks?|zero competence|no competence|no ranks/i,
      ),
    ).toBeNull();
  });

  it("keeps actual and equivalent availability exceptions authoritative but reader-safe", async () => {
    const user = userEvent.setup();
    window.history.replaceState(null, "", "/admin/skills/reference#competency-skill:surgery");
    render(<SkillReferenceContent />);

    expect(await screen.findByRole("heading", { name: "Surgery" })).toBeVisible();
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Availability society" }),
      "profile:mogreb",
    );

    const detail = screen.getByRole("heading", { name: "Surgery" }).closest("article")!;
    expect(within(detail).getByText(/Named temple surgeon Neseret/)).toBeVisible();
    expect(within(detail).getByText(/This alternative way to learn/)).toBeVisible();
    expect(within(detail).getAllByText(/Access still requires learning the Skill/)).toHaveLength(2);
    expect(
      within(detail).queryByText(/zero[- ]?ranks?|fallback|route|implementation|no competence/i),
    ).toBeNull();
  });

  it("uses direct relationship links with native keyboard behavior and detail focus", async () => {
    const user = userEvent.setup();
    render(<SkillReferenceContent />);
    await openMedicine(user);
    expect(screen.getByText(/Contributes 25% of/).closest("li")).toHaveTextContent(
      "Contributes 25% of acquired base competence to Surgery",
    );

    const surgeryLink = within(skillList()).getByText("Surgery").closest("a")!;
    surgeryLink.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Surgery" })).toHaveFocus();
    expect(screen.getByText(/Receives 25% of/).closest("li")).toHaveTextContent(
      "Receives 25% of acquired base competence from Medicine",
    );

    await user.clear(screen.getByRole("textbox", { name: "Search Skills" }));
    await user.type(screen.getByRole("textbox", { name: "Search Skills" }), "Sacred Mogrebi");
    expect(await screen.findByRole("heading", { name: /Written Mogrebi/i })).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Relationships" }).closest("section"),
    ).toHaveTextContent("Spoken and written competence remain separate");
    expect(screen.getByText(/Mogrebi \(not included\)/)).toBeVisible();
  });

  it("presents Specialization cost, ownership, parent, and zero-transfer rules", async () => {
    const user = userEvent.setup();
    render(<SkillReferenceContent />);
    await screen.findByRole("list", { name: "Skills" });

    await user.type(screen.getByRole("textbox", { name: "Search Skills" }), "Diagnostic Medicine");

    expect(await screen.findByRole("heading", { name: "Diagnostic Medicine" })).toBeVisible();
    expect(screen.getByText(/first rank costs 3 points/i)).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Relationships" }).closest("section"),
    ).toHaveTextContent("RelationshipsNone.");
    expect(
      screen
        .getAllByRole("link", { name: "Medicine" })
        .every((link) => link.getAttribute("href") === "#competency-skill%3Amedicine"),
    ).toBe(true);
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

describe("separate Skill reference pages", () => {
  it("keeps shared Skill-system explanation on its own Admin-only page", () => {
    render(<SkillSystemReferencePage />);

    expect(screen.getByRole("heading", { name: "How the Skill System Works" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Ranks and cost" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "How related Skills help" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Where Skills are available" })).toBeVisible();
    expect(screen.getByText(/does not expand the full catalogue/)).toBeVisible();
  });

  it("keeps digests, provenance, histories, and exceptions on the audit page", async () => {
    render(<SkillReferenceAuditContent />);

    expect(await screen.findByRole("heading", { name: "Skill Reference Audit" })).toBeVisible();
    expect(screen.getByText(`sha256:${"a".repeat(64)}`)).toBeVisible();
    expect(screen.getByText(`sha256:${"b".repeat(64)}`)).toBeVisible();
    expect(screen.getByRole("heading", { name: "Record provenance" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Learning-history index" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Access-exception register" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Relationship register" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "Availability authoring" })).toBeVisible();
    expect(screen.getAllByText(/Methods \/ failure modes:/)).toHaveLength(4);
    expect(screen.getByText(/DS3/)).toBeInTheDocument();
    expect(screen.getByText(/^Healing:/).closest("li")).toHaveAttribute(
      "id",
      "domain-domain:healing",
    );
  });

  it("guards the separate system and audit routes before loading reference data", () => {
    mocks.sessionUser.currentUser.roles = ["player"];

    const { unmount } = render(<SkillSystemReferencePage />);
    expect(screen.getByRole("heading", { name: "Admin access required" })).toBeVisible();
    unmount();

    render(<SkillReferenceAuditPage />);
    expect(screen.getByRole("heading", { name: "Admin access required" })).toBeVisible();
    expect(mocks.loadAdminSkillReferenceFromServer).not.toHaveBeenCalled();
  });
});
