/**
 * #845 / ruling #850 — the rendered proof.
 *
 * Two jobs:
 *
 * 1. **The control survey.** Every control a GM can reach that sets a Scenario participant's
 *    `isActive`, enumerated from the rendered page rather than from the source, with its label and
 *    whether it is reachable while an Encounter is under way. The issue recorded this as unmeasured
 *    and the ruling makes it the enforcement target.
 * 2. **The rendered captures.** The disabled control and the note that replaces the unsafe click,
 *    at 768, 1024 and 1440 — the GM widths this surface is reviewed at — with the measured rects
 *    and `window.scrollY` read inside one `page.evaluate`.
 *
 * The fixture is a Scenario with one Encounter under way, built through the real API with the
 * Combat Experience obligation resolved, so the round carries commands and is genuinely mid-round
 * rather than merely open.
 */
import fs from "node:fs";
import path from "node:path";

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import { API_URL } from "./targets";

const GM_STORAGE_STATE = "e2e/.auth/gm.json";
const SURVEY_WIDTHS = [768, 1024, 1440] as const;

async function json<T>(response: Awaited<ReturnType<APIRequestContext["get"]>>): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${response.url()} ${await response.text()}`);
  }
  return response.json() as Promise<T>;
}

function characterPayload(id: string, name: string) {
  return {
    build: {
      currentStatModifiers: {},
      developedStatModifiers: { str: 1 },
      equipment: { items: [] },
      id,
      name,
      profile: {
        description: "",
        distractionLevel: 3,
        id: `profile-${id}`,
        label: "Profile",
        resolvedStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 13,
          will: 10,
        },
        rolledStats: {
          cha: 10,
          com: 10,
          con: 10,
          dex: 10,
          health: 10,
          int: 10,
          lck: 10,
          pow: 10,
          siz: 10,
          str: 12,
          will: 10,
        },
        societyLevel: 0,
        statLayerVersion: 1,
      },
      progression: {
        chargenMode: "standard",
        educationPoints: 0,
        flexiblePointFactor: 1,
        level: 1,
        primaryPoolSpent: 0,
        primaryPoolTotal: 60,
        secondaryPoolSpent: 0,
        secondaryPoolTotal: 0,
        skillGroups: [],
        skills: [],
        specializations: [],
      },
      progressionState: { availablePoints: 0, checks: [], history: [], pendingAttempts: [] },
    },
  };
}

interface Fixture {
  campaignId: string;
  encounterId: string;
  encounterTitle: string;
  participantIds: string[];
  participantNames: string[];
  roundCommandCount: number;
  roundStep: string;
  scenarioId: string;
}

async function buildRunningEncounter(request: APIRequestContext, suffix: string): Promise<Fixture> {
  const now = () => new Date().toISOString();
  const { campaign } = await json<{ campaign: { id: string } }>(
    await request.post(`${API_URL}/campaigns`, {
      data: { name: `Deactivation Boundary ${suffix}` },
    }),
  );
  const participantNames = [`Glim Fairwater ${suffix}`, `Brann Holt ${suffix}`];
  const characterIds: string[] = [];
  for (const [index, name] of participantNames.entries()) {
    const id = `db845-${suffix}-${index}`;
    await json(await request.post(`${API_URL}/characters`, { data: characterPayload(id, name) }));
    await json(
      await request.post(`${API_URL}/campaigns/${campaign.id}/roster`, {
        data: { category: "pc", sourceId: id, sourceType: "character" },
      }),
    );
    characterIds.push(id);
  }
  const { scenario } = await json<{ scenario: { id: string } }>(
    await request.post(`${API_URL}/campaigns/${campaign.id}/scenarios`, {
      data: { name: `Boundary Scenario ${suffix}`, status: "live" },
    }),
  );
  const participants: { characterId: string; id: string }[] = [];
  for (const characterId of characterIds) {
    const { participant } = await json<{ participant: { characterId: string; id: string } }>(
      await request.post(`${API_URL}/scenarios/${scenario.id}/participants/character`, {
        data: { characterId },
      }),
    );
    participants.push(participant);
  }
  const encounterId = `db845-encounter-${suffix}`;
  const encounterTitle = `Courtyard Skirmish ${suffix}`;
  const rows = participants.map((participant, index) => ({
    characterId: participant.characterId,
    id: `db845-ep-${suffix}-${index}`,
    label: participantNames[index],
    participantType: "scenario" as const,
    scenarioParticipantId: participant.id,
  }));
  const { encounter: created } = await json<{ encounter: { updatedAt: string } }>(
    await request.post(`${API_URL}/scenarios/${scenario.id}/encounters`, {
      data: {
        session: {
          campaignId: campaign.id,
          createdAt: now(),
          id: encounterId,
          kind: "combat",
          participantMembershipMode: "explicit",
          participants: rows,
          scenarioId: scenario.id,
          status: "draft",
          title: encounterTitle,
          updatedAt: now(),
        },
      },
    }),
  );
  await json(
    await request.patch(`${API_URL}/encounters/${encounterId}/status`, {
      data: { expectedRevision: created.updatedAt, status: "active" },
    }),
  );

  // Resolve the round's Combat Experience obligation, so the round records commands of its own and
  // the Encounter is mid-round rather than merely open. The next task is discovered from the
  // route's own `actualTask` report rather than guessed, and the loop is bounded.
  const readEncounter = async () =>
    (
      await json<{
        encounter: {
          combatRoundState?: { commands?: unknown[]; currentStep?: string };
          updatedAt: string;
        };
      }>(await request.get(`${API_URL}/encounters/${encounterId}`))
    ).encounter;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const encounter = await readEncounter();
    const probe = await request.post(
      `${API_URL}/encounters/${encounterId}/combat-round/advance-deterministic`,
      {
        data: { executionGroupId: "db845", expectedRevision: encounter.updatedAt, taskId: "db845" },
      },
    );
    const body = (await probe.json()) as {
      actualTask?: { executionGroupId: string; kind: string; taskId: string };
    };
    const task = body.actualTask;
    if (!task || task.kind !== "combat_experience") break;
    if (task.taskId.includes(":stage:difficulty:")) {
      await json(
        await request.post(
          `${API_URL}/encounters/${encounterId}/combat-round/combat-experience-difficulty`,
          {
            data: {
              difficulty: 50,
              executionGroupId: task.executionGroupId,
              expectedRevision: encounter.updatedAt,
              taskId: task.taskId,
            },
          },
        ),
      );
      continue;
    }
    const encounterParticipantId = task.taskId.slice(task.taskId.lastIndexOf(":") + 1);
    const row = rows.find((candidate) => candidate.id === encounterParticipantId);
    if (!row) break;
    await json(
      await request.post(
        `${API_URL}/encounters/${encounterId}/combat-round/roll-combat-experience`,
        {
          data: {
            difficulty: 50,
            executionGroupId: task.executionGroupId,
            expectedRevision: encounter.updatedAt,
            scenarioParticipantId: row.scenarioParticipantId,
            taskId: task.taskId,
          },
        },
      ),
    );
  }
  const prepared = await readEncounter();

  return {
    campaignId: campaign.id,
    encounterId,
    encounterTitle,
    participantIds: participants.map((participant) => participant.id),
    participantNames,
    roundCommandCount: prepared.combatRoundState?.commands?.length ?? 0,
    roundStep: prepared.combatRoundState?.currentStep ?? "unknown",
    scenarioId: scenario.id,
  };
}

async function openParticipantDetails(page: Page, fixture: Fixture): Promise<void> {
  await page.goto(`/campaigns/${fixture.campaignId}/scenarios/${fixture.scenarioId}`);
  const expander = page.getByRole("button", {
    name: `Toggle ${fixture.participantNames[0]} assignment details`,
  });
  await expect(expander).toBeVisible();
  const activityControl = page.getByLabel(
    `Toggle ${fixture.participantNames[0]} active scenario status`,
  );
  if ((await activityControl.count()) === 0) {
    await expander.click();
  }
  await expect(activityControl).toHaveCount(1);
}

function recordEvidence(name: string, value: unknown): void {
  const directory = test.info().outputPath();
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, `${name}.json`);
  fs.writeFileSync(file, `${JSON.stringify(value, undefined, 2)}\n`);
  // Printed as well as written: a recording probe whose only output is a file nobody reads is a
  // probe that measured nothing.
  console.log(`[845] ${name} ${JSON.stringify(value)}`);
}

test.describe("#845 deactivating a combatant of a running Encounter", () => {
  test.use({ storageState: GM_STORAGE_STATE });

  test("surveys every GM control that can set a participant inactive", async ({
    page,
    request,
  }) => {
    test.setTimeout(180_000);
    const fixture = await buildRunningEncounter(request, `survey${Date.now()}`);
    recordEvidence("fixture", fixture);
    expect(fixture.roundCommandCount).toBeGreaterThan(0);

    await page.setViewportSize({ height: 1000, width: 1440 });
    await openParticipantDetails(page, fixture);

    // Every checkbox on the GM Scenario surface, with its accessible name and state, read in one
    // evaluate so nothing is attributed to a control that had moved by the time it was read.
    const survey = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll("input[type=checkbox]")];
      return {
        controls: inputs.map((input) => ({
          ariaLabel: input.getAttribute("aria-label"),
          checked: (input as HTMLInputElement).checked,
          disabled: (input as HTMLInputElement).disabled,
        })),
        notes: [...document.querySelectorAll('[role="note"]')].map((note) =>
          (note.textContent ?? "").replace(/\s+/g, " ").trim(),
        ),
        scrollY: window.scrollY,
      };
    });
    recordEvidence("survey-scenario-page", survey);

    const activityControls = survey.controls.filter((control) =>
      control.ariaLabel?.endsWith("active scenario status"),
    );
    const encounterControls = survey.controls.filter((control) =>
      control.ariaLabel?.includes(` in ${fixture.encounterTitle}`),
    );

    // One activity control per participant, and one Encounter-roster control per participant per
    // Encounter — adjacent in the same row group, which is why the unsafe one is reachable by a GM
    // who means the safe one.
    expect(activityControls.length).toBe(1);
    expect(encounterControls.length).toBe(fixture.participantNames.length);

    // The unsafe control is closed while the Encounter runs; the safe sibling stays open.
    expect(activityControls[0]?.disabled).toBe(true);
    for (const control of encounterControls) {
      expect(control.disabled).toBe(false);
    }

    // The Campaign roster picker's own toggle reaches the same route in source, but it is offered
    // only for candidates who are not already active participants, so it cannot deactivate anyone.
    const rosterPickerControls = survey.controls.filter((control) =>
      control.ariaLabel?.endsWith("scenario participation"),
    );
    recordEvidence("survey-roster-picker-controls", rosterPickerControls);
    for (const control of rosterPickerControls) {
      expect(control.checked).toBe(false);
    }

    const note = survey.notes.find((text) => text.includes("Combatants enter and leave only"));
    expect(note).toBeTruthy();
    expect(note).toContain(fixture.participantNames[0]);
    expect(note).toContain(fixture.encounterTitle);
    expect(note?.toLowerCase()).not.toContain("refresh");
  });

  for (const width of SURVEY_WIDTHS) {
    test(`renders the refusal and the disabled control at ${width}`, async ({ page, request }) => {
      test.setTimeout(180_000);
      const fixture = await buildRunningEncounter(request, `w${width}x${Date.now()}`);
      await page.setViewportSize({ height: 1000, width });
      await openParticipantDetails(page, fixture);

      const noteSelector = `[data-testid="participation-frozen-${fixture.participantIds[0]}"]`;
      await expect(page.locator(noteSelector)).toHaveCount(1);
      await page.locator(noteSelector).scrollIntoViewIfNeeded();

      // One evaluate: the rects and the scroll offset they are relative to are read together, so a
      // scroll between two awaits cannot make the numbers disagree.
      const geometry = await page.evaluate(
        ({ activityLabel, selector }) => {
          const note = document.querySelector(selector);
          const activity = document.querySelector(`input[aria-label="${activityLabel}"]`);
          const rect = (element: Element | null) => {
            if (!element) return undefined;
            const box = element.getBoundingClientRect();
            return {
              bottom: Math.round(box.bottom),
              height: Math.round(box.height),
              left: Math.round(box.left),
              right: Math.round(box.right),
              top: Math.round(box.top),
              width: Math.round(box.width),
            };
          };
          const section = note?.closest("section") ?? null;
          return {
            documentScrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            noteDisabledSibling: (activity as HTMLInputElement | null)?.disabled ?? null,
            noteRect: rect(note),
            noteText: (note?.textContent ?? "").replace(/\s+/g, " ").trim(),
            scrollY: window.scrollY,
            // The note sits inside a table that scrolls horizontally at the narrowest GM width, so
            // the box it must fit is the Encounter Assignment section, not the page.
            sectionRect: rect(section),
            usableWidth: document.documentElement.clientWidth,
          };
        },
        {
          activityLabel: `Toggle ${fixture.participantNames[0]} active scenario status`,
          selector: noteSelector,
        },
      );
      recordEvidence(`geometry-${width}`, { fixture, geometry, requestedWidth: width });

      expect(geometry.noteDisabledSibling).toBe(true);
      expect(geometry.noteRect?.width).toBeGreaterThan(0);
      expect(geometry.noteRect?.height).toBeGreaterThan(0);
      // The note must sit inside its own section at every GM width: a refusal clipped by the
      // assignment table's horizontal scroll is a refusal the GM does not read.
      expect(geometry.noteRect!.left).toBeGreaterThanOrEqual(geometry.sectionRect!.left);
      expect(geometry.noteRect!.right).toBeLessThanOrEqual(geometry.sectionRect!.right);
      expect(geometry.noteRect!.right).toBeLessThanOrEqual(geometry.usableWidth);

      await page.screenshot({
        fullPage: true,
        path: test.info().outputPath(`issue845-participation-frozen-${width}.png`),
      });
    });
  }

  test("the server refuses the write even when the control is driven directly", async ({
    request,
  }) => {
    test.setTimeout(180_000);
    const fixture = await buildRunningEncounter(request, `api${Date.now()}`);
    const response = await request.put(
      `${API_URL}/scenarios/${fixture.scenarioId}/participants/${fixture.participantIds[0]}/metadata`,
      { data: { isActive: false } },
    );
    const body = (await response.json()) as { code?: string; error?: string };
    recordEvidence("direct-write-refusal", { body, status: response.status() });

    expect(response.status()).toBe(409);
    expect(body.code).toBe("encounter_participant_set_frozen");
    expect(body.error).toContain(fixture.participantNames[0]);
    expect(body.error).toContain(fixture.encounterTitle);
    expect(body.error?.toLowerCase()).not.toContain("refresh");

    // And nothing was written.
    const { participants } = await json<{ participants: { id: string; isActive: boolean }[] }>(
      await request.get(`${API_URL}/scenarios/${fixture.scenarioId}/participants`),
    );
    expect(
      participants.find((participant) => participant.id === fixture.participantIds[0])?.isActive,
    ).toBe(true);
  });
});
