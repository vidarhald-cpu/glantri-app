import { createHash } from "node:crypto";

import { describe, expect, it } from "vitest";

import { getCompetencyV2ReferenceSource } from "../../competencyV2Reference";
import { getApprovedV2RuntimeContent } from "../../targetCompetencies";
import {
  competencyContentV2Catalogue,
  competencyContentV2Families,
  competencyContentV2FamilyReaderProse,
  competencyContentV2GroupReaderProse,
  competencyContentV2GroupsAwaitingReaderProse,
  competencyContentV2GroupsWithSupersededSourceProse,
  competencyContentV2LearningGroups,
  competencyContentV2ReaderProseCoverage,
  competencyContentV2RemovedGroups,
} from "./index";

/**
 * Forgejo #361 — reader-content publication; Forgejo #396 — closing the 51-group gap.
 *
 * These are identity assertions, not count assertions: a count that still matches while the
 * identities have drifted is exactly the failure the inventory was asked to rule out.
 */
describe("Competency Content V2 reader prose", () => {
  it("publishes accepted prose for every one of the 84 canonical Profession families", () => {
    expect(competencyContentV2Families).toHaveLength(84);
    const missing = competencyContentV2Families
      .filter((family) => !competencyContentV2FamilyReaderProse[family.code])
      .map((family) => family.code);
    expect(missing).toEqual([]);
    expect(competencyContentV2ReaderProseCoverage.families).toEqual({
      canonical: 84,
      published: 84,
      awaiting: 0,
    });
  });

  it("gives every published record a full description distinct from its short description", () => {
    const records = [
      ...Object.entries(competencyContentV2GroupReaderProse),
      ...Object.entries(competencyContentV2FamilyReaderProse),
    ];
    expect(records.length).toBe(95 + 84);
    for (const [key, prose] of records) {
      expect(prose.shortDescription.trim().length, key).toBeGreaterThan(0);
      expect(prose.fullDescription.trim().length, key).toBeGreaterThan(
        prose.shortDescription.trim().length,
      );
      expect(prose.fullDescription.trim(), key).not.toBe(prose.shortDescription.trim());
    }
  });

  it("gives every Profession family typical activities and a boundaries statement", () => {
    for (const family of competencyContentV2Families) {
      const prose = competencyContentV2FamilyReaderProse[family.code]!;
      expect(prose.typicalActivities?.length, family.code).toBeGreaterThan(0);
      expect(prose.boundaries?.length, family.code).toBeGreaterThan(0);
    }
  });

  it("publishes accepted prose for every canonical Learning Group, leaving nothing returned", () => {
    expect(competencyContentV2LearningGroups).toHaveLength(95);
    expect(competencyContentV2ReaderProseCoverage.groups).toEqual({
      canonical: 95,
      published: 95,
      awaiting: 0,
    });
    expect(competencyContentV2GroupsAwaitingReaderProse).toEqual([]);
    /* The gap #396 closed was the 49 groups V2 authored after the earlier accepted documents,
       plus the 2 it outgrew. All 51 now come from the 2026-09-26 accepted document. */
    const fromNewDocument = competencyContentV2LearningGroups.filter(
      (group) =>
        competencyContentV2GroupReaderProse[group.id]!.source === "v2-learning-group-prose",
    );
    expect(fromNewDocument).toHaveLength(51);
    const byDisposition = fromNewDocument.reduce<Record<string, number>>(
      (acc, group) => ({ ...acc, [group.disposition]: (acc[group.disposition] ?? 0) + 1 }),
      {},
    );
    expect(byDisposition).toEqual({ new: 49, revised: 2 });
    /* The two whose earlier page was outgrown are read from the newer document, never from it. */
    expect(competencyContentV2GroupsWithSupersededSourceProse.map((row) => row.id)).toEqual([
      "F04",
      "F09",
    ]);
    for (const row of competencyContentV2GroupsWithSupersededSourceProse)
      expect(competencyContentV2GroupReaderProse[row.id]!.source, row.id).toBe(
        "v2-learning-group-prose",
      );
  });

  it("keeps F30 and F41 on their martial-revision prose, current with rule decision 0010", () => {
    /*
     * Forgejo #389 made Fencing and Longbow base Skills and #396 verified rather than rewrote
     * these two: neither was part of the published gap, and both already say what the ruling says.
     */
    const f30 = competencyContentV2GroupReaderProse.F30!;
    const f41 = competencyContentV2GroupReaderProse.F41!;
    expect(f30.source).toBe("martial-revision");
    expect(f41.source).toBe("martial-revision");
    expect(f30.fullDescription).toContain(
      "Fencing is the weapon competence this course teaches, and it is charged once",
    );
    expect(f41.fullDescription).toContain(
      "Longbow is the weapon competence this course teaches, and it is charged once",
    );
  });

  it("names the longbow in the M04 and M05 slots #389 added it to", () => {
    /*
     * The 51 pages were authored on 2026-09-26, before #389 widened both missile candidate pools.
     * Publication corrected exactly those two sentences and nothing else.
     *
     * Forgejo #744 re-sited the mention. It used to sit in a trailing `What it teaches.`
     * accounting paragraph — the fourth of these two records, and the last two such paragraphs
     * left in the 95 after #718 — which was the only place either record named the longbow. The
     * substance assertion below therefore passed only because that paragraph existed. The mention
     * now sits in each record's ordinary scope prose, and the two assertions that follow it make
     * the test say so: the longbow may be named in any paragraph, but it must be named by ordinary
     * prose, and no reinstated accounting paragraph may supply it. Nothing was relaxed — both
     * original assertions are kept verbatim, so anything the old test rejected this one rejects.
     */
    for (const id of ["M04", "M05"]) {
      const group = competencyContentV2LearningGroups.find((row) => row.id === id)!;
      const candidates = group.selectionSlots![0]!.candidateSkillIds;
      expect(candidates, id).toContain("longbow");
      const fullDescription = competencyContentV2GroupReaderProse[id]!.fullDescription;
      expect(fullDescription, id).toContain("the longbow");
      /* Position-independent: whichever paragraph carries the mention, it is ordinary prose. */
      const paragraphs = fullDescription.split("\n\n");
      const carriers = paragraphs.filter((paragraph) => paragraph.includes("the longbow"));
      expect(carriers.length, id).toBeGreaterThan(0);
      for (const carrier of carriers) expect(carrier.startsWith("What it teaches"), id).toBe(false);
      const accounting = paragraphs.filter((paragraph) => paragraph.startsWith("What it teaches"));
      expect(accounting, id).toEqual([]);
    }
  });

  it("never publishes prose for a group the V2 redesign removed", () => {
    /*
     * The accepted group documents carry 59 pages, 13 of which describe removed groups. They are
     * accepted, digested and prose-complete, which is exactly why publication must filter on
     * canonical identity rather than on the existence of an accepted page.
     */
    expect(competencyContentV2RemovedGroups).toHaveLength(13);
    const canonicalIds = new Set(competencyContentV2LearningGroups.map((group) => group.id));
    for (const removed of competencyContentV2RemovedGroups) {
      expect(canonicalIds.has(removed.id), removed.id).toBe(false);
      expect(competencyContentV2GroupReaderProse[removed.id], removed.id).toBeUndefined();
    }
    const content = getApprovedV2RuntimeContent();
    expect(content.skillGroups.some((group) => group.id === "G08")).toBe(false);
  });

  it("never publishes a catalogue authoring note as reader prose", () => {
    const notes = new Set(
      [
        ...competencyContentV2Families.map((family) => family.note),
        ...competencyContentV2LearningGroups.map((group) => group.note),
      ].filter((note): note is string => Boolean(note)),
    );
    expect(notes.size).toBeGreaterThan(0);
    const content = getApprovedV2RuntimeContent();
    for (const family of content.professionFamilies) {
      expect(notes.has(family.description ?? "")).toBe(false);
      expect(notes.has(family.fullDescription ?? "")).toBe(false);
    }
    for (const profession of content.professions) {
      expect(notes.has(profession.description ?? "")).toBe(false);
      expect(notes.has(profession.fullDescription ?? "")).toBe(false);
    }
    for (const group of content.skillGroups) {
      expect(notes.has(group.fullDescription ?? "")).toBe(false);
    }
  });

  it("publishes the reader fields into canonical V2 runtime content", () => {
    const content = getApprovedV2RuntimeContent();
    expect(content.professionFamilies).toHaveLength(84);
    for (const family of content.professionFamilies) {
      expect(family.shortDescription, family.id).toBeTruthy();
      expect(family.fullDescription, family.id).toBeTruthy();
      expect(family.fullDescription, family.id).not.toBe(family.shortDescription);
      expect(family.typicalActivities?.length, family.id).toBeGreaterThan(0);
    }
    for (const profession of content.professions) {
      expect(profession.fullDescription, profession.id).toBeTruthy();
    }
    const groupsWithProse = content.skillGroups.filter((group) => group.fullDescription);
    expect(groupsWithProse).toHaveLength(95);
    for (const group of content.skillGroups) {
      expect(group.shortDescription, group.id).toBeTruthy();
      if (group.fullDescription) expect(group.fullDescription).not.toBe(group.shortDescription);
    }
  });

  it("surfaces the reader-content shape on the reference source without changing the established keys", () => {
    const source = getCompetencyV2ReferenceSource();
    const group = source.groups.find((row) => row.id === "G01")!;
    /* The established one-line key keeps its meaning. */
    expect(group.description).toBe(
      "Assessment, immediate help and continuing care under an experienced practitioner.",
    );
    expect(group.readerContent.shortDescription).toBeTruthy();
    expect(group.readerContent.description).toContain("accompany a practitioner");
    expect(group.readerContent.boundaries?.length).toBeGreaterThan(0);

    /* Every canonical group now carries both layers; nothing falls back to a bare summary. */
    for (const row of source.groups) {
      expect(row.readerContent.shortDescription, row.id).toBeTruthy();
      expect(row.readerContent.description, row.id).toBeTruthy();
      expect(row.readerContent.description, row.id).not.toBe(row.readerContent.shortDescription);
    }

    const family = source.families.find((row) => row.code === "P01")!;
    expect(family.readerContent.description).toContain("accompany experienced hunters");
    expect(family.readerContent.typicalActivities?.length).toBeGreaterThan(0);
    expect(source.readerContentCoverage.groups.awaiting).toBe(0);
    expect(source.readerContentCoverage.groupsAwaitingProse).toEqual([]);
    expect(source.professions.every((row) => row.readerContent.description)).toBe(true);
  });

  it("leaves the canonical catalogue digest untouched, so publication is additive by construction", () => {
    expect(competencyContentV2Catalogue.manifest.digest).toBe(
      getApprovedV2RuntimeContent().competencyV2!.sourceDigest,
    );
    /* The catalogue's own group records carry no reader prose: the layer sits beside them. */
    for (const group of competencyContentV2Catalogue.groups) {
      expect(Object.keys(group)).not.toContain("fullDescription");
    }
  });

  /**
   * Forgejo #745 — the instrument that makes a paragraph-boundary editorial lane provable.
   *
   * #745 permits exactly one kind of edit to the Learning Group prose above: the insertion or
   * removal of a `\n\n` paragraph boundary. The standard it is verified against is that the prose
   * with its paragraph whitespace normalized must be textually identical before and after. This
   * digest IS that standard, recorded. It is taken over all 95 records' full descriptions with
   * every whitespace run collapsed to a single space, so adding or removing a paragraph boundary
   * does not move it, while one changed word, one reordered sentence or one dropped clause does.
   *
   * Measured at `233b39c6` — the text as #396, #718 and #744 left it — and unchanged at #745's
   * head, which is what proves #745 changed paragraph boundaries and nothing else.
   *
   * This is deliberately not a floor and not a count. A later lane authorized to actually reword
   * an entry re-measures this value as part of that change and records the authority here; a lane
   * that was only supposed to re-paragraph and moves it has exceeded its contract.
   */
  it("keeps the whitespace-normalized Learning Group prose textually identical", () => {
    const ids = Object.keys(competencyContentV2GroupReaderProse).sort();
    expect(ids).toHaveLength(95);
    const normalized = ids.map((id) => {
      const prose = competencyContentV2GroupReaderProse[id]!.fullDescription;
      return `${id}\u0000${prose.replace(/\s+/g, " ").trim()}`;
    });
    const digest = createHash("sha256").update(normalized.join("\u0001"), "utf8").digest("hex");
    expect(digest).toBe("485e42af595f0ccc905ae80c444e5218e8993f02113c2241ec74d90c1e35cd9e");
  });
});
