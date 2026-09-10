// @vitest-environment happy-dom

import type { AdminSkillReferenceMetadata } from "@glantri/shared";
import { fullSkillCatalogueProposal } from "@glantri/content/full-skill-catalogue-proposal";

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

const referenceMetadata: AdminSkillReferenceMetadata = {
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
    cells: [],
    socialBands: ["L1", "L2", "L3", "L4"].map((id) => ({
      id: id as "L1" | "L2" | "L3" | "L4",
      label: `Social Band ${id}`,
    })),
    societyLevels: [1, 2, 3, 4, 5, 6].map((level) => ({
      level: level as 1 | 2 | 3 | 4 | 5 | 6,
      label: `Society Level ${level}`,
    })),
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
  it("browses the complete proposal with prose primary and unresolved records outside acquisitions", async () => {
    const user = userEvent.setup();
    mocks.loadAdminSkillReferenceFromServer.mockResolvedValue({
      ...referencePayload,
      fullCatalogue: fullSkillCatalogueProposal,
    });
    render(<SkillReferenceContent />);

    expect(await screen.findByText(/172 acquirable entries/)).toBeVisible();
    expect(screen.getByRole("list", { name: "Competencies" })).toBeVisible();
    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "spoken-language");
    expect(screen.getByRole("heading", { name: "Competencies (12)" })).toBeVisible();

    await user.selectOptions(screen.getByRole("combobox", { name: "Type" }), "all");
    await user.type(screen.getByRole("textbox", { name: "Search competencies" }), "Falconry");
    expect(await screen.findByRole("heading", { name: "Falconry" })).toBeVisible();
    const detail = screen.getByRole("heading", { name: "Falconry" }).closest("article")!;
    expect(
      within(detail).getByText(
        fullSkillCatalogueProposal.entries
          .find(({ id }) => id === "spec:falconry")!
          .description.split("\n\n")[0]!,
      ),
    ).toBeVisible();
    expect(
      within(detail).getByRole("heading", { name: "Typical uses and boundaries" }),
    ).toBeVisible();
    expect(within(detail).getByRole("heading", { name: "Reference context" })).toBeVisible();
    expect(within(detail).getByRole("link", { name: "Animal Training" })).toHaveAttribute(
      "href",
      "#competency-spec%3Aanimal-training",
    );
    expect(within(detail).getByText(/A18 — Finding and securing wild food/)).toBeVisible();
    expect(within(detail).queryByText(/rank costs|points per rank/i)).toBeNull();

    const heldSummary = screen.getByText(/9 unresolved bindings; 3 support scripts/);
    await user.click(heldSummary);
    expect(screen.getByText(/Heart Surgery is excluded/)).toBeVisible();
    expect(screen.getByText(/Common written tradition: define script/)).toBeVisible();
    expect(screen.getAllByText(/Support only; no acquisition count/)).toHaveLength(3);
  });

  it("keeps unresolved context secondary, omits Domain placeholders, and exposes the full matrix on demand", async () => {
    const user = userEvent.setup();
    render(<SkillReferenceContent />);
    await openMedicine(user);
    const context = screen.getByRole("region", { name: "Learning & historical context" });
    expect(within(context).getByText("Not yet authored.")).toBeVisible();
    expect(within(context).queryByText("Healing")).toBeNull();
    expect(within(context).getByText("All 24 cells are unresolved for Medicine.")).toBeVisible();
    const disclosure = within(context).getByText(
      "Inspect full historical matrix for Medicine (6 × 4)",
    );
    expect(disclosure.closest("details")).not.toHaveAttribute("open");
    await user.click(disclosure);
    expect(disclosure.closest("details")).toHaveAttribute("open");
    expect(within(context).getAllByRole("cell")).toHaveLength(24);
    expect(within(context).getAllByText("Unresolved")).toHaveLength(24);
    expect(
      within(context).getByRole("region", { name: "Historical matrix for Medicine" }),
    ).toHaveAttribute("tabindex", "0");
    expect(
      within(context).getByText(/Scroll horizontally to inspect all Social Bands/),
    ).toBeVisible();
    expect(
      within(context).getByText("No Learning History is recorded for this Skill."),
    ).toBeVisible();
    expect(
      within(context).getByText("No profession reference is recorded for this Skill."),
    ).toBeVisible();
    expect(screen.queryByRole("heading", { name: "Reference context" })).toBeNull();
  });

  it("filters histories and professions to the selected Skill and distinguishes both association types", async () => {
    const user = userEvent.setup();
    const factMetadata = referenceMetadata.archSkills[0]!.metadata;
    mocks.loadAdminSkillReferenceFromServer.mockResolvedValue({
      candidate: {
        ...candidate,
        referenceMetadata: {
          ...referenceMetadata,
          learningHistories: [
            {
              historyId: "history:medical",
              name: "Medical apprenticeship",
              context: "Practice with a physician.",
              skillIds: ["skill:medicine"],
              metadata: factMetadata,
            },
            {
              historyId: "history:operative",
              name: "Operative apprenticeship",
              context: "Practice with a surgeon.",
              skillIds: ["skill:surgery"],
              metadata: factMetadata,
            },
          ],
          professionReferences: [
            {
              id: "profession:direct",
              name: "Direct physician",
              suggestedSkillIds: ["skill:medicine"],
              learningHistoryIds: [],
              metadata: factMetadata,
            },
            {
              id: "profession:indirect",
              name: "History physician",
              suggestedSkillIds: [],
              learningHistoryIds: ["history:medical", "history:operative"],
              metadata: factMetadata,
            },
            {
              id: "profession:both",
              name: "Both physician",
              suggestedSkillIds: ["skill:medicine"],
              learningHistoryIds: ["history:medical"],
              metadata: factMetadata,
            },
            {
              id: "profession:surgeon",
              name: "Surgeon only",
              suggestedSkillIds: ["skill:surgery"],
              learningHistoryIds: ["history:operative"],
              metadata: factMetadata,
            },
          ],
        },
      },
      canonical: null,
    });
    render(<SkillReferenceContent />);
    await openMedicine(user);
    const context = screen.getByRole("region", { name: "Learning & historical context" });
    expect(within(context).getByText(/Medical apprenticeship — Practice/)).toBeVisible();
    expect(within(context).queryByText(/Operative apprenticeship/)).toBeNull();
    expect(within(context).queryByText("Surgeon only")).toBeNull();
    expect(within(context).getByText("Direct physician").closest("li")).toHaveTextContent(
      "Direct Skill suggestion.",
    );
    expect(within(context).getByText("History physician").closest("li")).not.toHaveTextContent(
      "Direct Skill suggestion.",
    );
    expect(within(context).getByText("History physician").closest("li")).toHaveTextContent(
      "Associated through Learning History: Medical apprenticeship.",
    );
    expect(within(context).getByText("Both physician").closest("li")).toHaveTextContent(
      "Direct Skill suggestion.Associated through Learning History: Medical apprenticeship.",
    );
    await user.click(within(skillList()).getByText("Surgery").closest("a")!);
    expect(screen.queryByText("Direct physician")).toBeNull();
    expect(screen.getByText("Surgeon only")).toBeVisible();
    expect(screen.queryByText(/Medical apprenticeship/)).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Search Skills" }), "no matches");
    expect(screen.queryByRole("region", { name: "Learning & historical context" })).toBeNull();
  });

  it("uses human society names and selected-Skill historical facts without losing held or mixed states", async () => {
    const user = userEvent.setup();
    const factMetadata = referenceMetadata.archSkills[0]!.metadata;
    const fact = {
      archSocietyId: "arch-society:forager_ritual_tribal",
      explanation: "Test evidence.",
      metadata: factMetadata,
      skillId: "skill:medicine",
      societyLevel: 1 as const,
      socialBand: "L1" as const,
    };
    const scopedMetadata: AdminSkillReferenceMetadata = {
      ...referenceMetadata,
      archSocieties: [
        {
          id: fact.archSocietyId,
          name: "Forager Ritual Society",
          description: "Historical lens.",
          societyLevel: 1,
          metadata: factMetadata,
        },
      ],
      archSkills: [
        ...referenceMetadata.archSkills,
        {
          ...referenceMetadata.archSkills[0]!,
          id: "arch-skill:approved",
          name: "Approved capability",
          metadata: {
            ...factMetadata,
            provenance: { kind: "decision", reference: "test approval" },
          },
        },
      ],
      historicalAvailability: [
        { ...fact, id: "history:available", status: "available" },
        { ...fact, id: "history:restricted", status: "restricted" },
        { ...fact, id: "history:review", socialBand: "L2", status: "review-required" },
        { ...fact, id: "history:recorded", socialBand: "L3", status: "available" },
        {
          ...fact,
          id: "history:other-skill",
          skillId: "skill:surgery",
          socialBand: "L4",
          status: "available",
        },
      ],
      manifestations: [{ ...fact, id: "manifestation:test", status: "unresolved" }],
      skillSocietyFloors: [
        {
          skillId: fact.skillId,
          id: "floor:test",
          status: "held",
          explanation: "Floor held for review.",
          metadata: factMetadata,
        },
      ],
      societyApplicability: [
        {
          ...fact,
          id: "applicability:test",
          status: "held",
          supportingLearningGroupIds: [],
          standaloneRouteIds: [],
        },
      ],
    };
    mocks.loadAdminSkillReferenceFromServer.mockResolvedValue({
      candidate: { ...candidate, referenceMetadata: scopedMetadata },
      canonical: null,
    });
    render(<SkillReferenceContent />);
    await openMedicine(user);
    const context = screen.getByRole("region", { name: "Learning & historical context" });
    expect(within(context).getByText("Approved capability")).toBeVisible();
    expect(within(context).queryByText("Healing")).toBeNull();
    expect(context).not.toHaveTextContent("forager_ritual_tribal");
    expect(context).toHaveTextContent("Forager Ritual Society (Held)");
    expect(context).toHaveTextContent("Society Level unresolved (Held) — Floor held for review.");
    const table = within(context).getByRole("table");
    const firstRow = within(table).getAllByRole("row")[1]!;
    expect(
      within(firstRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["Context Dependent", "Unresolved", "Recorded", "Unresolved"]);
    expect(within(context).queryByText(/All 24 cells/)).toBeNull();
    await user.click(within(skillList()).getByText("Surgery").closest("a")!);
    expect(
      screen.getByRole("heading", { name: "Historical availability for Surgery" }),
    ).toBeVisible();
    expect(screen.queryByText(/Floor held for review/)).toBeNull();
    const surgeryRow = within(screen.getByRole("table")).getAllByRole("row")[1]!;
    expect(
      within(surgeryRow)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["Unresolved", "Unresolved", "Unresolved", "Recorded"]);
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
      screen.getByRole("heading", { name: "Find a Skill" }),
      skillList(),
      within(detail).getByRole("heading", { name: "Medicine" }),
      within(detail).getByText("Diagnose and treat without surgery."),
      within(detail).getByText("Medicine covers structured diagnosis and non-operative treatment."),
      within(detail).getByRole("heading", { name: "Rules at a glance" }),
      within(detail).getByRole("heading", { name: "Typical uses and boundaries" }),
      within(detail).getByRole("heading", { name: "Relationships" }),
      within(detail).getByRole("heading", { name: "Learning & historical context" }),
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
    expect(
      await screen.findByRole("heading", { name: /Written Mogrebi/i, level: 2 }),
    ).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Relationships" }).closest("section"),
    ).toHaveTextContent("Spoken and written competence remain separate");
    expect(screen.getByText(/Mogrebi \(not included\)/)).toBeVisible();
  });

  it("focuses the selected detail when keyboard activation follows search auto-selection", async () => {
    const user = userEvent.setup();
    render(<SkillReferenceContent />);
    await openMedicine(user);
    await user.type(screen.getByRole("textbox", { name: "Search Skills" }), "Surgery");
    const link = within(skillList()).getByText("Surgery").closest("a")!;
    link.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("heading", { name: "Surgery" })).toHaveFocus();
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
