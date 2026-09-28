import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { buildSkillReferenceModel } from "@/lib/skills/skillReferenceModel";
import {
  LearningGroupProse,
  LearningGroupTraining,
  ProfessionExplanation,
  ProfessionTrainingOverview,
} from "./ProfessionTraining";

/**
 * Acceptance for the Chargen Profession presentation contract (Forgejo #372 sections 1, 2 and 0.6).
 *
 * Built on the live canonical V2 projection, which is the same construction Chargen loads and the
 * same one `/skills` renders. Nothing here is a synthetic catalogue: the 59-group accessor is not
 * what any Chargen path loads, and a claim about player-facing behaviour built on it proves
 * nothing (`docs/testing-regression-matrix.md`).
 */
const model = buildSkillReferenceModel();
const thief = model.professions.find((row) => row.id === "profession:thief")!;

/** Forbidden as headline or primary player-facing language by #372 section 1. */
const FORBIDDEN_LABELS = [
  "Core reach",
  "Favored reach",
  "Included training packages",
  "Special access",
  "Choice slots",
];

/** Rules-engine vocabulary the experience contract section 2 forbids in player-facing text. */
const FORBIDDEN_IMPLEMENTATION_WORDS = [
  "bundle",
  "marginal",
  "useful increment",
  "relationship floor",
  "recompute",
  "suppressed",
  "coefficient",
  "refund",
  "choice slot",
  "dynamicGroupCost",
];

afterEach(cleanup);

describe("Chargen Profession presentation", () => {
  it("explains the occupation before it names any training", () => {
    const { container } = render(<ProfessionExplanation profession={thief} />);

    expect(screen.getByText(/What a practitioner does/)).toBeInTheDocument();
    expect(container.textContent).toContain(thief.readerContent.shortDescription);
    expect(container.textContent).toContain(thief.readerContent.description);
    /* The explanation is prose about the occupation, not a restatement of its training graph. */
    expect(container.textContent).not.toMatch(/Teaches /);
  });

  it("uses no forbidden or implementation-derived label anywhere in the presentation", () => {
    const { container } = render(
      <>
        <ProfessionExplanation profession={thief} />
        <ProfessionTrainingOverview model={model} profession={thief} />
      </>,
    );
    const text = container.textContent ?? "";

    for (const label of FORBIDDEN_LABELS) expect(text, label).not.toContain(label);
    for (const word of FORBIDDEN_IMPLEMENTATION_WORDS)
      expect(text.toLowerCase(), word).not.toContain(word.toLowerCase());
  });

  it("summarises everything the Profession can train without expanding a single route", () => {
    const { container } = render(<ProfessionTrainingOverview model={model} profession={thief} />);

    expect(screen.getByText(/What can I learn\?/)).toBeInTheDocument();
    const summary = screen.getByText(/Everything this Profession can train/);
    expect(summary.textContent).toContain("Everything this Profession can train — ");
    /* The deduplicated reachable list is the whole point: a player must not have to open every
       Learning Group by hand to discover what a Profession teaches. */
    const names = new Set(
      [...container.querySelectorAll("li")].map((item) => item.textContent ?? ""),
    );
    expect(names.size).toBeGreaterThan(0);
    expect(container.textContent).toContain("possibly touch rather than what one practitioner");
  });

  it("orders training narratively and puts direct training after the grouped routes", () => {
    const { container } = render(<ProfessionTrainingOverview model={model} profession={thief} />);
    const text = container.textContent ?? "";

    expect(text).toContain("Ordinary training");
    expect(text).toContain("Direct training");
    expect(text.indexOf("Ordinary training")).toBeLessThan(text.indexOf("Direct training"));
    if (text.includes("Additional training"))
      expect(text.indexOf("Additional training")).toBeLessThan(text.indexOf("Direct training"));
  });

  it("shows a route's Specializations inside that route rather than in a detached list", () => {
    const { container } = render(<ProfessionTrainingOverview model={model} profession={thief} />);
    const routeItems = [...container.querySelectorAll("li")].filter((item) =>
      (item.textContent ?? "").includes("Opens "),
    );

    expect(routeItems.length).toBeGreaterThan(0);
    for (const item of routeItems) {
      /* Each mention sits in the same list item as the route or Group that grants the access. */
      expect(item.textContent).toMatch(/acquired separately/);
      expect(item.textContent).toMatch(/parent Skill must be far enough along/);
    }
  });

  it("leaves no canonical Learning Group without a published full description", () => {
    /* #396 published the 51 that were awaiting; the honest-absence note now has no subject. */
    expect(model.readerContentCoverage.groupsAwaitingProse).toEqual([]);
    expect(model.readerContentCoverage.groups.awaiting).toBe(0);
    for (const group of model.learningGroups)
      expect(group.readerContent.description, group.id).toBeTruthy();
  });

  it.each(["K18", "K07"])(
    "shows full prose for %s, which used to say it was not yet described",
    (groupId) => {
      const group = model.learningGroups.find((row) => row.id === groupId)!;
      expect(group.readerContent.description).toBeDefined();

      const { container } = render(<LearningGroupTraining groupId={groupId} model={model} />);

      expect(container.textContent).toContain(group.readerContent.description);
      expect(screen.queryByText(/Not yet described in full/)).toBeNull();
    },
  );

  it.each(["G15", "F14"])(
    "leaves the already-published %s unaffected, with no absence note",
    (groupId) => {
      const group = model.learningGroups.find((row) => row.id === groupId)!;
      expect(group.readerContent.description).toBeDefined();

      const { container } = render(<LearningGroupTraining groupId={groupId} model={model} />);

      expect(container.textContent).toContain(group.readerContent.description);
      expect(screen.queryByText(/Not yet described in full/)).toBeNull();
    },
  );

  it("publishes the approved sixteen browsing categories, and nothing else", () => {
    expect(model.professionCategories).toHaveLength(16);
    expect(model.professionCategories.map((row) => row.name)).toContain("Covert and Illicit Work");
    expect(thief.browsingCategory?.name).toBe("Covert and Illicit Work");
    for (const profession of model.professions)
      expect(profession.browsingCategory, profession.id).toBeDefined();
  });

  it("never renders a canonical authoring note, for any Profession", async () => {
    /*
     * #361's QA found a canonical `note` — internal authoring provenance such as "SETTLED (#113).
     * The Profession-cores ruling fixes the core shape..." — rendered as the Profession description
     * in this very chooser, because a display path took whatever description field existed. Guard
     * the general shape: no authoring note, and no issue reference, reaches a player here.
     */
    const { competencyContentV2Families } = await import("@glantri/content");
    const notes = competencyContentV2Families.flatMap((family) =>
      family.note ? [family.note] : [],
    );
    expect(notes.length).toBeGreaterThan(0);

    for (const profession of model.professions) {
      const { container } = render(<ProfessionExplanation profession={profession} />);
      const text = container.textContent ?? "";
      for (const note of notes) expect(text, profession.id).not.toContain(note);
      expect(text, profession.id).not.toMatch(/\(#\d+\)|Forgejo|127\.0\.0\.1/);
      cleanup();
    }
  });
});

describe("Chargen and the reference share one Profession projection", () => {
  it("derives the same Skills for a Profession as the reference catalogue does", async () => {
    const { professionTraining } = await import("@/lib/skills/referenceCatalogue");
    const training = professionTraining(thief, model);
    const { container } = render(<ProfessionTrainingOverview model={model} profession={thief} />);
    const rendered = container.textContent ?? "";

    /* Rendering differs — the reference links, Chargen names in plain text — but the derivation is
       the one shared function, so every reachable competency it reports must appear. */
    for (const entry of training.reachable)
      expect(rendered, entry.link.id).toContain(entry.link.name);
    expect(rendered).toContain(String(training.possibleBaseSkillReach));
  });
});

/**
 * The Chargen honest-absence branch, retained by #396 and now without a canonical subject.
 *
 * `LearningGroupProse` keeps its "Not yet described in full" branch deliberately: it is the rule,
 * not a workaround for the publication gap that #396 closed, so a Group added later without prose
 * is still told honestly instead of having its one-line summary presented as the explanation. All
 * 95 canonical Groups now carry a description, so the branch can no longer be reached through real
 * content. It is exercised here on a canonical Group with its description withheld, so the
 * retained mechanism keeps its test rather than losing it with the gap.
 */
describe("a Learning Group published without a full description", () => {
  it("says so rather than presenting the short summary as the explanation", () => {
    const published = model.learningGroups.find((row) => row.id === "N01")!;
    const withheld = {
      ...published,
      readerContent: { ...published.readerContent, description: undefined },
    };

    const { container } = render(<LearningGroupProse group={withheld} />);

    expect(screen.getByText(/Not yet described in full/)).toBeVisible();
    expect(container.textContent).toContain(published.readerContent.shortDescription!);
    expect(container.textContent).not.toContain(published.readerContent.description!);
  });

  it("drops the note and shows the prose once the description is published", () => {
    const published = model.learningGroups.find((row) => row.id === "N01")!;

    const { container } = render(<LearningGroupProse group={published} />);

    expect(screen.queryByText(/Not yet described in full/)).toBeNull();
    expect(container.textContent).toContain(published.readerContent.description!);
  });
});
