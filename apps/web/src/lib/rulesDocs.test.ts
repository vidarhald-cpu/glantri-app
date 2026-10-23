import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  expandStructuredRuleTableDirectives,
  getRulesDocumentEntryById,
  getRulesDocumentationPageModel,
  getRulesDocuments,
  resolveRulesDocumentLink,
  unregisteredRulesDocuments,
} from "./rulesDocs";

// Mirrors getRulesDocsDirectory() in ./rulesDocs so the test resolves the same tree the
// application reads, whether the suite runs from the repository root or from apps/web.
const rulesDocsDirectory =
  path.basename(process.cwd()) === "web" && path.basename(path.dirname(process.cwd())) === "apps"
    ? path.resolve(process.cwd(), "../../docs/rules")
    : path.resolve(process.cwd(), "docs/rules");

function listRulesMarkdownFiles(directory: string, prefix = ""): string[] {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? listRulesMarkdownFiles(path.join(directory, entry.name), `${prefix}${entry.name}/`)
        : entry.name.endsWith(".md")
          ? [`${prefix}${entry.name}`]
          : [],
    );
}

describe("rules documentation registry", () => {
  it("includes Character Sheet Calculations", () => {
    expect(getRulesDocuments()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "character-sheet-calculations.md",
          id: "character-sheet-calculations",
          section: "Character",
          title: "Character Sheet Calculations",
        }),
        expect.objectContaining({
          fileName: "chargen-calculations.md",
          id: "chargen-calculations",
          section: "Chargen",
          title: "Chargen Calculations",
        }),
        expect.objectContaining({
          fileName: "retained-character-ledger.md",
          id: "retained-character-ledger",
          section: "Character",
          title: "Retained Character Ledger and Headless Chargen",
        }),
        expect.objectContaining({
          fileName: "equipment-encumbrance-calculations.md",
          id: "equipment-encumbrance-calculations",
          section: "Equipment",
          title: "Equipment & Encumbrance Calculations",
        }),
        expect.objectContaining({
          fileName: "character-progression-calculations.md",
          id: "character-progression-calculations",
          section: "Character",
          title: "Character Progression Calculations",
        }),
        expect.objectContaining({
          fileName: "combat-loadout-calculations.md",
          id: "combat-loadout-calculations",
          section: "Combat / Equipment",
          title: "Equip Items Calculations",
        }),
        expect.objectContaining({
          fileName: "combat-to-hit.md",
          id: "combat-to-hit",
          section: "Combat",
          title: "Glantri Combat To Hit / Damage",
        }),
        expect.objectContaining({
          fileName: "combat-critical-effects.md",
          id: "combat-critical-effects",
          section: "Combat",
          title: "Glantri Critical Effects",
        }),
        expect.objectContaining({
          fileName: "combat-experience.md",
          id: "combat-experience",
          section: "Combat",
          title: "Combat Experience",
        }),
      ]),
    );
    expect(getRulesDocuments().map((document) => document.id)).not.toContain("combat-hit-location");
  });

  it("keeps the bounded Pilot references out of reader exposure", () => {
    const ids = getRulesDocuments().map((document) => document.id);

    expect(ids).not.toContain("pilot-skill-rules-v1");
    expect(ids).not.toContain("pilot-skill-content-release-v1");
    expect(unregisteredRulesDocuments["pilot-skill-rules-v1.md"]).toBe("historical");
    expect(unregisteredRulesDocuments["pilot-skill-content-release-v1.md"]).toBe("historical");
  });

  it("publishes Competency Rules as the current reader-facing Skill authority", () => {
    expect(getRulesDocuments()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fileName: "competency-rules.md",
          id: "competency-rules",
          section: "Skills",
          title: "Competency Rules",
        }),
      ]),
    );
    expect(unregisteredRulesDocuments).not.toHaveProperty("competency-rules.md");
  });

  it("publishes the audience-separated Parry and Criticals pages", () => {
    expect(getRulesDocuments()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ fileName: "player/parry.md", id: "player-parry" }),
        expect.objectContaining({ fileName: "gm/parry.md", id: "gm-parry" }),
        expect.objectContaining({ fileName: "gm/criticals.md", id: "gm-criticals" }),
      ]),
    );

    for (const fileName of ["player/parry.md", "gm/parry.md", "gm/criticals.md"]) {
      expect(unregisteredRulesDocuments).not.toHaveProperty(fileName);
    }
  });

  it("keeps the Parry internal notes and the compatibility index out of the reader route", () => {
    expect(unregisteredRulesDocuments["internal/parry-notes.md"]).toBe("internal");
    expect(unregisteredRulesDocuments["parry.md"]).toBe("index");

    const ids = getRulesDocuments().map((document) => document.id);
    expect(ids).not.toContain("parry");
    expect(ids).not.toContain("parry-notes");
  });

  it("leaves the unrouted pages Forgejo #620 does not cover unrouted", () => {
    // Their reader route is owned by the audience-taxonomy work (#589), not by this registration.
    for (const fileName of [
      "combat-declarations.md",
      "combat-distance.md",
      "observe-opponent.md",
      "offensive-parry.md",
    ]) {
      expect(unregisteredRulesDocuments[fileName]).toBe("unrouted");
    }
  });

  it("orders Chargen Calculations first", () => {
    expect(getRulesDocuments().map((document) => document.title)).toEqual([
      "Chargen Calculations",
      "Competency Rules",
      "Retained Character Ledger and Headless Chargen",
      "Character Sheet Calculations",
      "Character Progression Calculations",
      "Equipment & Encumbrance Calculations",
      "Equip Items Calculations",
      "Combat Round, Loadout and Actions",
      "Glantri Combat To Hit / Damage",
      "Glantri Critical Effects",
      "Combat Experience",
      "Parry — Player Rules",
      "Parry — GM Procedure",
      "Criticals — GM Value Reference",
      "Critical Table",
    ]);
  });

  it("defaults to Chargen Calculations", () => {
    expect(getRulesDocumentEntryById(undefined)).toMatchObject({
      id: "chargen-calculations",
      title: "Chargen Calculations",
    });
  });

  it("loads the retained Character ledger, Campaign, migration, snapshot, and privacy authority", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "retained-character-ledger",
    });

    expect(model.selectedDocument.markdown).toContain(
      "# Retained Character Ledger and Headless Chargen",
    );
    expect(model.selectedDocument.markdown).toContain("content-release:pilot-skills:1");
    expect(model.selectedDocument.markdown).toContain("effective Skill E = max(A, R)");
    expect(model.selectedDocument.markdown).toContain(
      "at most one current Campaign roster membership",
    );
    expect(model.selectedDocument.markdown).toContain("Migration preview is non-mutating");
    expect(model.selectedDocument.markdown).toContain("Teacher/contact identities");
  });

  it("loads the character progression document with roll and threshold content", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "character-progression-calculations",
    });

    expect(model.selectedDocument.title).toBe("Character Progression Calculations");
    expect(model.selectedDocument.markdown).toContain("# Character Progression Calculations");
    expect(model.selectedDocument.markdown).toContain(
      "Progression succeeds if final roll total >= threshold",
    );
    expect(model.selectedDocument.markdown).toContain(
      "Skill thresholds use XP, not Total skill level.",
    );
    expect(model.selectedDocument.markdown).toContain("Stat advancement is checks-only/deferred.");
  });

  it("loads the markdown title and formula text for the docs page", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "character-sheet-calculations",
    });

    expect(model.selectedDocument.title).toBe("Character Sheet Calculations");
    expect(model.selectedDocument.markdown).toContain("# Character Sheet Calculations");
    expect(model.selectedDocument.markdown).toContain("Rolled / base");
    expect(model.selectedDocument.markdown).toContain("Group XP");
    expect(model.selectedDocument.markdown).toContain("Skill XP");
    expect(model.selectedDocument.markdown).toContain(
      "Derived XP rules and skill relationships can be reviewed in Admin -> Skills.",
    );
    expect(model.selectedDocument.markdown).toContain("GM = trunc((Current - 11) / 2)");
    expect(model.selectedDocument.markdown).toContain(
      "Skill group cost = ceil(2/3 * weightedUseful)",
    );
    expect(model.selectedDocument.markdown).not.toContain(
      "Character Detail does not show Derived XP",
    );
  });

  it("loads the chargen document with profile and skill-point formulas", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "chargen-calculations",
    });

    expect(model.selectedDocument.title).toBe("Chargen Calculations");
    expect(model.selectedDocument.markdown).toContain("# Chargen Calculations");
    expect(model.selectedDocument.markdown).toContain("What you see in Chargen");
    expect(model.selectedDocument.markdown).toContain("Profile stats");
    expect(model.selectedDocument.markdown).toContain("4d6, drop the lowest die");
    expect(model.selectedDocument.markdown).toContain("Social class roll | `1d20`.");
    expect(model.selectedDocument.markdown).not.toContain("Best of two");
    expect(model.selectedDocument.markdown).toContain("Default value");
    expect(model.selectedDocument.markdown).not.toContain("Standard value");
    expect(model.selectedDocument.markdown).toContain(
      "Flexible points = floor((resolved INT + resolved LCK) * flexible point factor)",
    );
    expect(model.selectedDocument.markdown).toContain(
      "Skill group cost = ceil(2/3 * weightedUseful)",
    );
  });

  // Forgejo #609. The Chargen guide's walkthrough describes the wizard a player actually walks,
  // so these claims are pinned here: they would otherwise drift silently away from
  // ChargenWizardExperience.tsx and from reviewChargenDraft's blocking conditions.
  it("loads the Chargen walkthrough with the rendered step sequence and finalization gate", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "chargen-calculations",
    });

    expect(model.selectedDocument.markdown).toContain("Chargen is a ten-step wizard");
    expect(model.selectedDocument.markdown).toContain("`Step N of 10`");
    expect(model.selectedDocument.markdown).toContain("`9b. Specialization Table`");
    expect(model.selectedDocument.markdown).toContain(
      "render **inside** step `6. Skill allocation`",
    );
    expect(model.selectedDocument.markdown).toContain("### Profession core routes");
    expect(model.selectedDocument.markdown).toContain(
      "one applicable Profession core route is selected",
    );
    // Pilot v1 is historical provenance, not current reader authority (#620 ruling).
    expect(model.selectedDocument.markdown).not.toContain("pilot-skill-rules-v1.md");
    // Superseded by the Product Owner ruling of 2026-09-29 recorded in competency-rules.md.
    expect(model.selectedDocument.markdown).not.toContain("are likewise mutually exclusive");
  });

  it("loads the Combat Experience document with current result bands", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "combat-experience",
    });

    expect(model.selectedDocument.title).toBe("Combat Experience");
    expect(model.selectedDocument.markdown).toContain("# Combat Experience");
    expect(model.selectedDocument.markdown).toContain("Default difficulty: `26`");
    expect(model.selectedDocument.markdown).toContain("Effective table total");
    expect(model.selectedDocument.markdown).toContain("`<= 5`");
    expect(model.selectedDocument.markdown).toContain("Panic");
    expect(model.selectedDocument.markdown).toContain("`-4`");
    expect(model.selectedDocument.markdown).toContain("does not restrict player action dropdowns");
    // Forgejo #651, item 1: the scheduled recurrence was implemented and could affect play while
    // combat-round-and-actions.md told the reader a check falls due "by schedule" and no page said
    // what the schedule was. The published cells are bound to
    // getCombatExperienceNextCheckRoundNumber in
    // apps/web/app/(app)/admin/rules-docs/rulesDocsConformance.test.ts; these pins keep the
    // section, its heading id and the two claims that are prose rather than cells.
    expect(model.selectedDocument.markdown).toContain("## When The Next Check Is Due");
    expect(model.selectedDocument.markdown).toContain("| Result rolled in round | Duration");
    const combatExperienceFlowed = model.selectedDocument.markdown.replace(/\s+/g, " ");
    expect(combatExperienceFlowed).toContain(
      "An Active `21+` result has no duration, so it schedules no next check and never becomes due by schedule.",
    );
    // The exclusivity sentence between those two pins was the one claim in this section that no
    // assertion held, and it reached CI green stating that only a Critical-triggered reset asks a
    // `21+` participant for Combat Experience again. A phase attack asks whatever band the current
    // result is in, so the sentence is pinned in two halves: the scope of the exclusivity, and the
    // phase-attack carve-out with the cross-reference that keeps it consistent with the Phase
    // Attack Rolls section on the same page.
    expect(combatExperienceFlowed).toContain(
      "While a participant is on a `21+` result, only a Critical-triggered reset brings the scheduled check back. That exclusivity is about the schedule alone.",
    );
    expect(combatExperienceFlowed).toContain(
      "a participant on a `21+` result must still resolve Combat Experience whenever the [Phase Attack Rolls](#phase-attack-rolls) conditions are met.",
    );
    expect(combatExperienceFlowed).toContain(
      "Being due is not the same as expiring. The result that is running stays active until the fresh roll replaces it",
    );
  });

  it("loads the equipment encumbrance document with location and formula content", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "equipment-encumbrance-calculations",
    });

    expect(model.selectedDocument.title).toBe("Equipment & Encumbrance Calculations");
    expect(model.selectedDocument.markdown).toContain("# Equipment & Encumbrance Calculations");
    expect(model.selectedDocument.markdown).toContain(
      "Effective item ENC = base ENC * quantity * material factor * quality factor * carry factor",
    );
    expect(model.selectedDocument.markdown).toContain("Carry state");
    expect(model.selectedDocument.markdown).toContain(
      "Mount-carried ENC = sum(base ENC of mount-carried items)",
    );
  });

  it("loads the Equip Items document with weapon and defense formulas", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "combat-loadout-calculations",
    });

    expect(model.selectedDocument.title).toBe("Equip Items Calculations");
    expect(model.selectedDocument.markdown).toContain("# Equip Items Calculations");
    expect(model.selectedDocument.markdown).toContain("Raw melee OB");
    expect(model.selectedDocument.markdown).toContain("Base DB");
    expect(model.selectedDocument.markdown).toContain("Combined parry modifier");
    expect(model.selectedDocument.markdown).toContain("GMR");
  });

  it("loads the Combat Round, Loadout and Actions guide with its load-bearing runtime facts", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "combat-round-and-actions",
    });

    expect(model.selectedDocument.title).toBe("Combat Round, Loadout and Actions");
    expect(model.selectedDocument.markdown).toContain("# Combat Round, Loadout and Actions");
    // Declaration is explicit (#575/#583/#591): an attacking phase without a source is refused.
    expect(model.selectedDocument.markdown).toContain("**You choose it explicitly.**");
    expect(model.selectedDocument.markdown).toContain("Phase 1 attack source is required.");
    // Punch and Kick are intrinsic and need no Item instance (#590).
    expect(model.selectedDocument.markdown).toContain("`Punch · Unarmed`");
    expect(model.selectedDocument.markdown).toContain("`Kick · Unarmed`");
    expect(model.selectedDocument.markdown).toContain("they need **no Item\nat all**");
    expect(model.selectedDocument.markdown).toContain("**Brawling**");
    // Counterattack is not declarable, and the generic Other action is not offered.
    expect(model.selectedDocument.markdown).toContain(
      "**Counterattack cannot currently be declared.**",
    );
    // Item interactions and canonical Disarm need a current equipment projection (#599).
    expect(model.selectedDocument.markdown).toContain(
      "The GM must reconcile it before dependent play can\ncontinue.",
    );
    // Verified runtime values, not hand-evaluated: distance penalty, Disarm and Break Off bands.
    expect(model.selectedDocument.markdown).toContain(
      "**−2 per step away from the nearest preferred distance.**",
    );
    // Cell padding is Prettier's, so the band boundary is pinned without the surrounding spaces.
    expect(model.selectedDocument.markdown).toMatch(
      /\| 16 or more +\| Disarmed and Unbalanced \(1 round\) +\|/,
    );
    expect(model.selectedDocument.markdown).toMatch(
      /\| \+21 or more +\| You break off; attacker OB −4% +\|/,
    );
    expect(model.selectedDocument.markdown).toMatch(/\| −10 to 0 +\| Attack continues +\|/);
    // The armor critical modifier is subtracted; this page must never reintroduce the add-form.
    expect(model.selectedDocument.markdown).not.toContain("+ armor critical modifier");
  });

  it("loads the Glantri Combat To Hit / Damage document with roll and damage-scope notes", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "combat-to-hit",
    });

    expect(model.selectedDocument.title).toBe("Glantri Combat To Hit / Damage");
    expect(model.selectedDocument.markdown).toContain("# Glantri Combat To Hit / Damage");
    expect(model.selectedDocument.markdown).toContain("Roll open-ended `1d20`");
    expect(model.selectedDocument.markdown).toContain(
      "hit lookup total = OB - DB + open-ended roll total",
    );
    expect(model.selectedDocument.markdown).toContain("Lookup total `11` is a grazing hit.");
    expect(model.selectedDocument.markdown).toContain(
      "Damage metadata is available for hits and grazing hits.",
    );
    expect(model.selectedDocument.markdown).toContain("Lookup totals `17` and `18` are resolved");
    expect(model.selectedDocument.markdown).toContain(
      "Lookup totals above the displayed table continue",
    );
    expect(model.selectedDocument.markdown).toContain(
      "damage lookup total = hit lookup total + weapon DMB + defender DM",
    );
    expect(model.selectedDocument.markdown).toContain("damage lookup is `14 + 8 + 0 = 22`");
    expect(model.selectedDocument.markdown).toContain(
      "Armor is applied after the table row is read.",
    );
    expect(model.selectedDocument.markdown).toContain("the grazing hit rolls `1d7`");
    expect(model.selectedDocument.markdown).toContain("damage result proposal");
    expect(model.selectedDocument.markdown).toContain("Commit phase damage");
    expect(model.selectedDocument.markdown).toContain("one active physical damage effect row");
    // Forgejo #611: this page claimed Critical effects were unimplemented long after they were.
    // Committing a Critical that carries a representative C1 fixture writes `c1-*` combat-effect
    // rows (`buildCombatRoundDamageCommitRows` in
    // packages/domain/src/encounter/combatRoundManager.ts), so the page now states the real,
    // bounded behaviour and must not revert to the stale claim.
    //
    // The first repair of that claim then overshot in the other direction, saying the rows were
    // created for the five C1-active review keys only and that every other Critical result
    // "creates no rows". The row gate is `criticalRuntime` being defined, which
    // `buildRepresentativeCriticalRuntimeDefinition` returns for *any* key carrying a fixture; the
    // five-key set gates the structured GM adjudication, not row creation. Both the understating
    // and the overstating forms are guarded below, and
    // apps/web/app/(app)/admin/rules-docs/rulesDocsConformance.test.ts binds the published counts
    // to the application's own fixture and five-key sets so neither number can drift unguarded.
    expect(model.selectedDocument.markdown).toContain(
      "Critical-effect automation is bounded rather than absent",
    );
    expect(model.selectedDocument.markdown).toContain(
      "are created as source-linked\ncombat-effect rows when the damage proposal is committed",
    );
    // Forgejo #651 moved the counts to combat-critical-effects.md, so this page states the
    // boundary without them and references the section that owns it. The counts themselves stay
    // bound in rulesDocsConformance.test.ts, which now also requires that this page carry none.
    // Pinned against the whitespace-collapsed copy below, not the raw wrapping.
    expect(model.selectedDocument.markdown).toContain(
      "./combat-critical-effects.md#c1-representative-fixture-authority",
    );
    expect(model.selectedDocument.markdown).not.toContain("critical effects remain a GM");
    expect(model.selectedDocument.markdown).not.toContain(
      "does not create automated\ncritical-effect rows",
    );
    expect(model.selectedDocument.markdown).not.toContain(
      "until the critical effect table is\nimplemented",
    );
    // The stale-claim guards above pin the exact line wrapping the page happens to have, so a
    // reflowed reintroduction would slip past them. Re-check every one against a
    // whitespace-collapsed copy of the same Markdown, and add the overstating forms this page
    // carried between Forgejo #611's first attempt and its repair.
    const flowed = model.selectedDocument.markdown.replace(/\s+/g, " ");
    for (const staleClaim of [
      "critical effects remain a GM",
      "does not create automated critical-effect rows",
      "until the critical effect table is implemented",
      "the five C1-active Critical keys resolve through a structured canonical review",
      "Remaining Critical results stay on the legacy GM-note path",
      "For every other Critical result the stored roll remains a GM review note and creates no rows",
      "For a C1-active Critical key the stored critical roll resolves a structured canonical review",
    ]) {
      expect(flowed).not.toContain(staleClaim);
    }
    // The boundary statement Forgejo #651 left on this page: the mechanism, with the counts moved
    // to the authority section it now links to.
    expect(flowed).toContain(
      "the structured GM adjudication over those atoms is available for the C1-active review keys only",
    );
    // The runtime subtracts the armor critical modifier (packages/domain critical.ts, the combat
    // round manager, and docs/rules/gm/criticals.md). This page said "+" until Forgejo #620.
    expect(model.selectedDocument.markdown).toContain(
      "`2d8 + critical type\nmodifier - armor critical modifier`",
    );
    expect(model.selectedDocument.markdown).not.toContain("+ armor critical modifier");
    expect(model.selectedDocument.markdown).not.toContain("New Combat Arena.xlsx");
    expect(model.selectedDocument.markdown).not.toContain("Sheet: `to hit (new)`");
    expect(model.selectedDocument.markdown).not.toContain("| Lookup total |");
  });

  it("loads the Glantri Critical Effects document with table-driven integration notes", async () => {
    const model = await getRulesDocumentationPageModel({
      selectedDocumentId: "combat-critical-effects",
    });

    expect(model.selectedDocument.title).toBe("Glantri Critical Effects");
    expect(model.selectedDocument.markdown).toContain("# Glantri Critical Effects");
    expect(model.selectedDocument.markdown).toContain("GM-reviewable proposals");
    expect(model.selectedDocument.markdown).toContain("Critical family");
    expect(model.selectedDocument.markdown).toContain("Critical index from `1` through `16`");
    expect(model.selectedDocument.markdown).toContain("app rolls those table-contained dice");
    expect(model.selectedDocument.markdown).toContain(
      "shown as proposal warnings rather than guessed",
    );
    expect(model.selectedDocument.markdown).toContain("minimum total damage floor");
    expect(model.selectedDocument.markdown).toContain("GM review remains required");
    expect(model.selectedDocument.markdown).toContain("C1 representative fixture authority");
    expect(model.selectedDocument.markdown).toContain("Initiative resolves highest first");
    expect(model.selectedDocument.markdown).toContain("initiative `7`");
    expect(model.selectedDocument.markdown).toContain("initiative `4`");
    expect(model.selectedDocument.markdown).toContain(
      "Explicit `next_round` onset remains deferred",
    );
    expect(model.selectedDocument.markdown).toContain(
      "complete canonical weapon source establishes an arm/hand requirement",
    );
    expect(model.selectedDocument.markdown).toContain("exact rational arithmetic");
    expect(model.selectedDocument.markdown).toContain(
      "Generic `treatment` text remains GM-managed",
    );
    expect(model.selectedDocument.markdown).toContain(
      "bulk activation of the 608-result catalogue",
    );
    expect(model.selectedDocument.markdown).not.toContain("Glantri_CriticalEffects_AppFacing");
    expect(model.selectedDocument.markdown).not.toContain("AppFacing_Crits");
  });

  it("loads the player Parry page from its audience subdirectory", async () => {
    const model = await getRulesDocumentationPageModel({ selectedDocumentId: "player-parry" });

    expect(model.selectedDocument.title).toBe("Parry \u2014 Player Rules");
    expect(model.selectedDocument.markdown).toContain("# Parry \u2014 Player Rules");
    expect(model.selectedDocument.markdown).toContain(
      "The rule uses one fifth of total Dodge, rounded down.",
    );
    expect(model.selectedDocument.markdown).toContain("21 or higher succeeds; 20 or lower fails");
  });

  it("loads the GM Parry procedure from its audience subdirectory", async () => {
    const model = await getRulesDocumentationPageModel({ selectedDocumentId: "gm-parry" });

    expect(model.selectedDocument.title).toBe("Parry \u2014 GM Procedure");
    expect(model.selectedDocument.markdown).toContain("# Parry \u2014 GM Procedure");
    expect(model.selectedDocument.markdown).toContain("## 1. Validate The Declaration");
    expect(model.selectedDocument.markdown).toContain("Current Operational Boundaries");
    // Forgejo #651, item 3: this page carried a development-tracker link, which became a live
    // reader-facing anchor once Markdown links started rendering (#637). The provenance it stood
    // for is recorded in the unregistered Parry internal notes, which stay the referenced source.
    expect(model.selectedDocument.markdown).toContain(
      "[Parry internal notes](../internal/parry-notes.md)",
    );
    expect(model.selectedDocument.markdown).not.toContain("issue #211");
  });

  it("publishes the no-eligible-Parry-source resolution on the GM Parry procedure", async () => {
    const model = await getRulesDocumentationPageModel({ selectedDocumentId: "gm-parry" });

    // The settled rule for a defender who cannot parry at all: the step is recorded and the round
    // continues to damage, and the reason no further defence is rolled is part of the rule, because
    // it is what stops a reader expecting a Dodge here. Each fragment sits inside one source line.
    expect(model.selectedDocument.markdown).toContain(
      "### 2.1 When The Defender Has No Parry Source",
    );
    expect(model.selectedDocument.markdown).toContain(
      "A bow, a sling, a firearm, or a weapon that",
    );
    expect(model.selectedDocument.markdown).toContain(
      "a Buckler or a Round Shield carries no Parry value of its own",
    );
    expect(model.selectedDocument.markdown).toContain(
      "record that no Parry was available and continue straight to damage",
    );
    expect(model.selectedDocument.markdown).toContain(
      "Dodge and DB were already applied in deciding whether the attack connected",
    );
    expect(model.selectedDocument.markdown).toContain("no further defence is resolved here");
    expect(model.selectedDocument.markdown).toContain(
      "that the Parry step was reached and that no Parry was available",
    );

    // The two load-bearing sentences, whole, against a whitespace-flowed form, so a reflow cannot
    // leave the single-line fragments above matching while the published claim has changed.
    const flowed = model.selectedDocument.markdown.replace(/\s+/g, " ");
    expect(flowed).toContain(
      "After a hit or grazing hit, record that no Parry was available and continue straight to damage resolution.",
    );
    expect(flowed).toContain(
      "Nothing is rolled at this step, and nothing takes the Parry roll's place: the defender's Dodge and DB were already applied in deciding whether the attack connected, so that defence has already had its effect on this attack and no further defence is resolved here.",
    );
  });

  it("points the player Parry page at the no-Parry-source resolution", async () => {
    const model = await getRulesDocumentationPageModel({ selectedDocumentId: "player-parry" });

    expect(model.selectedDocument.markdown).toContain(
      "If nothing you are wielding can parry, no Parry was available against",
    );
    expect(model.selectedDocument.markdown).toContain(
      "[When the defender has no Parry source](../gm/parry.md#21-when-the-defender-has-no-parry-source)",
    );

    const flowed = model.selectedDocument.markdown.replace(/\s+/g, " ");
    expect(flowed).toContain(
      "If nothing you are wielding can parry, no Parry was available against this attack and the round goes straight on to damage",
    );
  });

  it("keeps development-tracker links off every registered reader page", async () => {
    // A tracker link on a reader page is not a stale claim, so no content pin would catch it, and
    // since Forgejo #637 it renders as a live anchor rather than inert text. Issue tracking belongs
    // in internal notes and decision records, which are deliberately unregistered.
    for (const document of getRulesDocuments()) {
      const markdown = fs.readFileSync(path.join(rulesDocsDirectory, document.fileName), "utf8");

      for (const tracker of ["github.com", "/issues/"]) {
        expect(
          markdown.includes(tracker),
          `registered reader page ${document.fileName} links to development tracking ("${tracker}")`,
        ).toBe(false);
      }
    }
  });

  it("loads the GM Criticals value reference with the subtracted armor modifier", async () => {
    const model = await getRulesDocumentationPageModel({ selectedDocumentId: "gm-criticals" });

    expect(model.selectedDocument.title).toBe("Criticals \u2014 GM Value Reference");
    expect(model.selectedDocument.markdown).toContain(
      "final critical roll = 2d8 + critical type modifier - armor critical modifier",
    );
    expect(model.selectedDocument.markdown).toContain(
      "**The armor critical modifier is subtracted.**",
    );
  });

  it("loads the Competency Rules page with the Skill, Learning Group and Profession structure", async () => {
    const model = await getRulesDocumentationPageModel({ selectedDocumentId: "competency-rules" });

    expect(model.selectedDocument.title).toBe("Competency Rules");
    expect(model.selectedDocument.markdown).toContain("# Competency rules");
    expect(model.selectedDocument.markdown).toContain("## Learning Groups");
    expect(model.selectedDocument.markdown).toContain("## Professions");
  });

  it("keeps the retained Pilot baseline intact on disk although it is unpublished", () => {
    // De-registering these two pages removed them from reader exposure, not from the repository.
    // Their content assertions are kept here, read straight from disk, so the retained baseline
    // cannot drift silently now that no reader route loads it.
    const rules = fs.readFileSync(path.join(rulesDocsDirectory, "pilot-skill-rules-v1.md"), "utf8");

    expect(rules).toContain("# Pilot Skill Rules v1");
    expect(rules).toContain("direct Skill cost = Skill weight \u00d7 directly acquired ranks");
    expect(rules).toContain("group bundle cost = ceil(2/3 \u00d7 weightedUseful)");
    expect(rules).toContain("non-recursive-temporary-pilot-limitation");
    expect(rules).toContain("Mandatory spoken language");
    expect(rules).toContain("Configuration Formation `47`, Flex `5`");

    const release = fs.readFileSync(
      path.join(rulesDocsDirectory, "pilot-skill-content-release-v1.md"),
      "utf8",
    );

    expect(release).toContain("# Pilot Skill Content Release v1");
    expect(release).toContain("content-release:pilot-skills:1");
    expect(release).toContain("pilot-skills-content/1.0.1");
    expect(release).toContain("f524303b274b546c42daac06b65403957e896f35609d42ce7456ff5781c9f419");
    expect(release).toContain("Every exception records `grantsCompetence: 0`");
    expect(release).toContain("Recursive relationships remain deferred");
  });

  it("registers only pages that exist on disk", () => {
    for (const document of getRulesDocuments()) {
      expect(
        fs.existsSync(path.join(rulesDocsDirectory, document.fileName)),
        `registered rules document is missing from docs/rules: ${document.fileName}`,
      ).toBe(true);
    }
  });

  it("uses unique ids, file names and order values", () => {
    const documents = getRulesDocuments();

    expect(new Set(documents.map((document) => document.id)).size).toBe(documents.length);
    expect(new Set(documents.map((document) => document.fileName)).size).toBe(documents.length);
    expect(new Set(documents.map((document) => document.order)).size).toBe(documents.length);
  });

  it("classifies every docs/rules page as either registered or deliberately unregistered", () => {
    const onDisk = listRulesMarkdownFiles(rulesDocsDirectory).sort();
    const registered = getRulesDocuments().map((document) => document.fileName);
    const classified = [...registered, ...Object.keys(unregisteredRulesDocuments)].sort();

    // A new or renamed page cannot land unclassified, and a removed page cannot leave a stale
    // exclusion behind. Classifying a page does not publish it: an internal-only note must never
    // be registered merely to satisfy an accessibility check.
    expect(classified).toEqual(onDisk);
  });

  it("resolves a relative link target against the registry, and only against the registry", () => {
    /* A registered page becomes the reader route the sidebar already uses. */
    expect(resolveRulesDocumentLink("./combat-to-hit.md", "combat-round-and-actions.md")).toEqual({
      href: "/admin/rules-docs?doc=combat-to-hit",
      kind: "document",
    });
    /* Into a subdirectory, and back out of one, with the author's fragment preserved. */
    expect(resolveRulesDocumentLink("./gm/criticals.md", "combat-round-and-actions.md")).toEqual({
      href: "/admin/rules-docs?doc=gm-criticals",
      kind: "document",
    });
    expect(
      resolveRulesDocumentLink("../combat-round-and-actions.md#8-observe-opponent", "gm/parry.md"),
    ).toEqual({
      href: "/admin/rules-docs?doc=combat-round-and-actions#8-observe-opponent",
      kind: "document",
    });

    /* A same-page fragment stays a fragment, and an ordinary web address stays itself. */
    expect(resolveRulesDocumentLink("#6-distance", "combat-round-and-actions.md")).toEqual({
      href: "#6-distance",
      kind: "fragment",
    });
    expect(resolveRulesDocumentLink("https://example.test/x", "gm/parry.md")).toEqual({
      href: "https://example.test/x",
      kind: "external",
    });

    /* Everything with no reader route is unrouted, and no page is registered to change that. */
    for (const [target, source] of [
      ["./pilot-skill-rules-v1.md", "competency-rules.md"],
      ["./competency-reference/skills.md", "competency-rules.md"],
      ["../decisions/rules/0011-shared.md", "competency-rules.md"],
      ["../audits/c1-critical-fixtures.md", "combat-critical-effects.md"],
      ["../recovery/2026-09-06-c1-five-key-post-393-payloads.json", "combat-critical-effects.md"],
      ["javascript:void", "competency-rules.md"],
      ["/admin/characters", "competency-rules.md"],
    ] as const) {
      expect(resolveRulesDocumentLink(target, source), target).toEqual({ kind: "unrouted" });
    }

    /* Without a containing document a relative target cannot be resolved, so it is not guessed. */
    expect(resolveRulesDocumentLink("./combat-to-hit.md")).toEqual({ kind: "unrouted" });
  });

  it("expands structured rule-table directives into markdown tables", () => {
    expect(expandStructuredRuleTableDirectives("{{rule-table:combat-hit-location}}")).toContain(
      "| 20 | Head | Head | `head` |",
    );
    expect(expandStructuredRuleTableDirectives("{{rule-table:combat-hit-location}}")).toContain(
      "| 1 | Lower left leg | L lower | `lowerLeftLeg` |",
    );
  });
});
