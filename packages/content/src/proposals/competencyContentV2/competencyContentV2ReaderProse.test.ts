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
 * Forgejo #361 — reader-content publication.
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
    expect(records.length).toBe(44 + 84);
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

  it("returns, rather than fabricates, the Learning Groups the accepted sources do not cover", () => {
    expect(competencyContentV2LearningGroups).toHaveLength(95);
    expect(competencyContentV2ReaderProseCoverage.groups).toEqual({
      canonical: 95,
      published: 44,
      awaiting: 51,
    });
    /* The gap is the 49 groups V2 authored after the accepted prose, plus the 2 it outgrew. */
    const awaitingByDisposition = competencyContentV2GroupsAwaitingReaderProse.reduce<
      Record<string, number>
    >((acc, group) => ({ ...acc, [group.disposition]: (acc[group.disposition] ?? 0) + 1 }), {});
    expect(awaitingByDisposition).toEqual({ new: 49, revised: 2 });
    expect(competencyContentV2GroupsWithSupersededSourceProse.map((row) => row.id)).toEqual([
      "F04",
      "F09",
    ]);
    /* Every group whose accepted page still matches canonical is published. */
    const unpublishedRetained = competencyContentV2LearningGroups
      .filter(
        (group) =>
          group.disposition === "retained" && !competencyContentV2GroupReaderProse[group.id],
      )
      .map((group) => group.id);
    expect(unpublishedRetained).toEqual([]);
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
    expect(groupsWithProse).toHaveLength(44);
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

    const awaiting = source.groups.find((row) => row.id === "M01")!;
    expect(awaiting.readerContent.description).toBeUndefined();
    expect(awaiting.readerContent.shortDescription).toBeUndefined();

    const family = source.families.find((row) => row.code === "P01")!;
    expect(family.readerContent.description).toContain("accompany experienced hunters");
    expect(family.readerContent.typicalActivities?.length).toBeGreaterThan(0);
    expect(source.readerContentCoverage.groups.awaiting).toBe(51);
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
});
