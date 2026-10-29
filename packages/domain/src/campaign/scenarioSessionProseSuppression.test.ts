import { describe, expect, it } from "vitest";

import { encounterSessionSchema, type EncounterSession } from "../encounter/session";
import { scenarioParticipantSchema, scenarioSchema, type ScenarioParticipant } from "./scenario";
import { buildScenarioSessionView } from "./scenarioSession";

/**
 * Issue #798 tranche A, QA finding F1. `eventIdentifiesExcludedParticipant`
 * tested `summary.includes(name)` — a raw substring scan over persisted prose.
 * The scan was inert at baseline because nothing wrote the store that fed it;
 * PR #813 made it live, and it then withheld the player's **own** Activity
 * rows, which carry no identifying content, because a short display name is a
 * substring of ordinary English in the production summary templates.
 *
 * Every summary string below is a production template, cited at its write site.
 * The `apps/api` integration spec pins those templates to the route source; the
 * assertions here are over `buildScenarioSessionView`, so they run in ordinary
 * CI, which the `GLANTRI_DB_MODE=task` integration specs do not (#801).
 */

const now = "2026-10-28T10:00:00.000Z";

function participant(input: {
  controlledByUserId?: string;
  displayName: string;
  id: string;
}): ScenarioParticipant {
  return scenarioParticipantSchema.parse({
    characterId: `character-${input.id}`,
    controlledByUserId: input.controlledByUserId,
    createdAt: now,
    id: input.id,
    isActive: true,
    joinSource: "gm_added",
    role: input.controlledByUserId ? "player_character" : "npc",
    scenarioId: "scenario-1",
    snapshot: { displayName: input.displayName },
    sourceType: input.controlledByUserId ? "character" : "entity",
    state: { combat: {}, equipment: {}, health: {}, resources: {} },
    updatedAt: now,
  });
}

/** Encounter participant ids use the production shape `scenario-${ScenarioParticipant.id}`. */
function encounter(input: {
  id: string;
  scenarioParticipantIds: string[];
  status?: EncounterSession["status"];
  title: string;
  visibility?: Record<string, Record<string, boolean>>;
}): EncounterSession {
  return encounterSessionSchema.parse({
    createdAt: now,
    id: input.id,
    kind: "combat",
    participantMembershipMode: "explicit",
    participants: input.scenarioParticipantIds.map((scenarioParticipantId, index) => ({
      id: `scenario-${scenarioParticipantId}`,
      label: scenarioParticipantId,
      order: index,
      participantType: "scenario",
      scenarioParticipantId,
    })),
    ...(input.visibility ? { roleplayState: { visibility: input.visibility } } : {}),
    scenarioId: "scenario-1",
    status: input.status ?? "active",
    title: input.title,
    updatedAt: now,
  });
}

const scenario = scenarioSchema.parse({
  campaignId: "campaign-1",
  createdAt: now,
  id: "scenario-1",
  name: "Prose suppression",
  status: "live",
  updatedAt: now,
});

const ari = participant({ controlledByUserId: "user-ari", displayName: "Ari", id: "p-ari" });
const captain = participant({ displayName: "Gate Guard Captain", id: "p-captain" });

/**
 * The five rows QA measured, each with the summary its production write site
 * actually persists, and with the payload shape that site persists too.
 *
 * `encounter_created`, `encounter_started` and `encounter_paused` are written by
 * `encounterRepository.updateEncounter` / `scenarioRepository`, whose payload is
 * `{ audienceParticipantIds, encounterId }` — **no participant id of any kind**.
 * `encounter_skill_outcome` is the same shape. That is what makes the prose scan
 * load-bearing for L5 and what makes the substring form of it so damaging: for
 * these rows the prose is both the only identifying content and the only thing
 * the filter can read.
 */
function viewerOwnRows(encounterTitle = "Gatehouse") {
  const audience = { audienceParticipantIds: ["p-ari", "p-captain"], encounterId: "encounter-1" };
  return [
    {
      createdAt: now,
      eventType: "encounter_created",
      id: "event-created",
      payload: audience,
      scenarioId: scenario.id,
      sequence: 1,
      // encounterRoutes.ts: `Created ${encounter.kind} encounter ${encounter.title}.`
      summary: `Created combat encounter ${encounterTitle}.`,
    },
    {
      createdAt: now,
      eventType: "encounter_started",
      id: "event-started",
      payload: audience,
      scenarioId: scenario.id,
      sequence: 2,
      // encounterRoutes.ts: `Started encounter ${existingEncounter.title}.`
      summary: `Started encounter ${encounterTitle}.`,
    },
    {
      createdAt: now,
      eventType: "encounter_paused",
      id: "event-paused",
      payload: audience,
      scenarioId: scenario.id,
      sequence: 3,
      // scenarioRepository.ts: `Paused encounter ${encounter.name} because the Scenario paused.`
      summary: `Paused encounter ${encounterTitle} because the Scenario paused.`,
    },
    {
      createdAt: now,
      eventType: "encounter_skill_outcome",
      id: "event-skill",
      payload: audience,
      scenarioId: scenario.id,
      sequence: 4,
      // encounterRoutes.ts: `${participant.label} used ${skillLabel}: ${outcome}.`
      summary: "Ari used Stealth: success.",
    },
    {
      createdAt: now,
      eventType: "item_transferred",
      id: "event-pickup",
      participantId: "p-ari",
      payload: { ...audience, holderAfter: "character-p-ari" },
      scenarioId: scenario.id,
      sequence: 5,
      // scenarioService.ts: `${participant.snapshot.displayName} picked up ${name}.`
      summary: "Ari picked up Lost Seal.",
    },
  ];
}

function hiddenNpcRow(input: { displayName: string; id: string; sequence: number }) {
  return {
    createdAt: now,
    eventType: "encounter_skill_outcome",
    id: `event-skill-${input.id}`,
    payload: { audienceParticipantIds: ["p-ari"], encounterId: "encounter-1" },
    scenarioId: scenario.id,
    sequence: input.sequence,
    summary: `${input.displayName} used Stealth: success.`,
  };
}

function playerHistorySummaries(input: {
  encounters: EncounterSession[];
  eventLogs: ReturnType<typeof viewerOwnRows>;
  participants: ScenarioParticipant[];
}): string[] {
  return buildScenarioSessionView({
    availableObjects: [],
    encounters: input.encounters,
    eventLogs: input.eventLogs,
    participants: input.participants,
    scenario,
    userId: "user-ari",
    viewerMode: "player",
  }).history.map((event) => event.summary);
}

/** Gatehouse: the GM has hidden `hiddenId` from Ari and left the Captain visible. */
function gatehouseHiding(hiddenId: string): EncounterSession {
  return encounter({
    id: "encounter-1",
    scenarioParticipantIds: ["p-ari", "p-captain", hiddenId],
    title: "Gatehouse",
    visibility: {
      "scenario-p-ari": { "scenario-p-captain": true, [`scenario-${hiddenId}`]: false },
    },
  });
}

describe("stored-prose suppression matches names, not substrings (#798 F1)", () => {
  /**
   * Acceptance 1 and 2. `Ed` occurs inside `used`, `Started` and `Paused`;
   * `Bat` occurs inside `combat`; `Guard` occurs inside `Guardhouse`. The
   * substring form of the scan withheld 0 of 5 of Ari's own rows for `Ed`.
   */
  it.each([
    { expectedKept: 5, hiddenName: "Ed", title: "Gatehouse" },
    { expectedKept: 5, hiddenName: "Bat", title: "Gatehouse" },
    { expectedKept: 5, hiddenName: "Guard", title: "Guardhouse" },
  ])(
    "keeps all $expectedKept of the viewer's own rows when the hidden name is only a substring ($hiddenName)",
    ({ expectedKept, hiddenName, title }) => {
      const hidden = participant({ displayName: hiddenName, id: "p-hidden" });
      const summaries = playerHistorySummaries({
        encounters: [gatehouseHiding(hidden.id)],
        eventLogs: viewerOwnRows(title),
        participants: [ari, captain, hidden],
      });
      expect(summaries).toHaveLength(expectedKept);
      expect(summaries).toEqual(viewerOwnRows(title).map((event) => event.summary));
    },
  );

  /**
   * Acceptance 4, the L5 control. The hidden participant's own row must still
   * be withheld: `encounter_skill_outcome` carries no participant id, so the
   * prose is the only thing that identifies them.
   */
  it("still withholds a row whose prose names the hidden participant (L5 control)", () => {
    const shade = participant({ displayName: "Lurking Shade", id: "p-shade" });
    const summaries = playerHistorySummaries({
      encounters: [gatehouseHiding(shade.id)],
      eventLogs: [
        ...viewerOwnRows(),
        hiddenNpcRow({ displayName: "Lurking Shade", id: "shade", sequence: 6 }),
      ],
      participants: [ari, captain, shade],
    });
    expect(summaries).not.toContain("Lurking Shade used Stealth: success.");
    expect(summaries).toEqual(viewerOwnRows().map((event) => event.summary));
  });

  /**
   * Acceptance 5, re-measured after the Product Owner withdrew the covering
   * rule (#798 F6). A whole-word hit on the hidden `Guard` also occurs inside
   * the **visible** `Gate Guard Captain`, so word boundaries alone do not
   * settle this case — and nothing else is allowed to.
   *
   * The earlier rule ("the longest matching name wins") attributed the covered
   * occurrence to the visible participant and kept the row. `visibleNames` is
   * every active non-suppressed participant's display name, and a display name
   * is player-writable, so a player could name their own Character
   * `Lurking Shade used` and recover the hidden participant's own rows from
   * another player's Activity. The rule is gone.
   *
   * **Accepted behaviour, over-suppression that fails closed:** when a hidden
   * participant's display name is a word-boundary substring of a **visible**
   * participant's name, the visible participant's own rows are withheld from
   * players too. That is a cost, recorded rather than hidden; the leak it
   * replaces was the hidden participant's own action reaching another player.
   */
  it("withholds a visible participant's row whose name contains the hidden name", () => {
    const guard = participant({ displayName: "Guard", id: "p-guard" });
    const rows = [
      ...viewerOwnRows(),
      // The visible Captain's own row. Withheld: `Guard` occurs in it at a word
      // boundary, and no covering rule rescues it any more.
      hiddenNpcRow({ displayName: "Gate Guard Captain", id: "captain", sequence: 6 }),
      // The hidden participant's own row. Withheld, as it always was.
      hiddenNpcRow({ displayName: "Guard", id: "guard", sequence: 7 }),
    ];
    const summaries = playerHistorySummaries({
      encounters: [gatehouseHiding(guard.id)],
      eventLogs: rows,
      participants: [ari, captain, guard],
    });
    expect(summaries).not.toContain("Gate Guard Captain used Stealth: success.");
    expect(summaries).not.toContain("Guard used Stealth: success.");
    // F1 is still fixed: `Guard` inside `Gatehouse` is not a boundary hit, so
    // all five of the viewer's own rows survive.
    expect(summaries).toEqual(viewerOwnRows().map((event) => event.summary));
  });

  /**
   * #798 F6, the leak the covering rule opened, asserted at the domain layer.
   * A player-chosen display name of the form `<hidden name> used` entered the
   * visible set and covered the hidden occurrence inside the hidden
   * participant's own `encounter_skill_outcome` row. QA measured five variants
   * through real routes; all five are asserted here against
   * `buildScenarioSessionView`, which is the scan's only caller.
   */
  it.each([
    { attackerName: "Lurking Shade used" },
    { attackerName: "LURKING SHADE USED STEALTH" },
    { attackerName: "Lurking Shade" },
    { attackerName: "The Lurking Shade" },
    { attackerName: "Shade used" },
  ])(
    "withholds the hidden participant's own row when another player is named $attackerName (F6)",
    ({ attackerName }) => {
      const shade = participant({ displayName: "Lurking Shade", id: "p-shade" });
      // The attacker's own Character, visible to the viewer: a second PC on the
      // roster, active, not suppressed, so its name is in the visible set.
      const attacker = participant({
        controlledByUserId: "user-bryn",
        displayName: attackerName,
        id: "p-attacker",
      });
      const summaries = playerHistorySummaries({
        encounters: [
          encounter({
            id: "encounter-1",
            scenarioParticipantIds: ["p-ari", "p-attacker", "p-shade"],
            title: "Gatehouse",
            visibility: {
              "scenario-p-ari": { "scenario-p-attacker": true, "scenario-p-shade": false },
            },
          }),
        ],
        eventLogs: [
          ...viewerOwnRows(),
          hiddenNpcRow({ displayName: "Lurking Shade", id: "shade", sequence: 6 }),
        ],
        participants: [ari, attacker, shade],
      });
      expect(summaries).not.toContain("Lurking Shade used Stealth: success.");
    },
  );

  /**
   * Two participants sharing a display name, one visible and one hidden: the
   * prose is genuinely unattributable, so the row fails closed. This held under
   * the covering rule (equal-length names never covered each other) and still
   * holds without it. Stated as a measured behaviour rather than left implicit.
   */
  it("fails closed when a visible and a hidden participant share a display name", () => {
    const hiddenGuard = participant({ displayName: "Guard", id: "p-hidden-guard" });
    const visibleGuard = participant({ displayName: "Guard", id: "p-visible-guard" });
    const summaries = playerHistorySummaries({
      encounters: [
        encounter({
          id: "encounter-1",
          scenarioParticipantIds: ["p-ari", "p-visible-guard", "p-hidden-guard"],
          title: "Gatehouse",
          visibility: {
            "scenario-p-ari": {
              "scenario-p-hidden-guard": false,
              "scenario-p-visible-guard": true,
            },
          },
        }),
      ],
      eventLogs: [
        ...viewerOwnRows(),
        hiddenNpcRow({ displayName: "Guard", id: "guard", sequence: 6 }),
      ],
      participants: [ari, hiddenGuard, visibleGuard],
    });
    expect(summaries).not.toContain("Guard used Stealth: success.");
    expect(summaries).toEqual(viewerOwnRows().map((event) => event.summary));
  });

  /**
   * The same tie, at its worst: a hidden participant whose display name is
   * exactly the **viewer's own** name. The viewer's two rows that name them
   * (`Ari used Stealth: success.`, `Ari picked up Lost Seal.`) are withheld,
   * because the prose cannot distinguish the two participants and the rule
   * fails closed.
   *
   * Residual, recorded rather than fixed: unlike F1 this needs a deliberate
   * name collision with the viewer rather than an ordinary English word, and
   * resolving it would mean attributing prose by something other than the
   * prose — which for `encounter_skill_outcome` does not exist in the row.
   */
  it("withholds the viewer's own named rows when a hidden participant takes the viewer's name", () => {
    const impostor = participant({ displayName: "Ari", id: "p-impostor" });
    const summaries = playerHistorySummaries({
      encounters: [gatehouseHiding(impostor.id)],
      eventLogs: viewerOwnRows(),
      participants: [ari, captain, impostor],
    });
    expect(summaries).toEqual([
      "Created combat encounter Gatehouse.",
      "Started encounter Gatehouse.",
      "Paused encounter Gatehouse because the Scenario paused.",
    ]);
  });

  /**
   * Acceptance 3. With no visibility row anywhere, the suppressed set is still
   * non-empty — a participant sharing no Encounter with the viewer is
   * suppressed by the cross-Encounter boundary (L2), independent of any GM
   * hide. The substring scan therefore fired with no hide at all and withheld
   * 0 of 3 of the viewer's rows. Both triggers QA measured are covered: a party
   * split, and an NPC staged only in a GM draft Encounter.
   */
  it.each([
    { label: "a party split into another active Encounter", status: "active" as const },
    { label: "an NPC staged only in a GM draft Encounter", status: "draft" as const },
  ])("leaves the viewer's rows intact with empty visibility matrices and $label", ({ status }) => {
    const elsewhere = participant({
      ...(status === "active" ? { controlledByUserId: "user-ed" } : {}),
      displayName: "Ed",
      id: "p-ed",
    });
    const summaries = playerHistorySummaries({
      encounters: [
        encounter({
          id: "encounter-1",
          scenarioParticipantIds: ["p-ari", "p-captain"],
          title: "Gatehouse",
        }),
        encounter({ id: "encounter-2", scenarioParticipantIds: ["p-ed"], status, title: "Tower" }),
      ],
      eventLogs: viewerOwnRows(),
      participants: [ari, captain, elsewhere],
    });
    expect(summaries).toEqual(viewerOwnRows().map((event) => event.summary));
  });
});
