import { describe, expect, it } from "vitest";
import { weaponTemplates } from "@glantri/content";

import {
  detectSnapshotSecondaryCriticalCodeGap,
  SNAPSHOT_SECONDARY_CRITICAL_WARNING_CODE,
  SNAPSHOT_SECONDARY_CRITICAL_WARNING_MESSAGE,
} from "./snapshotSecondaryCriticalWarning";

const GREAT_SWORD_TEMPLATE_ID = "weapon-template-great-sword";
const HEAVY_MACE_TEMPLATE_ID = "weapon-template-heavy-mace";
const MAIN_MODE_ID = "mode-1";

function canonicalTemplate(templateId: string): Record<string, unknown> {
  const template = weaponTemplates.find((candidate) => candidate.id === templateId);
  if (!template) throw new Error(`Missing canonical weapon template ${templateId}.`);
  return structuredClone(template) as unknown as Record<string, unknown>;
}

/**
 * A template snapshotted before the `secondCrit` enrichment: identical to the canonical row in
 * every other respect, with the `Sec` field simply not authored on the persisted copy.
 */
function staleSnapshotTemplate(templateId: string, secondCrit: unknown = undefined) {
  const template = canonicalTemplate(templateId);
  const attackModes = template["attackModes"] as Record<string, unknown>[];
  for (const mode of attackModes) {
    if (secondCrit === undefined) {
      delete mode["secondCrit"];
    } else {
      mode["secondCrit"] = secondCrit;
    }
  }
  return { [templateId]: template };
}

describe("snapshot Secondary Critical `Sec` code warning", () => {
  it("fires when the snapshot template lacks a `Sec` code the canonical catalogue authors", () => {
    const warning = detectSnapshotSecondaryCriticalCodeGap({
      attackModeId: MAIN_MODE_ID,
      participantId: "participant-1",
      snapshotTemplatesById: staleSnapshotTemplate(GREAT_SWORD_TEMPLATE_ID),
      weaponName: "Great sword",
      weaponTemplateId: GREAT_SWORD_TEMPLATE_ID,
    });

    expect(warning).toEqual({
      attackModeId: MAIN_MODE_ID,
      canonicalSecondaryCriticalCode: "DC",
      code: SNAPSHOT_SECONDARY_CRITICAL_WARNING_CODE,
      participantId: "participant-1",
      snapshotSecondaryCriticalCode: null,
      weaponName: "Great sword",
      weaponTemplateId: GREAT_SWORD_TEMPLATE_ID,
    });
  });

  it("does not fire for a current snapshot that carries the canonical `Sec` code", () => {
    const warning = detectSnapshotSecondaryCriticalCodeGap({
      attackModeId: MAIN_MODE_ID,
      participantId: "participant-1",
      snapshotTemplatesById: {
        [GREAT_SWORD_TEMPLATE_ID]: canonicalTemplate(GREAT_SWORD_TEMPLATE_ID),
      },
      weaponName: "Great sword",
      weaponTemplateId: GREAT_SWORD_TEMPLATE_ID,
    });

    expect(warning).toBeUndefined();
  });

  it("fires for every canonical `Sec` row when stale and for none of them when current", () => {
    const secRows = weaponTemplates.flatMap((template) =>
      (template.attackModes ?? [])
        .filter((mode) => typeof mode.secondCrit === "string" && mode.secondCrit.trim().length > 0)
        .map((mode) => ({ mode, template })),
    );
    expect(secRows).toHaveLength(12);

    const staleWarnings = secRows.map(({ mode, template }) =>
      detectSnapshotSecondaryCriticalCodeGap({
        attackModeId: mode.id,
        participantId: "participant-1",
        snapshotTemplatesById: staleSnapshotTemplate(template.id),
        weaponName: template.name,
        weaponTemplateId: template.id,
      }),
    );
    expect(staleWarnings.filter(Boolean)).toHaveLength(12);
    expect(staleWarnings.map((warning) => warning?.canonicalSecondaryCriticalCode)).toEqual([
      "AP",
      "AC",
      "AC",
      "CC",
      "DC",
      "DC",
      "AS",
      "AS",
      "BS",
      "DC",
      "DC",
      "DC",
    ]);

    const currentWarnings = secRows.map(({ mode, template }) =>
      detectSnapshotSecondaryCriticalCodeGap({
        attackModeId: mode.id,
        participantId: "participant-1",
        snapshotTemplatesById: { [template.id]: canonicalTemplate(template.id) },
        weaponName: template.name,
        weaponTemplateId: template.id,
      }),
    );
    expect(currentWarnings.filter(Boolean)).toHaveLength(0);
  });

  it("treats a null or whitespace-only snapshot value as lacking the code and reports it verbatim", () => {
    expect(
      detectSnapshotSecondaryCriticalCodeGap({
        attackModeId: MAIN_MODE_ID,
        participantId: "participant-1",
        snapshotTemplatesById: staleSnapshotTemplate(GREAT_SWORD_TEMPLATE_ID, null),
        weaponName: "Great sword",
        weaponTemplateId: GREAT_SWORD_TEMPLATE_ID,
      })?.snapshotSecondaryCriticalCode,
    ).toBeNull();

    expect(
      detectSnapshotSecondaryCriticalCodeGap({
        attackModeId: MAIN_MODE_ID,
        participantId: "participant-1",
        snapshotTemplatesById: staleSnapshotTemplate(GREAT_SWORD_TEMPLATE_ID, "   "),
        weaponName: "Great sword",
        weaponTemplateId: GREAT_SWORD_TEMPLATE_ID,
      })?.snapshotSecondaryCriticalCode,
    ).toBe("   ");
  });

  it("does not fire when the catalogue authors no `Sec` code — a blank is an authored absence", () => {
    expect(
      weaponTemplates
        .find((candidate) => candidate.id === HEAVY_MACE_TEMPLATE_ID)
        ?.attackModes?.find((mode) => mode.id === MAIN_MODE_ID)?.secondCrit ?? null,
    ).toBeNull();

    expect(
      detectSnapshotSecondaryCriticalCodeGap({
        attackModeId: MAIN_MODE_ID,
        participantId: "participant-1",
        snapshotTemplatesById: staleSnapshotTemplate(HEAVY_MACE_TEMPLATE_ID),
        weaponName: "Heavy mace",
        weaponTemplateId: HEAVY_MACE_TEMPLATE_ID,
      }),
    ).toBeUndefined();
  });

  it("does not fire for a mode the catalogue leaves without a `Sec` code on a `Sec`-bearing weapon", () => {
    const greatSword = weaponTemplates.find(
      (candidate) => candidate.id === GREAT_SWORD_TEMPLATE_ID,
    );
    const secondMode = greatSword?.attackModes?.find((mode) => mode.id === "mode-2");
    expect(secondMode?.secondCrit ?? null).toBeNull();

    expect(
      detectSnapshotSecondaryCriticalCodeGap({
        attackModeId: "mode-2",
        participantId: "participant-1",
        snapshotTemplatesById: staleSnapshotTemplate(GREAT_SWORD_TEMPLATE_ID),
        weaponName: "Great sword",
        weaponTemplateId: GREAT_SWORD_TEMPLATE_ID,
      }),
    ).toBeUndefined();
  });

  it("fails closed when there is nothing to compare", () => {
    // No canonical counterpart at all.
    expect(
      detectSnapshotSecondaryCriticalCodeGap({
        attackModeId: MAIN_MODE_ID,
        participantId: "participant-1",
        snapshotTemplatesById: {
          "campaign-authored-weapon": { attackModes: [{ id: MAIN_MODE_ID }] },
        },
        weaponName: "Campaign blade",
        weaponTemplateId: "campaign-authored-weapon",
      }),
    ).toBeUndefined();

    // No snapshot template, and no snapshot equipment state at all.
    expect(
      detectSnapshotSecondaryCriticalCodeGap({
        attackModeId: MAIN_MODE_ID,
        participantId: "participant-1",
        snapshotTemplatesById: {},
        weaponName: "Great sword",
        weaponTemplateId: GREAT_SWORD_TEMPLATE_ID,
      }),
    ).toBeUndefined();
    expect(
      detectSnapshotSecondaryCriticalCodeGap({
        attackModeId: MAIN_MODE_ID,
        participantId: "participant-1",
        snapshotTemplatesById: undefined,
        weaponName: "Great sword",
        weaponTemplateId: GREAT_SWORD_TEMPLATE_ID,
      }),
    ).toBeUndefined();

    // No weapon template identity on the declared opportunity.
    expect(
      detectSnapshotSecondaryCriticalCodeGap({
        attackModeId: MAIN_MODE_ID,
        participantId: "participant-1",
        snapshotTemplatesById: staleSnapshotTemplate(GREAT_SWORD_TEMPLATE_ID),
        weaponName: "Great sword",
        weaponTemplateId: undefined,
      }),
    ).toBeUndefined();

    // Snapshot template present but without the attack mode.
    expect(
      detectSnapshotSecondaryCriticalCodeGap({
        attackModeId: MAIN_MODE_ID,
        participantId: "participant-1",
        snapshotTemplatesById: { [GREAT_SWORD_TEMPLATE_ID]: { attackModes: [] } },
        weaponName: "Great sword",
        weaponTemplateId: GREAT_SWORD_TEMPLATE_ID,
      }),
    ).toBeUndefined();
  });

  it("reports snapshot staleness without claiming the Secondary Critical under-fires", () => {
    // The warning fires exactly when a canonical counterpart exists, which is exactly when
    // `getEquipmentItemTemplate` supplies the canonical `attackModes`. The emitted text must
    // therefore never assert that resolution is currently wrong.
    expect(SNAPSHOT_SECONDARY_CRITICAL_WARNING_MESSAGE).toMatch(/stale/i);
    expect(SNAPSHOT_SECONDARY_CRITICAL_WARNING_MESSAGE).toMatch(/refresh|reconcile/i);
    expect(SNAPSHOT_SECONDARY_CRITICAL_WARNING_MESSAGE).toContain("`Sec`");
    expect(SNAPSHOT_SECONDARY_CRITICAL_WARNING_MESSAGE).not.toMatch(/under-fire/i);
  });
});
