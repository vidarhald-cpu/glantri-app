import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  buildSkillSystemAiExport,
  buildSkillSystemNote,
  writeSkillSystemAiExport,
} from "./exportSkillSystemForAi";

describe("skill-system AI export", () => {
  it("builds the required top-level sections", () => {
    const exported = buildSkillSystemAiExport({
      appCommit: "test-commit",
      generatedAt: "2026-05-11T00:00:00.000Z",
    });

    expect(exported).toHaveProperty("metadata");
    expect(exported).toHaveProperty("civilizations");
    expect(exported).toHaveProperty("societies");
    expect(exported).toHaveProperty("socialClasses");
    expect(exported).toHaveProperty("skills");
    expect(exported).toHaveProperty("skillGroups");
    expect(exported).toHaveProperty("specializations");
    expect(exported).toHaveProperty("professions");
    expect(exported).toHaveProperty("professionFamilies");
    expect(exported).toHaveProperty("professionPackages");
    expect(exported).toHaveProperty("availability");
    expect(exported).toHaveProperty("relationships");
    expect(exported).toHaveProperty("derivedRules");
    expect(exported).toHaveProperty("adminMetrics");
  });

  it("exports Longbow as a base combat Skill and not as a legacy missile slot candidate", () => {
    const exported = buildSkillSystemAiExport({
      appCommit: "test-commit",
      generatedAt: "2026-05-11T00:00:00.000Z",
    });
    const basicMissile = exported.skillGroups.find((item) => item.id === "basic_missile_training");

    /* Rule decision 0010 ruling 2: Longbow is a base combat Skill, so it is exported as a Skill and
       no longer as a Specialization of Bow. Ruling 5 deletes the bridge, so no access-note
       coefficient is exported for any Specialization either. */
    expect(exported.specializations.find((item) => item.id === "longbow")).toBeUndefined();
    expect(exported.skills.find((item) => item.id === "longbow")).toMatchObject({
      id: "longbow",
      name: "Longbow",
    });
    for (const specialization of exported.specializations)
      expect(specialization).not.toHaveProperty("accessNotes");
    expect(basicMissile?.selectionSlots.flatMap((slot) => slot.candidateSkillIds)).not.toContain(
      "longbow",
    );
  });

  it("includes admin metrics and the AI note guardrails", () => {
    const exported = buildSkillSystemAiExport({
      appCommit: "test-commit",
      generatedAt: "2026-05-11T00:00:00.000Z",
    });

    expect(exported.adminMetrics.groupWeightedValues.length).toBeGreaterThan(0);
    expect(exported.adminMetrics.professionReach.length).toBeGreaterThan(0);
    expect(buildSkillSystemNote()).toContain("Longbow is a base combat Skill");
    /* Issue #390 folded in: the note states the price rule decision 0011 records, and names the
       earlier group scalar only as retired. */
    expect(buildSkillSystemNote()).toContain("ceil(2/3");
    expect(buildSkillSystemNote()).toContain("Rule decision 0011 retired");
  });

  it("writes only the generated JSON and preserves durable documentation", () => {
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), "glantri-skill-export-"));
    const notePath = path.join(outputDir, "glantri-skill-system-note.md");
    const schemaPath = path.join(outputDir, "glantri-skill-system-schema.md");
    const note = "tracked regeneration instructions\n";
    const schema = "tracked schema notes\n";

    try {
      fs.writeFileSync(notePath, note, "utf8");
      fs.writeFileSync(schemaPath, schema, "utf8");

      const { exportPath } = writeSkillSystemAiExport(outputDir);

      expect(fs.existsSync(exportPath)).toBe(true);
      expect(fs.readFileSync(notePath, "utf8")).toBe(note);
      expect(fs.readFileSync(schemaPath, "utf8")).toBe(schema);
    } finally {
      fs.rmSync(outputDir, { recursive: true });
    }
  });
});
