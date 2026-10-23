import { describe, expect, it } from "vitest";
import { buildSkillReferenceModel } from "@/lib/skills/skillReferenceModel";
import { readerProse } from "./referenceCatalogue";

/**
 * Forgejo #743 — the invariant that makes `white-space: pre-line` on `.lede` and `.prose` safe.
 *
 * The authored Inspector prose stores its paragraph boundaries as blank lines. Before #743
 * `skillsReference.module.css` set no `white-space` on either class, so `normal` collapsed every
 * boundary and the authored structure reached the DOM but displayed as nothing at all. The fix is
 * presentation-only: `pre-line` on those two classes.
 *
 * `pre-line` preserves EVERY newline, not only blank lines, so it is only safe while no authored
 * string uses a single `\n` as source wrapping. It also preserves runs of spaces and leading and
 * trailing whitespace, where `normal` collapses them. These tests assert exactly those properties
 * over every string the two classes actually render, so a later authoring pass that introduces a
 * lone newline fails here rather than silently shipping a broken line break to readers.
 *
 * The two classes are NOT confined to the multi-paragraph description prose: they also carry frozen
 * catalogue information. That is why the no-op assertions below cover those fields by name.
 */

const model = buildSkillReferenceModel();

type Rendered = { site: string; id: string; text: string };

/** Every string rendered through `.lede`, per call site. */
function ledeStrings(): Rendered[] {
  const rows: Rendered[] = [];
  /* ReferenceInspectors.tsx — SkillInspector: the full authored Skill prose. */
  for (const skill of model.skills)
    rows.push({ site: "SkillInspector skill.description", id: skill.id, text: skill.description });
  /* ReferenceInspectors.tsx — SocietyInspector: frozen Society description. */
  for (const society of model.societies)
    rows.push({
      site: "SocietyInspector society.description",
      id: society.id,
      text: society.description,
    });
  /* ReferenceParts.tsx — ProseIntroduction summary, i.e. frozen `shortDescription`. */
  for (const group of model.learningGroups)
    rows.push({
      site: "ProseIntroduction prose.summary (Learning Group)",
      id: group.id,
      text: readerProse(group.readerContent, group.description).summary,
    });
  for (const profession of model.professions)
    rows.push({
      site: "ProseIntroduction prose.summary (Profession)",
      id: profession.id,
      text: readerProse(profession.readerContent, "").summary,
    });
  return rows;
}

/** Every string rendered through `.prose`, per call site. */
function proseStrings(): Rendered[] {
  const rows: Rendered[] = [];
  /* ReferenceParts.tsx — ProseIntroduction full description. */
  for (const group of model.learningGroups) {
    const full = readerProse(group.readerContent, group.description).full;
    if (full)
      rows.push({
        site: "ProseIntroduction prose.full (Learning Group)",
        id: group.id,
        text: full,
      });
  }
  for (const profession of model.professions) {
    const full = readerProse(profession.readerContent, "").full;
    if (full)
      rows.push({
        site: "ProseIntroduction prose.full (Profession)",
        id: profession.id,
        text: full,
      });
  }
  /* ReferenceInspectors.tsx — SocietyInspector Arch Society line: frozen description. */
  for (const society of model.societies)
    if (society.archSociety)
      rows.push({
        site: "SocietyInspector archSociety.description",
        id: society.id,
        text: society.archSociety.description,
      });
  return rows;
}

const allRendered = [...ledeStrings(), ...proseStrings()];

/** An `\n` that is not part of a `\n\n` paragraph boundary. `pre-line` would show it as a break. */
const LONE_NEWLINE = /(^|[^\n])\n(?!\n)/;

describe("#743 paragraph rendering — every authored newline is a paragraph boundary", () => {
  it("renders prose through exactly the two classes this lane measured", () => {
    expect(allRendered.length).toBeGreaterThan(0);
    expect(new Set(allRendered.map((row) => row.site)).size).toBe(7);
  });

  it("uses no single newline as source wrapping", () => {
    const offenders = allRendered
      .filter((row) => LONE_NEWLINE.test(row.text))
      .map((row) => `${row.site} :: ${row.id}`);
    expect(offenders).toEqual([]);
  });

  it("uses no blank-line run longer than one paragraph boundary", () => {
    const offenders = allRendered
      .filter((row) => /\n{3,}/.test(row.text))
      .map((row) => `${row.site} :: ${row.id}`);
    expect(offenders).toEqual([]);
  });

  it("carries no whitespace that pre-line would newly preserve", () => {
    /* `normal` collapses these; `pre-line` does not. None exist, so the change is invisible here. */
    const offenders = allRendered
      .filter((row) => / {2,}/.test(row.text) || /\r/.test(row.text) || /\t/.test(row.text))
      .map((row) => `${row.site} :: ${row.id}`);
    expect(offenders).toEqual([]);
    const edges = allRendered
      .filter((row) => /^\s/.test(row.text) || /\s$/.test(row.text))
      .map((row) => `${row.site} :: ${row.id}`);
    expect(edges).toEqual([]);
  });

  it("leaves the frozen catalogue fields newline-free, so pre-line is a no-op on them", () => {
    const frozen = allRendered.filter(
      (row) =>
        row.site.includes("prose.summary") ||
        row.site.includes("society.description") ||
        row.site.includes("archSociety.description"),
    );
    expect(frozen.length).toBeGreaterThan(0);
    expect(frozen.filter((row) => row.text.includes("\n")).map((row) => row.id)).toEqual([]);
  });

  it("still has authored paragraph boundaries for pre-line to expose", () => {
    const breaks = (rows: Rendered[]) =>
      rows.reduce((total, row) => total + (row.text.match(/\n\n/g)?.length ?? 0), 0);
    const skills = allRendered.filter((row) => row.site.startsWith("SkillInspector skill"));
    const groups = allRendered.filter((row) => row.site.includes("prose.full (Learning Group)"));
    const professions = allRendered.filter((row) => row.site.includes("prose.full (Profession)"));
    /* Floors, not exact counts, so any legitimate addition passes. They are deliberately
       maintained rather than monotonic: an editorial lane may also REMOVE a paragraph under an
       explicit ruling, and the floor is then lowered to the newly measured count in the same
       change. #744 was the first to do so — it struck the trailing accounting paragraph from M04
       and M05 on an accepted ruling, taking the Learning Group count from 194 to 192. So a number
       below the floor is a regression; a ruled reduction arrives as an edit to the floor itself,
       recorded here, and never as a failure.

       #745 then raised the Learning Group floor from 192 to 218 — the count measured at its head.
       It added 26 paragraph boundaries across 24 of the 95 records, inserting them where a
       paragraph ran two unrelated subjects together, and removed none. Its own instrument is the
       whitespace-normalized text digest in
       `packages/content/src/proposals/competencyContentV2/competencyContentV2ReaderProse.test.ts`,
       which holds the prose itself byte-identical while this floor records the new structure. */
    expect(breaks(skills)).toBeGreaterThanOrEqual(353);
    expect(breaks(groups)).toBeGreaterThanOrEqual(218);
    expect(breaks(professions)).toBeGreaterThanOrEqual(2);
  });
});
